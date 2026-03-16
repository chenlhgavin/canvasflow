# CanvasFlow

AI 驱动的图片生成创作平台，用户通过自然语言对话生成/编辑图片，结果自动呈现在 Excalidraw 无限画布上。

## 项目结构

```
canvasflow/
├── frontend/          # React + TypeScript + Vite 前端
├── backend/           # Python + FastAPI + LangGraph 后端 (uv 管理)
├── site/              # Astro + TypeScript 静态站点 (AIGC 知识库)
├── specs/             # 技术规范和设计文档
├── vendors/           # 第三方子模块 (PolyStudio)
└── infrastructure/    # ../infrastructure 共享基础设施 (MySQL + MinIO)
```

## 基础设施

MySQL 和 MinIO 由 `../infrastructure/docker-compose.yml` 统一管理，不要在本项目中单独启动。

```bash
cd ../infrastructure && docker compose up -d
```

| 服务 | 地址 | 凭据 |
|------|------|------|
| MySQL | 127.0.0.1:3306 | canvasflow / canvasflow_pwd (数据库: canvasflow) |
| MinIO API | 127.0.0.1:9000 | minioadmin / minio_Adm1n_S3cure! |
| MinIO Console | localhost:9001 | 同上 |
| phpMyAdmin | localhost:8080 | — |

## 快速启动

```bash
# 1. 启动基础设施
cd ../infrastructure && docker compose up -d

# 2. 启动后端
cd backend
uv sync
cp .env.example .env   # 配置环境变量
uv run uvicorn src.canvasflow.main:app --reload --port 8000

# 3. 启动前端
cd frontend
npm install
npm run dev            # Vite dev server，自动代理 /api /storage 到 :8000

# 4. 启动知识库站点 (可选)
cd site
npm install
npm run dev            # Astro dev server，http://0.0.0.0:4322
```

## 架构概要

- **通信协议**: SSE (Server-Sent Events)，`POST /api/chat` 返回 `text/event-stream`
- **图片存储**: MinIO 对象存储，通过后端 `/storage/*` 代理路由访问
- **AI Agent**: LangGraph ReAct 模式，自动调用 generate_image / edit_image 工具
- **图片 API**: 火山引擎 Seedream 4.5

## 开发规范

- 后端使用 **uv** 管理依赖，不要使用 pip/poetry
- 前端和站点使用 **npm**，不要使用 yarn/pnpm
- 环境变量通过 `.env` 文件配置，敏感信息不入库
- 数据库 Schema 变更通过 **alembic** 迁移，不要手动改表
- 中文注释和文档，代码中变量名使用英文

## 代码质量

项目配置了 **pre-commit** 钩子，`git commit` 时自动执行检查：

```bash
pre-commit install       # 安装 git hooks (首次)
pre-commit run --all-files  # 手动运行所有检查
```

| 检查项 | 工具 | 范围 |
|--------|------|------|
| 行尾空格、文件末尾换行、YAML 语法、大文件、合并冲突 | pre-commit-hooks | 全局 |
| Python lint + 格式化 | ruff | backend/ |
| TS/JS/CSS/JSON 格式化 | prettier | frontend/ + site/ |

配置文件：`.pre-commit-config.yaml`、`backend/pyproject.toml` (`[tool.ruff]`)、`.prettierrc`

## 关键文档

- `specs/image-generation-design.md` — 完整设计文档（架构、API、数据流、算法）
- `specs/image-generation.md` — 原始技术规范
- `specs/polystudio-architecture.md` — PolyStudio 参考架构
