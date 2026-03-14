"""存储代理路由 - MinIO 对象流式返回"""
import logging
import mimetypes
from io import BytesIO
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from canvasflow.storage import get_minio_client
from canvasflow.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/storage/{path:path}")
async def proxy_storage(path: str):
    """从 MinIO 流式返回对象"""
    try:
        client = get_minio_client()
        response = client.get_object(settings.minio_bucket, path)

        # 猜测 MIME 类型
        content_type, _ = mimetypes.guess_type(path)
        if not content_type:
            content_type = "application/octet-stream"

        def iterfile():
            try:
                while True:
                    chunk = response.read(8192)
                    if not chunk:
                        break
                    yield chunk
            finally:
                response.close()
                response.release_conn()

        return StreamingResponse(
            iterfile(),
            media_type=content_type,
            headers={
                "Cache-Control": "public, max-age=86400",
            }
        )
    except Exception as e:
        logger.error(f"获取对象失败: {path}, {str(e)}")
        raise HTTPException(status_code=404, detail=f"对象不存在: {path}")
