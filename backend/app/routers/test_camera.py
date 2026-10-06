"""
Test Camera Router - Prefix: /test
Endpoints for managing camera channels, streaming live MJPEG feeds, snapping snapshots,
ingesting edge frames, and receiving real-time WebSocket telemetry.
"""

import asyncio
import base64
import time
from typing import List, Optional, Dict, Any
import numpy as np
import cv2

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query, WebSocket, WebSocketDisconnect
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel

from app.services.camera_stream import camera_manager, stream_processor

router = APIRouter(prefix="/test", tags=["Camera Stream Test & Ingestion"])


class CameraConfigRequest(BaseModel):
    camera_id: str
    name: str
    approach: str = "NORTH"
    junction_id: str = "J-001"
    source_type: str = "synthetic"  # 'rtsp', 'video_file', 'synthetic', 'edge_push'
    source_url: Optional[str] = None


class EdgeFrameIngestRequest(BaseModel):
    image_base64: str  # data:image/jpeg;base64,... or pure base64 string
    approach: Optional[str] = "NORTH"


@router.get("/cameras")
async def list_cameras():
    """List all configured camera channels and their real-time state."""
    return {
        "status": "SUCCESS",
        "cameras": camera_manager.list_channels()
    }


@router.post("/cameras")
async def register_camera(config: CameraConfigRequest):
    """Register or update a camera feed's protocol and source."""
    valid_sources = {"rtsp", "video_file", "synthetic", "edge_push"}
    if config.source_type not in valid_sources:
        raise HTTPException(status_code=400, detail=f"source_type must be one of {valid_sources}")

    channel_info = camera_manager.register_or_update(
        camera_id=config.camera_id,
        name=config.name,
        approach=config.approach,
        junction_id=config.junction_id,
        source_type=config.source_type,
        source_url=config.source_url
    )
    return {
        "status": "SUCCESS",
        "camera": channel_info
    }


@router.get("/cameras/{camera_id}")
async def get_camera_info(camera_id: str):
    """Get metadata and telemetry for a specific camera channel."""
    channel = camera_manager.get_channel(camera_id)
    if not channel:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")
    
    info = channel.get_info()
    last_telemetry = stream_processor.last_inference_results.get(camera_id, {})
    return {
        "camera": info,
        "telemetry": last_telemetry
    }


@router.get("/cameras/{camera_id}/stream")
async def stream_camera_mjpeg(
    camera_id: str,
    overlay: bool = Query(True, description="Render AI bounding boxes & HUD"),
    conf: float = Query(0.35, ge=0.1, le=0.9, description="YOLO confidence threshold")
):
    """
    Live low-latency MJPEG stream for direct embedding in browser (<img src="/test/cameras/{id}/stream" />).
    """
    channel = camera_manager.get_channel(camera_id)
    if not channel:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")

    async def frame_generator():
        while True:
            raw_frame = channel.get_frame()
            if raw_frame is not None:
                # Process frame through UVH-26 stream processor
                annotated_frame, _ = stream_processor.process_frame(
                    camera_id=camera_id,
                    frame=raw_frame,
                    approach=channel.approach,
                    conf_threshold=conf,
                    enable_overlay=overlay
                )
                jpeg_bytes = stream_processor.encode_jpeg(annotated_frame, quality=80)
                if jpeg_bytes:
                    yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + jpeg_bytes + b'\r\n')
            
            await asyncio.sleep(0.04)  # ~25 FPS loop

    return StreamingResponse(
        frame_generator(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


@router.get("/cameras/{camera_id}/snapshot")
async def get_camera_snapshot(
    camera_id: str,
    overlay: bool = Query(True)
):
    """Fetch single instant JPEG snapshot of a camera feed."""
    channel = camera_manager.get_channel(camera_id)
    if not channel:
        raise HTTPException(status_code=404, detail=f"Camera {camera_id} not found")

    raw_frame = channel.get_frame()
    if raw_frame is None:
        raise HTTPException(status_code=503, detail="Frame not available yet")

    annotated, _ = stream_processor.process_frame(
        camera_id=camera_id,
        frame=raw_frame,
        approach=channel.approach,
        enable_overlay=overlay
    )
    jpeg_bytes = stream_processor.encode_jpeg(annotated, quality=90)
    return Response(content=jpeg_bytes, media_type="image/jpeg")


@router.post("/cameras/{camera_id}/ingest")
async def ingest_edge_frame(
    camera_id: str,
    file: Optional[UploadFile] = File(None),
    payload: Optional[EdgeFrameIngestRequest] = None
):
    """
    Ingest frame pushed by an edge device (NVIDIA Jetson, RSU, or camera webhook).
    Supports multipart/form-data image uploads OR JSON with base64 payload.
    """
    channel = camera_manager.get_channel(camera_id)
    if not channel:
        # Auto-create if not present
        channel = camera_manager.channels[camera_id] = camera_manager.register_or_update(
            camera_id=camera_id,
            name=f"Edge Camera {camera_id}",
            approach="NORTH",
            junction_id="J-001",
            source_type="edge_push"
        )
        channel = camera_manager.get_channel(camera_id)

    frame_bgr = None

    # Handle multipart upload
    if file is not None:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        frame_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    # Handle base64 JSON payload
    elif payload and payload.image_base64:
        raw_b64 = payload.image_base64
        if "," in raw_b64:
            raw_b64 = raw_b64.split(",")[1]
        decoded = base64.b64decode(raw_b64)
        nparr = np.frombuffer(decoded, np.uint8)
        frame_bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if frame_bgr is None:
        raise HTTPException(status_code=400, detail="Could not decode image from file or base64")

    channel.update_edge_frame(frame_bgr)

    # Run instant detection for telemetry response
    _, telemetry = stream_processor.process_frame(
        camera_id=camera_id,
        frame=frame_bgr,
        approach=channel.approach,
        enable_overlay=False
    )

    return {
        "status": "ACCEPTED",
        "camera_id": camera_id,
        "frame_shape": list(frame_bgr.shape),
        "telemetry": telemetry
    }


@router.get("/analytics")
async def get_test_analytics():
    """Aggregated real-time analytics across all test camera streams."""
    channels = camera_manager.list_channels()
    total_vehicles = 0
    total_pce = 0.0
    approaches = {}

    for ch in channels:
        cid = ch["camera_id"]
        t = stream_processor.last_inference_results.get(cid, {
            "total_vehicles": 0,
            "total_pce": 0.0,
            "queue_meters": 0.0,
            "density_level": "LOW",
            "inference_latency_ms": 0.0,
            "counts": {"car": 0, "bus": 0, "truck": 0, "auto": 0, "2-wheeler": 0}
        })
        approaches[ch["approach"]] = t
        total_vehicles += t.get("total_vehicles", 0)
        total_pce += t.get("total_pce", 0.0)

    return {
        "status": "ONLINE",
        "timestamp": time.time(),
        "total_active_channels": len(channels),
        "total_vehicles_detected": total_vehicles,
        "total_junction_pce": round(total_pce, 1),
        "approaches": approaches
    }


@router.websocket("/ws")
async def camera_telemetry_ws(websocket: WebSocket):
    """
    WebSocket endpoint delivering real-time camera telemetry updates (FPS, vehicle counts, PCE).
    """
    await websocket.accept()
    try:
        while True:
            analytics = await get_test_analytics()
            await websocket.send_json(analytics)
            await asyncio.sleep(0.5)  # 2Hz telemetry updates
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
