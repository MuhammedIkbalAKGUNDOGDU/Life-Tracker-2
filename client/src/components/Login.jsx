import { useRef, useState } from 'react';
import { Activity, Lock, User, KeyRound, Eye, EyeOff } from 'lucide-react';

// mode 'login': username + password. mode 'setup': first visit, create the one and only account.
export default function Login({ mode = 'login', onSuccess }) {
  const isSetup = mode === 'setup';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);
  const passRef = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (isSetup) {
      if (password.length < 8) return setError('Şifre en az 8 karakter olmalı.');
      if (password !== repeat) return setError('Şifreler aynı değil.');
    }
    setBusy(true);
    try {
      const res = await fetch(isSetup ? '/api/auth/setup' : '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isSetup ? { username, password, code } : { username, password })
      });
      if (res.ok) {
        onSuccess();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'İşlem yapılamadı.');
      setPassword('');
      setRepeat('');
      passRef.current?.focus();
    } catch {
      setError('Sunucuya bağlanılamadı.');
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = username.trim() && password && (!isSetup || (repeat && code));
  const type = show ? 'text' : 'password';

  return (
    <div className="login-page">
      <form className="glass-card login-card" onSubmit={submit}>
        <div className="brand-icon login-icon"><Activity /></div>
        <h1>Softium Planner</h1>
        <p>{isSetup ? 'İlk kurulum: hesabınızı oluşturun. Bu uygulamada tek hesap olur.' : 'Devam etmek için giriş yapın.'}</p>

        <div className="login-field">
          <User size={16} />
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Kullanıcı adı"
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
            aria-label="Kullanıcı adı"
          />
        </div>

        <div className="login-field">
          <Lock size={16} />
          <input
            ref={passRef}
            type={type}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isSetup ? 'Şifre (en az 8 karakter)' : 'Şifre'}
            autoComplete={isSetup ? 'new-password' : 'current-password'}
            aria-label="Şifre"
          />
          <button type="button" className="login-eye" onClick={() => setShow(v => !v)} aria-label={show ? 'Şifreyi gizle' : 'Şifreyi göster'}>
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        {isSetup && (
          <>
            <div className="login-field">
              <Lock size={16} />
              <input type={type} value={repeat} onChange={(e) => setRepeat(e.target.value)} placeholder="Şifre (tekrar)" autoComplete="new-password" aria-label="Şifre tekrar" />
            </div>
            <div className="login-field">
              <KeyRound size={16} />
              <input
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Kurulum kodu"
                autoCapitalize="characters"
                autoComplete="off"
                aria-label="Kurulum kodu"
              />
            </div>
            <small className="login-hint">Kurulum kodu sunucudaki <b>.env</b> dosyasında <b>SETUP_CODE</b> olarak yazılıdır. Yazmadıysanız sunucu logunda ("İlk kurulum kodu") görünür.</small>
          </>
        )}

        {error && <div className="login-error" role="alert">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={busy || !canSubmit}>
          {busy ? 'Lütfen bekleyin...' : isSetup ? 'Hesabı Oluştur' : 'Giriş Yap'}
        </button>
      </form>
    </div>
  );
}
