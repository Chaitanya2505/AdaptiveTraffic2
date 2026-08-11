from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy import String, Integer, ForeignKey, DateTime
from datetime import datetime, timezone
from app.database import Base

class Signal(Base):
    __tablename__ = "signals"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    junction_id: Mapped[str] = mapped_column(
        String(50), ForeignKey("junctions.id", ondelete="CASCADE"), nullable=False
    )
    phase: Mapped[str] = mapped_column(String(50), nullable=False)  # NS_GREEN, EW_GREEN, etc.
    duration: Mapped[int] = mapped_column(Integer, nullable=False)  # in seconds
    mode: Mapped[str] = mapped_column(String(30), nullable=False)  # RL, WEBSTER, MANUAL
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Relationships
    junction: Mapped["Junction"] = relationship("Junction", back_populates="signals")
