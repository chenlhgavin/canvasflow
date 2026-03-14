# MotherDuck Design Guide

## Overview

MotherDuck 采用了一种独特的、现代技术风格与复古美学相结合的设计语言。整体设计呈现出温暖、友好但专业的数据工具品牌形象，具有鲜明的视觉特征和一致的设计系统。

**设计特点:**
- 温暖的米色/奶油色背景基调
- 鲜艳的黄色作为主品牌色
- 等宽字体营造技术感
- 硬边阴影创造独特的视觉层次
- 手绘风格的插图元素（云朵、鸭子等）
- 极简的 UI 组件设计

---

## Color Palette 色彩系统

### Primary Colors 主色

| 名称 | 色值 | 用途 |
|------|------|------|
| **Brand Yellow** | `#FFDE00` / `rgb(255, 222, 0)` | 主品牌色，CTA背景，强调区域 |
| **Dark Gray** | `#383838` / `rgb(56, 56, 56)` | 主要文字，按钮，边框 |
| **Cream** | `#F4EFEA` / `rgb(244, 239, 234)` | 主背景色 |
| **Off-White** | `#F8F8F7` / `rgb(248, 248, 247)` | 次要背景，卡片 |

### Secondary Colors 辅助色

| 名称 | 色值 | 用途 |
|------|------|------|
| **Sky Blue** | `#6FC2FF` / `rgb(111, 194, 255)` | 蓝色 AI 标签，装饰 |
| **Teal** | `#53DBC9` / `rgb(83, 219, 201)` | 绿色强调，成功状态 |
| **Coral** | `#FF7169` / `rgb(255, 113, 105)` | 橙红色强调，CTA 变体 |
| **Lime** | `#F9EE3E` / `rgb(249, 238, 62)` | 黄绿色变体 |

### Semantic Colors 语义色

| 名称 | 色值 | 用途 |
|------|------|------|
| **Light Cyan** | `#EBF9FF` / `rgb(235, 249, 255)` | 信息卡片背景 |
| **Light Green** | `#E8F5E9` / `rgb(232, 245, 233)` | 成功状态背景 |
| **Light Purple** | `#F7F1FF` / `rgb(247, 241, 255)` | 紫色卡片背景 |
| **Light Yellow** | `#FFFDE7` / `rgb(255, 253, 231)` | 黄色卡片背景 |
| **Light Blue** | `#EAF0FF` / `rgb(234, 240, 255)` | 蓝色卡片背景 |
| **Light Coral** | `#FFEBE9` / `rgb(255, 235, 233)` | 红色/珊瑚卡片背景 |
| **Light Orange** | `#FDEDDA` / `rgb(253, 237, 218)` | 橙色卡片背景 |

### Text Colors 文字色

| 名称 | 色值 | 用途 |
|------|------|------|
| **Primary Text** | `#383838` / `rgb(56, 56, 56)` | 主要文字 |
| **Black** | `#000000` / `rgb(0, 0, 0)` | 强调文字 |
| **Muted** | `#A1A1A1` / `rgb(161, 161, 161)` | 次要/灰色文字 |
| **White** | `#FFFFFF` / `rgb(255, 255, 255)` | 深色背景上的文字 |

---

## Typography 字体系统

### Font Families 字体家族

```css
/* 主要字体 - 用于标题、导航、品牌文字 */
--font-primary: "Aeonik Mono", sans-serif;

/* 辅助字体 - 用于特殊文字 */
--font-secondary: "Aeonik Fono", "Aeonik Mono";

/* 正文字体 - 用于段落、描述 */
--font-body: Inter, Arial, sans-serif;

/* 等宽字体 - 用于代码、数据 */
--font-mono: "Aeonik Mono", monospace;
```

### Font Sizes 字号

| 名称 | 大小 | 用途 |
|------|------|------|
| **Display** | `72px` | 首页大标题 |
| **H1** | `56px` | 页面主标题 |
| **H2** | `40-44px` | 章节标题 |
| **H3** | `32px` | 副标题 |
| **H4** | `24px` | 小标题 |
| **H5** | `20px` | 次级标题 |
| **Body Large** | `18px` | 大段落 |
| **Body** | `16px` | 正文 |
| **Body Small** | `15px` | 小字 |
| **Caption** | `14px` | 辅助文字 |

### Font Weights 字重

| 名称 | 数值 | 用途 |
|------|------|------|
| **Light** | `300` | 正文段落 |
| **Regular** | `400` | 标题、导航 |
| **Semibold** | `600` | 强调 |
| **Bold** | `700` | 强调标题 |

### Line Heights 行高

- 标题: `1.2` (86.4px for 72px)
- 正文: `1.4-1.6` (25.6px for 16px)
- 紧凑: `1.1`

### Letter Spacing 字间距

