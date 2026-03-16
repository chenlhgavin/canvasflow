"""文生图工具 - 使用火山引擎 Seedream API"""

import json
import logging

import requests
from langchain_core.tools import tool
from pydantic import BaseModel, Field

from canvasflow.config import settings
from canvasflow.services.image import download_and_save_image

logger = logging.getLogger(__name__)

# 宽高比到像素值的映射
ASPECT_RATIO_MAP = {
    "1:1": (2048, 2048),
    "4:3": (2304, 1728),
    "3:4": (1728, 2304),
    "16:9": (2560, 1440),
    "9:16": (1440, 2560),
    "3:2": (2496, 1664),
    "2:3": (1664, 2496),
    "21:9": (3024, 1296),
}


def parse_size(size: str) -> str:
    """解析尺寸参数"""
    if size.upper() in ["2K", "4K", "1K"]:
        return size.upper()
    if size in ASPECT_RATIO_MAP:
        width, height = ASPECT_RATIO_MAP[size]
        return f"{width}x{height}"
    if "x" in size or "X" in size:
        parts = size.replace("X", "x").split("x")
        if len(parts) == 2:
            try:
                width = int(parts[0].strip())
                height = int(parts[1].strip())
                return f"{width}x{height}"
            except ValueError:
                pass
    logger.warning(f"无法解析尺寸参数: {size}，使用默认 1:1 (2048x2048)")
    width, height = ASPECT_RATIO_MAP["1:1"]
    return f"{width}x{height}"


class GenerateImageInput(BaseModel):
    """图像生成输入参数"""

    prompt: str = Field(description="图像生成的提示词，详细描述想要生成的图像内容，支持中英文")
    size: str = Field(
        default="1:1",
        description="图片尺寸，支持宽高比枚举（1:1, 4:3, 3:4, 16:9, 9:16, 3:2, 2:3, 21:9）"
        "或自定义格式（如 2048x2048），默认 1:1",
    )


@tool("generate_image", args_schema=GenerateImageInput)
def generate_image_tool(prompt: str, size: str = "1:1") -> str:
    """
    AI 绘画（图片生成）服务，使用 Seedream 4.5 API 生成图像。
    输入文本描述，返回基于文本信息绘制的图片 URL。

    Args:
        prompt: 图像生成的提示词（支持中英文）
        size: 图片尺寸，支持宽高比枚举或自定义格式，默认 1:1
    """
    try:
        if not settings.volcano_api_key:
            return "Error generating image: 未配置 VOLCANO_API_KEY"

        size_value = parse_size(size)
        logger.info(f"开始生成图像: prompt={prompt}, size={size} -> {size_value}")

        url = f"{settings.volcano_base_url.rstrip('/')}/images/generations"

        payload = {
            "model": settings.volcano_image_model,
            "prompt": prompt,
            "sequential_image_generation": "disabled",
            "response_format": "url",
            "size": size_value,
            "stream": False,
            "watermark": True,
        }

        headers = {"Authorization": f"Bearer {settings.volcano_api_key}", "Content-Type": "application/json"}

        logger.info(f"调用火山引擎生成 API: {url}")
        response = requests.post(url, json=payload, headers=headers, timeout=120)

        if response.status_code != 200:
            error_msg = f"API调用失败: status={response.status_code}, body={response.text}"
            logger.error(error_msg)
            return f"Error generating image: {error_msg}"

        data = response.json()
        logger.info(f"API响应: {json.dumps(data, ensure_ascii=False)}")

        image_url = None
        if "data" in data and isinstance(data["data"], list) and len(data["data"]) > 0:
            image_url = data["data"][0].get("url")
        elif "images" in data and isinstance(data["images"], list) and len(data["images"]) > 0:
            image_url = data["images"][0].get("url")
        elif "url" in data:
            image_url = data["url"]

        if not image_url:
            return f"Error: No image URL in response. Response: {json.dumps(data)}"

        local_path = download_and_save_image(image_url, prompt)

        result = {
            "image_url": local_path,
            "original_url": image_url,
            "local_path": local_path,
            "prompt": prompt,
            "provider": "volcano",
            "message": "图片已生成并保存到对象存储",
        }

        result_json = json.dumps(result, ensure_ascii=False)
        logger.info(f"图像生成成功: {local_path}")
        return result_json

    except Exception as e:
        logger.error(f"图像生成失败: {str(e)}")
        import traceback

        logger.error(traceback.format_exc())
        return f"Error generating image: {str(e)}"
