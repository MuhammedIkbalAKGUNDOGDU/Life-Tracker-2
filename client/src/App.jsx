import { useState, useEffect } from 'react';
import KPIStats from './components/KPIStats';
import ProjectCard from './components/ProjectCard';
import ProjectModal from './components/ProjectModal';
import GoalCard from './components/GoalCard';
import GoalModal from './components/GoalModal';
import GoalKPIs from './components/GoalKPIs';
import HabitCard from './components/HabitCard';
import HabitMatrix from './components/HabitMatrix';
import HabitModal from './components/HabitModal';
import HabitKPIs from './components/HabitKPIs';
import RoutinesDashboard from './components/RoutinesDashboard';
import HomeDashboard from './components/HomeDashboard';
import ReceivablesDashboard from './components/ReceivablesDashboard';
import DailyDashboard from './components/DailyDashboard';
import { buildReceivables } from './receivables';
import JournalDashboard from './components/JournalDashboard';
import PendingPayments from './components/PendingPayments';
import UpcomingInstallments from './components/UpcomingInstallments';
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
  Sparkles,
  Eye,
  EyeOff
} from 'lucide-react';

const VALID_TABS = ['home', 'projects', 'goals', 'daily', 'journal', 'receivables'];
const LEGACY_TABS = { habits: 'daily', routines: 'daily', yearly_payments: 'receivables' };
const NAV_TABS = [
  { id: 'home', label: 'Ana Sayfa', icon: <Home /> },
  { id: 'projects', label: 'Projeler', icon: <FolderKanban /> },
  { id: 'goals', label: 'Hedefler', icon: <Target /> },
  { id: 'daily', label: 'Günlük Düzen', icon: <Flame /> },
  { id: 'receivables', label: 'Alacaklar', icon: <Wallet /> },
  { id: 'journal', label: 'Günlük', icon: <BookOpen /> }
];
const resolveTab = (hash) => {
  const id = LEGACY_TABS[hash] || hash;
  return VALID_TABS.includes(id) ? id : 'home';
};

