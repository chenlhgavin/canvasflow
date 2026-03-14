# CanvasFlow 图片生成技术规范

> 基于 PolyStudio 图片生成模块提取，适配 CanvasFlow 项目

---

## 1. 能力概述

| 能力 | 描述 | 来源 |
|------|------|------|
| 文生图 (Text-to-Image) | 根据文本提示词生成图片 | 火山引擎 Seedream 4.5 API |
| 图生图编辑 (Image Editing) | 基于已有图片 + 提示词生成新图片（保持角色/场景一致性） | 火山引擎 Seedream 4.5 API |

---

## 2. 技术栈

### 2.1 后端

| 技术 | 版本 | 用途 |
|------|------|------|
| Python | 3.10+ | 运行时 |
| FastAPI | 0.104+ | Web 框架，提供 REST API 和 SSE 流式响应 |
| LangChain | - | AI 工具链框架，`@tool` 装饰器注册图片生成工具 |
| LangGraph | 1.0+ | AI Agent 编排，ReAct 推理-行动循环驱动工具调用 |
| langchain-openai | - | OpenAI 兼容协议接入 LLM（火山引擎/SiliconFlow） |
| Pillow | 10.4+ | 图片解析、sRGB 色彩归一化、格式转换（JPEG/PNG） |
| requests / httpx | - | HTTP 客户端，调用火山引擎 API 及下载生成图片 |
| pydantic | 2.x | 工具参数校验（`BaseModel` + `Field` 定义输入 schema） |
| python-dotenv | - | `.env` 环境变量加载（API Key 等敏感配置） |
| sse-starlette | 1.8+ | SSE 响应封装，实时推送工具调用状态和结果 |
| python-multipart | 0.0.6+ | 文件上传（用户上传图片用于图生图编辑） |
| uvicorn | 0.24+ | ASGI 服务器 |
| SQLAlchemy | 2.x | ORM，MySQL 数据库访问（AsyncSession） |
| aiomysql | - | SQLAlchemy 异步 MySQL 驱动 |
| alembic | - | 数据库 Schema 迁移管理 |
| minio | 7.x | MinIO Python SDK，对象存储读写 |

### 2.2 前端

| 技术 | 版本 | 用途 |
|------|------|------|
| React | 18 | UI 框架 |
| TypeScript | - | 类型系统 |
| Vite | - | 构建工具 & 开发服务器（代理 `/api` `/storage` 到后端） |
| @excalidraw/excalidraw | 0.18+ | 无限画布，生成的图片自动添加到画布展示 |
| react-markdown | 9.x | AI 回复中 Markdown 文本渲染 |
| lucide-react | - | UI 图标 |

### 2.3 前后端协作要点

| 环节 | 技术方案 |
|------|----------|
| 通信协议 | SSE (Server-Sent Events)，`POST /api/chat` 返回 `text/event-stream` |
| 图片展示 | 后端保存到 MinIO 对象存储，通过 `/storage/*` 代理路由访问（前端 URL 不变） |
| 画布集成 | 前端 `ExcalidrawCanvas` 通过 `useImperativeHandle` 暴露 `addImage(url, title)` 命令式 API |
| 图片上传 | `POST /api/upload-image`（multipart/form-data），用于图生图编辑的源图输入 |
| Vite 代理 | 开发环境 `/api/*` → `:8000`，`/storage/*` → `:8000` |
| SSE 事件类型 | `tool_call`（工具调用中）→ `tool_result`（解析 `image_url` 字段）→ 触发 `addImage()` |

---

## 3. 前端 UI/UX 设计

### 3.1 页面路由

通过 URL 参数 `canvasId` 控制页面切换（无需 React Router）：

```
App.tsx
├─ canvasId 为空  → <HomePage />      首页（项目列表 + 创建入口）
└─ canvasId 存在  → <ChatInterface /> 主编辑页（对话 + 画布）
```

| 路由 | 示例 URL | 页面 |
|------|----------|------|
| 首页 | `/` | HomePage — 项目列表、搜索、快速创建 |
| 编辑页 | `/?canvasId=canvas-1710000000` | ChatInterface — 对话面板 + 无限画布 |

导航方式：`window.history.pushState` + `PopStateEvent`，SPA 内前进/后退。

主题通过 `document.documentElement.dataset.theme` 设置，`localStorage` 持久化，默认深色。

### 3.2 首页设计（HomePage）

#### 整体布局