- 标题: `0.32px - 0.64px`
- 大写文字: `1.44px`
- 正文: `0.28px - 0.4px`

---

## Spacing 间距系统

### Base Scale 基础比例

```css
--spacing-1: 4px;
--spacing-2: 8px;
--spacing-3: 12px;
--spacing-4: 16px;
--spacing-5: 20px;
--spacing-6: 24px;
--spacing-7: 32px;
--spacing-8: 40px;
--spacing-9: 50px;
--spacing-10: 64px;
--spacing-11: 80px;
--spacing-12: 100px;
--spacing-13: 120px;
--spacing-14: 140px;
--spacing-15: 180px;
--spacing-16: 200px;
```

### Section Spacing 章节间距

- 大章节: `120px - 200px`
- 中等章节: `80px - 100px`
- 小章节: `40px - 64px`
- 组件内部: `16px - 32px`

### Container Widths 容器宽度

```css
--container-max: 1600px;
--container-lg: 1440px;
--container-md: 1302px;
--container-sm: 1242px;
--container-content: 1000px;
--container-narrow: 800px;
```

---

## Effects 效果

### Box Shadows 阴影

```css
/* 品牌阴影 - 硬边偏移阴影（非常独特） */
--shadow-brand: rgb(56, 56, 56) -12px 12px 0px 0px;

/* 悬浮阴影 */
--shadow-hover: rgba(0, 0, 0, 0.25) 0px 4px 8px 0px;
```

**设计说明:** MotherDuck 使用独特的硬边偏移阴影，这是品牌视觉识别的重要组成部分。阴影向左下角偏移，颜色与主要深灰色一致。

### Border Radius 圆角

```css
--radius-sm: 2px;    /* 按钮、输入框 - 几乎方形 */
--radius-md: 10px;   /* 卡片 */
--radius-full: 50%;  /* 圆形元素 */
```

**设计说明:** 整体设计偏向方正，使用极小的圆角（2px），营造技术感和现代感。

### Borders 边框

```css
/* 主要边框 */
border: 2px solid #383838;

/* 装饰边框颜色 */
--border-cyan: rgb(84, 180, 222);
--border-teal: rgb(56, 193, 176);
--border-purple: rgb(178, 145, 222);
--border-lime: rgb(179, 196, 25);
--border-yellow: rgb(225, 196, 39);
--border-blue: rgb(117, 151, 238);
--border-coral: rgb(243, 142, 132);
--border-orange: rgb(245, 177, 97);
```

---

## Transitions & Animations 过渡与动画

### Timing Functions 缓动函数

```css
--ease-default: ease-in-out;
--ease-smooth: cubic-bezier(0.34, 0, 0.12, 1);
--ease-out: ease-out;
--ease-linear: linear;
```

### Duration 持续时间

```css
--duration-fast: 0.1s;
--duration-quick: 0.12s;
--duration-normal: 0.2s;
--duration-slow: 0.3s;
--duration-slower: 1s;
```

### Common Transitions 常用过渡

```css
/* 按钮悬浮 */
transition: box-shadow 0.12s ease-in-out, transform 0.12s ease-in-out;

/* 链接悬浮 */
transition: border-bottom 0.2s ease-in-out, background-color 0.2s ease-in-out;

/* 卡片变换 */
transition: transform 0.2s cubic-bezier(0.34, 0, 0.12, 1), border-radius 0.2s cubic-bezier(0.34, 0, 0.12, 1);

/* 透明度 */
transition: opacity 0.15s ease-in-out;

/* 通用 */
transition: all 0.2s ease-in-out;
```

### Hover Effects 悬浮效果

```css
/* 链接/按钮位移效果 */
.link:hover {
  transform: translate(7px, -7px);
}

/* 卡片缩放 */
.card:hover {
  transform: scale(1.02);
}
```

---

## Component Patterns 组件模式

### Buttons 按钮

#### Primary Button (CTA)
```css
.button-primary {
  background-color: #6FC2FF;  /* Sky Blue */
  color: #383838;
  border: 2px solid #383838;
  border-radius: 2px;
  padding: 11px 22px;
  font-family: "Aeonik Mono", sans-serif;
  font-size: 16px;
  font-weight: 400;
  box-shadow: rgb(56, 56, 56) -12px 12px 0px 0px;
  transition: box-shadow 0.12s ease-in-out, transform 0.12s ease-in-out;
}

.button-primary:hover {
  transform: translate(6px, -6px);
  box-shadow: rgb(56, 56, 56) -6px 6px 0px 0px;
}
```

#### Secondary Button
```css
.button-secondary {
  background-color: transparent;
  color: #383838;
  border: none;
  border-bottom: 1px solid #383838;
  padding: 0;
  font-family: "Aeonik Mono", sans-serif;
  text-decoration: none;
}
```

