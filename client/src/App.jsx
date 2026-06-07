import React, { useState, useEffect } from 'react';
import KPIStats from './components/KPIStats';
import ProjectCard from './components/ProjectCard';
import ProjectModal from './components/ProjectModal';
import { 
  Activity, 
  FolderKanban, 
  Target, 
  Sun, 
  Moon, 
  Plus, 
  Layers, 
  Circle, 
  PlayCircle, 
  PauseCircle, 
  CheckCircle2, 
  AlertTriangle,
  RefreshCw,
  CheckCircle,
  Info,
  FolderOpen
} from 'lucide-react';

export default function App() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentFilter, setCurrentFilter] = useState('all');
  const [selectedClient, setSelectedClient] = useState('all');
  
  // Theme & Navigation Sidebar State
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [activeTab, setActiveTab] = useState('projects');
  
  // Sidebar tabs drag-and-drop state
  const [tabs, setTabs] = useState(() => {
    const savedTabs = localStorage.getItem('sidebar_tabs_order');
    if (savedTabs) {
      try { return JSON.parse(savedTabs); } catch(e) { }
    }
    return [
      { id: 'projects', label: 'Projeler', icon: 'projects' },
      { id: 'goals', label: 'Hedefler', icon: 'goals' }
    ];
  });

  // Project Drag and Drop State
  const [draggedProjectIdx, setDraggedProjectIdx] = useState(null);
  const [dragOverProjectIdx, setDragOverProjectIdx] = useState(null);

  // Tab Drag and Drop State
  const [draggedTabIdx, setDraggedTabIdx] = useState(null);
  const [dragOverTabIdx, setDragOverTabIdx] = useState(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  // Toast notifications state
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (theme === 'light') {
      document.body.classList.add('light-theme');
    } else {
      document.body.classList.remove('light-theme');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Show customized toast notification
  const showToast = (message, type = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  };

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // GET: Fetch all projects
  const fetchProjects = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch('/api/projects');
      if (!res.ok) throw new Error('Projeler yüklenirken bir sorun oluştu.');
      const data = await res.json();
      setProjects(data);
    } catch (err) {
      console.error(err);
      setError(true);
      showToast('Bağlantı hatası: Projeler çekilemedi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // POST/PUT: Save Project (Create new or Update metadata)
  const saveProject = async (projectData) => {
    try {
      let res;
      if (projectData.id) {
        // Edit existing project
        res = await fetch(`/api/projects/${projectData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(projectData)
        });
      } else {
        // Create new project
        res = await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...projectData, sort_order: projects.length })
        });
      }

      if (!res.ok) throw new Error('Proje kaydedilirken hata oluştu.');
      
      const savedProj = await res.json();
      
      if (projectData.id) {
        setProjects(prev => prev.map(p => p.id === savedProj.id ? savedProj : p));
        showToast('Proje başarıyla güncellendi.', 'success');
      } else {
        setProjects(prev => [...prev, savedProj]);
        showToast('Yeni proje başarıyla eklendi.', 'success');
      }
      
      setIsModalOpen(false);
      setSelectedProject(null);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // DELETE: Delete a Project
  const deleteProject = async (projectId) => {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;
    
    if (window.confirm(`"${proj.title}" projesini silmek istediğinize emin misiniz? Bu işlem geri alınamaz!`)) {
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error('Proje silinemedi.');
        
        setProjects(prev => prev.filter(p => p.id !== projectId));
        showToast('Proje başarıyla silindi.', 'info');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  };

  // POST: Add task inside a project
  const addTask = async (projectId, taskTitle, taskWeight, taskPrice) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: taskTitle, weight: taskWeight, price: taskPrice })
      });
      if (!res.ok) throw new Error('Görev eklenemedi.');
      
      const newTask = await res.json();
      
      const updatedProjects = projects.map(p => {
        if (p.id === projectId) {
          const updatedTasks = [...(p.tasks || []), newTask];
          
          // Recalculate progress
          const totalWeight = updatedTasks.reduce((sum, t) => sum + t.weight, 0);
          const completedWeight = updatedTasks.reduce((sum, t) => sum + (t.is_completed ? t.weight : 0), 0);
          const progress = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
          
          const updatedProj = { ...p, tasks: updatedTasks, progress };
          setSelectedProject(updatedProj);
          return updatedProj;
        }
        return p;
      });
      
      setProjects(updatedProjects);
      showToast('İş maddesi başarıyla eklendi.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // PUT: Toggle Task Complete Status
  const toggleTask = async (taskId) => {
    let targetTask = null;
    let targetProject = null;

    for (const p of projects) {
      const t = (p.tasks || []).find(x => x.id === taskId);
      if (t) {
        targetTask = t;
        targetProject = p;
        break;
      }
    }

    if (!targetTask || !targetProject) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: !targetTask.is_completed })
      });
      if (!res.ok) throw new Error('Görev durumu güncellenemedi.');
      
      const updatedTask = await res.json();

      const updatedProjects = projects.map(p => {
        if (p.id === targetProject.id) {
          const updatedTasks = p.tasks.map(t => t.id === taskId ? updatedTask : t);
          
          // Recalculate progress
          const totalWeight = updatedTasks.reduce((sum, t) => sum + t.weight, 0);
          const completedWeight = updatedTasks.reduce((sum, t) => sum + (t.is_completed ? t.weight : 0), 0);
          const progress = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
          
          const updatedProj = { ...p, tasks: updatedTasks, progress };
          setSelectedProject(updatedProj);
          return updatedProj;
        }
        return p;
      });

      setProjects(updatedProjects);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // DELETE: Delete Task
  const deleteTask = async (taskId) => {
    let targetProject = null;

    for (const p of projects) {
      const t = (p.tasks || []).find(x => x.id === taskId);
      if (t) {
        targetProject = p;
        break;
      }
    }

    if (!targetProject) return;

    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error('Görev silinemedi.');

      const updatedProjects = projects.map(p => {
        if (p.id === targetProject.id) {
          const updatedTasks = p.tasks.filter(t => t.id !== taskId);
          
          // Recalculate progress
          const totalWeight = updatedTasks.reduce((sum, t) => sum + t.weight, 0);
          const completedWeight = updatedTasks.reduce((sum, t) => sum + (t.is_completed ? t.weight : 0), 0);
          const progress = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
          
          const updatedProj = { ...p, tasks: updatedTasks, progress };
          setSelectedProject(updatedProj);
          return updatedProj;
        }
        return p;
      });

      setProjects(updatedProjects);
      showToast('Görev silindi.', 'info');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleEditClick = (project) => {
    setSelectedProject(project);
    setIsModalOpen(true);
  };

  const handleCreateClick = () => {
    setSelectedProject(null);
    setIsModalOpen(true);
  };

  // --- PROJECT DRAG AND DROP HANDLERS ---
  const handleProjectDragStart = (e, index) => {
    setDraggedProjectIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleProjectDragOver = (e, index) => {
    e.preventDefault();
    if (draggedProjectIdx === null || draggedProjectIdx === index) return;
    setDragOverProjectIdx(index);
  };

  const handleProjectDrop = async (e, index) => {
    e.preventDefault();
    if (draggedProjectIdx === null || draggedProjectIdx === index) return;

    const reordered = [...projects];
    const draggedItem = reordered[draggedProjectIdx];
    
    // Remove dragged item and insert at target index
    reordered.splice(draggedProjectIdx, 1);
    reordered.splice(index, 0, draggedItem);

    // Reassign sort orders
    const updatedWithOrder = reordered.map((item, idx) => ({
      ...item,
      sort_order: idx
    }));

    setProjects(updatedWithOrder);
    setDraggedProjectIdx(null);
    setDragOverProjectIdx(null);

    // Call API to persist reordering in PostgreSQL DB
    try {
      const payload = updatedWithOrder.map(p => ({ id: p.id, sort_order: p.sort_order }));
      const res = await fetch('/api/projects/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reorderedProjects: payload })
      });
      if (!res.ok) throw new Error('Yeni sıralama veritabanına kaydedilemedi.');
      showToast('Proje sıralaması güncellendi.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
      fetchProjects();
    }
  };

  const handleProjectDragEnd = () => {
    setDraggedProjectIdx(null);
    setDragOverProjectIdx(null);
  };

  // --- SIDEBAR NAV TABS DRAG AND DROP HANDLERS ---
  const handleTabDragStart = (e, index) => {
    setDraggedTabIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleTabDragOver = (e, index) => {
    e.preventDefault();
    if (draggedTabIdx === null || draggedTabIdx === index) return;
    setDragOverTabIdx(index);
  };

  const handleTabDrop = (e, index) => {
    e.preventDefault();
    if (draggedTabIdx === null || draggedTabIdx === index) return;

    const reorderedTabs = [...tabs];
    const draggedTab = reorderedTabs[draggedTabIdx];

    reorderedTabs.splice(draggedTabIdx, 1);
    reorderedTabs.splice(index, 0, draggedTab);

    setTabs(reorderedTabs);
    localStorage.setItem('sidebar_tabs_order', JSON.stringify(reorderedTabs));
    showToast('Sekme sıralaması güncellendi.', 'success');
    
    setDraggedTabIdx(null);
    setDragOverTabIdx(null);
  };

  const handleTabDragEnd = () => {
    setDraggedTabIdx(null);
    setDragOverTabIdx(null);
  };

  const renderTabIcon = (iconName) => {
    switch (iconName) {
      case 'projects': return <FolderKanban />;
      case 'goals': return <Target />;
      default: return <Info />;
    }
  };

  // Compute unique clients list
  const uniqueClients = [...new Set(projects.map(p => p.client).filter(c => c && c.trim() !== ''))];

  // Filtering projects list by status AND client
  const filteredProjects = projects
    .filter(p => currentFilter === 'all' || p.status === currentFilter)
    .filter(p => selectedClient === 'all' || p.client === selectedClient);

  return (
    <div className={`app-layout ${theme === 'light' ? 'light-theme' : ''}`}>
      {/* Background Ambient Lights */}
      <div className="glow-orb orb-1"></div>
      <div className="glow-orb orb-2"></div>
      <div className="glow-orb orb-3"></div>

      {/* Sidebar on left */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-icon">
              <Activity />
            </div>
            <h1>Life Tracker</h1>
          </div>

          <nav className="sidebar-nav">
            {tabs.map((tab, idx) => {
              const isTabDragging = idx === draggedTabIdx;
              const isTabDragOver = idx === dragOverTabIdx;
              return (
                <button
                  key={tab.id}
                  className={`sidebar-nav-btn ${activeTab === tab.id ? 'active' : ''} ${isTabDragging ? 'dragging' : ''} ${isTabDragOver ? 'drag-over' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  draggable
                  onDragStart={(e) => handleTabDragStart(e, idx)}
                  onDragOver={(e) => handleTabDragOver(e, idx)}
                  onDrop={(e) => handleTabDrop(e, idx)}
                  onDragEnd={handleTabDragEnd}
                >
                  {renderTabIcon(tab.icon)}
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-footer">
          {/* Theme switcher */}
          <button className="theme-toggle-btn" onClick={toggleTheme}>
            {theme === 'dark' ? (
              <>
                <Sun size={18} />
                Açık Tema
              </>
            ) : (
              <>
                <Moon size={18} />
                Koyu Tema
              </>
            )}
          </button>

          <div className="user-profile">
            <div className="avatar">İ</div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span className="welcome-text" style={{ fontSize: '13px' }}>Hoş geldin,</span>
              <strong className="user-highlight" style={{ fontSize: '14px' }}>İkbal</strong>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content area */}
      <main className="main-content">
        {activeTab === 'projects' ? (
          <>
            {/* Dashboard Stat Cards */}
            <KPIStats projects={projects} />

            {/* Action Bar (Filters & Adding Button) */}
            <section className="action-bar-section">
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="filters glass-card">
                  <button 
                    className={`filter-btn ${currentFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setCurrentFilter('all')}
                  >
                    <Layers /> Hepsi
                  </button>
                  <button 
                    className={`filter-btn ${currentFilter === 'not_started' ? 'active' : ''}`}
                    onClick={() => setCurrentFilter('not_started')}
                  >
                    <Circle /> Başlanmadı
                  </button>
                  <button 
                    className={`filter-btn ${currentFilter === 'in_progress' ? 'active' : ''}`}
                    onClick={() => setCurrentFilter('in_progress')}
                  >
                    <PlayCircle /> Devam Edenler
                  </button>
                  <button 
                    className={`filter-btn ${currentFilter === 'on_hold' ? 'active' : ''}`}
                    onClick={() => setCurrentFilter('on_hold')}
                  >
                    <PauseCircle /> Ertelenenler
                  </button>
                  <button 
                    className={`filter-btn ${currentFilter === 'completed' ? 'active' : ''}`}
                    onClick={() => setCurrentFilter('completed')}
                  >
                    <CheckCircle2 /> Tamamlananlar
                  </button>
                </div>

                {uniqueClients.length > 0 && (
                  <select 
                    value={selectedClient} 
                    onChange={(e) => {
                      setSelectedClient(e.target.value);
                      showToast(`Müşteri filtresi uygulandı.`, 'info');
                    }}
                    className="client-select-filter glass-card"
                    style={{
                      padding: '10px 16px',
                      borderRadius: '12px',
                      color: 'var(--text-main)',
                      fontFamily: 'inherit',
                      fontSize: '14px',
                      fontWeight: '500',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="all">Tüm Müşteriler</option>
                    {uniqueClients.map(clientName => (
                      <option key={clientName} value={clientName}>{clientName}</option>
                    ))}
                  </select>
                )}
              </div>
              
              <button className="btn btn-primary" onClick={handleCreateClick}>
                <Plus /> Yeni Proje Ekle
              </button>
            </section>

            {/* Projects Display Grid */}
            <section className="projects-grid-section">
              {loading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Projeler yükleniyor...</p>
                </div>
              ) : error ? (
                <div className="empty-state">
                  <AlertTriangle style={{ width: '48px', height: '48px', color: 'var(--danger)' }} />
                  <h3>Bağlantı Hatası</h3>
                  <p>PostgreSQL sunucusuna veya backend API'sine bağlanılamıyor.</p>
                  <button className="btn btn-secondary" onClick={fetchProjects}>
                    <RefreshCw /> Tekrar Dene
                  </button>
                </div>
              ) : filteredProjects.length === 0 ? (
                <div className="empty-state">
                  <FolderOpen style={{ width: '56px', height: '56px' }} />
                  <h3>Proje Bulunamadı</h3>
                  <p>
                    {currentFilter === 'all' && selectedClient === 'all'
                      ? 'Henüz hiçbir proje oluşturmadınız.' 
                      : 'Bu filtrelere uygun bir proje bulunamadı.'}
                  </p>
                  {currentFilter === 'all' && selectedClient === 'all' && (
                    <button className="btn btn-primary" onClick={handleCreateClick}>
                      <Plus /> İlk Projeyi Ekle
                    </button>
                  )}
                </div>
              ) : (
                <div className="projects-grid">
                  {filteredProjects.map((project, idx) => (
                    <ProjectCard 
                      key={project.id} 
                      project={project} 
                      index={idx}
                      onEdit={handleEditClick}
                      onDelete={deleteProject}
                      onDragStart={handleProjectDragStart}
                      onDragOver={handleProjectDragOver}
                      onDrop={handleProjectDrop}
                      onDragEnd={handleProjectDragEnd}
                      draggedIndex={draggedProjectIdx}
                      dragOverIndex={dragOverProjectIdx}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : (
          /* Hedefler Tab Placeholder Page */
          <div className="tab-placeholder-page glass-card">
            <Target />
            <h2>Hedefler Modülü</h2>
            <p>
              Kişisel hedeflerinizi, yıllık kararlarınızı ve gelişim planlarınızı bu alandan takip edebileceksiniz. Çok yakında burada!
            </p>
            <button className="btn btn-primary" onClick={() => setActiveTab('projects')}>
              Projeler Modülüne Dön
            </button>
          </div>
        )}
      </main>

      {/* Project Management Modal */}
      <ProjectModal
        isOpen={isModalOpen}
        project={selectedProject}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedProject(null);
        }}
        onSaveProject={saveProject}
        onAddTask={addTask}
        onToggleTask={toggleTask}
        onDeleteTask={deleteTask}
      />

      {/* Toast Notifications */}
      <div className="toast-container">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <div className="toast-icon">
              {t.type === 'success' ? <CheckCircle /> : <Info />}
            </div>
            <div className="toast-message">{t.message}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