```
┌─────────────────────────────────────────────────────────────┐
│  ┌───────────────┐                              ┌─────────┐│
│  │ Logo + 标题    │                              │ 亮/暗色  ││
│  │ 创意不止于画布  │                              │  切换    ││
│  └───────────────┘                              └─────────┘│
│                                                             │
│        从问题开始，进入画板创作                                │ ← Hero 标题
│        输入你的想法，我们会为你创建一个项目...                   │    (40px)
│                                                             │
│    ┌─────────────────────────────────────────────────────┐  │
│    │ ┌────┐ ┌────┐                                      │  │ ← 已上传图片
│    │ │img1│ │img2│   (60×60 缩略图, 可删除)               │  │    预览区
│    │ └────┘ └────┘                                      │  │
│    │ [📎] [  例如：生成一套12生肖...               ] │  │ ← 输入行
│    │ 按回车键或点击右侧按钮...           [开始 →]    │  │ ← 底栏
│    └─────────────────────────────────────────────────────┘  │
│                                                             │
│    ┌─ 历史项目 ──────────────────────── [🔍 搜索] ─┐       │
│    │ ┌──────────┐  ┌──────────┐  ┌──────────┐      │       │
│    │ │ 缩略图拼贴 │  │ 缩略图拼贴 │  │ 文本预览   │      │       │ ← 3列网格
│    │ │          │  │          │  │          │      │       │
│    │ ├──────────┤  ├──────────┤  ├──────────┤      │       │
│    │ │ 项目名    │  │ 项目名    │  │ 项目名    │      │       │
│    │ │ 预览文本  │  │ 预览文本  │  │ 预览文本  │      │       │
│    │ │ 🕐 时间  N张│ │ 🕐 时间  N张│ │ 🕐 时间  N张│      │       │
│    │ └──────────┘  └──────────┘  └──────────┘      │       │
│    └───────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

#### 背景效果

四色径向渐变光斑 + 高斯模糊，营造深邃科技感：

```css
.home__bg {
  position: absolute;
  inset: -200px;
  background:
    radial-gradient(600px 400px at 15% 10%, rgba(37,99,235,0.45), transparent 60%),   /* 蓝 */
    radial-gradient(600px 400px at 85% 20%, rgba(168,85,247,0.35), transparent 55%),  /* 紫 */
    radial-gradient(700px 500px at 40% 90%, rgba(16,185,129,0.22), transparent 60%),  /* 绿 */
    radial-gradient(900px 600px at 70% 80%, rgba(244,63,94,0.18), transparent 55%);   /* 红 */
  filter: blur(24px);
  pointer-events: none;
}
```

#### Prompt 输入卡片

**视觉**：半透明卡片，圆角 18px，投影深远

```css
.home__promptCard {
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.14);
  border-radius: 18px;
  padding: 14px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.35);
}
```

**交互流程**：

1. 用户在输入框输入文本（`<textarea rows={3}>`，支持多行）
2. 可点击📎上传图片/音频，预览显示在输入框上方（60×60 缩略图）
3. 支持粘贴图片（`onPaste` 拦截 clipboard 中的图片并自动上传）
4. **Enter** 键或点击"开始"按钮触发创建（Shift+Enter 换行）
5. 创建项目 → `sessionStorage` 存储 pending prompt → URL 添加 `canvasId` → 跳转到编辑页
6. 编辑页自动读取 pending prompt 并发送给 AI

**"开始"按钮**：蓝紫渐变，与用户消息气泡风格一致

```css
.home__btn--primary {
  background: linear-gradient(135deg, rgba(37,99,235,0.95), rgba(168,85,247,0.85));
  color: #fff;
}
```

#### 项目卡片网格

**布局**：`grid-template-columns: repeat(3, minmax(0, 1fr))`，间距 14px

**卡片结构**（每张 `home__card`）：

| 区域 | 高度 | 内容 |
|------|------|------|
| 缩略图区 | 170px | 拼贴预览（最多 4 张图）或文本预览 |
| 信息区 | 自适应 | 项目名 + 预览文本 + 时间/图片数 chips |

**缩略图拼贴布局**（根据图片数量自适应）：

| 图片数 | 网格布局 |
|--------|----------|
| 1 | 1×1 全幅 |
| 2 | 2 列并排 |
| 3 | 左大右上下（2:1 布局） |
| 4 | 2×2 四宫格 |
| 0 | 虚线框 + 文本预览或 "No Preview" |

**交互效果**：

```css
.home__card:hover {
  transform: translateY(-2px);         /* 微上浮 */
  border-color: rgba(255,255,255,0.22); /* 边框增亮 */
  background: rgba(255,255,255,0.08);   /* 底色增亮 */
}
```

**删除按钮**：hover 卡片时右下角渐显 🗑️，`opacity: 0 → 1`，点击弹出 `confirm` 确认。

**骨架屏加载**：6 个骨架卡片 + shimmer 动画

```css
@keyframes shimmer {
  to { transform: translateX(60%); }
}
.home__card--skeleton::after {
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent);
  animation: shimmer 1.2s infinite;
}
```

#### 搜索过滤

- 右上角搜索框，实时过滤（`useMemo` 前端筛选）
- 按项目名或 ID 模糊匹配
- 结果为空时显示虚线提示框

#### 响应式断点

| 断点 | 网格列数 | 其他调整 |
|------|----------|----------|
| > 1020px | 3 列 | — |
| 640px - 1020px | 2 列 | 搜索框缩窄 |
| < 640px | 1 列 | 标题缩小 30px，搜索框全宽，列表头纵向堆叠 |

### 3.3 编辑页整体布局

```
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────┐                                                │
│  │ 控制栏   │           Excalidraw 无限画布                    │
│  │ (返回/   │          (全屏，z-index: 0)                     │
│  │  历史)   │                                                │
│  └─────────┘     ┌──────────────┐                           │
│                  │  生成的图片1   │                           │
│                  │  (白底板+图片) │  ┌──────────────┐         │
│                  └──────────────┘  │  生成的图片2   │         │
│                                    └──────────────┘    ┌────────────┐
│                                                        │  对话面板   │
│                                                        │  (380px)   │
│                                                        │  右侧浮动   │
│                                                        │  z-index:  │
│                                                        │  100       │
│                                                        └────────────┘
│                                                   ┌──┐  │
│                                                   │💬│  │  ← 悬浮按钮
│                                                   └──┘  │    (收起时)
└─────────────────────────────────────────────────────────────┘
```

- **画布全屏**：Excalidraw 占据整个视口，`position: absolute; inset: 0`
- **对话面板浮动**：右侧 380px 宽的玻璃拟态面板，可收起/展开
- **控制栏**：左上角控制按钮组（返回、历史记录下拉）

### 3.4 对话面板（Chat Panel）

**视觉风格**：玻璃拟态 (Glassmorphism)

```css
/* 深色模式 */
background: linear-gradient(180deg, rgba(15,23,42,0.92), rgba(2,6,23,0.90));
backdrop-filter: blur(12px);
border: 1px solid rgba(255,255,255,0.14);
box-shadow: 0 18px 45px rgba(0,0,0,0.55),
            0 0 90px rgba(37,99,235,0.16),    /* 蓝色辉光 */
            0 0 110px rgba(168,85,247,0.12);   /* 紫色辉光 */
