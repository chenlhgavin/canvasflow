/**
 * API 工具：CSRF token 注入 + 401 处理
 */

export function getCsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/)
  return match ? match[1] : ''
}

function handleUnauthorized(res: Response): void {
  if (res.status === 401) {
    window.dispatchEvent(new CustomEvent('auth:unauthorized'))
  }
}

/**
 * 包装 fetch，自动为变更类请求添加 X-CSRF-Token 头
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const method = (init?.method || 'GET').toUpperCase()
  const headers = new Headers(init?.headers)

  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const token = getCsrfToken()
    if (token) {
      headers.set('X-CSRF-Token', token)
    }
  }

  const res = await fetch(input, { ...init, headers })
  handleUnauthorized(res)
  return res
}

export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' }
  const token = getCsrfToken()
  if (token) {
    (headers as Record<string, string>)['X-CSRF-Token'] = token
  }

  const res = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      current_password: currentPassword,
      new_password: newPassword,
    }),
  })

  if (!res.ok) {
    handleUnauthorized(res)
    const data = await res.json().catch(() => ({}))
    throw new Error(data?.detail || 'Failed to change password')
  }
}
