from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, Float, Boolean
from typing import List
from app.database import Base

class Junction(Base):
    __tablename__ = "junctions"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)  # J-001, J-002, etc.
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    num_lanes: Mapped[int] = mapped_column(Integer, default=4)
    has_brts: Mapped[bool] = mapped_column(Boolean, default=False)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, inactive, maintenance

    # Relationships
    detections: Mapped[List["Detection"]] = relationship(
        "Detection", back_populates="junction", cascade="all, delete-orphan", lazy="selectin"
    )
    signals: Mapped[List["Signal"]] = relationship(
        "Signal", back_populates="junction", cascade="all, delete-orphan", lazy="selectin"
    )
    violations: Mapped[List["Violation"]] = relationship(
        "Violation", back_populates="junction", cascade="all, delete-orphan", lazy="selectin"
    )
