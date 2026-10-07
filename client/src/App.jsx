import { useState, useEffect } from 'react';
import { localDateStr, dayString } from './dates';
import KPIStats from './components/KPIStats';
import ProjectCard from './components/ProjectCard';
import ProjectModal from './components/ProjectModal';
import GoalCard from './components/GoalCard';
import GoalModal from './components/GoalModal';
import GoalKPIs from './components/GoalKPIs';
import HabitModal from './components/HabitModal';
import HomeDashboard from './components/HomeDashboard';
import ReceivablesDashboard from './components/ReceivablesDashboard';
import DailyDashboard from './components/DailyDashboard';
import CalendarDashboard from './components/CalendarDashboard';
import CommandPalette from './components/CommandPalette';
import QuickAdd from './components/QuickAdd';
import HealthDashboard from './components/HealthDashboard';
import ModalShell from './components/ModalShell';
import AccountModal from './components/AccountModal';
import { buildReceivables, projectPayments } from './receivables';
import { confirmDialog } from './ui';
import JournalDashboard from './components/JournalDashboard';
import { 
  Activity, 
  Home,
  LogOut,
  FileText,
  Wallet,
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
  FolderOpen,
  LayoutGrid,
  List,
  Flame,
  BookOpen,
  Eye,
  EyeOff,
  CalendarDays,
  Search,
  Download,
  HeartPulse,
  MoreHorizontal,
  User
} from 'lucide-react';

const VALID_TABS = ['home', 'projects', 'goals', 'daily', 'journal', 'receivables', 'calendar', 'health'];
const LEGACY_TABS = { habits: 'daily', routines: 'daily', yearly_payments: 'receivables' };
const NAV_TABS = [
  { id: 'home', label: 'Ana Sayfa', icon: <Home /> },
  { id: 'projects', label: 'Projeler', icon: <FolderKanban /> },
  { secondary: true, id: 'goals', label: 'Hedefler', icon: <Target /> },
  { secondary: true, id: 'daily', label: 'Günlük Düzen', icon: <Flame /> },
  { id: 'receivables', label: 'Alacaklar', icon: <Wallet /> },
  { secondary: true, id: 'calendar', label: 'Takvim', icon: <CalendarDays /> },
  { id: 'health', label: 'Sağlık', icon: <HeartPulse /> },
  { secondary: true, id: 'journal', label: 'Günlük', icon: <BookOpen /> }
];
const resolveTab = (hash) => {
  const id = LEGACY_TABS[hash] || hash;
  return VALID_TABS.includes(id) ? id : 'home';
};

