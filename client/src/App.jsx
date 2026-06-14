import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
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
import MilestoneCard from './components/MilestoneCard';
import MilestoneModal from './components/MilestoneModal';
import RoutinesDashboard from './components/RoutinesDashboard';
import JournalDashboard from './components/JournalDashboard';
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
  FolderOpen,
  LayoutGrid,
  List,
  Flame,
  Trophy,
  BookOpen,
  Sparkles
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
    const defaultTabs = [
      { id: 'projects', label: 'Projeler', icon: 'projects' },
      { id: 'goals', label: 'Hedefler', icon: 'goals' },
      { id: 'habits', label: 'Alışkanlıklar', icon: 'habits' },
      { id: 'routines', label: 'Rutinler', icon: 'routines' },
      { id: 'journal', label: 'Günlük', icon: 'journal' },
      { id: 'milestones', label: 'Başarımlar', icon: 'milestones' }
    ];
    if (savedTabs) {
      try { 
        const parsed = JSON.parse(savedTabs); 
        if (!parsed.some(t => t.id === 'habits')) {
          parsed.push({ id: 'habits', label: 'Alışkanlıklar', icon: 'habits' });
        }
        if (!parsed.some(t => t.id === 'routines')) {
          parsed.push({ id: 'routines', label: 'Rutinler', icon: 'routines' });
        }
        if (!parsed.some(t => t.id === 'journal')) {
          parsed.push({ id: 'journal', label: 'Günlük', icon: 'journal' });
        }
        if (!parsed.some(t => t.id === 'milestones')) {
          parsed.push({ id: 'milestones', label: 'Başarımlar', icon: 'milestones' });
        }
        return parsed; 
      } catch(e) { }
    }
    return defaultTabs;
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

  // Milestones States
  const [milestones, setMilestones] = useState([]);
  const [milestoneStats, setMilestoneStats] = useState({ completedProjects: 0, completedGoals: 0, maxHabitStreak: 0 });
  const [milestonesLoading, setMilestonesLoading] = useState(false);
  const [milestonesError, setMilestonesError] = useState(false);
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false);

  // Routines States
  const [routines, setRoutines] = useState([]);
  const [routinesLoading, setRoutinesLoading] = useState(false);
  const [routinesError, setRoutinesError] = useState(false);

  // Journal/Mood States
  const [journalEntries, setJournalEntries] = useState([]);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalError, setJournalError] = useState(false);

  // Toast notifications state
  const [toasts, setToasts] = useState([]);

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
    fetchMilestones();
    fetchRoutines();
    fetchJournal();
  }, []);

  // Sync / Auto-evaluate milestones whenever system data updates
  useEffect(() => {
    if (milestones.length > 0) {
      const timer = setTimeout(() => {
        fetchMilestones(true);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [projects, goals, habits]);

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

  // === MILESTONES ACTIONS & OPERATION HANDLERS ===
  const celebrate = () => {
    confetti({
      particleCount: 150,
      spread: 80,
      origin: { y: 0.6 }
    });
  };

  const fetchMilestones = async (silent = false) => {
    if (!silent) setMilestonesLoading(true);
    setMilestonesError(false);
    try {
      const res = await fetch('/api/milestones');
      if (!res.ok) throw new Error('Başarımlar yüklenirken bir hata oluştu.');
      const data = await res.json();
      
      const newUnlockedCount = data.milestones.filter(m => m.is_unlocked).length;
      
      setMilestones(prev => {
        const oldUnlockedCount = prev.filter(m => m.is_unlocked).length;
        if (prev.length > 0 && newUnlockedCount > oldUnlockedCount) {
          celebrate();
          showToast('Tebrikler! Yeni bir başarım kazandınız! 🏆', 'success');
        }
        return data.milestones;
      });
      setMilestoneStats(data.stats);
    } catch (err) {
      console.error(err);
      setMilestonesError(true);
    } finally {
      if (!silent) setMilestonesLoading(false);
    }
  };

  const saveMilestone = async (milestoneData) => {
    try {
      const res = await fetch('/api/milestones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(milestoneData)
      });
      if (!res.ok) throw new Error('Başarım eklenirken hata oluştu.');
      const data = await res.json();
      setMilestones(prev => [data, ...prev]);
      showToast('Yeni başarım başarıyla eklendi.', 'success');
      setIsMilestoneModalOpen(false);
      fetchMilestones(true);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const unlockMilestone = async (id) => {
    try {
      const res = await fetch(`/api/milestones/${id}/unlock`, {
        method: 'PUT'
      });
      if (!res.ok) throw new Error('Kilidi açma işlemi başarısız.');
      const data = await res.json();
      setMilestones(prev => prev.map(m => m.id === id ? data : m));
      celebrate();
      showToast('Tebrikler! Kilometre taşının kilidini açtınız! 🏆', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const deleteMilestone = async (id) => {
    if (window.confirm('Bu başarımı silmek istediğinize emin misiniz?')) {
      try {
        const res = await fetch(`/api/milestones/${id}`, {
          method: 'DELETE'
        });
        if (!res.ok) throw new Error('Başarım silinemedi.');
        setMilestones(prev => prev.filter(m => m.id !== id));
        showToast('Başarım silindi.', 'info');
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  };

  const renderTabIcon = (iconName) => {
    switch (iconName) {
      case 'projects': return <FolderKanban />;
      case 'goals': return <Target />;
      case 'habits': return <Flame />;
      case 'routines': return <Sparkles />;
      case 'journal': return <BookOpen />;
      case 'milestones': return <Trophy />;
      default: return <Info />;
    }
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
                  {(hideCompletedGoals 
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
        ) : activeTab === 'habits' ? (
          /* Habits View */
          <>
            {/* Dashboard Stat Cards */}
            <HabitKPIs habits={habits} />

            {/* Action Bar (Filters & Adding Button) */}
            <section className="action-bar-section">
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <div className="filters glass-card" style={{ display: 'flex', padding: '4px', gap: '4px' }}>
                  <button 
                    className={`filter-btn ${habitsViewMode === 'weekly' ? 'active' : ''}`}
                    onClick={() => setHabitsViewMode('weekly')}
                    title="Haftalık Görünüm"
                    style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
                  >
                    Haftalık Liste
                  </button>
                  <button 
                    className={`filter-btn ${habitsViewMode === 'monthly' ? 'active' : ''}`}
                    onClick={() => setHabitsViewMode('monthly')}
                    title="Aylık Görünüm"
                    style={{ padding: '8px 12px', borderRadius: '8px', fontSize: '13px' }}
                  >
                    Aylık Matris
                  </button>
                </div>
              </div>
              
              <button className="btn btn-primary" onClick={handleCreateHabitClick}>
                <Plus /> Yeni Alışkanlık Ekle
              </button>
            </section>

            {/* Habits Display Grid / List / Matrix */}
            <section className="projects-grid-section">
              {habitsLoading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Alışkanlıklar yükleniyor...</p>
                </div>
              ) : habitsError ? (
                <div className="empty-state">
                  <AlertTriangle style={{ width: '48px', height: '48px', color: 'var(--danger)' }} />
                  <h3>Bağlantı Hatası</h3>
                  <p>PostgreSQL sunucusuna veya backend API'sine bağlanılamıyor.</p>
                  <button className="btn btn-secondary" onClick={fetchHabits}>
                    <RefreshCw /> Tekrar Dene
                  </button>
                </div>
              ) : habits.length === 0 ? (
                <div className="empty-state">
                  <Flame style={{ width: '56px', height: '56px' }} />
                  <h3>Alışkanlık Bulunamadı</h3>
                  <p>Henüz hiçbir alışkanlık oluşturmadınız.</p>
                  <button className="btn btn-primary" onClick={handleCreateHabitClick}>
                    <Plus /> İlk Alışkanlığı Ekle
                  </button>
                </div>
              ) : habitsViewMode === 'monthly' ? (
                <HabitMatrix habits={habits} onLogHabit={logHabit} />
              ) : (
                <div className="goals-list-container">
                  {habits.map((habit, idx) => (
                    <HabitCard 
                      key={habit.id} 
                      habit={habit} 
                      index={idx}
                      onEdit={handleEditHabitClick}
                      onDelete={deleteHabit}
                      onLogHabit={logHabit}
                      onDragStart={handleHabitDragStart}
                      onDragOver={handleHabitDragOver}
                      onDrop={handleHabitDrop}
                      onDragEnd={handleHabitDragEnd}
                      draggedIndex={draggedHabitIdx}
                      dragOverIndex={dragOverHabitIdx}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        ) : activeTab === 'routines' ? (
          <RoutinesDashboard 
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
        ) : (
          /* Milestones View */
          <>
            {/* Action Bar */}
            <section className="action-bar-section">
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 700 }}>Kilometre Taşları & Başarımlar</h2>
              </div>
              <button className="btn btn-primary" onClick={() => setIsMilestoneModalOpen(true)}>
                <Plus /> Yeni Başarım Ekle
              </button>
            </section>

            {/* Milestones Display Grid */}
            <section className="projects-grid-section">
              {milestonesLoading ? (
                <div className="loading-state">
                  <div className="spinner"></div>
                  <p>Başarımlar yükleniyor...</p>
                </div>
              ) : milestonesError ? (
                <div className="empty-state">
                  <AlertTriangle style={{ width: '48px', height: '48px', color: 'var(--danger)' }} />
                  <h3>Bağlantı Hatası</h3>
                  <p>PostgreSQL sunucusuna veya backend API'sine bağlanılamıyor.</p>
                  <button className="btn btn-secondary" onClick={() => fetchMilestones()}>
                    <RefreshCw /> Tekrar Dene
                  </button>
                </div>
              ) : milestones.length === 0 ? (
                <div className="empty-state">
                  <Trophy style={{ width: '56px', height: '56px' }} />
                  <h3>Başarım Bulunamadı</h3>
                  <p>Henüz hiçbir başarım/kilometre taşı eklemediniz.</p>
                  <button className="btn btn-primary" onClick={() => setIsMilestoneModalOpen(true)}>
                    <Plus /> İlk Başarımı Ekle
                  </button>
                </div>
              ) : (
                <div className="milestone-grid">
                  {milestones.map((milestone) => (
                    <MilestoneCard
                      key={milestone.id}
                      milestone={milestone}
                      stats={milestoneStats}
                      onUnlock={unlockMilestone}
                      onDelete={deleteMilestone}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
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

      {/* Milestone Management Modal */}
      <MilestoneModal
        isOpen={isMilestoneModalOpen}
        onClose={() => setIsMilestoneModalOpen(false)}
        onSaveMilestone={saveMilestone}
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
