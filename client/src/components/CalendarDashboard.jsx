import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Wallet, CheckSquare, Target, Repeat } from 'lucide-react';
import { MONTH_NAMES } from '../receivables';

const DAY_NAMES = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];
const keyOf = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

const toDay = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
};

// One calendar for everything dated: payments due, task deadlines, goal target dates
export default function CalendarDashboard({ receivables, projects, goals, onOpenProject, onOpenGoal, fmt }) {
  const now = new Date();
  const [cursor, setCursor] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [selected, setSelected] = useState(keyOf(new Date(now.getFullYear(), now.getMonth(), now.getDate())));

  const events = useMemo(() => {
    const map = new Map();
    const push = (date, ev) => {
      if (!date) return;
      const k = keyOf(date);
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(ev);
    };

    const paymentTaskIds = new Set();
    receivables.reminders.forEach(l => {
      if (l.taskId) paymentTaskIds.add(l.taskId);
      push(l.date, {
        kind: 'payment', overdue: l.diffDays < 0, title: `${l.client}: ${l.title}`,
        sub: fmt(l.remaining), icon: l.source === 'yearly' ? <Repeat size={12} /> : <Wallet size={12} />,
        open: () => l.projectId && onOpenProject(l.projectId)
      });
    });

    projects.forEach(p => (p.tasks || []).forEach(t => {
      if (t.is_completed || !t.due_date || paymentTaskIds.has(t.id)) return;
      push(toDay(t.due_date), {
        kind: 'task', title: t.title, sub: p.title, icon: <CheckSquare size={12} />,
        overdue: toDay(t.due_date) < new Date(new Date().setHours(0, 0, 0, 0)),
        open: () => onOpenProject(p.id)
      });
    }));

    goals.forEach(g => {
      if (g.is_completed || !g.target_date) return;
      push(toDay(g.target_date), { kind: 'goal', title: g.title, sub: 'Hedef tarihi', icon: <Target size={12} />, open: () => onOpenGoal(g) });
    });
    return map;
  }, [receivables, projects, goals, fmt, onOpenProject, onOpenGoal]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = keyOf(new Date());
  const selectedEvents = events.get(selected) || [];
  const selectedDate = (() => {
    const [y, m, d] = selected.split('-').map(Number);
    return new Date(y, m, d);
  })();

  const move = (delta) => setCursor(new Date(year, month + delta, 1));
  const goToday = () => {
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelected(todayKey);
  };

  return (
    <div className="cal-page">
      <section className="action-bar-section">
        <h2 style={{ fontSize: '24px', fontWeight: 700 }}>Takvim</h2>
        <div className="cal-nav">
          <button className="btn btn-secondary" onClick={() => move(-1)} aria-label="Önceki ay"><ChevronLeft size={18} /></button>
          <strong>{MONTH_NAMES[month]} {year}</strong>
          <button className="btn btn-secondary" onClick={() => move(1)} aria-label="Sonraki ay"><ChevronRight size={18} /></button>
          <button className="btn btn-secondary" onClick={goToday}>Bugün</button>
        </div>
      </section>

      <div className="cal-layout">
        <section className="glass-card cal-card">
          <div className="cal-grid cal-head">
            {DAY_NAMES.map(d => <span key={d}>{d}</span>)}
          </div>
          <div className="cal-grid">
            {cells.map((date, i) => {
              if (!date) return <div key={i} className="cal-cell empty" />;
              const k = keyOf(date);
              const evs = events.get(k) || [];
              const hasOverdue = evs.some(e => e.overdue);
              return (
                <button
                  key={k}
                  className={`cal-cell ${k === todayKey ? 'today' : ''} ${k === selected ? 'selected' : ''}`}
                  onClick={() => setSelected(k)}
                >
                  <span className="cal-day">{date.getDate()}</span>
                  <span className="cal-dots">
                    {evs.slice(0, 4).map((e, idx) => (
                      <i key={idx} className={`dot ${e.kind} ${e.overdue ? 'overdue' : ''}`} />
                    ))}
                    {evs.length > 4 && <small>+{evs.length - 4}</small>}
                  </span>
                  {hasOverdue && <span className="cal-flag" />}
                </button>
              );
            })}
          </div>
          <div className="cal-legend">
            <span><i className="dot payment" /> Ödeme</span>
            <span><i className="dot task" /> Görev</span>
            <span><i className="dot goal" /> Hedef</span>
            <span><i className="dot payment overdue" /> Geciken</span>
          </div>
        </section>

        <section className="glass-card cal-side">
          <h3>{selectedDate.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}</h3>
          {selectedEvents.length === 0 ? (
            <p className="cal-empty">Bu gün için kayıt yok.</p>
          ) : (
            <div className="cal-events">
              {selectedEvents.map((e, i) => (
                <button key={i} className={`cal-event ${e.kind} ${e.overdue ? 'overdue' : ''}`} onClick={e.open}>
                  <span className="cal-event-icon">{e.icon}</span>
                  <span className="cal-event-text">
                    <strong>{e.title}</strong>
                    <small>{e.sub}</small>
                  </span>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
