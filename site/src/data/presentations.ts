// 演示文稿数据结构

export interface Presentation {
  slug: string;
  title: string;
  description: string;
  date: string;
  coverImage?: string;
  slideCount: number;
  tags?: string[];
}

export const presentations: Presentation[] = [];

// 获取所有演示文稿
export function getAllPresentations(): Presentation[] {
  return [...presentations].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

// 获取指定演示文稿
export function getPresentation(slug: string): Presentation | undefined {
  return presentations.find((p) => p.slug === slug);
}
