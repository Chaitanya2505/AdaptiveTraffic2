from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, Float, ForeignKey, DateTime, JSON
from datetime import datetime, timezone
from app.database import Base

class Detection(Base):
    __tablename__ = "detections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    junction_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("junctions.id", ondelete="CASCADE"), nullable=False
    )
    vehicle_class: Mapped[str] = mapped_column(String(30), nullable=False)  # car, bus, auto, truck, 2-wheeler
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    bbox: Mapped[list] = mapped_column(JSON, nullable=False)  # [x1, y1, x2, y2]
    lane_id: Mapped[str] = mapped_column(String(10), nullable=False)  # L1, L2, L3, L4
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    junction: Mapped["Junction"] = relationship("Junction", back_populates="detections")
