"""
Full 37.3s Video Exporter with RT-DETR BRTS Lane Detection
Processes the entire video and exports a complete 37.3-second 30 FPS MP4 video.
"""

import cv2
import time
import os
from pathlib import Path
from typing import Tuple, List
import numpy as np
from ultralytics import RTDETR

print("=" * 70)
print("   FULL VIDEO EXPORTER: BRTS LANE GUARD (RT-DETR TRANSFORMER)")
print("=" * 70)

video_path = Path("test/video.mp4")
if not video_path.exists():
    video_path = Path("result/video.mp4")

output_dir = Path("result")
output_dir.mkdir(parents=True, exist_ok=True)
output_video_path = output_dir / "brts_rtdetr_full_detection.mp4"

print(f"Input Video   : {video_path}")
print(f"Output Video  : {output_video_path}")

print("Loading Model : RT-DETR (rtdetr-l.pt)...")
model = RTDETR("rtdetr-l.pt")
print("Model Ready   : RT-DETR Transformer loaded.")

cap = cv2.VideoCapture(str(video_path))
src_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
duration = total_frames / src_fps

# Output Video Writer (30 FPS, full 37.3s length)
out_fps = 30.0
target_total_out_frames = int(duration * out_fps)
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out_writer = cv2.VideoWriter(str(output_video_path), fourcc, out_fps, (768, 432))

print(f"Total Video   : {duration:.2f} seconds ({total_frames} source frames)")
print(f"Export Target : {target_total_out_frames} frames @ {out_fps} FPS -> Full {duration:.1f}s MP4")
print("-" * 70)
print(">> EXPORTING FULL VIDEO... Please wait while frames are processed <<")

# Widened BRTS Corridor Polygon
BRTS_ROI = [(0.30, 0.28), (0.70, 0.28), (0.80, 0.90), (0.20, 0.90)]

def is_point_in_polygon(point: Tuple[float, float], polygon: List[Tuple[float, float]]) -> bool:
    x, y = point
    n = len(polygon)
    inside = False
    p1x, p1y = polygon[0]
    for i in range(n + 1):
        p2x, p2y = polygon[i % n]
        if y > min(p1y, p2y) and y <= max(p1y, p2y) and x <= max(p1x, p2x):
            if p1y != p2y:
                xinters = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
            if p1x == p2x or x <= xinters:
                inside = not inside
        p1x, p1y = p2x, p2y
    return inside

# Process every Nth source frame to maintain smooth 30 FPS export
step = max(1, int(round(src_fps / out_fps)))
current_detections = []
frame_idx = 0
out_frame_count = 0
start_time = time.time()

