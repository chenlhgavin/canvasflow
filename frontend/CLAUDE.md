# CanvasFlow Frontend

React + TypeScript + Vite 前端，包含对话面板和 Excalidraw 无限画布。

## 常用命令

```bash
npm install              # 安装依赖
npm run dev              # 启动开发服务器 (自动代理 /api /storage 到 :8000)
npm run build            # 生产构建
npm run preview          # 预览构建产物
npm run lint             # ESLint 检查
npm run type-check       # TypeScript 类型检查
```

## 技术栈

- **React 19** + **TypeScript 5.9**
- **Vite 8** — 构建 + 开发服务器
- **@excalidraw/excalidraw 0.18** — 无限画布组件
- **react-markdown 10** — AI 回复中的 Markdown 渲染
- **lucide-react** — 图标库

## 页面路由

不使用 React Router，通过 URL 参数 `canvasId` 切换页面：

```
App.tsx
├─ canvasId 为空  → <HomePage />       首页 (项目列表 + Prompt 输入)
└─ canvasId 存在  → <ChatInterface />  编辑页 (对话面板 + 画布)
```

导航用 `window.history.pushState` + `PopStateEvent`。

## 首页 (HomePage)

- Hero 区 + Prompt 输入卡片 (textarea, 图片上传/粘贴, Enter 发送)
- 项目卡片网格 (3/2/1 列响应式)，缩略图拼贴布局 (1-4 张图自适应)
- 搜索过滤 (`useMemo` 前端筛选)，骨架屏加载
- 创建项目流程: `sessionStorage` 存 pending prompt → URL 加 `canvasId` → 跳转

## 编辑页 (ChatInterface)

- **画布层**: Excalidraw 全屏 (`position: absolute; inset: 0`)
- **对话面板**: 右侧 380px 浮动，玻璃拟态 (Glassmorphism)，可收起/展开
- **控制栏**: 左上角 (返回首页、历史记录)
- 移动端 (`< 768px`): 对话面板变为底部抽屉

## 关键交互

### SSE 消息处理
前端通过 `fetch` + `ReadableStream` 消费 `POST /api/chat` 的 SSE 流：
- `delta` → 追加 AI 文本 (打字机效果)
- `tool_call` → 显示工具状态卡片 (蓝色脉冲动画)
- `tool_result` → 解析 `image_url`，内嵌图片 + 调用 `addImage()`
- `[DONE]` → 保存消息历史和画布数据

### 画布集成
`ExcalidrawCanvas` 通过 `useImperativeHandle` 暴露 `addImage(url, title)`：
- 两层元素: 白色 `rectangle` 底板 + `image` 上层
- 自动布局算法: `computeNextPosition()`，每行最多 4 张，间距 20px
- 图片缩放: 最大宽度 300px，按比例缩放

### 图片上传
- 点击 📎 或粘贴图片 → `POST /api/upload-image` (multipart)
- 预览 80x80 缩略图，发送时携带 `imageUrls` 列表

## 主题系统

通过 `data-theme` 属性切换，CSS 变量驱动，`localStorage` 持久化，默认深色。

## Vite 代理配置

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api':     { target: 'http://localhost:8000' },
    '/storage': { target: 'http://localhost:8000' },
  }
}
```

## 代码规范

- 函数组件 + TypeScript，不使用 class 组件
- CSS 样式用 CSS 变量 + 模块化，暗/亮色通过 `data-theme` 切换
- 状态管理用 React hooks (`useState`, `useRef`, `useMemo`)，不引入 Redux
- 画布操作通过 `useImperativeHandle` 暴露命令式 API
- 消息气泡: 用户右对齐 (蓝紫渐变)，AI 左对齐 (半透明暗色)
- 动画: CSS keyframes (`fadeIn`, `pulse-dot`, `breathing`, `shimmer`)
