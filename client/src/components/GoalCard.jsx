
import { 
  Briefcase, 
  Heart, 
  Coins, 
  BookOpen, 
  Users, 
  Target, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  Calendar,
  Flame,
  ExternalLink,
  AlertTriangle
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
    case 'health': return <Heart size={14} />;
    case 'career': return <Briefcase size={14} />;
    case 'finance': return <Coins size={14} />;
    case 'education': return <BookOpen size={14} />;
    case 'social': return <Users size={14} />;
    default: return <Target size={14} />;
  }
};

const getPriorityLabel = (pri) => {
  switch (pri) {
    case 1: return 'Düşük';
    case 2: return 'Orta-Düşük';
    case 3: return 'Orta';
    case 4: return 'Yüksek';
    case 5: return 'Kritik';
    default: return 'Orta';
  }
};

export default function GoalCard({
  goal,
  index,
  onEdit,
  onDelete,
  onToggleGoal,
  onIncrement,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  draggedIndex,
  dragOverIndex,
  viewMode = 'grid'
}) {
  const isCompleted = goal.is_completed || (goal.progress_type === 'metric' && parseFloat(goal.current_value) >= parseFloat(goal.target_value));
  
  // Calculate metric progress percent
  const currentVal = parseFloat(goal.current_value) || 0;
  const targetVal = parseFloat(goal.target_value) || 1;
  const progressPercent = goal.progress_type === 'metric' 
    ? Math.min(100, Math.round((currentVal / targetVal) * 100))
    : (isCompleted ? 100 : 0);

  // Calculate remaining days
  const getDaysRemainingLabel = (targetDateStr) => {
    if (!targetDateStr) return null;
    const targetDate = new Date(targetDateStr);
    targetDate.setHours(0, 0, 0, 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffTime = targetDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return { text: 'Gecikti', className: 'badge-overdue', isOverdue: true };
    } else if (diffDays === 0) {
      return { text: 'Bugün', className: 'badge-today', isToday: true };
    } else if (diffDays === 1) {
      return { text: 'Yarın', className: 'badge-tomorrow' };
    } else {
      return { text: `${diffDays} gün kaldı`, className: 'badge-future' };
    }
  };

  const daysLabel = getDaysRemainingLabel(goal.target_date);
  const isOverdue = !isCompleted && daysLabel && daysLabel.isOverdue;
  const isToday = !isCompleted && daysLabel && daysLabel.isToday;
  const isDragging = index === draggedIndex;
  const isDragOver = index === dragOverIndex;

  if (viewMode === 'list') {
    return (
      <div 
        className={`project-card glass-card ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''} ${isCompleted ? 'goal-completed-card' : ''} ${isOverdue ? 'goal-overdue-card' : ''} ${isToday ? 'goal-today-card' : ''}`}
        onClick={() => onEdit(goal)}
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
          padding: '12px 18px',
          gap: '16px',
          width: '100%',
          marginBottom: '0px'
        }}
      >
        {/* Left Side: Checkbox / Metric Fast Increment */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          {goal.progress_type === 'metric' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {!isCompleted && (
                <button 
                  className="btn btn-secondary btn-icon-only" 
                  onClick={() => onIncrement(goal.id)}
                  title="İlerlemeyi +1 Artır"
                  style={{ width: '28px', height: '28px', borderRadius: '6px' }}
                >
                  <Plus size={14} />
                </button>
              )}
              <span style={{ fontFamily: 'Fira Code, monospace', fontSize: '13px', fontWeight: 600, color: 'var(--success)' }}>
                {currentVal}/{targetVal} {goal.unit || 'adet'}
              </span>
            </div>
          ) : (
            <div 
              className={`custom-checkbox ${isCompleted ? 'checked' : ''}`}
              onClick={() => onToggleGoal(goal)}
              style={{ width: '20px', height: '20px', borderRadius: '5px' }}
            >
              <Check size={12} style={{ display: isCompleted ? 'block' : 'none', color: '#fff' }} />
            </div>
          )}
        </div>

        {/* Center: Title & Motivation (Neden) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 className="project-card-title" style={{ 
            fontSize: '15px', 
            fontWeight: 600, 
            margin: 0, 
            textDecoration: isCompleted ? 'line-through' : 'none', 
            opacity: isCompleted ? 0.6 : 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {goal.title}
          </h4>
          {goal.why_note && (
            <p style={{ 
              fontSize: '12px', 
              fontStyle: 'italic', 
              color: 'var(--text-muted)', 
              margin: '2px 0 0 0', 
              display: 'flex', 
              alignItems: 'center', 
              gap: '4px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}>
              <Flame size={12} style={{ color: 'var(--warning)', flexShrink: 0 }} />
              <span>Neden: "{goal.why_note}"</span>
            </p>
          )}
          {goal.description && (
            <p style={{ 
              fontSize: '12px', 
              color: 'var(--text-muted)', 
              margin: '4px 0 0 0', 
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              opacity: 0.95
            }} title={goal.description}>
              {goal.description}
            </p>
          )}
        </div>

        {/* Center-Right: Badges (Category, Priority, Countdown) */}
        <div className="project-badges" style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'nowrap' }}>
          <span className={`badge badge-category-${['health', 'career', 'finance', 'education', 'social', 'general'].includes(goal.category) ? (goal.category || 'general') : 'custom'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', padding: '3px 8px', fontSize: '10px' }}>
            {getCategoryIcon(goal.category)}
            {getCategoryLabel(goal.category)}
          </span>
          
          <span className={`badge badge-priority-${goal.priority || 3} ${goal.priority === 5 ? 'pulse-priority' : ''}`} style={{ padding: '3px 8px', fontSize: '10px' }}>
            {getPriorityLabel(goal.priority)}
          </span>

          {daysLabel && (
            <span className={`badge ${daysLabel.className} ${isOverdue ? 'pulse-overdue' : ''} ${isToday ? 'pulse-today' : ''}`} style={{ padding: '3px 8px', fontSize: '10px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              {isOverdue || isToday ? <AlertTriangle size={8} /> : <Calendar size={8} style={{ marginRight: '2px' }} />}
              {daysLabel.text}
            </span>
          )}

          {goal.link_url && (
            <a 
              href={goal.link_url} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="badge badge-priority-2" 
              style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'pointer', textDecoration: 'none', padding: '3px 8px', fontSize: '10px' }}
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={8} />
              Link
            </a>
          )}
        </div>

        {/* Right Side: Date & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '8px' }} className="hide-on-mobile">
            {new Date(goal.created_at).toLocaleDateString('tr-TR')}
          </span>
          
          <button 
            className="btn-card-action" 
            onClick={() => onEdit(goal)} 
            title="Hedefi Düzenle"
            style={{ padding: '4px' }}
          >
            <Edit3 size={15} />
          </button>
          
          <button 
            className="btn-card-action delete" 
            onClick={() => onDelete(goal.id)} 
            title="Hedefi Sil"
            style={{ padding: '4px' }}
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div 
      className={`project-card glass-card ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''} ${isCompleted ? 'goal-completed-card' : ''} ${isOverdue ? 'goal-overdue-card' : ''} ${isToday ? 'goal-today-card' : ''}`}
      onClick={() => onEdit(goal)}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
    >
      <div>
        <div className="project-card-header">
          <div className="project-badges">
            <span className={`badge badge-category-${['health', 'career', 'finance', 'education', 'social', 'general'].includes(goal.category) ? (goal.category || 'general') : 'custom'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              {getCategoryIcon(goal.category)}
              {getCategoryLabel(goal.category)}
            </span>
            
            <span className={`badge badge-priority-${goal.priority || 3} ${goal.priority === 5 ? 'pulse-priority' : ''}`}>
              {getPriorityLabel(goal.priority)}
            </span>

            {daysLabel && (
              <span className={`badge ${daysLabel.className} ${isOverdue ? 'pulse-overdue' : ''} ${isToday ? 'pulse-today' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                {isOverdue || isToday ? <AlertTriangle size={10} /> : <Calendar size={10} style={{ marginRight: '3px' }} />}
                {daysLabel.text}
              </span>
            )}

            {goal.link_url && (
              <a 
                href={goal.link_url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="badge badge-priority-2" 
                style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', cursor: 'pointer', textDecoration: 'none' }}
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={10} />
                Bağlantı
              </a>
            )}
          </div>
        </div>

        <h3 className="project-card-title" style={{ textDecoration: isCompleted ? 'line-through' : 'none', opacity: isCompleted ? 0.6 : 1 }}>
          {goal.title}
        </h3>

        {goal.why_note && (
          <p style={{ fontSize: '13px', fontStyle: 'italic', color: 'var(--text-muted)', marginBottom: '6px', display: 'flex', alignItems: 'flex-start', gap: '5px' }}>
            <Flame size={13} style={{ color: 'var(--warning)', marginTop: '2px', flexShrink: 0 }} />
            <span>Neden: "{goal.why_note}"</span>
          </p>
        )}
        {goal.description && (
          <p style={{ 
            fontSize: '13px', 
            color: 'var(--text-main)', 
            opacity: 0.85, 
            marginBottom: '10px', 
            whiteSpace: 'pre-line',
            lineHeight: 1.4
          }}>
            {goal.description}
          </p>
        )}
      </div>

      <div>
        {goal.progress_type === 'metric' ? (
          /* Metric goal progress bar */
          <div className="project-card-progress-wrapper" onClick={(e) => e.stopPropagation()}>
            <div className="progress-info">
              <span className="progress-label" style={{ fontFamily: 'Fira Code, monospace', fontWeight: 600, color: 'var(--success)' }}>
                {currentVal} / {targetVal} {goal.unit || 'adet'}
              </span>
              <span className="progress-value">{progressPercent}%</span>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="progress-bar-track" style={{ flex: 1 }}>
                <div className="progress-bar-fill" style={{ width: `${progressPercent}%`, backgroundColor: isCompleted ? 'var(--success)' : 'var(--primary)' }}></div>
              </div>
              
              {!isCompleted && (
                <button 
                  className="btn btn-secondary btn-icon-only" 
                  onClick={() => onIncrement(goal.id)}
                  title="İlerlemeyi +1 Artır"
                  style={{ width: '32px', height: '32px', borderRadius: '8px' }}
                >
                  <Plus size={16} />
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Boolean yes/no checklist style */
          <div className="project-card-progress-wrapper" onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <div 
              className={`custom-checkbox ${isCompleted ? 'checked' : ''}`}
              onClick={() => onToggleGoal(goal)}
              style={{ width: '22px', height: '22px', borderRadius: '6px' }}
            >
              <Check size={14} style={{ display: isCompleted ? 'block' : 'none', color: '#fff' }} />
            </div>
            <span 
              onClick={() => onToggleGoal(goal)}
              style={{ fontSize: '14px', color: isCompleted ? 'var(--text-muted)' : 'var(--text-main)', cursor: 'pointer', fontWeight: 500 }}
            >
              {isCompleted ? 'Hedefe Ulaşıldı!' : 'Hedef Beklemede'}
            </span>
          </div>
        )}

        <div className="project-card-footer">
          <div className="task-counter" style={{ fontSize: '12px' }}>
            <span>Oluşturulma: {new Date(goal.created_at).toLocaleDateString('tr-TR')}</span>
          </div>
          
          <div className="card-actions">
            <button 
              className="btn-card-action" 
              onClick={(e) => {
                e.stopPropagation();
                onEdit(goal);
              }} 
              title="Hedefi Düzenle"
            >
              <Edit3 />
            </button>
            <button 
              className="btn-card-action delete" 
              onClick={(e) => {
                e.stopPropagation();
                onDelete(goal.id);
              }} 
              title="Hedefi Sil"
            >
              <Trash2 />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
