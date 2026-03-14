# PolyStudio Design Guide

## Overview

PolyStudio 采用了一种深色优先、玻璃拟态（Glassmorphism）风格的现代设计语言。整体设计呈现出专业、沉浸且具有科技感的 AI 创作工具品牌形象，注重视觉层次和细腻的光影效果。

**设计特点:**
- 深色背景为主，支持明暗主题切换
- 蓝紫渐变作为主品牌色
- 大量使用 `rgba()` 透明度 + `backdrop-filter: blur()` 实现毛玻璃效果
- 多层径向渐变光晕营造空间深度
- 大圆角（pill / 18px）营造柔和、现代感
- 系统字体栈，轻量高效
- lucide-react 图标库，简约一致

---

## Color Palette 色彩系统

### Primary Colors 主色

| 名称 | 色值 | 用途 |
|------|------|------|
| **Primary Blue** | `#2563eb` / `rgb(37, 99, 235)` | 主品牌色，CTA，焦点状态 |
| **Primary Hover** | `#1d4ed8` / `rgb(29, 78, 216)` | 主色悬浮态 |
| **Accent Purple** | `rgba(168, 85, 247)` | 渐变辅助色，装饰光晕 |

### Dark Theme 深色主题

| 名称 | 色值 | 用途 |
|------|------|------|
| **Background** | `#070a12` | 页面主背景 |
| **Panel BG** | `rgba(15, 23, 42, 0.92)` | 面板/卡片背景（毛玻璃） |
| **Text Primary** | `rgba(229, 231, 235, 0.95)` | 主要文字 |
| **Text Secondary** | `rgba(229, 231, 235, 0.65)` | 次要/辅助文字 |
| **Border** | `rgba(255, 255, 255, 0.12)` | 默认边框 |
| **Border Hover** | `rgba(255, 255, 255, 0.22)` | 悬浮边框 |
| **Surface** | `rgba(255, 255, 255, 0.06)` | 卡片/按钮表面 |
| **Surface Hover** | `rgba(255, 255, 255, 0.08)` | 卡片/按钮悬浮 |

### Light Theme 浅色主题

| 名称 | 色值 | 用途 |
|------|------|------|
| **Background** | `#f8fafc` | 页面主背景 |
| **Panel BG** | `rgba(255, 255, 255, 0.88)` | 面板/卡片背景 |
| **Text Primary** | `rgba(15, 23, 42, 0.96)` | 主要文字 |
| **Text Secondary** | `rgba(15, 23, 42, 0.64)` | 次要/辅助文字 |
| **Border** | `rgba(15, 23, 42, 0.12)` | 默认边框 |
| **Border Hover** | `rgba(15, 23, 42, 0.22)` | 悬浮边框 |
| **Surface** | `rgba(255, 255, 255, 0.78)` | 卡片/按钮表面 |
| **Surface Hover** | `rgba(255, 255, 255, 0.92)` | 卡片/按钮悬浮 |

### Accent Colors 强调色

| 名称 | 色值 | 用途 |
|------|------|------|
| **Emerald** | `#10b981` / `rgb(16, 185, 129)` | 成功状态，完成指示 |
| **Amber** | `#f59e0b` / `rgb(245, 158, 11)` | 警告状态 |
| **Rose** | `#f43f5e` / `rgb(244, 63, 94)` | 危险/删除操作 |
| **Blue-400** | `#60a5fa` | 工具呼吸动画边框 |
| **Blue-300** | `#93c5fd` | 工具呼吸动画边框 |
| **Slate-400** | `#94a3b8` | 空状态图标/辅助色 |

### Gradient 渐变

```css
/* 主品牌渐变 - 用于 CTA 按钮和用户消息气泡 */
background: linear-gradient(135deg, rgba(37, 99, 235, 0.95), rgba(168, 85, 247, 0.85));

/* 面板渐变 - 深色主题对话面板 */
background: linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(2, 6, 23, 0.90));

/* 面板渐变 - 浅色主题对话面板 */
background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(248, 250, 252, 0.92));
```

### Decorative Glow 装饰光晕

```css
/* 首页/面板背景装饰 - 多层径向渐变 */
background:
  radial-gradient(600px 400px at 15% 10%, rgba(37, 99, 235, 0.45), transparent 60%),
  radial-gradient(600px 400px at 85% 20%, rgba(168, 85, 247, 0.35), transparent 55%),
  radial-gradient(700px 500px at 40% 90%, rgba(16, 185, 129, 0.22), transparent 60%),
  radial-gradient(900px 600px at 70% 80%, rgba(244, 63, 94, 0.18), transparent 55%);
filter: blur(24px);
opacity: 0.95;
```

