"""
BRTS Lane Guard - real-time BRTS dedicated-lane violation detection.

Classification is deliberately binary: the UVH-26 model (fine-tuned on Indian
traffic) tells us exactly which vehicle class it saw, and we only ask one
question of it here - is this an authorized BRTS bus, or not. Everything that
isn't "Bus"/"Mini-bus" is "NOT BRTS", full stop - no separate car/truck/auto
taxonomy to get out of sync with what the ROI-intrusion decision actually cares
about.

Architecture:
  - One real upload slot, no fake per-corridor default videos.
  - A single loop reads a frame, runs detection on that exact frame, and only
    then serves it - what's displayed and what was detected are always the
    same frame (a decoupled fast-display/slow-detect split was tried and
    caused boxes to visibly drift off moving vehicles; UVH-26 is light enough,
    ~13 FPS on CPU, that this stays smooth without decoupling).
  - All CPU-bound work (decode, inference, OCR) runs via run_in_executor so it
    never blocks the event loop - other requests stay responsive while a
    video streams.
  - OCR only runs when the violation cooldown has actually elapsed (it's
    ~0.2s/call - running it on every intruding vehicle on every frame was the
    real bottleneck, not the detector).
  - Violations land in their own Postgres table via SQLAlchemy (no local
    SQLite file for the --reload watcher to churn on).
  - Real OCR (vision_service.read_license_plate) - never fabricates a plate;
    explicit "UNREADABLE" + reason on failure.
  - Deduplicates overlapping boxes and rejects pole/signal-shaped false
    positives (tall, narrow boxes) before they get labeled at all.
  - ROI is a per-session polygon, editable live from the page.
"""

import asyncio
import time
from pathlib import Path
from typing import Optional, List, Dict, Any

import cv2
import numpy as np

from app.services.vision_service import read_license_plate, PLATE_UNREADABLE, detector as uvh26_detector
from app.database import AsyncSessionLocal
from app.models.brts import BRTSViolation

BASE_DIR = Path(__file__).resolve().parent.parent.parent
BRTS_DATA_DIR = BASE_DIR / "data" / "brts"
BRTS_UPLOADS_DIR = BRTS_DATA_DIR / "uploads"
BRTS_EVIDENCE_DIR = BRTS_DATA_DIR / "evidence"
BRTS_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
BRTS_EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)

# UVH-26 raw classes that count as an authorized BRTS bus. Everything else is NOT BRTS.
BRTS_BUS_LABELS = {"Bus", "Mini-bus"}

# Fixed default BRTS lane ROI (normalized, center strip) - overridden per session via set_roi().
DEFAULT_ROI = [(0.30, 0.30), (0.70, 0.30), (0.85, 0.95), (0.15, 0.95)]

VIOLATION_COOLDOWN_SEC = 4.0
DETECTION_CONF = 0.45
DETECTION_IMG_SIZE = 640    # UVH-26-S is light enough to run every displayed frame at full
                            # res and still stay smooth (~13 FPS on CPU)


def _is_point_in_polygon(point, polygon) -> bool:
    x, y = point
    n = len(polygon)
    inside = False
    p1x, p1y = polygon[0]
    xinters = 0.0
    for i in range(n + 1):
        p2x, p2y = polygon[i % n]
        if y > min(p1y, p2y) and y <= max(p1y, p2y) and x <= max(p1x, p2x):
            if p1y != p2y:
                xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
            if p1x == p2x or x <= xinters:
                inside = not inside
        p1x, p1y = p2x, p2y
    return inside


def _deduplicate_raw_boxes(raw_boxes: List[Dict[str, Any]], iou_threshold: float = 0.45) -> List[Dict[str, Any]]:
    """Keep only the highest-confidence box per overlapping cluster, so one
    physical vehicle isn't reported twice under two different labels."""
    boxes_sorted = sorted(raw_boxes, key=lambda b: b["conf"], reverse=True)
    kept: List[Dict[str, Any]] = []
    for b in boxes_sorted:
        x1, y1, x2, y2 = b["bbox"]
        overlap = False
        for k in kept:
            kx1, ky1, kx2, ky2 = k["bbox"]
            ix1, iy1 = max(x1, kx1), max(y1, ky1)
            ix2, iy2 = min(x2, kx2), min(y2, ky2)
            if ix2 > ix1 and iy2 > iy1:
                inter = (ix2 - ix1) * (iy2 - iy1)
                area_b = (x2 - x1) * (y2 - y1)
                area_k = (kx2 - kx1) * (ky2 - ky1)
                iou = inter / float(area_b + area_k - inter)
                if iou > iou_threshold:
                    overlap = True
                    break
        if not overlap:
            kept.append(b)
    return kept


