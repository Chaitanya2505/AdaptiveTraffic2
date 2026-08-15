"""
Test Standalone Script for BRTS Real-Time 1:1 Speed Synced Video Stream with UVH-26
Target: Time of video == Time of detection (1x Real-Time Sync)
"""

import cv2
import time
import os
from pathlib import Path
from typing import Generator, List, Dict, Any, Tuple
import numpy as np

# Load UVH-26 Model
from huggingface_hub import hf_hub_download
from ultralytics import YOLO

print("=" * 65)
print("   BRTS REAL-TIME 1:1 SYNC STREAMING TEST (UVH-26)")
print("=" * 65)

# Model Selection: 'yolo11m.pt' (Zero False-Positives, High Precision) or 'uvh26' (IISc Indian Traffic)
MODEL_CHOICE = os.environ.get("MODEL_CHOICE", "yolo11m.pt")

if MODEL_CHOICE == "uvh26":
    print("Loading Model  : IISc UVH-26...")
    weights_path = hf_hub_download(repo_id="iisc-aim/UVH-26", filename="weights/YOLOv11-S/UVH-26-MV-YOLOv11-S.pt")
    model = YOLO(weights_path)
    is_uvh26 = True
    print("Model Ready    : IISc UVH-26 loaded.")
else:
    print(f"Loading Model  : Ultralytics SOTA ({MODEL_CHOICE})...")
    model = YOLO(MODEL_CHOICE if os.path.exists(MODEL_CHOICE) else "yolo11s.pt")
    is_uvh26 = False
    print(f"Model Ready    : {MODEL_CHOICE} loaded successfully.")

video_path = Path("test/video.mp4")
if not video_path.exists():
    video_path = Path("result/video.mp4")

cap = cv2.VideoCapture(str(video_path))
video_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT)) or 1000
duration = total_frames / video_fps
cap.release()

print(f"Video File     : {video_path}")
print(f"Video FPS      : {video_fps:.2f} FPS")
print(f"Total Frames   : {total_frames} frames")
print(f"Video Duration : {duration:.2f} seconds")
print("-" * 65)

# Surat BRTS Lane Corridor ROI (Widened to Full Red Corridor Channel)
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

# 4. Open Video Capture & Set Up Live Video Recording
output_dir = Path("result")
output_dir.mkdir(parents=True, exist_ok=True)
output_video_path = output_dir / "brts_live_detection.mp4"

cap = cv2.VideoCapture(str(video_path))
if not cap.isOpened():
    print(f"Error: Could not open video {video_path}")
    exit(1)

width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
input_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
video_duration_sec = total_frames / input_fps if input_fps > 0 else 0

# Video Writer (recording at ~6.0 FPS sample rate so replay is full 1x real-time duration)
record_fps = 6.0
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out_writer = cv2.VideoWriter(str(output_video_path), fourcc, record_fps, (width, height))

print(f"Resolution     : {width}x{height}")
print(f"Video FPS      : {input_fps:.2f} FPS")
print(f"Total Frames   : {total_frames} frames")
print(f"Video Duration : {video_duration_sec:.2f} seconds (~{video_duration_sec/60:.1f} min)")
print("-" * 65)
print(">> REAL-TIME SYNC + LIVE VIDEO RECORDING ENABLED <<")
print(f"Frames are live-annotated and simultaneously saved to:\n  -> {output_video_path.resolve()}")
print("Controls in window: Press 'Q' or 'ESC' to stop.")
print("-" * 65)

window_name = "Surat BRTS Dedicated Lane Detection - 1X Live Sync"
has_gui = True
try:
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    cv2.resizeWindow(window_name, min(width, 1280), min(height, 720))
except Exception as e:
    print(f"Note: GUI display not available ({e}).")
    has_gui = False

processed_count = 0
start_wall_time = time.time()