---

## Typography 字体系统

### Font Families 字体家族

```css
/* 主要字体 - 系统字体栈 */
--font-primary: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;

/* 代码/等宽字体 */
--font-mono: source-code-pro, Menlo, Monaco, Consolas, "Courier New", monospace;

/* 工具面板等宽字体 */
--font-tool: 'Menlo', 'Monaco', 'Courier New', monospace;

/* 快捷键标签字体 */
--font-kbd: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
```

### Font Sizes 字号

| 名称 | 大小 | 用途 |
|------|------|------|
| **Hero Title** | `40px` | 首页大标题 |
| **Hero Title (Mobile)** | `30px` | 移动端首页标题 |
| **Header Title** | `20px` | 品牌名称 |
| **Panel Title** | `1.125rem` (18px) | 对话面板标题 |
| **Body** | `15px` | 正文、输入框文字 |
| **Body Small** | `0.875rem` (14px) | 按钮文字、项目名称 |
| **Caption** | `13px` | 副标题、预览文字 |
| **Tiny** | `12px` | 提示文字、标签、时间 |
| **Micro** | `11px` | 缩略图标签 |
| **Tool Detail** | `0.75rem` (12px) | 工具调用详情 |
| **Section Label** | `0.68rem` (~11px) | 区块标签（大写） |

### Font Weights 字重

| 名称 | 数值 | 用途 |
|------|------|------|
| **Regular** | `400` | 正文段落 |
| **Medium** | `500` | 按钮文字、交互元素 |
| **Semibold** | `600` | 小标题、面板标题 |
| **Bold** | `700` | 大标题、品牌名称、项目名 |

### Line Heights 行高

- 标题: `1.2`
- 正文: `1.5 - 1.6`
- 预览文字: `1.45`

### Letter Spacing 字间距

- 标题: `-0.02em` to `-0.03em` (紧凑)
- 正文: `0.01em`
- 大写标签: `0.05em - 0.06em`

---

## Spacing 间距系统

### Container Widths 容器宽度

```css
--container-hero: 980px;     /* 首页 hero 区域 */
--container-list: 980px;     /* 项目列表区域 */
--chat-panel-width: 380px;   /* 对话面板宽度 */
```

### Page Padding 页面内边距

```css
/* 桌面端 */
--page-padding: 28px;
--header-padding: 22px 28px;

/* 移动端 (≤640px) */
--page-padding-mobile: 18px;
```

### Component Spacing 组件间距

| 名称 | 大小 | 用途 |
|------|------|------|
| **Gap XS** | `2px` | 紧凑元素间距 |
| **Gap SM** | `6px - 8px` | 按钮内图标间距 |
| **Gap MD** | `10px - 14px` | 卡片网格间距、标签间距 |
| **Gap LG** | `16px` | 品牌区域间距 |
| **Message Gap** | `0.9rem` (14.4px) | 消息列表间距 |
| **Section Gap** | `26px` | Hero 到列表间距 |

---

## Effects 效果

### Box Shadows 阴影

```css
/* 深色主题 */
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.35);
--shadow-md: 0 6px 14px rgba(0, 0, 0, 0.35);
--shadow-lg: 0 18px 45px rgba(0, 0, 0, 0.5);

/* 浅色主题 */
--shadow-sm: 0 1px 2px 0 rgba(15, 23, 42, 0.08);
--shadow-md: 0 10px 24px rgba(15, 23, 42, 0.10);
--shadow-lg: 0 26px 60px rgba(15, 23, 42, 0.12);

/* 卡片阴影 */
--shadow-card: 0 20px 50px rgba(0, 0, 0, 0.35);

/* 用户消息气泡光晕 */
box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28), 0 0 30px rgba(37, 99, 235, 0.22);

/* 对话面板光晕 */
box-shadow: 0 18px 45px rgba(0, 0, 0, 0.55),
            0 0 90px rgba(37, 99, 235, 0.16),
            0 0 110px rgba(168, 85, 247, 0.12);
```

**设计说明:** PolyStudio 的阴影系统强调深度和光晕效果。多层阴影叠加创造出漂浮感，品牌色阴影营造发光效果。

### Border Radius 圆角

