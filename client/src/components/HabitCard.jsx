import React from 'react';
import { 
  Flame, 
  Trash2, 
  Edit3, 
  Check, 
  Plus, 
  Dumbbell, 
  Briefcase, 
  Coins, 
  BookOpen, 
  Users, 
  Activity, 
  Award 
} from 'lucide-react';

const getCategoryLabel = (cat) => {
  switch (cat) {
    case 'health': return 'Sağlık / Spor';
    case 'career': return 'Kariyer / İş';
    case 'finance': return 'Finans';
    case 'education': return 'Gelişim / Eğitim';
    case 'social': return 'Sosyal / Aile';
    case 'general': return 'Genel';
    default: return cat;
  }
};

const getCategoryIcon = (cat) => {
  switch (cat) {
    case 'health': return <Dumbbell size={14} />;
    case 'career': return <Briefcase size={14} />;
    case 'finance': return <Coins size={14} />;
    case 'education': return <BookOpen size={14} />;
    case 'social': return <Users size={14} />;
    default: return <Activity size={14} />;
  }
};

const formatDateLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function HabitCard({
  habit,
  index,
  onEdit,
  onDelete,
  onLogHabit,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  draggedIndex,
  dragOverIndex
}) {
  const getTargetForDate = (date) => {
    if (habit.weekly_targets && habit.weekly_targets.length === 7) {
      let dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      if (dayOfWeek === 0) dayOfWeek = 7;
      return habit.weekly_targets[dayOfWeek - 1] || 0;
    }
    return habit.target_count || 1;
  };

  // Helper to check if habit is required on a specific day
  const isRequiredDay = (date) => {
    if (habit.weekly_targets && habit.weekly_targets.length === 7) {
      let dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      if (dayOfWeek === 0) dayOfWeek = 7;
      return (habit.weekly_targets[dayOfWeek - 1] || 0) > 0;
    }
    if (habit.frequency === 'daily') return true;
    if (habit.frequency === 'custom') {
      let dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      if (dayOfWeek === 0) dayOfWeek = 7;
      return (habit.custom_days || []).includes(dayOfWeek);
    }
    return true;
  };

  // Generate last 7 days (6 days ago to today)
  const getPast7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d);
    }
    return days;
  };

  const pastDays = getPast7Days();

  // Get log for a specific date string
  const getLogForDate = (dateStr) => {
    return (habit.logs || []).find(l => l.log_date === dateStr);
  };

  const handleDayClick = (date) => {
    const dateStr = formatDateLocal(date);
    const log = getLogForDate(dateStr);
    const currentCount = log ? log.count : 0;
    const dayTarget = getTargetForDate(date);
    
    // Toggle / increment logic
    let newCount = 0;
    if (dayTarget === 1) {
      newCount = currentCount > 0 ? 0 : 1;
    } else {
      newCount = currentCount >= dayTarget ? 0 : currentCount + 1;
    }

    onLogHabit(habit.id, dateStr, newCount);
  };

  const today = new Date();
  const todayStr = formatDateLocal(today);
  const todayLog = getLogForDate(todayStr);
  const todayCount = todayLog ? todayLog.count : 0;
  const todayTarget = getTargetForDate(today);
  const todayRequired = isRequiredDay(today);

  const isDragging = index === draggedIndex;
  const isDragOver = index === dragOverIndex;

  return (
    <div 
      className={`project-card glass-card ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
      onClick={() => onEdit(habit)}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        minHeight: 'auto',
        padding: '16px 20px',
        gap: '20px',
        width: '100%',
        marginBottom: '0px'
      }}
    >
      {/* Left: Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
          <span className={`badge badge-category-${['health', 'career', 'finance', 'education', 'social', 'general'].includes(habit.category) ? habit.category : 'custom'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px 8px', fontSize: '10px' }}>
            {getCategoryIcon(habit.category)}
            {getCategoryLabel(habit.category)}
          </span>
          
          {habit.streak_current > 0 && (
            <span className="badge badge-priority-5 pulse-priority" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px 8px', fontSize: '10px' }}>
              <Flame size={10} style={{ color: 'var(--danger)' }} />
              {habit.streak_current} Gün Seri
            </span>
          )}

          {habit.streak_longest > 0 && (
            <span className="badge badge-priority-3" style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px 8px', fontSize: '10px' }} title="En Uzun Seri">
              <Award size={10} style={{ color: 'var(--warning)' }} />
              En İyi: {habit.streak_longest}
            </span>
          )}
        </div>

        <h4 className="project-card-title" style={{ fontSize: '16px', fontWeight: 600, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {habit.title}
        </h4>
        {habit.description && (
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {habit.description}
          </p>
        )}

        {todayRequired ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }} onClick={(e) => e.stopPropagation()}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>Bugünkü İlerleme:</span>
            <span style={{ fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', minWidth: '30px', textAlign: 'center', color: todayCount >= todayTarget ? 'var(--success)' : 'var(--text-main)' }}>
              {todayCount}/{todayTarget}
            </span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                className="btn btn-secondary btn-icon-only"
                style={{ width: '22px', height: '22px', borderRadius: '4px', padding: 0 }}
                onClick={() => {
                  const newCount = Math.max(0, todayCount - 1);
                  onLogHabit(habit.id, todayStr, newCount);
                }}
                disabled={todayCount <= 0}
                title="1 Azalt"
              >
                -
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-icon-only"
                style={{ width: '22px', height: '22px', borderRadius: '4px', padding: 0 }}
                onClick={() => {
                  const newCount = todayCount + 1;
                  onLogHabit(habit.id, todayStr, newCount);
                }}
                title="1 Artır"
              >
                +
              </button>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px', fontStyle: 'italic' }}>
            Bugün yapılması gerekmiyor
          </div>
        )}
      </div>

      {/* Middle: Last 7 Days tracker */}
      <div 
        style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        {pastDays.map((date) => {
          const dateStr = formatDateLocal(date);
          const log = getLogForDate(dateStr);
          const currentCount = log ? log.count : 0;
          const dayTarget = getTargetForDate(date);
          const completed = dayTarget > 0 && currentCount >= dayTarget;
          const required = isRequiredDay(date);
          
          // Day of week letter (Pt, Sa...)
          const daysOfWeekNames = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'];
          const dayLabel = daysOfWeekNames[date.getDay()];
          const isToday = formatDateLocal(new Date()) === dateStr;

          return (
            <div 
              key={dateStr} 
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
            >
              <span style={{ fontSize: '10px', fontWeight: 600, color: isToday ? 'var(--primary)' : 'var(--text-muted)' }}>
                {dayLabel}
              </span>
              
              <div
                className={`habit-day-btn ${completed ? 'completed' : ''} ${!required ? 'not-required' : ''} ${isToday ? 'is-today' : ''}`}
                onClick={() => required && handleDayClick(date)}
                title={
                  !required 
                    ? 'Yapılması gerekmiyor' 
                    : (dayTarget > 1 ? `${currentCount}/${dayTarget} tamamlandı (Tıkla ve artır)` : (completed ? 'Tamamlandı' : 'Tamamlanmadı'))
                }
              >
                {!required ? (
                  <span>-</span>
                ) : completed ? (
                  <Check size={14} />
                ) : dayTarget > 1 ? (
                  <span style={{ fontSize: '10px', fontWeight: 700, color: currentCount > 0 ? 'var(--warning)' : 'inherit' }}>
                    {currentCount}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* Right: Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        <button 
          className="btn-card-action" 
          onClick={() => onEdit(habit)} 
          title="Alışkanlığı Düzenle"
          style={{ padding: '6px' }}
        >
          <Edit3 size={15} />
        </button>
        <button 
          className="btn-card-action delete" 
          onClick={() => onDelete(habit.id)} 
          title="Alışkanlığı Sil"
          style={{ padding: '6px' }}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}
