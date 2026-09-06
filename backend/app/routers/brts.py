"""
BRTS Lane Guard - upload a traffic video, run live UVH-26 detection against a
custom ROI polygon, and log BRTS dedicated-lane violations with real OCR.
"""

import asyncio
import time
from pathlib import Path
from typing import List

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from sqlalchemy import select, desc

from app.database import AsyncSessionLocal
from app.models.brts import BRTSViolation
from app.services.brts_service import (
    BRTS_UPLOADS_DIR, BRTS_EVIDENCE_DIR, DEFAULT_ROI,
    start_new_session, stop_current_session, get_current_session
)

router = APIRouter(prefix="/api/brts", tags=["BRTS Lane Guard"])

ALLOWED_EXTS = {".mp4", ".avi", ".mov", ".webm", ".mkv"}


class RoiRequest(BaseModel):
    points: List[List[float]]  # normalized 0-1 [[x,y], ...], >= 3 points


@router.post("/upload")
async def upload_video(file: UploadFile = File(...), junction_label: str = Form("Test Corridor")):
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTS:
        raise HTTPException(status_code=400, detail=f"Unsupported video format '{ext}'.")

    contents = await file.read()
    if not contents:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    safe_name = "".join(c if c.isalnum() or c in "._-" else "_" for c in file.filename)
    dest = BRTS_UPLOADS_DIR / f"{int(time.time())}_{safe_name}"
    with open(dest, "wb") as f:
        f.write(contents)

    session = await start_new_session(dest, (junction_label or "Test Corridor").strip() or "Test Corridor")
    return {
        "status": "SUCCESS",
        "session_id": session.session_id,
        "junction_label": session.junction_label,
        "filename": file.filename,
        "stream_url": "/api/brts/stream",
        "roi": [list(p) for p in session.roi]
    }


@router.delete("/video")
async def remove_video():
    if not get_current_session():
        raise HTTPException(status_code=404, detail="No active video session.")
    await stop_current_session()
    return {"status": "SUCCESS", "message": "Video removed and session stopped."}


@router.get("/status")
async def get_status():
    session = get_current_session()
    if not session:
        return {"active": False}
    return {
        "active": True,
        "session_id": session.session_id,
        "junction_label": session.junction_label,
        "frame_count": session.frame_count,
        "violation_count": session.violation_count,
        "uptime_sec": round(time.time() - session.started_at, 1),
        "error": session.error,
        "roi": [list(p) for p in session.roi]
    }


@router.post("/roi")
async def set_roi(payload: RoiRequest):
    session = get_current_session()
    if not session:
        raise HTTPException(status_code=404, detail="No active video session.")
    if not session.set_roi(payload.points):
        raise HTTPException(status_code=400, detail="ROI needs at least 3 points.")
    return {"status": "SUCCESS", "roi": [list(p) for p in session.roi]}


@router.post("/roi/reset")
async def reset_roi():
    session = get_current_session()
    if not session:
        raise HTTPException(status_code=404, detail="No active video session.")
    session.roi = DEFAULT_ROI
    return {"status": "SUCCESS", "roi": [list(p) for p in session.roi]}


@router.get("/stream")
async def stream_video():
    session = get_current_session()
    if not session:
        raise HTTPException(status_code=404, detail="No active video session. Upload a video first.")
    session_id = session.session_id

    async def frame_generator():
        while True:
            active = get_current_session()
            if active is None or active.session_id != session_id:
                break  # session was removed/replaced - end this stream cleanly
            if active.latest_jpeg:
                yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + active.latest_jpeg + b'\r\n')
            await asyncio.sleep(0.05)

    return StreamingResponse(frame_generator(), media_type="multipart/x-mixed-replace; boundary=frame")


@router.get("/violations")
async def list_violations(limit: int = Query(50, le=200)):
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(BRTSViolation).order_by(desc(BRTSViolation.timestamp)).limit(limit)
        )
        rows = result.scalars().all()
        return {
            "violations": [
                {
                    "id": r.id,
                    "session_id": r.session_id,
                    "junction_label": r.junction_label,
                    "vehicle_label": r.vehicle_label,
                    "license_plate": r.license_plate,
                    "ocr_error": r.ocr_error,
                    "confidence": r.confidence,
                    "status": r.status,
                    "evidence_path": r.evidence_path,
                    "timestamp": r.timestamp.isoformat() if r.timestamp else None
                }
                for r in rows
            ],
            "count": len(rows)
        }


@router.post("/violations/{violation_id}/ack")
async def acknowledge_violation(violation_id: int):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(BRTSViolation).where(BRTSViolation.id == violation_id))
        v = result.scalar_one_or_none()
        if not v:
            raise HTTPException(status_code=404, detail="Violation not found.")
        v.status = "ISSUED"
        await db.commit()
        return {"status": "SUCCESS"}


@router.get("/evidence/{filename}")
async def get_evidence(filename: str):
    path = BRTS_EVIDENCE_DIR / filename
    if not path.exists():
        raise HTTPException(status_code=404, detail="Evidence file not found.")
    return FileResponse(str(path))
