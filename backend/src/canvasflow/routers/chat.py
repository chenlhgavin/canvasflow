"""聊天路由 - SSE 流式对话"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from canvasflow.services.agent import process_chat_stream

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    messages: Optional[List[Dict[str, Any]]] = []
    session_id: Optional[str] = None


@router.post("/chat")
async def chat(request: ChatRequest):
    """处理聊天请求，返回 SSE 流式响应"""
    try:
        messages = request.messages.copy() if request.messages else []
        messages.append({"role": "user", "content": request.message})

        return StreamingResponse(
            process_chat_stream(messages, request.session_id),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
                "Content-Type": "text/event-stream; charset=utf-8",
            },
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
