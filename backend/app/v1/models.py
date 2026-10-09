from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy import String, Float, JSON
from app.database import Base

class V1Node(Base):
    __tablename__ = "v1_nodes"

    id: Mapped[str] = mapped_column(String(50), primary_key=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    node_type: Mapped[str] = mapped_column(String(20), nullable=False) # 'junction' or 'brts'
    latitude: Mapped[float] = mapped_column(Float, nullable=False)
    longitude: Mapped[float] = mapped_column(Float, nullable=False)
    cameras: Mapped[list] = mapped_column(JSON, default=list)
    status: Mapped[str] = mapped_column(String(20), default="active")
    optimization_mode: Mapped[str] = mapped_column(String(20), default="DRL")