border-radius: 1rem;

/* 浅色模式 */
background: linear-gradient(180deg, rgba(255,255,255,0.92), rgba(248,250,252,0.92));
```

**结构分区**：

| 区域 | 描述 |
|------|------|
| Header | 标题 + 关闭按钮 |
| Messages | 可滚动消息列表 |
| Input | 图片上传预览 + 文本输入 + 发送按钮 |

**收起/展开动画**：

```css
/* 展开（默认） */
.chat-panel { transition: transform 0.4s cubic-bezier(0.16,1,0.3,1), opacity 0.3s; }

/* 收起 → 右滑出屏 */
.chat-panel.collapsed { transform: translateX(calc(100% + 40px)); opacity: 0; }
```

收起时显示右下角悬浮圆形按钮（48px），hover 时高亮为主题色。

### 3.5 消息气泡

**用户消息**（右对齐）：

```css
/* 深色：蓝紫渐变 */
background: linear-gradient(135deg, rgba(37,99,235,0.95), rgba(168,85,247,0.82));
color: white;
border-bottom-right-radius: 0.25rem; /* 尖角效果 */

/* 浅色：淡蓝底色 */
background: rgba(37,99,235,0.12);
color: rgba(15,23,42,0.95);
```

**AI 消息**（左对齐）：

```css
background: rgba(255,255,255,0.04);
border: 1px solid rgba(255,255,255,0.10);
border-bottom-left-radius: 0.25rem; /* 尖角效果 */
```

**消息入场动画**：

```css
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### 3.6 工具调用状态指示器

图片生成过程中，AI 消息内嵌显示工具调用状态：

```
┌─ ● 生成图像 ▸ ─┐     ← 执行中：蓝色脉冲圆点 + 呼吸边框动画
└────────────────┘

┌─ ● 生成图像 ▾ ─┐     ← 完成：绿色实心圆点，可点击展开详情
├────────────────┤
│ 输入参数         │     ← 展开后显示 JSON 参数和结果
│ { "prompt": ... }│
│ 执行结果         │
│ { "image_url":..}│
└────────────────┘
```

**执行中动画**：

```css
/* 蓝色脉冲圆点 */
@keyframes pulse-dot {
  0%   { transform: scale(0.8); opacity: 0.5; }
  50%  { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(0.8); opacity: 0.5; }
}

/* 呼吸边框 */
@keyframes breathing {
  0%   { box-shadow: 0 0 0 0 rgba(59,130,246,0.1); border-color: #93c5fd; }
  50%  { box-shadow: 0 0 0 4px rgba(59,130,246,0.15); border-color: #60a5fa; }
  100% { box-shadow: 0 0 0 0 rgba(59,130,246,0.1); border-color: #93c5fd; }
}
```

**状态颜色**：

| 状态 | 圆点颜色 | 边框 |
|------|----------|------|
| `executing` | `#3b82f6`（蓝色脉冲） | 蓝色呼吸动画 |
| `done` | `#10b981`（绿色实心） | 静态 |

**工具名称映射**（对用户友好）：

| 工具 ID | 显示名称 |
|---------|---------|
| `generate_volcano_image` | 生成图像 |
| `edit_volcano_image` | 编辑图像 |

### 3.7 生成图片的展示

**对话面板内展示**：

图片在工具调用状态块之后、AI 后续文本之前内联展示：

```
AI消息结构:
├─ 前置文本（AI 说明）
├─ 工具调用状态 [ ● 生成图像 ▾ ]
├─ 生成的图片（内联 <img>）          ← 关键位置
├─ 后续文本（AI 总结）
└─ 打字机光标（流式中）
```

图片样式：

```css
.message-image {
  border-radius: 0.5rem;
  overflow: hidden;
  width: 100%;
}
.message-image img {
  width: 100%;
  height: auto;
  max-height: 400px;
  object-fit: contain;   /* 不裁切，完整展示 */
}
```

**画布上展示**：

生成的图片通过 `addImage()` 自动添加到 Excalidraw 画布，包含两层元素：

| 层 | 类型 | 作用 |
|----|------|------|
| 底层 | `rectangle`（白色填充） | 白底板，避免深色画布背景影响图片观感 |
| 上层 | `image` | 实际图片元素 |

图片缩放规则：
- 最大宽度 `maxW = 300px`
- 按比例缩放：`scale = Math.min(1, 300 / naturalWidth)`
- 最小尺寸保底：`Math.max(32, width * scale)`

### 3.8 画布自动布局算法

新图片添加到画布时，自动计算放置位置，避免重叠：

```
算法：computeNextPosition(elements, maxNumPerRow=4, spacing=20)

1. 基准偏移: baseX=40, baseY=120（为左上角控制栏留出空间）

2. 收集所有媒体元素（image / embeddable / video）

3. 按 Y 坐标分组为"行"（垂直有重叠的元素归为同一行）

4. 检查最后一行:
   ├─ 未满（< maxNumPerRow）→ 放在最后一行右侧
   │   x = 最右元素.x + 最右元素.width + spacing
   │   y = 该行最小 y
   └─ 已满 → 换行
       x = baseX
       y = 最后一行最大底边 + spacing
```

### 3.9 图片上传交互（图生图场景）

用户可上传图片作为编辑源图：

```
┌─ 输入区域 ──────────────────────────────────┐
│ ┌──────┐ ┌──────┐                           │  ← 已上传图片预览
│ │ 图片1 │ │ 图片2 │   (80x80, object-fit:    │     (带 X 删除按钮)
│ │  [X]  │ │  [X]  │    cover, 可滚动)        │
│ └──────┘ └──────┘                           │
├─────────────────────────────────────────────┤
│ [📎] [  请描述你想要的画面...  ] [➤]         │  ← 上传+输入+发送
└─────────────────────────────────────────────┘
```

