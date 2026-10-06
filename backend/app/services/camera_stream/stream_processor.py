"""
Stream Processor - Processes live camera frames, runs AI vehicle detection (UVH-26 / YOLOv11),
computes IRC:106 PCE queue metrics, renders visual overlays, and encodes JPEG payloads.
"""

import cv2
import numpy as np
import time
from typing import Dict, Any, List, Optional, Tuple

from app.services.vision_service import detector

# IRC:106-1990 Passenger Car Equivalent (PCE) & Mean vehicle lengths in meters
PCE_TABLE = {
    "car": {"pce": 1.0, "len": 4.5, "color": (255, 180, 0)},       # Cyan/Blue
    "bus": {"pce": 3.0, "len": 12.0, "color": (0, 255, 100)},      # Bright Green
    "truck": {"pce": 3.0, "len": 10.5, "color": (0, 140, 255)},    # Orange
    "auto": {"pce": 0.8, "len": 2.8, "color": (0, 255, 255)},      # Yellow
    "2-wheeler": {"pce": 0.5, "len": 1.8, "color": (220, 100, 255)} # Magenta
}

class StreamProcessor:
    """Processes video frames by executing vision inference and rendering live telemetry overlays."""

    def __init__(self):
        self.last_inference_results: Dict[str, Dict[str, Any]] = {}
        self.last_inference_time: Dict[str, float] = {}
        self.last_detections: Dict[str, List[Dict[str, Any]]] = {}

    def process_frame(
        self,
        camera_id: str,
        frame: np.ndarray,
        approach: str = "NORTH",
        conf_threshold: float = 0.35,
        enable_overlay: bool = True
    ) -> Tuple[np.ndarray, Dict[str, Any]]:
        """
        Runs object detection on frame and renders HUD telemetry overlay.
        Cached at ~5Hz to ensure smooth 25 FPS MJPEG streaming without GPU/CPU choking.
        Returns: (annotated_frame, telemetry_dict)
        """
        h, w = frame.shape[:2]
        now = time.time()
        last_t = self.last_inference_time.get(camera_id, 0.0)

        # Run AI detection every 200ms (5 FPS AI rate), while MJPEG streams at full 25 FPS
        if now - last_t >= 0.20 or camera_id not in self.last_inference_results:
            t0 = time.time()
            try:
                detections = detector.detect(frame, conf_threshold=conf_threshold)
            except Exception:
                detections = []
            infer_duration_ms = round((time.time() - t0) * 1000.0, 1)

            counts = {
                "car": 0,
                "bus": 0,
                "truck": 0,
                "auto": 0,
                "2-wheeler": 0
            }
            total_pce = 0.0
            total_length_m = 0.0

            for d in detections:
                v_class = d.get("vehicle_class", "car")
                if v_class in counts:
                    counts[v_class] += 1
                else:
                    counts["car"] += 1
                    v_class = "car"

                factors = PCE_TABLE.get(v_class, PCE_TABLE["car"])
                total_pce += factors["pce"]
                total_length_m += factors["len"]

            # IRC:106 Queue length calculation (assuming 2.5 effective lanes)
            queue_meters = round(total_length_m / 2.5, 1) if len(detections) > 0 else 0.0
            density_level = "LOW"
            if queue_meters > 60:
                density_level = "HEAVY / CONGESTED"
            elif queue_meters > 30:
                density_level = "MODERATE"

            telemetry = {
                "camera_id": camera_id,
                "approach": approach,
                "total_vehicles": len(detections),
                "counts": counts,
                "total_pce": round(total_pce, 1),
                "queue_meters": queue_meters,
                "density_level": density_level,
                "inference_latency_ms": infer_duration_ms,
                "timestamp": now
            }

            self.last_inference_results[camera_id] = telemetry
            self.last_detections[camera_id] = detections
            self.last_inference_time[camera_id] = now
        else:
            telemetry = self.last_inference_results.get(camera_id, {
                "camera_id": camera_id,
                "approach": approach,
                "total_vehicles": 0,
                "counts": {"car": 0, "bus": 0, "truck": 0, "auto": 0, "2-wheeler": 0},
                "total_pce": 0.0,
                "queue_meters": 0.0,
                "density_level": "LOW",
                "inference_latency_ms": 12.0,
                "timestamp": now
            })
            detections = self.last_detections.get(camera_id, [])

        annotated = frame.copy()
        if enable_overlay:
            annotated = self._render_overlay(annotated, detections, telemetry)

        return annotated, telemetry


    def _render_overlay(
        self,
        frame: np.ndarray,
        detections: List[Dict[str, Any]],
        telemetry: Dict[str, Any]
    ) -> np.ndarray:
        """Renders bounding boxes, vehicle tags, and ITS telemetry banner onto frame."""
        h, w = frame.shape[:2]

        # Draw vehicle bounding boxes
        for d in detections:
            bbox = d.get("bbox", [])
            if len(bbox) != 4:
                continue
            x1, y1, x2, y2 = [int(v) for v in bbox]
            v_class = d.get("vehicle_class", "car")
            conf = d.get("confidence", 0.0)
            track_id = d.get("track_id")

            color_spec = PCE_TABLE.get(v_class, PCE_TABLE["car"])
            color = color_spec["color"]

            # Bounding box
            cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

            # Label text
            id_str = f"#{track_id} " if track_id else ""
            label_txt = f"{id_str}{v_class.upper()} {int(conf * 100)}%"
            
            # Label background pill
            (tw, th), _ = cv2.getTextSize(label_txt, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
            cv2.rectangle(frame, (x1, max(0, y1 - th - 6)), (x1 + tw + 6, y1), color, -1)
            cv2.putText(frame, label_txt, (x1 + 3, max(th, y1 - 3)),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1, cv2.LINE_AA)

        # Draw Bottom Telemetry HUD Bar
        hud_h = 36
        overlay_strip = frame.copy()
        cv2.rectangle(overlay_strip, (0, h - hud_h), (w, h), (10, 14, 20), -1)
        cv2.addWeighted(overlay_strip, 0.85, frame, 0.15, 0, frame)

        # Left HUD: Vehicle & PCE stats
        hud_txt_left = (
            f"V: {telemetry['total_vehicles']} | "
            f"PCE: {telemetry['total_pce']} | "
            f"Queue: {telemetry['queue_meters']}m [{telemetry['density_level']}]"
        )
        cv2.putText(frame, hud_txt_left, (12, h - 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.48, (0, 255, 200), 1, cv2.LINE_AA)

        # Right HUD: Inference Latency & Model engine
        hud_txt_right = f"UVH-26 AI: {telemetry['inference_latency_ms']}ms"
        (rw, rh), _ = cv2.getTextSize(hud_txt_right, cv2.FONT_HERSHEY_SIMPLEX, 0.48, 1)
        cv2.putText(frame, hud_txt_right, (w - rw - 12, h - 12),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.48, (100, 200, 255), 1, cv2.LINE_AA)

        return frame

    def encode_jpeg(self, frame: np.ndarray, quality: int = 80) -> bytes:
        """Compresses OpenCV BGR frame into JPEG byte stream for MJPEG transmission."""
        ret, buffer = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), quality])
        if not ret:
            return b""
        return buffer.tobytes()


# Global singleton instance
stream_processor = StreamProcessor()
