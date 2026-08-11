#!/usr/bin/env python3
"""
Real-time Vehicle Detection using UVH-26 (YOLOv11)

Examples:
python vehicle_detect.py --source 0
python vehicle_detect.py --source traffic.mp4
python vehicle_detect.py --source traffic.mp4 --save output.mp4
python vehicle_detect.py --source traffic.mp4 --model-size x
"""

import argparse
import sys
import cv2
import numpy as np

HF_REPO_ID = "iisc-aim/UVH-26"

MODEL_FILES = {
    "s": "weights/YOLOv11-S/UVH-26-MV-YOLOv11-S.pt",
    "x": "weights/YOLOv11-X/UVH-26-MV-YOLOv11-X.pt",
}

# ==========================================================
# CLASS COMPRESSION
# ==========================================================

CLASS_MAP = {
    "Hatchback": "Car",
    "Sedan": "Car",
    "SUV": "Car",
    "MUV": "Car",
    "Van": "Car",

    "Two-wheeler": "Bike",

    "Three-wheeler": "Rickshaw",

    "Bicycle": "Bicycle",

    "Bus": "Big Vehicle",
    "Truck": "Big Vehicle",
    "Mini-bus": "Big Vehicle",
    "Tempo-traveller": "Big Vehicle",
    "LCV": "Big Vehicle",

    "Other": "Other"
}


def download_model(model_size):
    from huggingface_hub import hf_hub_download

    filename = MODEL_FILES[model_size]

    print(f"[INFO] Downloading model: {filename}")

    try:
        path = hf_hub_download(
            repo_id=HF_REPO_ID,
            filename=filename
        )
    except Exception as e:
        print("\nCould not download model.")
        print(e)
        sys.exit(1)

    return path


def load_model(model_size):
    from ultralytics import YOLO
    import torch

    weights = download_model(model_size)

    model = YOLO(weights)

    if torch.cuda.is_available():
        device = "cuda"
    elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
        device = "mps"
    else:
        device = "cpu"

    print(f"[INFO] Device : {device}")
    print(f"[INFO] Classes: {model.names}")

    return model, device


def get_color(idx):
    np.random.seed(idx * 999 + 7)
    return tuple(int(x) for x in np.random.randint(50, 255, 3))


def draw_boxes(frame, result, names, conf_thresh):

    if result.boxes is None:
        return frame

    for box in result.boxes:

        conf = float(box.conf[0])

        if conf < conf_thresh:
            continue

        cls = int(box.cls[0])

        original_label = names[cls]
        label = CLASS_MAP.get(original_label, original_label)

        x1, y1, x2, y2 = map(int, box.xyxy[0])

        color = get_color(cls)

        track_id = None

        if box.id is not None:
            track_id = int(box.id[0])

        text = f"{label} {conf:.2f}"

        if track_id is not None:
            text = f"#{track_id} {text}"

        cv2.rectangle(frame, (x1, y1), (x2, y2), color, 2)

        (w, h), b = cv2.getTextSize(
            text,
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            2
        )

        cv2.rectangle(
            frame,
            (x1, y1 - h - b - 6),
            (x1 + w + 6, y1),
            color,
            -1
        )

        cv2.putText(
            frame,
            text,
            (x1 + 3, y1 - 4),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 0, 0),
            2
        )

    return frame


def main():

    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--source",
        required=True,
        help="Video path or webcam index (0)"
    )

    parser.add_argument(
        "--model-size",
        default="s",
        choices=["s", "x"]
    )

    parser.add_argument(
        "--conf",
        default=0.35,
        type=float
    )

    parser.add_argument(
        "--save",
        default=None
    )

    parser.add_argument(
        "--imgsz",
        default=640,
        type=int
    )

    parser.add_argument(
        "--no-track",
        action="store_true"
    )

    args = parser.parse_args()

    model, device = load_model(args.model_size)

    source = 0 if args.source == "0" else args.source

    cap = cv2.VideoCapture(source)

    if not cap.isOpened():
        print("Cannot open source.")
        sys.exit()

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)

    if fps == 0:
        fps = 30

    writer = None

    if args.save is not None:
        writer = cv2.VideoWriter(
            args.save,
            cv2.VideoWriter_fourcc(*"mp4v"),
            fps,
            (width, height)
        )

    print("\nPress Q to quit.\n")

    while True:

        ret, frame = cap.read()

        if not ret:
            break

        if args.no_track:

            results = model.predict(
                frame,
                device=device,
                conf=args.conf,
                imgsz=args.imgsz,
                verbose=False
            )

        else:

            results = model.track(
                frame,
                device=device,
                conf=args.conf,
                imgsz=args.imgsz,
                tracker="bytetrack.yaml",
                persist=True,
                verbose=False
            )

        frame = draw_boxes(
            frame,
            results[0],
            model.names,
            args.conf
        )

        cv2.putText(
            frame,
            f"Device : {device}",
            (10, 30),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.7,
            (255, 255, 255),
            2
        )

        cv2.imshow("UVH-26 Vehicle Detection", frame)

        if writer is not None:
            writer.write(frame)

        if cv2.waitKey(1) & 0xFF == ord("q"):
            break

    cap.release()

    if writer is not None:
        writer.release()

    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()