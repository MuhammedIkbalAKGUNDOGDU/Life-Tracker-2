import React, { useState } from 'react';
import { 
  Plus, 
  Trash2, 
  Sun, 
  Moon, 
  Briefcase, 
  Dumbbell, 
  Sparkles, 
  Check, 
  CheckCircle,
  X,
  PlusCircle,
  Play,
  RotateCcw
} from 'lucide-react';

export default function RoutinesDashboard({
  routines = [],
  onSaveRoutine,
  onToggleRoutineComplete,
  onDeleteRoutine,
  onStartRoutine,
  onToggleStep
}) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('sun');
  const [steps, setSteps] = useState(['', '']); // Initial 2 empty steps

  const handleStepChange = (index, val) => {
    setSteps(prev => {
      const next = [...prev];
      next[index] = val;
      return next;
    });
  };

  const addStepInput = () => {
    setSteps(prev => [...prev, '']);
  };

  const removeStepInput = (index) => {
    setSteps(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    const filteredSteps = steps.filter(s => s.trim() !== '');

    onSaveRoutine({
      title: title.trim(),
      description: description.trim(),
      icon,
      steps: filteredSteps
    });

    setIsModalOpen(false);
    setTitle('');
    setDescription('');
    setIcon('sun');
    setSteps(['', '']);
  };

  const getRoutineProgress = (routine) => {
    const routineSteps = routine.steps || [];
    if (routineSteps.length === 0) return { percent: 0, completed: 0, total: 0 };
    
    let completed = 0;
    routineSteps.forEach((step) => {
      if (step.is_completed_today) {
        completed++;
      }
    });

    return {
      percent: Math.round((completed / routineSteps.length) * 100),
      completed,
      total: routineSteps.length
    };
  };

  const renderIcon = (iconName) => {
    switch (iconName) {
      case 'sun': return <Sun size={18} />;
      case 'moon': return <Moon size={18} />;
      case 'briefcase': return <Briefcase size={18} />;
      case 'dumbbell': return <Dumbbell size={18} />;
      default: return <Sparkles size={18} />;
    }
  };

  return (
    <>
      {/* Action Bar */}
      <section className="action-bar-section">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Günlük Akışlar & Rutinler</h2>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus /> Yeni Rutin Oluştur
        </button>
      </section>

      {/* Grid View */}
      <section className="projects-grid-section">
        {routines.length === 0 ? (
          <div className="empty-state">
            <Sparkles style={{ width: '56px', height: '56px' }} />
            <h3>Henüz Rutin Yok</h3>
            <p>Sabah, akşam veya çalışma rutinlerinizi oluşturup sıralı adımlarla takip edin.</p>
            <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
              <Plus /> İlk Rutini Oluştur
            </button>
          </div>
        ) : (
          <div className="routine-grid">
            {routines.map((routine) => {
              const progress = getRoutineProgress(routine);
              const isCompletedToday = routine.is_completed_today;
              const isStartedToday = routine.is_started_today;
              const allStepsChecked = progress.completed === progress.total && progress.total > 0;

              // If routine is not started and not completed today, show compact style
              if (!isStartedToday && !isCompletedToday) {
                return (
                  <div 
                    key={routine.id} 
                    className="routine-card glass-card not-started-routine"
                  >
                    <div>
                      <div className="routine-card-header">
                        <div className="routine-icon-box">
                          {renderIcon(routine.icon)}
                        </div>
                        
                        <button 
                          className="btn-card-action delete" 
                          onClick={() => onDeleteRoutine(routine.id)}
                          title="Rutini Sil"
                          style={{ padding: '4px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <h3 className="project-card-title" style={{ fontSize: '17px', marginBottom: '4px' }}>
                        {routine.title}
                      </h3>
                      {routine.description && (
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>
                          {routine.description}
                        </p>
                      )}
                    </div>

                    <div style={{ marginTop: 'auto' }}>
                      <button 
                        className="btn btn-primary" 
                        onClick={() => onStartRoutine(routine.id, true)}
                        style={{ 
                          width: '100%', 
                          justifyContent: 'center', 
                          gap: '6px', 
                          padding: '10px',
                          fontSize: '13px',
                          fontWeight: '600'
                        }}
                      >
                        <Play size={14} fill="currentColor" /> Rutini Başlat
                      </button>
                    </div>
                  </div>
                );
              }

              // Otherwise show fully expanded routine card
              return (
                <div 
                  key={routine.id} 
                  className={`routine-card glass-card ${isCompletedToday ? 'completed-routine' : ''}`}
                >
                  <div>
                    <div className="routine-card-header">
                      <div className="routine-icon-box">
                        {renderIcon(routine.icon)}
                      </div>
                      
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {isStartedToday && (
                          <button 
                            className="btn-card-action" 
                            onClick={() => onStartRoutine(routine.id, false)}
                            title="Rutini Sıfırla (Başlatılmadı Yap)"
                            style={{ padding: '4px' }}
                          >
                            <RotateCcw size={16} />
                          </button>
                        )}
                        <button 
                          className="btn-card-action delete" 
                          onClick={() => onDeleteRoutine(routine.id)}
                          title="Rutini Sil"
                          style={{ padding: '4px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    <h3 className="project-card-title" style={{ fontSize: '17px', marginBottom: '4px' }}>
                      {routine.title}
                    </h3>
                    {routine.description && (
                      <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
                        {routine.description}
                      </p>
                    )}

                    {/* Step Checklist */}
                    <div className="routine-steps-list">
                      {(routine.steps || []).map((step, idx) => {
                        const isChecked = step.is_completed_today || isCompletedToday;
                        return (
                          <div 
                            key={step.id || idx}
                            className={`routine-step-item ${isChecked ? 'checked' : ''}`}
                            onClick={() => !isCompletedToday && onToggleStep(routine.id, step.id, !step.is_completed_today)}
                            style={{ cursor: isCompletedToday ? 'default' : 'pointer' }}
                          >
                            <div className={`routine-step-checkbox ${isChecked ? 'checked' : ''}`}>
                              {isChecked && <Check size={10} style={{ color: '#fff' }} />}
                            </div>
                            <span>{step.title}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    {/* Progress Bar */}
                    {routine.steps && routine.steps.length > 0 && (
                      <div className="milestone-progress-bar-container" style={{ marginBottom: '14px' }}>
                        <div className="milestone-progress-text" style={{ fontSize: '10px' }}>
                          <span>İlerleme</span>
                          <span>{isCompletedToday ? '100%' : `${progress.completed}/${progress.total}`}</span>
                        </div>
                        <div className="progress-bar-track" style={{ height: '6px' }}>
                          <div 
                            className="progress-bar-fill" 
                            style={{ 
                              width: isCompletedToday ? '100%' : `${progress.percent}%`,
                              backgroundColor: isCompletedToday ? 'var(--success)' : 'var(--primary)'
                            }}
                          ></div>
                        </div>
                      </div>
                    )}

                    {/* Complete button */}
                    <div className="routine-footer-actions">
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {isCompletedToday ? 'Bugün Tamamlandı' : 'Bekliyor'}
                      </span>
                      
                      <button 
                        className={`btn ${isCompletedToday ? 'btn-secondary' : allStepsChecked ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => onToggleRoutineComplete(routine.id, !isCompletedToday)}
                        style={{ 
                          padding: '6px 14px', 
                          fontSize: '12px', 
                          borderRadius: '8px',
                          gap: '4px'
                        }}
                      >
                        {isCompletedToday ? (
                          <span>Geri Al</span>
                        ) : (
                          <>
                            <CheckCircle size={14} /> Bugün Tamamla
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Routine Creation Modal */}
      {isModalOpen && (
        <div className="modal-backdrop open">
          <div className="modal glass-card" style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h2>Yeni Rutin Oluştur</h2>
              <button className="btn-close" onClick={() => setIsModalOpen(false)} type="button">
                <X />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="modal-body-split" style={{ flexDirection: 'column', gap: '16px', padding: '24px' }}>
                
                <div className="form-group">
                  <label>Rutin Başlığı</label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    required
                    placeholder="Örn: Sabah Rutini, Gece Rutini..."
                  />
                </div>

                <div className="form-group">
                  <label>Açıklama</label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Örn: Güne enerjik başlamak için yapılacaklar..."
                  />
                </div>

                <div className="form-group">
                  <label>Simge (Icon)</label>
                  <select value={icon} onChange={(e) => setIcon(e.target.value)}>
                    <option value="sun">Güneş (Sabah)</option>
                    <option value="moon">Ay (Gece)</option>
                    <option value="briefcase">Çanta (İş/Çalışma)</option>
                    <option value="dumbbell">Dambıl (Spor/Sağlık)</option>
                    <option value="sparkles">Yıldız (Genel)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Adımlar (Rutin Sırası)</span>
                    <button 
                      type="button" 
                      onClick={addStepInput} 
                      style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        color: 'var(--primary)', 
                        cursor: 'pointer',
                        fontSize: '11px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        fontWeight: 'bold'
                      }}
                    >
                      <PlusCircle size={12} /> Ekle
                    </button>
                  </label>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                    {steps.map((step, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', width: '20px' }}>{idx + 1}.</span>
                        <input
                          type="text"
                          value={step}
                          onChange={(e) => handleStepChange(idx, e.target.value)}
                          placeholder="Adım açıklaması..."
                          required={idx < 2} // At least 2 steps required
                          style={{ flex: 1, padding: '8px 10px', fontSize: '13px' }}
                        />
                        {steps.length > 2 && (
                          <button 
                            type="button" 
                            onClick={() => removeStepInput(idx)}
                            style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Vazgeç</button>
                <button type="submit" className="btn btn-primary">Oluştur</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
