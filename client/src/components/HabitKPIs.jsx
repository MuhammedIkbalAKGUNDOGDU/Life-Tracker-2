import React from 'react';
import { CheckSquare, Flame, Trophy, Award } from 'lucide-react';

const formatDateLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function HabitKPIs({ habits = [] }) {
  const total = habits.length;
  const activeStreaksCount = habits.filter(h => h.streak_current > 0).length;
  const bestStreak = habits.length > 0 
    ? Math.max(0, ...habits.map(h => h.streak_longest || 0)) 
    : 0;

  // Calculate today's completion rate
  const today = new Date();
  const todayStr = formatDateLocal(today);

  const isRequiredToday = (habit) => {
    if (habit.frequency === 'daily') return true;
    if (habit.frequency === 'custom') {
      let dayOfWeek = today.getDay();
      if (dayOfWeek === 0) dayOfWeek = 7;
      return (habit.custom_days || []).includes(dayOfWeek);
    }
    return true;
  };

  const requiredTodayHabits = habits.filter(isRequiredToday);
  const requiredTodayCount = requiredTodayHabits.length;
  const completedTodayCount = requiredTodayHabits.filter(h => {
    const log = (h.logs || []).find(l => l.log_date === todayStr);
    return log && log.count >= (h.target_count || 1);
  }).length;

  const todayPercent = requiredTodayCount > 0 
    ? Math.round((completedTodayCount / requiredTodayCount) * 100) 
    : 0;

  return (
    <section className="stats-section">
      {/* Total Habits */}
      <div className="stat-card glass-card">
        <div className="stat-header">
          <span className="stat-title">Toplam Alışkanlık</span>
          <div className="stat-icon-wrapper blue">
            <CheckSquare />
          </div>
        </div>
        <div className="stat-value">{total}</div>
        <div className="stat-desc">Günlük & haftalık rutinler</div>
      </div>

      {/* Active Streaks */}
      <div className="stat-card glass-card">
        <div className="stat-header">
          <span className="stat-title">Aktif Zincirler</span>
          <div className="stat-icon-wrapper orange">
            <Flame />
          </div>
        </div>
        <div className="stat-value">{activeStreaksCount}</div>
        <div className="stat-desc">Serisi devam eden alışkanlıklar</div>
      </div>

      {/* Best Streak */}
      <div className="stat-card glass-card">
        <div className="stat-header">
          <span className="stat-title">En İyi Seri</span>
          <div className="stat-icon-wrapper violet">
            <Trophy />
          </div>
        </div>
        <div className="stat-value">{bestStreak} <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>gün</span></div>
        <div className="stat-desc">Kırılmayan en uzun zincir rekoru</div>
      </div>

      {/* Today's Progress */}
      <div className="stat-card glass-card">
        <div className="stat-header">
          <span className="stat-title">Bugün Neredeyiz?</span>
          <div className="stat-icon-wrapper emerald">
            <Award />
          </div>
        </div>
        <div className="stat-value">
          {completedTodayCount} / {requiredTodayCount}
        </div>
        <div className="stat-progress-container" title={`Bugün yapılması gereken alışkanlıkların %${todayPercent}'i tamamlandı.`}>
          <div className="stat-progress-bar" style={{ width: `${todayPercent}%`, backgroundColor: 'var(--success)' }}></div>
        </div>
      </div>
    </section>
  );
}
