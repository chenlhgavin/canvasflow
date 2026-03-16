"""画布/项目模型"""

from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from canvasflow.database import Base


class Canvas(Base):
    __tablename__ = "canvases"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), default="")
    excalidraw_data: Mapped[str | None] = mapped_column(Text(length=2**32 - 1), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime, onupdate=func.now(), nullable=True)

    messages = relationship("Message", back_populates="canvas", cascade="all, delete-orphan", lazy="selectin")
    images = relationship("Image", back_populates="canvas", cascade="all, delete-orphan", lazy="selectin")
