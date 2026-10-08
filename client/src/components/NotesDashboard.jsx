import { useCallback, useEffect, useRef, useState } from 'react';
import { CalendarDays, Plus, Eye, EyeOff, Trash2, Pencil, Check, X, Search, StickyNote, Eraser } from 'lucide-react';
import { api } from '../healthApi';
import { confirmDialog, notify } from '../ui';

const dayLabel = (str) => {
  const [y, m, d] = str.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const diff = Math.round((date - new Date().setHours(0, 0, 0, 0)) / 86400000);
  const base = date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', weekday: 'short' });
  return diff === 0 ? `Bugün · ${base}` : diff === 1 ? `Yarın · ${base}` : diff === -1 ? `Dün · ${base}` : base;
};

const whenText = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  if (days === 0) return `bugün ${time}`;
  if (days === 1) return `dün ${time}`;
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
};

// Makes web links in a note clickable
function Linkified({ text }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/g);
  return parts.map((p, i) => (/^https?:\/\//.test(p)
    ? <a key={i} href={p} target="_blank" rel="noreferrer noopener" onClick={(e) => e.stopPropagation()}>{p}</a>
    : <span key={i}>{p}</span>));
}

export default function NotesDashboard() {
  const [data, setData] = useState({ active: [], completed: [], showCompleted: true });
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [draftDate, setDraftDate] = useState('');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState('');
  const inputRef = useRef(null);

  const load = useCallback(async () => {
    try { setData(await api('GET', '/api/notes')); } catch { /* toast shown */ }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const add = async () => {
    const text = draft.trim();
    if (!text) return;
    setDraft('');
    try {
      await api('POST', '/api/notes', { text, note_date: draftDate || null });
      setDraftDate('');
      await load();
    } catch {
      setDraft(text);
    }
    inputRef.current?.focus();
  };

  const toggleDone = async (note) => {
    await api('PUT', `/api/notes/${note.id}`, { is_done: !note.is_done });
    load();
  };

  const setNoteDate = async (note, value) => {
    await api('PUT', `/api/notes/${note.id}`, { note_date: value || null });
    load();
  };

  const saveEdit = async (note) => {
    const text = editText.trim();
    setEditingId(null);
    if (!text || text === note.text) return;
    await api('PUT', `/api/notes/${note.id}`, { text });
    load();
  };

  const remove = async (note) => {
    await api('DELETE', `/api/notes/${note.id}`);
    load();
    notify('Not silindi.', 'info', {
      label: 'Geri al',
      onClick: async () => {
        const restored = await api('POST', '/api/notes', { text: note.text, note_date: note.note_date });
        if (note.is_done) await api('PUT', `/api/notes/${restored.id}`, { is_done: true });
        load();
      }
    });
  };

  const toggleShow = async () => {
    const next = !data.showCompleted;
    setData(d => ({ ...d, showCompleted: next }));
    await api('PUT', '/api/notes-settings', { showCompleted: next });
  };

  const clearCompleted = async () => {
    const ok = await confirmDialog({ title: 'Tamamlananlar silinsin mi?', message: `${data.completed.length} tamamlanan not kalıcı olarak silinecek.`, confirmText: 'Sil', danger: true });
    if (!ok) return;
    await api('DELETE', '/api/notes/completed');
    load();
  };

  const q = query.trim().toLocaleLowerCase('tr');
  const match = (n) => !q || n.text.toLocaleLowerCase('tr').includes(q);
  const active = data.active.filter(match);
  const completed = data.completed.filter(match);

  const NoteRow = ({ note }) => (
    <div className={`note-row ${note.is_done ? 'done' : ''}`}>
      <button type="button" className={`note-check ${note.is_done ? 'checked' : ''}`} onClick={() => toggleDone(note)} aria-label={note.is_done ? 'Geri aç' : 'Tamamla'}>
        {note.is_done && <Check size={16} />}
      </button>
      <div className="note-body">
        {editingId === note.id ? (
          <textarea
            className="note-edit"
            value={editText}
            autoFocus
            rows={Math.min(6, Math.max(2, editText.split('\n').length))}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={() => saveEdit(note)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setEditingId(null); }
              else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.blur(); }
            }}
          />
        ) : (
          <div className="note-text" onDoubleClick={() => { if (!note.is_done) { setEditingId(note.id); setEditText(note.text); } }}>
            <Linkified text={note.text} />
          </div>
        )}
        <label className={`note-date ${note.note_date ? 'set' : ''}`} title="Takvimde göstermek için gün seç">
          <CalendarDays size={13} />
          <span>{note.note_date ? dayLabel(note.note_date) : 'Gün ekle'}</span>
          <input type="date" value={note.note_date || ''} onChange={(e) => setNoteDate(note, e.target.value)} aria-label="Not günü" />
          {note.note_date && <button type="button" className="note-date-x" onClick={(e) => { e.preventDefault(); setNoteDate(note, null); }} aria-label="Günü kaldır">×</button>}
        </label>
        <small>{note.is_done ? `tamamlandı · ${whenText(note.done_at)}` : whenText(note.created_at)}</small>
      </div>
      {!note.is_done && editingId !== note.id && (
        <button type="button" className="icon-btn" onClick={() => { setEditingId(note.id); setEditText(note.text); }} aria-label="Düzenle"><Pencil size={16} /></button>
      )}
      <button type="button" className="icon-btn" onClick={() => remove(note)} aria-label="Sil"><Trash2 size={16} /></button>
    </div>
  );

  return (
    <div className="notes-page">
      <section className="action-bar-section" style={{ gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: 700 }}>Notlar</h2>
          <p className="muted small">{data.active.length} yapılacak · {data.completed.length} tamamlanan · Telegram'dan da ekleyebilirsin: <code>not: süt al</code></p>
        </div>
        <div className="notes-actions">
          <button
            type="button"
            className={`btn btn-secondary ${data.showCompleted ? '' : 'off'}`}
            onClick={toggleShow}
            title="Tamamlanan notları listede göster veya gizle (Telegram'daki liste de aynı ayarı kullanır)"
          >
            {data.showCompleted ? <Eye size={16} /> : <EyeOff size={16} />} Tamamlananlar: {data.showCompleted ? 'görünür' : 'gizli'}
          </button>
          {data.showCompleted && data.completed.length > 0 && (
            <button type="button" className="btn btn-secondary" onClick={clearCompleted}><Eraser size={16} /> Temizle</button>
          )}
        </div>
      </section>

      <form className="glass-card note-add" onSubmit={(e) => { e.preventDefault(); add(); }}>
        <textarea
          ref={inputRef}
          value={draft}
          rows={draft.includes('\n') ? 3 : 1}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); add(); } }}
          placeholder="Yeni not yaz… (Enter ekler, Shift+Enter yeni satır)"
          aria-label="Yeni not"
        />
        <label className={`note-date ${draftDate ? 'set' : ''}`} title="İstersen takvimde görünmesi için gün seç">
          <CalendarDays size={15} />
          <span>{draftDate ? dayLabel(draftDate) : 'Gün'}</span>
          <input type="date" value={draftDate} onChange={(e) => setDraftDate(e.target.value)} aria-label="Not günü" />
          {draftDate && <button type="button" className="note-date-x" onClick={(e) => { e.preventDefault(); setDraftDate(''); }} aria-label="Günü kaldır">×</button>}
        </label>
        <button type="submit" className="btn btn-primary" disabled={!draft.trim()}><Plus size={18} /> Ekle</button>
      </form>

      {(data.active.length + data.completed.length) > 6 && (
        <div className="project-search glass-card">
          <Search size={16} />
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Notlarda ara..." />
          {query && <button onClick={() => setQuery('')} aria-label="Aramayı temizle">×</button>}
        </div>
      )}

      {loading ? (
        <div className="loading-state"><div className="spinner"></div></div>
      ) : (
        <>
          <section className="glass-card notes-card">
            {active.length === 0 ? (
              <div className="notes-empty">
                <StickyNote size={34} />
                <p>{data.active.length === 0 ? 'Aktif not yok. Yukarıdan ilk notunu ekle.' : 'Aramaya uyan aktif not yok.'}</p>
              </div>
            ) : active.map(n => <NoteRow key={n.id} note={n} />)}
          </section>

          {data.showCompleted && completed.length > 0 && (
            <section className="glass-card notes-card">
              <h3 className="notes-sub"><Check size={16} /> Tamamlananlar ({completed.length})</h3>
              {completed.map(n => <NoteRow key={n.id} note={n} />)}
            </section>
          )}
          {!data.showCompleted && data.completed.length > 0 && (
            <p className="muted small" style={{ textAlign: 'center' }}>{data.completed.length} tamamlanan not gizli. <button type="button" className="link-btn" onClick={toggleShow}>Göster</button></p>
          )}
        </>
      )}
    </div>
  );
}
