"""工具调用记录模型"""
from datetime import datetime
from sqlalchemy import BigInteger, String, Text, DateTime, Enum, JSON, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from canvasflow.database import Base


class ToolCallRecord(Base):
    __tablename__ = "tool_calls"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    message_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("messages.id", ondelete="CASCADE"))
    name: Mapped[str] = mapped_column(String(128))
    arguments: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(Enum("executing", "done", name="tool_call_status"), default="executing")
    result: Mapped[str | None] = mapped_column(Text(length=2**32 - 1), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    message = relationship("Message", back_populates="tool_calls")
