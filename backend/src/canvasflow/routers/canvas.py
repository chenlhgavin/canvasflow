"""画布路由 - 项目 CRUD（MySQL 异步操作）"""
import json
import logging
from fastapi import APIRouter, Request
from sqlalchemy import select, delete
from canvasflow.database import async_session
from canvasflow.models.canvas import Canvas
from canvasflow.models.message import Message
from canvasflow.models.tool_call import ToolCallRecord

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/canvases")
async def get_canvases():
    """获取所有画布及关联消息，返回与 PolyStudio 兼容的 JSON 结构"""
    async with async_session() as session:
        result = await session.execute(
            select(Canvas).order_by(Canvas.created_at.desc())
        )
        canvases = result.scalars().all()

        output = []
        for canvas in canvases:
            # 构建消息列表（含 toolCalls）
            messages_out = []
            for msg in sorted(canvas.messages, key=lambda m: m.id):
                msg_dict = {
                    "role": msg.role,
                    "content": msg.content or "",
                }
                if msg.post_tool_content:
                    msg_dict["postToolContent"] = msg.post_tool_content
                if msg.image_urls:
                    msg_dict["imageUrls"] = msg.image_urls

                # 加载 toolCalls
                if msg.tool_calls:
                    tool_calls_out = []
                    for tc in sorted(msg.tool_calls, key=lambda t: t.created_at):
                        tc_dict = {
                            "id": tc.id,
                            "name": tc.name,
                            "arguments": tc.arguments or {},
                            "status": tc.status,
                        }
                        if tc.result:
                            tc_dict["result"] = tc.result
                        if tc.image_url:
                            tc_dict["imageUrl"] = tc.image_url
                        tool_calls_out.append(tc_dict)
                    if tool_calls_out:
                        msg_dict["toolCalls"] = tool_calls_out

                messages_out.append(msg_dict)

            canvas_dict = {
                "id": canvas.id,
                "name": canvas.name,
                "createdAt": int(canvas.created_at.timestamp() * 1000) if canvas.created_at else 0,
                "images": [],
                "messages": messages_out,
            }

            # 解析 excalidraw_data
            if canvas.excalidraw_data:
                try:
                    canvas_dict["data"] = json.loads(canvas.excalidraw_data)
                except (json.JSONDecodeError, TypeError):
                    canvas_dict["data"] = {"elements": [], "appState": {}, "files": {}}
            else:
                canvas_dict["data"] = {"elements": [], "appState": {}, "files": {}}

            output.append(canvas_dict)

        return output


@router.post("/canvases")
async def save_canvas(request: Request):
    """保存或更新画布（接收原始 JSON，保留 Excalidraw 复杂数据）"""
    payload = await request.json()
    canvas_id = payload.get("id", "")

    async with async_session() as session:
        async with session.begin():
            # 查找已有的 canvas
            result = await session.execute(select(Canvas).where(Canvas.id == canvas_id))
            existing = result.scalar_one_or_none()

            # 序列化 excalidraw data
            data = payload.get("data")
            excalidraw_data = json.dumps(data, ensure_ascii=False) if data else None

            if existing:
                existing.name = payload.get("name", existing.name)
                existing.excalidraw_data = excalidraw_data

                # 先删除旧 tool_calls，再删除旧消息，避免 identity map 冲突
                await session.execute(
                    delete(ToolCallRecord).where(
                        ToolCallRecord.message_id.in_(
                            select(Message.id).where(Message.canvas_id == canvas_id)
                        )
                    )
                )
                await session.execute(
                    delete(Message).where(Message.canvas_id == canvas_id)
                )
                await session.flush()
                session.expire_all()
            else:
                canvas = Canvas(
                    id=canvas_id,
                    name=payload.get("name", ""),
                    excalidraw_data=excalidraw_data,
                )
                session.add(canvas)

            # 批量保存消息
            raw_messages = payload.get("messages", [])
            for msg_data in raw_messages:
                msg = Message(
                    canvas_id=canvas_id,
                    role=msg_data.get("role", "user"),
                    content=msg_data.get("content", ""),
                    post_tool_content=msg_data.get("postToolContent"),
                    image_urls=msg_data.get("imageUrls"),
                )
                session.add(msg)
                await session.flush()  # 获取 msg.id

                # 保存 toolCalls（merge 防止并发请求导致主键冲突）
                for tc_data in msg_data.get("toolCalls", []):
                    tc = ToolCallRecord(
                        id=tc_data.get("id", ""),
                        message_id=msg.id,
                        name=tc_data.get("name", ""),
                        arguments=tc_data.get("arguments"),
                        status=tc_data.get("status", "done"),
                        result=tc_data.get("result"),
                        image_url=tc_data.get("imageUrl"),
                    )
                    await session.merge(tc)

    return payload


@router.delete("/canvases/{canvas_id}")
async def delete_canvas(canvas_id: str):
    """删除画布（级联删除消息和工具调用记录）"""
    async with async_session() as session:
        async with session.begin():
            result = await session.execute(select(Canvas).where(Canvas.id == canvas_id))
            canvas = result.scalar_one_or_none()
            if canvas:
                await session.delete(canvas)
    return {"success": True}
