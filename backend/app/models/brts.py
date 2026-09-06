from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Integer, Float, DateTime
from datetime import datetime, timezone
from typing import Optional
from app.database import Base


class BRTSViolation(Base):
    """Real-time BRTS dedicated-lane violation log."""
    __tablename__ = "brts_violations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    junction_label: Mapped[str] = mapped_column(String(100), nullable=False)
    vehicle_label: Mapped[str] = mapped_column(String(30), nullable=False)  # raw UVH-26 class, e.g. "Truck", "Sedan"
    license_plate: Mapped[str] = mapped_column(String(30), nullable=False)
    ocr_error: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    evidence_path: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="PENDING")
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )
