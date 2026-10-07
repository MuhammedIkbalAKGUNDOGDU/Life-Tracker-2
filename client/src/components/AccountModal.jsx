import { useState } from 'react';
import { X } from 'lucide-react';
import ModalShell from './ModalShell';
import { notify } from '../ui';

// Change the password of the one account. All other devices get logged out.
export default function AccountModal({ username, onClose }) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (next.length < 8) return notify('Yeni şifre en az 8 karakter olmalı.', 'error');
    if (next !== repeat) return notify('Yeni şifreler aynı değil.', 'error');
    setBusy(true);
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current, next })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        notify(data.error || 'Şifre değiştirilemedi.', 'error');
        return;
      }
      notify('Şifre değiştirildi. Diğer cihazlardaki oturumlar kapatıldı.', 'success');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ModalShell onClose={onClose} style={{ maxWidth: '440px' }}>
      <div className="modal-header">
        <h2>Hesap</h2>
        <button className="btn-close" data-modal-close type="button"><X /></button>
      </div>
      <form onSubmit={submit} className="modal-form">
        <div className="modal-body-split" style={{ flexDirection: 'column', gap: '14px', padding: '22px 24px' }}>
          <p className="muted small">Kullanıcı adı: <b>{username}</b></p>
          <div className="form-group">
            <label>Mevcut şifre</label>
            <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
          </div>
          <div className="form-group">
            <label>Yeni şifre (en az 8 karakter)</label>
            <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
          </div>
          <div className="form-group">
            <label>Yeni şifre (tekrar)</label>
            <input type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" required />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" data-modal-close>Vazgeç</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>Şifreyi değiştir</button>
        </div>
      </form>
    </ModalShell>
  );
}
