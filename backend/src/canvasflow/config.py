"""应用配置 - 使用 pydantic-settings 从 .env 加载"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # LLM (DashScope / 通义千问)
    dashscope_api_key: str = ""
    dashscope_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    dashscope_model: str = "qwen-plus"

    # 图片生成 (火山引擎 Seedream)
    volcano_api_key: str = ""
    volcano_base_url: str = "https://ark.cn-beijing.volces.com/api/v3"
    volcano_image_model: str = "doubao-seedream-4-0-250828"
    volcano_edit_model: str = "doubao-seedream-4-0-250828"

    # 数据库
    database_url: str = "mysql+aiomysql://canvasflow:canvasflow_pwd@127.0.0.1:3306/canvasflow"

    # MinIO
    minio_endpoint: str = "127.0.0.1:9000"
    minio_access_key: str = "minioadmin"
    minio_secret_key: str = "minio_Adm1n_S3cure!"
    minio_bucket: str = "canvasflow"
    minio_secure: bool = False

    # Agent
    recursion_limit: int = 200

    # 认证
    auth_enabled: bool = False
    auth_jwt_secret: str = ""
    auth_token_expiry_hours: int = 72
    auth_cookie_secure: str = "auto"
    auth_cookie_domain: str = ""
    auth_default_username: str = "admin"
    auth_default_password: str = "canvasflow123"

    # 日志
    log_level: str = "INFO"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
