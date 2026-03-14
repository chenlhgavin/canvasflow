"""消息模型"""
from datetime import datetime
from sqlalchemy import BigInteger, String, Text, DateTime, Enum, JSON, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from canvasflow.database import Base


class Message(Base):
    __tablename__ = "messages"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    canvas_id: Mapped[str] = mapped_column(String(64), ForeignKey("canvases.id", ondelete="CASCADE"))
    role: Mapped[str] = mapped_column(Enum("user", "assistant", name="message_role"))
    content: Mapped[str | None] = mapped_column(Text(length=2**32 - 1), nullable=True)
    post_tool_content: Mapped[str | None] = mapped_column(Text(length=2**32 - 1), nullable=True)
    image_urls: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    canvas = relationship("Canvas", back_populates="messages")
    tool_calls = relationship("ToolCallRecord", back_populates="message", cascade="all, delete-orphan", lazy="selectin")