```css
--radius-lg: 1rem;      /* 16px - 面板、模态框 */
--radius-md: 0.75rem;   /* 12px - 按钮、下拉框 */
--radius-sm: 0.5rem;    /* 8px - 工具调用、小按钮 */
--radius-card: 18px;    /* 卡片 */
--radius-pill: 2rem;    /* 32px - 药丸按钮、输入框 */
--radius-full: 999px;   /* 圆形标签 */
--radius-circle: 50%;   /* 圆形按钮 */
```

**设计说明:** 整体设计偏向圆润柔和，大量使用药丸形状和大圆角，与深色玻璃拟态风格协调。

### Backdrop Filter 毛玻璃

```css
/* 对话面板 */
backdrop-filter: blur(12px);

/* 右键菜单 */
backdrop-filter: blur(14px);

/* 模态遮罩 */
backdrop-filter: blur(4px);
```

### Borders 边框

```css
/* 默认边框 */
border: 1px solid var(--border-color);

/* 激活/聚焦边框 */
border-color: var(--primary-color);

/* 聚焦光环 */
box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.22);
```

---

## Transitions & Animations 过渡与动画

### Duration 持续时间

```css
--duration-fast: 0.15s;
--duration-normal: 0.2s;
--duration-smooth: 0.18s;
--duration-slow: 0.3s;
--duration-panel: 0.4s;
```

### Timing Functions 缓动函数

```css
--ease-default: ease;
--ease-smooth: cubic-bezier(0.4, 0, 0.2, 1);  /* 图片拖拽 */
--ease-spring: cubic-bezier(0.16, 1, 0.3, 1);  /* 面板滑入 */
--ease-out: ease-out;                            /* 消息淡入 */
```

### Common Transitions 常用过渡

```css
/* 按钮/卡片 */
transition: all 0.2s ease;
transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;

/* 卡片悬浮 */
transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;

/* 面板滑入滑出 */
transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
```

### Keyframe Animations 关键帧动画

```css
/* 消息淡入 */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 下拉菜单 */
@keyframes slideDown {
  from { opacity: 0; transform: translateY(-10px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 打字光标 */
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* 状态指示点 */
@keyframes pulse-dot {
  0% { transform: scale(0.8); opacity: 0.5; }
  50% { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(0.8); opacity: 0.5; }
}

/* 工具调用呼吸效果 */
@keyframes breathing {
  0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.1); border-color: #93c5fd; }
  50% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.15); border-color: #60a5fa; }
  100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.1); border-color: #93c5fd; }
}

/* 骨架屏闪烁 */
@keyframes shimmer {
  to { transform: translateX(60%); }
}
```

### Hover Effects 悬浮效果

```css
/* 按钮/卡片上浮 */
transform: translateY(-1px);  /* 轻微 */
transform: translateY(-2px);  /* 标准 */

/* 浮动按钮缩放 */
transform: scale(1.05);
```

---

## Component Patterns 组件模式

### Buttons 按钮

#### Primary Button (CTA)
```css
.btn-primary {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.95), rgba(168, 85, 247, 0.85));
  color: #fff;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 12px;
  padding: 10px 12px;
  font-size: 14px;
  font-weight: 500;
  transition: transform 0.15s ease, background 0.15s ease;
}

.btn-primary:hover {
  background: linear-gradient(135deg, rgba(37, 99, 235, 1), rgba(168, 85, 247, 0.95));
  transform: translateY(-1px);
}
```

#### Secondary Button (Ghost)
```css
.btn-secondary {
  background: rgba(255, 255, 255, 0.06);
  color: #e5e7eb;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 12px;
  padding: 10px 12px;
  transition: transform 0.15s ease, background 0.15s ease, border-color 0.15s ease;
}

.btn-secondary:hover {
  transform: translateY(-1px);
  background: rgba(255, 255, 255, 0.09);
  border-color: rgba(255, 255, 255, 0.22);
}
```

#### Pill Button (Control)
```css
.btn-pill {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border-color);
  border-radius: 2rem;
  padding: 0.6rem 1rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
}

.btn-pill:hover {
  transform: translateY(-1px);
  box-shadow: var(--shadow-md);
  color: var(--text-primary);
}
```

#### Icon Button (Floating)
```css
.btn-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(15, 23, 42, 0.96);
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-md);
  color: var(--text-secondary);
  transition: all 0.2s ease;
}

.btn-icon:hover {
  transform: scale(1.05);
  box-shadow: var(--shadow-lg);
  color: var(--primary-color);
  border-color: var(--primary-color);
}
```

