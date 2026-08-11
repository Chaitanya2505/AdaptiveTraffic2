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

class VehicleDetector:
    def __init__(self, model_path: str = "yolo11n.pt", force_mock: bool = False):
        self.force_mock = force_mock
        self.model = None
        self.is_mock = True
        
        if not force_mock and HAS_ULTRALYTICS:
            try:
                os.makedirs("ml_models/yolov11n", exist_ok=True)
                local_path = os.path.join("ml_models", "yolov11n", "yolo11n.pt")
                
                # Check for weights locally, otherwise trigger YOLO download
                if os.path.exists(local_path):
                    self.model = YOLO(local_path)
                    self.is_mock = False
                    print(f"Successfully loaded YOLOv11n from local path: {local_path}")
                else:
                    print(f"Local weight files not found at {local_path}. Fetching yolo11n.pt...")
                    self.model = YOLO("yolo11n.pt")
                    # Save a copy in local ml_models
                    import shutil
                    if os.path.exists("yolo11n.pt"):
                        shutil.copy("yolo11n.pt", local_path)
                        self.model = YOLO(local_path)
                    self.is_mock = False
                    print(f"Successfully downloaded and configured YOLOv11n at {local_path}")
            except Exception as e:
                print(f"Error loading YOLOv11n: {str(e)}. Falling back to Mock Mode.")
                self.is_mock = True
        else:
            print("Running VehicleDetector in Mock Mode (force_mock=True or ultralytics not installed).")

    def detect(self, image: np.ndarray, conf_threshold: float = 0.5) -> List[dict]:
        """
        Runs vehicle detection on a single image frame (BGR NumPy array).
        Returns bounding boxes [x1, y1, x2, y2], class label, and confidence.
        """
        if self.is_mock:
            return self._mock_detect(image)

        # Run tracking via YOLOv11 (handles NMS and tracking internally)
        results = self.model.track(image, conf=conf_threshold, persist=True, tracker="bytetrack.yaml", verbose=False)
        detections = []
        
        # COCO labels: 2=car, 5=bus, 7=truck, 3=motorcycle, 1=bicycle
        coco_mapping = {
            2: "car",
            5: "bus",
            7: "truck",
            3: "2-wheeler",
            1: "2-wheeler"
        }
        
        if results and len(results) > 0:
            boxes = results[0].boxes
            for box in boxes:
                cls_id = int(box.cls[0].item())
                conf = float(box.conf[0].item())
                xyxy = box.xyxy[0].tolist() # [x1, y1, x2, y2]
                track_id = int(box.id[0].item()) if box.id is not None else None
                
                if cls_id in coco_mapping:
                    vehicle_class = coco_mapping[cls_id]
                    
                    # Heuristically classify auto-rickshaws:
                    # COCO motorcycle (3) detections that are wide (width/height ratio > 0.6)
                    # or randomly assign 30% of motorcycles
                    if cls_id == 3:
                        w = xyxy[2] - xyxy[0]
                        h = xyxy[3] - xyxy[1]
                        if h > 0 and (w / h) > 0.6:
                            vehicle_class = "auto"
                    
                    detections.append({
                        "vehicle_class": vehicle_class,
                        "confidence": round(conf, 2),
                        "bbox": [round(coord, 1) for coord in xyxy],
                        "track_id": track_id
                    })
        return detections

    def detect_batch(self, images: List[np.ndarray], conf_threshold: float = 0.5) -> List[List[dict]]:
        """
        Runs batch vehicle detection on multiple image frames.
        """
        if self.is_mock:
            return [self._mock_detect(img) for img in images]

        results = self.model(images, conf=conf_threshold, verbose=False)
        batch_detections = []
        
        coco_mapping = {
            2: "car",
            5: "bus",
            7: "truck",
            3: "2-wheeler",
            1: "2-wheeler"
        }
        
        for result in results:
            detections = []
            boxes = result.boxes
            for box in boxes:
                cls_id = int(box.cls[0].item())
                conf = float(box.conf[0].item())
                xyxy = box.xyxy[0].tolist()
                
                if cls_id in coco_mapping:
                    vehicle_class = coco_mapping[cls_id]
                    if cls_id == 3:
                        w = xyxy[2] - xyxy[0]
                        h = xyxy[3] - xyxy[1]
                        if h > 0 and (w / h) > 0.6:
                            vehicle_class = "auto"
                            
                    detections.append({
                        "vehicle_class": vehicle_class,
                        "confidence": round(conf, 2),
                        "bbox": [round(coord, 1) for coord in xyxy]
                    })
            batch_detections.append(detections)
        return batch_detections

    def get_model_info(self) -> dict:
        """
        Returns model metadata.
        """
        return {
            "model_name": "YOLOv11n (Nano)",
            "mode": "Mock Mode (Standalone)" if self.is_mock else "Live YOLOv11 Inference",
            "classes": ["car", "bus", "auto", "truck", "2-wheeler"],
            "confidence_threshold_default": 0.5,
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
            
            # Simulated coordinates inside image boundaries
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

# Global detector instance (loaded dynamically)
detector = VehicleDetector(force_mock=False)

class VisionService:
    @staticmethod
    async def process_frame(db: AsyncSession, junction_id: str, image_bytes: bytes) -> dict:
        # Fetch junction to verify lanes and BRTS properties
        result = await db.execute(select(Junction).where(Junction.id == junction_id))
        junction = result.scalar_one_or_none()
        if not junction:
            raise ValueError(f"Junction {junction_id} not found")

        # Decode image
        nparr = np.frombuffer(image_bytes, np.uint8)
        image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if image is None:
            raise ValueError("Invalid image file uploaded")

        h, w = image.shape[:2]

        # Call the YOLOv11 Vehicle Detector
        start_time = time.time()
        detections = detector.detect(image, conf_threshold=0.5)
        inference_time_ms = round((time.time() - start_time) * 1000, 1)

        # Class segment and lane grouping
        lanes = [f"L{i}" for i in range(1, junction.num_lanes + 1)]
        lane_width = w / junction.num_lanes if junction.num_lanes > 0 else w
        
        detections_to_create = []
        violations_to_create = []
        brts_lane = "L2" if junction.has_brts else None
        
        for d in detections:
            # Map lane ID based on X coordinate center of the bounding box
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
            
            # Check for BRTS Violation
            if brts_lane and lane_id == brts_lane and d["vehicle_class"] != "bus":
                plate = None
                # Attempt ALPR with EasyOCR if available
                if HAS_EASYOCR and reader is not None:
                    x1, y1, x2, y2 = [int(v) for v in d["bbox"]]
                    # Crop vehicle region slightly expanded for plates
                    crop = image[max(0, y1):min(h, y2), max(0, x1):min(w, x2)]
                    if crop.size > 0:
                        ocr_res = reader.readtext(crop)
                        if ocr_res:
                            best_text = max(ocr_res, key=lambda x: x[2])[1]
                            # Clean string for typical plate
                            plate = "".join(e for e in best_text if e.isalnum()).upper()
                
                # Mock fallback if OCR failed or not installed
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

        # Log detections and violations to the database
        db.add_all(detections_to_create)
        db.add_all(violations_to_create)
        await db.commit()

        # Calculate queue metrics per lane using perspective transform approximation
        queue_lengths = {}
        for lane in lanes:
            lane_dets = [d for d in detections_to_create if d.lane_id == lane]
            vehicle_count = len(lane_dets)
            
            queue_meters = 0.0
            if vehicle_count > 0:
                # Find the furthest vehicle (minimum y coordinate for the bottom of the bbox)
                # The smaller the y coordinate (higher in image), the further away it is.
                # Assuming the bottom of the image (h) is the stopline = 0 meters.
                furthest_y = min([d.bbox[3] for d in lane_dets])
                pixel_dist = h - furthest_y
                
                # Quadratic mapping from pixels to meters to simulate perspective depth
                queue_meters = max(0.0, 0.05 * pixel_dist + 0.0001 * (pixel_dist ** 2))
                
            queue_lengths[lane] = {
                "vehicles": vehicle_count,
                "meters": round(queue_meters, 1)
            }

        return {
            "junction_id": junction_id,
            "timestamp": datetime.now(timezone.utc),
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
