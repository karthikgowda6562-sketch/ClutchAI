/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Sparkles, 
  Plus, 
  AlertTriangle, 
  Zap, 
  Clock, 
  Info,
  CheckCircle2,
  Lock,
  ArrowRight
} from "lucide-react";
import Sidebar from "./components/Sidebar.tsx";
import StatsGrid from "./components/StatsGrid.tsx";
import TaskCard from "./components/TaskCard.tsx";
import FocusMode from "./components/FocusMode.tsx";
import Scheduler from "./components/Scheduler.tsx";
import CoachChat from "./components/CoachChat.tsx";
import NewTaskModal from "./components/NewTaskModal.tsx";
import HabitsTracker from "./components/HabitsTracker.tsx";
import WorkspaceHub from "./components/WorkspaceHub.tsx";
import { useAuth } from "./components/AuthContext.tsx";
import { Task, ScheduleBlock, CoachMessage, Habit, ProductivityStats } from "./types.ts";

export default function App() {
  const { user, loading, token, signInWithGoogle } = useAuth();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [schedule, setSchedule] = useState<ScheduleBlock[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [stats, setStats] = useState<ProductivityStats>({
    focusTimeMinutes: 0,
    tasksCompleted: 0,
    onTimeCompletionRate: 0,
    aiBreakdownsUsed: 0,
    emergencyModesTriggered: 0
  });
  const [chatHistory, setChatHistory] = useState<CoachMessage[]>([]);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Helper for authenticated HTTP requests
  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    const headers = {
      ...options.headers,
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    };
    return fetch(url, { ...options, headers });
  };

  const fetchData = async () => {
    if (!token) return;
    try {
      const [tasksRes, scheduleRes, habitsRes, statsRes, chatRes] = await Promise.all([
        authenticatedFetch("/api/tasks").then(r => r.json()),
        authenticatedFetch("/api/schedule").then(r => r.json()),
        authenticatedFetch("/api/habits").then(r => r.json()),
        authenticatedFetch("/api/stats").then(r => r.json()),
        authenticatedFetch("/api/coach/chat").then(r => r.json())
      ]);

      setTasks(tasksRes || []);
      setSchedule(scheduleRes || []);
      setHabits(habitsRes || []);
      setStats(statsRes || { focusTimeMinutes: 0, tasksCompleted: 0, onTimeCompletionRate: 0, aiBreakdownsUsed: 0, emergencyModesTriggered: 0 });
      setChatHistory(chatRes || []);
    } catch (err) {
      console.error("Failed to load full-stack workspace parameters:", err);
      showToast("Backend connection offline. Running in standby mode.", 'error');
    }
  };

  useEffect(() => {
    if (token) {
      fetchData();
    }
  }, [token]);

  const showToast = (text: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
    try {
      const res = await authenticatedFetch(`/api/tasks/${id}`, {
        method: 'PUT',
        body: JSON.stringify(updates)
      });
      const updatedTask = await res.json();
      
      setTasks(prev => prev.map(t => t.id === id ? updatedTask : t));
      
      if (updates.status === 'completed') {
        showToast("🎯 Task finished! Executive throughput stats expanded.", 'success');
        authenticatedFetch("/api/stats").then(r => r.json()).then(s => setStats(s));
      }
    } catch (error) {
      showToast("Failed to update task state.", 'error');
    }
  };

  const handleAddTask = async (taskData: {
    title: string;
    description: string;
    category: string;
    deadline: string;
    estimatedHours: number;
    priority: 'low' | 'medium' | 'high';
  }) => {
    try {
      const res = await authenticatedFetch("/api/tasks", {
        method: "POST",
        body: JSON.stringify(taskData)
      });
      const newTask = await res.json();
      setTasks(prev => [...prev, newTask]);
      showToast("⚡ Task successfully prioritized & integrated into timeline.", 'success');
    } catch (err) {
      showToast("Failed to schedule task.", 'error');
    }
  };

  const handleDeleteTask = async (id: string) => {
    try {
      await authenticatedFetch(`/api/tasks/${id}`, { method: 'DELETE' });
      setTasks(prev => prev.filter(t => t.id !== id));
      showToast("Task removed from active buffer.", 'info');
    } catch (err) {
      showToast("Failed to drop task.", 'error');
    }
  };

  const handleTriggerBreakdown = async (id: string) => {
    try {
      const res = await authenticatedFetch(`/api/tasks/${id}/breakdown`, { method: 'POST' });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);

      setTasks(prev => prev.map(t => t.id === id ? data.task : t));
      showToast("🔮 Proactive breakdown roadmap mapped by Gemini!", 'success');
      
      authenticatedFetch("/api/coach/chat").then(r => r.json()).then(c => setChatHistory(c));
      authenticatedFetch("/api/stats").then(r => r.json()).then(s => setStats(s));
    } catch (err: any) {
      showToast(err.message || "Failed to generate AI breakdown.", 'error');
    }
  };

  const handleTriggerEmergency = async (id: string) => {
    try {
      const res = await authenticatedFetch(`/api/tasks/${id}/emergency`, { method: 'POST' });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      setTasks(prev => prev.map(t => t.id === id ? data.task : t));
      showToast("🚨 EMERGENCY MODE ENABLED! Battleplan generated inside artifacts drawer.", 'error');

      authenticatedFetch("/api/coach/chat").then(r => r.json()).then(c => setChatHistory(c));
      authenticatedFetch("/api/stats").then(r => r.json()).then(s => setStats(s));
    } catch (err: any) {
      showToast(err.message || "Failed to create emergency plan.", 'error');
    }
  };

  const handleSendMessage = async (text: string) => {
    try {
      const tempUserMsg: CoachMessage = {
        id: `temp-${Date.now()}`,
        sender: "user",
        text,
        timestamp: new Date().toISOString()
      };
      setChatHistory(prev => [...prev, tempUserMsg]);

      const res = await authenticatedFetch("/api/coach/chat", {
        method: "POST",
        body: JSON.stringify({ message: text })
      });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      const history = await authenticatedFetch("/api/coach/chat").then(r => r.json());
      setChatHistory(history);
    } catch (err: any) {
      showToast(err.message || "Coaching engine is offline.", 'error');
    }
  };

  const handleClearChat = async () => {
    try {
      const history = await authenticatedFetch("/api/coach/chat", { method: 'DELETE' }).then(r => r.json());
      setChatHistory(history);
      showToast("Chat logs successfully reset.", 'info');
    } catch (err) {
      showToast("Failed to clear chat.", 'error');
    }
  };

  const handleAddScheduleBlock = async (blockData: Partial<ScheduleBlock>) => {
    try {
      const res = await authenticatedFetch("/api/schedule", {
        method: "POST",
        body: JSON.stringify(blockData)
      });
      const newBlock = await res.json();
      setSchedule(prev => [...prev, newBlock]);
      showToast("Scheduled slot pinned successfully.", 'success');
    } catch (err) {
      showToast("Failed to pin slot.", 'error');
    }
  };

  const handleDeleteScheduleBlock = async (id: string) => {
    try {
      await authenticatedFetch(`/api/schedule/${id}`, { method: 'DELETE' });
      setSchedule(prev => prev.filter(s => s.id !== id));
      showToast("Time slot cleared.", 'info');
    } catch (err) {
      showToast("Failed to clear time slot.", 'error');
    }
  };

  const handleTriggerAutoPlan = async () => {
    try {
      const res = await authenticatedFetch("/api/schedule/auto-plan", { method: 'POST' });
      const data = await res.json();

      if (data.error) throw new Error(data.error);

      setSchedule(data);
      showToast("📅 Optimal timeline structure completed by Gemini!", 'success');
      authenticatedFetch("/api/coach/chat").then(r => r.json()).then(c => setChatHistory(c));
    } catch (err: any) {
      showToast("Constraint scheduling failed. Please try again.", 'error');
    }
  };

  const handleToggleHabit = async (id: string) => {
    try {
      const res = await authenticatedFetch(`/api/habits/${id}/toggle`, { method: 'POST' });
      const updatedHabit = await res.json();

      setHabits(prev => prev.map(h => h.id === id ? updatedHabit : h));
      showToast(`Streak updated for "${updatedHabit.name}"!`, 'success');

      authenticatedFetch("/api/stats").then(r => r.json()).then(s => setStats(s));
    } catch (err) {
      showToast("Failed to toggle habit.", 'error');
    }
  };

  const handleAddHabit = async (name: string, frequency: 'daily' | 'weekly') => {
    try {
      const res = await authenticatedFetch("/api/habits", {
        method: "POST",
        body: JSON.stringify({ name, frequency })
      });
      const newHabit = await res.json();
      setHabits(prev => [...prev, newHabit]);
      showToast("Atomic micro-habit initialized.", 'success');
    } catch (err) {
      showToast("Failed to save habit.", 'error');
    }
  };

  const handleAddFocusMinutes = async (minutes: number) => {
    try {
      const res = await authenticatedFetch("/api/stats/add-focus", {
        method: "POST",
        body: JSON.stringify({ minutes })
      });
      const updatedStats = await res.json();
      setStats(updatedStats);
      showToast(`🎯 +${minutes} focus deep work logged!`, 'success');
    } catch (err) {
      console.error(err);
    }
  };

  // Sleek Skeleton Loading Page
  if (loading) {
    return (
      <div className="bg-zinc-50 h-screen w-full flex items-center justify-center font-sans antialiased">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/10 flex items-center justify-center animate-pulse">
              <Zap className="h-6 w-6 text-indigo-600 animate-bounce" />
            </div>
            <div className="absolute top-0 left-0 w-12 h-12 border-2 border-indigo-600 border-t-transparent rounded-2xl animate-spin"></div>
          </div>
          <p className="text-xs font-semibold text-zinc-400 tracking-wider uppercase font-mono">Securing Connection...</p>
        </div>
      </div>
    );
  }

  // Beautiful Premium SaaS Authentication Page
  if (!user) {
    return (
      <div className="min-h-screen w-full bg-zinc-50 flex items-center justify-center relative overflow-hidden font-sans antialiased">
        {/* Decorative Grid and Ambient Glows */}
        <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] opacity-60"></div>
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-100/40 rounded-full blur-[100px] pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-violet-100/40 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="w-full max-w-md p-8 relative z-10">
          <div className="bg-white border border-zinc-200/80 rounded-3xl p-8 shadow-xl flex flex-col items-center text-center">
            {/* Branding Logo */}
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-6">
              <Zap className="h-6 w-6 text-white" />
            </div>

            <div className="space-y-2 mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-zinc-900 font-display">
                Clutch<span className="text-indigo-600">AI</span> Planner
              </h1>
              <p className="text-sm text-zinc-500 leading-relaxed max-w-sm">
                The smart personal helper that breaks down tasks, plans your schedule, and builds starter templates instantly.
              </p>
            </div>

            {/* Authentication Core Benefits */}
            <div className="w-full text-left bg-zinc-50 border border-zinc-150 rounded-2xl p-4.5 mb-8 space-y-3.5">
              <div className="flex gap-3 items-start">
                <div className="p-1 rounded-lg bg-indigo-50 text-indigo-600 mt-0.5">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-800">No More Starting Panic</h4>
                  <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                    AI splits massive chores into effortless, friendly micro-steps.
                  </p>
                </div>
              </div>
              
              <div className="flex gap-3 items-start">
                <div className="p-1 rounded-lg bg-indigo-50 text-indigo-600 mt-0.5">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-zinc-800">Secure Cloud Sync</h4>
                  <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">
                    All your schedules and habits are safely stored in Cloud SQL.
                  </p>
                </div>
              </div>
            </div>

            {/* Google Sign-In Trigger */}
            <button
              onClick={() => signInWithGoogle()}
              className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 text-zinc-700 font-bold text-sm transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md"
            >
              <svg className="h-4.5 w-4.5" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12.24 10.285V14.4h6.887c-.275 1.565-1.88 4.604-6.887 4.604-4.33 0-7.859-3.578-7.859-8s3.53-8 7.859-8c2.46 0 4.105 1.025 5.047 1.926l3.245-3.125C18.252 1.914 15.485 1 12.24 1c-6.075 0-11 4.925-11 11s4.925 11 11 11c6.345 0 10.565-4.437 10.565-10.75 0-.725-.075-1.275-.165-1.965l-10.4 0z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>

            <div className="flex items-center gap-1.5 mt-6 text-[10px] text-zinc-400 font-mono">
              <Lock className="h-3 w-3" />
              <span>SSL Protected Connection</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const criticalTask = tasks.find(t => t.status !== 'completed' && Number(t.riskScore) >= 75);
  const streak = habits.length > 0 ? Math.max(...habits.map(h => h.streak), 0) : 3;

  return (
    <div className="bg-zinc-50 h-screen w-full text-zinc-800 flex overflow-hidden font-sans antialiased selection:bg-indigo-500/10 selection:text-indigo-900">
      
      {/* 1. TOAST NOTIFICATION WINDOW */}
      {toastMessage && (
        <div className={`fixed top-5 right-5 z-50 p-4 rounded-xl border flex items-center gap-3 shadow-xl backdrop-blur-md transition-all duration-300 animate-slide-in ${
          toastMessage.type === 'success' 
            ? "bg-white border-zinc-200 text-zinc-800 shadow-lg"
            : toastMessage.type === 'error'
              ? "bg-rose-50 border-rose-200 text-rose-800"
              : "bg-indigo-50 border-indigo-200 text-indigo-800"
        }`}>
          {toastMessage.type === 'error' ? <AlertTriangle className="h-5 w-5 text-rose-600 animate-pulse" /> : <CheckCircle2 className="h-5 w-5 text-indigo-600" />}
          <span className="text-xs font-bold leading-relaxed">{toastMessage.text}</span>
        </div>
      )}

      {/* 2. SIDEBAR NAVIGATION CONTROLLERS */}
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} streak={streak} />

      {/* 3. MAIN APP VIEWPORT CANVAS */}
      <div className="flex-1 flex flex-col h-full bg-zinc-50 relative overflow-hidden">
        {/* Ambient Decorative Mesh Glows */}
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-indigo-100/30 rounded-full blur-[100px] pointer-events-none z-0"></div>
        <div className="absolute bottom-1/4 left-1/4 w-[500px] h-[500px] bg-violet-100/20 rounded-full blur-[120px] pointer-events-none z-0"></div>
        
        {/* GLOBAL HEADER */}
        <header className="h-16 border-b border-zinc-200 px-8 flex items-center justify-between flex-shrink-0 bg-white sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-6">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">My Space</p>
              <h1 className="text-sm font-display font-bold text-zinc-850">Welcome, {user.displayName || "Active User"}</h1>
            </div>
            
            {/* Live Clock HUD styled as modern pill */}
            <div className="hidden sm:flex items-center gap-2 bg-zinc-100 px-3.5 py-1.5 rounded-full border border-zinc-200 text-xs text-zinc-500 font-semibold shadow-sm">
              <Clock className="h-3.5 w-3.5 text-indigo-600" />
              <span>{currentTime.toLocaleDateString()}</span>
              <span className="text-zinc-300">|</span>
              <span className="text-indigo-600 font-bold tracking-widest">{currentTime.toLocaleTimeString()}</span>
            </div>

            {/* AI Core State badge */}
            <div className="hidden md:flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100 shadow-sm">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-mono text-indigo-700 uppercase tracking-wider font-bold">Cloud Sync On</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="btn-header-add-task"
              onClick={() => setIsNewTaskOpen(true)}
              className="flex items-center gap-1.5 px-4.5 py-2 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white font-bold text-xs transition-all duration-300 shadow-md shadow-indigo-500/10 border-none cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Add New Task</span>
            </button>
          </div>
        </header>

        {/* WORKSPACE TAB VIEWS */}
        <main className="flex-1 overflow-y-auto p-8 relative z-10">
          
          {/* TAB 1: EXECUTIVE DASHBOARD */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              
              {/* Stats Analytics Dashboard Grid */}
              <StatsGrid stats={stats} />

              {/* High-Alert Emergency Panic Alert */}
              {criticalTask && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
                  <div className="flex gap-3 items-start md:items-center">
                    <AlertTriangle className="h-5 w-5 text-rose-600 animate-pulse flex-shrink-0 mt-0.5 md:mt-0" />
                    <div>
                      <p className="text-[10px] font-mono text-rose-600 uppercase tracking-wider font-bold">⚠️ High Time Pressure</p>
                      <h4 className="text-xs font-bold text-rose-950 tracking-tight">"{criticalTask.title}" has high time pressure! Let's handle this.</h4>
                    </div>
                  </div>
                  <button
                    id="btn-panic-warroom"
                    onClick={() => {
                      showToast("Creating survival plan...", 'info');
                      handleTriggerEmergency(criticalTask.id);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all border-none shadow-sm cursor-pointer"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>AI Survival Plan</span>
                  </button>
                </div>
              )}

              {/* Main Content Layout Grid */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                
                {/* Active Tasks Grid List (8/12 cols) */}
                <div className="xl:col-span-8 flex flex-col gap-4">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="text-base font-display font-bold text-zinc-900 tracking-tight">My Daily Tasks</h3>
                      <p className="text-[11px] text-zinc-500">The checklist of tasks you need to get done.</p>
                    </div>
                    <span className="text-xs font-mono text-zinc-500 font-bold">
                      {tasks.filter(t => t.status !== 'completed').length} Pending Tasks
                    </span>
                  </div>

                  {tasks.length === 0 ? (
                    <div className="py-24 rounded-2xl border border-dashed border-zinc-200 bg-white flex flex-col items-center justify-center gap-3 text-center shadow-sm">
                      <div className="p-3 rounded-2xl bg-zinc-50 border border-zinc-150">
                        <CheckCircle2 className="h-8 w-8 text-indigo-600" />
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-zinc-800">Your active task list is empty!</h4>
                        <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">All tasks completed. Click "Add New Task" above to add some goals.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {tasks.map((task) => (
                        <TaskCard
                          key={task.id}
                          task={task}
                          onUpdateTask={handleUpdateTask}
                          onDeleteTask={handleDeleteTask}
                          onTriggerBreakdown={handleTriggerBreakdown}
                          onTriggerEmergency={handleTriggerEmergency}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Habits side bento panel (4/12 cols) */}
                <div className="xl:col-span-4 space-y-6">
                  <HabitsTracker 
                    habits={habits} 
                    onToggleHabit={handleToggleHabit} 
                    onAddHabit={handleAddHabit} 
                  />

                  {/* Anti-procrastination info block */}
                  <div className="p-5 rounded-2xl bg-indigo-50 border border-indigo-100/60 flex gap-3.5 shadow-sm">
                    <Info className="h-5 w-5 text-indigo-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-mono uppercase tracking-wider text-indigo-900 font-bold mb-1">How Clutch Helps You</h4>
                      <p className="text-[11px] text-indigo-800 leading-relaxed font-medium">Unlike basic to-do lists, Clutch actively helps you start! Use "AI Breakdown" to generate simple step-by-step checklists and start drafting your documents instantly so you never get stuck staring at a blank page.</p>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 2: DEEP WORK TIMER SPRINT */}
          {activeTab === "focus" && (
            <FocusMode 
              tasks={tasks} 
              onUpdateTask={handleUpdateTask} 
              onAddFocusMinutes={handleAddFocusMinutes} 
            />
          )}

          {/* TAB 3: AUTO SCHEDULER TIMELINE */}
          {activeTab === "schedule" && (
            <Scheduler
              tasks={tasks}
              schedule={schedule}
              onAddScheduleBlock={handleAddScheduleBlock}
              onDeleteScheduleBlock={handleDeleteScheduleBlock}
              onTriggerAutoPlan={handleTriggerAutoPlan}
            />
          )}

          {/* TAB 4: CHAT WITH THE COGNITIVE COACH */}
          {activeTab === "coach" && (
            <CoachChat
              tasks={tasks}
              chatHistory={chatHistory}
              onSendMessage={handleSendMessage}
              onClearChat={handleClearChat}
            />
          )}

          {/* TAB 5: GOOGLE WORKSPACE HUB */}
          {activeTab === "workspace" && (
            <WorkspaceHub
              tasks={tasks}
              onAddTask={handleAddTask}
              showToast={showToast}
              token={token}
            />
          )}

        </main>
      </div>

      {/* 4. ESCALATE TASK MODAL POPUP OVERLAY */}
      {isNewTaskOpen && (
        <NewTaskModal 
          onClose={() => setIsNewTaskOpen(false)} 
          onAddTask={handleAddTask} 
        />
      )}

    </div>
  );
}
