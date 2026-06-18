import { useState, useEffect } from 'react';
import { X, Plus, Check, Trash2, StickyNote, User, FileText } from 'lucide-react';

export default function ProjectModal({
  isOpen,
  project,
  onClose,
  onSaveProject,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onUpdateTask
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
  const [taskPaidPrice, setTaskPaidPrice] = useState(0);
  const [taskDescription, setTaskDescription] = useState('');

  // Editing task state
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editWeight, setEditWeight] = useState(1);
  const [editPrice, setEditPrice] = useState(0);
  const [editPaidPrice, setEditPaidPrice] = useState(0);
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');

  // Sync state with selected project when modal opens
  /* eslint-disable react-hooks/set-state-in-effect */
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
    setTaskPaidPrice(0);
    setTaskDescription('');
    setEditingTaskId(null);
    setEditDueDate('');
  }, [project, isOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
      project.type === 'external' ? (parseFloat(taskPrice) || 0) : 0,
      project.type === 'external' ? (parseFloat(taskPaidPrice) || 0) : 0,
      taskDescription.trim()
    );
    setTaskTitle('');
    setTaskWeight(1);
    setTaskPrice(0);
    setTaskPaidPrice(0);
    setTaskDescription('');
  };

  const handleStartEditTask = (task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title || '');
    setEditWeight(task.weight || 1);
    setEditPrice(task.price || 0);
    setEditPaidPrice(task.paid_price || 0);
    setEditDescription(task.description || '');
    
    let dateStr = '';
    if (task.due_date) {
      try {
        dateStr = new Date(task.due_date).toISOString().split('T')[0];
      } catch (e) {
        dateStr = '';
      }
    }
    setEditDueDate(dateStr);
  };

  const handleSaveTaskClick = (taskId) => {
    if (!editTitle.trim()) return;

    onUpdateTask(taskId, {
      title: editTitle.trim(),
      weight: parseInt(editWeight) || 1,
      price: project.type === 'external' ? (parseFloat(editPrice) || 0) : 0,
      paid_price: project.type === 'external' ? (parseFloat(editPaidPrice) || 0) : 0,
      due_date: project.type === 'external' ? (editDueDate || null) : null,
      description: editDescription.trim()
    });
    setEditingTaskId(null);
  };

  const hasOverduePayment = (task) => {
    const price = parseFloat(task.price) || 0;
    const paid = parseFloat(task.paid_price) || 0;
    if (price <= paid || !task.due_date) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(task.due_date);
    due.setHours(0, 0, 0, 0);
    return due.getTime() < today.getTime();
  };

  const handleTaskKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTaskClick();
    }
  };

  const handleEditTaskKeyDown = (e, taskId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveTaskClick(taskId);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingTaskId(null);
    }
  };

  // Calculate dynamic progress & prices locally for display
  const tasks = project ? project.tasks || [] : [];
  const totalWeight = tasks.reduce((sum, t) => sum + t.weight, 0);
  const completedWeight = tasks.reduce((sum, t) => sum + (t.is_completed ? t.weight : 0), 0);
  const progressPercent = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;

  // Price calculations for external projects
  const totalBudget = tasks.reduce((sum, t) => sum + (parseFloat(t.price) || 0), 0);
  const totalPaid = tasks.reduce((sum, t) => sum + (parseFloat(t.paid_price) || 0), 0);

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
                    <option value="draft">Taslak</option>
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
                  onKeyDown={handleTaskKeyDown}
                  placeholder="Yeni iş maddesi ekle..."
                />
                
                <div className="weight-input-container">
                  <label>İş Yükü</label>
                  <input
                    type="number"
                    value={taskWeight}
                    onChange={(e) => setTaskWeight(Math.max(1, parseInt(e.target.value) || 1))}
                    onKeyDown={handleTaskKeyDown}
                    min="1"
                    max="100"
                  />
                </div>

                {project && project.type === 'external' && (
                  <>
                    <div className="price-input-container animate-fade-in">
                      <label>Fiyat (₺)</label>
                      <input
                        type="number"
                        value={taskPrice}
                        onChange={(e) => setTaskPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                        onKeyDown={handleTaskKeyDown}
                        min="0"
                      />
                    </div>
                    <div className="price-input-container animate-fade-in">
                      <label>Ödenen (₺)</label>
                      <input
                        type="number"
                        value={taskPaidPrice}
                        onChange={(e) => setTaskPaidPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                        onKeyDown={handleTaskKeyDown}
                        min="0"
                      />
                    </div>
                  </>
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
                    tasks.map((task) => {
                      const isEditing = editingTaskId === task.id;
                      if (isEditing) {
                        return (
                          <li key={task.id} className="task-item-edit-mode animate-fade-in">
                            <div className="edit-task-form">
                              <div className="form-group">
                                <label style={{ fontSize: '10px' }}>Görev Adı</label>
                                <input
                                  type="text"
                                  value={editTitle}
                                  onChange={(e) => setEditTitle(e.target.value)}
                                  onKeyDown={(e) => handleEditTaskKeyDown(e, task.id)}
                                  placeholder="Görev adı..."
                                  required
                                  style={{ padding: '8px 10px', fontSize: '13px' }}
                                />
                              </div>
                              
                              <div className="form-row-2" style={{ gap: '10px' }}>
                                <div className="form-group">
                                  <label style={{ fontSize: '10px' }}>İş Yükü</label>
                                  <input
                                    type="number"
                                    value={editWeight}
                                    onChange={(e) => setEditWeight(Math.max(1, parseInt(e.target.value) || 1))}
                                    onKeyDown={(e) => handleEditTaskKeyDown(e, task.id)}
                                    min="1"
                                    style={{ padding: '8px 10px', fontSize: '13px' }}
                                  />
                                </div>
                                {project.type === 'external' && (
                                  <div className="form-group">
                                    <label style={{ fontSize: '10px' }}>Fiyat (₺)</label>
                                    <input
                                      type="number"
                                      value={editPrice}
                                      onChange={(e) => setEditPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                                      onKeyDown={(e) => handleEditTaskKeyDown(e, task.id)}
                                      min="0"
                                      style={{ padding: '8px 10px', fontSize: '13px' }}
                                    />
                                  </div>
                                )}
                              </div>

                              {project.type === 'external' && (
                                <div className="form-row-2" style={{ gap: '10px' }}>
                                  <div className="form-group">
                                    <label style={{ fontSize: '10px' }}>Ödenen Kısım (₺)</label>
                                    <input
                                      type="number"
                                      value={editPaidPrice}
                                      onChange={(e) => setEditPaidPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                                      onKeyDown={(e) => handleEditTaskKeyDown(e, task.id)}
                                      min="0"
                                      style={{ padding: '8px 10px', fontSize: '13px' }}
                                    />
                                  </div>
                                  
                                  <div className="form-group">
                                    <label style={{ fontSize: '10px' }}>Son Ödeme Tarihi</label>
                                    <input
                                      type="date"
                                      value={editDueDate}
                                      onChange={(e) => setEditDueDate(e.target.value)}
                                      onKeyDown={(e) => handleEditTaskKeyDown(e, task.id)}
                                      style={{ padding: '8px 10px', fontSize: '13px' }}
                                    />
                                  </div>
                                </div>
                              )}

                              <div className="form-group">
                                <label style={{ fontSize: '10px' }}>Açıklama / Notlar</label>
                                <textarea
                                  value={editDescription}
                                  onChange={(e) => setEditDescription(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                      e.preventDefault();
                                      setEditingTaskId(null);
                                    }
                                  }}
                                  rows="2"
                                  placeholder="Detaylı açıklama girin..."
                                  style={{ padding: '8px 10px', fontSize: '13px' }}
                                />
                              </div>

                              <div className="edit-task-actions">
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  onClick={() => setEditingTaskId(null)}
                                  style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px' }}
                                >
                                  Vazgeç
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  onClick={() => handleSaveTaskClick(task.id)}
                                  style={{ padding: '4px 10px', fontSize: '11px', borderRadius: '6px' }}
                                >
                                  Kaydet
                                </button>
                              </div>
                            </div>
                          </li>
                        );
                      }

                      return (
                        <li key={task.id} className={`task-item ${task.is_completed ? 'completed' : ''}`} style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div className="task-item-left">
                              <div
                                className={`custom-checkbox ${task.is_completed ? 'checked' : ''}`}
                                onClick={() => onToggleTask(task.id)}
                              >
                                <Check />
                              </div>
                              <span 
                                className="task-title" 
                                onClick={() => handleStartEditTask(task)}
                                title="Açıklama ve detayları düzenlemek için tıklayın"
                              >
                                {task.title}
                              </span>
                              
                              <span className="task-weight-badge" title="İş Yükü / Ağırlık">
                                Ağırlık: {task.weight}
                              </span>

                              {project && project.type === 'external' && parseFloat(task.price) > 0 && (
                                <span 
                                  className="task-price-badge" 
                                  title={`Ödenen: ${formatPrice(task.paid_price)} / Toplam: ${formatPrice(task.price)}${task.due_date ? ` (Vade: ${new Date(task.due_date).toLocaleDateString('tr-TR')})` : ''}`}
                                >
                                  {parseFloat(task.paid_price) > 0 ? (
                                    <>Ödenen: {formatPrice(task.paid_price)} / {formatPrice(task.price)}</>
                                  ) : (
                                    formatPrice(task.price)
                                  )}
                                  {task.due_date && ` — Vade: ${new Date(task.due_date).toLocaleDateString('tr-TR')}`}
                                </span>
                              )}

                              {project && project.type === 'external' && hasOverduePayment(task) && (
                                <span 
                                  className="task-weight-badge" 
                                  style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', fontWeight: 600 }}
                                  title="Son ödeme tarihi geçmiş!"
                                >
                                  Gecikmiş Ödeme!
                                </span>
                              )}
                            </div>
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              <button
                                type="button"
                                className="btn-task-edit"
                                onClick={() => handleStartEditTask(task)}
                                title="Görevi Düzenle / Açıklama Ekle"
                              >
                                <FileText size={14} />
                              </button>
                              <button
                                type="button"
                                className="btn-task-delete"
                                onClick={() => onDeleteTask(task.id)}
                                title="Görevi Sil"
                              >
                                <Trash2 />
                              </button>
                            </div>
                          </div>
                          
                          {task.description && (
                            <div 
                              className="task-desc-preview" 
                              onClick={() => handleStartEditTask(task)}
                              title="Düzenlemek için tıklayın"
                            >
                              {task.description}
                            </div>
                          )}
                        </li>
                      );
                    })
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
                    <span>Ödenen / Toplam Bütçe:</span>
                    <span style={{ fontFamily: 'Fira Code, monospace', fontWeight: 600 }}>
                      <span style={{ color: 'var(--success)' }}>{formatPrice(totalPaid)}</span>
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