class BRTSSession:
    """One active uploaded video + its background detection loop."""

    def __init__(self, session_id: str, video_path: Path, junction_label: str):
        self.session_id = session_id
        self.video_path = video_path
        self.junction_label = junction_label
        self.roi = DEFAULT_ROI

        self.latest_jpeg: Optional[bytes] = None
        self.frame_count = 0
        self.violation_count = 0
        self.started_at = time.time()
        self.error: Optional[str] = None

        self._loop_task: Optional[asyncio.Task] = None
        self._stop = False
        self._last_violation_time = 0.0

    def set_roi(self, points: List[List[float]]) -> bool:
        """Replace the BRTS lane ROI polygon (normalized 0-1 coordinates, min 3 points)."""
        if not points or len(points) < 3:
            return False
        self.roi = [(max(0.0, min(1.0, float(p[0]))), max(0.0, min(1.0, float(p[1])))) for p in points]
        return True

    def start(self):
        self._loop_task = asyncio.create_task(self._run_loop())

    async def stop(self):
        self._stop = True
        if self._loop_task:
            self._loop_task.cancel()
            try:
                await self._loop_task
            except asyncio.CancelledError:
                pass

    async def _run_loop(self):
        """
        Reads a frame, runs detection on THAT exact frame, draws its own boxes,
        and only then serves it - so what's displayed and what was detected are
        always the same frame. UVH-26 is light enough (~13 FPS on CPU) that this
        stays smooth without needing to decouple display from detection, and
        decoupling them is exactly what caused boxes to drift off their vehicles
        on a faster-moving video.
        """
        loop = asyncio.get_running_loop()
        cap = await loop.run_in_executor(None, cv2.VideoCapture, str(self.video_path))
        if not cap.isOpened():
            self.error = "Could not open the uploaded video file."
            return

        model = uvh26_detector.model
        try:
            while not self._stop:
                ret, frame = await loop.run_in_executor(None, cap.read)
                if not ret:
                    await loop.run_in_executor(None, cap.set, cv2.CAP_PROP_POS_FRAMES, 0)
                    ret, frame = await loop.run_in_executor(None, cap.read)
                    if not ret:
                        self.error = "Video ended and could not be replayed."
                        break

                frame = cv2.resize(frame, (960, 540))
                self.frame_count += 1

                detections, new_violations = await loop.run_in_executor(None, self._detect, frame, model)
                for v in new_violations:
                    await self._log_violation(v)

                annotated = await loop.run_in_executor(None, self._draw_overlay, frame, detections)
                ok, jpeg = await loop.run_in_executor(
                    None, cv2.imencode, ".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 80]
                )
                if ok:
                    self.latest_jpeg = jpeg.tobytes()
        except asyncio.CancelledError:
            raise
        except Exception as e:
            self.error = f"Detection loop error: {e}"
        finally:
            cap.release()

    def _detect(self, frame: np.ndarray, model):
        """
        Runs in a worker thread: the expensive model pass + OCR on any
        intruder found. The only classification question asked is BRTS bus
        vs not - the model's raw label is kept for display/logging only.
        Returns (detections, new_violations).
        """
        H, W, _ = frame.shape
        detections: List[Dict[str, Any]] = []
        violations_found: List[Dict[str, Any]] = []

        if model is None:
            return detections, violations_found

        try:
            results = model(frame, verbose=False, conf=DETECTION_CONF, imgsz=DETECTION_IMG_SIZE)
            if not results or len(results) == 0:
                return detections, violations_found

            names = model.names  # UVH-26's own 14 vehicle classes - it has no "not a vehicle"
            # class, so a pole/signal it can't explain still gets forced into the closest-looking
            # vehicle guess (usually a tall, narrow "Two-wheeler"). Reject those by shape.
            raw_boxes: List[Dict[str, Any]] = []
            for box in results[0].boxes:
                cls_id = int(box.cls[0].item())
                conf = float(box.conf[0].item())
                x1, y1, x2, y2 = [int(v) for v in box.xyxy[0].tolist()]
                bw, bh = x2 - x1, y2 - y1

                if y2 < int(0.18 * H):
                    continue  # near the top of frame - distant sky/pole artifacts
                if bh / max(1.0, float(bw)) > 2.8 and bw < 35:
                    continue  # very tall and narrow - a pole/signal, not a vehicle

                raw_label = names.get(cls_id, "Others")
                raw_boxes.append({"bbox": (x1, y1, x2, y2), "raw_label": raw_label, "conf": conf})

            # OCR is expensive (~0.2s/call) and only one violation gets logged per
            # cooldown window anyway - running it on every intruding vehicle on every
            # single frame (a busy scene can have a dozen+) is what was actually making
            # frames slow, not the detector. Only attempt it when the cooldown has
            # actually elapsed, and stop after the first candidate that frame.
            can_log_violation = (time.time() - self._last_violation_time) >= VIOLATION_COOLDOWN_SEC

            for b in _deduplicate_raw_boxes(raw_boxes):
                conf = b["conf"]
                x1, y1, x2, y2 = b["bbox"]
                raw_label = b["raw_label"]
                is_brts = raw_label in BRTS_BUS_LABELS

                contact_x = (x1 + x2) / (2.0 * W)
                contact_y = (y1 * 0.2 + y2 * 0.8) / H
                in_lane = _is_point_in_polygon((contact_x, contact_y), self.roi)

                detections.append({
                    "bbox": (x1, y1, x2, y2),
                    "raw_label": raw_label,
                    "is_brts": is_brts,
                    "conf": conf,
                    "in_lane": in_lane
                })

                if in_lane and not is_brts and can_log_violation:
                    plate, plate_error = self._read_plate_for_vehicle(frame, (x1, y1, x2, y2), H, W)
                    violations_found.append({
                        "vehicle_label": raw_label,
                        "plate": plate,
                        "plate_error": plate_error,
                        "confidence": conf,
                        "frame": frame.copy()
                    })
                    can_log_violation = False  # this frame's one allowed violation slot is used
        except Exception:
            pass

        return detections, violations_found

    @staticmethod
    def _read_plate_for_vehicle(frame: np.ndarray, bbox, H: int, W: int):
        """
        OCR a vehicle's plate. A license plate is a small strip near the bottom
        of the vehicle, not the whole vehicle body - crop that region first (more
        effective magnification when upscaled for OCR), falling back to the full
        vehicle box if that region doesn't yield a plausible read.
        """
        x1, y1, x2, y2 = bbox
        bw, bh = x2 - x1, y2 - y1

        px1 = x1 + int(bw * 0.15)
        px2 = x2 - int(bw * 0.15)
        py1 = y1 + int(bh * 0.55)
        plate_crop = frame[max(0, py1):min(H, y2), max(0, px1):min(W, px2)]
        plate, plate_error = read_license_plate(plate_crop)
        if plate:
            return plate, None

        full_crop = frame[max(0, y1):min(H, y2), max(0, x1):min(W, x2)]
        plate2, plate_error2 = read_license_plate(full_crop)
        if plate2:
            return plate2, None
        return None, plate_error2 or plate_error

    def _draw_overlay(self, frame: np.ndarray, detections: List[Dict[str, Any]]):
        """Cheap per-frame drawing using the most recently cached detections -
        runs on every displayed frame without waiting on the model."""
        H, W, _ = frame.shape
        roi_pts = np.array([[int(p[0] * W), int(p[1] * H)] for p in self.roi], np.int32)

        overlay = frame.copy()
        cv2.fillPoly(overlay, [roi_pts], (45, 25, 120))
        cv2.addWeighted(overlay, 0.35, frame, 0.65, 0, frame)
        cv2.polylines(frame, [roi_pts], isClosed=True, color=(0, 235, 255), thickness=3)

        intrusions = 0
        for d in detections:
            x1, y1, x2, y2 = d["bbox"]
            if d["in_lane"] and d["is_brts"]:
                color, label = (0, 255, 0), f"BRTS BUS ({int(d['conf'] * 100)}%)"
            elif d["in_lane"]:
                intrusions += 1
                color, label = (0, 0, 255), f"NOT BRTS: {d['raw_label'].upper()} ({int(d['conf'] * 100)}%)"
            else:
                color, label = (255, 180, 50), f"{d['raw_label']} ({int(d['conf'] * 100)}%)"

            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
            cv2.putText(frame, label, (x1, max(15, y1 - 6)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 2)

        cv2.rectangle(frame, (0, 0), (W, 34), (15, 18, 26), -1)
        status = f"{intrusions} INTRUSION(S)" if intrusions else "LANE CLEAR"
        cv2.putText(frame, f"BRTS LAB | {self.junction_label} | {status}", (10, 23),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 0, 255) if intrusions else (0, 215, 255), 2)
        return frame

    async def _log_violation(self, v: Dict[str, Any]):
        now = time.time()
        if now - self._last_violation_time < VIOLATION_COOLDOWN_SEC:
            return
        self._last_violation_time = now
        self.violation_count += 1

        evidence_filename = f"{self.session_id}_{int(now)}.jpg"
        try:
            cv2.imwrite(str(BRTS_EVIDENCE_DIR / evidence_filename), v["frame"])
        except Exception:
            evidence_filename = None

        async with AsyncSessionLocal() as db:
            db.add(BRTSViolation(
                session_id=self.session_id,
                junction_label=self.junction_label,
                vehicle_label=v["vehicle_label"],
                license_plate=v["plate"] or PLATE_UNREADABLE,
                ocr_error=v["plate_error"],
                confidence=round(v["confidence"], 2),
                evidence_path=f"evidence/{evidence_filename}" if evidence_filename else None,
                status="PENDING"
            ))
            await db.commit()


# --- Single active-session registry (one upload at a time, per current scope) ---
_current_session: Optional[BRTSSession] = None


async def start_new_session(video_path: Path, junction_label: str) -> BRTSSession:
    global _current_session
    if _current_session:
        await _current_session.stop()
        _cleanup_file(_current_session.video_path)

    session = BRTSSession(f"brts_{int(time.time())}", video_path, junction_label)
    session.start()
    _current_session = session
    return session


async def stop_current_session():
    global _current_session
    if _current_session:
        await _current_session.stop()
        _cleanup_file(_current_session.video_path)
        _current_session = None


def get_current_session() -> Optional[BRTSSession]:
    return _current_session


def _cleanup_file(path: Path):
    try:
        if path.exists():
            path.unlink()
    except Exception:
        pass
