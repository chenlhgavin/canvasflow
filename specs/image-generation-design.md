# CanvasFlow 图片生成模块 — 设计文档

> 基于 `specs/image-generation.md` 技术规范提取，面向开发实现

---

## 目录

1. [整体架构设计](#1-整体架构设计)
2. [技术栈](#2-技术栈)
3. [后端设计](#3-后端设计)
4. [前端设计](#4-前端设计)
5. [后端 API 设计](#5-后端-api-设计)
6. [数据流设计](#6-数据流设计)
7. [关键算法](#7-关键算法)
8. [核心数据结构](#8-核心数据结构)
9. [存储设计](#9-存储设计)
10. [外部依赖](#10-外部依赖)

---

## 1. 整体架构设计

### 1.1 系统架构总览

```
┌──────────────────────────────────────────────────────────────────┐
│                        用户浏览器                                 │
│  ┌────────────────────────┐  ┌────────────────────────────────┐  │
│  │     对话面板 (Chat)      │  │    Excalidraw 无限画布          │  │
│  │  - 消息列表             │  │  - 图片自动布局                  │  │
│  │  - 图片上传/预览         │  │  - 白底板 + 图片元素             │  │
│  │  - 工具调用状态指示       │  │  - 支持缩放/平移/选择            │  │
│  └───────────┬────────────┘  └──────────────┬─────────────────┘  │
│              │ SSE (text/event-stream)        │ addImage() API    │
│              │ POST /api/chat                 │                   │
└──────────────┼───────────────────────────────┼───────────────────┘
               │                               │
   ┌───────────▼───────────────────────────────▼──────────────────┐
   │                     FastAPI 后端 (:8000)                       │
   │  ┌──────────────────────────────────────────────────────┐     │
   │  │              LangGraph Agent (ReAct)                  │     │
   │  │  ┌────────────────┐  ┌─────────────────────────────┐ │     │
   │  │  │ StreamProcessor │  │     LangChain Tools          │ │     │
   │  │  │ (SSE 事件分发)   │  │  - generate_image (文生图)   │ │     │
   │  │  │                │  │  - edit_image    (图生图)     │ │     │
   │  │  └────────────────┘  └──────────────┬──────────────┘ │     │
   │  └─────────────────────────────────────┼────────────────┘     │
   │                                        │                       │
   │  ┌──────────────┐  ┌──────────────┐    │                       │
   │  │ 图片后处理管线  │  │ MinIO 代理    │    │                       │
   │  │ (sRGB/格式)   │  │ /storage/*   │    │                       │
   │  └──────┬───────┘  └──────┬───────┘    │                       │
   └─────────┼────────────────┼────────────┼───────────────────────┘
             │                │            │
   ┌──────────────────────────────────┐  ┌────▼─────────────────────┐
   │  ../infrastructure (共享服务)      │  │  火山引擎 Seedream 4.5   │
   │  ┌─────────▼────┐  ┌───────▼────┐│  │  (图片生成/编辑 API)      │
   │  │   MySQL 8.0   │  │   MinIO     ││  └──────────────────────────┘
   │  │  (元数据/消息)  │  │  (对象存储)  ││
   │  └──────────────┘  └────────────┘│
   └──────────────────────────────────┘
```

### 1.2 核心能力

| 能力 | 描述 | 提供商 |
|------|------|--------|
| 文生图 (Text-to-Image) | 根据文本提示词生成图片 | 火山引擎 Seedream 4.5 |
| 图生图编辑 (Image Editing) | 基于已有图片 + 提示词生成新图片 | 火山引擎 Seedream 4.5 |

### 1.3 通信协议

| 环节 | 方案 |
|------|------|
| 前后端通信 | SSE (Server-Sent Events)，`POST /api/chat` → `text/event-stream` |
| 图片访问 | MinIO 代理路由 `/storage/*`，前端 URL 格式不变 |
| 画布集成 | `ExcalidrawCanvas` 暴露 `addImage(url, title)` 命令式 API |
| 图片上传 | `POST /api/upload-image`（multipart/form-data） |
| 开发代理 | Vite `/api/*` → `:8000`，`/storage/*` → `:8000` |

---

## 2. 技术栈

### 2.1 后端（Python，uv 管理）

项目使用 **uv** 作为 Python 包管理和虚拟环境工具。

| 技术 | 版本 | 用途 |
|------|------|------|
| Python | 3.12+ | 运行时 |
| uv | latest | 包管理 & 虚拟环境 |
| FastAPI | >=0.135.1 | Web 框架，REST API + SSE 流式响应 |
| LangChain | >=1.2.12 | AI 工具链框架，`@tool` 装饰器注册工具 |
| LangGraph | >=1.1.0 | AI Agent 编排，ReAct 推理-行动循环 |
| langchain-openai | >=1.1.11 | OpenAI 兼容协议接入 LLM |
| Pillow | >=12.1.1 | 图片解析、sRGB 归一化、格式转换 |
| httpx | >=0.28.1 | 异步 HTTP 客户端（API 调用 + 图片下载） |
| pydantic | >=2.12.5 | 工具参数校验（`BaseModel` + `Field`） |
| python-dotenv | >=1.2.2 | `.env` 环境变量加载 |
| sse-starlette | >=3.2.0 | SSE 响应封装 |
| python-multipart | >=0.0.22 | multipart/form-data 文件上传 |
| uvicorn | >=0.41.0 | ASGI 服务器 |
| SQLAlchemy | >=2.0.48 | ORM，MySQL 异步访问（AsyncSession） |
| aiomysql | >=0.3.2 | SQLAlchemy 异步 MySQL 驱动 |
| alembic | >=1.18.4 | 数据库 Schema 迁移管理 |
| minio | >=7.2.20 | MinIO Python SDK |

**uv 项目初始化**：

```bash
# 初始化项目
uv init canvasflow-backend --python 3.12

# 添加依赖
uv add fastapi uvicorn[standard] langchain langgraph langchain-openai \
       pillow httpx pydantic python-dotenv sse-starlette python-multipart \
       sqlalchemy aiomysql alembic minio

# 添加开发依赖
uv add --dev pytest pytest-asyncio ruff mypy
```

### 2.2 前端（Node.js）

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 19.x | UI 框架 |
| TypeScript | 5.9.x | 类型系统 |
| Vite | 8.x | 构建工具 & 开发服务器 |
| @excalidraw/excalidraw | 0.18.x | 无限画布 |
| react-markdown | 10.x | Markdown 渲染 |
| lucide-react | latest | UI 图标 |

### 2.3 基础设施（复用 `../infrastructure`）

MySQL 和 MinIO 由 `../infrastructure/docker-compose.yml` 统一提供，CanvasFlow 不单独管理这些服务。

| 组件 | 版本 | 用途 | 来源 |
|------|------|------|------|
| MySQL | 8.0 | 关系型数据库（元数据、消息、工具调用记录） | `../infrastructure` |
| MinIO | latest | S3 兼容对象存储（图片文件） | `../infrastructure` |
| phpMyAdmin | latest | 数据库 Web 管理 | `../infrastructure` |

---

## 3. 后端设计

### 3.1 项目结构

```
canvasflow-backend/
├── pyproject.toml              # uv 项目配置 & 依赖声明
├── uv.lock                     # 锁定文件
├── .env                        # 环境变量（不入库）
├── .env.example                # 环境变量模板
├── alembic.ini                 # Alembic 配置
├── alembic/                    # 数据库迁移
│   └── versions/
├── src/
│   └── canvasflow/
│       ├── __init__.py
│       ├── main.py             # FastAPI 应用入口
│       ├── config.py           # Settings (pydantic-settings)
│       ├── database.py         # SQLAlchemy 引擎 & Session
│       ├── models/             # ORM 模型
│       │   ├── __init__.py
│       │   ├── canvas.py       # Canvas 表
│       │   ├── message.py      # Message 表
│       │   ├── tool_call.py    # ToolCall 表
│       │   └── image.py        # Image 表
│       ├── routers/            # API 路由
│       │   ├── __init__.py
│       │   ├── chat.py         # POST /api/chat (SSE)
│       │   ├── canvas.py       # CRUD /api/canvases
│       │   ├── upload.py       # POST /api/upload-image
│       │   └── storage.py      # GET /storage/* (MinIO 代理)
│       ├── services/           # 业务逻辑
│       │   ├── __init__.py
│       │   ├── agent.py        # LangGraph Agent 构建
│       │   ├── stream.py       # StreamProcessor (SSE 事件)
│       │   └── image.py        # 图片后处理管线
│       ├── tools/              # LangChain 工具
│       │   ├── __init__.py
│       │   ├── generate.py     # generate_image 文生图
│       │   └── edit.py         # edit_image 图生图编辑
│       └── storage.py          # MinIO 客户端封装
```

### 3.2 应用入口 (main.py)

```python
app = FastAPI(title="CanvasFlow API", version="1.0.0")

# CORS
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# 路由注册
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(canvas.router, prefix="/api", tags=["canvas"])
app.include_router(upload.router, prefix="/api", tags=["upload"])
app.include_router(storage.router)  # /storage/*
```

**启动事件**：
1. 创建 SQLAlchemy AsyncEngine / AsyncSession 工厂（连接 `../infrastructure` 中的 MySQL）
2. 开发环境自动建表 (`Base.metadata.create_all`)
3. 确保 MinIO Bucket `canvasflow` 存在（连接 `../infrastructure` 中的 MinIO）

### 3.3 LangGraph Agent 架构

```
用户消息 + 历史消息
    ↓
LangGraph ReAct Agent
    ↓ agent.astream(messages, stream_mode="messages")
StreamProcessor._handle_chunk(chunk)
    ├─ AIMessageChunk.content        → 发射 delta 事件
    ├─ AIMessageChunk.tool_calls     → 累积参数 → 发射 tool_call 事件
    ├─ AIMessageChunk.tool_call_chunks → 增量拼接 JSON → 完整后发射 tool_call
    └─ ToolMessage                   → 发射 tool_result 事件
```

**关键实现细节**：
- **参数流式累积**：维护 `tool_call_args_buffer`，逐段拼接 JSON，解析成功后才发射事件
- **递归限制**：`recursion_limit` 默认 200（环境变量 `RECURSION_LIMIT`）
- **客户端断开检测**：捕获 `ConnectionError` / `BrokenPipeError`，停止 Agent 处理

### 3.4 工具定义

#### 文生图工具

```python
@tool("generate_image", args_schema=GenerateImageInput)
def generate_image_tool(prompt: str, size: str = "1:1") -> str:
    """输入文本描述，返回生成的图片 URL (JSON)"""
    # 1. parse_size(size) → 像素尺寸
    # 2. POST 火山引擎 API
    # 3. download_and_save_image() → MinIO
    # 4. 返回 JSON { image_url, original_url, prompt, provider, message }
```

#### 图生图编辑工具

```python
@tool("edit_image", args_schema=EditImageInput)
def edit_image_tool(prompt: str, image_url: str, size: str = "1:1") -> str:
    """基于已有图片 + 提示词生成新图片"""
    # 1. prepare_image_input(image_url) → Base64 Data URL
    # 2. POST 火山引擎 API (含 image 字段)
    # 3. download_and_save_image() → MinIO
    # 4. 返回 JSON { image_url, original_url, source_image, prompt, provider, message }
```

---

## 4. 前端设计

### 4.1 页面路由（无 React Router）

通过 URL 参数 `canvasId` 控制页面切换：

```
App.tsx
├─ canvasId 为空  → <HomePage />      首页（项目列表 + 创建入口）
└─ canvasId 存在  → <ChatInterface /> 编辑页（对话面板 + 无限画布）
```

| 路由 | URL 示例 | 页面 |
|------|----------|------|
| 首页 | `/` | 项目列表、搜索、快速创建 |
| 编辑页 | `/?canvasId=canvas-1710000000` | 对话面板 + 无限画布 |

导航：`window.history.pushState` + `PopStateEvent`。
主题：`document.documentElement.dataset.theme`，`localStorage` 持久化，默认深色。

### 4.2 首页设计 (HomePage)

#### 整体布局

```
┌─────────────────────────────────────────────────────────────┐
│  ┌───────────────┐                              ┌─────────┐│
│  │ Logo + 标题    │                              │ 亮/暗色  ││
│  └───────────────┘                              └─────────┘│
│                                                             │
│        从问题开始，进入画板创作                                │ ← Hero 标题
│                                                             │
│    ┌─────────────────────────────────────────────────────┐  │
│    │ [已上传图片预览区: 60×60 缩略图, 可删除]                │  │
│    │ [📎] [  输入框 (textarea rows=3)             ] │  │ ← Prompt 输入卡片
│    │      [  提示文案               ] [开始 →]      │  │
│    └─────────────────────────────────────────────────────┘  │
│                                                             │
│    ┌─ 历史项目 ──────────────────────── [🔍 搜索] ─┐       │
│    │  3列网格 (响应式: 3/2/1 列)                     │       │
│    │  ┌──────────┐  ┌──────────┐  ┌──────────┐      │       │ ← 项目卡片
│    │  │ 缩略图拼贴 │  │ 缩略图拼贴 │  │ 文本预览   │      │       │
│    │  │ 项目名    │  │ 项目名    │  │ 项目名    │      │       │
│    │  │ 时间 · N张│  │ 时间 · N张│  │ 时间 · N张│      │       │
│    │  └──────────┘  └──────────┘  └──────────┘      │       │
│    └───────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

#### 核心组件

| 组件 | 说明 |
|------|------|
| 背景效果 | 四色径向渐变光斑 (蓝/紫/绿/红) + 高斯模糊 (`filter: blur(24px)`) |
| Prompt 输入卡片 | 半透明玻璃卡片 (`rgba(255,255,255,0.06)`)，圆角 18px |
| 项目卡片网格 | 3 列 Grid，缩略图拼贴布局 (1/2/3/4 张图自适应)，hover 微上浮 |
| 搜索过滤 | `useMemo` 前端筛选，按项目名/ID 模糊匹配 |
| 骨架屏 | 6 个骨架卡片 + shimmer 动画 |

#### 交互流程

1. 用户输入文本 (`<textarea rows={3}>`)
2. 可点击 📎 上传图片，或粘贴图片 (`onPaste`)
3. **Enter** 发送 / **Shift+Enter** 换行
4. 创建项目 → `sessionStorage` 存 pending prompt → URL 加 `canvasId` → 跳转编辑页
5. 编辑页自动读取 pending prompt 并发送

#### 响应式断点

| 断点 | 网格列数 | 其他调整 |
|------|----------|----------|
| > 1020px | 3 列 | — |
| 640–1020px | 2 列 | 搜索框缩窄 |
| < 640px | 1 列 | 标题缩小，搜索框全宽 |

### 4.3 编辑页设计 (ChatInterface)

#### 整体布局

```
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────┐                                                │
│  │ 控制栏   │           Excalidraw 无限画布                    │
│  │ (返回/   │          (全屏, position: absolute, inset: 0)   │
│  │  历史)   │                                                │
│  └─────────┘     ┌──────────────┐                           │
│                  │  白底板+图片1  │                           │
│                  └──────────────┘  ┌──────────────┐         │
│                                    │  白底板+图片2  │         │
│                                    └──────────────┘    ┌────────────┐
│                                                        │  对话面板   │
│                                                        │  (380px)   │
│                                                        │  右侧浮动   │
│                                                        │  z-index:  │
│                                                        │  100       │
│                                                        └────────────┘
│                                                   ┌──┐  │
│                                                   │💬│  │ ← 收起时
│                                                   └──┘  │
└─────────────────────────────────────────────────────────────┘
```

| 层次 | 说明 |
|------|------|
| 画布层 | Excalidraw 全屏，z-index: 0 |
| 对话面板 | 右侧 380px 玻璃拟态浮动面板，z-index: 100 |
| 控制栏 | 左上角按钮组（返回首页、历史记录下拉） |

#### 对话面板

**视觉**：玻璃拟态 (Glassmorphism)，`backdrop-filter: blur(12px)`，蓝/紫辉光投影。

**结构**：Header（标题+关闭）→ Messages（可滚动）→ Input（图片预览+输入+发送）

**收起/展开**：右滑出屏动画 `transform: translateX(calc(100% + 40px))`，收起时显示 48px 悬浮按钮。

**移动端适配**（`< 768px`）：全宽底部抽屉式，`height: 80vh`，圆角变为顶部圆角。

#### 消息气泡

| 类型 | 对齐 | 样式 |
|------|------|------|
| 用户消息 | 右 | 蓝紫渐变背景，白色文字 |
| AI 消息 | 左 | 半透明暗色背景，边框分隔 |

消息入场动画：`fadeIn`（从下方 10px 淡入）。

#### 工具调用状态指示器

```
执行中: [ ● 生成图像 ▸ ]   ← 蓝色脉冲圆点 + 呼吸边框动画
完成:   [ ● 生成图像 ▾ ]   ← 绿色实心圆点，可点击展开参数/结果详情
```

| 状态 | 圆点颜色 | 边框效果 |
|------|----------|----------|
| `executing` | `#3b82f6` 蓝色脉冲 | 蓝色呼吸动画 |
| `done` | `#10b981` 绿色实心 | 静态 |

工具名称映射：`generate_volcano_image` → "生成图像"，`edit_volcano_image` → "编辑图像"。

#### 图片展示

**对话面板内**：工具状态块之后内联 `<img>`，`max-height: 400px`，`object-fit: contain`。

**画布上**：两层元素（底层白色 `rectangle` + 上层 `image`），最大宽度 300px 按比例缩放。

---

## 5. 后端 API 设计

### 5.1 端点总览

| 方法 | 路径 | 功能 | 请求/参数 | 响应 |
|------|------|------|-----------|------|
| `GET` | `/` | 健康检查 | — | `{"message":"CanvasFlow API","status":"running"}` |
| `GET` | `/health` | 健康检查 | — | `{"status":"ok"}` |
| `POST` | `/api/chat` | AI 对话 (SSE) | `ChatRequest` | `text/event-stream` |
| `GET` | `/api/canvases` | 项目列表 | — | `CanvasSummary[]` |
| `POST` | `/api/canvases` | 创建/更新项目 | 原始 JSON | 保存后的 JSON |
| `DELETE` | `/api/canvases/{canvas_id}` | 删除项目 | path 参数 | `{"success":true}` |
| `POST` | `/api/upload-image` | 上传图片 | `multipart/form-data` | `{"url":"...","filename":"..."}` |
| `GET` | `/storage/{path:path}` | MinIO 对象代理 | path 参数 | 流式文件内容 |

### 5.2 对话接口 — `POST /api/chat`

**请求体**：

```json
{
  "message": "生成一张夕阳下的海滩",
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ],
  "session_id": "optional-session-id"
}
```

**响应头**：

```
Content-Type: text/event-stream; charset=utf-8
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no
```

**SSE 事件协议**：

| 事件类型 | 数据字段 | 触发时机 | 前端处理 |
|----------|---------|---------|---------|
| `delta` | `content: string` | LLM 生成文本（逐 token） | 追加到消息，打字机效果 |
| `tool_call` | `id, name, arguments` | Agent 决定调用工具 | 显示工具状态卡片（蓝色脉冲） |
| `tool_result` | `tool_call_id, content` | 工具执行完成 | 解析 `image_url`，触发 `addImage()` |
| `error` | `error: string` | 异常 | 显示错误提示 |
| `[DONE]` | — | 流结束 | 保存消息历史和画布数据 |

**SSE 事件示例**：

```
data: {"type":"delta","content":"好的，我来为你生成"}
data: {"type":"tool_call","id":"call_abc123","name":"generate_volcano_image","arguments":{"prompt":"夕阳下的海滩","size":"16:9"}}
data: {"type":"tool_result","tool_call_id":"call_abc123","content":"{\"image_url\":\"/storage/images/xxx.jpg\",\"prompt\":\"夕阳下的海滩\",\"provider\":\"volcano\",\"message\":\"图片已生成并保存到对象存储\"}"}
data: {"type":"delta","content":"图片已生成完毕"}
data: [DONE]
```

### 5.3 项目管理接口

#### `GET /api/canvases`

返回所有项目列表（`ORDER BY created_at DESC`），每个项目包含：
- `id`, `name`, `createdAt`, `images`, `data` (Excalidraw), `messages`

#### `POST /api/canvases`

创建或更新项目。按 `id` 查找，存在则更新，不存在则插入头部。
请求体使用原始 JSON（不用 Pydantic），避免 Excalidraw 复杂数据结构字段丢失。

#### `DELETE /api/canvases/{canvas_id}`

删除项目，返回 `{ "success": true }`。

### 5.4 图片上传接口 — `POST /api/upload-image`

- `Content-Type: multipart/form-data`，字段 `file: UploadFile`
- 校验 `content_type` 以 `image/` 开头
- 存储路径：`images/upload_{timestamp}_{uuid8}{ext}`
- 写入 MinIO + MySQL `images` 表
- 返回 `{ "url": "/storage/images/...", "filename": "..." }`

### 5.5 MinIO 代理路由 — `GET /storage/{path:path}`

从 MinIO 流式读取对象返回，MIME 类型通过 `mimetypes.guess_type` 推断。404 时返回 `HTTPException(404)`。

---

## 6. 数据流设计

### 6.1 文生图完整数据流

```
用户输入: "生成一张夕阳下的海滩图片"
    ↓
POST /api/chat { message, messages }
    ↓
LangGraph ReAct Agent 推理
    ↓ SSE: delta 事件 → "好的，我来为你生成..."
LLM 决定调用 generate_image_tool(prompt="夕阳下的海滩", size="16:9")
    ↓ SSE: tool_call 事件 → 前端显示蓝色脉冲状态
parse_size("16:9") → "2560x1440"
    ↓
POST https://ark.cn-beijing.volces.com/api/v3/images/generations
    Body: { model: "seedream-4.5", prompt, size: "2560x1440", n: 1, response_format: "url" }
    ↓
API 返回: { "data": [{ "url": "https://cdn.volcengine.com/xxx.png" }] }
    ↓
图片后处理管线:
    ├─ httpx GET 下载原始字节
    ├─ PIL 解析 → sRGB 归一化 → 移除 ICC Profile
    ├─ 透明度检测 → JPEG(quality=95) 或 PNG
    ├─ minio_client.put_object() → 上传到 MinIO
    └─ 写入 MySQL images 表元数据
    ↓
返回 JSON: { "image_url": "/storage/images/volcano_...jpg", ... }
    ↓ SSE: tool_result 事件
前端解析:
    ├─ 状态变绿 [ ● 生成图像 ✓ ]
    ├─ 对话内嵌展示图片
    └─ 画布 addImage(url, title)
    ↓ SSE: delta 事件 → "图片已生成完毕..."
    ↓ SSE: [DONE]
前端保存消息历史 + 画布数据
```

### 6.2 图生图编辑数据流

```
用户上传图片 → POST /api/upload-image → MinIO 存储
    ↓
用户输入: "把这张图片改成水彩画风格" + imageUrls: ["/storage/images/upload_xxx.jpg"]
    ↓
POST /api/chat { message, messages (含 imageUrls) }
    ↓
LLM 决定调用 edit_image_tool(prompt="水彩画风格", image_url="/storage/images/upload_xxx.jpg")
    ↓
prepare_image_input(image_url):
    ├─ 解析 URL → 提取 MinIO 对象 key
    ├─ minio_client.get_object() → 读取原始字节
    └─ Base64 编码 → "data:image/jpeg;base64,{data}"
    ↓
POST API (含 image 字段: Base64 Data URL)
    ↓
图片后处理管线 (同文生图)
    ↓
SSE 事件推送 → 前端展示
```

### 6.3 SSE 流式时序

```
[发送消息] → [AI思考中...打字机光标]
                │
                ├─ delta: 逐字显示 "好的，我来为你生成一张..."
                ├─ tool_call: 工具状态卡片 [● 生成图像] 蓝色脉冲
                │   (等待 API 返回，数秒到数十秒)
                ├─ tool_result: 状态变绿 + 图片内嵌展示 + 画布添加
                ├─ delta: "图片已生成，画布上可以查看..."
                └─ [DONE]: 保存消息历史 + 画布数据
```

---

## 7. 关键算法

### 7.1 图片后处理管线

```
API 返回图片 URL
    ↓ httpx 下载
PIL.Image.open(BytesIO(raw_bytes))
    ↓
sRGB 色彩空间归一化:
    ├─ 提取源 ICC Profile
    ├─ 若存在: ImageCms.profileToProfile(im, src, sRGB, outputMode)
    └─ 移除 ICC Profile (im.info.pop("icc_profile"))
    ↓
透明度检测:
    ├─ mode in ("RGBA", "LA") 或 "transparency" in info
    ├─ alpha.getextrema() → lo < 255 → 含透明
    ↓
格式决策:
    ├─ 不透明 → RGB → JPEG (quality=95, optimize, progressive)
    └─ 含透明 → RGBA → PNG (optimize)
    ↓
BytesIO 缓冲区 (不落盘)
    ↓
minio_client.put_object() + MySQL images 表
```

**sRGB 归一化的必要性**：AI 生成图片可能包含非 sRGB ICC Profile，导致 `<img>` 和 Canvas (Excalidraw) 渲染色差。归一化后移除 ICC，确保一致显示。

### 7.2 画布自动布局算法

```
computeNextPosition(elements, maxNumPerRow=4, spacing=20):

1. 基准偏移: baseX=40, baseY=120 (为控制栏留空间)

2. 收集所有媒体元素 (image / embeddable / video)

3. 按 Y 坐标分组为"行" (垂直有重叠的元素归为同一行)

4. 检查最后一行:
   ├─ 未满 (< maxNumPerRow):
   │   x = 最右元素.x + 最右元素.width + spacing
   │   y = 该行最小 y
   └─ 已满:
       x = baseX
       y = 最后一行最大底边 + spacing
```

### 7.3 图片尺寸解析

**宽高比映射表**：

| 宽高比 | 像素尺寸 |
|--------|----------|
| `1:1` | 2048 × 2048 |
| `4:3` | 2304 × 1728 |
| `3:4` | 1728 × 2304 |
| `16:9` | 2560 × 1440 |
| `9:16` | 1440 × 2560 |
| `3:2` | 2496 × 1664 |
| `2:3` | 1664 × 2496 |
| `21:9` | 3024 × 1296 |

**解析优先级**：
1. API 预设格式 (`2K`, `4K`) → 直接使用
2. 宽高比枚举 (`16:9`) → 查表
3. 自定义格式 (`1024x1024`) → 直接解析
4. 无法解析 → 降级为 `1:1` (2048×2048)

### 7.4 图片输入处理 (图生图)

```python
def prepare_image_input(image_url: str) -> str:
    """从 MinIO 读取图片并转为 Base64 Data URL"""
    # 1. 解析 URL → 提取 MinIO 对象 key
    path = image_url.replace("http://localhost:8000/storage/", "").lstrip("/storage/")
    # 2. 从 MinIO 读取
    obj = minio_client.get_object(bucket, path)
    raw_bytes = obj.read()
    # 3. MIME 检测 (按扩展名)
    ext = Path(path).suffix.lower()
    mime = MIME_MAP.get(ext, "image/jpeg")
    # 4. Base64 编码
    return f"data:{mime};base64,{base64.b64encode(raw_bytes).decode()}"
```

支持的 MIME 映射：`.jpg/.jpeg` → `image/jpeg`，`.png` → `image/png`，`.webp` → `image/webp`，`.bmp` → `image/bmp`，`.tiff/.tif` → `image/tiff`，`.gif` → `image/gif`。

### 7.5 缩略图拼贴布局 (首页项目卡片)

| 图片数 | 网格布局 |
|--------|----------|
| 0 | 虚线框 + 文本预览或 "No Preview" |
| 1 | 1×1 全幅 |
| 2 | 2 列并排 |
| 3 | 左大右上下 (2:1 布局) |
| 4 | 2×2 四宫格 |

---

## 8. 核心数据结构

### 8.1 后端数据模型 (Pydantic / TypedDict)

#### ChatRequest

```python
class ChatRequest(BaseModel):
    message: str                          # 当前用户消息
    messages: list[Message] | None = None # 历史消息列表
    session_id: str | None = None         # 会话 ID
```

#### GenerateImageInput

```python
class GenerateImageInput(BaseModel):
    prompt: str = Field(description="图像描述（中英文）")
    size: str = Field(default="1:1", description="宽高比或像素尺寸")
```

#### EditImageInput

```python
class EditImageInput(BaseModel):
    prompt: str = Field(description="编辑指令")
    image_url: str = Field(description="源图片本地路径")
    size: str = Field(default="1:1", description="输出尺寸")
```

#### 工具返回 JSON

```python
# generate_image 返回
{
    "image_url": "/storage/images/xxx.jpg",
    "original_url": "https://cdn.volcengine.com/...",
    "local_path": "/storage/images/xxx.jpg",
    "prompt": "夕阳下的海滩",
    "provider": "volcano",
    "message": "图片已生成并保存到对象存储"
}

# edit_image 额外字段
{
    "source_image": "/storage/images/original.png",
    ...
}
```

### 8.2 ORM 模型 (SQLAlchemy)

#### Canvas

```python
class Canvas(Base):
    __tablename__ = "canvases"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    excalidraw_data: Mapped[str] = mapped_column(Text)  # LONGTEXT
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, onupdate=func.now())
```

#### Message

```python
class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    canvas_id: Mapped[str] = mapped_column(String(64), ForeignKey("canvases.id"))
    role: Mapped[str] = mapped_column(Enum("user", "assistant"))
    content: Mapped[str] = mapped_column(Text)
    post_tool_content: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_urls: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    audio_urls: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
```

#### ToolCall

```python
class ToolCall(Base):
    __tablename__ = "tool_calls"
    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    message_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("messages.id"))
    name: Mapped[str] = mapped_column(String(128))
    arguments: Mapped[dict] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(Enum("executing", "done"))
    result: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
```

#### Image

```python
class Image(Base):
    __tablename__ = "images"
    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    canvas_id: Mapped[str | None] = mapped_column(String(64), ForeignKey("canvases.id"), nullable=True)
    object_key: Mapped[str] = mapped_column(String(512))
    original_url: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    prompt: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider: Mapped[str] = mapped_column(String(64))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    mime_type: Mapped[str] = mapped_column(String(64))
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=func.now())
```

### 8.3 前端核心类型 (TypeScript)

```typescript
// SSE 事件
type SSEEvent =
  | { type: "delta"; content: string }
  | { type: "tool_call"; id: string; name: string; arguments: Record<string, unknown> }
  | { type: "tool_result"; tool_call_id: string; content: string }
  | { type: "error"; error: string }

// 画布项目
interface CanvasProject {
  id: string
  name: string
  createdAt: number
  images: string[]
  data: {
    elements: ExcalidrawElement[]
    appState: Partial<AppState>
    files: Record<string, BinaryFileData>
  }
  messages: ChatMessage[]
}

// 对话消息
interface ChatMessage {
  role: "user" | "assistant"
  content: string
  imageUrls?: string[]
  toolCalls?: ToolCallInfo[]
  postToolContent?: string
}

// 工具调用信息
interface ToolCallInfo {
  id: string
  name: string
  arguments: Record<string, unknown>
  status: "executing" | "done"
  result?: string
  imageUrl?: string
}
```

---

## 9. 存储设计

### 9.1 存储架构

```
┌─────────────────────────────────────────┐
│              MySQL 8.0                   │
│  canvases      — 画布/项目元数据          │
│  messages      — 对话消息                │
│  tool_calls    — 工具调用记录             │
│  images        — 图片元数据              │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│              MinIO                       │
│  Bucket: canvasflow                      │
│  └── images/                             │
│      ├── volcano_20250314_a1b2_sunset.jpg│ ← AI 生成图片
│      ├── upload_20250314_c3d4.jpg        │ ← 用户上传图片
│      └── ...                             │
└─────────────────────────────────────────┘
```

### 9.2 MySQL Schema

| 表 | 主键 | 关键字段 | 说明 |
|----|------|---------|------|
| `canvases` | `id VARCHAR(64)` | `name`, `excalidraw_data (LONGTEXT)`, `created_at`, `updated_at` | Excalidraw 数据存为 LONGTEXT JSON |
| `messages` | `id BIGINT AUTO_INCREMENT` | `canvas_id FK`, `role ENUM`, `content`, `image_urls JSON`, `post_tool_content` | 对话消息，支持附带图片 URL |
| `tool_calls` | `id VARCHAR(64)` | `message_id FK`, `name`, `arguments JSON`, `status ENUM`, `result`, `image_url` | 工具调用记录 |
| `images` | `id BIGINT AUTO_INCREMENT` | `canvas_id FK`, `object_key`, `original_url`, `prompt`, `provider`, `size_bytes`, `mime_type`, `width`, `height` | 图片元数据 |

**设计要点**：
- `excalidraw_data` 使用 LONGTEXT（结构复杂、频繁变化，不拆分为结构化列）
- 异步访问：SQLAlchemy AsyncSession + aiomysql
- 排序：`ORDER BY created_at DESC`
- 编码：`charset=utf8mb4`（支持中文及 Emoji）
- Schema 迁移：alembic 管理

### 9.3 MinIO 对象存储

| 分类 | 对象 Key 格式 | 访问路径 |
|------|--------------|----------|
| AI 生成图片 | `images/{provider}_{timestamp}_{uuid8}_{safe_prompt}.{ext}` | `/storage/images/volcano_20250314_a1b2c3d4_sunset_beach.jpg` |
| 用户上传图片 | `images/upload_{timestamp}_{uuid8}{ext}` | `/storage/images/upload_20250314_a1b2c3d4.jpg` |

**文件命名规则**：
- `provider`: 服务提供商标识 (如 `volcano`)
- `timestamp`: `%Y%m%d_%H%M%S` 格式
- `uuid8`: UUID 前 8 位 (防碰撞)
- `safe_prompt`: 提示词前 30 字符 (仅保留 `[a-zA-Z0-9 _-]`)
- `ext`: `.jpg` (不透明) 或 `.png` (透明)

### 9.4 Mock 模式存储降级

| 组件 | 生产模式 | Mock 模式 |
|------|---------|----------|
| 数据库 | MySQL (AsyncSession) | SQLite 内存 (`sqlite+aiosqlite://`) |
| 对象存储 | MinIO | 本地文件系统 (`storage/` 目录) |

设置 `MOCK_MODE=true` + `MOCK_IMAGE_PATH`，无需 Docker Compose 即可运行。

---

## 10. 外部依赖

### 10.1 火山引擎 Seedream 4.5 API

| 项目 | 值 |
|------|-----|
| Base URL | `https://ark.cn-beijing.volces.com/api/v3` |
| 端点 | `POST {base_url}/images/generations` |
| 认证 | `Authorization: Bearer {VOLCANO_API_KEY}` |
| 模型 | `seedream-4.5` |
| 超时 | 120 秒 |

**文生图请求**：

```json
{
  "model": "seedream-4.5",
  "prompt": "图像描述文本",
  "size": "2048x2048",
  "n": 1,
  "response_format": "url",
  "stream": false,
  "watermark": true
}
```

**图生图请求**（额外 `image` 字段）：

```json
{
  "model": "seedream-4.5",
  "prompt": "编辑指令",
  "image": "data:image/png;base64,{base64_data}",
  "size": "2048x2048",
  "response_format": "url",
  "stream": false,
  "watermark": true
}
```

**响应格式兼容解析**（三种可能格式）：

```python
# 格式1: { "data": [{ "url": "..." }] }
# 格式2: { "images": [{ "url": "..." }] }
# 格式3: { "url": "..." }
```

### 10.2 环境变量清单

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `VOLCANO_API_KEY` | 火山引擎 API Key | （必填） |
| `VOLCANO_BASE_URL` | API Base URL | `https://ark.cn-beijing.volces.com/api/v3` |
| `VOLCANO_IMAGE_MODEL` | 生图模型 | `seedream-4.5` |
| `VOLCANO_EDIT_MODEL` | 编辑模型 | 同 `VOLCANO_IMAGE_MODEL` |
| `DATABASE_URL` | MySQL 连接串 | `mysql+aiomysql://canvasflow:canvasflow_pwd@localhost:3306/canvasflow` |
| `MINIO_ENDPOINT` | MinIO 地址 | `localhost:9000` |
| `MINIO_ACCESS_KEY` | MinIO Access Key | `minioadmin` |
| `MINIO_SECRET_KEY` | MinIO Secret Key | `minio_Adm1n_S3cure!` |
| `MINIO_BUCKET` | 默认 Bucket | `canvasflow` |
| `MINIO_SECURE` | HTTPS | `false` |
| `MOCK_MODE` | Mock 开关 | `false` |
| `MOCK_IMAGE_PATH` | Mock 图片路径 | — |
| `RECURSION_LIMIT` | Agent 递归限制 | `200` |

### 10.3 本地开发环境（复用 infrastructure）

MySQL 和 MinIO 由 `../infrastructure/docker-compose.yml` 统一管理，CanvasFlow 不单独启动这些服务。

```bash
# 启动基础设施（在 infrastructure 目录下）
cd ../infrastructure
docker compose up -d   # 或 make up
```

**已有服务信息**：

| 服务 | 地址 | 凭据 |
|------|------|------|
| MySQL | `127.0.0.1:3306` | root / `zTT6RvMUbeGc3zjtQPoW` |
| MinIO API | `127.0.0.1:9000` | `minioadmin` / `minio_Adm1n_S3cure!` |
| MinIO Console | `localhost:9001` | 同上 |
| phpMyAdmin | `localhost:8080` | — |

**CanvasFlow 数据库初始化**：

需在 `../infrastructure/sql/` 下添加 `canvasflow.sql` 初始化脚本：

```sql
CREATE DATABASE IF NOT EXISTS `canvasflow`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'canvasflow'@'%' IDENTIFIED BY 'canvasflow_pwd';
GRANT ALL PRIVILEGES ON `canvasflow`.* TO 'canvasflow'@'%';
FLUSH PRIVILEGES;
```

> 若 MySQL 容器已运行，手动执行上述 SQL 或通过 phpMyAdmin 创建。

**CanvasFlow 连接配置**（`.env`）：

```env
DATABASE_URL=mysql+aiomysql://canvasflow:canvasflow_pwd@127.0.0.1:3306/canvasflow
MINIO_ENDPOINT=127.0.0.1:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minio_Adm1n_S3cure!
MINIO_BUCKET=canvasflow
MINIO_SECURE=false
```

### 10.4 待确认设计决策

| 决策项 | 说明 |
|--------|------|
| 异步 HTTP 客户端 | 使用 `httpx` 异步客户端替代同步 `requests` |
| 重试策略 | 建议添加指数退避重试 (如 `tenacity`) |
| 并发控制 | 多用户并发生图需考虑 API 速率限制 |
| 多提供商支持 | 当前仅火山引擎，可扩展 Stability AI / DALL-E 等 |