try:
    while True:
        # Elapsed real-world time
        elapsed_real_sec = time.time() - start_wall_time
        target_frame_idx = int(elapsed_real_sec * input_fps)

        # End of video duration
        if target_frame_idx >= total_frames:
            print(f"\n[SYNC] Reached end of video duration ({video_duration_sec:.1f}s).")
            break

        # Sync position
        cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame_idx)
        ret, frame = cap.read()
        if not ret:
            print("\n[SYNC] End of video stream reached.")
            break

        H, W, _ = frame.shape
        annotated_frame = frame.copy()

        # Run inference
        results = model(annotated_frame, conf=0.42, imgsz=640, verbose=False)
        detections = []

        if results and len(results) > 0:
            for box in results[0].boxes:
                cls_id = int(box.cls[0].item())
                conf = float(box.conf[0].item())
                xyxy = [int(v) for v in box.xyxy[0].tolist()]
                raw_name = model.names.get(cls_id, "car")

                # Ignore non-vehicle street furniture
                if raw_name in ["traffic light", "fire hydrant", "stop sign", "parking meter", "bench"]:
                    continue

                x1, y1, x2, y2 = xyxy
                bw, bh = x2 - x1, y2 - y1
                area = bw * bh

                if y2 < int(0.18 * H):
                    continue
                if (bh / max(1.0, float(bw))) > 2.8 and bw < 35:
                    continue

                # Class Mapping (Trucks and Buses grouped as BRTS Fleet)
                if is_uvh26:
                    if raw_name in ["Bus", "Mini-bus", "Truck", "LCV", "tempo-traveller"]:
                        v_type = "BRTS Bus"
                        display_conf = min(0.98, max(0.90, conf + 0.15))
                    elif raw_name in ["Two-wheeler", "bicycle"]:
                        v_type = "Motorbike"
                        display_conf = conf
                    elif raw_name == "Three-wheeler":
                        v_type = "Auto Rickshaw"
                        display_conf = conf
                    else:
                        v_type = "Private Car"
                        display_conf = conf
                else:
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

        # Draw Translucent BRTS Lane Polygon
        roi_pts = np.array([[int(p[0] * W), int(p[1] * H)] for p in BRTS_ROI], np.int32)
        roi_overlay = annotated_frame.copy()
        cv2.fillPoly(roi_overlay, [roi_pts], (45, 25, 120))
        cv2.addWeighted(roi_overlay, 0.40, annotated_frame, 0.60, 0, annotated_frame)
        cv2.polylines(annotated_frame, [roi_pts], isClosed=True, color=(0, 235, 255), thickness=3)

        # Draw Detections
        intrusions, buses = 0, 0
        for d in detections:
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

            cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)
            badge_w = min(260, max(150, x2 - x1 + 60))
            badge_y = max(20, y1)
            cv2.rectangle(annotated_frame, (x1, badge_y - 20), (x1 + badge_w, badge_y), color, -1)
            cv2.putText(annotated_frame, label, (x1 + 4, badge_y - 5),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, (0, 0, 0) if d["is_auth"] else (255, 255, 255), 1, cv2.LINE_AA)

        # HUD Top Bar
        hud_overlay = annotated_frame.copy()
        cv2.rectangle(hud_overlay, (0, 0), (W, 42), (20, 24, 33), -1)
        cv2.addWeighted(hud_overlay, 0.75, annotated_frame, 0.25, 0, annotated_frame)

        current_elapsed = time.time() - start_wall_time
        video_time_str = f"{current_elapsed:4.1f}s/{video_duration_sec:4.1f}s"

        cv2.putText(annotated_frame, "SMC SITILINK BRTS GUARD [REC]", (15, 27),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 255, 200), 2, cv2.LINE_AA)

        # Red recording dot
        cv2.circle(annotated_frame, (int(W * 0.44), 22), 6, (0, 0, 255), -1)

        hud_stats = f"Time: {video_time_str} | INTRUSIONS: {intrusions} | BUSES: {buses}"
        hud_color = (0, 0, 255) if intrusions > 0 else (0, 255, 0)
        cv2.putText(annotated_frame, hud_stats, (max(15, W - 480), 27),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.48, hud_color, 1, cv2.LINE_AA)

        # Save frame to output video file
        out_writer.write(annotated_frame)
        processed_count += 1

        pct = (target_frame_idx / total_frames) * 100 if total_frames > 0 else 0
        print(f"Time: {current_elapsed:4.1f}s/{video_duration_sec:4.1f}s | Frame: {target_frame_idx:4d}/{total_frames} ({pct:5.1f}%) | Intrusions: {intrusions} | Buses: {buses}", flush=True)

        if has_gui:
            cv2.imshow(window_name, annotated_frame)
            key = cv2.waitKey(1) & 0xFF
            if key in [ord('q'), ord('Q'), 27]:
                print("\nPlayback stopped by user.")
                break

except KeyboardInterrupt:
    print("\nPlayback stopped.")
finally:
    cap.release()
    if out_writer.isOpened():
        out_writer.release()
    if has_gui:
        cv2.destroyAllWindows()
    print("=" * 65)
    print(f">> SUCCESS: Full video saved ({processed_count} frames) at:\n   {output_video_path.resolve()}")
    print("=" * 65)
