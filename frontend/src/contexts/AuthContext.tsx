import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface AuthUser {
  username: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  csrfToken: string;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function getCsrfTokenFromCookie(): string {
  const match = document.cookie.match(/(?:^|;\s*)csrf_token=([^;]+)/);
  return match ? match[1] : '';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [csrfToken, setCsrfToken] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.authenticated) {
          setUser({ username: data.username });
          setCsrfToken(getCsrfTokenFromCookie());
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.detail || 'Login failed');
    }
    const data = await res.json();
    setUser({ username: data.username });
    setCsrfToken(data.csrf_token);
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      headers: { 'X-CSRF-Token': csrfToken },
    }).catch(() => {});
    setUser(null);
    setCsrfToken('');
  }, [csrfToken]);

  return (
    <AuthContext.Provider value={{ user, csrfToken, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
