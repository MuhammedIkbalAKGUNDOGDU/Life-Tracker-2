import React, { useState, useEffect } from 'react';
import { X, Plus, Check, Trash2, StickyNote, User } from 'lucide-react';

export default function ProjectModal({
  isOpen,
  project,
  onClose,
  onSaveProject,
  onAddTask,
  onToggleTask,
  onDeleteTask
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [client, setClient] = useState('');
  const [type, setType] = useState('personal');
  const [status, setStatus] = useState('not_started');

  // New task inputs state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskWeight, setTaskWeight] = useState(1);
  const [taskPrice, setTaskPrice] = useState(0);

  // Sync state with selected project when modal opens
  useEffect(() => {
    if (project) {
      setTitle(project.title || '');
      setDescription(project.description || '');
      setNotes(project.notes || '');
      setClient(project.client || '');
      setType(project.type || 'personal');
      setStatus(project.status || 'not_started');
    } else {
      setTitle('');
      setDescription('');
      setNotes('');
      setClient('');
      setType('personal');
      setStatus('not_started');
    }
    setTaskTitle('');
    setTaskWeight(1);
    setTaskPrice(0);
  }, [project, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSaveProject({
      id: project ? project.id : null,
      title: title.trim(),
      description: description.trim(),
      notes: notes.trim(),
      client: type === 'external' ? client.trim() : '',
      type,
      status
    });
  };

  const handleAddTaskClick = () => {
    if (!taskTitle.trim() || !project) return;
    onAddTask(
      project.id, 
      taskTitle.trim(), 
      parseInt(taskWeight) || 1, 
      project.type === 'external' ? (parseFloat(taskPrice) || 0) : 0
    );
    setTaskTitle('');
    setTaskWeight(1);
    setTaskPrice(0);
  };

  const handleTaskKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTaskClick();
    }
  };

  // Calculate dynamic progress & prices locally for display
  const tasks = project ? project.tasks || [] : [];
  const totalWeight = tasks.reduce((sum, t) => sum + t.weight, 0);
  const completedWeight = tasks.reduce((sum, t) => sum + (t.is_completed ? t.weight : 0), 0);
  const progressPercent = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;

  // Price calculations for external projects
  const totalBudget = tasks.reduce((sum, t) => sum + (parseFloat(t.price) || 0), 0);
  const earnedBudget = tasks.reduce((sum, t) => sum + (t.is_completed ? (parseFloat(t.price) || 0) : 0), 0);

  const getProgressColor = (percent) => {
    if (percent === 100) return 'var(--success)';
    if (percent > 50) return 'var(--secondary)';
    return 'var(--warning)';
  };

  const formatPrice = (val) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      maximumFractionDigits: 0
    }).format(val);
  };

  return (
    <div className="modal-backdrop open">
      <div className="modal glass-card">
        <div className="modal-header">
          <h2>{project ? 'Projeyi Düzenle & Yönet' : 'Yeni Proje Oluştur'}</h2>
          <button className="btn-close" onClick={onClose} type="button">
            <X />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="modal-body-split">
            {/* Left Column: Project Details */}
            <div className="modal-col-left">
              <div className="form-group">
                <label>Proje Adı</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  placeholder="Projenin başlığını girin..."
                />
              </div>

              <div className="form-group">
                <label>Açıklama</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows="3"
                  placeholder="Proje hakkında kısa bir açıklama..."
                />
              </div>

              <div className="form-row-2">
                <div className="form-group">
                  <label>Proje Türü</label>
                  <select value={type} onChange={(e) => setType(e.target.value)}>
                    <option value="personal">Kişisel Proje</option>
                    <option value="external">Dış Proje (Müşteri)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Durum</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="not_started">Başlanmadı</option>
                    <option value="in_progress">Devam Ediyor</option>
                    <option value="on_hold">Ertelendi</option>
                    <option value="completed">Tamamlandı</option>
                  </select>
                </div>
              </div>

              {type === 'external' && (
                <div className="form-group animate-fade-in">
                  <label className="label-with-icon">
                    <User size={14} /> Müşteri / Kime Ait
                  </label>
                  <input
                    type="text"
                    value={client}
                    onChange={(e) => setClient(e.target.value)}
                    placeholder="Müşteri adını veya kime ait olduğunu girin..."
                  />
                </div>
              )}

              <div className="form-group">
                <label className="label-with-icon">
                  <StickyNote size={14} /> Proje Notları
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows="6"
                  placeholder="Bu projeye ait özel notlar, linkler veya önemli detaylar..."
                />
              </div>
            </div>

            {/* Right Column: Subtasks List */}
            <div className="modal-col-right" style={{ display: project ? 'flex' : 'none' }}>
              <div className="section-title-with-desc">
                <h3>İş Maddeleri & Görevler</h3>
                <span className="section-desc">Proje ilerlemesi alt görevlerin ağırlıklı ortalamasıyla hesaplanır.</span>
              </div>

              {/* Add Task Inline Form */}
              <div className="add-task-inline">
                <input
                  type="text"
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  onKeyPress={handleTaskKeyPress}
                  placeholder="Yeni iş maddesi ekle..."
                />
                
                <div className="weight-input-container">
                  <label>İş Yükü</label>
                  <input
                    type="number"
                    value={taskWeight}
                    onChange={(e) => setTaskWeight(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    max="100"
                  />
                </div>

                {project && project.type === 'external' && (
                  <div className="price-input-container">
                    <label>Fiyat (₺)</label>
                    <input
                      type="number"
                      value={taskPrice}
                      onChange={(e) => setTaskPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                      min="0"
                    />
                  </div>
                )}
                
                <button
                  type="button"
                  className="btn btn-secondary btn-icon-only"
                  onClick={handleAddTaskClick}
                  title="Görev Ekle"
                >
                  <Plus />
                </button>
              </div>

              {/* Tasks List */}
              <div className="tasks-list-container">
                <ul className="tasks-list">
                  {tasks.length === 0 ? (
                    <li className="empty-list-info" style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      Henüz hiç iş maddesi eklenmemiş. Yukarıdan ilkini ekleyin!
                    </li>
                  ) : (
                    tasks.map((task) => (
                      <li key={task.id} className={`task-item ${task.is_completed ? 'completed' : ''}`}>
                        <div className="task-item-left">
                          <div
                            className={`custom-checkbox ${task.is_completed ? 'checked' : ''}`}
                            onClick={() => onToggleTask(task.id)}
                          >
                            <Check />
                          </div>
                          <span className="task-title" onClick={() => onToggleTask(task.id)}>
                            {task.title}
                          </span>
                          
                          <span className="task-weight-badge" title="İş Yükü / Ağırlık">
                            Ağırlık: {task.weight}
                          </span>

                          {project && project.type === 'external' && parseFloat(task.price) > 0 && (
                            <span className="task-price-badge">
                              {formatPrice(task.price)}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="btn-task-delete"
                          onClick={() => onDeleteTask(task.id)}
                          title="Görevi Sil"
                        >
                          <Trash2 />
                        </button>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              {/* Task progress percentage */}
              <div className="tasks-progress-indicator">
                <div className="tasks-progress-row">
                  <span>Görev İlerleme Oranı:</span>
                  <strong style={{ color: getProgressColor(progressPercent) }}>
                    {progressPercent}%
                  </strong>
                </div>

                {project && project.type === 'external' && totalBudget > 0 && (
                  <div className="tasks-progress-row" style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <span>Toplam Bütçe / Kazanılan:</span>
                    <span style={{ fontFamily: 'Fira Code, monospace', fontWeight: 600 }}>
                      <span style={{ color: 'var(--success)' }}>{formatPrice(earnedBudget)}</span>
                      <span style={{ opacity: 0.5 }}> / </span>
                      <span>{formatPrice(totalBudget)}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column Placeholder for Create Mode */}
            {!project && (
              <div className="modal-col-right" style={{ justifyContent: 'center', alignItems: 'center', color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>
                <StickyNote style={{ width: '48px', height: '48px', marginBottom: '16px', strokeWidth: '1.2px' }} />
                <h3>Görev Eklemek İçin</h3>
                <p style={{ fontSize: '13px', marginTop: '8px', maxWidth: '240px' }}>
                  Projeye iş maddesi/görev ekleyebilmek için önce projeyi kaydetmeniz gerekmektedir.
                </p>
              </div>
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Vazgeç</button>
            <button type="submit" className="btn btn-primary">Kaydet</button>
          </div>
        </form>
      </div>
    </div>
  );
}
