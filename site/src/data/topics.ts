// CanvasFlow AIGC 知识库数据结构

export interface Article {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  date: string;
  updated?: string;
  readingTime?: string;
  image?: string;
}

export interface Topic {
  slug: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  heroImage?: string;
  articles: Article[];
}

export const topics: Topic[] = [
  {
    slug: 'image',
    name: '图像生成',
    description: '文生图、图像编辑、风格迁移、质量评估等 AIGC 图像技术',
    icon: '🖼️',
    color: '#8b5cf6',
    heroImage: '/images/topics/image.png',
    articles: [
      {
        slug: 'ai-image-evolution',
        title: 'AI 图像生成技术演进：五大范式全解析',
        summary:
          '从 VAE、GAN、自回归到扩散模型与流匹配，通俗解读 AI 图像生成五大核心范式的技术原理、代表模型与优劣对比。',
        tags: ['VAE', 'GAN', 'Diffusion', 'Flow Matching'],
        date: '2026-03-16',
        readingTime: '20 分钟',
        image: '/images/articles/ai-image-evolution.png',
      },
      {
        slug: 'vae-deep-dive',
        title: 'VAE 深度解析：变分自编码器及主流代表技术',
        summary:
          '从经典 VAE 到 VQ-VAE、NVAE、VQGAN，再到 Stable Diffusion 的潜在空间引擎，全面剖析 VAE 家族的技术原理与应用场景。',
        tags: ['VAE', 'VQ-VAE', 'VQGAN', 'NVAE', 'Latent Diffusion'],
        date: '2026-03-17',
        readingTime: '25 分钟',
        image: '/images/articles/vae-deep-dive.png',
      },
      {
        slug: 'diffusion-deep-dive',
        title: '扩散模型深度解析：从噪声中生长出的艺术',
        summary:
          '从 DDPM 的"破坏与重建"哲学，到 Stable Diffusion 的潜在空间魔法，再到 DiT、FLUX 的 Transformer 革命，全面剖析扩散模型家族的技术原理与应用场景。',
        tags: ['Diffusion', 'DDPM', 'Stable Diffusion', 'DiT', 'FLUX', 'DDIM', 'Midjourney'],
        date: '2026-03-17',
        readingTime: '30 分钟',
        image: '/images/articles/diffusion-deep-dive.png',
      },
      {
        slug: 'flow-matching-deep-dive',
        title: '流匹配深度解析：从理论突破到 SD3 与 FLUX',
        summary:
          '从连续归一化流到整流流、最优传输条件流匹配，再到 Stable Diffusion 3 与 FLUX 的工业实践，全面剖析流匹配家族的技术原理与应用场景。',
        tags: ['Flow Matching', 'Rectified Flow', 'SD3', 'FLUX', 'Optimal Transport', 'DiT'],
        date: '2026-03-17',
        readingTime: '25 分钟',
        image: '/images/articles/flow-matching-deep-dive.png',
      },
      {
        slug: 'gan-deep-dive',
        title: 'GAN 深度解析：生成对抗网络及主流代表技术',
        summary:
          '从原始 GAN 到 DCGAN、WGAN、Pix2Pix、CycleGAN、StyleGAN，用生动的类比和直觉深入理解 GAN 家族的技术原理与应用场景。',
        tags: ['GAN', 'DCGAN', 'StyleGAN', 'CycleGAN', 'Pix2Pix', 'WGAN'],
        date: '2026-03-17',
        readingTime: '25 分钟',
        image: '/images/articles/gan-deep-dive.png',
      },
      {
        slug: 'autoregressive-deep-dive',
        title: '自回归图像生成深度解析：从 Token 预测到视觉创造',
        summary:
          '从 DALL-E 到 LlamaGen、VAR、MAR、Emu3，深入解读自回归（AR）图像生成的三大技术路线、核心原理与前沿进展。',
        tags: ['自回归', 'LlamaGen', 'VAR', 'MAR', 'Emu3', 'Next-Token'],
        date: '2026-03-17',
        readingTime: '25 分钟',
        image: '/images/articles/autoregressive-deep-dive.png',
      },
    ],
  },
  {
    slug: '3d',
    name: '3D 生成',
    description: '3D 内容生成、NeRF、3D Gaussian Splatting 等前沿技术',
    icon: '🧊',
    color: '#0ea5e9',
    heroImage: '/images/topics/3d.png',
    articles: [
      {
        slug: '3d-generation-overview',
        title: '3D 生成技术概览',
        summary: '从传统建模到 AI 生成，梳理 3D 内容生成技术的发展与主流方案。',
        tags: ['3D 生成', 'Mesh', 'Point Cloud', 'SDF'],
        date: '2026-03-16',
        readingTime: '12 分钟',
      },
      {
        slug: 'nerf-and-3dgs',
        title: 'NeRF 与 3D Gaussian Splatting',
        summary: '深入解析 NeRF 和 3DGS 两大新型 3D 表示方法的原理与应用。',
        tags: ['NeRF', '3D Gaussian Splatting', '神经辐射场', '实时渲染'],
        date: '2026-03-16',
        readingTime: '18 分钟',
      },
    ],
  },
  {
    slug: 'video',
    name: '视频生成',
    description: '文生视频、视频编辑、特效生成等 AI 视频技术',
    icon: '🎬',
    color: '#ef4444',
    heroImage: '/images/topics/video.png',
    articles: [
      {
        slug: 'text-to-video',
        title: '文生视频技术原理',
        summary: '从 Sora 到开源方案，解析文本生成视频的核心技术与挑战。',
        tags: ['Sora', 'Video Diffusion', '时序一致性', 'DiT'],
        date: '2026-03-16',
        readingTime: '15 分钟',
      },
      {
        slug: 'video-editing',
        title: '视频编辑与特效生成',
        summary: '探索 AI 驱动的视频编辑、特效合成与运动控制技术。',
        tags: ['视频编辑', '特效生成', '运动控制', 'Video-to-Video'],
        date: '2026-03-16',
        readingTime: '12 分钟',
      },
    ],
  },
  {
    slug: 'virtual-human',
    name: '虚拟人',
    description: '数字人、语音驱动、表情生成等虚拟人技术',
    icon: '🧑‍🎤',
    color: '#f59e0b',
    heroImage: '/images/topics/virtual-human.png',
    articles: [
      {
        slug: 'digital-human-overview',
        title: '数字人技术概览',
        summary: '从 2D 数字人到 3D 虚拟人，全面梳理数字人技术栈与应用场景。',
        tags: ['数字人', '虚拟主播', 'Avatar', '全身驱动'],
        date: '2026-03-16',
        readingTime: '14 分钟',
      },
      {
        slug: 'voice-driven-expression',
        title: '语音驱动与表情生成',
        summary: '解析语音驱动面部动画（Audio2Face）与表情生成的关键技术。',
        tags: ['Audio2Face', 'TalkingHead', '表情生成', 'FLAME'],
        date: '2026-03-16',
        readingTime: '12 分钟',
      },
    ],
  },
  {
    slug: 'audio',
    name: '音频生成',
    description: '语音合成、音乐生成、音效设计等 AI 音频技术',
    icon: '🎵',
    color: '#10b981',
    heroImage: '/images/topics/audio.png',
    articles: [
      {
        slug: 'speech-synthesis',
        title: '语音合成技术',
        summary: '从 TTS 到语音克隆，解析现代语音合成技术的原理与实践。',
        tags: ['TTS', '语音克隆', 'VITS', 'GPT-SoVITS'],
        date: '2026-03-16',
        readingTime: '13 分钟',
      },
      {
        slug: 'music-generation',
        title: '音乐生成与音效设计',
        summary: '探索 AI 音乐生成（Suno、Udio）与音效设计的技术原理。',
        tags: ['音乐生成', 'Suno', 'AudioLDM', '音效设计'],
        date: '2026-03-16',
        readingTime: '11 分钟',
      },
    ],
  },
  {
    slug: 'comfyui',
    name: 'ComfyUI',
    description: 'ComfyUI 工作流设计、自定义节点开发与最佳实践',
    icon: '🔗',
    color: '#6366f1',
    heroImage: '/images/topics/comfyui.png',
    articles: [
      {
        slug: 'getting-started',
        title: 'ComfyUI 入门指南',
        summary: '从安装配置到第一个工作流，快速上手 ComfyUI 节点式 AI 生图工具。',
        tags: ['ComfyUI', '入门', '工作流', '节点'],
        date: '2026-03-16',
        readingTime: '10 分钟',
      },
      {
        slug: 'custom-nodes',
        title: '自定义节点开发',
        summary: '深入 ComfyUI 节点系统，学习开发自定义节点扩展功能。',
        tags: ['ComfyUI', '自定义节点', 'Python', '插件开发'],
        date: '2026-03-16',
        readingTime: '15 分钟',
      },
      {
        slug: 'workflow-patterns',
        title: '工作流设计模式',
        summary: '总结 ComfyUI 常用工作流设计模式与高级技巧。',
        tags: ['ComfyUI', '工作流', '设计模式', '最佳实践'],
        date: '2026-03-16',
        readingTime: '12 分钟',
      },
    ],
  },
];

