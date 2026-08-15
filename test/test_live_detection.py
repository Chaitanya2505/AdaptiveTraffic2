import cv2
import os
import sys
import time
import torch
from huggingface_hub import hf_hub_download
from ultralytics import YOLO

# Model settings - matching existing project configuration
HF_REPO_ID = "iisc-aim/UVH-26"
UVH26_MODEL_FILENAME = "weights/YOLOv11-S/UVH-26-MV-YOLOv11-S.pt"

# Colors for vehicle classes (BGR)
CLASS_COLORS = {
    "Two-wheeler": (255, 144, 30),     # Cyan/Blue
    "Three-wheeler": (0, 215, 255),    # Gold/Yellow
    "Hatchback": (0, 255, 128),        # Spring Green
    "Sedan": (50, 205, 50),            # Lime Green
    "SUV": (255, 191, 0),              # Sky Blue
    "MUV": (205, 90, 106),             # Slate Blue
    "Van": (180, 105, 255),            # Pink/Purple
    "Bicycle": (255, 255, 0),          # Cyan
    "Bus": (0, 140, 255),              # Orange
    "Mini-bus": (0, 165, 255),         # Orange-red
    "Truck": (0, 0, 255),              # Red
    "Tempo-traveller": (128, 0, 128),  # Purple
    "LCV": (147, 20, 255),             # Violet
    "Others": (200, 200, 200)          # Gray
}

def get_color(label):
    return CLASS_COLORS.get(label, (0, 255, 0))

