import React from 'react';
import { Flame, Check, Info } from 'lucide-react';

const formatDateLocal = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function HabitMatrix({
  habits = [],
  onLogHabit
}) {
  const today = new Date();
  
  // Calculate days in current month
  const getDaysInCurrentMonth = () => {
    const year = today.getFullYear();
    const month = today.getMonth();
    const numDays = new Date(year, month + 1, 0).getDate();
    
    const days = [];
    for (let i = 1; i <= numDays; i++) {
      days.push(new Date(year, month, i));
    }
    return days;
  };

  const days = getDaysInCurrentMonth();
  const monthName = today.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });

  // Check if a habit is required on a date
  const isRequiredDay = (habit, date) => {
    if (habit.weekly_targets && habit.weekly_targets.length === 7) {
      let dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      if (dayOfWeek === 0) dayOfWeek = 7;
      return (habit.weekly_targets[dayOfWeek - 1] || 0) > 0;
    }
    if (habit.frequency === 'daily') return true;
    if (habit.frequency === 'custom') {
      let dayOfWeek = date.getDay();
      if (dayOfWeek === 0) dayOfWeek = 7;
      return (habit.custom_days || []).includes(dayOfWeek);
    }
    return true;
  };

  const getTargetForDate = (habit, date) => {
    if (habit.weekly_targets && habit.weekly_targets.length === 7) {
      let dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.
      if (dayOfWeek === 0) dayOfWeek = 7;
      return habit.weekly_targets[dayOfWeek - 1] || 0;
    }
    return habit.target_count || 1;
  };

  // Get log count
  const getLogCount = (habit, dateStr) => {
    const log = (habit.logs || []).find(l => l.log_date === dateStr);
    return log ? log.count : 0;
  };

  const handleCellClick = (habit, date) => {
    const dateStr = formatDateLocal(date);
    const targetCount = getTargetForDate(habit, date);
    const currentCount = getLogCount(habit, dateStr);

    let newCount = 0;
    if (targetCount === 1) {
      newCount = currentCount > 0 ? 0 : 1;
    } else {
      newCount = currentCount >= targetCount ? 0 : currentCount + 1;
    }

    onLogHabit(habit.id, dateStr, newCount);
  };

  return (
    <div className="glass-card" style={{ padding: '24px', width: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)' }}>
          {monthName} Aylık Matris
        </h3>
        
        <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)' }}></div>
            <span>Beklemede</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--warning-glow)', border: '1px solid var(--warning)' }}></div>
            <span>Kısmi</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--success)' }}></div>
            <span>Tamamlandı</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>-</div>
            <span>Hariç</span>
          </div>
        </div>
      </div>

      <div className="table-scroll-container" style={{ overflowX: 'auto', width: '100%', paddingBottom: '10px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '850px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
              <th style={{ textAlign: 'left', padding: '10px 8px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, width: '220px' }}>Alışkanlık</th>
              <th style={{ textAlign: 'center', padding: '10px 8px', fontSize: '12px', color: 'var(--text-muted)', fontWeight: 600, width: '60px' }}>Seri</th>
              {days.map(d => {
                const dayNum = d.getDate();
                const isToday = formatDateLocal(new Date()) === formatDateLocal(d);
                return (
                  <th 
                    key={dayNum} 
                    style={{ 
                      textAlign: 'center', 
                      padding: '8px 4px', 
                      fontSize: '11px', 
                      color: isToday ? 'var(--primary)' : 'var(--text-muted)', 
                      fontWeight: isToday ? 'bold' : 'normal',
                      minWidth: '24px'
                    }}
                  >
                    {dayNum}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {habits.length === 0 ? (
              <tr>
                <td colSpan={days.length + 2} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                    <Info size={24} />
                    <span>Henüz tanımlı bir alışkanlık bulunmamaktadır.</span>
                  </div>
                </td>
              </tr>
            ) : (
              habits.map(habit => {
                return (
                  <tr key={habit.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }} className="habit-matrix-row">
                    <td style={{ padding: '12px 8px', fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', maxWidth: '220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {habit.title}
                    </td>
                    <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                      {habit.streak_current > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px', color: 'var(--danger)', fontSize: '12px', fontWeight: 'bold' }}>
                          <Flame size={12} /> {habit.streak_current}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>0</span>
                      )}
                    </td>
                    {days.map(d => {
                      const dateStr = formatDateLocal(d);
                      const required = isRequiredDay(habit, d);
                      const currentCount = getLogCount(habit, dateStr);
                      const target = getTargetForDate(habit, d);
                      const completed = target > 0 && currentCount >= target;
                      const partial = target > 0 && currentCount > 0 && currentCount < target;
                      
                      const isToday = formatDateLocal(new Date()) === dateStr;

                      return (
                        <td key={dateStr} style={{ padding: '6px 2px', textAlign: 'center' }}>
                          <div
                            onClick={() => required && handleCellClick(habit, d)}
                            style={{
                              width: '18px',
                              height: '18px',
                              borderRadius: '4px',
                              margin: '0 auto',
                              cursor: required ? 'pointer' : 'default',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: isToday ? '1.5px solid var(--primary)' : '1px solid var(--glass-border)',
                              background: !required 
                                ? 'rgba(255,255,255,0.02)' 
                                : completed 
                                  ? 'var(--success)' 
                                  : partial 
                                    ? 'var(--warning-glow)' 
                                    : 'rgba(255,255,255,0.05)',
                              boxShadow: (required && completed) ? '0 0 5px var(--success-glow)' : 'none',
                              color: completed ? '#fff' : (partial ? 'var(--warning)' : 'var(--text-muted)'),
                              fontSize: '8px',
                              fontWeight: 'bold',
                              transition: 'all 0.15s ease'
                            }}
                            title={
                              !required 
                                ? 'Yapılması gerekmiyor' 
                                : `${d.toLocaleDateString('tr-TR')}: ${currentCount}/${target} tamamlandı`
                            }
                          >
                            {!required ? (
                              <span style={{ fontSize: '10px' }}>-</span>
                            ) : completed ? (
                              <Check size={8} style={{ strokeWidth: 4 }} />
                            ) : partial ? (
                              <span>{currentCount}</span>
                            ) : null}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
