import {
  Flame,
  Sparkles,
  Check,
  Bell,
  ArrowRight,
  FolderKanban,
  Target,
  Wallet,
  BookOpen,
  Plus,
  Minus,
  AlertCircle,
  Clock,
  Star,
  CheckSquare,
  BarChart3,
  Eye,
  EyeOff
} from 'lucide-react';
import { dailyProgress, habitsToday } from '../daily';
import { dueLabel, dueColor } from '../receivables';

const greeting = () => {
  const h = new Date().getHours();
  if (h < 6) return 'İyi geceler';
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
};

export default function HomeDashboard({
  receivables,
  habits,
  routines,
  goals,
  projects,
  displayCurrency,
  hideAmounts,
  setHideAmounts,
  usdTryRate,
  onNavigate,
  onOpenProject,
  onLogHabit,
  onToggleRoutineComplete,
  onToggleTask
}) {
  const progress = dailyProgress(habits, routines);
  const { totals, reminders } = receivables;

  const fmt = (tryValue) => {
    if (hideAmounts) return displayCurrency === 'USD' ? '*** $' : '*** ₺';
    const value = displayCurrency === 'USD' ? tryValue / usdTryRate : tryValue;
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: displayCurrency, maximumFractionDigits: 0 }).format(value);
  };

  const weekTotal = reminders.filter(r => r.diffDays >= 0 && r.diffDays <= 7).reduce((s, l) => s + l.remaining, 0);
  const activeProjects = projects.filter(p => p.status === 'in_progress');
  const openGoals = goals
    .filter(g => !g.is_completed && !(g.progress_type === 'metric' && parseFloat(g.current_value) >= parseFloat(g.target_value)))
    .slice(0, 4);


  // Tasks for today: starred ones, plus non-payment tasks due today or overdue
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const todayTasks = [];
  projects.forEach(p => (p.tasks || []).forEach(t => {
    if (t.is_completed) return;
    const due = t.due_date ? new Date(t.due_date) : null;
    if (due) due.setHours(0, 0, 0, 0);
    const isPayment = p.type === 'external' && parseFloat(t.price) > parseFloat(t.paid_price || 0);
    const dueNow = due && due <= startOfToday && !isPayment;
    if (t.is_today || dueNow) todayTasks.push({ task: t, project: p, overdue: due && due < startOfToday });
  }));
  todayTasks.sort((a, b) => (a.task.priority || 2) - (b.task.priority || 2));

  // Weekly summary (last 7 days)
  const weekStart = new Date(startOfToday);
  weekStart.setDate(weekStart.getDate() - 6);
  let tasksDone = 0;
  projects.forEach(p => (p.tasks || []).forEach(t => {
    if (t.completed_at && new Date(t.completed_at) >= weekStart) tasksDone += 1;
  }));
  let habitRequired = 0;
  let habitDone = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfToday);
    d.setDate(d.getDate() - i);
    const list = habitsToday(habits, d);
    habitRequired += list.length;
    habitDone += list.filter(h => h.done).length;
  }
  const habitPercent = habitRequired > 0 ? Math.round((habitDone / habitRequired) * 100) : 0;
  const collectedWeek = receivables.entries
    .filter(e => e.kind === 'paid' && e.date >= weekStart && e.date <= new Date(startOfToday.getTime() + 86399999))
    .reduce((sum, e) => sum + e.amount, 0);

  const cycleHabit = ({ habit, dateStr, count, target }, delta) => {
    let next;
    if (delta !== undefined) next = Math.max(0, Math.min(target, count + delta));
    else next = target === 1 ? (count > 0 ? 0 : 1) : (count >= target ? 0 : count + 1);
    onLogHabit(habit.id, dateStr, next);
  };

  const todayLabel = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="home-page">
      <section className="home-greeting">
        <div>
          <h2>{greeting()}, İkbal 👋</h2>
          <p>{todayLabel}</p>
        </div>
        <div className="home-quick">
          <button
            className="btn btn-secondary"
            onClick={() => setHideAmounts(!hideAmounts)}
            title={hideAmounts ? 'Tutarları göster' : 'Tutarları gizle'}
          >
            {hideAmounts ? <EyeOff size={16} /> : <Eye size={16} />} Tutarlar
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate('projects')}><FolderKanban size={16} /> Projeler</button>
          <button className="btn btn-secondary" onClick={() => onNavigate('receivables')}><Wallet size={16} /> Alacaklar</button>
          <button className="btn btn-secondary" onClick={() => onNavigate('journal')}><BookOpen size={16} /> Günlük yaz</button>
        </div>
      </section>

      {/* Summary tiles */}
      <section className="home-tiles">
        <button className="home-tile glass-card" onClick={() => onNavigate('daily')}>
          <span className="home-tile-label"><Flame size={14} /> Bugün</span>
          <strong>{progress.done}/{progress.total}</strong>
          <div className="home-tile-bar"><div style={{ width: `${progress.percent}%` }} /></div>
          <small>alışkanlık + rutin</small>
        </button>
        <button className="home-tile glass-card" onClick={() => onNavigate('receivables')}>
          <span className="home-tile-label"><Clock size={14} /> Bu hafta gelecek</span>
          <strong>{fmt(weekTotal)}</strong>
          <small>Önümüzdeki 30 gün: {fmt(totals.next30)}</small>
        </button>
        <button className="home-tile glass-card" onClick={() => onNavigate('receivables')}>
          <span className="home-tile-label" style={{ color: totals.overdue > 0 ? '#ef4444' : undefined }}><AlertCircle size={14} /> Geciken</span>
          <strong style={{ color: totals.overdue > 0 ? '#ef4444' : undefined }}>{fmt(totals.overdue)}</strong>
          <small>{reminders.filter(r => r.diffDays < 0).length} kalem</small>
        </button>
        <button className="home-tile glass-card" onClick={() => onNavigate('receivables')}>
          <span className="home-tile-label"><Wallet size={14} /> Toplam kalan alacak</span>
          <strong>{fmt(totals.remaining)}</strong>
          <small>{fmt(totals.paid)} tahsil edildi</small>
        </button>
      </section>

      <div className="home-columns">
        {/* Left: today + reminders */}
        <div className="home-col">
          {todayTasks.length > 0 && (
            <section className="glass-card home-card">
              <div className="home-card-head">
                <h3><Star size={18} /> Bugünün görevleri</h3>
                <button className="home-link" onClick={() => onNavigate('projects')}>Projeler <ArrowRight size={14} /></button>
              </div>
              <div className="home-todo">
                {todayTasks.map(({ task, project, overdue }) => (
                  <div key={task.id} className="home-todo-row">
                    <button className="home-check" onClick={() => onToggleTask(task.id)} aria-label="Görevi tamamla" />
                    <span className="home-todo-title" style={{ cursor: 'pointer' }} onClick={() => onOpenProject(project.id)}>
                      <i className={`prio-dot p${task.priority || 2}`} style={{ display: 'inline-block' }} /> {task.title}
                    </span>
                    <small style={{ color: overdue ? '#ef4444' : undefined }}>{overdue ? 'gecikti · ' : ''}{project.title}</small>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className="glass-card home-card">
            <div className="home-card-head">
              <h3><Flame size={18} /> Bugün yapılacaklar</h3>
              <button className="home-link" onClick={() => onNavigate('daily')}>Tümü <ArrowRight size={14} /></button>
            </div>
            {progress.total === 0 ? (
              <p className="home-empty">Bugün için alışkanlık veya rutin yok.</p>
            ) : (
              <div className="home-todo">
                {routines.map(r => (
                  <div key={`r-${r.id}`} className={`home-todo-row ${r.is_completed_today ? 'done' : ''}`}>
                    <button
                      className={`home-check ${r.is_completed_today ? 'checked' : ''}`}
                      onClick={() => onToggleRoutineComplete(r.id, !r.is_completed_today)}
                      aria-label="Rutini tamamla"
                    >
                      {r.is_completed_today && <Check size={14} />}
                    </button>
                    <span className="home-todo-title"><Sparkles size={13} /> {r.title}</span>
                    <small>{(r.steps || []).filter(s => s.is_completed_today).length}/{(r.steps || []).length} adım</small>
                  </div>
                ))}
                {progress.todayHabits.map(h => (
                  <div key={`h-${h.habit.id}`} className={`home-todo-row ${h.done ? 'done' : ''}`}>
                    <button
                      className={`home-check ${h.done ? 'checked' : ''}`}
                      onClick={() => cycleHabit(h)}
                      aria-label="Alışkanlığı işaretle"
                    >
                      {h.done && <Check size={14} />}
                    </button>
                    <span className="home-todo-title"><Flame size={13} /> {h.habit.title}</span>
                    {h.target > 1 ? (
                      <span className="home-counter">
                        <button onClick={() => cycleHabit(h, -1)} disabled={h.count <= 0}><Minus size={12} /></button>
                        <b>{h.count}/{h.target}</b>
                        <button onClick={() => cycleHabit(h, 1)} disabled={h.count >= h.target}><Plus size={12} /></button>
                      </span>
                    ) : (
                      h.habit.streak_current > 0 && <small>🔥 {h.habit.streak_current} gün</small>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="glass-card home-card">
            <div className="home-card-head">
              <h3><Bell size={18} /> Yaklaşan ödemeler</h3>
              <button className="home-link" onClick={() => onNavigate('receivables')}>Tümü <ArrowRight size={14} /></button>
            </div>
            {reminders.length === 0 ? (
              <p className="home-empty">Bekleyen ödeme yok.</p>
            ) : (
              <div className="home-list">
                {reminders.slice(0, 6).map(l => (
                  <div
                    key={l.id}
                    className="home-row"
                    style={{ borderLeftColor: dueColor(l.diffDays), cursor: l.projectId ? 'pointer' : 'default' }}
                    onClick={() => l.projectId && onOpenProject(l.projectId)}
                  >
                    <div>
                      <strong>{l.client}</strong>
                      <small>{l.title} · {l.source === 'yearly' ? 'Yıllık' : 'Proje'}</small>
                    </div>
                    <div className="home-row-right">
                      <strong>{fmt(l.remaining)}</strong>
                      <small style={{ color: dueColor(l.diffDays) }}>{dueLabel(l.diffDays)}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right: projects + goals */}
        <div className="home-col">
          <section className="glass-card home-card">
            <div className="home-card-head">
              <h3><FolderKanban size={18} /> Devam eden projeler</h3>
              <button className="home-link" onClick={() => onNavigate('projects')}>Tümü <ArrowRight size={14} /></button>
            </div>
            {activeProjects.length === 0 ? (
              <p className="home-empty">Devam eden proje yok.</p>
            ) : (
              <div className="home-list">
                {activeProjects.slice(0, 5).map(p => (
                  <div key={p.id} className="home-row clickable" onClick={() => onOpenProject(p.id)}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong>{p.title}</strong>
                      <small>{p.client || 'Kişisel'}</small>
                      <div className="home-tile-bar"><div style={{ width: `${p.progress}%` }} /></div>
                    </div>
                    <div className="home-row-right"><strong>%{p.progress}</strong></div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="glass-card home-card">
            <div className="home-card-head">
              <h3><Target size={18} /> Hedefler</h3>
              <button className="home-link" onClick={() => onNavigate('goals')}>Tümü <ArrowRight size={14} /></button>
            </div>
            {openGoals.length === 0 ? (
              <p className="home-empty">Açık hedef yok.</p>
            ) : (
              <div className="home-list">
                {openGoals.map(g => {
                  const pct = g.progress_type === 'metric'
                    ? Math.min(100, Math.round((parseFloat(g.current_value) / (parseFloat(g.target_value) || 1)) * 100))
                    : 0;
                  return (
                    <div key={g.id} className="home-row">
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong>{g.title}</strong>
                        {g.progress_type === 'metric' ? (
                          <>
                            <small>{g.current_value}/{g.target_value} {g.unit}</small>
                            <div className="home-tile-bar"><div style={{ width: `${pct}%` }} /></div>
                          </>
                        ) : (
                          <small>Evet / Hayır hedefi</small>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="glass-card home-card">
            <div className="home-card-head">
              <h3><BarChart3 size={18} /> Son 7 gün</h3>
            </div>
            <div className="week-grid">
              <div><CheckSquare size={16} /><strong>{tasksDone}</strong><small>görev tamamlandı</small></div>
              <div><Flame size={16} /><strong>%{habitPercent}</strong><small>alışkanlık ({habitDone}/{habitRequired})</small></div>
              <div><Clock size={16} /><strong>{fmt(collectedWeek)}</strong><small>tahsil edildi</small></div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
