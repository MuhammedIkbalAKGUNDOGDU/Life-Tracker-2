import React from 'react';
import { CheckSquare, Edit3, Trash2, User } from 'lucide-react';

const getStatusLabel = (status) => {
  switch (status) {
    case 'not_started': return 'Başlanmadı';
    case 'in_progress': return 'Devam Ediyor';
    case 'on_hold': return 'Ertelendi';
    case 'completed': return 'Tamamlandı';
    default: return status;
  }
};

export default function ProjectCard({ 
  project, 
  index,
  onEdit, 
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  draggedIndex,
  dragOverIndex
}) {
  const progress = project.progress || 0;
  const tasks = project.tasks || [];
  const completedTasksCount = tasks.filter(t => t.is_completed).length;
  const totalTasksCount = tasks.length;

  // Calculate prices for external projects
  const totalBudget = tasks.reduce((sum, t) => sum + (parseFloat(t.price) || 0), 0);
  const earnedBudget = tasks.reduce((sum, t) => sum + (t.is_completed ? (parseFloat(t.price) || 0) : 0), 0);

  const formatPrice = (val) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      maximumFractionDigits: 0
    }).format(val);
  };

  const isDragging = index === draggedIndex;
  const isDragOver = index === dragOverIndex;

  return (
    <div 
      className={`project-card glass-card ${isDragging ? 'dragging' : ''} ${isDragOver ? 'drag-over' : ''}`}
      onClick={() => onEdit(project)}
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      onDragEnd={onDragEnd}
    >
      <div>
        <div className="project-card-header">
          <div className="project-badges">
            <span className={`badge ${project.type === 'personal' ? 'badge-personal' : 'badge-external'}`}>
              {project.type === 'personal' ? 'Kişisel' : 'Dış Proje'}
            </span>
            <span className={`badge badge-${project.status}`}>
              {getStatusLabel(project.status)}
            </span>
          </div>
        </div>
        
        <h3 className="project-card-title">{project.title}</h3>

        {/* Client label for external projects */}
        {project.type === 'external' && project.client && (
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
            <User size={13} style={{ color: 'var(--primary)' }} />
            <span>Müşteri: <strong style={{ color: 'var(--text-main)' }}>{project.client}</strong></span>
          </div>
        )}

        <p className="project-card-desc">
          {project.description ? project.description : <span style={{ fontStyle: 'italic', opacity: 0.6 }}>Açıklama belirtilmedi.</span>}
        </p>
      </div>

      <div>
        {/* Price display for external projects */}
        {project.type === 'external' && (
          <div className="project-card-price-wrapper" onClick={(e) => e.stopPropagation()}>
            <span className="price-label">Proje Bütçesi:</span>
            <span className="price-values">
              <span className="price-earned">{formatPrice(earnedBudget)}</span>
              <span style={{ opacity: 0.5 }}> / </span>
              <span>{formatPrice(totalBudget)}</span>
            </span>
          </div>
        )}

        <div className="project-card-progress-wrapper">
          <div className="progress-info">
            <span className="progress-label">İlerleme</span>
            <span className="progress-value">{progress}%</span>
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
          </div>
        </div>

        <div className="project-card-footer">
          <div className="task-counter" title="Görevler">
            <CheckSquare />
            <span>{completedTasksCount}/{totalTasksCount} Görev</span>
          </div>
          
          <div className="card-actions">
            <button 
              className="btn-card-action" 
              onClick={(e) => {
                e.stopPropagation();
                onEdit(project);
              }} 
              title="Düzenle ve Yönet"
            >
              <Edit3 />
            </button>
            <button 
              className="btn-card-action delete" 
              onClick={(e) => {
                e.stopPropagation();
                onDelete(project.id);
              }} 
              title="Projeyi Sil"
            >
              <Trash2 />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
