"""图片记录模型"""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from canvasflow.database import Base


class Image(Base):
    __tablename__ = "images"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    canvas_id: Mapped[str | None] = mapped_column(
        String(64), ForeignKey("canvases.id", ondelete="SET NULL"), nullable=True
    )
    object_key: Mapped[str] = mapped_column(String(512))
    original_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider: Mapped[str] = mapped_column(String(64), default="volcano")
    size_bytes: Mapped[int] = mapped_column(BigInteger, default=0)
    mime_type: Mapped[str] = mapped_column(String(64), default="image/jpeg")
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    canvas = relationship("Canvas", back_populates="images")