- 点击📎按钮触发 `<input type="file" accept="image/*,audio/*">`
- 上传通过 `POST /api/upload-image`（multipart/form-data）
- 上传成功后显示缩略图预览（80×80 圆角方块）
- 每个预览图右上角有删除按钮（红色 hover 效果）
- 发送消息时 `imageUrls` 字段携带已上传图片的 URL 列表

### 3.10 SSE 流式体验

生图过程中的实时反馈时序：

```
时间轴 →

[发送消息] ──→ [AI思考中...打字机光标闪烁]
                    │
                    ├─ delta 事件 → 逐字显示 AI 文本
                    │   "好的，我来为你生成一张..."
                    │
                    ├─ tool_call 事件 → 显示工具状态卡片
                    │   [ ● 生成图像 ] ← 蓝色脉冲动画
                    │
                    │   ... 等待 API 返回（可能数秒到数十秒）...
                    │
                    ├─ tool_result 事件 → 多项同步操作：
                    │   ├─ 状态变绿 [ ● 生成图像 ✓ ]
                    │   ├─ 对话内嵌展示图片 <img>
                    │   └─ 画布自动添加图片 addImage()
                    │
                    ├─ delta 事件 → AI 后续文本
                    │   "图片已生成，画布上可以查看..."
                    │
                    └─ [DONE] → 流结束，保存消息历史 + 画布数据
```

### 3.11 暗色/亮色主题

通过 `data-theme` 属性切换，CSS 变量驱动：

| 变量 | 暗色模式 | 亮色模式 |
|------|---------|---------|
| `--bg-color` | `#070a12` | `#f8fafc` |
| `--panel-bg` | `rgba(15,23,42,0.92)` | `rgba(255,255,255,0.88)` |
| `--text-primary` | `rgba(229,231,235,0.95)` | `rgba(15,23,42,0.96)` |
| `--text-secondary` | `rgba(229,231,235,0.65)` | `rgba(15,23,42,0.64)` |
| `--border-color` | `rgba(255,255,255,0.12)` | `rgba(15,23,42,0.12)` |
| `--primary-color` | `#2563eb` | `#2563eb` |

### 3.12 响应式适配

```css
@media (max-width: 768px) {
  .chat-panel {
    width: 100%;              /* 全宽 */
    height: 80vh;             /* 占 80% 高度 */
    bottom: 0;
    border-radius: 1.5rem 1.5rem 0 0;  /* 底部抽屉形态 */
  }
  .chat-panel.collapsed {
    transform: translateY(100%);  /* 向下滑出 */
  }
}
```

移动端从右侧浮动面板变为底部抽屉式。

---

## 4. 后端 API 接口设计

### 4.1 应用入口（main.py）

```python
app = FastAPI(title="CanvasFlow API", version="1.0.0")

# CORS — 开发环境允许所有来源
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

# 路由注册
app.include_router(chat.router, prefix="/api", tags=["chat"])
app.include_router(storage.router)  # /storage/* MinIO 代理路由
```

**启动事件**：初始化 MySQL 连接池和 MinIO Bucket

```python
@app.on_event("startup")
async def startup():
    # 1. 创建 SQLAlchemy AsyncEngine / AsyncSession
    engine = create_async_engine(settings.DATABASE_URL, pool_size=10, max_overflow=20)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)   # 开发环境自动建表

    # 2. 确保 MinIO bucket 存在
    if not minio_client.bucket_exists(settings.MINIO_BUCKET):
        minio_client.make_bucket(settings.MINIO_BUCKET)
```

**MinIO 代理路由**（保持前端 URL 兼容）：

```python
@router.get("/storage/{path:path}")
async def serve_storage(path: str):
    """从 MinIO 流式读取对象，返回给前端（URL 格式与旧版 StaticFiles 完全一致）"""
    obj = minio_client.get_object(settings.MINIO_BUCKET, path)
    return StreamingResponse(obj, media_type=guess_type(path)[0] or "application/octet-stream")
```

### 4.2 API 端点总览

| 方法 | 路径 | 功能 | 请求体 / 参数 | 响应 |
|------|------|------|---------------|------|
| `GET` | `/` | 健康检查 | — | `{"message":"CanvasFlow API","status":"running"}` |
| `GET` | `/health` | 健康检查 | — | `{"status":"ok"}` |
| `POST` | `/api/chat` | AI 对话（SSE 流式） | `ChatRequest` JSON | `text/event-stream` |
| `GET` | `/api/canvases` | 获取所有项目列表 | — | `CanvasSummary[]` |
| `POST` | `/api/canvases` | 创建/更新项目 | 原始 JSON | 保存后的项目 JSON |
| `DELETE` | `/api/canvases/{canvas_id}` | 删除项目 | path 参数 | `{"success":true}` |
| `POST` | `/api/upload-image` | 上传图片 | `multipart/form-data` | `{"url":"...","filename":"..."}` |

### 4.3 对话接口 — `POST /api/chat`

这是图片生成的核心入口，用户消息经过 LLM 推理后自动调用生图工具。

**请求体**：

```typescript
interface ChatRequest {
  message: string                // 当前用户消息
  messages?: Message[]           // 历史消息列表（可选）
  session_id?: string            // 会话 ID（可选）
}

interface Message {
  role: "user" | "assistant"
  content: string
}
```

**响应**：`Content-Type: text/event-stream; charset=utf-8`

```
Cache-Control: no-cache
Connection: keep-alive
X-Accel-Buffering: no          ← 禁止 Nginx 缓冲，确保流式传输
```

**SSE 事件协议**：

