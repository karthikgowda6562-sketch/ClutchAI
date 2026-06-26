/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  CalendarDays, 
  Sparkles, 
  Clock, 
  Trash2, 
  Plus, 
  Calendar, 
  CheckCircle,
  HelpCircle,
  Activity,
  Zap
} from "lucide-react";
import { Task, ScheduleBlock } from "../types";

interface SchedulerProps {
  tasks: Task[];
  schedule: ScheduleBlock[];
  onAddScheduleBlock: (block: Partial<ScheduleBlock>) => Promise<void>;
  onDeleteScheduleBlock: (id: string) => Promise<void>;
  onTriggerAutoPlan: () => Promise<void>;
}

export default function Scheduler({ 
  tasks, 
  schedule, 
  onAddScheduleBlock, 
  onDeleteScheduleBlock, 
  onTriggerAutoPlan 
}: SchedulerProps) {
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [isAutoPlanning, setIsAutoPlanning] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");

  const activeTasks = tasks.filter(t => t.status !== 'completed');

  // Trigger AI Auto Planner
  const handleAutoPlan = async () => {
    setIsAutoPlanning(true);
    const messages = [
      "AI: Reading active task parameters...",
      "AI: Matching priority deadlines and estimated effort...",
      "AI: Resolving mental fatigue and energy curves...",
      "AI: Structuring optimal constraint scheduling...",
    ];

    let msgIdx = 0;
    setLoadingMsg(messages[0]);
    const timer = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length;
      setLoadingMsg(messages[msgIdx]);
    }, 1200);

    try {
      await onTriggerAutoPlan();
    } finally {
      clearInterval(timer);
      setIsAutoPlanning(false);
    }
  };

  const handleManualAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTaskId) return;
    
    const task = tasks.find(t => t.id === selectedTaskId);
    if (!task) return;

    await onAddScheduleBlock({
      taskId: task.id,
      taskTitle: task.title,
      startTime,
      endTime
    });

    // Reset Form
    setSelectedTaskId("");
  };

  // Sort schedule chronologically
  const sortedSchedule = [...schedule].sort((a, b) => a.startTime.localeCompare(b.startTime));

  // Hourly slots for a standard 09:00 - 18:00 block
  const hourSlots = [
    "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00"
  ];

  return (
    <div className="space-y-6 font-sans relative z-10 text-zinc-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <CalendarDays className="h-5.5 w-5.5 text-indigo-600" />
            Day Planner
          </h2>
          <p className="text-xs text-zinc-500">Let the AI organize your day! It lists your tasks into hourly slots based on what is due first.</p>
        </div>

        {/* AI AUTO PLAN BUTTON */}
        <button
          id="btn-auto-plan"
          onClick={handleAutoPlan}
          disabled={isAutoPlanning}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white font-bold text-xs transition-all duration-300 shadow-lg shadow-indigo-500/10 border-none cursor-pointer flex-shrink-0"
        >
          <Sparkles className="h-4.5 w-4.5" />
          <span>Auto-Plan My Day</span>
        </button>
      </div>

      {isAutoPlanning ? (
        <div className="bg-white border border-zinc-200/80 py-20 rounded-2xl flex flex-col items-center justify-center gap-4 text-center shadow-sm">
          <div className="relative">
            <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-150 animate-spin">
              <Zap className="h-5 w-5 text-indigo-600" />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-bold text-zinc-800 animate-pulse">{loadingMsg}</p>
            <p className="text-[11px] font-mono text-zinc-400">Our smart AI planner is computing the best schedule...</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* LEFT PANEL: Daily Time Blocks Timeline (8/12 cols) */}
          <div className="lg:col-span-8 bg-white border border-zinc-200/80 p-6 rounded-2xl shadow-sm flex flex-col gap-6 relative overflow-hidden">
            <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-indigo-500" />
              My Daily Timeline
            </h3>

            {sortedSchedule.length === 0 ? (
              <div className="py-20 rounded-xl border border-dashed border-zinc-300 flex flex-col items-center justify-center gap-3.5 text-center">
                <Calendar className="h-8 w-8 text-zinc-400" />
                <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
                  Your timeline is empty. Click <strong>Auto-Plan My Day</strong> above to let Clutch organize your tasks, or manually schedule one below.
                </p>
                <button
                  id="btn-auto-plan-empty"
                  onClick={handleAutoPlan}
                  className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 text-indigo-600 border border-zinc-200 font-bold text-xs transition-colors cursor-pointer"
                >
                  <Sparkles className="h-4 w-4" />
                  <span>Auto-Schedule Tasks</span>
                </button>
              </div>
            ) : (
              <div className="relative pl-6 border-l border-zinc-200/80 space-y-4">
                {sortedSchedule.map((block) => (
                  <div 
                    key={block.id}
                    className="relative group p-4 rounded-xl border bg-white border-zinc-200 hover:border-zinc-300 hover:shadow-sm transition-all duration-300 flex items-start justify-between"
                  >
                    {/* Time anchor pin */}
                    <div className="absolute -left-[31px] top-5 h-2.5 w-2.5 rounded-full bg-indigo-500 border-2 border-white group-hover:scale-125 transition-transform"></div>

                    <div className="flex-1 min-w-0 pr-4">
                      <div className="flex items-center gap-2 flex-wrap mb-1.5">
                        <span className="text-[10px] font-mono font-bold tracking-wider text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-md border border-indigo-100/60">
                          {block.startTime} - {block.endTime}
                        </span>
                        {block.isAIAllocated && (
                          <span className="text-[9px] font-mono font-bold tracking-wider text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100/60 flex items-center gap-1">
                            <Sparkles className="h-2.5 w-2.5 text-purple-500 animate-pulse" />
                            AI Planned
                          </span>
                        )}
                      </div>
                      
                      <h4 className="text-xs font-bold text-zinc-800 truncate">{block.taskTitle}</h4>
                    </div>

                    <button
                      id={`btn-delete-block-${block.id}`}
                      onClick={() => onDeleteScheduleBlock(block.id)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-all duration-200 cursor-pointer"
                      title="Clear Block"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT PANEL: Schedule manual form (4/12 cols) */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <div className="bg-white border border-zinc-200/80 p-5 rounded-2xl shadow-sm">
              <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500 font-bold mb-4 flex items-center gap-2">
                <Plus className="h-4 w-4 text-indigo-500" />
                Add Time Slot Manually
              </h3>

              <form onSubmit={handleManualAdd} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Select Task</label>
                  <select
                    id="select-schedule-task"
                    required
                    value={selectedTaskId}
                    onChange={(e) => setSelectedTaskId(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs font-medium text-zinc-800 focus:outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="">-- Choose Target --</option>
                    {activeTasks.map(t => (
                      <option key={t.id} value={t.id}>[{t.category}] {t.title}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Start Time</label>
                    <input
                      id="input-schedule-start"
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:border-indigo-500 font-mono cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 mb-1.5">End Time</label>
                    <input
                      id="input-schedule-end"
                      type="time"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:border-indigo-500 font-mono cursor-pointer"
                    />
                  </div>
                </div>

                <button
                  id="btn-schedule-manual-submit"
                  type="submit"
                  disabled={!selectedTaskId}
                  className="w-full py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 text-indigo-700 border border-zinc-200 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="h-4 w-4" />
                  <span>Pin Block to Timeline</span>
                </button>
              </form>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100 flex gap-2.5">
              <Activity className="h-4 w-4 text-indigo-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-[11px] font-bold text-indigo-900 mb-0.5">How does this work?</p>
                <p className="text-[10px] leading-relaxed text-indigo-800">
                  Clicking <strong>Auto-Plan My Day</strong> lets Clutch arrange your daily tasks so you don't have to guess what to work on first. Feel free to re-run it anytime you add, finish, or change tasks!
                </p>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
