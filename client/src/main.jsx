import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import Login from './components/Login.jsx'
import DialogHost from './components/DialogHost.jsx'
import './index.css'

// Any expired/invalid session (401 from the API) sends the user back to the login screen
const originalFetch = window.fetch.bind(window);
window.fetch = async (...args) => {
  const res = await originalFetch(...args);
  const url = typeof args[0] === 'string' ? args[0] : args[0]?.url || '';
  if (res.status === 401 && url.startsWith('/api') && !url.startsWith('/api/auth/login')) {
    window.dispatchEvent(new Event('auth-required'));
  }
  return res;
};

function AuthGate() {
  const [state, setState] = useState('checking'); // checking | login | app
  const [authDisabled, setAuthDisabled] = useState(false);

  const check = async () => {
    try {
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      setAuthDisabled(!!data.authDisabled);
      setState(data.authenticated ? 'app' : 'login');
    } catch {
      setState('login');
    }
  };

  useEffect(() => {
    check();
    const onAuthRequired = () => setState('login');
    window.addEventListener('auth-required', onAuthRequired);
    return () => window.removeEventListener('auth-required', onAuthRequired);
  }, []);

  if (state === 'checking') return null;
  if (state === 'login') return <Login onSuccess={() => setState('app')} />;
  return <App onLogout={authDisabled ? undefined : async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setState('login');
  }} />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AuthGate />
    <DialogHost />
  </React.StrictMode>,
)

// Installable app (PWA): register the service worker in production only
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}