```
data: {"type":"delta","content":"好的，我来为你生成"}       ← AI 文本增量
data: {"type":"delta","content":"一张夕阳海滩..."}

data: {"type":"tool_call","id":"call_abc123",               ← 工具调用开始
       "name":"generate_volcano_image",
       "arguments":{"prompt":"夕阳下的海滩","size":"16:9"}}

data: {"type":"tool_result","tool_call_id":"call_abc123",   ← 工具执行结果
       "content":"{\"image_url\":\"/storage/images/xxx.jpg\",
                   \"prompt\":\"夕阳下的海滩\",
                   \"provider\":\"volcano\",
                   \"message\":\"图片已生成并保存到对象存储\"}"}

data: {"type":"delta","content":"图片已生成完毕..."}        ← AI 后续文本

data: {"type":"error","error":"API 调用失败: ..."}          ← 错误（异常时）

data: [DONE]                                                ← 流结束标记
```

**SSE 事件类型详解**：

| 事件类型 | 数据字段 | 触发时机 | 前端处理 |
|----------|---------|---------|---------|
| `delta` | `content: string` | LLM 生成文本时（逐 token） | 追加到消息文本，打字机效果 |
| `tool_call` | `id, name, arguments` | Agent 决定调用工具时 | 显示工具状态卡片（蓝色脉冲） |
| `tool_result` | `tool_call_id, content` | 工具执行完成时 | 解析 JSON，提取 `image_url`，触发画布 `addImage()` |
| `error` | `error: string` | 异常时 | 显示错误提示 |
| `[DONE]` | — | 流结束 | 保存消息历史和画布数据 |

**StreamProcessor 核心机制**：

```
LangGraph agent.astream(messages, stream_mode="messages")
    ↓
StreamProcessor._handle_chunk(chunk)
    ├─ AIMessageChunk.content → 发射 delta 事件
    ├─ AIMessageChunk.tool_calls → 累积参数 → 发射 tool_call 事件
    ├─ AIMessageChunk.tool_call_chunks → 增量拼接参数 JSON → 参数完整时发射 tool_call
    └─ ToolMessage → 发射 tool_result 事件
```

关键实现细节：
- **参数流式累积**：工具调用参数可能分多个 chunk 传输，`StreamProcessor` 维护 `tool_call_args_buffer` 逐段拼接 JSON 字符串，解析成功后才发射事件
- **递归限制**：`recursion_limit` 默认 200（环境变量 `RECURSION_LIMIT`），生成多张图时 LLM 多轮推理需要足够步数
- **客户端断开检测**：捕获 `ConnectionError` / `BrokenPipeError`，停止 Agent 处理，避免资源浪费

### 4.4 项目管理接口

#### `GET /api/canvases` — 获取项目列表

**响应示例**：

```json
[
  {
    "id": "canvas-1710000000",
    "name": "项目：夕阳海滩",
    "createdAt": 1710000000000,
    "images": [],
    "data": {
      "elements": [...],
      "appState": {...},
      "files": { "im_abc": { "dataURL": "...", "mimeType": "image/jpeg", "created": ... } }
    },
    "messages": [
      { "role": "user", "content": "生成一张夕阳海滩" },
      { "role": "assistant", "content": "好的...", "toolCalls": [...] }
    ]
  }
]
```

#### `POST /api/canvases` — 创建/更新项目

**请求体**：原始 JSON（不用 Pydantic 校验，避免 Excalidraw 复杂数据结构的字段丢失）

```json
{
  "id": "canvas-1710000000",
  "name": "项目名称",
  "createdAt": 1710000000000,
  "data": { "elements": [], "appState": {}, "files": {} },
  "messages": []
}
```

逻辑：按 `id` 查找，存在则更新，不存在则插入列表头部（新项目排前面）。

#### `DELETE /api/canvases/{canvas_id}` — 删除项目

**响应**：`{ "success": true }`

### 4.5 图片上传接口 — `POST /api/upload-image`

用于图生图编辑场景：用户上传源图片。

**请求**：`Content-Type: multipart/form-data`

| 字段 | 类型 | 描述 |
|------|------|------|
| `file` | `UploadFile` | 图片文件（必填） |

**校验**：`content_type` 必须以 `image/` 开头，否则返回 `400`。

**文件存储**：上传文件写入 MinIO `canvasflow` bucket，元数据写入 MySQL `images` 表。

```
MinIO 对象 Key: images/upload_{timestamp}_{uuid8}{ext}
```

示例：`images/upload_20250314_a1b2c3d4.jpg`

```python
# 写入 MinIO
object_key = f"images/upload_{timestamp}_{uuid8}{ext}"
minio_client.put_object(bucket, object_key, file_data, length=file_size, content_type=content_type)

# 写入 MySQL images 表
image = Image(canvas_id=canvas_id, object_key=object_key, size_bytes=file_size,
              mime_type=content_type, provider="upload")
session.add(image)
await session.commit()
```

**响应**（格式不变）：

```json
{
  "url": "/storage/images/upload_20250314_a1b2c3d4.jpg",
  "filename": "upload_20250314_a1b2c3d4.jpg"
}
```

前端拿到 `url` 后用于：
1. 输入区显示缩略图预览
2. 发送消息时作为 `imageUrls` 字段传递
3. 后端生图工具中通过 `prepare_image_input()` 从 MinIO 读取对象转 Base64

### 4.6 数据持久化（MySQL Schema）

**存储方案**：MySQL 关系型数据库存储结构化数据，MinIO 对象存储存储二进制文件。

**表 `canvases`** — 画布/项目：

| 列 | 类型 | 说明 |
|----|------|------|
| id | VARCHAR(64) PK | 画布 ID |
| name | VARCHAR(255) | 项目名称 |
| excalidraw_data | LONGTEXT | Excalidraw 序列化 JSON（elements/appState/files） |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

