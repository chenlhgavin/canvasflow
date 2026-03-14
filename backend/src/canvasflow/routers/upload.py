"""图片上传路由 - 上传到 MinIO"""
import uuid
import logging
from datetime import datetime
from fastapi import APIRouter, HTTPException, UploadFile, File
from canvasflow.storage import upload_object

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/upload-image")
async def upload_image(file: UploadFile = File(...)):
    """上传图片到 MinIO"""
    try:
        content_type = file.content_type or ""
        if not content_type.startswith("image/"):
            raise HTTPException(status_code=400, detail="只支持图片文件")

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]

        original_filename = file.filename or "image"
        ext = original_filename.rsplit(".", 1)[-1] if "." in original_filename else "jpg"
        if ext not in ("jpg", "jpeg", "png", "webp", "gif", "bmp"):
            ext = "jpg"

        filename = f"upload_{timestamp}_{unique_id}.{ext}"
        object_key = f"images/{filename}"

        content = await file.read()
        upload_object(object_key, content, content_type=content_type, length=len(content))

        image_url = f"/storage/{object_key}"
        logger.info(f"图片已上传: {image_url}")
        return {"url": image_url, "filename": filename}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"上传失败: {str(e)}")
