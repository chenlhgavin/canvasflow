import { useEffect, useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import ChatInterface from './components/ChatInterface';
import HomePage from './components/HomePage';
import LoginPage from './components/LoginPage';
import './App.css';

type ThemeMode = 'dark' | 'light';

function getCanvasIdFromUrl() {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get('canvasId') || '';
  } catch {
    return '';
  }
}

function readInitialTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem('canvasflow:theme');
    if (stored === 'dark' || stored === 'light') return stored;
  } catch {
    // ignore
  }
  return 'dark';
}

function App() {
  const { user, loading } = useAuth();
  const [canvasId, setCanvasId] = useState<string>(() => getCanvasIdFromUrl());
  const [theme, setTheme] = useState<ThemeMode>(() => readInitialTheme());

  useEffect(() => {
    const onPop = () => setCanvasId(getCanvasIdFromUrl());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  useEffect(() => {
    try {
      document.documentElement.dataset.theme = theme;
      localStorage.setItem('canvasflow:theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  // 加载中显示空白
  if (loading) return null;

  // 未登录显示登录页
  if (!user) return <LoginPage />;

  return (
    <div className="app">
      {canvasId ? (
        <ChatInterface
          initialCanvasId={canvasId}
          theme={theme}
          onToggleTheme={toggleTheme}
          onSetTheme={setTheme}
        />
      ) : (
        <HomePage theme={theme} onToggleTheme={toggleTheme} />
      )}
    </div>
  );
}

export default App;