export default function App({ onLogout }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [currentFilter, setCurrentFilter] = useState('all');
  const [selectedClient, setSelectedClient] = useState('all');
  
  // Theme & Navigation Sidebar State
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');
  const [activeTab, setActiveTab] = useState(() => resolveTab(window.location.hash.slice(1)));

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

  // Yearly payments (shared by Home & Alacaklar)
  const [yearlyPayments, setYearlyPayments] = useState([]);
  const [usdTryRate, setUsdTryRate] = useState(34.0);

  // Toast notifications state
  const [toasts, setToasts] = useState([]);

  // Shared mask & currency preferences
  const [displayCurrency, setDisplayCurrency] = useState(() => {
    return localStorage.getItem('display_currency') || 'TRY';
  });
  const [hideAmounts, setHideAmounts] = useState(() => {
    return localStorage.getItem('hide_amounts') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('display_currency', displayCurrency);
  }, [displayCurrency]);

  useEffect(() => {
    localStorage.setItem('hide_amounts', String(hideAmounts));
  }, [hideAmounts]);

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

  const transferProjectToYearly = async (project) => {
    try {
      const todayStr = new Date().toISOString().split('T')[0];
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
      
      showToast('Proje yıllık ödeme listesine aktarıldı. Detayları Alacaklar sekmesinden düzenleyebilirsiniz.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // POST: Add task inside a project
  const addTask = async (projectId, taskTitle, taskWeight, taskPrice, taskPaidPrice, taskDescription) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title: taskTitle, 
          weight: taskWeight, 
          price: taskPrice, 
          paid_price: taskPaidPrice || 0, 
          description: taskDescription || '' 
        })
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

  // PUT: Update Task details (title, weight, price, paid_price, description)
  const updateTask = async (taskId, taskData) => {
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
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskData)
      });
      if (!res.ok) throw new Error('Görev güncellenemedi.');
      
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
      showToast('Görev başarıyla güncellendi.', 'success');
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
    
    if (window.confirm(`"${goal.title}" hedefini silmek istediğinize emin misiniz? Bu işlem geri alınamaz!`)) {
      try {
        const res = await fetch(`/api/goals/${goalId}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error('Hedef silinemedi.');
        
        setGoals(prev => prev.filter(g => g.id !== goalId));
        showToast('Hedef başarıyla silindi.', 'info');
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
    
    if (window.confirm(`"${habit.title}" alışkanlığını silmek istediğinize emin misiniz? Bu işlem geri alınamaz!`)) {
      try {
        const res = await fetch(`/api/habits/${habitId}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error('Alışkanlık silinemedi.');
        
        setHabits(prev => prev.filter(h => h.id !== habitId));
        showToast('Alışkanlık başarıyla silindi.', 'info');
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
      const res = await fetch('/api/routines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(routineData)
      });
      if (!res.ok) throw new Error('Rutin kaydedilirken hata oluştu.');
      const data = await res.json();
      setRoutines(prev => [data, ...prev]);
      showToast('Yeni rutin başarıyla eklendi.', 'success');
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
    if (window.confirm('Bu rutini silmek istediğinize emin misiniz?')) {
      try {
        const res = await fetch(`/api/routines/${id}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error('Rutin silinemedi.');
        setRoutines(prev => prev.filter(r => r.id !== id));
        showToast('Rutin başarıyla silindi.', 'info');
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
        const exists = prev.some(e => e.entry_date.split('T')[0] === data.entry_date.split('T')[0]);
        if (exists) {
          return prev.map(e => e.entry_date.split('T')[0] === data.entry_date.split('T')[0] ? data : e);
        } else {
          return [data, ...prev];
        }
      });
      showToast('Günlük kaydı başarıyla kaydedildi.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const deleteJournalEntry = async (id) => {
    if (window.confirm('Bu günlük kaydını silmek istediğinize emin misiniz?')) {
      try {
        const res = await fetch(`/api/journal/${id}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error('Günlük kaydı silinemedi.');
        setJournalEntries(prev => prev.filter(e => e.id !== id));
        showToast('Günlük kaydı silindi.', 'info');
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
  const reminderCount = receivables.reminders.filter(r => r.diffDays <= 7).length;

  // Compute unique clients list
  const uniqueClients = [...new Set(projects.map(p => p.client).filter(c => c && c.trim() !== ''))];

  // Filtering projects list by status AND client
  const filteredProjects = projects
    .filter(p => currentFilter === 'all' || p.status === currentFilter)
    .filter(p => selectedClient === 'all' || p.client === selectedClient);

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
                className={`sidebar-nav-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.icon}
                {tab.label}
                {tab.id === 'receivables' && reminderCount > 0 && (
                  <span className="nav-badge" title="Bu hafta takip edilmesi gereken ödeme">{reminderCount}</span>
                )}
              </button>
            ))}
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

          {onLogout && (
            <button className="theme-toggle-btn" onClick={onLogout}>
              <LogOut size={18} />
              Çıkış Yap
            </button>
          )}

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

            {/* Yaklaşan Taksitler Panel */}
            <UpcomingInstallments
              projects={projects}
              onOpenProject={handleOpenProjectById}
              displayCurrency={displayCurrency}
              hideAmounts={hideAmounts}
              usdTryRate={usdTryRate}
            />

            {/* Kalan Ödemeler (Pending Payments) Panel */}
            <PendingPayments
              projects={projects}
              onOpenProject={handleOpenProjectById}
              displayCurrency={displayCurrency}
              hideAmounts={hideAmounts}
              usdTryRate={usdTryRate}
            />

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
            usdTryRate={usdTryRate}
            onNavigate={setActiveTab}
            onOpenProject={handleOpenProjectById}
            onLogHabit={logHabit}
            onToggleRoutineComplete={toggleRoutineComplete}
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