export default function App({ onLogout, username }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentFilter, setCurrentFilter] = useState('all');
  const [selectedClient, setSelectedClient] = useState('all');
  const [projectSearch, setProjectSearch] = useState('');
  const [paymentFilter, setPaymentFilter] = useState('all'); // all | overdue
  
  // Theme & Navigation Sidebar State
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [activeTab, setActiveTab] = useState(() => resolveTab(window.location.hash.slice(1)));

  // Tab title shows the current page (browser history, window switcher)
  useEffect(() => {
    const tab = NAV_TABS.find(t => t.id === activeTab);
    document.title = `${tab ? tab.label : 'Ana Sayfa'} · Softium Planner`;
  }, [activeTab]);

  // Sync activeTab state changes to URL hash
  useEffect(() => {
    if (window.location.hash.slice(1) !== activeTab) {
      window.location.hash = activeTab;
    }
  }, [activeTab]);

  // Listen to browser forward/back hash navigation changes
  useEffect(() => {
    const handleHashChange = () => {
      setActiveTab(resolveTab(window.location.hash.slice(1)));
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);
  
  // Project Drag and Drop State
  const [draggedProjectIdx, setDraggedProjectIdx] = useState(null);
  const [dragOverProjectIdx, setDragOverProjectIdx] = useState(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);

  // Goals States
  const [goals, setGoals] = useState([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [goalsError, setGoalsError] = useState(false);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState(null);
  const [hideCompletedGoals, setHideCompletedGoals] = useState(false);
  const [goalsViewMode, setGoalsViewMode] = useState(() => localStorage.getItem('goals_view_mode') || 'grid');
  const [draggedGoalIdx, setDraggedGoalIdx] = useState(null);
  const [dragOverGoalIdx, setDragOverGoalIdx] = useState(null);

  // Habits States
  const [habits, setHabits] = useState([]);
  const [habitsLoading, setHabitsLoading] = useState(true);
  const [habitsError, setHabitsError] = useState(false);
  const [isHabitModalOpen, setIsHabitModalOpen] = useState(false);
  const [selectedHabit, setSelectedHabit] = useState(null);
  const [habitsViewMode, setHabitsViewMode] = useState(() => localStorage.getItem('habits_view_mode') || 'weekly');
  const [draggedHabitIdx, setDraggedHabitIdx] = useState(null);
  const [dragOverHabitIdx, setDragOverHabitIdx] = useState(null);

  // Routines States
  const [routines, setRoutines] = useState([]);
  const [routinesLoading, setRoutinesLoading] = useState(false);
  const [routinesError, setRoutinesError] = useState(false);

  // Journal/Mood States
  const [journalEntries, setJournalEntries] = useState([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalError, setJournalError] = useState(false);

  // Project templates, command palette, quick add
  const [templates, setTemplates] = useState([]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false); // phone: "Daha" sheet

  // Yearly payments (shared by Home & Alacaklar)
  const [yearlyPayments, setYearlyPayments] = useState([]);
  const [usdTryRate, setUsdTryRate] = useState(34.0);

  // Toast notifications state
  const [toasts, setToasts] = useState([]);

  // Shared mask & currency preferences
  const [displayCurrency, setDisplayCurrency] = useState(() => {
    return localStorage.getItem('display_currency') || 'TRY';
  });
  // Amounts are always hidden on page load (not remembered); the eye button reveals them
  const [hideAmounts, setHideAmounts] = useState(true);

  useEffect(() => {
    localStorage.setItem('display_currency', displayCurrency);
  }, [displayCurrency]);

  useEffect(() => {
    localStorage.setItem('goals_view_mode', goalsViewMode);
  }, [goalsViewMode]);

  useEffect(() => {
    localStorage.setItem('habits_view_mode', habitsViewMode);
  }, [habitsViewMode]);

  useEffect(() => {
    fetchProjects();
    fetchGoals();
    fetchHabits();
    fetchRoutines();
    fetchJournal();
    fetchYearlyPayments();
    fetchRate();
    fetchTemplates();
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
  const showToast = (message, type = 'info', action = null) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type, action }]);

    // Toasts with an action (e.g. "Geri al") stay longer
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, action ? 9000 : 3500);
  };

  const dismissToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  // Ctrl/Cmd+K opens the command palette from anywhere
  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(open => !open);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Toasts requested from outside App (e.g. modals) via ui.notify()
  useEffect(() => {
    const onToast = (e) => showToast(e.detail.message, e.detail.type, e.detail.action || null);
    window.addEventListener('ui-toast', onToast);
    return () => window.removeEventListener('ui-toast', onToast);
  }, []);

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
        showToast('Proje kaydedildi.', 'success');
        setIsModalOpen(false);
        setSelectedProject(null);
      } else {
        setProjects(prev => [...prev, savedProj]);
        // Stay open in edit mode so tasks can be added right away
        setSelectedProject(savedProj);
        showToast('Proje oluşturuldu. Şimdi görevlerini ekleyebilirsin.', 'success');
      }
      return savedProj;
    } catch (err) {
      showToast(err.message, 'error');
      return null;
    }
  };

  // DELETE: Delete a Project
  const deleteProject = async (projectId) => {
    const proj = projects.find(p => p.id === projectId);
    if (!proj) return;
    
    if (await confirmDialog({ title: 'Proje silinsin mi?', message: `"${proj.title}" ve tüm görevleri kalıcı olarak silinecek.`, confirmText: 'Sil', danger: true })) {
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error('Proje silinemedi.');
        
        setProjects(prev => prev.filter(p => p.id !== projectId));
        showToast('Proje silindi.', 'info', {
          label: 'Geri al',
          onClick: async () => {
            try {
              const created = await sendJson('/api/projects', 'POST', {
                title: proj.title, description: proj.description, notes: proj.notes,
                client: proj.client, type: proj.type, status: proj.status
              }).then(r => r.json());
              for (const t of proj.tasks || []) {
                const restored = await sendJson(`/api/projects/${created.id}/tasks`, 'POST', {
                  title: t.title, weight: t.weight, price: t.price, paid_price: t.paid_price,
                  description: t.description, due_date: t.due_date, priority: t.priority,
                  is_today: t.is_today, checklist: t.checklist, repeat: t.repeat
                }).then(r => r.json());
                if (t.is_completed) await sendJson(`/api/tasks/${restored.id}`, 'PUT', { is_completed: true });
              }
              await fetchProjects();
              showToast('Proje geri alındı.', 'success');
            } catch {
              showToast('Proje geri alınamadı.', 'error');
            }
          }
        });
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  };

  const transferProjectToYearly = async (project) => {
    if (yearlyPayments.some(y => y.project_id === project.id)) {
      showToast('Bu proje için zaten bir yıllık ödeme kaydı var. Alacaklar > Yıllık Ödemeleri Yönet bölümünden düzenleyebilirsiniz.', 'info');
      return;
    }
    try {
      const todayStr = localDateStr();
      const payload = {
        project_id: project.id,
        title: project.title,
        client: project.client || '',
        amount: 0,
        due_date: todayStr,
        description: `Proje ile ilişkili yıllık ödeme.`
      };
      
      const res = await fetch('/api/yearly-payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!res.ok) throw new Error('Proje yıllık ödemelere aktarılamadı.');
      
      fetchYearlyPayments();
      showToast('Yıllık ödeme kaydı oluşturuldu. Tutar ve tarihi Alacaklar > Yıllık Ödemeleri Yönet bölümünden girin.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Apply a change to one project's tasks and recompute its progress.
  // Uses functional updates so several task calls in a row never overwrite each other.
  const patchProjectTasks = (projectId, mutateTasks) => {
    const recalc = (p) => {
      const tasks = mutateTasks(p.tasks || []);
      const totalWeight = tasks.reduce((sum, t) => sum + t.weight, 0);
      const completedWeight = tasks.reduce((sum, t) => sum + (t.is_completed ? t.weight : 0), 0);
      const progress = totalWeight > 0 ? Math.round((completedWeight / totalWeight) * 100) : 0;
      return { ...p, tasks, progress };
    };
    setProjects(prev => prev.map(p => (p.id === projectId ? recalc(p) : p)));
    setSelectedProject(sel => (sel && sel.id === projectId ? recalc(sel) : sel));
  };

  const findTaskOwner = (taskId) => {
    for (const p of projects) {
      const t = (p.tasks || []).find(x => x.id === taskId);
      if (t) return { project: p, task: t };
    }
    return null;
  };

  const sendJson = (url, method, body) => fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  // Merge a server task (and a spawned recurring copy, if any) into the project
  const applyTaskResult = (projectId, taskId, result) => {
    const { spawned, ...task } = result;
    patchProjectTasks(projectId, tasks => {
      const next = tasks.map(t => (t.id === taskId ? task : t));
      return spawned ? [...next, spawned] : next;
    });
    if (spawned) {
      showToast('Tekrarlayan görevin bir sonraki hali eklendi.', 'info');
    }
  };

  // POST: Add task inside a project (extra = priority, is_today, checklist, repeat)
  const addTask = async (projectId, taskTitle, taskWeight, taskPrice, taskPaidPrice, taskDescription, taskDueDate, extra = {}) => {
    try {
      const res = await sendJson(`/api/projects/${projectId}/tasks`, 'POST', {
        title: taskTitle,
        weight: taskWeight,
        price: taskPrice,
        paid_price: taskPaidPrice || 0,
        description: taskDescription || '',
        due_date: taskDueDate || null,
        ...extra
      });
      if (!res.ok) throw new Error('Görev eklenemedi.');
      const newTask = await res.json();
      patchProjectTasks(projectId, tasks => [...tasks, newTask]);
      showToast('Görev eklendi.', 'success');
      return newTask;
    } catch (err) {
      showToast(err.message, 'error');
      return null;
    }
  };

  // PUT: Update Task details
  const updateTask = async (taskId, taskData, { silent = false } = {}) => {
    const owner = findTaskOwner(taskId);
    if (!owner) return false;
    try {
      const res = await sendJson(`/api/tasks/${taskId}`, 'PUT', taskData);
      if (!res.ok) throw new Error('Görev güncellenemedi.');
      applyTaskResult(owner.project.id, taskId, await res.json());
      if (!silent) showToast('Görev güncellendi.', 'success');
      return true;
    } catch (err) {
      showToast(err.message, 'error');
      return false;
    }
  };

  // PUT: Toggle Task Complete Status
  const toggleTask = async (taskId) => {
    const owner = findTaskOwner(taskId);
    if (!owner) return;
    try {
      const res = await sendJson(`/api/tasks/${taskId}`, 'PUT', { is_completed: !owner.task.is_completed });
      if (!res.ok) throw new Error('Görev durumu güncellenemedi.');
      applyTaskResult(owner.project.id, taskId, await res.json());
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // DELETE: Delete Task (with undo)
  const deleteTask = async (taskId) => {
    const owner = findTaskOwner(taskId);
    if (!owner) return;
    const snapshot = owner.task;
    const projectId = owner.project.id;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Görev silinemedi.');
      patchProjectTasks(projectId, tasks => tasks.filter(t => t.id !== taskId));
      showToast('Görev silindi.', 'info', {
        label: 'Geri al',
        onClick: async () => {
          const restored = await addTask(
            projectId, snapshot.title, snapshot.weight, parseFloat(snapshot.price) || 0,
            parseFloat(snapshot.paid_price) || 0, snapshot.description, snapshot.due_date,
            { priority: snapshot.priority, is_today: snapshot.is_today, checklist: snapshot.checklist, repeat: snapshot.repeat }
          );
          if (restored && snapshot.is_completed) await sendJson(`/api/tasks/${restored.id}`, 'PUT', { is_completed: true }).then(r => r.json()).then(t => applyTaskResult(projectId, restored.id, t));
        }
      });
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // PUT: persist a new task order
  const reorderTasks = async (projectId, orderedIds) => {
    patchProjectTasks(projectId, tasks => orderedIds.map(id => tasks.find(t => t.id === id)).filter(Boolean));
    try {
      await sendJson(`/api/projects/${projectId}/tasks/reorder`, 'PUT', { ids: orderedIds });
    } catch {
      showToast('Sıralama kaydedilemedi.', 'error');
    }
  };

  // Payment history of a task
  const addTaskPayment = async (taskId, payload) => {
    const owner = findTaskOwner(taskId);
    if (!owner) return false;
    try {
      const res = await sendJson(`/api/tasks/${taskId}/payments`, 'POST', payload);
      if (!res.ok) throw new Error('Ödeme kaydedilemedi.');
      const task = await res.json();
      patchProjectTasks(owner.project.id, tasks => tasks.map(t => (t.id === taskId ? task : t)));
      showToast('Ödeme kaydedildi.', 'success');
      return true;
    } catch (err) {
      showToast(err.message, 'error');
      return false;
    }
  };

  const deleteTaskPayment = async (taskId, paymentId) => {
    const owner = findTaskOwner(taskId);
    if (!owner) return;
    try {
      const res = await fetch(`/api/task-payments/${paymentId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Ödeme silinemedi.');
      const task = await res.json();
      patchProjectTasks(owner.project.id, tasks => tasks.map(t => (t.id === taskId ? task : t)));
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Templates
  const fetchTemplates = async () => {
    try {
      const res = await fetch('/api/templates');
      if (res.ok) setTemplates(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const saveTemplate = async (name, project) => {
    try {
      const res = await sendJson('/api/templates', 'POST', { name, type: project.type, tasks: project.tasks || [] });
      if (!res.ok) throw new Error('Şablon kaydedilemedi.');
      await fetchTemplates();
      showToast(`"${name}" şablonu kaydedildi.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const deleteTemplate = async (id) => {
    await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    fetchTemplates();
  };

  const applyTemplate = async (projectId, template) => {
    for (const t of template.tasks || []) {
      await sendJson(`/api/projects/${projectId}/tasks`, 'POST', {
        title: t.title, weight: t.weight, price: t.price || 0, description: t.description || '',
        priority: t.priority, checklist: t.checklist
      }).then(r => r.json()).then(task => patchProjectTasks(projectId, tasks => [...tasks, task]));
    }
    showToast(`"${template.name}" şablonundan ${(template.tasks || []).length} görev eklendi.`, 'success');
  };

  const handleEditClick = (project) => {
    setSelectedProject(project);
    setIsModalOpen(true);
  };

  // Open a project modal by its ID (used by PendingPayments click)
  const handleOpenProjectById = (projectId) => {
    const proj = projects.find(p => p.id === projectId);
    if (proj) {
      setSelectedProject(proj);
      setIsModalOpen(true);
    }
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

  const getSortedGoals = (goalsList) => {
    const getGoalPriorityScore = (g) => {
      const isCompleted = g.is_completed || (g.progress_type === 'metric' && parseFloat(g.current_value) >= parseFloat(g.target_value));
      if (isCompleted) return 0;
      
      if (!g.target_date) return 1;
      
      const targetDate = new Date(g.target_date);
      targetDate.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const diffTime = targetDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) return 3; // Overdue
      if (diffDays === 0) return 2; // Today
      return 1; // Future / no date
    };

    return [...goalsList].sort((a, b) => {
      const scoreA = getGoalPriorityScore(a);
      const scoreB = getGoalPriorityScore(b);
      
      if (scoreA !== scoreB) {
        return scoreB - scoreA; // Descending score
      }
      
      // If both are overdue or due today, sort by target date ascending (earliest deadline first)
      if (scoreA >= 2 && a.target_date && b.target_date) {
        return new Date(a.target_date) - new Date(b.target_date);
      }
      
      // Otherwise keep sorting order
      return (a.sort_order || 0) - (b.sort_order || 0);
    });
  };

  // === GOALS CRUD & ACTION HANDLERS ===
  
  // GET: Fetch all goals
  const fetchGoals = async () => {
    setGoalsLoading(true);
    setGoalsError(false);
    try {
      const res = await fetch('/api/goals');
      if (!res.ok) throw new Error('Hedefler yüklenirken bir sorun oluştu.');
      const data = await res.json();
      setGoals(data);
    } catch (err) {
      console.error(err);
      setGoalsError(true);
      showToast('Bağlantı hatası: Hedefler çekilemedi.', 'error');
    } finally {
      setGoalsLoading(false);
    }
  };

  // POST/PUT: Save Goal (Create new or Update metadata)
  const saveGoal = async (goalData) => {
    try {
      let res;
      if (goalData.id) {
        // Edit existing goal
        res = await fetch(`/api/goals/${goalData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(goalData)
        });
      } else {
        // Create new goal
        res = await fetch('/api/goals', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...goalData, sort_order: goals.length })
        });
      }

      if (!res.ok) throw new Error('Hedef kaydedilirken hata oluştu.');
      
      const savedGoal = await res.json();
      
      if (goalData.id) {
        setGoals(prev => prev.map(g => g.id === savedGoal.id ? savedGoal : g));
        showToast('Hedef başarıyla güncellendi.', 'success');
      } else {
        setGoals(prev => [...prev, savedGoal]);
        showToast('Yeni hedef başarıyla eklendi.', 'success');
      }
      
      setIsGoalModalOpen(false);
      setSelectedGoal(null);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // DELETE: Delete a Goal
  const deleteGoal = async (goalId) => {
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return;
    
    if (await confirmDialog({ title: 'Hedef silinsin mi?', message: `"${goal.title}" kalıcı olarak silinecek.`, confirmText: 'Sil', danger: true })) {
      try {
        const res = await fetch(`/api/goals/${goalId}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error('Hedef silinemedi.');
        
        setGoals(prev => prev.filter(g => g.id !== goalId));
        showToast('Hedef silindi.', 'info', {
          label: 'Geri al',
          onClick: async () => {
            const res = await sendJson('/api/goals', 'POST', {
              title: goal.title, why_note: goal.why_note, description: goal.description, category: goal.category,
              target_date: goal.target_date, priority: goal.priority, progress_type: goal.progress_type,
              current_value: goal.current_value, target_value: goal.target_value, unit: goal.unit, link_url: goal.link_url
            });
            if (res.ok) { await fetchGoals(); showToast('Hedef geri alındı.', 'success'); }
            else showToast('Hedef geri alınamadı.', 'error');
          }
        });
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  };

  // PUT: Toggle Goal Complete Status (primarily for boolean yes/no type)
  const toggleGoalStatus = async (goal) => {
    const newCompleted = !goal.is_completed;
    try {
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: newCompleted })
      });
      if (!res.ok) throw new Error('Hedef durumu güncellenemedi.');
      
      const updatedGoal = await res.json();
      setGoals(prev => prev.map(g => g.id === updatedGoal.id ? updatedGoal : g));
      
      if (newCompleted) {
        showToast('Tebrikler! Hedefe ulaştınız.', 'success');
      } else {
        showToast('Hedef bekleme durumuna alındı.', 'info');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // PUT: Increment Metric Goal Progress (+1 button)
  const incrementGoalProgress = async (goalId) => {
    try {
      const res = await fetch(`/api/goals/${goalId}/increment`, {
        method: 'PUT'
      });
      if (!res.ok) throw new Error('Hedef ilerlemesi artırılamadı.');
      
      const updatedGoal = await res.json();
      setGoals(prev => prev.map(g => g.id === updatedGoal.id ? updatedGoal : g));
      
      if (updatedGoal.is_completed) {
        showToast('Tebrikler! Hedef hedeflenen değere ulaştı ve tamamlandı.', 'success');
      } else {
        showToast('İlerleme kaydedildi.', 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleEditGoalClick = (goal) => {
    setSelectedGoal(goal);
    setIsGoalModalOpen(true);
  };

  const handleCreateGoalClick = () => {
    setSelectedGoal(null);
    setIsGoalModalOpen(true);
  };

  // --- GOAL DRAG AND DROP HANDLERS ---
  const handleGoalDragStart = (e, index) => {
    setDraggedGoalIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleGoalDragOver = (e, index) => {
    e.preventDefault();
    if (draggedGoalIdx === null || draggedGoalIdx === index) return;
    setDragOverGoalIdx(index);
  };

  const handleGoalDrop = async (e, index) => {
    e.preventDefault();
    if (draggedGoalIdx === null || draggedGoalIdx === index) return;

    const reordered = [...goals];
    const draggedItem = reordered[draggedGoalIdx];
    
    // Remove dragged item and insert at target index
    reordered.splice(draggedGoalIdx, 1);
    reordered.splice(index, 0, draggedItem);

    // Reassign sort orders
    const updatedWithOrder = reordered.map((item, idx) => ({
      ...item,
      sort_order: idx
    }));

    setGoals(updatedWithOrder);
    setDraggedGoalIdx(null);
    setDragOverGoalIdx(null);

    // Call API to persist reordering in PostgreSQL DB
    try {
      const payload = updatedWithOrder.map(g => ({ id: g.id, sort_order: g.sort_order }));
      const res = await fetch('/api/goals/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reorderedGoals: payload })
      });
      if (!res.ok) throw new Error('Hedef sıralaması veritabanına kaydedilemedi.');
      showToast('Hedef sıralaması güncellendi.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
      fetchGoals();
    }
  };

  const handleGoalDragEnd = () => {
    setDraggedGoalIdx(null);
    setDragOverGoalIdx(null);
  };

  // === HABITS CRUD & ACTION HANDLERS ===
  
  // GET: Fetch all habits
  const fetchHabits = async () => {
    setHabitsLoading(true);
    setHabitsError(false);
    try {
      const res = await fetch('/api/habits');
      if (!res.ok) throw new Error('Alışkanlıklar yüklenirken bir sorun oluştu.');
      const data = await res.json();
      setHabits(data);
    } catch (err) {
      console.error(err);
      setHabitsError(true);
      showToast('Bağlantı hatası: Alışkanlıklar çekilemedi.', 'error');
    } finally {
      setHabitsLoading(false);
    }
  };

  // POST/PUT: Save Habit (Create new or Update metadata)
  const saveHabit = async (habitData) => {
    try {
      let res;
      if (habitData.id) {
        // Edit existing habit
        res = await fetch(`/api/habits/${habitData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(habitData)
        });
      } else {
        // Create new habit
        res = await fetch('/api/habits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...habitData, sort_order: habits.length })
        });
      }

      if (!res.ok) throw new Error('Alışkanlık kaydedilirken hata oluştu.');
      
      const savedHabit = await res.json();
      
      if (habitData.id) {
        setHabits(prev => prev.map(h => h.id === savedHabit.id ? savedHabit : h));
        showToast('Alışkanlık başarıyla güncellendi.', 'success');
      } else {
        setHabits(prev => [...prev, savedHabit]);
        showToast('Yeni alışkanlık başarıyla eklendi.', 'success');
      }
      
      setIsHabitModalOpen(false);
      setSelectedHabit(null);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // DELETE: Delete a Habit
  const deleteHabit = async (habitId) => {
    const habit = habits.find(h => h.id === habitId);
    if (!habit) return;
    
    if (await confirmDialog({ title: 'Alışkanlık silinsin mi?', message: `"${habit.title}" ve geçmiş kayıtları kalıcı olarak silinecek.`, confirmText: 'Sil', danger: true })) {
      try {
        const res = await fetch(`/api/habits/${habitId}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error('Alışkanlık silinemedi.');
        
        setHabits(prev => prev.filter(h => h.id !== habitId));
        showToast('Alışkanlık silindi.', 'info', {
          label: 'Geri al',
          onClick: async () => {
            try {
              const created = await sendJson('/api/habits', 'POST', {
                title: habit.title, description: habit.description, category: habit.category, frequency: habit.frequency,
                custom_days: habit.custom_days, target_count: habit.target_count, weekly_targets: habit.weekly_targets
              }).then(r => r.json());
              // bring back the recent history we still have (last 35 days)
              for (const l of habit.logs || []) {
                await sendJson(`/api/habits/${created.id}/log`, 'POST', { log_date: l.log_date, count: l.count });
              }
              await fetchHabits();
              showToast('Alışkanlık geri alındı.', 'success');
            } catch {
              showToast('Alışkanlık geri alınamadı.', 'error');
            }
          }
        });
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  };

  // POST: Log/Increment completion count for a date
  const logHabit = async (habitId, logDate, count) => {
    try {
      const res = await fetch(`/api/habits/${habitId}/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ log_date: logDate, count })
      });
      if (!res.ok) throw new Error('Alışkanlık kaydı güncellenemedi.');
      
      const updatedHabit = await res.json();
      setHabits(prev => prev.map(h => h.id === updatedHabit.id ? updatedHabit : h));
      
      const targetCount = updatedHabit.target_count || 1;
      if (count >= targetCount) {
        showToast('Tebrikler! Alışkanlık hedefine ulaşıldı.', 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const handleEditHabitClick = (habit) => {
    setSelectedHabit(habit);
    setIsHabitModalOpen(true);
  };

  const handleCreateHabitClick = () => {
    setSelectedHabit(null);
    setIsHabitModalOpen(true);
  };

  // --- HABIT DRAG AND DROP HANDLERS ---
  const handleHabitDragStart = (e, index) => {
    setDraggedHabitIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleHabitDragOver = (e, index) => {
    e.preventDefault();
    if (draggedHabitIdx === null || draggedHabitIdx === index) return;
    setDragOverHabitIdx(index);
  };

  const handleHabitDrop = async (e, index) => {
    e.preventDefault();
    if (draggedHabitIdx === null || draggedHabitIdx === index) return;

    const reordered = [...habits];
    const draggedItem = reordered[draggedHabitIdx];
    
    reordered.splice(draggedHabitIdx, 1);
    reordered.splice(index, 0, draggedItem);

    const updatedWithOrder = reordered.map((item, idx) => ({
      ...item,
      sort_order: idx
    }));

    setHabits(updatedWithOrder);
    setDraggedHabitIdx(null);
    setDragOverHabitIdx(null);

    try {
      const payload = updatedWithOrder.map(h => ({ id: h.id, sort_order: h.sort_order }));
      const res = await fetch('/api/habits/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reorderedHabits: payload })
      });
      if (!res.ok) throw new Error('Sıralama veritabanına kaydedilemedi.');
      showToast('Alışkanlık sıralaması güncellendi.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
      fetchHabits();
    }
  };

  const handleHabitDragEnd = () => {
    setDraggedHabitIdx(null);
    setDragOverHabitIdx(null);
  };

  // === ROUTINES ACTIONS & OPERATION HANDLERS ===
  const fetchRoutines = async () => {
    setRoutinesLoading(true);
    setRoutinesError(false);
    try {
      const res = await fetch('/api/routines');
      if (!res.ok) throw new Error('Rutinler yüklenirken bir hata oluştu.');
      const data = await res.json();
      setRoutines(data);
    } catch (err) {
      console.error(err);
      setRoutinesError(true);
    } finally {
      setRoutinesLoading(false);
    }
  };

  const saveRoutine = async (routineData) => {
    try {
      const editing = !!routineData.id;
      const res = await fetch(editing ? `/api/routines/${routineData.id}` : '/api/routines', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routineData)
      });
      if (!res.ok) throw new Error('Rutin kaydedilirken hata oluştu.');
      if (editing) {
        await fetchRoutines();
        showToast('Rutin güncellendi.', 'success');
      } else {
        const data = await res.json();
        setRoutines(prev => [data, ...prev]);
        showToast('Yeni rutin başarıyla eklendi.', 'success');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const toggleRoutineComplete = async (id, isCompleted) => {
    try {
      const res = await fetch(`/api/routines/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: isCompleted })
      });
      if (!res.ok) throw new Error('Rutin durumu güncellenemedi.');
      
      setRoutines(prev => prev.map(r => r.id === id ? { 
        ...r, 
        is_completed_today: isCompleted,
        is_started_today: isCompleted ? true : r.is_started_today,
        steps: r.steps.map(s => ({ ...s, is_completed_today: isCompleted }))
      } : r));
      if (isCompleted) {
        showToast('Harika! Rutini bugün için tamamladınız. 🌟', 'success');
      } else {
        showToast('Rutin tamamlanma kaydı geri alındı.', 'info');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const startRoutine = async (id, isStarted) => {
    try {
      const res = await fetch(`/api/routines/${id}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_started: isStarted })
      });
      if (!res.ok) throw new Error('Rutin başlatma durumu güncellenemedi.');
      
      setRoutines(prev => prev.map(r => {
        if (r.id === id) {
          return {
            ...r,
            is_started_today: isStarted,
            is_completed_today: isStarted ? r.is_completed_today : false,
            steps: r.steps.map(s => isStarted ? s : { ...s, is_completed_today: false })
          };
        }
        return r;
      }));

      if (isStarted) {
        showToast('Rutin başlatıldı, adımları tamamlamaya başlayabilirsiniz! 🚀', 'success');
      } else {
        showToast('Rutin sıfırlandı.', 'info');
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const toggleStepComplete = async (routineId, stepId, isCompleted) => {
    try {
      const res = await fetch(`/api/routines/steps/${stepId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: isCompleted })
      });
      if (!res.ok) throw new Error('Adım durumu güncellenemedi.');

      setRoutines(prev => prev.map(r => {
        if (r.id === routineId) {
          const updatedSteps = r.steps.map(s => s.id === stepId ? { ...s, is_completed_today: isCompleted } : s);
          const allCompleted = updatedSteps.length > 0 && updatedSteps.every(s => s.is_completed_today);
          
          if (allCompleted && !r.is_completed_today) {
            fetch(`/api/routines/${routineId}/complete`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_completed: true })
            }).catch(console.error);
            showToast('Harika! Rutini bugün için tamamladınız. 🌟', 'success');
          } else if (!allCompleted && r.is_completed_today) {
            fetch(`/api/routines/${routineId}/complete`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_completed: false })
            }).catch(console.error);
          }

          return {
            ...r,
            steps: updatedSteps,
            is_completed_today: allCompleted,
            is_started_today: true
          };
        }
        return r;
      }));
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const deleteRoutine = async (id) => {
    const snapshot = routines.find(r => r.id === id);
    if (await confirmDialog({ title: 'Rutin silinsin mi?', message: 'Rutin ve adımları kalıcı olarak silinecek.', confirmText: 'Sil', danger: true })) {
      try {
        const res = await fetch(`/api/routines/${id}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error('Rutin silinemedi.');
        setRoutines(prev => prev.filter(r => r.id !== id));
        showToast('Rutin silindi.', 'info', snapshot ? {
          label: 'Geri al',
          onClick: async () => {
            const r = await sendJson('/api/routines', 'POST', {
              title: snapshot.title, description: snapshot.description, icon: snapshot.icon,
              steps: (snapshot.steps || []).map(st => ({ title: st.title }))
            });
            if (r.ok) { await fetchRoutines(); showToast('Rutin geri alındı.', 'success'); }
            else showToast('Rutin geri alınamadı.', 'error');
          }
        } : null);
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  };

  // === JOURNAL ACTIONS & OPERATION HANDLERS ===
  const fetchJournal = async () => {
    setJournalLoading(true);
    setJournalError(false);
    try {
      const res = await fetch('/api/journal');
      if (!res.ok) throw new Error('Günlük kayıtları yüklenirken bir hata oluştu.');
      const data = await res.json();
      setJournalEntries(data);
    } catch (err) {
      console.error(err);
      setJournalError(true);
    } finally {
      setJournalLoading(false);
    }
  };

  const saveJournalEntry = async (entryData) => {
    try {
      const res = await fetch('/api/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entryData)
      });
      if (!res.ok) throw new Error('Günlük kaydı kaydedilirken hata oluştu.');
      const data = await res.json();
      
      setJournalEntries(prev => {
        const exists = prev.some(e => dayString(e.entry_date) === dayString(data.entry_date));
        if (exists) {
          return prev.map(e => dayString(e.entry_date) === dayString(data.entry_date) ? data : e);
        } else {
          return [data, ...prev];
        }
      });
      showToast('Günlük kaydı başarıyla kaydedildi.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // Append a quick note to today's journal entry (keeps mood and earlier text)
  const addQuickJournalNote = async (text) => {
    const pad = (n) => String(n).padStart(2, '0');
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const existing = journalEntries.find(e => {
      const d = new Date(e.entry_date);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` === todayStr;
    });
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const line = `[${time}] ${text}`;
    await saveJournalEntry({
      entry_date: todayStr,
      mood_rating: existing?.mood_rating ?? undefined,
      content: existing?.content ? `${existing.content}\n${line}` : line,
      tags: existing?.tags || []
    });
  };

  const deleteJournalEntry = async (id) => {
    const snapshot = journalEntries.find(e => e.id === id);
    if (await confirmDialog({ title: 'Günlük kaydı silinsin mi?', message: 'Bu günün kaydı kalıcı olarak silinecek.', confirmText: 'Sil', danger: true })) {
      try {
        const res = await fetch(`/api/journal/${id}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error('Günlük kaydı silinemedi.');
        setJournalEntries(prev => prev.filter(e => e.id !== id));
        showToast('Günlük kaydı silindi.', 'info', snapshot ? {
          label: 'Geri al',
          onClick: async () => {
            await saveJournalEntry({
              entry_date: dayString(snapshot.entry_date),
              mood_rating: snapshot.mood_rating ?? undefined,
              content: snapshot.content,
              tags: snapshot.tags
            });
          }
        } : null);
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  };

  // === YEARLY PAYMENTS & EXCHANGE RATE ===
  const fetchYearlyPayments = async () => {
    try {
      const res = await fetch('/api/yearly-payments');
      if (res.ok) setYearlyPayments(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRate = async () => {
    try {
      const res = await fetch('/api/rates');
      if (res.ok) {
        const data = await res.json();
        if (data?.USD?.TRY) setUsdTryRate(data.USD.TRY);
      }
    } catch (err) {
      console.error('Döviz kuru alınamadı:', err);
    }
  };

  const receivables = buildReceivables(projects, yearlyPayments, usdTryRate);
  const fmtMoney = (tryValue) => {
    if (hideAmounts) return displayCurrency === 'USD' ? '*** $' : '*** ₺';
    const value = displayCurrency === 'USD' ? tryValue / usdTryRate : tryValue;
    return new Intl.NumberFormat('tr-TR', { style: 'currency', currency: displayCurrency, maximumFractionDigits: 0 }).format(value);
  };
  const reminderCount = receivables.reminders.filter(r => r.diffDays <= 7).length;

  // Compute unique clients list
  const uniqueClients = [...new Set(projects.map(p => p.client).filter(c => c && c.trim() !== ''))];

  // Projects that have at least one overdue payment
  const overdueProjects = projects.filter(p => p.type === 'external' && projectPayments(p).overdueCount > 0);

  // Filtering projects list by status AND client
  const filteredProjects = projects
    .filter(p => paymentFilter === 'all' || overdueProjects.includes(p))
    .filter(p => currentFilter === 'all' || p.status === currentFilter)
    .filter(p => selectedClient === 'all' || p.client === selectedClient)
    .filter(p => {
      const q = projectSearch.trim().toLocaleLowerCase('tr');
      if (!q) return true;
      const hay = [p.title, p.client, p.description, p.notes, ...(p.tasks || []).map(t => t.title)].join(' ').toLocaleLowerCase('tr');
      return q.split(/\s+/).every(w => hay.includes(w));
    });

  return (
    <div className={theme === 'light' ? 'light-theme' : ''}>
      <div className="app-layout">
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
            <h1>Softium Planner</h1>
          </div>

          <nav className="sidebar-nav">
            {NAV_TABS.map((tab) => (
              <button
                key={tab.id}
                className={`sidebar-nav-btn ${activeTab === tab.id ? 'active' : ''} ${tab.secondary ? 'nav-secondary' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                {tab.label}
                {tab.id === 'receivables' && reminderCount > 0 && (
                  <span className="nav-badge" title="Bu hafta takip edilmesi gereken ödeme">{reminderCount}</span>
                )}
              </button>
            ))}
            <button
              className={`sidebar-nav-btn nav-more ${NAV_TABS.some(t => t.secondary && t.id === activeTab) ? 'active' : ''}`}
              onClick={() => setMoreOpen(true)}
              aria-label="Daha fazla"
            >
              <MoreHorizontal />
              Daha
            </button>
          </nav>
        </div>

        <div className="sidebar-footer">
          {/* One compact row of tools instead of five tall buttons (the old stack overlapped the menu on shorter windows) */}
          <div className="sidebar-tools">
            <button onClick={() => setPaletteOpen(true)} title="Ara (Ctrl+K)" aria-label="Ara"><Search size={18} /></button>
            <a href="/api/backup" download title="Tüm verilerin JSON yedeği" aria-label="Yedek indir"><Download size={18} /></a>
            <button onClick={toggleTheme} title={theme === 'dark' ? 'Açık tema' : 'Koyu tema'} aria-label="Tema değiştir">
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            {onLogout && <button onClick={() => setAccountOpen(true)} title={`Hesap${username ? ` (${username})` : ''}`} aria-label="Hesap"><User size={18} /></button>}
            {onLogout && <button onClick={onLogout} title="Çıkış yap" aria-label="Çıkış yap"><LogOut size={18} /></button>}
          </div>

          <div className="user-profile">
            <div className="avatar">{(username || 'İ').charAt(0).toUpperCase()}</div>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span className="welcome-text" style={{ fontSize: '13px' }}>Hoş geldin,</span>
              <strong className="user-highlight" style={{ fontSize: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{username || 'İkbal'}</strong>
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

            {/* Payment alert: projects with overdue payments (click to filter) */}
            {overdueProjects.length > 0 && (
              <button
                type="button"
                className={`pay-alert ${paymentFilter === 'overdue' ? 'on' : ''}`}
                onClick={() => setPaymentFilter(f => (f === 'overdue' ? 'all' : 'overdue'))}
              >
                <AlertTriangle size={18} />
                <span>
                  <b>{overdueProjects.length} projede geciken ödeme var</b>
                  <small>{paymentFilter === 'overdue' ? 'Sadece onlar gösteriliyor. Tümünü görmek için tekrar dokun.' : 'Dokununca sadece o projeleri göster.'}</small>
                </span>
              </button>
            )}

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
                    className={`filter-btn ${currentFilter === 'draft' ? 'active' : ''}`}
                    onClick={() => setCurrentFilter('draft')}
                  >
                    <FileText /> Taslaklar
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

                <div className="project-search glass-card">
                  <Search size={16} />
                  <input
                    type="text"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder="Projelerde ara..."
                  />
                  {projectSearch && <button onClick={() => setProjectSearch('')} aria-label="Aramayı temizle">×</button>}
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

                {/* Hide/Show Amounts Eye Button */}
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', height: '40px', width: '40px' }} 
                  onClick={() => setHideAmounts(!hideAmounts)}
                  title={hideAmounts ? "Tutarları Göster" : "Tutarları Gizle"}
                >
                  {hideAmounts ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>

                {/* Currency Toggle Buttons */}
                <div className="glass-card" style={{ display: 'flex', padding: '2px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', gap: '2px', height: '40px', alignItems: 'center' }}>
                  <button
                    type="button"
                    className={`btn-sm`}
                    style={{ 
                      padding: '6px 12px', 
                      fontSize: '12px', 
                      borderRadius: '6px', 
                      border: 'none', 
                      cursor: 'pointer',
                      background: displayCurrency === 'TRY' ? 'var(--primary)' : 'transparent',
                      color: displayCurrency === 'TRY' ? '#ffffff' : 'var(--text-muted)',
                      fontWeight: 600,
                      height: '34px'
                    }}
                    onClick={() => setDisplayCurrency('TRY')}
                  >
                    ₺ TL
                  </button>
                  <button
                    type="button"
                    className={`btn-sm`}
                    style={{ 
                      padding: '6px 12px', 
                      fontSize: '12px', 
                      borderRadius: '6px', 
                      border: 'none', 
                      cursor: 'pointer',
                      background: displayCurrency === 'USD' ? 'var(--primary)' : 'transparent',
                      color: displayCurrency === 'USD' ? '#ffffff' : 'var(--text-muted)',
                      fontWeight: 600,
                      height: '34px'
                    }}
                    onClick={() => setDisplayCurrency('USD')}
                  >
                    $ USD
                  </button>
                </div>
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
                    {currentFilter === 'all' && selectedClient === 'all' && !projectSearch && paymentFilter === 'all'
                      ? 'Henüz hiçbir proje oluşturmadınız.' 
                      : 'Bu filtrelere uygun bir proje bulunamadı.'}
                  </p>
                  {currentFilter === 'all' && selectedClient === 'all' && paymentFilter === 'all' && !projectSearch && (
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
                      onTransferToYearly={transferProjectToYearly}
                      onDragStart={handleProjectDragStart}
                      onDragOver={handleProjectDragOver}
                      onDrop={handleProjectDrop}
                      onDragEnd={handleProjectDragEnd}
                      draggedIndex={draggedProjectIdx}
                      dragOverIndex={dragOverProjectIdx}
                      displayCurrency={displayCurrency}
                      hideAmounts={hideAmounts}
                      usdTryRate={usdTryRate}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : activeTab === 'goals' ? (
          <>
            {/* Dashboard Stat Cards */}
            <GoalKPIs goals={goals} />

            {/* Action Bar (Filters & Adding Button) */}
            <section className="action-bar-section">
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="filters glass-card" style={{ display: 'flex', alignItems: 'center', padding: '10px 18px', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none', color: 'var(--text-main)', fontSize: '14px', fontWeight: '500' }}>
                    <input 
                      type="checkbox" 
                      checked={hideCompletedGoals} 
                      onChange={(e) => setHideCompletedGoals(e.target.checked)}
                      style={{ 
                        cursor: 'pointer',
                        width: '16px',
                        height: '16px',
                        accentColor: 'var(--primary)'
                      }} 
                    />
                    Tamamlananları Gizle
                  </label>
                </div>

                <div className="filters glass-card" style={{ display: 'flex', padding: '4px', gap: '4px' }}>
                  <button 
                    className={`filter-btn ${goalsViewMode === 'grid' ? 'active' : ''}`}
                    onClick={() => setGoalsViewMode('grid')}
                    title="Grid Görünümü"
                    style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
                  >
                    <LayoutGrid size={14} /> Grid
                  </button>
                  <button 
                    className={`filter-btn ${goalsViewMode === 'list' ? 'active' : ''}`}
                    onClick={() => setGoalsViewMode('list')}
                    title="Liste Görünümü"
                    style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
                  >
                    <List size={14} /> Liste
                  </button>
                </div>
              </div>
              
              <button className="btn btn-primary" onClick={handleCreateGoalClick}>
                <Plus /> Yeni Hedef Ekle
              </button>
            </section>

            {/* Goals Display Grid */}
            <section className="projects-grid-section">
              {goalsLoading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Hedefler yükleniyor...</p>
                </div>
              ) : goalsError ? (
                <div className="empty-state">
                  <AlertTriangle style={{ width: '48px', height: '48px', color: 'var(--danger)' }} />
                  <h3>Bağlantı Hatası</h3>
                  <p>PostgreSQL sunucusuna veya backend API'sine bağlanılamıyor.</p>
                  <button className="btn btn-secondary" onClick={fetchGoals}>
                    <RefreshCw /> Tekrar Dene
                  </button>
                </div>
              ) : (hideCompletedGoals ? goals.filter(g => !(g.is_completed || (g.progress_type === 'metric' && parseFloat(g.current_value) >= parseFloat(g.target_value)))) : goals).length === 0 ? (
                <div className="empty-state">
                  <Target style={{ width: '56px', height: '56px' }} />
                  <h3>Hedef Bulunamadı</h3>
                  <p>
                    {hideCompletedGoals 
                      ? 'Tamamlanmamış bir hedefiniz bulunmamaktadır.'
                      : 'Henüz hiçbir hedef oluşturmadınız.'}
                  </p>
                  {!hideCompletedGoals && (
                    <button className="btn btn-primary" onClick={handleCreateGoalClick}>
                      <Plus /> İlk Hedefi Ekle
                    </button>
                  )}
                </div>
              ) : (
                <div className={goalsViewMode === 'list' ? 'goals-list-container' : 'projects-grid'}>
                  {getSortedGoals(hideCompletedGoals 
                    ? goals.filter(g => !(g.is_completed || (g.progress_type === 'metric' && parseFloat(g.current_value) >= parseFloat(g.target_value)))) 
                    : goals
                  ).map((goal, idx) => (
                    <GoalCard 
                      key={goal.id} 
                      goal={goal} 
                      index={idx}
                      onEdit={handleEditGoalClick}
                      onDelete={deleteGoal}
                      onToggleGoal={toggleGoalStatus}
                      onIncrement={incrementGoalProgress}
                      onDragStart={handleGoalDragStart}
                      onDragOver={handleGoalDragOver}
                      onDrop={handleGoalDrop}
                      onDragEnd={handleGoalDragEnd}
                      draggedIndex={draggedGoalIdx}
                      dragOverIndex={dragOverGoalIdx}
                      viewMode={goalsViewMode}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : activeTab === 'daily' ? (
          <DailyDashboard
            habits={habits}
            habitsLoading={habitsLoading}
            habitsError={habitsError}
            habitsViewMode={habitsViewMode}
            setHabitsViewMode={setHabitsViewMode}
            onRetryHabits={fetchHabits}
            onCreateHabit={handleCreateHabitClick}
            onEditHabit={handleEditHabitClick}
            onDeleteHabit={deleteHabit}
            onLogHabit={logHabit}
            habitDrag={{
              onDragStart: handleHabitDragStart,
              onDragOver: handleHabitDragOver,
              onDrop: handleHabitDrop,
              onDragEnd: handleHabitDragEnd,
              draggedIndex: draggedHabitIdx,
              dragOverIndex: dragOverHabitIdx
            }}
            routines={routines}
            onSaveRoutine={saveRoutine}
            onToggleRoutineComplete={toggleRoutineComplete}
            onDeleteRoutine={deleteRoutine}
            onStartRoutine={startRoutine}
            onToggleStep={toggleStepComplete}
          />
        ) : activeTab === 'journal' ? (
          <JournalDashboard 
            entries={journalEntries}
            onSaveEntry={saveJournalEntry}
            onDeleteEntry={deleteJournalEntry}
          />
        ) : activeTab === 'health' ? (
          <HealthDashboard />
        ) : activeTab === 'calendar' ? (
          <CalendarDashboard
            receivables={receivables}
            projects={projects}
            goals={goals}
            onOpenProject={handleOpenProjectById}
            onOpenGoal={handleEditGoalClick}
            fmt={fmtMoney}
          />
        ) : activeTab === 'receivables' ? (
          <ReceivablesDashboard
            receivables={receivables}
            projects={projects}
            onOpenProject={handleOpenProjectById}
            displayCurrency={displayCurrency}
            setDisplayCurrency={setDisplayCurrency}
            hideAmounts={hideAmounts}
            setHideAmounts={setHideAmounts}
            usdTryRate={usdTryRate}
            onPaymentsLoaded={setYearlyPayments}
          />
        ) : (
          <HomeDashboard
            receivables={receivables}
            habits={habits}
            routines={routines}
            goals={goals}
            projects={projects}
            displayCurrency={displayCurrency}
            hideAmounts={hideAmounts}
            setHideAmounts={setHideAmounts}
            usdTryRate={usdTryRate}
            onNavigate={setActiveTab}
            onOpenProject={handleOpenProjectById}
            onLogHabit={logHabit}
            onToggleRoutineComplete={toggleRoutineComplete}
            onToggleTask={toggleTask}
          />
        )}
      </main>
    </div>

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
        onUpdateTask={updateTask}
        onTransferToYearly={transferProjectToYearly}
        templates={templates}
        onSaveTemplate={saveTemplate}
        onDeleteTemplate={deleteTemplate}
        onApplyTemplate={applyTemplate}
        onReorderTasks={reorderTasks}
        onAddPayment={addTaskPayment}
        onDeletePayment={deleteTaskPayment}
        displayCurrency={displayCurrency}
        hideAmounts={hideAmounts}
        usdTryRate={usdTryRate}
      />

      {/* Goal Management Modal */}
      <GoalModal
        isOpen={isGoalModalOpen}
        goal={selectedGoal}
        onClose={() => {
          setIsGoalModalOpen(false);
          setSelectedGoal(null);
        }}
        onSaveGoal={saveGoal}
      />

      {/* Habit Management Modal */}
      <HabitModal
        isOpen={isHabitModalOpen}
        habit={selectedHabit}
        onClose={() => {
          setIsHabitModalOpen(false);
          setSelectedHabit(null);
        }}
        onSaveHabit={saveHabit}
      />

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        projects={projects}
        goals={goals}
        habits={habits}
        routines={routines}
        journalEntries={journalEntries}
        clients={uniqueClients}
        onNavigate={setActiveTab}
        onOpenProject={handleOpenProjectById}
        onOpenGoal={handleEditGoalClick}
        onOpenHabit={handleEditHabitClick}
      />

      {accountOpen && <AccountModal username={username} onClose={() => setAccountOpen(false)} />}

      {moreOpen && (
        <ModalShell onClose={() => setMoreOpen(false)} className="sheet more-sheet" style={{ maxWidth: '480px' }}>
          <div className="more-grid">
            {NAV_TABS.filter(t => t.secondary).map(t => (
              <button
                key={t.id}
                className={`more-item ${activeTab === t.id ? 'on' : ''}`}
                onClick={() => { setActiveTab(t.id); setMoreOpen(false); }}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>
          <div className="more-actions">
            <button onClick={() => { setMoreOpen(false); setPaletteOpen(true); }}><Search size={18} /> Ara</button>
            <a href="/api/backup" download><Download size={18} /> Yedek indir</a>
            <button onClick={toggleTheme}>{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />} {theme === 'dark' ? 'Açık tema' : 'Koyu tema'}</button>
            {onLogout && <button onClick={() => { setMoreOpen(false); setAccountOpen(true); }}><User size={18} /> Hesap / şifre değiştir</button>}
            {onLogout && <button onClick={onLogout}><LogOut size={18} /> Çıkış yap</button>}
          </div>
        </ModalShell>
      )}

      <QuickAdd
        projects={projects}
        hidden={isModalOpen || isGoalModalOpen || isHabitModalOpen}
        onAddTask={addTask}
        onAddNote={addQuickJournalNote}
        onNewProject={handleCreateClick}
        onNewGoal={handleCreateGoalClick}
        onNewHabit={handleCreateHabitClick}
      />

      {/* Toast Notifications */}
      <div className="toast-container" role="status" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type}`}>
            <div className="toast-icon">
              {t.type === 'success' ? <CheckCircle /> : <Info />}
            </div>
            <div className="toast-message">{t.message}</div>
            {t.action && (
              <button
                className="toast-action"
                onClick={() => { dismissToast(t.id); t.action.onClick(); }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
