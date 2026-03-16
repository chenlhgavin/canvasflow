"""图生图工具 - 使用火山引擎 Seedream API 编辑图片"""

import json
import logging

import requests
from langchain_core.tools import tool
from pydantic import BaseModel, Field

from canvasflow.config import settings
from canvasflow.services.image import download_and_save_image, prepare_image_input
from canvasflow.tools.generate import parse_size

logger = logging.getLogger(__name__)


class EditImageInput(BaseModel):
    """图像编辑输入参数"""

    prompt: str = Field(description="图像编辑的提示词，详细描述想要达到的效果，支持中英文")
    image_url: str = Field(description="需要编辑的源图片URL或本地路径（/storage/images/...）")
    size: str = Field(default="1:1", description="输出图片尺寸，支持宽高比枚举或自定义格式，默认 1:1")


@tool("edit_image", args_schema=EditImageInput)
def edit_image_tool(prompt: str, image_url: str, size: str = "1:1") -> str:
    """
    图片编辑服务（Seedream 4.5 API），基于已有图片和提示词生成新的图片。
    用于保持角色一致性、场景一致性、风格迁移等。

    Args:
        prompt: 编辑提示词（支持中英文）
        image_url: 原图 URL 或本地路径（如 /storage/images/xxx.png）
        size: 输出图片尺寸，默认 1:1
    """
    try:
        if not settings.volcano_api_key:
            return "Error editing image: 未配置 VOLCANO_API_KEY"

        size_value = parse_size(size)
        logger.info(f"开始编辑图像: prompt={prompt}, image_url={image_url}, size={size} -> {size_value}")

        # 准备图片输入（从 MinIO 读取并转 Base64）
        image_input = prepare_image_input(image_url)

        url = f"{settings.volcano_base_url.rstrip('/')}/images/generations"

        payload = {
            "model": settings.volcano_edit_model,
            "prompt": prompt,
            "image": image_input,
            "sequential_image_generation": "disabled",
            "response_format": "url",
            "size": size_value,
            "stream": False,
            "watermark": True,
        }

        headers = {"Authorization": f"Bearer {settings.volcano_api_key}", "Content-Type": "application/json"}

        # 日志中隐藏 Base64 数据
        payload_for_log = payload.copy()
        if isinstance(payload_for_log.get("image"), str) and payload_for_log["image"].startswith("data:image"):
            payload_for_log["image"] = "data:image/...;base64,<已隐藏>"
        logger.info(f"调用火山引擎编辑 API: model={payload['model']}")

        response = requests.post(url, json=payload, headers=headers, timeout=120)

        if response.status_code != 200:
            error_msg = f"API调用失败: status={response.status_code}, body={response.text}"
            logger.error(error_msg)
            return f"Error editing image: {error_msg}"

        data = response.json()
        logger.info(f"API响应: {json.dumps(data, ensure_ascii=False)}")

        image_urls = []
        if "data" in data and isinstance(data["data"], list):
            image_urls = [item.get("url") for item in data["data"] if item.get("url")]
        elif "images" in data and isinstance(data["images"], list):
            image_urls = [item.get("url") for item in data["images"] if item.get("url")]
        elif "url" in data:
            image_urls = [data["url"]]

        if not image_urls:
            return f"Error: No image URL in response. Response: {json.dumps(data)}"

        new_image_url = image_urls[0]
        local_path = download_and_save_image(new_image_url, prompt)

        result = {
            "image_url": local_path,
            "original_url": new_image_url,
            "local_path": local_path,
            "prompt": prompt,
            "source_image": image_url,
            "provider": "volcano",
            "message": "图片已编辑并保存到对象存储",
        }

        result_json = json.dumps(result, ensure_ascii=False)
        logger.info(f"图像编辑成功: {local_path}")
        return result_json

    except Exception as e:
        logger.error(f"图像编辑失败: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())
        return f"Error editing image: {str(e)}"