### Input Fields 输入框

```css
.input {
  background-color: rgba(248, 248, 247, 0.7);
  border: 2px solid #383838;
  border-radius: 2px;
  padding: 16px 24px;
  font-family: Inter, sans-serif;
  font-size: 16px;
  transition: 0.2s ease-in-out;
}

.input:focus {
  outline: none;
  border-color: #6FC2FF;
}
```

### Cards 卡片

```css
.card {
  background-color: #E8F5E9;  /* 或其他语义色背景 */
  border: 2px solid #38C1B0;  /* 匹配的边框色 */
  border-radius: 0;
  padding: 12px 20px;
  transition: transform 0.2s cubic-bezier(0.34, 0, 0.12, 1);
}

.card:hover {
  transform: translateY(-4px);
}
```

### Navigation 导航

```css
.nav-item {
  font-family: "Aeonik Mono", sans-serif;
  font-size: 16px;
  font-weight: 400;
  color: #383838;
  text-decoration: none;
  border-radius: 2px;
  transition: all 0.2s ease-in-out;
}

.nav-item:hover {
  background-color: rgba(248, 248, 247, 0.7);
}
```

### Tags/Labels 标签

```css
.tag {
  background-color: #383838;
  color: #FFFFFF;
  padding: 4px 16px;
  font-family: "Aeonik Mono", sans-serif;
  font-size: 24px;
  border: 2px solid #383838;
}
```

---

## Layout Patterns 布局模式

### Header 顶部导航

- 固定高度: `90px` (桌面) / `70px` (移动端)
- 公告栏高度: `55px` (桌面) / `70px` (移动端)
- Logo 在左，导航在中，CTA 在右

### Grid Systems 网格系统

```css
/* 2列布局 */
grid-template-columns: 440px 680px;

/* 6列布局 */
grid-template-columns: repeat(6, 1fr);

/* 4列布局 */
grid-template-columns: repeat(4, 191px);
```

### Section Layout 章节布局

- 最大宽度: `1242px`
- 水平 padding: `179px` (大屏幕)
- 垂直间距: `80px - 200px`

---

## Visual Elements 视觉元素

### Illustrations 插图风格

- 手绘风格的云朵、数据库图标
- 简约线条艺术
- 品牌吉祥物（鸭子相关）
- 使用品牌色彩的装饰元素

### Icons 图标

- 简约线性风格
- 2px 描边
- 与文字颜色一致 (#383838)

---

## CSS Custom Properties 设计令牌

```css
:root {
  /* Colors */
  --color-brand-yellow: #FFDE00;
  --color-dark-gray: #383838;
  --color-cream: #F4EFEA;
  --color-off-white: #F8F8F7;
  --color-sky-blue: #6FC2FF;
  --color-teal: #53DBC9;
  --color-coral: #FF7169;
  --color-white: #FFFFFF;
  --color-black: #000000;
  --color-muted: #A1A1A1;

  /* Typography */
  --font-display: "Aeonik Mono", sans-serif;
  --font-body: Inter, Arial, sans-serif;
  --font-mono: "Aeonik Mono", monospace;

  /* Spacing */
  --space-xs: 4px;
  --space-sm: 8px;
  --space-md: 16px;
  --space-lg: 24px;
  --space-xl: 32px;
  --space-2xl: 48px;
  --space-3xl: 64px;
  --space-4xl: 80px;
  --space-5xl: 120px;

  /* Effects */
  --shadow-brand: rgb(56, 56, 56) -12px 12px 0px 0px;
  --shadow-brand-hover: rgb(56, 56, 56) -6px 6px 0px 0px;
  --radius-sm: 2px;
  --radius-md: 10px;

  /* Transitions */
  --transition-fast: 0.12s ease-in-out;
  --transition-normal: 0.2s ease-in-out;
  --transition-slow: 0.3s ease-in-out;

  /* Layout */
  --header-height: 90px;
  --container-max: 1600px;
  --container-content: 1242px;
}
```

---

## Implementation Notes 实施说明

1. **字体加载**: 需要引入 Aeonik Mono 和 Inter 字体（可能需要授权）
2. **硬边阴影**: 品牌的核心视觉元素，确保一致使用
3. **方正设计**: 保持 2px 圆角的一致性
4. **色彩搭配**: 每种语义色背景都有匹配的边框色
5. **动画**: 使用位移而非其他变换效果作为主要交互反馈
6. **响应式**: 桌面优先设计，移动端需调整间距和字号

---

## Brand Voice 品牌调性

- **友好专业**: 技术产品但不冷冰冰
- **现代复古**: 等宽字体 + 硬边阴影的独特组合
- **活泼有趣**: 鸭子元素和手绘插图增添趣味
- **简洁高效**: 界面简洁，信息层次清晰
