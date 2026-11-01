import { useEffect, useState } from 'react';
import { tokenStore } from './api/client';
import LoginPage from './pages/LoginPage';
import WorkspaceShell from './pages/WorkspaceShell';

export default function App() {
  const [authed, setAuthed] = useState<boolean>(() => Boolean(tokenStore.get()));

  // Handle OAuth redirect: `#access_token=...` or `#error=...`
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    const token = new URLSearchParams(hash).get('access_token');
    if (token) {
      tokenStore.set(token);
      setAuthed(true);
    }
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  if (!authed) return <LoginPage onSuccess={() => setAuthed(true)} />;

  return (
    <WorkspaceShell
      onSignOut={() => {
        tokenStore.clear();
        setAuthed(false);
      }}
    />
  );
}
