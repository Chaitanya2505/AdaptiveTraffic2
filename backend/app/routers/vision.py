import time
from typing import List, Optional
from datetime import datetime, timezone
import numpy as np
import cv2

from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.utils.dependencies import get_db, get_current_user
from app.models.user import User
from app.models.detection import Detection
from app.services.vision_service import detector, VisionService
from app.schemas.detection import VisionDetectResponse
from app.utils.image_utils import decode_base64_image

router = APIRouter(prefix="/vision", tags=["Computer Vision"])

@router.post("/detect", response_model=VisionDetectResponse)
async def detect_vehicles(
    request: Request,
    junction_id: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    image_base64: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Analyzes a single frame for vehicles. Supports both multipart form-data (file upload or base64) 
    and application/json (base64 payload). Logs all detections to the database.
    """
    content_type = request.headers.get("content-type", "")
    
    # 1. Parse image from JSON body
    if "application/json" in content_type:
        try:
            body = await request.json()
            jid = body.get("junction_id")
            b64 = body.get("image_base64")
            conf = body.get("conf_threshold", 0.5)
        except Exception:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON body")
            
        if not jid or not b64:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Missing junction_id or image_base64 in JSON payload"
            )
            
        try:
            img = decode_base64_image(b64)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
            
    # 2. Parse image from multipart/form-data
    else:
        if not junction_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="Missing junction_id in form parameters"
            )
        jid = junction_id
        conf = 0.5
        
        if file:
            contents = await file.read()
            nparr = np.frombuffer(contents, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is None:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST, 
                    detail="Invalid image file upload"
                )
        elif image_base64:
            try:
                img = decode_base64_image(image_base64)
            except ValueError as e:
                raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="No file upload or base64 parameter provided"
            )

    # 3. Convert OpenCV BGR image back to bytes for processing
    _, encoded_img = cv2.imencode('.jpg', img)
    image_bytes = encoded_img.tobytes()

    # 4. Process frame using VisionService (saves detections, triggers violations, analyzes queues)
    try:
        result = await VisionService.process_frame(db, jid, image_bytes)
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, 
            detail=f"Vision processing failed: {str(e)}"
        )

@router.post("/detect-batch")
async def detect_batch_vehicles(
    junction_id: str = Form(...),
    files: List[UploadFile] = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Accepts multiple file uploads in form-data and returns a list of lists of detections.
    """
    images = []
    for file in files:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail=f"Invalid image file: {file.filename}"
            )
        images.append(img)

    start_time = time.time()
    batch_results = detector.detect_batch(images, conf_threshold=0.5)
    latency_ms = round((time.time() - start_time) * 1000, 1)

    # Save all batch detections to DB
    db_detections = []
    for detections in batch_results:
        for d in detections:
            det = Detection(
                junction_id=junction_id,
                vehicle_class=d["vehicle_class"],
                confidence=d["confidence"],
                bbox=d["bbox"],
                lane_id="L1"
            )
            db_detections.append(det)
            
    db.add_all(db_detections)
    await db.commit()

    return {
        "junction_id": junction_id,
        "batch_size": len(files),
        "detections": batch_results,
        "inference_time_ms": latency_ms
    }

@router.get("/model-info")
async def get_model_info(current_user: User = Depends(get_current_user)):
    """
    Returns computer vision neural network model metadata.
    """
    return detector.get_model_info()

@router.post("/track")
async def track_vehicles(
    junction_id: str = Form(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Accepts current CCTV frames and tracks vehicles across consecutive frames.
    """
    result = await VisionService.track_vehicles(db, junction_id, {})
    return result
