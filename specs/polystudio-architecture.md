# PolyStudio 架构文档

> 基于 `vendors/PolyStudio` 源码的完整技术分析

---

## 目录

1. [项目概述](#1-项目概述)
2. [系统架构](#2-系统架构)
3. [技术栈](#3-技术栈)
4. [后端架构](#4-后端架构)
5. [前端架构](#5-前端架构)
6. [核心组件](#6-核心组件)
7. [关键数据流](#7-关键数据流)
8. [关键 API](#8-关键-api)
9. [AI 工具链（13 个 LangChain Tools）](#9-ai-工具链13-个-langchain-tools)
10. [LLM 抽象层](#10-llm-抽象层)
11. [提示词系统](#11-提示词系统)
12. [数据持久化](#12-数据持久化)
13. [外部服务依赖](#13-外部服务依赖)
14. [开发与调试](#14-开发与调试)
15. [目录结构](#15-目录结构)

---

## 1. 项目概述

PolyStudio 是一款 **AI 驱动的多媒体创作平台**，基于无限画布（Infinite Canvas）的交互模式，用户通过自然语言与 AI 对话，即可完成图片生成/编辑、视频生成/拼接、3D 模型生成、语音合成/克隆、播客制作、虚拟主播生成等多种多媒体创作任务。所有生成的内容自动呈现在 Excalidraw 无限画布上，实现所见即所得的创作体验。

### 核心特性

| 特性 | 描述 |
|------|------|
| AI 图片生成与编辑 | 基于火山引擎 Seedream 4.5，支持文生图、图生图编辑 |
| AI 视频生成 | 基于火山引擎 Seedance，支持文本/图片/首尾帧三种模式 |
| 3D 模型生成 | 基于腾讯云混元 3D API，支持文本和图片到 3D |
| 语音设计与克隆 | 基于阿里云 Qwen-TTS（DashScope），支持声音风格设计和声音克隆 |
| 播客制作 | 音频拼接、BGM 选取与混音，完整播客后期制作 |
| 虚拟主播/数字人 | 基于 ComfyUI 工作流，人脸检测 + 数字人视频生成 |
| 视频拼接 | 自动分辨率/帧率归一化的多视频拼接 |
| 无限画布 | 基于 Excalidraw 的可视化创作空间 |
| 实时流式响应 | SSE 实时推送 AI 思考过程、工具调用及结果 |

---

## 2. 系统架构

### 整体架构图

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React)                     │
│  ┌──────────┐  ┌───────────────┐  ┌──────────────────┐  │
│  │ HomePage │  │ChatInterface  │  │ ExcalidrawCanvas │  │
│  │(项目列表) │  │(对话+流式响应) │  │  (无限画布渲染)   │  │
│  └──────────┘  └───────┬───────┘  └────────┬─────────┘  │
│                        │SSE                 │            │
│  ┌─────────────────────┼────────────────────┘            │
│  │  Model3DViewer      │  (Three.js 3D预览)              │
│  └─────────────────────┼─────────────────────────────────┘
│                        │ HTTP / SSE
├────────────────────────┼─────────────────────────────────┤
│                     Vite Proxy                           │
│              /api → :8000    /storage → :8000            │
├────────────────────────┼─────────────────────────────────┤
│                        ▼                                 │
│                Backend (FastAPI)                          │
│  ┌─────────────────────────────────────────────────────┐ │
│  │                  API Router Layer                    │ │
│  │  /api/chat (SSE) │ /api/canvases │ /api/upload-*   │ │
│  └────────┬─────────┴───────────────┴─────────────────┘ │
│           ▼                                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │              Agent Service Layer                    │  │
│  │    LangGraph create_react_agent + 13 Tools         │  │
│  └────────┬───────────────────────────────────────────┘  │
│           ▼                                              │
│  ┌────────────────┐ ┌────────────────┐ ┌──────────────┐  │
│  │ LLM Factory    │ │Stream Processor│ │History Service│ │
│  │(Volcano/SF)    │ │(SSE Events)    │ │(JSON Files)   │ │
│  └────────────────┘ └────────────────┘ └──────────────┘  │
│           ▼                                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │                   Tools Layer                       │  │
│  │  图片生成 │ 视频生成 │ 3D生成 │ TTS │ 音频 │ 数字人  │  │
│  └────────────────────────────────────────────────────┘  │
│           ▼                                              │
│  ┌────────────────────────────────────────────────────┐  │
│  │              External AI Services                   │  │
│  │  火山引擎 │ 腾讯云 │ 阿里云DashScope │ ComfyUI      │  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 架构模式

- **前后端分离**：React SPA + FastAPI REST/SSE
- **AI Agent 模式**：LangGraph ReAct Agent（推理-行动循环）
- **工具注册模式**：所有 AI 能力封装为 `@tool` 装饰器函数，由 Agent 自主决策调用
- **流式通信**：SSE (Server-Sent Events) 实时推送
- **工厂模式**：LLM Provider 抽象，通过环境变量切换
- **命令式画布 API**：前端通过 `useImperativeHandle` 暴露画布操作接口

---

## 3. 技术栈

### 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Python | 3.10+ | 运行时 |
| FastAPI | 0.104.1 | Web 框架 |
| LangChain | - | AI 工具链框架 |
| LangGraph | 1.0.0 | AI Agent 编排 |
| langchain-openai | - | OpenAI 兼容 LLM 接入 |
| Pillow | 10.4.0 | 图片处理、sRGB 归一化 |
| moviepy | - | 视频处理与拼接 |
| opencv-python | - | 人脸检测（Haar Cascade） |
| pydub | - | 音频处理（拼接、混音） |
| volcengine SDK | - | 火山引擎图片/视频 API |
| dashscope | - | 阿里云 TTS API |
| sse-starlette | 1.8.2 | SSE 响应封装 |
| python-multipart | 0.0.6 | 文件上传 |
| uvicorn | 0.24.0 | ASGI 服务器 |

### 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18 | UI 框架 |
| TypeScript | - | 类型系统 |
| Vite | - | 构建工具与开发服务器 |
| @excalidraw/excalidraw | 0.18.0 | 无限画布 |
| @react-three/fiber | ^9.1.2 | Three.js React 绑定 |
| @react-three/drei | ^10.0.4 | Three.js 工具集 |
| three | ^0.175.0 | 3D 渲染引擎 |
| react-markdown | ^9.0.3 | Markdown 渲染 |
| react-syntax-highlighter | ^15.6.1 | 代码高亮 |
| lucide-react | ^0.477.0 | 图标库 |

---

## 4. 后端架构

### 4.1 分层结构

```
backend/app/
├── main.py              # FastAPI 应用入口
├── routers/
│   └── chat.py          # API 路由定义
├── services/
│   ├── agent_service.py # LangGraph Agent 核心
│   ├── stream_processor.py # SSE 流处理
│   ├── history_service.py  # 数据持久化
│   └── prompt.py        # 提示词管理
├── llm/
│   ├── base.py          # LLM Provider 抽象基类
│   ├── factory.py       # LLM 工厂函数
│   ├── volcano.py       # 火山引擎 Provider
│   └── siliconflow.py   # SiliconFlow Provider
├── tools/
│   ├── volcano_image_generation.py  # 图片生成/编辑
│   ├── volcano_video_generation.py  # 视频生成
│   ├── model_3d_generation.py       # 3D 模型生成
│   ├── qwen_tts.py                  # 语音设计/克隆
│   ├── audio_mixing.py              # 音频拼接/混音
│   ├── video_concatenation.py       # 视频拼接
│   └── virtual_anchor_generation.py # 虚拟主播
└── utils/
    ├── logger.py        # 日志管理
    └── face_detection.py # 人脸检测
```

### 4.2 入口 (`main.py`)

- 创建 FastAPI 实例
- 配置 CORS（允许所有来源）
- 挂载 `/storage` 静态文件目录（用于访问生成的媒体文件）
- 注册 chat router（`/api` 前缀）
- 启动时确保 `storage/` 目录存在

### 4.3 Agent 核心 (`agent_service.py`)

```python
# 使用 LangGraph 创建 ReAct Agent
agent = create_react_agent(
    model=create_llm(),      # 工厂方法创建 LLM
    tools=tools_list,         # 13 个工具
    prompt=get_full_prompt()  # 模块化提示词
)

# 流式处理聊天消息
async def process_chat_stream(messages, canvas_id):
    async for chunk in agent.astream(input, stream_mode="messages"):
        # 由 StreamProcessor 转换为 SSE 事件
```

Agent 的工作循环：
1. 接收用户消息 + 历史对话
2. LLM 推理决定下一步行动（调用工具 or 直接回复）
3. 执行工具调用
4. 将工具结果反馈给 LLM
5. 重复 2-4 直到 LLM 给出最终回复

---

## 5. 前端架构

### 5.1 组件结构

```
frontend/src/
├── main.tsx              # 应用入口
├── App.tsx               # 路由控制（HomePage / ChatInterface）
├── index.css             # 全局样式
└── components/
    ├── HomePage.tsx       # 项目列表页
    ├── HomePage.css
    ├── ChatInterface.tsx  # 主编辑页（对话 + 画布）
    ├── ChatInterface.css
    ├── ExcalidrawCanvas.tsx  # Excalidraw 画布封装
    ├── ExcalidrawCanvas.css
    ├── Model3DViewer.tsx    # 3D 模型预览
    └── Model3DViewer.css
```

### 5.2 页面路由

通过 URL 参数 `canvasId` 决定展示哪个页面：

| 路由 | 条件 | 组件 | 功能 |
|------|------|------|------|
| `/` | 无 canvasId | `HomePage` | 项目列表、搜索、创建新项目 |
| `/?canvasId=xxx` | 有 canvasId | `ChatInterface` | 主编辑页面（对话 + 画布） |

### 5.3 关键前端交互

**ChatInterface（主编辑页）**：
- 左侧对话面板：消息列表 + 输入框 + 图片/音频上传
- 右侧画布面板：Excalidraw 无限画布
- SSE 流式接收 AI 响应，实时显示：
  - `delta` 事件 → 逐字显示 AI 文本回复
  - `tool_call` 事件 → 显示工具调用名称和参数
  - `tool_result` 事件 → 解析结果，自动将媒体内容添加到画布

**ExcalidrawCanvas（画布组件）**：
- 封装 Excalidraw 组件
- 通过 `useImperativeHandle` 暴露命令式 API：
  - `addImage(url, title)` — 添加图片到画布
  - `addVideo(url, title)` — 添加视频到画布（以图标+标签形式）
  - `add3DModelPreview(modelUrl, format, mtlUrl, textureUrl, title)` — 添加 3D 模型预览
- 自动计算新元素位置，避免重叠
- 画布数据自动保存到后端

**Model3DViewer（3D 预览组件）**：
- 基于 `@react-three/fiber` + `@react-three/drei`
- 支持 OBJ（含 MTL 材质 + 纹理）和 GLB 两种格式
- 自动旋转展示
- OrbitControls 支持用户拖拽/缩放/旋转

---

## 6. 核心组件

### 6.1 StreamProcessor（流处理器）

**文件**: `backend/app/services/stream_processor.py`

负责将 LangGraph 的异步流式输出转换为前端可消费的 SSE 事件格式。

**SSE 事件类型**：

| 事件类型 | 数据格式 | 描述 |
|----------|----------|------|
| `delta` | `{"content": "..."}` | AI 文本回复的增量片段 |
| `tool_call` | `{"name": "...", "arguments": "..."}` | 工具调用信息（名称+参数） |
| `tool_result` | `{"name": "...", "content": "..."}` | 工具执行结果 |
| `error` | `{"error": "..."}` | 错误信息 |
| `[DONE]` | - | 流结束标记 |

**核心逻辑**：
- 累积 `tool_call_chunks`，因为工具调用参数可能分多个 chunk 传输
- 当检测到工具名称变化或消息类型切换时，发射完整的 `tool_call` 事件
- 解析 `ToolMessage` 提取工具执行结果

### 6.2 HistoryService（历史服务）

**文件**: `backend/app/services/history_service.py`

基于 JSON 文件的轻量级持久化方案。

**存储路径**: `backend/data/canvases/`

**数据结构**：
```json
{
  "id": "canvas-uuid",
  "title": "项目名称",
  "messages": [
    {"role": "user", "content": "..."},
    {"role": "assistant", "content": "..."}
  ],
  "canvas_data": { /* Excalidraw 画布序列化数据 */ },
  "created_at": "ISO 时间戳",
  "updated_at": "ISO 时间戳"
}
```

**特性**：
- 文件级 CRUD 操作
- JSON 解析失败时自动备份损坏文件（`.backup` 后缀）
- 支持按更新时间排序的列表查询

### 6.3 ComfyUIClient（ComfyUI 客户端）

**文件**: `backend/app/tools/virtual_anchor_generation.py`

与 ComfyUI 服务通信的客户端封装。

**核心方法**：
- `upload_file(file_path)` — 上传图片/音频文件到 ComfyUI
- `submit_workflow(workflow)` — 提交 ComfyUI 工作流
- `poll_result(prompt_id)` — 轮询工作流执行结果
- `download_result(filename)` — 下载生成的结果文件

---

## 7. 关键数据流

### 7.1 对话与内容生成流

```
用户输入消息
    ↓
ChatInterface → POST /api/chat (SSE)
    ↓
chat.py 路由 → 加载历史消息 → 调用 agent_service.process_chat_stream()
    ↓
LangGraph ReAct Agent 推理循环：
    ├─ LLM 推理 → 决定调用工具 / 直接回复
    ├─ 工具执行 → 调用外部 API（火山引擎/腾讯云/DashScope/ComfyUI）
    ├─ 工具结果 → 返回给 LLM 继续推理
    └─ 最终回复 → 生成完毕
    ↓
StreamProcessor 将每个 chunk 转换为 SSE 事件
    ↓
前端 EventSource 接收 SSE 事件：
    ├─ delta → 更新消息文本（逐字显示）
    ├─ tool_call → 显示工具调用状态
    ├─ tool_result → 解析结果 → 自动添加内容到画布
    │   ├─ 图片 → excalidrawRef.addImage(url)
    │   ├─ 视频 → excalidrawRef.addVideo(url)
    │   └─ 3D 模型 → excalidrawRef.add3DModelPreview(url, format)
    └─ [DONE] → 保存消息历史 + 画布数据
```

### 7.2 图片生成流

```
用户: "生成一张夕阳下的海滩图片"
    ↓
LLM 推理 → 调用 generate_volcano_image_tool
    ↓
构建 Seedream 4.5 API 请求 → 提交到火山引擎
    ↓
轮询任务状态（每 2 秒，最长 5 分钟）
    ↓
获取 base64 图片数据 → PIL 处理
    ↓
sRGB 色彩空间归一化（确保 <img> 和 Canvas 显示一致）
    ↓
保存到 storage/images/{uuid}.png
    ↓
返回 URL: /storage/images/{uuid}.png
    ↓
前端自动添加图片到 Excalidraw 画布
```

### 7.3 视频生成流

```
用户: "根据这张图片生成一段视频"
    ↓
LLM 推理 → 调用 generate_volcano_video_tool
    ↓
确定模式: text(文生视频) / image(图生视频) / start_end(首尾帧)
    ↓
如有本地图片路径 → 转 base64 → 构建请求
    ↓
提交到火山引擎 Seedance API
    ↓
轮询任务状态（每 10 秒，最长 30 分钟）
    ↓
获取视频 URL → 下载到 storage/videos/{uuid}.mp4
    ↓
返回本地 URL → 前端添加到画布
```

### 7.4 3D 模型生成流

```
用户: "生成一个中世纪城堡的3D模型"
    ↓
LLM 推理 → 调用 generate_3d_model_tool
    ↓
提交到腾讯云 Hunyuan 3D API（文本或图片）
    ↓
轮询任务状态
    ↓
获取 ZIP 下载链接 → 下载并解压
    ↓
提取 OBJ / MTL / 纹理文件 → 修正 MTL 中的纹理路径引用
    ↓
保存到 storage/models/{uuid}/
    ↓
返回模型文件 URL（obj_url + mtl_url + texture_url）
    ↓
前端使用 Model3DViewer 组件（Three.js）渲染 3D 预览
```

### 7.5 播客制作流

```
用户: "制作一个两人对话的播客"
    ↓
LLM 推理循环（多轮工具调用）：
    ↓
1. qwen_voice_design_tool → 设计声音A（描述性别、风格等）
    ↓
2. qwen_voice_design_tool → 设计声音B
    ↓
3. qwen_voice_design_tool × N → 为每段对话生成音频
    ↓
4. concatenate_audio_tool → 将所有音频片段拼接
    ↓
5. select_bgm_tool → 根据主题选择背景音乐
    ↓
6. mix_audio_with_bgm_tool → 混合主音频 + BGM
   ├─ 自动添加前奏（纯 BGM）
   ├─ 调节 BGM 音量为背景级
   └─ 添加淡入淡出效果
    ↓
返回最终播客文件 URL
```

### 7.6 虚拟主播生成流

```
用户: "用这张照片生成一个说话的数字人"
    ↓
LLM 推理：
    ↓
1. 人脸检测（OpenCV Haar Cascade 或 LLM 判断）
   ├─ 检查图片质量（分辨率 ≥ 256×256）
   └─ 检查人脸大小占比 ≥ 10%
    ↓
2. 上传图片/音频到 ComfyUI 服务器
    ↓
3. 构建 ComfyUI 工作流 JSON → 提交
    ↓
4. 轮询工作流执行结果
    ↓
5. 下载生成的视频 → 保存到 storage/videos/
    ↓
返回视频 URL → 前端添加到画布
```

---

## 8. 关键 API

### 8.1 后端 API 端点

| 方法 | 路径 | 描述 | 请求/响应 |
|------|------|------|-----------|
| `POST` | `/api/chat` | AI 对话（SSE 流式） | 请求: `{message, canvas_id, image_url?}` 响应: SSE 事件流 |
| `GET` | `/api/canvases` | 获取项目列表 | 响应: `[{id, title, updated_at, ...}]` |
| `POST` | `/api/canvases` | 创建新项目 | 请求: `{title}` 响应: `{id, title, ...}` |
| `GET` | `/api/canvases/{id}` | 获取项目详情 | 响应: `{id, title, messages, canvas_data}` |
| `PUT` | `/api/canvases/{id}` | 更新项目 | 请求: `{title?, canvas_data?, messages?}` |
| `DELETE` | `/api/canvases/{id}` | 删除项目 | 响应: `{success: true}` |
| `POST` | `/api/upload-image` | 上传图片 | 请求: multipart/form-data 响应: `{url, filename}` |
| `POST` | `/api/upload-audio` | 上传音频 | 请求: multipart/form-data 响应: `{url, filename}` |

### 8.2 SSE 事件协议

**连接方式**: `POST /api/chat` 返回 `text/event-stream`

**事件格式**:
```
data: {"type": "delta", "content": "你好"}

data: {"type": "tool_call", "name": "generate_volcano_image_tool", "arguments": "{\"prompt\": \"...\"}"}

data: {"type": "tool_result", "name": "generate_volcano_image_tool", "content": "图片已生成: /storage/images/xxx.png"}

data: {"type": "error", "error": "API 调用失败"}

data: [DONE]
```

### 8.3 静态资源服务

FastAPI 将 `backend/storage/` 目录挂载到 `/storage` 路径，提供生成的媒体文件访问：

| 路径 | 内容 |
|------|------|
| `/storage/images/` | AI 生成的图片（PNG） |
| `/storage/videos/` | AI 生成/拼接的视频（MP4） |
| `/storage/models/` | 3D 模型文件（OBJ/MTL/纹理） |
| `/storage/audio/` | 音频文件（WAV/MP3） |
| `/storage/uploads/` | 用户上传的文件 |
| `/storage/bgm/` | 背景音乐库 |

---

## 9. AI 工具链（13 个 LangChain Tools）

所有工具使用 LangChain 的 `@tool` 装饰器注册，由 LangGraph ReAct Agent 自主决策调用。

### 9.1 图片工具

| 工具名 | 文件 | 功能 | 外部服务 |
|--------|------|------|----------|
| `generate_volcano_image_tool` | `volcano_image_generation.py` | 文本生成图片 | 火山引擎 Seedream 4.5 |
| `edit_volcano_image_tool` | `volcano_image_generation.py` | 图片编辑（局部修改） | 火山引擎 Seedream 4.5 |

**关键特性**：
- 支持本地文件路径自动转 base64
- sRGB 色彩空间归一化（PIL ImageCms），确保 `<img>` 标签和 Canvas 渲染颜色一致
- 任务提交 + 轮询模式（2秒间隔，5分钟超时）

### 9.2 视频工具

| 工具名 | 文件 | 功能 | 外部服务 |
|--------|------|------|----------|
| `generate_volcano_video_tool` | `volcano_video_generation.py` | 视频生成（文本/图片/首尾帧） | 火山引擎 Seedance |
| `concatenate_videos_tool` | `video_concatenation.py` | 多视频拼接 | 本地 moviepy |

**视频生成模式**：
- `text` — 纯文本描述生成 4-12 秒视频
- `image` — 图片 + 文本描述生成视频
- `start_end` — 起始帧 + 结束帧生成过渡视频

**视频拼接特性**：
- 自动归一化分辨率和帧率
- 支持本地路径、localhost URL、公网 URL 三种输入
- 使用 moviepy 的 `concatenate_videoclips`

### 9.3 3D 模型工具

| 工具名 | 文件 | 功能 | 外部服务 |
|--------|------|------|----------|
| `generate_3d_model_tool` | `model_3d_generation.py` | 3D 模型生成 | 腾讯云 Hunyuan 3D |

**特性**：
- 支持文本到 3D 和图片到 3D
- 下载 ZIP → 解压 → 提取 OBJ/MTL/纹理
- 自动修正 MTL 文件中的纹理路径引用

### 9.4 语音工具

| 工具名 | 文件 | 功能 | 外部服务 |
|--------|------|------|----------|
| `qwen_voice_design_tool` | `qwen_tts.py` | 声音风格设计 + TTS | 阿里云 DashScope |
| `qwen_voice_cloning_tool` | `qwen_tts.py` | 声音克隆 + TTS | 阿里云 DashScope |

**声音设计流程**（两步）：
1. `cosyvoice-voice-design` — 根据描述创建自定义声音（性别、年龄、风格等）
2. `cosyvoice-tts` — 使用创建的声音合成语音

**声音克隆流程**（两步）：
1. `cosyvoice-clone` — 从音频样本克隆声音
2. `cosyvoice-tts` — 使用克隆声音合成语音

### 9.5 音频工具

| 工具名 | 文件 | 功能 | 外部服务 |
|--------|------|------|----------|
| `concatenate_audio_tool` | `audio_mixing.py` | 音频片段拼接 | 本地 pydub |
| `select_bgm_tool` | `audio_mixing.py` | BGM 选取 | 本地关键词匹配 |
| `mix_audio_with_bgm_tool` | `audio_mixing.py` | 主音频 + BGM 混音 | 本地 pydub |

**混音特性**：
- 可配置前奏时长（纯 BGM 播放）
- BGM 音量自动降低为背景级（默认 -15dB）
- 支持淡入淡出效果
- BGM 自动循环以覆盖主音频时长

### 9.6 虚拟主播工具

| 工具名 | 文件 | 功能 | 外部服务 |
|--------|------|------|----------|
| `detect_face_tool` | `virtual_anchor_generation.py` | 人脸检测与验证 | 本地 OpenCV / LLM |
| `generate_virtual_anchor_tool` | `virtual_anchor_generation.py` | 虚拟主播视频生成 | ComfyUI |

**人脸检测策略**：
1. 优先使用 OpenCV Haar Cascade 级联分类器
2. 降级使用 LLM 视觉能力判断图片中是否包含人脸
3. 质量检查：图片分辨率 ≥ 256×256，人脸面积占比 ≥ 10%

---

## 10. LLM 抽象层

### 架构

```
BaseLLMProvider (抽象基类)
├── VolcanoLLMProvider  (火山引擎)
└── SiliconFlowLLMProvider (SiliconFlow)
```

### 工厂函数

```python
# factory.py
def create_llm() -> BaseLLMProvider:
    provider = os.getenv("LLM_PROVIDER", "volcano")
    if provider == "volcano":
        return VolcanoLLMProvider()
    elif provider == "siliconflow":
        return SiliconFlowLLMProvider()
```

### Provider 实现

**VolcanoLLMProvider**:
- 使用 `ChatOpenAI` 接入火山引擎的 OpenAI 兼容 API
- 支持 thinking mode（通过 `extra_body` 传递思维链参数）
- 默认模型: `doubao-seed-1.6-thinking-250515`（字节豆包）
- API Base: `https://ark.cn-beijing.volces.com/api/v3`

**SiliconFlowLLMProvider**:
- 使用 `ChatOpenAI` 接入 SiliconFlow API
- 默认模型: `deepseek-ai/DeepSeek-V3.1-Terminus`
- API Base: `https://api.siliconflow.cn/v1`

### 环境变量配置

| 变量名 | 描述 | Provider |
|--------|------|----------|
| `LLM_PROVIDER` | Provider 选择 (`volcano` / `siliconflow`) | 全局 |
| `VOLCANO_API_KEY` | 火山引擎 API Key | Volcano |
| `VOLCANO_BASE_URL` | 火山引擎 API Base URL | Volcano |
| `VOLCANO_MODEL_NAME` | 模型名称 | Volcano |
| `SILICONFLOW_API_KEY` | SiliconFlow API Key | SiliconFlow |

---

## 11. 提示词系统

**文件**: `backend/app/services/prompt.py`

采用模块化提示词设计，由主提示词 + 多个子工作流提示词组合而成。

### 提示词组成

| 提示词 | 描述 |
|--------|------|
| `SYSTEM_PROMPT` | 主系统提示词 — 定义 AI 角色、能力范围、交互规则 |
| `VIDEO_PROMPT` | 视频制作工作流子提示词 — 视频生成最佳实践 |
| `DIGITAL_PROMPT` | 数字人工作流子提示词 — 虚拟主播生成流程 |
| `AUDIO_PROMPT` | 音频/播客工作流子提示词 — 播客制作全流程 |

### 动态占位符

```python
def get_full_prompt():
    full_prompt = SYSTEM_PROMPT
    full_prompt = full_prompt.replace("{tools_list_text}", tools_description)
    full_prompt = full_prompt.replace("{workflows}", combined_workflows)
    return full_prompt
```

- `{tools_list_text}` — 替换为所有工具的名称和描述列表
- `{workflows}` — 替换为合并后的子工作流提示词

---

## 12. 数据持久化

### 存储方案

PolyStudio 使用 **JSON 文件** 作为轻量级持久化方案（无数据库依赖）。

### 存储目录结构

```
backend/
├── data/
│   └── canvases/
│       ├── {canvas-id-1}.json
│       ├── {canvas-id-2}.json
│       └── ...
└── storage/
    ├── images/       # 生成的图片
    ├── videos/       # 生成的视频
    ├── models/       # 3D 模型文件
    ├── audio/        # 音频文件
    ├── uploads/      # 用户上传
    └── bgm/          # 背景音乐库
```

### Canvas 数据模型

每个项目（Canvas）对应一个 JSON 文件，包含：
- **元数据**: id, title, created_at, updated_at
- **对话历史**: messages 数组（role + content）
- **画布状态**: canvas_data（Excalidraw 序列化数据，包含所有元素位置、样式等）

---

## 13. 外部服务依赖

| 服务 | 提供商 | 用途 | 环境变量 |
|------|--------|------|----------|
| Seedream 4.5 | 火山引擎 | 图片生成/编辑 | `VOLCANO_API_KEY` |
| Seedance | 火山引擎 | 视频生成 | `VOLCANO_API_KEY` |
| Hunyuan 3D | 腾讯云 | 3D 模型生成 | `TENCENT_AI3D_API_KEY`, `TENCENT_AI3D_API_SECRET` |
| CosyVoice (Qwen-TTS) | 阿里云 DashScope | 语音设计/克隆/合成 | `DASHSCOPE_API_KEY` |
| ComfyUI | 自部署 | 虚拟主播/数字人生成 | `COMFYUI_SERVER_ADDRESS` |
| 豆包/DeepSeek | 火山引擎/SiliconFlow | LLM 对话与推理 | `VOLCANO_API_KEY` / `SILICONFLOW_API_KEY` |

---

## 14. 开发与调试

### Mock 模式

通过设置 `MOCK_MODE=true` 启用，所有工具返回预设的 mock 数据而非调用真实 API，适用于：
- 无 API Key 时的本地开发
- 前端界面联调
- CI/CD 流程

### 日志系统

**文件**: `backend/app/utils/logger.py`

- 三输出通道：控制台 + 文件 + 错误文件
- 文件日志使用 `RotatingFileHandler`（自动轮转）
- 统一日志格式：`时间 | 级别 | 模块:行号 | 消息`

### 开发启动

```bash
# 后端
cd backend
pip install -r requirements.txt
cp env.example .env  # 配置环境变量
uvicorn app.main:app --reload --port 8000

# 前端
cd frontend
npm install
npm run dev  # Vite dev server on port 3000
```

### Vite 代理配置

前端开发服务器（端口 3000）将以下路径代理到后端（端口 8000）：
- `/api/*` → `http://localhost:8000`
- `/storage/*` → `http://localhost:8000`

---

## 15. 目录结构

```
vendors/PolyStudio/
├── README.md
├── backend/
│   ├── FRAMEWORK.md           # 后端架构文档
│   ├── requirements.txt       # Python 依赖
│   ├── env.example            # 环境变量模板
│   ├── app/
│   │   ├── main.py            # FastAPI 入口
│   │   ├── routers/
│   │   │   └── chat.py        # API 路由
│   │   ├── services/
│   │   │   ├── agent_service.py    # LangGraph Agent
│   │   │   ├── stream_processor.py # SSE 流处理
│   │   │   ├── history_service.py  # 数据持久化
│   │   │   └── prompt.py           # 提示词系统
│   │   ├── llm/
│   │   │   ├── base.py        # Provider 抽象基类
│   │   │   ├── factory.py     # LLM 工厂函数
│   │   │   ├── volcano.py     # 火山引擎 Provider
│   │   │   └── siliconflow.py # SiliconFlow Provider
│   │   ├── tools/
│   │   │   ├── volcano_image_generation.py
│   │   │   ├── volcano_video_generation.py
│   │   │   ├── model_3d_generation.py
│   │   │   ├── qwen_tts.py
│   │   │   ├── audio_mixing.py
│   │   │   ├── video_concatenation.py
│   │   │   └── virtual_anchor_generation.py
│   │   └── utils/
│   │       ├── logger.py
│   │       └── face_detection.py
│   ├── data/                  # 运行时数据
│   └── storage/               # 生成的媒体文件
└── frontend/
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── index.css
        └── components/
            ├── HomePage.tsx
            ├── ChatInterface.tsx
            ├── ExcalidrawCanvas.tsx
            └── Model3DViewer.tsx
```