def main():
    print("=" * 65)
    print("   UVH-26 REAL-TIME LIVE DETECTION & VIDEO RECORDER")
    print("=" * 65)

    # 1. GPU / Device Check
    cuda_available = torch.cuda.is_available()
    device = "cuda" if cuda_available else "cpu"
    device_name = torch.cuda.get_device_name(0) if cuda_available else "CPU"
    print(f"CUDA available : {cuda_available}")
    print(f"Compute Device : {device.upper()} ({device_name})")

    # 2. Identify Video Path
    possible_paths = [
        os.path.abspath(os.path.join("result", "video.mp4")),
        os.path.abspath(os.path.join("test", "video.mp4")),
        os.path.abspath("video.mp4"),
        os.path.abspath("WhatsApp Video 2026-08-11 at 4.33.50 PM.mp4")
    ]
    
    video_path = None
    for p in possible_paths:
        if os.path.exists(p):
            video_path = p
            break

    if not video_path:
        print(f"Error: Could not locate input video in project folders.")
        return

    # Output path for saving
    output_dir = os.path.dirname(video_path)
    output_path = os.path.join(output_dir, "live_detection_result.mp4")

    print(f"Input Video    : {video_path}")
    print(f"Output Video   : {output_path}")

    # 3. Load YOLO Model (UVH-26 with fallback)
    print(f"Loading Model  : IISc UVH-26 ({HF_REPO_ID})...")
    try:
        weights_path = hf_hub_download(repo_id=HF_REPO_ID, filename=UVH26_MODEL_FILENAME)
        model = YOLO(weights_path)
        print(f"Model Ready    : UVH-26 weights loaded successfully.")
    except Exception as e:
        print(f"Warning: Hub error ({e}), loading local model fallback...")
        local_weights = "yolo11n.pt" if os.path.exists("yolo11n.pt") else "yolov8m.pt"
        model = YOLO(local_weights)
        print(f"Loaded Fallback: {local_weights}")

    model.to(device)

    # 4. Open Video Capture
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Error: Could not open video {video_path}")
        return

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    input_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    video_duration_sec = total_frames / input_fps if input_fps > 0 else 0

    # Initialize Video Writer (recording at ~6.0 FPS sample rate so replay is 1x real-time)
    record_fps = 6.0
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out_writer = cv2.VideoWriter(output_path, fourcc, record_fps, (width, height))

    print(f"Resolution     : {width}x{height}")
    print(f"Video FPS      : {input_fps:.2f} FPS")
    print(f"Total Frames   : {total_frames} frames")
    print(f"Video Duration : {video_duration_sec:.2f} seconds (~{video_duration_sec/60:.1f} min)")
    print("-" * 65)
    print(">> REAL-TIME SYNC + LIVE VIDEO RECORDING ENABLED <<")
    print(f"Frames are live-annotated and simultaneously saved to:\n  -> {output_path}")
    print("Controls in window:")
    print("  '+' / '-' : Increase / Decrease Confidence Threshold")
    print("  'H'       : Toggle Horizon/Sky Filter on/off")
    print("  'Q' / ESC : Quit")
    print("-" * 65)

    window_name = "Live YOLO Detection - Real-Time 1x Sync"
    has_gui = True
    try:
        cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
        cv2.resizeWindow(window_name, min(width, 1280), min(height, 720))
    except cv2.error as e:
        print(f"Note: GUI display not available ({e}).")
        has_gui = False

    # Detection filter parameters
    conf_threshold = 0.45          # Raised from 0.30 to eliminate low-confidence pole/light artifacts
    horizon_filter_enabled = True  # Ignore objects located entirely in top sky/pole area
    horizon_ratio = 0.18           # Top 18% of frame is overhead/sky area

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

            inference_start = time.time()

            # YOLO inference + tracking
            results = model.track(
                frame,
                conf=conf_threshold,
                iou=0.45,
                imgsz=640,
                device=device,
                persist=True,
                tracker="bytetrack.yaml",
                verbose=False
            )

            inference_time_ms = (time.time() - inference_start) * 1000

            annotated_frame = frame.copy()
            vehicle_counts = {}

            # Optional visual horizon line indicator (subtle dashed line)
            horizon_y = int(height * horizon_ratio)
            if horizon_filter_enabled:
                cv2.line(annotated_frame, (0, horizon_y), (width, horizon_y), (100, 100, 100), 1, cv2.LINE_AA)

            if results and len(results) > 0:
                boxes = results[0].boxes
                names = model.names

                for box in boxes:
                    cls_id = int(box.cls[0].item())
                    conf = float(box.conf[0].item())
                    xyxy = [int(v) for v in box.xyxy[0].tolist()]
                    track_id = int(box.id[0].item()) if box.id is not None else None
                    label = names.get(cls_id, f"Class_{cls_id}")

                    x1, y1, x2, y2 = xyxy
                    box_w = x2 - x1
                    box_h = y2 - y1

                    # 1. Horizon / Sky filter:
                    if horizon_filter_enabled and y2 < horizon_y:
                        continue

                    # 2. Aspect Ratio & Minimum Size Filter for Two-Wheelers:
                    if label in ["Two-wheeler", "bicycle"]:
                        if box_h < 18 or box_w < 8:
                            continue
                        if box_h / max(1, box_w) > 4.5:
                            continue

                    vehicle_counts[label] = vehicle_counts.get(label, 0) + 1
                    color = get_color(label)

                    # Draw bounding box
                    cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)

                    # Label text
                    caption = f"{label} {conf:.2f}"
                    if track_id is not None:
                        caption = f"#{track_id} {caption}"

                    (tw, th), baseline = cv2.getTextSize(caption, cv2.FONT_HERSHEY_SIMPLEX, 0.45, 1)
                    bg_y1 = max(0, y1 - th - 6)
                    bg_y2 = y1
                    cv2.rectangle(annotated_frame, (x1, bg_y1), (x1 + tw + 6, bg_y2), color, -1)
                    cv2.putText(annotated_frame, caption, (x1 + 3, bg_y2 - 3),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 0, 0), 1, cv2.LINE_AA)

            # HUD Top Bar
            hud_overlay = annotated_frame.copy()
            cv2.rectangle(hud_overlay, (0, 0), (width, 42), (20, 24, 33), -1)
            cv2.addWeighted(hud_overlay, 0.75, annotated_frame, 0.25, 0, annotated_frame)

            total_detected = sum(vehicle_counts.values())
            current_elapsed = time.time() - start_wall_time
            video_time_str = f"{current_elapsed:4.1f}s/{video_duration_sec:4.1f}s"
            live_fps = processed_count / current_elapsed if current_elapsed > 0 else 0

            cv2.putText(annotated_frame, "IISc UVH-26 Live (1x Sync) [REC]", (15, 27),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.58, (0, 255, 200), 2, cv2.LINE_AA)

            # Draw red recording dot
            cv2.circle(annotated_frame, (int(width * 0.42), 22), 6, (0, 0, 255), -1)

            hud_stats = f"Time: {video_time_str} | Conf: {conf_threshold:.2f} | Active: {total_detected}"
            cv2.putText(annotated_frame, hud_stats, (max(15, width - 440), 27),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.50, (255, 255, 255), 1, cv2.LINE_AA)

            # Save frame to output video file
            out_writer.write(annotated_frame)
            processed_count += 1

            # Console output
            pct = (target_frame_idx / total_frames) * 100 if total_frames > 0 else 0
            print(f"Time: {current_elapsed:4.1f}s/{video_duration_sec:4.1f}s | Frame: {target_frame_idx:4d}/{total_frames} ({pct:5.1f}%) | Conf: {conf_threshold:.2f} | Active: {total_detected}", flush=True)

            # Display immediately
            if has_gui:
                cv2.imshow(window_name, annotated_frame)
                key = cv2.waitKey(1) & 0xFF
                if key in [27, ord('q'), ord('Q')]:
                    print("\n[USER QUIT] Quit key pressed. Exiting live detection...")
                    break
                elif key in [ord('+'), ord('=')]:
                    conf_threshold = min(0.90, conf_threshold + 0.05)
                    print(f"   [CONTROL] Increased Confidence Threshold -> {conf_threshold:.2f}", flush=True)
                elif key in [ord('-'), ord('_')]:
                    conf_threshold = max(0.20, conf_threshold - 0.05)
                    print(f"   [CONTROL] Decreased Confidence Threshold -> {conf_threshold:.2f}", flush=True)
                elif key in [ord('h'), ord('H')]:
                    horizon_filter_enabled = not horizon_filter_enabled
                    state = "ENABLED" if horizon_filter_enabled else "DISABLED"
                    print(f"   [CONTROL] Horizon/Sky Filter -> {state}", flush=True)

    except KeyboardInterrupt:
        print("\n[USER STOPPED] KeyboardInterrupt (Ctrl+C). Cleaning up and printing stats...")
    finally:
        cap.release()
        out_writer.release()
        if has_gui:
            cv2.destroyAllWindows()

    total_real_time = time.time() - start_wall_time
    avg_sample_fps = processed_count / total_real_time if total_real_time > 0 else 0

    print("\n" + "=" * 65)
    print("===== TEST COMPLETE =====")
    print(f"Original video duration : {video_duration_sec:.2f}s")
    print(f"Total test running time : {total_real_time:.2f}s")
    print(f"Total video frames      : {total_frames}")
    print(f"Saved recorded frames   : {processed_count}")
    print(f"Average sample/disp FPS : {avg_sample_fps:.2f} FPS")
    print(f"Final Conf Threshold    : {conf_threshold:.2f}")
    print(f"Saved Video Output      : {output_path}")
    print("=" * 65)

if __name__ == "__main__":
    main()
