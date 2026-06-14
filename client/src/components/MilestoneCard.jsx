import React from 'react';
import { Lock, Trophy, Trash2, CheckCircle2, Gift, Unlock } from 'lucide-react';

export default function MilestoneCard({ 
  milestone, 
  stats, 
  onUnlock, 
  onDelete 
}) {
  const isUnlocked = milestone.is_unlocked;
  
  // Calculate current value and target label based on target type
  let currentVal = 0;
  let targetVal = milestone.target_value || 1;
  let progressLabel = '';

  switch (milestone.target_type) {
    case 'projects_completed':
      currentVal = stats.completedProjects || 0;
      progressLabel = 'Tamamlanan Projeler';
      break;
    case 'goals_achieved':
      currentVal = stats.completedGoals || 0;
      progressLabel = 'Tamamlanan Hedefler';
      break;
    case 'habit_streak':
      currentVal = stats.maxHabitStreak || 0;
      progressLabel = 'Alışkanlık Serisi';
      break;
    case 'manual':
      currentVal = isUnlocked ? 1 : 0;
      targetVal = 1;
      progressLabel = 'Manuel Kilit Açma';
      break;
    default:
      break;
  }

  const progressPercent = Math.min(100, Math.round((currentVal / targetVal) * 100));

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className={`milestone-card glass-card ${isUnlocked ? 'unlocked' : 'locked'}`}>
      <div>
        <div className="milestone-header">
          <div className="milestone-badge-icon">
            {isUnlocked ? <Trophy size={20} /> : <Lock size={18} />}
          </div>
          
          <button 
            className="btn-card-action delete" 
            onClick={(e) => {
              e.stopPropagation();
              onDelete(milestone.id);
            }} 
            title="Başarımı Sil"
            style={{ padding: '4px' }}
          >
            <Trash2 size={16} />
          </button>
        </div>

        <h3 className="milestone-title">{milestone.title}</h3>
        <p className="milestone-desc">
          {milestone.description || <span style={{ fontStyle: 'italic', opacity: 0.6 }}>Açıklama belirtilmedi.</span>}
        </p>
      </div>

      <div>
        {/* Progress Display */}
        {!isUnlocked && milestone.target_type !== 'manual' && (
          <div className="milestone-progress-bar-container">
            <div className="milestone-progress-text">
              <span>{progressLabel}</span>
              <span>{currentVal} / {targetVal}</span>
            </div>
            <div className="progress-bar-track">
              <div 
                className="progress-bar-fill" 
                style={{ 
                  width: `${progressPercent}%`, 
                  backgroundColor: 'var(--primary)' 
                }}
              ></div>
            </div>
          </div>
        )}

        {/* Manual Unlock Button */}
        {!isUnlocked && milestone.target_type === 'manual' && (
          <button 
            className="btn btn-secondary" 
            onClick={() => onUnlock(milestone.id)}
            style={{ 
              width: '100%', 
              padding: '8px 12px', 
              fontSize: '12px', 
              borderRadius: '8px', 
              gap: '6px',
              marginBottom: '10px'
            }}
          >
            <Unlock size={14} /> Kilidi Aç
          </button>
        )}

        {/* Reward / Success Display */}
        {isUnlocked && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {milestone.reward && (
              <div className="milestone-reward-banner">
                <Gift size={14} style={{ flexShrink: 0 }} />
                <span>Ödül: {milestone.reward}</span>
              </div>
            )}
            <div className="milestone-footer">
              <span className="milestone-date">Açıldı: {formatDate(milestone.unlocked_at)}</span>
              <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