### Input Fields 输入框

```css
.input {
  background: transparent;
  border: none;
  outline: none;
  color: #e5e7eb;
  font-size: 15px;
  line-height: 1.5;
}

.input::placeholder {
  color: rgba(229, 231, 235, 0.5);
}

/* 搜索框 */
.search-input {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 14px;
  padding: 10px 12px;
}

/* 聚焦光环 */
.input-focus {
  border-color: var(--primary-color);
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.22);
}
```

### Cards 卡片

```css
.card {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 18px;
  overflow: hidden;
  transition: transform 0.18s ease, border-color 0.18s ease, background 0.18s ease;
}

.card:hover {
  transform: translateY(-2px);
  border-color: rgba(255, 255, 255, 0.22);
  background: rgba(255, 255, 255, 0.08);
}
```

### Prompt Card 提示卡片

```css
.prompt-card {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 18px;
  padding: 14px 14px 12px;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.35);
}
```

### Message Bubbles 消息气泡

```css
/* 通用气泡 */
.message-bubble {
  padding: 0.72rem 0.85rem;
  border-radius: 1.25rem;
  font-size: 0.9375rem;
  line-height: 1.6;
}

/* 用户消息 */
.message-user {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.95), rgba(168, 85, 247, 0.82));
  color: white;
  border-bottom-right-radius: 0.25rem;
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.28), 0 0 30px rgba(37, 99, 235, 0.22);
}

/* AI 消息 */
.message-assistant {
  background: rgba(255, 255, 255, 0.04);
  color: var(--text-primary);
  border: 1px solid rgba(255, 255, 255, 0.10);
  border-bottom-left-radius: 0.25rem;
  box-shadow: 0 10px 28px rgba(0, 0, 0, 0.25);
}
```

### Chips/Tags 标签

```css
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: rgba(229, 231, 235, 0.82);
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.18);
}
```

### Modal 模态框

```css
.modal-overlay {
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
}

.modal-content {
  background: var(--panel-bg);
  border-radius: var(--radius-lg);
  padding: 24px;
  box-shadow: var(--shadow-lg);
}
```

### Chat Panel 对话面板

```css
.chat-panel {
  width: 380px;
  background: linear-gradient(180deg, rgba(15, 23, 42, 0.92), rgba(2, 6, 23, 0.90));
  backdrop-filter: blur(12px);
  border-radius: var(--radius-lg);
  border: 1px solid rgba(255, 255, 255, 0.14);
  box-shadow:
    0 18px 45px rgba(0, 0, 0, 0.55),
    0 0 90px rgba(37, 99, 235, 0.16),
    0 0 110px rgba(168, 85, 247, 0.12);
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease;
}
```

### Dropdown 下拉菜单

```css
.dropdown {
  background-color: rgba(15, 23, 42, 0.96);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-lg);
  border: 1px solid var(--border-color);
  animation: slideDown 0.2s ease-out;
}
```

---

## Layout Patterns 布局模式

### Page Structure 页面结构

- 全屏高度: `100vh`
- Header 区域: `~88px` (22px padding × 2 + 内容)
- 内容区域: `calc(100vh - 88px)`

### Grid Systems 网格系统

```css
/* 项目卡片网格 - 3列 */
grid-template-columns: repeat(3, minmax(0, 1fr));
gap: 14px;

/* 响应式 - 平板 (≤1020px) 2列 */
grid-template-columns: repeat(2, minmax(0, 1fr));

/* 响应式 - 手机 (≤640px) 1列 */
grid-template-columns: 1fr;
```

### Canvas Background 画布背景

```css
/* 点阵网格 */
background-image: radial-gradient(#cbd5e1 1px, transparent 1px);
background-size: 24px 24px;
```

### Breakpoints 断点

| 名称 | 值 | 变化 |
|------|------|------|
| **Desktop** | 默认 | 3列网格，28px padding |
| **Tablet** | `≤1020px` | 2列网格 |
| **Mobile** | `≤768px` | 对话面板全宽 80vh |
| **Small Mobile** | `≤640px` | 1列网格，18px padding |

---

## Theme System 主题系统

### 切换机制

```typescript
// 通过 data-theme 属性控制
document.documentElement.dataset.theme = theme; // "dark" | "light"

// 持久化到 localStorage
localStorage.setItem('polystudio:theme', theme);
```

### 主题变量覆盖

