# CanvasFlow Site

Astro + TypeScript 静态站点，AIGC 技术知识库，涵盖图像/3D/视频/虚拟人/音频生成及 ComfyUI 工作流。

## 常用命令

```bash
npm install              # 安装依赖
npm run dev              # 启动开发服务器 (http://0.0.0.0:4322)
npm run build            # 生产构建
npm run preview          # 预览构建产物
```

## 技术栈

- **Astro 6** — 静态站点生成框架
- **TypeScript** + **React 19** (交互式组件)
- **TailwindCSS 4** — 样式系统
- **MDX** — Markdown 内容渲染
- **GSAP** — JavaScript 动画
- **Mermaid** — 图表渲染
- **lucide-react** — 图标库

## 项目结构

```
site/
├── astro.config.mjs          # Astro 配置 (base: /canvasflow)
├── package.json
├── tsconfig.json
├── public/                    # 静态资源
└── src/
    ├── components/
    │   ├── cards/             # ArticleCard, TopicCard, ToolShowcase
    │   ├── content/           # Accordion, Breadcrumb, FeatureGrid
    │   ├── interactive/       # PresentationCarousel (React), TabsView, ThemeSwitcher
    │   ├── layout/            # Navigation, Footer
    │   └── sections/          # HeroSection, StatsSection, CTASection, TimelineView
    ├── content/               # Markdown 文章 (按主题分目录)
    │   ├── image/             # 图像生成
    │   ├── 3d/                # 3D 生成
    │   ├── video/             # 视频生成
    │   ├── virtual-human/     # 虚拟人
    │   ├── audio/             # 音频生成
    │   └── comfyui/           # ComfyUI 工作流
    ├── data/
    │   ├── topics.ts          # 主题元数据
    │   └── presentations.ts   # 演示文稿元数据
    ├── layouts/
    │   └── BaseLayout.astro   # 主布局
    ├── pages/                 # 文件路由
    │   ├── index.astro        # 首页
    │   ├── about.astro        # 关于页
    │   ├── topics/            # 主题列表 + 文章详情
    │   └── presentations/     # 演示文稿
    ├── styles/
    │   └── global.css         # 全局主题 (Apple / MotherDuck 双主题)
    ├── utils/
    │   └── path.ts            # URL 路径工具
    └── content.config.ts      # 内容集合配置
```

## 部署配置

- **Base**: `/canvasflow` (GitHub Pages 子目录)
- **Site**: `https://chenlhgavin.github.io`
- **Server**: `0.0.0.0:4322`

## 路由

文件路由系统：

- `/` — 首页 (Hero + 统计 + 主题网格 + 最新文章)
- `/about` — 功能介绍 + 主题目录
- `/topics/[slug]` — 主题详情页
- `/topics/[slug]/[article]` — 文章详情页
- `/presentations/` — 演示文稿列表
- `/presentations/[slug]` — 演示文稿详情

## 主题系统

双主题设计 (Apple / MotherDuck)，CSS 变量驱动，支持 `prefers-color-scheme` 暗色模式。

## 代码规范

- 页面和组件用 `.astro` 文件，交互式组件用 `.tsx` (React)
- 样式优先用 TailwindCSS，全局变量在 `global.css`
- 文章内容用 Markdown/MDX，放在 `src/content/` 对应主题目录下
- 代码格式化用 **Prettier** (项目根目录 `.prettierrc` 配置)
