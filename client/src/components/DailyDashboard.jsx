import { Plus, AlertTriangle, RefreshCw, Flame, Sparkles, CheckCircle2 } from 'lucide-react';
import HabitCard from './HabitCard';
import HabitMatrix from './HabitMatrix';
import HabitKPIs from './HabitKPIs';
import RoutinesDashboard from './RoutinesDashboard';
import { dailyProgress } from '../daily';

export default function DailyDashboard({
  habits,
  habitsLoading,
  habitsError,
  habitsViewMode,
  setHabitsViewMode,
  onRetryHabits,
  onCreateHabit,
  onEditHabit,
  onDeleteHabit,
  onLogHabit,
  habitDrag,
  routines,
  onSaveRoutine,
  onToggleRoutineComplete,
  onDeleteRoutine,
  onStartRoutine,
  onToggleStep
}) {
  const progress = dailyProgress(habits, routines);
  const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="daily-page">
      {/* Today summary */}
      <section className="glass-card daily-hero">
        <div
          className="daily-ring"
          style={{ background: `conic-gradient(var(--success) ${progress.percent * 3.6}deg, rgba(148,163,184,0.18) 0deg)` }}
        >
          <div className="daily-ring-inner">
            <strong>%{progress.percent}</strong>
            <span>bugün</span>
          </div>
        </div>
        <div className="daily-hero-text">
          <h2>
            {progress.total > 0 && progress.done === progress.total
              ? 'Bugünün hepsi tamam! 🎉'
              : 'Bugünün planı'}
          </h2>
          <p>
            {progress.done}/{progress.total} tamamlandı —{' '}
            {progress.habitsDone}/{progress.habitsTotal} alışkanlık, {progress.routinesDone}/{progress.routinesTotal} rutin
          </p>
        </div>
        <div className="daily-hero-actions">
          <button className="btn btn-secondary" onClick={() => jump('daily-habits')}>
            <Flame size={16} /> Alışkanlıklar
          </button>
          <button className="btn btn-secondary" onClick={() => jump('daily-routines')}>
            <Sparkles size={16} /> Rutinler
          </button>
        </div>
      </section>

      {/* Habits */}
      <div id="daily-habits" className="daily-anchor">
        <HabitKPIs habits={habits} />

        <section className="action-bar-section">
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Alışkanlıklar</h2>
            <div className="filters glass-card" style={{ display: 'flex', padding: '4px', gap: '4px' }}>
              <button
                className={`filter-btn ${habitsViewMode === 'weekly' ? 'active' : ''}`}
                onClick={() => setHabitsViewMode('weekly')}
                style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
              >
                Haftalık Liste
              </button>
              <button
                className={`filter-btn ${habitsViewMode === 'monthly' ? 'active' : ''}`}
                onClick={() => setHabitsViewMode('monthly')}
                style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
              >
                Aylık Matris
              </button>
            </div>
          </div>
          <button className="btn btn-primary" onClick={onCreateHabit}>
            <Plus /> Yeni Alışkanlık Ekle
          </button>
        </section>

        <section className="projects-grid-section">
          {habitsLoading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Alışkanlıklar yükleniyor...</p>
            </div>
          ) : habitsError ? (
            <div className="empty-state">
              <AlertTriangle style={{ width: '48px', height: '48px', color: 'var(--danger)' }} />
              <h3>Bağlantı Hatası</h3>
              <p>Sunucuya bağlanılamıyor.</p>
              <button className="btn btn-secondary" onClick={onRetryHabits}>
                <RefreshCw /> Tekrar Dene
              </button>
            </div>
          ) : habits.length === 0 ? (
            <div className="empty-state">
              <Flame style={{ width: '56px', height: '56px' }} />
              <h3>Alışkanlık Bulunamadı</h3>
              <p>Henüz hiçbir alışkanlık oluşturmadınız.</p>
              <button className="btn btn-primary" onClick={onCreateHabit}>
                <Plus /> İlk Alışkanlığı Ekle
              </button>
            </div>
          ) : habitsViewMode === 'monthly' ? (
            <HabitMatrix habits={habits} onLogHabit={onLogHabit} />
          ) : (
            <div className="goals-list-container">
              {habits.map((habit, idx) => (
                <HabitCard
                  key={habit.id}
                  habit={habit}
                  index={idx}
                  onEdit={onEditHabit}
                  onDelete={onDeleteHabit}
                  onLogHabit={onLogHabit}
                  {...habitDrag}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Routines */}
      <div id="daily-routines" className="daily-anchor">
        <RoutinesDashboard
          routines={routines}
          onSaveRoutine={onSaveRoutine}
          onToggleRoutineComplete={onToggleRoutineComplete}
          onDeleteRoutine={onDeleteRoutine}
          onStartRoutine={onStartRoutine}
          onToggleStep={onToggleStep}
        />
      </div>
    </div>
  );
}