> `excalidraw_data` 使用 LONGTEXT 而非拆分为结构化列，因为 Excalidraw 数据结构复杂且经常变化。

**表 `messages`** — 对话消息：

| 列 | 类型 | 说明 |
|----|------|------|
| id | BIGINT PK AUTO_INCREMENT | 消息 ID |
| canvas_id | VARCHAR(64) FK | 关联画布 |
| role | ENUM('user','assistant') | 角色 |
| content | LONGTEXT | 消息文本 |
| post_tool_content | LONGTEXT NULL | 工具调用后的后续文本 |
| image_urls | JSON NULL | 用户消息附带的图片 URL 列表 |
| audio_urls | JSON NULL | 用户消息附带的音频 URL 列表 |
| created_at | DATETIME | 创建时间 |

**表 `tool_calls`** — 工具调用记录：

| 列 | 类型 | 说明 |
|----|------|------|
| id | VARCHAR(64) PK | 工具调用 ID（如 call_abc123） |
| message_id | BIGINT FK | 关联 assistant 消息 |
| name | VARCHAR(128) | 工具名称 |
| arguments | JSON | 输入参数 |
| status | ENUM('executing','done') | 执行状态 |
| result | LONGTEXT NULL | 执行结果 JSON |
| image_url | VARCHAR(512) NULL | 生成的图片 URL |
| created_at | DATETIME | 创建时间 |

**表 `images`** — 图片元数据：

| 列 | 类型 | 说明 |
|----|------|------|
| id | BIGINT PK AUTO_INCREMENT | 图片 ID |
| canvas_id | VARCHAR(64) FK NULL | 关联画布 |
| object_key | VARCHAR(512) | MinIO 对象 key |
| original_url | VARCHAR(1024) NULL | AI API 返回的原始 URL |
| prompt | TEXT NULL | 生成时的提示词 |
| provider | VARCHAR(64) | 服务提供商 |
| size_bytes | BIGINT | 文件大小 |
| mime_type | VARCHAR(64) | MIME 类型 |
| width | INT NULL | 图片宽度 |
| height | INT NULL | 图片高度 |
| created_at | DATETIME | 创建时间 |

**特性**：

| 特性 | 实现 |
|------|------|
| 异步访问 | SQLAlchemy AsyncSession + aiomysql 驱动 |
| Schema 迁移 | alembic 管理表结构变更 |
| 排序策略 | `ORDER BY created_at DESC`（新项目排前面） |
| 编码 | 数据库 charset=utf8mb4，支持中文及 Emoji |

### 4.7 静态资源服务（MinIO 代理路由）

通过 FastAPI 代理路由从 MinIO 流式读取对象，替代原来的 `StaticFiles` 挂载：

```python
from mimetypes import guess_type
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter()

@router.get("/storage/{path:path}")
async def serve_storage(path: str):
    """从 MinIO 读取对象并流式返回，保持前端 URL 格式不变"""
    try:
        obj = minio_client.get_object(settings.MINIO_BUCKET, path)
        content_type = guess_type(path)[0] or "application/octet-stream"
        return StreamingResponse(obj, media_type=content_type)
    except S3Error as e:
        if e.code == "NoSuchKey":
            raise HTTPException(status_code=404, detail="Object not found")
        raise
```

| 路径 | 内容 | 访问示例 |
|------|------|----------|
| `/storage/images/` | 生成的图片 + 用户上传的图片（存储于 MinIO） | `GET /storage/images/volcano_xxx.jpg` |

前端 Vite 开发服务器代理配置（不变）：

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api':     { target: 'http://localhost:8000' },
    '/storage': { target: 'http://localhost:8000' },  // 后端代理至 MinIO
  }
}
```

---

## 5. 外部服务：火山引擎 Seedream 4.5

### 5.1 API 端点

- **Base URL**: `https://ark.cn-beijing.volces.com/api/v3`
- **生成/编辑端点**: `POST {base_url}/images/generations`
- **认证方式**: `Authorization: Bearer {API_KEY}`

### 5.2 请求参数

**文生图请求体**:

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

**图生图编辑请求体**（额外包含 `image` 字段）:

```json
{
  "model": "seedream-4.5",
  "prompt": "编辑指令文本",
  "image": "data:image/png;base64,{base64_data}",
  "size": "2048x2048",
  "response_format": "url",
  "stream": false,
  "watermark": true
}
```

### 5.3 响应格式

API 可能返回以下几种格式（需兼容解析）：

```json
// 格式1
{ "data": [{ "url": "https://..." }] }

// 格式2
{ "images": [{ "url": "https://..." }] }

// 格式3
{ "url": "https://..." }
```

### 5.4 环境变量

| 变量名 | 描述 | 默认值 |
|--------|------|--------|
| `VOLCANO_API_KEY` | 火山引擎 API Key | （必填） |
| `VOLCANO_BASE_URL` | API Base URL | `https://ark.cn-beijing.volces.com/api/v3` |
| `VOLCANO_IMAGE_MODEL` | 生图模型名称 | `seedream-4.5` |
| `VOLCANO_EDIT_MODEL` | 编辑模型名称 | 同 `VOLCANO_IMAGE_MODEL` |
| `MOCK_MODE` | Mock 模式开关 | `false` |
| `MOCK_IMAGE_PATH` | Mock 图片路径 | （Mock 模式下必填） |
| `DATABASE_URL` | MySQL 连接串 | `mysql+aiomysql://root:password@localhost:3306/canvasflow` |
| `MINIO_ENDPOINT` | MinIO 地址 | `localhost:9000` |
| `MINIO_ACCESS_KEY` | MinIO Access Key | `minioadmin` |
| `MINIO_SECRET_KEY` | MinIO Secret Key | `minioadmin` |
| `MINIO_BUCKET` | 默认 Bucket | `canvasflow` |
| `MINIO_SECURE` | 是否使用 HTTPS | `false` |

