"""CanvasFlow 后端主程序"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from canvasflow.config import settings
from canvasflow.database import init_db
from canvasflow.storage import ensure_bucket
from canvasflow.routers import chat, canvas, upload, storage
from canvasflow.auth.router import router as auth_router
from canvasflow.auth.middleware import AuthMiddleware
from canvasflow.auth.service import seed_default_user

# 导入所有模型确保 Base.metadata 包含它们
import canvasflow.models  # noqa: F401

# 配置日志
logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    # 启动时
    logger.info("CanvasFlow 正在启动...")
    await init_db()
    ensure_bucket()
    if settings.auth_enabled:
        await seed_default_user(settings)
    logger.info("CanvasFlow 启动完成")
    yield
    # 关闭时
    logger.info("CanvasFlow 正在关闭...")


app = FastAPI(title="CanvasFlow API", version="0.1.0", lifespan=lifespan)

# 配置 CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 认证中间件（仅在启用时添加）
if settings.auth_enabled:
    app.add_middleware(AuthMiddleware, settings=settings)

# 注册路由
if settings.auth_enabled:
    app.include_router(auth_router)
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(canvas.router, prefix="/api", tags=["canvas"])
app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(storage.router, tags=["storage"])


@app.get("/")
async def root():
    return {"message": "CanvasFlow API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "ok"}