// 获取指定主题
export function getTopic(slug: string): Topic | undefined {
  return topics.find((t) => t.slug === slug);
}

// 获取所有主题摘要
export function getTopicsSummary() {
  return topics.map((t) => ({
    slug: t.slug,
    name: t.name,
    description: t.description,
    icon: t.icon,
    color: t.color,
    heroImage: t.heroImage,
    articleCount: t.articles.length,
  }));
}

// 获取所有文章（跨主题），按日期降序
export function getAllArticles() {
  return topics
    .flatMap((t) =>
      t.articles.map((a) => ({
        ...a,
        topicSlug: t.slug,
        topicName: t.name,
        topicIcon: t.icon,
        topicColor: t.color,
      }))
    )
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// 获取主题 Hero 图片映射
export function getTopicHeroImages(): Record<string, string> {
  const map: Record<string, string> = {};
  topics.forEach((t) => {
    if (t.heroImage) map[t.slug] = t.heroImage;
  });
  return map;
}

// 获取所有标签
export function getAllTags(): string[] {
  const tags = new Set<string>();
  topics.forEach((t) => t.articles.forEach((a) => a.tags.forEach((tag) => tags.add(tag))));
  return Array.from(tags).sort();
}

// 统计信息
export function getStats() {
  const totalArticles = topics.reduce((sum, t) => sum + t.articles.length, 0);
  const totalTags = getAllTags().length;
  return {
    topicCount: topics.length,
    articleCount: totalArticles,
    tagCount: totalTags,
  };
}
