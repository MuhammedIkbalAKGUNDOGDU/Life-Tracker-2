import { useState } from 'react';
import { Activity, Lock } from 'lucide-react';

export default function Login({ onSuccess }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        onSuccess();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Giriş yapılamadı.');
    } catch {
      setError('Sunucuya bağlanılamadı.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-page">
      <form className="glass-card login-card" onSubmit={submit}>
        <div className="brand-icon login-icon"><Activity /></div>
        <h1>Softium Planner</h1>
        <p>Devam etmek için şifrenizi girin.</p>
        <div className="login-field">
          <Lock size={16} />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Şifre"
            autoFocus
            autoComplete="current-password"
          />
        </div>
        {error && <div className="login-error">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={busy || !password}>
          {busy ? 'Giriş yapılıyor...' : 'Giriş Yap'}
        </button>
      </form>
    </div>
  );
}
