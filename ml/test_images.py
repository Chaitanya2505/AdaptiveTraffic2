import os
import glob
import cv2
from ultralytics import YOLO
import torch
import numpy as np

# ==========================================================
# CONFIGURATION
# ==========================================================

HF_REPO_ID = "iisc-aim/UVH-26"

MODEL_FILE = "weights/YOLOv11-S/UVH-26-MV-YOLOv11-S.pt"

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

IMAGE_FOLDER = "images"
OUTPUT_FOLDER = "output1"

CONFIDENCE = 0.35
IMAGE_SIZE = 640

# ==========================================================

print("Downloading/loading model...")
# Prefer using the local weights file (downloaded into project).
local_weights = os.path.join(os.path.dirname(__file__), MODEL_FILE)
if os.path.exists(local_weights):
    weights = local_weights
    print(f"Using local weights: {weights}")
else:
    # Fallback: try to download from HF hub if local file missing
    try:
        from huggingface_hub import hf_hub_download
        print("Local weights not found — downloading from Hugging Face...")
        weights = hf_hub_download(repo_id=HF_REPO_ID, filename=MODEL_FILE)
    except Exception as e:
        raise RuntimeError("Model weights not found locally and could not be downloaded") from e

model = YOLO(weights)

if torch.cuda.is_available():
    device = "cuda"
elif hasattr(torch.backends, "mps") and torch.backends.mps.is_available():
    device = "mps"
else:
    device = "cpu"

print(f"Using device: {device}")

def get_color(idx):
    np.random.seed(idx * 999 + 7)
    return tuple(int(x) for x in np.random.randint(50, 255, 3))


def draw_boxes(image, result, names):

    if result.boxes is None:
        return image

    for box in result.boxes:

        conf = float(box.conf[0])

        if conf < CONFIDENCE:
            continue

        cls = int(box.cls[0])

        original_label = names[cls]
        label = CLASS_MAP.get(original_label, original_label)

        x1, y1, x2, y2 = map(int, box.xyxy[0])

        color = get_color(cls)

        cv2.rectangle(image, (x1, y1), (x2, y2), color, 2)

        text = f"{label} {conf:.2f}"

        (w, h), b = cv2.getTextSize(
            text,
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            2
        )

        cv2.rectangle(
            image,
            (x1, y1 - h - b - 6),
            (x1 + w + 6, y1),
            color,
            -1
        )

        cv2.putText(
            image,
            text,
            (x1 + 3, y1 - 4),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (0, 0, 0),
            2
        )

    return image

os.makedirs(OUTPUT_FOLDER, exist_ok=True)

# Supported image extensions
extensions = ["*.jpg", "*.jpeg", "*.png", "*.bmp", "*.webp"]

image_paths = []

for ext in extensions:
    image_paths.extend(glob.glob(os.path.join(IMAGE_FOLDER, ext)))

image_paths = sorted(image_paths)

print(f"\nFound {len(image_paths)} images.\n")

if len(image_paths) == 0:
    print("No images found inside the 'images' folder.")
    exit()

# ==========================================================

for idx, image_path in enumerate(image_paths, start=1):

    print(f"[{idx}/{len(image_paths)}] Processing {os.path.basename(image_path)}")

    image = cv2.imread(image_path)

    if image is None:
        print("Could not read image.")
        continue

    results = model.predict(
        image,
        conf=CONFIDENCE,
        imgsz=IMAGE_SIZE,
        device=device,
        verbose=False
    )

    # Define label groups (used for counting)
    CAR_LABELS = {"Hatchback", "Sedan", "SUV", "MUV", "Van"}
    TWO_WHEELER_LABELS = {"Two-wheeler"}
    AUTO_LABELS = {"Three-wheeler"}  # rickshaw
    BUS_LABELS = {"Bus", "Mini-bus"}
    TRUCK_LABELS = {"Truck", "LCV", "Tempo-traveller"}

    # Per-image counters
    cars_img = 0
    two_wheelers_img = 0
    autos_img = 0
    buses_img = 0
    trucks_img = 0
    total_vehicles_img = 0

    # Cumulative counters (initialize once)
    if idx == 1:
        cars = 0
        two_wheelers = 0
        autos = 0
        buses = 0
        trucks = 0
        total_vehicles = 0

    res = results[0]
    if hasattr(res, 'boxes') and res.boxes is not None:
        for box in res.boxes:
            try:
                conf = float(box.conf[0])
            except Exception:
                continue

            if conf < CONFIDENCE:
                continue

            try:
                cls = int(box.cls[0])
            except Exception:
                continue

            original_label = model.names[cls]

            if original_label in CAR_LABELS:
                cars_img += 1
                cars += 1
                total_vehicles_img += 1
                total_vehicles += 1
            elif original_label in TWO_WHEELER_LABELS:
                two_wheelers_img += 1
                two_wheelers += 1
                total_vehicles_img += 1
                total_vehicles += 1
            elif original_label in AUTO_LABELS:
                autos_img += 1
                autos += 1
                total_vehicles_img += 1
                total_vehicles += 1
            elif original_label in BUS_LABELS:
                buses_img += 1
                buses += 1
                total_vehicles_img += 1
                total_vehicles += 1
            elif original_label in TRUCK_LABELS:
                trucks_img += 1
                trucks += 1
                total_vehicles_img += 1
                total_vehicles += 1

    annotated = draw_boxes(
        image.copy(),
        results[0],
        model.names
    )

    output_path = os.path.join(
        OUTPUT_FOLDER,
        os.path.basename(image_path)
    )

    cv2.imwrite(output_path, annotated)

    # Print per-image counts to terminal
    print("Per-image counts:")
    print(f" - Total vehicles: {total_vehicles_img}")
    print(f"   - Cars: {cars_img}")
    print(f"   - Two-wheelers: {two_wheelers_img}")
    print(f"   - Autos (rickshaw): {autos_img}")
    print(f"   - Buses: {buses_img}")
    print(f"   - Trucks: {trucks_img}")

print("\n====================================")
print("Finished Successfully!")
print(f"Output folder : {OUTPUT_FOLDER}")

# Print detection summary to terminal
try:
    print("\nDetection Summary:")
    print(f"Total images processed: {len(image_paths)}")
    print(f"Total vehicles: {total_vehicles}")
    print(f" - Cars: {cars}")
    print(f" - Two-wheelers: {two_wheelers}")
    print(f" - Autos (rickshaw): {autos}")
    print(f" - Buses: {buses}")
    print(f" - Trucks: {trucks}")
except NameError:
    # Counters not initialized (no images) — skip
    pass

print("====================================")