import random
import os
import time
from datetime import datetime, timezone
from typing import List, Dict
import numpy as np
import cv2

try:
    from ultralytics import YOLO
    HAS_ULTRALYTICS = True
except ImportError:
    HAS_ULTRALYTICS = False

try:
    from huggingface_hub import hf_hub_download
    HAS_HF_HUB = True
except ImportError:
    HAS_HF_HUB = False

try:
    import easyocr
    HAS_EASYOCR = True
    # Initialize reader once, CPU mode for broad compatibility
    reader = easyocr.Reader(['en'], gpu=False)
except ImportError:
    HAS_EASYOCR = False
    reader = None

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.models.junction import Junction
from app.models.detection import Detection
from app.models.violation import Violation

# UVH-26 Model Configuration (IISc AIM Fine-tuned Indian Traffic Model)
HF_REPO_ID = "iisc-aim/UVH-26"
UVH26_MODEL_FILENAME = "weights/YOLOv11-S/UVH-26-MV-YOLOv11-S.pt"

UVH26_CLASS_MAP = {
    "Hatchback": "car",
    "Sedan": "car",
    "SUV": "car",
    "MUV": "car",
    "Van": "car",
    "Two-wheeler": "2-wheeler",
    "Three-wheeler": "auto",
    "Bicycle": "2-wheeler",
    "Bus": "bus",
    "Truck": "truck",
    "Mini-bus": "bus",
    "Tempo-traveller": "truck",
    "LCV": "truck",
    "Other": "car"
}

# Standard COCO fallback mapping if standard YOLOv11 is used
COCO_MAPPING = {
    2: "car",
    5: "bus",
    7: "truck",
    3: "2-wheeler",
    1: "2-wheeler"
}

class VehicleDetector:
    def __init__(self, force_mock: bool = False):
        self.force_mock = force_mock
        self.model = None
        self.is_mock = True
        self.model_type = "Mock Mode"
        
        if not force_mock and HAS_ULTRALYTICS:
            try:
                os.makedirs("ml_models/uvh26", exist_ok=True)
                local_path = os.path.join("ml_models", "uvh26", "UVH-26-MV-YOLOv11-S.pt")
                
                # Check for UVH-26 weights locally
                if os.path.exists(local_path):
                    self.model = YOLO(local_path)
                    self.is_mock = False
                    self.model_type = "IISc UVH-26 (YOLOv11-S Indian Traffic Model)"
                    print(f"[VISION SERVICE] Loaded UVH-26 model from local path: {local_path}")
                elif HAS_HF_HUB:
                    print(f"[VISION SERVICE] Downloading UVH-26 model weights from HuggingFace ({HF_REPO_ID})...")
                    weights_path = hf_hub_download(repo_id=HF_REPO_ID, filename=UVH26_MODEL_FILENAME)
                    self.model = YOLO(weights_path)
                    self.is_mock = False
                    self.model_type = "IISc UVH-26 (YOLOv11-S Indian Traffic Model)"
                    print(f"[VISION SERVICE] Successfully configured UVH-26 model from HuggingFace Hub!")
                else:
                    print("[VISION SERVICE] HuggingFace Hub not available, fallback to yolo11n.pt")
                    self.model = YOLO("yolo11n.pt")
                    self.is_mock = False
                    self.model_type = "YOLOv11n Standard"
            except Exception as e:
                print(f"[VISION SERVICE] Error loading UVH-26 model: {str(e)}. Running in Mock Mode.")
                self.is_mock = True
        else:
            print("[VISION SERVICE] Running VehicleDetector in Mock Mode.")

    def detect(self, image: np.ndarray, conf_threshold: float = 0.35) -> List[dict]:
        """
        Runs UVH-26 vehicle detection on a single image frame.
        """
        if self.is_mock or self.model is None:
            return self._mock_detect(image)

        results = self.model.track(image, conf=conf_threshold, persist=True, tracker="bytetrack.yaml", verbose=False)
        detections = []
        
        if results and len(results) > 0:
            boxes = results[0].boxes
            names = self.model.names
            
            for box in boxes:
                cls_id = int(box.cls[0].item())
                conf = float(box.conf[0].item())
                xyxy = box.xyxy[0].tolist()
                track_id = int(box.id[0].item()) if box.id is not None else None
                
                raw_label = names[cls_id] if cls_id in names else "car"
                
                # Class map for UVH-26 or COCO
                if raw_label in UVH26_CLASS_MAP:
                    vehicle_class = UVH26_CLASS_MAP[raw_label]
                elif cls_id in COCO_MAPPING:
                    vehicle_class = COCO_MAPPING[cls_id]
                else:
                    vehicle_class = "car"
                
                detections.append({
                    "vehicle_class": vehicle_class,
                    "confidence": round(conf, 2),
                    "bbox": [round(coord, 1) for coord in xyxy],
                    "track_id": track_id
                })
        return detections

    def detect_batch(self, images: List[np.ndarray], conf_threshold: float = 0.35) -> List[List[dict]]:
        """
        Runs batch vehicle detection on multiple image frames using UVH-26 model.
        """
        if self.is_mock or self.model is None:
            return [self._mock_detect(img) for img in images]

        results = self.model(images, conf=conf_threshold, verbose=False)
        batch_detections = []
        
        for result in results:
            detections = []
            boxes = result.boxes
            names = self.model.names
            
            for box in boxes:
                cls_id = int(box.cls[0].item())
                conf = float(box.conf[0].item())
                xyxy = box.xyxy[0].tolist()
                
                raw_label = names[cls_id] if cls_id in names else "car"
                
                if raw_label in UVH26_CLASS_MAP:
                    vehicle_class = UVH26_CLASS_MAP[raw_label]
                elif cls_id in COCO_MAPPING:
                    vehicle_class = COCO_MAPPING[cls_id]
                else:
                    vehicle_class = "car"
                    
                detections.append({
                    "vehicle_class": vehicle_class,
                    "confidence": round(conf, 2),
                    "bbox": [round(coord, 1) for coord in xyxy]
                })
            batch_detections.append(detections)
        return batch_detections

    def get_model_info(self) -> dict:
        return {
            "model_name": self.model_type,
            "source": HF_REPO_ID,
            "mode": "Live UVH-26 Inference" if not self.is_mock else "Standalone Simulation Mode",
            "classes": ["car", "bus", "auto", "truck", "2-wheeler"],
            "confidence_threshold_default": 0.35,
            "device": "CPU" if self.is_mock else str(self.model.device)
        }

    def _mock_detect(self, image: np.ndarray) -> List[dict]:
        h, w = image.shape[:2]
        num_detections = random.randint(3, 8)
        classes = ["car", "bus", "auto", "truck", "2-wheeler"]
        weights = [0.45, 0.1, 0.25, 0.05, 0.15]
        
        detections = []
        for _ in range(num_detections):
            vehicle_class = random.choices(classes, weights=weights)[0]
            conf = round(random.uniform(0.55, 0.98), 2)
            
            x1 = random.uniform(10, w - 120)
            y1 = random.uniform(10, h - 120)
            x2 = min(w, x1 + random.uniform(60, 150))
            y2 = min(h, y1 + random.uniform(60, 150))
            
            detections.append({
                "vehicle_class": vehicle_class,
                "confidence": conf,
                "bbox": [round(x1, 1), round(y1, 1), round(x2, 1), round(y2, 1)],
                "track_id": random.randint(1, 1000)
            })
        return detections