---

## 6. 图片尺寸系统

### 6.1 宽高比映射表

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

### 6.2 尺寸解析优先级

1. API 预设格式（`2K`, `4K`, `1K`）→ 直接使用
2. 宽高比枚举（`16:9` 等）→ 查表转换为像素值
3. 自定义格式（`1024x1024`）→ 直接解析
4. 无法解析 → 降级为 `1:1`（2048×2048）

---

## 7. 图片输入处理（图生图场景）

### 7.1 输入来源支持

| 来源类型 | 示例 | 处理方式 |
|----------|------|----------|
| 存储路径 | `/storage/images/xxx.png` | 从 MinIO 读取对象 → Base64 编码 |
| localhost URL | `http://localhost:8000/storage/images/xxx.png` | 解析路径 → 从 MinIO 读取对象 → Base64 编码 |
| 公网 URL | `https://example.com/image.png` | **不支持**（URL 会过期） |

`prepare_image_input()` 实现：

```python
def prepare_image_input(image_url: str) -> str:
    """从 MinIO 读取图片并转为 Base64 Data URL"""
    # 解析 URL → 提取 MinIO 对象 key
    path = image_url.replace("http://localhost:8000/storage/", "").lstrip("/storage/")
    obj = minio_client.get_object(settings.MINIO_BUCKET, path)
    raw_bytes = obj.read()
    ext = Path(path).suffix.lower()
    mime = MIME_MAP.get(ext, "image/jpeg")
    b64 = base64.b64encode(raw_bytes).decode()
    return f"data:{mime};base64,{b64}"
```

### 7.2 Base64 编码格式

```
data:image/{format};base64,{base64_data}
```

支持的格式检测（按文件扩展名）：

| 扩展名 | MIME 格式 |
|--------|-----------|
| `.jpg`, `.jpeg` | `image/jpeg` |
| `.png` | `image/png` |
| `.webp` | `image/webp` |
| `.bmp` | `image/bmp` |
| `.tiff`, `.tif` | `image/tiff` |
| `.gif` | `image/gif` |
| 其他 | 降级为 `image/jpeg` |

---

## 8. 图片后处理管线

生成的图片 URL 从 API 返回后，经过以下处理管线后保存到 MinIO 对象存储：

```
API 返回图片 URL
    ↓
HTTP 下载图片原始字节
    ↓
PIL.Image.open() 解析
    ↓
sRGB 色彩空间归一化（关键步骤）
    ↓
ICC Profile 移除
    ↓
格式决策：
├─ 不透明图片 → JPEG（quality=95, optimize, progressive）
└─ 含透明通道 → PNG（optimize）
    ↓
BytesIO 缓冲区（不落盘）
    ↓
minio_client.put_object(bucket, "images/{filename}", data, length, content_type)
    ↓
写入 MySQL images 表元数据
    ↓
返回 URL: /storage/images/{filename}
```

### 8.1 sRGB 归一化（核心技术点）

**问题**：AI 生成的图片可能包含非 sRGB 的 ICC 色彩配置文件，导致在 `<img>` 标签和 Canvas（如 Excalidraw）中渲染出现色差。

**解决方案**：

```python
from PIL import Image, ImageCms
from io import BytesIO

im = Image.open(BytesIO(raw_bytes))
im.load()

# 1. 提取源 ICC profile
icc = im.info.get("icc_profile")
if icc:
    src_profile = ImageCms.ImageCmsProfile(BytesIO(icc))
    dst_profile = ImageCms.createProfile("sRGB")

    # 根据是否含透明通道决定输出模式
    output_mode = "RGBA" if im.mode in ("RGBA", "LA") else "RGB"

    # 执行色彩空间转换
    im = ImageCms.profileToProfile(im, src_profile, dst_profile, outputMode=output_mode)

# 2. 彻底移除 ICC profile（避免浏览器双渲染链路差异）
im.info.pop("icc_profile", None)
```

### 8.2 透明度检测与格式选择

```python
# 检测是否含有效透明通道
has_alpha = im.mode in ("RGBA", "LA") or ("transparency" in im.info)
is_transparent = False

if has_alpha:
    alpha = im.getchannel("A")
    lo, hi = alpha.getextrema()
    is_transparent = lo < 255  # 存在非完全不透明像素

if not is_transparent:
    # 不透明 → 转 RGB → 保存为 JPEG
    im = im.convert("RGB")
    buf = BytesIO()
    im.save(buf, format="JPEG", quality=95, optimize=True, progressive=True)
else:
    # 含透明 → 保存为 PNG
    im = im.convert("RGBA")
    buf = BytesIO()
    im.save(buf, format="PNG", optimize=True)

# 上传到 MinIO
buf.seek(0)
minio_client.put_object(bucket, f"images/{filename}", buf, length=buf.getbuffer().nbytes,
                         content_type="image/jpeg" if not is_transparent else "image/png")
```

### 8.3 文件命名规则

```
{provider}_{timestamp}_{uuid8}_{safe_prompt}.{ext}
```

示例: `volcano_20250314_a1b2c3d4_sunset_beach.jpg`

- `provider`: 服务提供商标识
- `timestamp`: `%Y%m%d_%H%M%S` 格式
- `uuid8`: UUID 前 8 位
- `safe_prompt`: 提示词前 30 字符（仅保留字母数字和空格/连字符/下划线）
- `ext`: `.jpg`（不透明）或 `.png`（透明）

---

## 9. 工具接口设计

### 9.1 文生图工具

