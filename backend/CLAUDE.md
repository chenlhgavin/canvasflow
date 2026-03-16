# CanvasFlow Backend

Python + FastAPI + LangGraph 后端，提供 AI 对话、图片生成、项目管理 API。

## 常用命令

```bash
uv sync                  # 安装依赖
uv run uvicorn src.canvasflow.main:app --reload --port 8000   # 启动开发服务器
uv run alembic upgrade head                                    # 执行数据库迁移
uv run alembic revision --autogenerate -m "描述"               # 生成迁移脚本
uv run pytest                                                  # 运行测试
uv run ruff check .                                            # Lint
uv run ruff format .                                           # 格式化
```

## 技术栈

- **Python 3.12+**, 包管理用 **uv** (不要用 pip/poetry)
- **FastAPI** — Web 框架 + SSE 流式响应
- **LangGraph** — ReAct Agent 编排，驱动工具自动调用
- **LangChain** — `@tool` 装饰器注册 AI 工具
- **SQLAlchemy 2.x** — 异步 ORM (AsyncSession + aiomysql)
- **MinIO SDK** — 对象存储读写
- **Pillow** — 图片后处理 (sRGB 归一化、格式转换)
- **httpx** — 异步 HTTP 客户端

## 项目结构

```
backend/
├── pyproject.toml
├── uv.lock
├── .env / .env.example
├── alembic.ini
├── alembic/versions/
└── src/canvasflow/
    ├── main.py          # FastAPI 入口，路由注册，启动事件
    ├── config.py        # pydantic-settings 配置
    ├── database.py      # AsyncEngine / AsyncSession 工厂
    ├── storage.py       # MinIO 客户端封装
    ├── models/          # SQLAlchemy ORM 模型
    │   ├── canvas.py    #   canvases 表
    │   ├── message.py   #   messages 表
    │   ├── tool_call.py #   tool_calls 表
    │   └── image.py     #   images 表
    ├── routers/         # API 路由
    │   ├── chat.py      #   POST /api/chat (SSE 流式)
    │   ├── canvas.py    #   CRUD /api/canvases
    │   ├── upload.py    #   POST /api/upload-image
    │   └── storage.py   #   GET /storage/* (MinIO 代理)
    ├── services/        # 业务逻辑
    │   ├── agent.py     #   LangGraph Agent 构建
    │   ├── stream.py    #   StreamProcessor (SSE 事件分发)
    │   └── image.py     #   图片后处理管线
    └── tools/           # LangChain 工具
        ├── generate.py  #   generate_image (文生图)
        └── edit.py      #   edit_image (图生图编辑)
```

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/chat` | AI 对话 (SSE)，核心入口 |
| GET | `/api/canvases` | 项目列表 |
| POST | `/api/canvases` | 创建/更新项目 |
| DELETE | `/api/canvases/{id}` | 删除项目 |
| POST | `/api/upload-image` | 上传图片 (multipart) |
| GET | `/storage/{path}` | MinIO 对象代理 |

## SSE 事件协议

`POST /api/chat` 返回 `text/event-stream`，事件类型：
- `delta` — AI 文本增量 (逐 token)
- `tool_call` — 工具调用开始 (id, name, arguments)
- `tool_result` — 工具执行结果 (解析 `image_url` 字段)
- `error` — 异常信息
- `[DONE]` — 流结束

## 数据库 (MySQL)

连接 `../infrastructure` 中的 MySQL，数据库 `canvasflow`，4 张表：
- `canvases` — 画布/项目，`excalidraw_data` 为 LONGTEXT JSON
- `messages` — 对话消息，支持 `image_urls` JSON 字段
- `tool_calls` — 工具调用记录，含 `status` 枚举 (executing/done)
- `images` — 图片元数据，关联 MinIO 对象 key

编码 `utf8mb4`，排序 `ORDER BY created_at DESC`。Schema 变更必须通过 alembic 迁移。

## 对象存储 (MinIO)

Bucket: `canvasflow`，对象 key 格式：
- AI 生成: `images/{provider}_{timestamp}_{uuid8}_{safe_prompt}.{ext}`
- 用户上传: `images/upload_{timestamp}_{uuid8}{ext}`

## 代码规范

- 异步优先：路由和数据库操作用 `async def`，HTTP 客户端用 `httpx.AsyncClient`
- 参数校验用 `pydantic.BaseModel` + `Field`
- 工具注册用 `@tool` 装饰器 + `args_schema`
- 图片保存前必须经过 sRGB 归一化管线 (移除 ICC Profile)
- 火山引擎 API 响应需兼容三种格式 (`data[].url` / `images[].url` / `url`)
- `POST /api/canvases` 接收原始 JSON，不用 Pydantic 校验 (Excalidraw 数据结构复杂)
- **ruff** 配置在 `pyproject.toml` (`[tool.ruff]`)：`line-length=120`，规则集 `E,F,W,I`
- pre-commit 钩子自动执行 ruff lint (`--fix`) + ruff format

## 环境变量

参见 `.env.example`，关键变量：
- `VOLCANO_API_KEY` (必填) — 火山引擎 API Key
- `DATABASE_URL` — MySQL 连接串
- `MINIO_ENDPOINT` / `MINIO_ACCESS_KEY` / `MINIO_SECRET_KEY` — MinIO 配置
- `MOCK_MODE=true` — Mock 模式，跳过真实 API 调用，无需 MySQL/MinIO
