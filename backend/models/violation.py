from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, ForeignKey, DateTime
from datetime import datetime, timezone
from app.database import Base

class Violation(Base):
    __tablename__ = "violations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    junction_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("junctions.id", ondelete="CASCADE"), nullable=False
    )
    vehicle_class: Mapped[str] = mapped_column(String(30), nullable=False)
    license_plate: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, acknowledged, resolved
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    junction: Mapped["Junction"] = relationship("Junction", back_populates="violations")
