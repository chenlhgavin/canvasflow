"""MinIO 对象存储客户端封装"""

import logging
from io import BytesIO

from minio import Minio

from canvasflow.config import settings

logger = logging.getLogger(__name__)

_client: Minio | None = None


def get_minio_client() -> Minio:
    """获取 MinIO 客户端单例"""
    global _client
    if _client is None:
        _client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
    return _client


def ensure_bucket():
    """确保存储桶存在"""
    client = get_minio_client()
    bucket = settings.minio_bucket
    if not client.bucket_exists(bucket):
        client.make_bucket(bucket)
        logger.info(f"创建存储桶: {bucket}")
    else:
        logger.info(f"存储桶已存在: {bucket}")


def upload_object(
    object_key: str, data: bytes | BytesIO, content_type: str = "application/octet-stream", length: int = -1
) -> str:
    """上传对象到 MinIO"""
    client = get_minio_client()
    bucket = settings.minio_bucket
    if isinstance(data, bytes):
        data = BytesIO(data)
        length = data.getbuffer().nbytes
    elif length < 0:
        # 尝试获取长度
        current_pos = data.tell()
        data.seek(0, 2)
        length = data.tell()
        data.seek(current_pos)
    client.put_object(bucket, object_key, data, length, content_type=content_type)
    logger.info(f"上传对象: {object_key} ({length} bytes)")
    return object_key


def get_object(object_key: str) -> bytes:
    """从 MinIO 获取对象"""
    client = get_minio_client()
    bucket = settings.minio_bucket
    response = client.get_object(bucket, object_key)
    try:
        return response.read()
    finally:
        response.close()
        response.release_conn()