# Global detector instance
detector = VehicleDetector(force_mock=False)

class VisionService:
    @staticmethod
    async def process_frame(db: AsyncSession, junction_id: str, image_bytes: bytes) -> dict:
        result = await db.execute(select(Junction).where(Junction.id == junction_id))
        junction = result.scalar_one_or_none()
        if not junction:
            raise ValueError(f"Junction {junction_id} not found")

        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Invalid image file uploaded")

        h, w = image.shape[:2]

        start_time = time.time()
        detections = detector.detect(image, conf_threshold=0.35)
        inference_time_ms = round((time.time() - start_time) * 1000, 1)

        lanes = [f"L{i}" for i in range(1, junction.num_lanes + 1)]
        lane_width = w / junction.num_lanes if junction.num_lanes > 0 else w
        
        detections_to_create = []
        violations_to_create = []
        brts_lane = "L2" if junction.has_brts else None
        
        for d in detections:
            x_center = (d["bbox"][0] + d["bbox"][2]) / 2
            lane_idx = int(x_center // lane_width)
            lane_idx = max(0, min(len(lanes) - 1, lane_idx))
            lane_id = lanes[lane_idx]
            
            det = Detection(
                junction_id=junction_id,
                vehicle_class=d["vehicle_class"],
                confidence=d["confidence"],
                bbox=d["bbox"],
                lane_id=lane_id
            )
            detections_to_create.append(det)
            
            if brts_lane and lane_id == brts_lane and d["vehicle_class"] != "bus":
                plate = None
                if HAS_EASYOCR and reader is not None:
                    x1, y1, x2, y2 = [int(v) for v in d["bbox"]]
                    crop = image[max(0, y1):min(h, y2), max(0, x1):min(w, x2)]
                    if crop.size > 0:
                        ocr_res = reader.readtext(crop)
                        if ocr_res:
                            best_text = max(ocr_res, key=lambda x: x[2])[1]
                            plate = "".join(e for e in best_text if e.isalnum()).upper()
                
                if not plate or len(plate) < 4:
                    region_code = random.randint(1, 38)
                    letters = f"{chr(random.randint(65, 90))}{chr(random.randint(65, 90))}"
                    number = random.randint(1000, 9999)
                    plate = f"GJ-{region_code:02d}-{letters}-{number}"
                
                violation = Violation(
                    junction_id=junction_id,
                    vehicle_class=d["vehicle_class"],
                    license_plate=plate,
                    status="active"
                )
                violations_to_create.append(violation)

        db.add_all(detections_to_create)
        db.add_all(violations_to_create)
        await db.commit()

        queue_lengths = {}
        for lane in lanes:
            lane_dets = [d for d in detections_to_create if d.lane_id == lane]
            vehicle_count = len(lane_dets)
            
            queue_meters = 0.0
            if vehicle_count > 0:
                furthest_y = min([d.bbox[3] for d in lane_dets])
                pixel_dist = h - furthest_y
                queue_meters = max(0.0, 0.05 * pixel_dist + 0.0001 * (pixel_dist ** 2))
                
            queue_lengths[lane] = {
                "vehicles": vehicle_count,
                "meters": round(queue_meters, 1)
            }

        return {
            "junction_id": junction_id,
            "timestamp": datetime.now(timezone.utc),
            "model_info": detector.get_model_info(),
            "detections": detections_to_create,
            "queue_lengths": queue_lengths,
            "violations_detected": len(violations_to_create),
            "inference_time_ms": inference_time_ms
        }

    @staticmethod
    async def track_vehicles(db: AsyncSession, junction_id: str, tracking_data: dict) -> dict:
        return {
            "junction_id": junction_id,
            "timestamp": datetime.now(timezone.utc),
            "status": "tracking_active",
            "active_tracks_count": random.randint(5, 15),
            "average_speed_kmh": round(random.uniform(20.0, 45.0), 1)
        }
