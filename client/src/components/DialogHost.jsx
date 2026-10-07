import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, HelpCircle } from 'lucide-react';

// Renders the app-wide confirm dialog triggered by confirmDialog() from ui.js
export default function DialogHost() {
  const [dialog, setDialog] = useState(null);
  const confirmBtn = useRef(null);
  const cancelBtn = useRef(null);
  const inputRef = useRef(null);
  const [text, setText] = useState('');

  useEffect(() => {
    const onConfirm = (e) => {
      setText(e.detail.input?.defaultValue || '');
      setDialog(e.detail);
    };
    window.addEventListener('ui-confirm', onConfirm);
    return () => window.removeEventListener('ui-confirm', onConfirm);
  }, []);

  const close = (result) => {
    if (dialog?.input) dialog.resolve(result ? text.trim() || null : null);
    else dialog?.resolve(result);
    setDialog(null);
  };

  useEffect(() => {
    if (!dialog) return;
    // Destructive dialogs focus "cancel" so a stray Enter can't delete anything
    if (dialog.input) inputRef.current?.select();
    else (dialog.danger ? cancelBtn : confirmBtn).current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close(false);
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog]);

  if (!dialog) return null;

  return (
    <div className="dialog-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
      <div className="dialog glass-card" role="alertdialog" aria-modal="true">
        <div className={`dialog-icon ${dialog.danger ? 'danger' : ''}`}>
          {dialog.danger ? <AlertTriangle size={26} /> : <HelpCircle size={26} />}
        </div>
        <h3>{dialog.title}</h3>
        {dialog.message && <p>{dialog.message}</p>}
        {dialog.input && (
          <input
            ref={inputRef}
            className="dialog-input"
            value={text}
            autoFocus
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); close(true); } }}
          />
        )}
        <div className="dialog-actions">
          <button ref={cancelBtn} className="btn btn-secondary" onClick={() => close(false)}>{dialog.cancelText}</button>
          <button
            ref={confirmBtn}
            className={`btn ${dialog.danger ? 'btn-danger' : 'btn-primary'}`}
            onClick={() => close(true)}
          >
            {dialog.confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