```python
@tool("generate_image", args_schema=GenerateImageInput)
def generate_image_tool(prompt: str, size: str = "1:1") -> str:
    """
    输入文本描述，返回生成的图片 URL (JSON)。

    参数:
        prompt: 图像描述（中英文）
        size:   宽高比枚举或自定义像素尺寸

    返回 JSON:
        {
            "image_url":    "/storage/images/xxx.jpg",   # 对象存储访问路径
            "original_url": "https://...",                # API 原始 URL
            "local_path":   "/storage/images/xxx.jpg",   # 对象存储访问路径（兼容字段）
            "prompt":       "...",                        # 使用的提示词
            "provider":     "volcano",                    # 服务提供商
            "message":      "图片已生成并保存到对象存储"
        }
    """
```

### 9.2 图生图编辑工具

```python
@tool("edit_image", args_schema=EditImageInput)
def edit_image_tool(prompt: str, image_url: str, size: str = "1:1") -> str:
    """
    基于已有图片 + 提示词生成新图片（保持角色/场景一致性）。

    参数:
        prompt:    编辑指令
        image_url: 源图片本地路径（如 /storage/images/xxx.png）
        size:      输出尺寸

    返回 JSON:
        {
            "image_url":     "/storage/images/xxx.jpg",
            "original_url":  "https://...",
            "local_path":    "/storage/images/xxx.jpg",   # 对象存储访问路径（兼容字段）
            "prompt":        "...",
            "source_image":  "/storage/images/original.png",
            "provider":      "volcano",
            "message":       "图片已编辑并保存到对象存储"
        }
    """
```

---

## 10. 数据流全景

```
用户输入: "生成一张夕阳下的海滩图片"
    ↓
LLM 推理 → 决定调用 generate_image_tool(prompt="夕阳下的海滩", size="16:9")
    ↓
parse_size("16:9") → "2560x1440"
    ↓
POST {base_url}/images/generations
    Headers: Authorization: Bearer {API_KEY}
    Body: { model, prompt, size, n:1, response_format:"url" }
    ↓
API 返回: { "data": [{ "url": "https://cdn.volcengine.com/xxx.png" }] }
    ↓
download_and_save_image(url, prompt):
    ├─ HTTP GET 下载原始字节
    ├─ PIL 解析 → sRGB 归一化 → 移除 ICC
    ├─ 透明度检测 → 选择 JPEG/PNG → 写入 BytesIO
    ├─ minio_client.put_object() → 上传到 MinIO
    └─ 写入 MySQL images 表元数据
    ↓
返回 JSON: { "image_url": "/storage/images/volcano_...jpg", ... }
    ↓
SSE tool_result 事件 → 前端解析 → 添加图片到画布
```

---

## 11. 本地开发环境（Docker Compose）

使用 `docker-compose.yml` 快速启动 MySQL 和 MinIO 依赖服务：

```yaml
services:
  mysql:
    image: mysql:8.0
    ports: ["3306:3306"]
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: canvasflow
    volumes:
      - mysql_data:/var/lib/mysql

  minio:
    image: minio/minio
    ports: ["9000:9000", "9001:9001"]
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio_data:/data

volumes:
  mysql_data:
  minio_data:
```

启动命令：

```bash
docker compose up -d
```

- MySQL 控制台：`localhost:3306`（用户 `root`，密码 `password`，数据库 `canvasflow`）
- MinIO 控制台：`http://localhost:9001`（用户 `minioadmin`，密码 `minioadmin`）
- MinIO API：`http://localhost:9000`

---

## 12. 实现要点清单

### 关键设计决策

- [ ] **API 提供商选择**：PolyStudio 使用火山引擎 Seedream 4.5，可考虑支持多提供商（如 Stability AI, DALL-E, Midjourney API 等）
- [ ] **异步模式**：当前实现使用同步 `requests`，建议在 CanvasFlow 中使用 `httpx` 异步客户端
- [ ] **超时配置**：API 请求 120 秒超时，可根据实际需求调整
- [ ] **重试策略**：当前无重试机制，建议添加指数退避重试
- [ ] **并发控制**：需要考虑多用户并发生图的 API 速率限制

### 依赖项

| 包 | 用途 |
|----|------|
| `Pillow` (>=10.4.0) | 图片解析、sRGB 归一化、格式转换 |
| `requests` / `httpx` | HTTP 客户端（调用 API、下载图片） |
| `pydantic` | 工具参数校验 |
| `python-dotenv` | 环境变量管理 |
| `SQLAlchemy` (>=2.0) | ORM，MySQL 数据库访问 |
| `aiomysql` | SQLAlchemy 异步 MySQL 驱动 |
| `alembic` | 数据库 Schema 迁移 |
| `minio` (>=7.0) | MinIO 对象存储 SDK |

### 存储结构

```
MinIO Bucket: canvasflow
└── images/
    ├── volcano_20250314_a1b2c3d4_sunset_beach.jpg
    ├── volcano_20250314_b2c3d4e5_portrait.png
    ├── upload_20250314_a1b2c3d4.jpg
    └── ...

MySQL Database: canvasflow
├── canvases      — 画布/项目数据
├── messages      — 对话消息
├── tool_calls    — 工具调用记录
└── images        — 图片元数据
```

---

## 13. Mock 模式

开发/测试时可启用 Mock 模式，跳过实际 API 调用：

- 设置 `MOCK_MODE=true`
- 配置 `MOCK_IMAGE_PATH=/storage/images/mock.png`（指向预置的测试图片）
- 所有工具返回预设路径，结果中标记 `"mock": true`

**存储降级**：Mock 模式下不需要真实的 MySQL / MinIO 连接，可使用以下降级方案：

| 组件 | 生产模式 | Mock 模式 |
|------|---------|----------|
| 数据库 | MySQL（AsyncSession） | SQLite 内存数据库（`sqlite+aiosqlite://`） |
| 对象存储 | MinIO | 本地文件系统（`storage/` 目录） |

这样开发者无需启动 Docker Compose 即可运行和调试基本功能。
