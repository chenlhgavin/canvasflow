# CanvasFlow

AI 驱动的图片生成创作平台。用户通过自然语言对话生成和编辑图片，结果自动呈现在 Excalidraw 无限画布上。

## 功能特性

- **自然语言生图** — 输入文字描述，AI 自动生成高质量图片
- **图片编辑** — 上传图片或选择画布中的图片，通过对话进行风格迁移、内容修改等
- **无限画布** — 基于 Excalidraw 的可缩放、可框选、可对齐的图片画板
- **流式对话** — SSE 实时流式输出，打字机效果 + 工具调用状态指示
- **暗色/亮色主题** — 一键切换，自动持久化
- **项目管理** — 多项目支持，搜索、删除、缩略图预览

## 技术栈

| 层 | 技术 |
|---|------|
| 前端 | React 18 · TypeScript · Vite 5 · Excalidraw 0.18 |
| 后端 | Python 3.12 · FastAPI · LangGraph · LangChain |
| LLM | 通义千问 (DashScope API, qwen-plus) |
| 图片生成 | 火山引擎豆包 Seedream (doubao-seedream-4-0-250828) |
| 数据库 | MySQL 8.0 (异步, aiomysql) |
| 对象存储 | MinIO |
| 包管理 | uv (Python) · npm (Node.js) |

## 项目结构

```
canvasflow/
├── frontend/                  # React + TypeScript + Vite
│   └── src/
│       ├── App.tsx            # 路由 + 主题管理
│       └── components/
│           ├── HomePage.tsx    # 首页 (项目列表 + Prompt 输入)
│           ├── ChatInterface.tsx  # 编辑页 (对话面板 + 画布)
│           └── ExcalidrawCanvas.tsx  # Excalidraw 画布封装
├── backend/                   # Python + FastAPI + LangGraph
│   └── src/canvasflow/
│       ├── main.py            # FastAPI 入口
│       ├── config.py          # 配置管理
│       ├── database.py        # 数据库连接
│       ├── storage.py         # MinIO 客户端
│       ├── models/            # ORM 模型 (canvases, messages, tool_calls, images)
│       ├── routers/           # API 路由 (chat, canvas, upload, storage)
│       ├── services/          # 业务逻辑 (agent, stream, image)
│       └── tools/             # AI 工具 (generate_image, edit_image)
├── specs/                     # 技术规范和设计文档
└── CLAUDE.md                  # 开发指南
```

## 快速启动

### 前置条件

- Docker & Docker Compose (MySQL + MinIO)
- Python 3.12+, [uv](https://docs.astral.sh/uv/)
- Node.js 18+, npm

### 1. 启动基础设施

```bash
cd ../infrastructure && docker compose up -d
```

### 2. 启动后端

```bash
cd backend
uv sync
cp .env.example .env
# 编辑 .env，填写 VOLCANO_API_KEY 和 DASHSCOPE_API_KEY
uv run uvicorn canvasflow.main:app --reload --port 8000
```

### 3. 启动前端

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:3000 开始使用。

## 环境变量

在 `backend/.env` 中配置：

| 变量 | 说明 | 必填 |
|------|------|------|
| `DASHSCOPE_API_KEY` | 通义千问 API Key | 是 |
| `VOLCANO_API_KEY` | 火山引擎 API Key | 是 |
| `DATABASE_URL` | MySQL 连接串 | 否 (有默认值) |
| `MINIO_ENDPOINT` | MinIO 地址 | 否 (有默认值) |
| `MINIO_ACCESS_KEY` | MinIO 访问密钥 | 否 (有默认值) |
| `MINIO_SECRET_KEY` | MinIO 密钥 | 否 (有默认值) |

## API 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/chat` | AI 对话 (SSE 流式) |
| GET | `/api/canvases` | 获取项目列表 |
| POST | `/api/canvases` | 创建/更新项目 |
| DELETE | `/api/canvases/{id}` | 删除项目 |
| POST | `/api/upload-image` | 上传图片 |
| GET | `/storage/{path}` | MinIO 对象代理 |

## 架构概要

```
浏览器                       后端                          外部服务
 │                           │                              │
 │  POST /api/chat (SSE)     │                              │
 │ ─────────────────────────>│  LangGraph ReAct Agent       │
 │                           │ ───── generate_image ──────> │ 火山引擎 API
 │  data: {"type":"delta"}   │ <──── image URL ──────────── │
 │ <─────────────────────────│                              │
 │  data: {"type":"tool_call"}│  下载 → sRGB 归一化 → MinIO │
 │ <─────────────────────────│                              │
 │  data: {"type":"tool_result", image_url}                 │
 │ <─────────────────────────│                              │
 │                           │                              │
 │  GET /storage/images/...  │  MinIO 代理                  │
 │ <─────────────────────────│                              │
 │                           │                              │
 │  Excalidraw addImage()    │                              │
 │  (画布自动插入图片)         │                              │
```

## 开发规范

- 后端用 **uv** 管理依赖，前端用 **npm**
- 环境变量通过 `.env` 配置，敏感信息不入库
- 数据库变更通过 **alembic** 迁移
- 中文注释和文档，代码变量名用英文
