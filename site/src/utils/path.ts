/**
 * 给路径添加 base 前缀，确保在 GitHub Pages 等子路径部署时链接正确。
 * 例如 base='/canvasflow' 时，url('/about') => '/canvasflow/about'
 */
export function url(path: string): string {
  const base = import.meta.env.BASE_URL;
  // BASE_URL 末尾带 /，path 开头也带 /，需要去重
  if (path.startsWith('/')) {
    return `${base.replace(/\/$/, '')}${path}`;
  }
  return `${base}${path}`;
}
