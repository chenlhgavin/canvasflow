"""图片处理管线 - 下载、sRGB 归一化、上传到 MinIO"""
import base64
import logging
import uuid
from datetime import datetime
from io import BytesIO
from urllib.parse import urlparse

import requests

from canvasflow.config import settings
from canvasflow.storage import get_object, upload_object

logger = logging.getLogger(__name__)

try:
    from PIL import Image, ImageCms
except Exception:
    Image = None
    ImageCms = None
    logger.warning("未安装 Pillow：将无法进行 sRGB 归一化")


def download_and_save_image(image_url: str, prompt: str = "") -> str:
    """下载图片，sRGB 归一化后上传到 MinIO，返回访问路径"""
    try:
        logger.info(f"开始下载图片: {image_url}")
        response = requests.get(image_url, timeout=60)
        response.raise_for_status()

        # 从 URL 获取扩展名
        parsed_url = urlparse(image_url)
        path = parsed_url.path
        ext = path.rsplit(".", 1)[-1] if "." in path else "png"
        if ext not in ("jpg", "jpeg", "png", "webp", "gif", "bmp"):
            ext = "png"

        # 生成文件名
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        unique_id = str(uuid.uuid4())[:8]
        safe_prompt = "".join(c if c.isalnum() or c in (" ", "-", "_") else "" for c in prompt[:30])
        safe_prompt = safe_prompt.replace(" ", "_")
        filename = f"volcano_{timestamp}_{unique_id}_{safe_prompt}" if safe_prompt else f"volcano_{timestamp}_{unique_id}"

        # sRGB 归一化 + 格式选择
        image_data = response.content
        content_type = "image/png"
        saved_via_pillow = False

        if Image is not None:
            try:
                im = Image.open(BytesIO(image_data))
                im.load()

                # 统一转换到 sRGB
                if ImageCms is not None:
                    icc = getattr(im, "info", {}).get("icc_profile")
                    if icc:
                        try:
                            src_profile = ImageCms.ImageCmsProfile(BytesIO(icc))
                            dst_profile = ImageCms.createProfile("sRGB")
                            output_mode = "RGBA" if im.mode in ("RGBA", "LA") or "transparency" in getattr(im, "info", {}) else "RGB"
                            im = ImageCms.profileToProfile(im, src_profile, dst_profile, outputMode=output_mode)
                        except Exception:
                            pass

                # 去掉 ICC
                try:
                    if getattr(im, "info", None) and "icc_profile" in im.info:
                        im.info.pop("icc_profile", None)
                except Exception:
                    pass

                # 透明度检测
                has_alpha = im.mode in ("RGBA", "LA") or "transparency" in getattr(im, "info", {})
                is_transparent = False
                if has_alpha:
                    try:
                        alpha = im.getchannel("A")
                        lo, _ = alpha.getextrema()
                        is_transparent = lo < 255
                    except Exception:
                        is_transparent = True

                buf = BytesIO()
                if not is_transparent:
                    if im.mode != "RGB":
                        im = im.convert("RGB")
                    im.save(buf, format="JPEG", quality=95, optimize=True, progressive=True)
                    ext = "jpg"
                    content_type = "image/jpeg"
                else:
                    if im.mode not in ("RGBA", "RGB"):
                        im = im.convert("RGBA")
                    im.save(buf, format="PNG", optimize=True)
                    ext = "png"
                    content_type = "image/png"

                image_data = buf.getvalue()
                saved_via_pillow = True
                logger.info("sRGB 归一化完成")
            except Exception as e:
                logger.warning(f"sRGB 归一化失败，使用原始数据: {e}")

        filename = f"{filename}.{ext}"
        object_key = f"images/{filename}"

        # 上传到 MinIO
        upload_object(object_key, image_data, content_type=content_type, length=len(image_data))

        http_path = f"/storage/{object_key}"
        logger.info(f"图片已上传到 MinIO: {object_key}")
        return http_path

    except Exception as e:
        logger.error(f"下载图片失败: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        return image_url


def prepare_image_input(image_url: str) -> str:
    """从 MinIO 读取图片并转换为 Base64"""
    # 处理 /storage/ 路径
    if image_url.startswith("/storage/"):
        object_key = image_url[len("/storage/"):]
        logger.info(f"从 MinIO 读取: {object_key}")
        image_data = get_object(object_key)

        # 获取格式
        ext = object_key.rsplit(".", 1)[-1].lower() if "." in object_key else "jpeg"
        format_map = {"jpg": "jpeg", "jpeg": "jpeg", "png": "png", "webp": "webp", "gif": "gif", "bmp": "bmp"}
        image_format = format_map.get(ext, "jpeg")

        base64_data = base64.b64encode(image_data).decode("utf-8")
        base64_string = f"data:image/{image_format};base64,{base64_data}"
        logger.info(f"已转换为 Base64: {image_format}, {len(image_data)} bytes")
        return base64_string

    # localhost URL
    parsed = urlparse(image_url)
    if parsed.hostname in ("localhost", "127.0.0.1", "0.0.0.0"):
        if parsed.path.startswith("/storage/"):
            return prepare_image_input(parsed.path)

    raise ValueError(f"不支持的图片路径: {image_url[:80]}...\n请使用 /storage/images/xxx.jpg 格式")
