import { useState, useEffect } from 'react';
import ModalShell from './ModalShell';
import NumInput from './NumInput';
import { notify, promptDialog } from '../ui';
import { X, Plus, Check, Trash2, StickyNote, User, FileText, CalendarCheck, Star, GripVertical, Printer, BookmarkPlus, Repeat, ListChecks } from 'lucide-react';
import { printProjectQuote } from '../print';

export default function ProjectModal({
  isOpen,
  project,
  onClose,
  onSaveProject,
  onAddTask,
  onToggleTask,
  onDeleteTask,
  onUpdateTask,
  onTransferToYearly,
  templates = [],
  onSaveTemplate,
  onDeleteTemplate,
  onApplyTemplate,
  onReorderTasks,
  onAddPayment,
  onDeletePayment,
  displayCurrency = 'TRY',
  hideAmounts = false,
  usdTryRate = 34.0
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [client, setClient] = useState('');
  const [type, setType] = useState('personal');
  const [status, setStatus] = useState('not_started');

  // New task inputs state
  const [taskTitle, setTaskTitle] = useState('');
  const [taskWeight, setTaskWeight] = useState('1');
  const [taskPrice, setTaskPrice] = useState('');
  const [taskPaidPrice, setTaskPaidPrice] = useState('');
  const [taskDueDate, setTaskDueDate] = useState('');
  const [taskDescription, setTaskDescription] = useState('');
  const [saving, setSaving] = useState(false);

  // Extra task fields (edit mode)
  const [editPriority, setEditPriority] = useState(2);
  const [editRepeat, setEditRepeat] = useState('');
  const [editChecklist, setEditChecklist] = useState([]);
  const [newCheckText, setNewCheckText] = useState('');
  const [payAmount, setPayAmount] = useState(0);
  const [payDate, setPayDate] = useState('');
  const [payNote, setPayNote] = useState('');

  // Drag & drop ordering
  const [dragId, setDragId] = useState(null);
  const [dragOverId, setDragOverId] = useState(null);

  // Editing task state
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTitle, setEditTitle] = useState('');
  const [editWeight, setEditWeight] = useState('1');
  const [editPrice, setEditPrice] = useState('');
  const [editPaidPrice, setEditPaidPrice] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');

  const resetTaskInputs = () => {
    setTaskTitle('');
    setTaskWeight('1');
    setTaskPrice('');
    setTaskPaidPrice('');
    setTaskDueDate('');
    setTaskDescription('');
  };

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
    resetTaskInputs();
    setEditingTaskId(null);
    setEditDueDate('');
    // Only re-sync when a different project is opened, so unsaved edits survive task changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, isOpen]);
  /* eslint-enable react-hooks/set-state-in-effect */

  if (!isOpen) return null;

  const num = (v) => parseFloat(v) || 0;
  const isExternal = project?.type === 'external';

  // Returns false (and tells the user why) when paid > price
  const validPayment = (price, paid) => {
    if (price > 0 && paid > price) {
      notify('Ödenen tutar, görev fiyatından büyük olamaz.', 'error');
      return false;
    }
    return true;
  };

  const handleAddTaskClick = async () => {
    if (!taskTitle.trim() || !project) return false;
    const price = isExternal ? num(taskPrice) : 0;
    const paid = isExternal ? num(taskPaidPrice) : 0;
    if (!validPayment(price, paid)) return false;
    const ok = await onAddTask(
      project.id,
      taskTitle.trim(),
      Math.max(1, parseInt(taskWeight) || 1),
      price,
      paid,
      taskDescription.trim(),
      isExternal ? taskDueDate : ''
    );
    if (ok) resetTaskInputs();
    return ok;
  };

  const handleStartEditTask = (task) => {
    setEditingTaskId(task.id);
    setEditTitle(task.title || '');
    setEditWeight(String(task.weight || 1));
    setEditPrice(parseFloat(task.price) ? String(parseFloat(task.price)) : '');
    setEditPaidPrice(parseFloat(task.paid_price) ? String(parseFloat(task.paid_price)) : '');
    setEditDescription(task.description || '');
    setEditPriority(task.priority || 2);
    setEditRepeat(task.repeat || '');
    setEditChecklist((task.checklist || []).map(i => ({ ...i })));
    setNewCheckText('');
    setPayAmount(0);
    setPayDate('');
    setPayNote('');

    let dateStr = '';
    if (task.due_date) {
      const d = new Date(task.due_date);
      if (!isNaN(d.getTime())) {
        dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      }
    }
    setEditDueDate(dateStr);
  };

  const handleSaveTaskClick = async (taskId) => {
    if (!editTitle.trim()) {
      notify('Görev adı boş olamaz.', 'error');
      return false;
    }
    const price = isExternal ? num(editPrice) : 0;
    const paid = isExternal ? num(editPaidPrice) : 0;
    if (!validPayment(price, paid)) return false;

    const ok = await onUpdateTask(taskId, {
      title: editTitle.trim(),
      weight: Math.max(1, parseInt(editWeight) || 1),
      price,
      paid_price: paid,
      due_date: isExternal ? (editDueDate || null) : null,
      description: editDescription.trim(),
      priority: editPriority,
      repeat: editRepeat,
      checklist: newCheckText.trim() ? [...editChecklist, { text: newCheckText.trim(), done: false }] : editChecklist
    });
    if (ok) setEditingTaskId(null);
    return ok;
  };

  // No confirmation: deleting shows a "Geri al" (undo) toast instead
  const handleDeleteTask = (task) => onDeleteTask(task.id);

  // One Save for everything: an open task edit and a half-typed new task are saved too
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      if (project) {
        if (editingTaskId && !(await handleSaveTaskClick(editingTaskId))) return;
        if (taskTitle.trim() && !(await handleAddTaskClick())) return;
      }
      await onSaveProject({
        id: project ? project.id : null,
        title: title.trim(),
        description: description.trim(),
        notes: notes.trim(),
        client: type === 'external' ? client.trim() : '',
        type,
        status
      });
    } finally {
      setSaving(false);
    }
  };

  // Quick toggles on the task row (no need to open the editor)
  const quickUpdate = (task, patch) => onUpdateTask(task.id, patch, { silent: true });
  const cyclePriority = (task) => quickUpdate(task, { priority: (task.priority || 2) === 1 ? 3 : (task.priority || 2) - 1 });
  const toggleChecklistItem = (task, idx) =>
    quickUpdate(task, { checklist: (task.checklist || []).map((c, i) => (i === idx ? { ...c, done: !c.done } : c)) });

  const handleAddPayment = async (task) => {
    const amount = num(payAmount);
    if (!amount) {
      notify('Ödeme tutarını girin.', 'error');
      return;
    }
    const ok = await onAddPayment(task.id, { amount, paid_date: payDate || undefined, note: payNote.trim() });
    if (ok) {
      setPayAmount(0);
      setPayDate('');
      setPayNote('');
      // keep the paid-field of the open editor in sync with the server value
      setEditPaidPrice(String((parseFloat(task.paid_price) || 0) + amount));
    }
  };

  const handleSaveTemplate = async () => {
    const name = await promptDialog({ title: 'Şablon olarak kaydet', label: 'Şablonun adı:', defaultValue: project.title });
    if (name) await onSaveTemplate(name, project);
  };

  // Drag & drop reorder of tasks
  const handleDrop = (targetId) => {
    if (dragId === null || dragId === targetId) return;
    const ids = (project.tasks || []).map(t => t.id);
    ids.splice(ids.indexOf(dragId), 1);
    ids.splice(ids.indexOf(targetId), 0, dragId);
    onReorderTasks(project.id, ids);
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

  const convertAmount = (amount, fromCurrency, toCurrency) => {
    const amt = parseFloat(amount) || 0;
    const from = fromCurrency || 'TRY';
    const to = toCurrency || 'TRY';
    if (from === to) return amt;
    if (from === 'USD' && to === 'TRY') return amt * usdTryRate;
    if (from === 'TRY' && to === 'USD') return amt / usdTryRate;
    return amt;
  };

  const formatPrice = (val) => {
    if (hideAmounts) {
      return displayCurrency === 'USD' ? '*** $' : '*** ₺';
    }
    const converted = convertAmount(val, 'TRY', displayCurrency);
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: displayCurrency,
      maximumFractionDigits: 0
    }).format(converted);
  };

  return (
    <ModalShell onClose={onClose} className="modal-xl" resetKey={project?.id ?? 'new'}>
        <div className="modal-header">
          <h2>{project ? 'Projeyi Düzenle & Yönet' : 'Yeni Proje Oluştur'}</h2>
          <button className="btn-close" data-modal-close type="button">
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
              <div className="tpl-bar">
                {templates.map(t => (
                  <span key={t.id} className="tpl-chip">
                    <button
                      type="button"
                      onClick={() => onApplyTemplate(project.id, t)}
                      title={`"${t.name}" şablonundaki ${(t.tasks || []).length} görevi bu projeye ekle`}
                    >
                      <BookmarkPlus size={12} /> {t.name}
                    </button>
                    <button type="button" className="tpl-x" onClick={() => onDeleteTemplate(t.id)} title="Şablonu sil"><X size={12} /></button>
                  </span>
                ))}
                <button type="button" className="btn btn-secondary btn-sm" onClick={handleSaveTemplate} disabled={tasks.length === 0} title="Bu projenin görev listesini şablon olarak kaydet">
                  <BookmarkPlus size={14} /> Şablon olarak kaydet
                </button>
              </div>
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
                  <label title="İlerleme hesabında bu işin payı. Büyük iş = yüksek ağırlık.">Ağırlık</label>
                  <input
                    type="number"
                    value={taskWeight}
                    onChange={(e) => setTaskWeight(e.target.value)}
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
                        onChange={(e) => setTaskPrice(e.target.value)}
                        onKeyDown={handleTaskKeyDown}
                        placeholder="0"
                      />
                    </div>
                    <div className="price-input-container animate-fade-in">
                      <label>Ödenen (₺)</label>
                      <input
                        type="number"
                        value={taskPaidPrice}
                        onChange={(e) => setTaskPaidPrice(e.target.value)}
                        onKeyDown={handleTaskKeyDown}
                        placeholder="0"
                      />
                    </div>
                    <div className="price-input-container animate-fade-in">
                      <label>Vade</label>
                      <input
                        type="date"
                        value={taskDueDate}
                        onChange={(e) => setTaskDueDate(e.target.value)}
                        onKeyDown={handleTaskKeyDown}
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
                                  <label style={{ fontSize: '10px' }}>Ağırlık</label>
                                  <input
                                    type="number"
                                    value={editWeight}
                                    onChange={(e) => setEditWeight(e.target.value)}
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
                                      onChange={(e) => setEditPrice(e.target.value)}
                                      onKeyDown={(e) => handleEditTaskKeyDown(e, task.id)}
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
                                      onChange={(e) => setEditPaidPrice(e.target.value)}
                                      onKeyDown={(e) => handleEditTaskKeyDown(e, task.id)}
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

                              <div className="form-row-2" style={{ gap: '10px' }}>
                                <div className="form-group">
                                  <label style={{ fontSize: '10px' }}>Öncelik</label>
                                  <select value={editPriority} onChange={(e) => setEditPriority(parseInt(e.target.value))} style={{ padding: '8px 10px', fontSize: '13px' }}>
                                    <option value={1}>Yüksek</option>
                                    <option value={2}>Normal</option>
                                    <option value={3}>Düşük</option>
                                  </select>
                                </div>
                                <div className="form-group">
                                  <label style={{ fontSize: '10px' }}>Tekrar</label>
                                  <select value={editRepeat} onChange={(e) => setEditRepeat(e.target.value)} style={{ padding: '8px 10px', fontSize: '13px' }}>
                                    <option value="">Tekrarlama</option>
                                    <option value="daily">Her gün</option>
                                    <option value="weekly">Her hafta</option>
                                    <option value="monthly">Her ay</option>
                                  </select>
                                </div>
                              </div>

                              <div className="form-group">
                                <label style={{ fontSize: '10px' }}>Alt adımlar (checklist)</label>
                                <div className="check-edit">
                                  {editChecklist.map((c, i) => (
                                    <div key={i} className="check-edit-row">
                                      <input
                                        type="checkbox"
                                        checked={c.done}
                                        onChange={() => setEditChecklist(list => list.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))}
                                      />
                                      <input
                                        type="text"
                                        value={c.text}
                                        onChange={(e) => setEditChecklist(list => list.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
                                        style={{ padding: '6px 8px', fontSize: '13px' }}
                                      />
                                      <button type="button" className="btn-task-delete" onClick={() => setEditChecklist(list => list.filter((_, j) => j !== i))} title="Adımı sil"><X size={14} /></button>
                                    </div>
                                  ))}
                                  <input
                                    type="text"
                                    value={newCheckText}
                                    onChange={(e) => setNewCheckText(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        if (newCheckText.trim()) {
                                          setEditChecklist(list => [...list, { text: newCheckText.trim(), done: false }]);
                                          setNewCheckText('');
                                        }
                                      }
                                    }}
                                    placeholder="Yeni alt adım... (Enter ile ekle)"
                                    style={{ padding: '6px 8px', fontSize: '13px' }}
                                  />
                                </div>
                              </div>

                              {project.type === 'external' && (
                                <div className="form-group">
                                  <label style={{ fontSize: '10px' }}>Ödeme geçmişi</label>
                                  {(task.payments || []).length > 0 && (
                                    <div className="pay-list">
                                      {task.payments.map(pm => (
                                        <div key={pm.id} className="pay-row">
                                          <span>{new Date(pm.paid_date).toLocaleDateString('tr-TR')}</span>
                                          <strong>{formatPrice(pm.amount)}</strong>
                                          <small>{pm.note}</small>
                                          <button type="button" className="btn-task-delete" onClick={() => onDeletePayment(task.id, pm.id)} title="Bu ödemeyi sil"><Trash2 size={13} /></button>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  <div className="pay-add">
                                    <NumInput value={payAmount} onChange={setPayAmount} placeholder="Tutar" style={{ padding: '6px 8px', fontSize: '13px' }} />
                                    <input type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} style={{ padding: '6px 8px', fontSize: '13px' }} title="Boş bırakırsan bugün" />
                                    <input type="text" value={payNote} onChange={(e) => setPayNote(e.target.value)} placeholder="Not (kapora...)" style={{ padding: '6px 8px', fontSize: '13px' }} />
                                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleAddPayment(task)} style={{ padding: '6px 10px', fontSize: '12px' }}>Ödeme ekle</button>
                                  </div>
                                </div>
                              )}

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
                        <li
                          key={task.id}
                          className={`task-item ${task.is_completed ? 'completed' : ''} ${dragOverId === task.id && dragId !== task.id ? 'drag-over' : ''}`}
                          style={{ flexDirection: 'column', alignItems: 'stretch', gap: '4px', opacity: dragId === task.id ? 0.4 : 1 }}
                          draggable
                          onDragStart={(e) => { setDragId(task.id); e.dataTransfer.effectAllowed = 'move'; }}
                          onDragOver={(e) => { e.preventDefault(); if (dragId !== null) setDragOverId(task.id); }}
                          onDrop={(e) => { e.preventDefault(); handleDrop(task.id); setDragId(null); setDragOverId(null); }}
                          onDragEnd={() => { setDragId(null); setDragOverId(null); }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div className="task-item-left">
                              <span className="drag-grip" title="Sürükleyerek sırala"><GripVertical size={14} /></span>
                              <button
                                type="button"
                                className={`prio-dot p${task.priority || 2}`}
                                onClick={() => cyclePriority(task)}
                                title={`Öncelik: ${['', 'Yüksek', 'Normal', 'Düşük'][task.priority || 2]} (değiştirmek için tıkla)`}
                              />
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
                              
                              <span className="task-weight-badge" title="İlerleme hesabındaki payı">
                                Ağırlık: {task.weight}
                              </span>
                              {task.repeat && (
                                <span className="task-weight-badge" title="Tamamlanınca bir sonraki hali otomatik eklenir">
                                  <Repeat size={10} /> {{ daily: 'Günlük', weekly: 'Haftalık', monthly: 'Aylık' }[task.repeat]}
                                </span>
                              )}

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
                                className={`btn-task-edit star ${task.is_today ? 'on' : ''}`}
                                onClick={() => quickUpdate(task, { is_today: !task.is_today })}
                                title={task.is_today ? 'Bugün listesinden çıkar' : 'Bugün yapılacaklara ekle'}
                              >
                                <Star size={14} fill={task.is_today ? 'currentColor' : 'none'} />
                              </button>
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
                                onClick={() => handleDeleteTask(task)}
                                title="Görevi Sil"
                              >
                                <Trash2 />
                              </button>
                            </div>
                          </div>
                          
                          {(task.checklist || []).length > 0 && (
                            <div className="check-view">
                              <span className="check-count"><ListChecks size={12} /> {(task.checklist || []).filter(c => c.done).length}/{task.checklist.length}</span>
                              {task.checklist.map((c, i) => (
                                <label key={i} className={c.done ? 'done' : ''}>
                                  <input type="checkbox" checked={c.done} onChange={() => toggleChecklistItem(task, i)} />
                                  {c.text}
                                </label>
                              ))}
                            </div>
                          )}

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
            {project && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  if (!printProjectQuote(project, formatPrice)) notify('Yazdırma penceresi engellendi. Tarayıcıda açılır pencerelere izin verin.', 'error');
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                title="Görevleri ve tutarları içeren teklif sayfası / PDF"
              >
                <Printer size={16} /> Teklif
              </button>
            )}
            {project && onTransferToYearly && (
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={(e) => {
                  e.preventDefault();
                  onTransferToYearly(project);
                }}
                style={{ marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '6px', borderColor: '#3b82f6', color: '#60a5fa' }}
              >
                <CalendarCheck size={16} /> Yıllık Ödemelere Aktar
              </button>
            )}
            <span className="modal-hint">Ctrl+Enter kaydeder · Esc kapatır</span>
            <button type="button" className="btn btn-secondary" data-modal-close>Vazgeç</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Kaydediliyor...' : project ? 'Kaydet' : 'Projeyi Oluştur'}
            </button>
          </div>
        </form>
    </ModalShell>
  );
}
