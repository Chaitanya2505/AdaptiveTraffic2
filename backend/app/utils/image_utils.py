import base64
import cv2
import numpy as np
import re
from typing import List, Dict

# Class color mapping for high aesthetics (BGR format)
CLASS_COLORS = {
    "car": (239, 68, 68),       # Red/Orange GJ
    "bus": (16, 185, 129),     # Emerald Green
    "auto": (245, 158, 11),     # Amber/Yellow
    "truck": (139, 92, 246),    # Violet
    "2-wheeler": (6, 182, 212)  # Cyan
}
DEFAULT_COLOR = (100, 116, 139) # Slate Gray

def decode_base64_image(base64_string: str) -> np.ndarray:
    """
    Decodes a base64 string (with or without data URI header) into a BGR OpenCV NumPy array.
    """
    try:
        # Strip header if present
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
            
        img_data = base64.b64decode(base64_string)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise ValueError("Decoded image is empty or invalid format")
        return img
    except Exception as e:
        raise ValueError(f"Invalid base64 image data: {str(e)}")

def encode_image_base64(image: np.ndarray) -> str:
    """
    Encodes a BGR OpenCV image into a JPEG base64 string.
    """
    _, buffer = cv2.imencode('.jpg', image)
    b64_bytes = base64.b64encode(buffer)
    return b64_bytes.decode('utf-8')

def draw_boxes(image: np.ndarray, detections: List[dict]) -> np.ndarray:
    """
    Draws bounding boxes, labels, and confidence tags on a copy of the image.
    """
    annotated = image.copy()
    h, w = annotated.shape[:2]

    for det in detections:
        bbox = det.get("bbox", [0, 0, 0, 0])
        x1, y1, x2, y2 = [int(coord) for coord in bbox]
        
        # Clamp coordinates to image boundaries
        x1, y1 = max(0, x1), max(0, y1)
        x2, y2 = min(w, x2), min(h, y2)
        
        label = det.get("vehicle_class", "unknown")
        conf = det.get("confidence", 0.0)
        
        color = CLASS_COLORS.get(label, DEFAULT_COLOR)
        
        # Draw bounding box
        cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)
        
        # Build text label tag
        text = f"{label} {conf:.2f}"
        font = cv2.FONT_HERSHEY_SIMPLEX
        font_scale = 0.4
        thickness = 1
        
        # Get dimensions of text box
        (text_w, text_h), baseline = cv2.getTextSize(text, font, font_scale, thickness)
        
        # Draw background label box
        label_y1 = max(0, y1 - text_h - 6)
        label_y2 = y1
        cv2.rectangle(annotated, (x1, label_y1), (x1 + text_w + 8, label_y2), color, -1)
        
        # Draw text inside background label box
        cv2.putText(
            annotated, 
            text, 
            (x1 + 4, label_y1 + text_h + 3), 
            font, 
            font_scale, 
            (255, 255, 255), 
            thickness, 
            cv2.LINE_AA
        )
        
    return annotated