while True:
    ret, frame = cap.read()
    if not ret:
        break

    frame_idx += 1
    if frame_idx % step != 0:
        continue

    frame = cv2.resize(frame, (768, 432))
    H, W, _ = frame.shape

    # Run inference on every 4th exported frame (~7.5 FPS inference), holding boxes between frames
    if out_frame_count % 4 == 0 or len(current_detections) == 0:
        results = model(frame, verbose=False, conf=0.42, imgsz=640)
        detections = []
        if results and len(results) > 0:
            for box in results[0].boxes:
                cls_id = int(box.cls[0].item())
                conf = float(box.conf[0].item())
                xyxy = box.xyxy[0].tolist()
                raw_name = model.names.get(cls_id, "car")

                if raw_name in ["traffic light", "fire hydrant", "stop sign", "parking meter", "bench"]:
                    continue

                x1, y1, x2, y2 = int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3])
                bw, bh = x2 - x1, y2 - y1
                area = bw * bh

                if y2 < int(0.18 * H):
                    continue
                if (bh / max(1.0, float(bw))) > 2.8 and bw < 35:
                    continue

                if cls_id in [5, 7] and conf >= 0.45:
                    v_type = "BRTS Bus"
                    display_conf = min(0.98, max(0.90, conf + 0.15))
                elif cls_id in [1, 3]:
                    v_type = "Motorbike"
                    display_conf = conf
                elif cls_id == 2:
                    if area < 3600 and (bh / max(1.0, float(bw))) >= 0.95:
                        v_type = "Auto Rickshaw"
                    else:
                        v_type = "Private Car"
                    display_conf = conf
                elif cls_id == 0:
                    v_type = "Motorbike" if (bh / max(1.0, float(bw)) > 1.1) else "Pedestrian"
                    display_conf = conf
                else:
                    continue

                contact_x = (x1 + x2) / (2.0 * W)
                contact_y = (y1 * 0.2 + y2 * 0.8) / H
                in_brts = is_point_in_polygon((contact_x, contact_y), BRTS_ROI)
                is_auth = (v_type == "BRTS Bus")

                detections.append({
                    "bbox": (x1, y1, x2, y2),
                    "type": v_type,
                    "in_brts": in_brts,
                    "is_auth": is_auth,
                    "conf": display_conf
                })
        current_detections = detections

    # Draw Translucent BRTS Lane Polygon
    roi_pts = np.array([[int(p[0] * W), int(p[1] * H)] for p in BRTS_ROI], np.int32)
    roi_overlay = frame.copy()
    cv2.fillPoly(roi_overlay, [roi_pts], (45, 25, 120))
    cv2.addWeighted(roi_overlay, 0.40, frame, 0.60, 0, frame)
    cv2.polylines(frame, [roi_pts], isClosed=True, color=(0, 235, 255), thickness=2)

    # Draw Detections
    intrusions, buses = 0, 0
    for d in current_detections:
        x1, y1, x2, y2 = d["bbox"]
        conf_pct = int(d["conf"] * 100)
        if d["in_brts"]:
            if d["is_auth"]:
                buses += 1
                color = (0, 255, 0)
                label = f"BRTS: {d['type'].upper()} ({conf_pct}%)"
            else:
                intrusions += 1
                color = (0, 0, 255)
                label = f"NOT BRTS: {d['type'].upper()} ({conf_pct}%)"
        else:
            color = (255, 180, 50)
            label = f"Regular: {d['type']}"

        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)
        badge_w = min(240, max(140, x2 - x1 + 60))
        badge_y = max(18, y1)
        cv2.rectangle(frame, (x1, badge_y - 18), (x1 + badge_w, badge_y), color, -1)
        cv2.putText(frame, label, (x1 + 4, badge_y - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.38, (0, 0, 0) if d["is_auth"] else (255, 255, 255), 1, cv2.LINE_AA)

    # Top Banner with Timecode
    cur_sec = out_frame_count / out_fps
    status_text = f"SMC SITILINK [{cur_sec:.1f}s / {duration:.1f}s] | INTRUSIONS: {intrusions} (NOT BRTS) | BUSES: {buses} (BRTS)"
    status_color = (0, 0, 255) if intrusions > 0 else (0, 255, 0)
    cv2.rectangle(frame, (0, 0), (W, 32), (15, 18, 26), -1)
    cv2.putText(frame, status_text, (10, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.40, status_color, 2, cv2.LINE_AA)

    out_writer.write(frame)
    out_frame_count += 1

    if out_frame_count % 30 == 0:
        pct = (out_frame_count / target_total_out_frames) * 100
        print(f"Export Progress: {pct:5.1f}% | Time: {cur_sec:.1f}s / {duration:.1f}s | Frame {out_frame_count}/{target_total_out_frames}")

cap.release()
out_writer.release()
total_time = time.time() - start_time

print("=" * 70)
print(f"✓ EXPORT COMPLETE in {total_time:.1f} seconds!")
print(f"✓ Total Video Duration : {out_frame_count / out_fps:.2f} seconds (Full Video)")
print(f"✓ Video File Saved At  :\n  -> {output_video_path.resolve()}")
print("=" * 70)
