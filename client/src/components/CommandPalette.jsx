import { useEffect, useMemo, useRef, useState } from 'react';
import { registerBack } from '../backStack';
import { Search, FolderKanban, CheckSquare, Users, Target, Flame, Sparkles, BookOpen, Home, Wallet, CalendarDays, HeartPulse, StickyNote } from 'lucide-react';

const norm = (s) => String(s || '').toLocaleLowerCase('tr');

const PAGES = [
  { id: 'home', label: 'Ana Sayfa', icon: <Home size={16} /> },
  { id: 'projects', label: 'Projeler', icon: <FolderKanban size={16} /> },
  { id: 'goals', label: 'Hedefler', icon: <Target size={16} /> },
  { id: 'daily', label: 'Günlük Düzen', icon: <Flame size={16} /> },
  { id: 'receivables', label: 'Alacaklar', icon: <Wallet size={16} /> },
  { id: 'calendar', label: 'Takvim', icon: <CalendarDays size={16} /> },
  { id: 'health', label: 'Sağlık (spor ve beslenme)', icon: <HeartPulse size={16} /> },
  { id: 'notes', label: 'Notlar', icon: <StickyNote size={16} /> },
  { id: 'journal', label: 'Günlük', icon: <BookOpen size={16} /> }
];

// Ctrl/Cmd+K: search everything and jump to it
export default function CommandPalette({
  open, onClose, projects, goals, habits, routines, journalEntries, clients,
  onNavigate, onOpenProject, onOpenGoal, onOpenHabit
}) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  // Phone back button closes the palette
  useEffect(() => {
    if (!open) return undefined;
    const back = registerBack(() => onClose());
    return () => back.release();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const items = useMemo(() => {
    const all = [];
    PAGES.forEach(p => all.push({ key: `page-${p.id}`, group: 'Sayfalar', icon: p.icon, title: p.label, run: () => onNavigate(p.id) }));
    projects.forEach(p => {
      all.push({ key: `p-${p.id}`, group: 'Projeler', icon: <FolderKanban size={16} />, title: p.title, sub: p.client || 'Kişisel', run: () => { onNavigate('projects'); onOpenProject(p.id); } });
      (p.tasks || []).forEach(t => all.push({
        key: `t-${t.id}`, group: 'Görevler', icon: <CheckSquare size={16} />, title: t.title,
        sub: `${p.title}${t.is_completed ? ' · tamamlandı' : ''}`, run: () => { onNavigate('projects'); onOpenProject(p.id); }
      }));
    });
    clients.forEach(c => all.push({ key: `c-${c}`, group: 'Müşteriler', icon: <Users size={16} />, title: c, sub: 'Alacaklar', run: () => onNavigate('receivables') }));
    goals.forEach(g => all.push({ key: `g-${g.id}`, group: 'Hedefler', icon: <Target size={16} />, title: g.title, run: () => { onNavigate('goals'); onOpenGoal(g); } }));
    habits.forEach(h => all.push({ key: `h-${h.id}`, group: 'Alışkanlıklar', icon: <Flame size={16} />, title: h.title, run: () => { onNavigate('daily'); onOpenHabit(h); } }));
    routines.forEach(r => all.push({ key: `r-${r.id}`, group: 'Rutinler', icon: <Sparkles size={16} />, title: r.title, run: () => onNavigate('daily') }));
    journalEntries.forEach(e => {
      if (!e.content) return;
      all.push({
        key: `j-${e.id}`, group: 'Günlük', icon: <BookOpen size={16} />,
        title: new Date(e.entry_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' }),
        sub: e.content.slice(0, 80), haystack: e.content, run: () => onNavigate('journal')
      });
    });
    return all;
  }, [projects, goals, habits, routines, journalEntries, clients, onNavigate, onOpenProject, onOpenGoal, onOpenHabit]);

  const results = useMemo(() => {
    const q = norm(query.trim());
    if (!q) return items.filter(i => i.group === 'Sayfalar' || i.group === 'Projeler').slice(0, 12);
    const words = q.split(/\s+/);
    return items
      .filter(i => {
        const hay = norm(`${i.title} ${i.sub || ''} ${i.haystack || ''}`);
        return words.every(w => hay.includes(w));
      })
      .slice(0, 30);
  }, [items, query]);

  useEffect(() => { setIndex(0); }, [query]);
  useEffect(() => {
    listRef.current?.querySelector('.cp-item.active')?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  if (!open) return null;

  const choose = (item) => {
    onClose();
    item.run();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setIndex(i => Math.min(i + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIndex(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' && results[index]) { e.preventDefault(); choose(results[index]); }
  };

  let lastGroup = null;
  return (
    <div className="cp-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cp glass-card" onKeyDown={onKeyDown} role="dialog" aria-label="Ara">
        <div className="cp-input">
          <Search size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Proje, görev, müşteri, hedef, günlük ara..."
          />
          <kbd>Esc</kbd>
        </div>
        <div className="cp-list" ref={listRef}>
          {results.length === 0 && <div className="cp-empty">Sonuç bulunamadı.</div>}
          {results.map((item, i) => {
            const header = item.group !== lastGroup ? <div className="cp-group">{item.group}</div> : null;
            lastGroup = item.group;
            return (
              <div key={item.key}>
                {header}
                <button
                  className={`cp-item ${i === index ? 'active' : ''}`}
                  onMouseEnter={() => setIndex(i)}
                  onClick={() => choose(item)}
                >
                  <span className="cp-icon">{item.icon}</span>
                  <span className="cp-text">
                    <strong>{item.title}</strong>
                    {item.sub && <small>{item.sub}</small>}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
        <div className="cp-foot"><span>↑↓ gez</span><span>Enter aç</span><span>Esc kapat</span></div>
      </div>
    </div>
  );
}
