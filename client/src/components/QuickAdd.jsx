import { useState } from 'react';
import { Plus, CheckSquare, StickyNote, FolderKanban, Target, Flame, Star, NotebookPen } from 'lucide-react';
import { api } from '../healthApi';
import { notify } from '../ui';
import ModalShell from './ModalShell';
import NumInput from './NumInput';

// Floating "+" button: add a task, a journal note, or open the other "new" forms from anywhere
export default function QuickAdd({
  projects, onAddTask, onAddNote, onNewProject, onNewGoal, onNewHabit, hidden
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mode, setMode] = useState(null); // 'task' | 'note'

  const [projectId, setProjectId] = useState('');
  const [title, setTitle] = useState('');
  const [isToday, setIsToday] = useState(true);
  const [dueDate, setDueDate] = useState('');
  const [price, setPrice] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const openProjects = projects.filter(p => p.status !== 'completed');
  const selected = projects.find(p => String(p.id) === String(projectId));

  const start = (m) => {
    setMenuOpen(false);
    setMode(m);
    setTitle('');
    setNote('');
    setDueDate('');
    setPrice(0);
    setIsToday(true);
    setProjectId(openProjects[0] ? String(openProjects[0].id) : '');
  };

  const submitTask = async (e) => {
    e.preventDefault();
    if (!title.trim() || !projectId || busy) return;
    setBusy(true);
    const ok = await onAddTask(parseInt(projectId), title.trim(), 1, selected?.type === 'external' ? price : 0, 0, '', dueDate, { is_today: isToday });
    setBusy(false);
    if (ok) setMode(null);
  };

  const submitTodo = async (e) => {
    e.preventDefault();
    if (!note.trim() || busy) return;
    setBusy(true);
    try {
      await api('POST', '/api/notes', { text: note.trim() });
      notify('Not eklendi.', 'success');
      window.dispatchEvent(new Event('notes-changed'));
      setMode(null);
    } finally {
      setBusy(false);
    }
  };

  const submitNote = async (e) => {
    e.preventDefault();
    if (!note.trim() || busy) return;
    setBusy(true);
    await onAddNote(note.trim());
    setBusy(false);
    setMode(null);
  };

  if (hidden) return null;

  const items = [
    { label: 'Görev', icon: <CheckSquare size={16} />, run: () => start('task') },
    { label: 'Not (yapılacak)', icon: <NotebookPen size={16} />, run: () => start('todo') },
    { label: 'Günlük notu', icon: <StickyNote size={16} />, run: () => start('note') },
    { label: 'Proje', icon: <FolderKanban size={16} />, run: () => { setMenuOpen(false); onNewProject(); } },
    { label: 'Hedef', icon: <Target size={16} />, run: () => { setMenuOpen(false); onNewGoal(); } },
    { label: 'Alışkanlık', icon: <Flame size={16} />, run: () => { setMenuOpen(false); onNewHabit(); } }
  ];

  return (
    <>
      <div className="qa">
        {menuOpen && (
          <div className="qa-menu glass-card">
            {items.map(i => (
              <button key={i.label} onClick={i.run}>{i.icon} {i.label}</button>
            ))}
          </div>
        )}
        <button className={`qa-fab ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen(o => !o)} title="Hızlı ekle" aria-label="Hızlı ekle">
          <Plus />
        </button>
      </div>

      {mode === 'task' && (
        <ModalShell onClose={() => setMode(null)} style={{ maxWidth: '480px' }}>
          <div className="modal-header">
            <h2>Hızlı Görev</h2>
            <button className="btn-close" data-modal-close type="button">×</button>
          </div>
          <form onSubmit={submitTask} className="modal-form">
            <div className="modal-body-split" style={{ flexDirection: 'column', gap: '14px', padding: '24px' }}>
              {openProjects.length === 0 ? (
                <p style={{ color: 'var(--text-muted)' }}>Önce bir proje oluşturun.</p>
              ) : (
                <>
                  <div className="form-group">
                    <label>Görev</label>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ne yapılacak?" required />
                  </div>
                  <div className="form-group">
                    <label>Proje</label>
                    <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                      {openProjects.map(p => <option key={p.id} value={p.id}>{p.title}{p.client ? ` — ${p.client}` : ''}</option>)}
                    </select>
                  </div>
                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Vade (isteğe bağlı)</label>
                      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </div>
                    {selected?.type === 'external' && (
                      <div className="form-group">
                        <label>Fiyat (₺)</label>
                        <NumInput value={price} onChange={setPrice} />
                      </div>
                    )}
                  </div>
                  <label className="qa-check">
                    <input type="checkbox" checked={isToday} onChange={(e) => setIsToday(e.target.checked)} />
                    <Star size={14} /> Bugün yapılacaklara ekle
                  </label>
                </>
              )}
            </div>
            <div className="modal-footer">
              <span className="modal-hint">Ctrl+Enter ekler</span>
              <button type="button" className="btn btn-secondary" data-modal-close>Vazgeç</button>
              <button type="submit" className="btn btn-primary" disabled={busy || openProjects.length === 0}>Ekle</button>
            </div>
          </form>
        </ModalShell>
      )}

      {mode === 'todo' && (
        <ModalShell onClose={() => setMode(null)} style={{ maxWidth: '480px' }}>
          <div className="modal-header">
            <h2>Yeni Not</h2>
            <button className="btn-close" data-modal-close type="button">×</button>
          </div>
          <form onSubmit={submitTodo} className="modal-form">
            <div className="modal-body-split" style={{ flexDirection: 'column', gap: '14px', padding: '24px' }}>
              <div className="form-group">
                <label>Not (Notlar sayfasına eklenir, tamamlandı işaretleyebilirsin)</label>
                <textarea rows="4" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ne hatırlamak istiyorsun?" required />
              </div>
            </div>
            <div className="modal-footer">
              <span className="modal-hint">Ctrl+Enter ekler</span>
              <button type="button" className="btn btn-secondary" data-modal-close>Vazgeç</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>Ekle</button>
            </div>
          </form>
        </ModalShell>
      )}

      {mode === 'note' && (
        <ModalShell onClose={() => setMode(null)} style={{ maxWidth: '480px' }}>
          <div className="modal-header">
            <h2>Günlüğe Not</h2>
            <button className="btn-close" data-modal-close type="button">×</button>
          </div>
          <form onSubmit={submitNote} className="modal-form">
            <div className="modal-body-split" style={{ flexDirection: 'column', gap: '14px', padding: '24px' }}>
              <div className="form-group">
                <label>Not (bugünün günlüğüne saatiyle eklenir)</label>
                <textarea rows="5" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Aklından geçeni yaz..." required />
              </div>
            </div>
            <div className="modal-footer">
              <span className="modal-hint">Ctrl+Enter ekler</span>
              <button type="button" className="btn btn-secondary" data-modal-close>Vazgeç</button>
              <button type="submit" className="btn btn-primary" disabled={busy}>Ekle</button>
            </div>
          </form>
        </ModalShell>
      )}
    </>
  );
}