每个组件 CSS 文件使用 `[data-theme="dark"]` 和 `[data-theme="light"]` 选择器定义对应的颜色变量。默认主题为深色。

---

## Visual Elements 视觉元素

### Icons 图标

- **图标库**: lucide-react (`^0.294.0`)
- **风格**: 简约线性，轻量
- **尺寸**: 14-18px (内联/按钮), 24-56px (Logo/大图标)
- **颜色**: 跟随 `var(--text-primary)` 或 `var(--text-secondary)`

#### 常用图标

| 图标 | 用途 |
|------|------|
| `Send` | 发送按钮 |
| `Sparkles` | AI/高级功能 |
| `Paperclip` / `Image` | 上传附件 |
| `X` / `XCircle` | 关闭/删除 |
| `ChevronDown` / `ChevronRight` | 展开/折叠 |
| `Sun` / `Moon` | 主题切换 |
| `Download` | 导出下载 |
| `Search` | 搜索 |
| `Trash2` | 删除 |
| `LayoutGrid` | 项目网格 |
| `Clock` | 时间戳 |

### Background Effects 背景效果

- 多层径向渐变光晕（蓝、紫、绿、玫红）
- `filter: blur(24px)` 柔化光晕
- `opacity: 0.95`（深色）/ `0.75`（浅色）

---

## CSS Custom Properties 设计令牌

```css
:root {
  /* Colors */
  --primary-color: #2563eb;
  --primary-hover: #1d4ed8;

  /* Border Radius */
  --radius-lg: 1rem;
  --radius-md: 0.75rem;
  --radius-sm: 0.5rem;
}

[data-theme="dark"] {
  --bg-color: #070a12;
  --panel-bg: rgba(15, 23, 42, 0.92);
  --text-primary: rgba(229, 231, 235, 0.95);
  --text-secondary: rgba(229, 231, 235, 0.65);
  --border-color: rgba(255, 255, 255, 0.12);
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.35);
  --shadow-md: 0 6px 14px rgba(0, 0, 0, 0.35);
  --shadow-lg: 0 18px 45px rgba(0, 0, 0, 0.5);
}

[data-theme="light"] {
  --bg-color: #f8fafc;
  --panel-bg: rgba(255, 255, 255, 0.88);
  --text-primary: rgba(15, 23, 42, 0.96);
  --text-secondary: rgba(15, 23, 42, 0.64);
  --border-color: rgba(15, 23, 42, 0.12);
  --shadow-sm: 0 1px 2px 0 rgba(15, 23, 42, 0.08);
  --shadow-md: 0 10px 24px rgba(15, 23, 42, 0.10);
  --shadow-lg: 0 26px 60px rgba(15, 23, 42, 0.12);
}
```

---

## Tech Stack 技术栈

| 类别 | 技术 |
|------|------|
| **框架** | React 18.2.0 |
| **构建工具** | Vite 5.0.8 |
| **语言** | TypeScript 5.2.2 |
| **CSS 方案** | Vanilla CSS + CSS Custom Properties |
| **图标** | lucide-react 0.294.0 |
| **画布** | @excalidraw/excalidraw 0.18.0 |
| **3D 渲染** | Three.js 0.160.0 + @react-three/fiber 8.15.0 |
| **Markdown** | react-markdown 9.0.1 |

---

## Implementation Notes 实施说明

1. **主题切换**: 通过 `data-theme` 属性 + CSS 变量实现，无需 JS 运行时样式计算
2. **玻璃拟态**: 核心视觉效果，确保 `backdrop-filter` 兼容性（需 `-webkit-` 前缀）
3. **光晕效果**: 使用伪元素 `::before` 添加装饰光晕，不影响布局（`pointer-events: none`）
4. **透明度系统**: 大量使用 `rgba()` 配合固定 alpha 值，保持深浅主题间的视觉一致性
5. **圆角一致性**: 面板/模态框 16px，卡片 18px，按钮 12px，控制按钮药丸形
6. **动画克制**: 悬浮使用微妙的位移（1-2px），面板使用弹性缓动
7. **响应式**: 移动优先的断点设计，对话面板在小屏下占满宽度

---

## Brand Voice 品牌调性

- **专业沉浸**: 深色基调营造专注的创作环境
- **科技未来**: 蓝紫渐变 + 光晕效果的太空感
- **温润精致**: 大圆角 + 毛玻璃的柔和触感
- **简洁高效**: 界面元素克制，信息层次清晰
