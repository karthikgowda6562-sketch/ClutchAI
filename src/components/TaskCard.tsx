/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Clock, 
  Sparkles, 
  AlertOctagon, 
  CheckSquare, 
  Square, 
  Trash2, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  FileCode, 
  Mail, 
  FileText, 
  ListChecks,
  Activity,
  Zap,
  ExternalLink
} from "lucide-react";
import { Task, BreakdownStep, AIArtifact } from "../types";

interface TaskCardProps {
  task: Task;
  onUpdateTask: (id: string, updates: Partial<Task>) => void | Promise<void>;
  onDeleteTask: (id: string) => void | Promise<void>;
  onTriggerBreakdown: (id: string) => Promise<void>;
  onTriggerEmergency: (id: string) => Promise<void>;
}

export default function TaskCard({ 
  task, 
  onUpdateTask, 
  onDeleteTask, 
  onTriggerBreakdown, 
  onTriggerEmergency 
}: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(null);
  const [timeLeftStr, setTimeLeftStr] = useState("");
  const [isBreakdownLoading, setIsBreakdownLoading] = useState(false);
  const [isEmergencyLoading, setIsEmergencyLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");

  // Dynamic live clock for deadline counting
  useEffect(() => {
    const updateClock = () => {
      const now = Date.now();
      const target = new Date(task.deadline).getTime();
      const diff = target - now;

      if (task.status === 'completed') {
        setTimeLeftStr("Completed");
        return;
      }

      if (diff <= 0) {
        setTimeLeftStr("Past Due!");
        return;
      }

      const totalMins = Math.floor(diff / (1000 * 60));
      const hours = Math.floor(totalMins / 60);
      const mins = totalMins % 60;

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        const remHours = hours % 24;
        setTimeLeftStr(`${days}d ${remHours}h left`);
      } else {
        setTimeLeftStr(`${hours}h ${mins}m left`);
      }
    };

    updateClock();
    const interval = setInterval(updateClock, 30000); // update every 30s
    return () => clearInterval(interval);
  }, [task.deadline, task.status]);

  // Handle step checkbox checking
  const handleToggleStep = (stepId: string) => {
    const updatedSteps = task.breakdownSteps.map(s => {
      if (s.id === stepId) return { ...s, completed: !s.completed };
      return s;
    });

    const allCompleted = updatedSteps.length > 0 && updatedSteps.every(s => s.completed);
    const newStatus = allCompleted ? 'completed' : 'in_progress';

    onUpdateTask(task.id, { 
      breakdownSteps: updatedSteps,
      status: newStatus as any
    });
  };

  // Copy code artifact clipboard helper
  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Trigger Breakdown AI
  const handleBreakdown = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsBreakdownLoading(true);
    setIsExpanded(true);
    
    const messages = [
      "Clutch: Connecting with Gemini...",
      "Clutch: Analyzing deadline parameters...",
      "Clutch: Resolving core blockers...",
      "Clutch: Writing custom starter code & draft files..."
    ];
    
    let msgIdx = 0;
    setLoadingMsg(messages[0]);
    const timer = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length;
      setLoadingMsg(messages[msgIdx]);
    }, 1500);

    try {
      await onTriggerBreakdown(task.id);
    } finally {
      clearInterval(timer);
      setIsBreakdownLoading(false);
    }
  };

  // Trigger Emergency War Room Plan AI
  const handleEmergency = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEmergencyLoading(true);
    setIsExpanded(true);

    const messages = [
      "🚨 ESCALATING TO EMERGENCY CLUTCH...",
      "🚨 Triage: cutting all bulk scope...",
      "🚨 Planning minute-by-minute battle plan...",
      "🚨 Writing stakeholder extension request letter..."
    ];

    let msgIdx = 0;
    setLoadingMsg(messages[0]);
    const timer = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length;
      setLoadingMsg(messages[msgIdx]);
    }, 1200);

    try {
      await onTriggerEmergency(task.id);
    } finally {
      clearInterval(timer);
      setIsEmergencyLoading(false);
    }
  };

  // Select first artifact as default if none selected
  const activeArtifact = task.aiArtifacts.find(a => a.id === selectedArtifactId) || task.aiArtifacts[0];
  let riskColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
  let riskLabel = "Comfortable Margin";

  if (task.riskScore >= 75) {
    riskColor = "bg-rose-50 text-rose-700 border-rose-200 glowing-rose animate-pulse";
    riskLabel = "High Time Pressure";
  } else if (task.riskScore >= 40) {
    riskColor = "bg-amber-50 text-amber-700 border-amber-200";
    riskLabel = "Moderate Margin";
  }

  // Get artifact icons
  const getArtifactIcon = (type: string) => {
    switch (type) {
      case "code": return <FileCode className="h-4.5 w-4.5 text-indigo-600" />;
      case "email": return <Mail className="h-4.5 w-4.5 text-pink-600" />;
      case "plan": return <Zap className="h-4.5 w-4.5 text-rose-600" />;
      default: return <FileText className="h-4.5 w-4.5 text-indigo-600" />;
    }
  };

  return (
    <div 
      className={`bg-white rounded-2xl overflow-hidden border transition-all duration-300 shadow-sm relative ${
        isExpanded ? "border-zinc-300 bg-zinc-50/50" : "border-zinc-200/80 hover:border-zinc-300 hover:bg-zinc-50/20"
      }`}
    >
      {/* Decorative inner ambient glow behind each task card when expanded */}
      {isExpanded && (
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-60 h-60 bg-indigo-50/30 rounded-full blur-[60px] pointer-events-none z-0"></div>
      )}

      {/* CARD TOP HEADER BAR */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer select-none relative z-10"
      >
        <div className="flex items-start gap-4 flex-1">
          {/* Status Checkbox Button */}
          <button
            id={`btn-complete-${task.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onUpdateTask(task.id, { status: task.status === 'completed' ? 'pending' : 'completed' });
            }}
            className="mt-1 text-zinc-400 hover:text-zinc-600 transition-colors duration-200 cursor-pointer"
          >
            {task.status === 'completed' ? (
              <CheckSquare className="h-5.5 w-5.5 text-indigo-600" />
            ) : (
              <Square className="h-5.5 w-5.5 text-zinc-300 hover:text-indigo-600" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {/* Category Badging */}
              <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold tracking-wider uppercase bg-zinc-100 border border-zinc-200 text-zinc-600">
                {task.category}
              </span>
              
              {/* Priority Badging */}
              <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold uppercase tracking-wider border ${
                task.priority === 'high' 
                  ? "bg-rose-50 text-rose-600 border-rose-100" 
                  : task.priority === 'medium'
                    ? "bg-amber-50 text-amber-600 border-amber-100"
                    : "bg-zinc-100 text-zinc-500 border-zinc-200"
              }`}>
                {task.priority} Priority
              </span>

              {/* Dynamic Risk Display Badging */}
              {task.status !== 'completed' && (
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border ${riskColor}`}>
                  {riskLabel} ({task.riskScore}%)
                </span>
              )}
            </div>

            <h3 className={`text-base font-display font-semibold text-zinc-900 tracking-tight ${task.status === 'completed' ? "line-through text-zinc-400 font-normal" : ""}`}>
              {task.title}
            </h3>

            <p className="text-xs text-zinc-500 line-clamp-2 mt-1 max-w-xl">
              {task.description}
            </p>
          </div>
        </div>

        {/* CLOCK TIMER & CONTROL ACTIONS */}
        <div className="flex items-center justify-between md:justify-end gap-5 pl-9 md:pl-0">
          <div className="flex items-center gap-4">
            {/* Clock Deadline indicators */}
            <div className={`flex items-center gap-1.5 font-mono text-xs font-semibold ${
              task.status === 'completed' 
                ? "text-zinc-400" 
                : timeLeftStr.includes("left") && task.priority === 'high'
                  ? "text-rose-600 font-bold"
                  : "text-zinc-600"
            }`}>
              <Clock className="h-4 w-4 text-zinc-400" />
              <span>{timeLeftStr}</span>
            </div>

            {/* Effort Estimate badges */}
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold">Time Estimate</p>
              <p className="text-xs font-mono font-semibold text-zinc-700">{task.estimatedHours}h estimated</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Action controls */}
            {task.status !== 'completed' && task.breakdownSteps.length === 0 && (
              <button
                id={`btn-breakdown-${task.id}`}
                onClick={handleBreakdown}
                disabled={isBreakdownLoading || isEmergencyLoading}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white font-bold text-xs transition-all duration-200 shadow-md shadow-indigo-500/10 border-none cursor-pointer"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>AI Breakdown</span>
              </button>
            )}

            {task.status !== 'completed' && task.riskScore >= 70 && !task.emergencyPlanCreated && (
              <button
                id={`btn-emergency-${task.id}`}
                onClick={handleEmergency}
                disabled={isBreakdownLoading || isEmergencyLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-colors duration-200 border-none shadow-md shadow-rose-500/10 cursor-pointer"
              >
                <AlertOctagon className="h-3.5 w-3.5" />
                <span>Create Quick Help Plan</span>
              </button>
            )}

            {/* Expander Drawer Toggles */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
              className="p-1.5 rounded-lg hover:bg-zinc-200/60 text-zinc-400 hover:text-zinc-700 transition-colors cursor-pointer"
            >
              {isExpanded ? <ChevronUp className="h-4.5 w-4.5" /> : <ChevronDown className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>
      </div>

      {/* EXPANDABLE AI WORKROOM DRAWER */}
      {isExpanded && (
        <div className="border-t border-zinc-200/80 bg-zinc-50/30 p-5 font-sans relative z-10">
          {/* Active Loading Screens */}
          {(isBreakdownLoading || isEmergencyLoading) ? (
            <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
              <div className="relative">
                <div className="h-10 w-10 rounded-xl bg-indigo-50 flex items-center justify-center border border-indigo-100 animate-spin">
                  <Zap className="h-5 w-5 text-indigo-600" />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-bold text-zinc-800">{loadingMsg}</p>
                <p className="text-[11px] font-mono text-zinc-400">Our smart AI is organizing details for you...</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              {/* Task Risk Reason Alert */}
              {task.riskReason && task.status !== 'completed' && (
                <div className="p-3.5 rounded-xl bg-white border border-zinc-200 flex gap-2.5 items-start">
                  <Activity className={`h-4.5 w-4.5 mt-0.5 flex-shrink-0 ${task.riskScore >= 75 ? 'text-rose-500' : 'text-indigo-500'}`} />
                  <div className="flex-1">
                    <p className="text-[10px] font-mono text-zinc-400 uppercase font-bold tracking-wider">AI Assistant Advice & Tips</p>
                    <p className="text-xs text-zinc-700 font-medium leading-relaxed">{task.riskReason}</p>
                  </div>
                </div>
              )}

              {/* TWO PANEL WORKSTATION SCREEN (Left steps roadmap, Right AI work draft templates) */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Panel 1: Step Breakdown Checklist (4/12 columns) */}
                <div className="lg:col-span-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-1.5">
                      <ListChecks className="h-4 w-4 text-indigo-500" />
                      Task Breakdown Checklist
                    </h4>
                    {task.breakdownSteps.length > 0 && (
                      <span className="text-[10px] font-mono text-zinc-400 font-bold">
                        {task.breakdownSteps.filter(s => s.completed).length} / {task.breakdownSteps.length} Finished
                      </span>
                    )}
                  </div>

                  {task.breakdownSteps.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {task.breakdownSteps.map((step) => (
                        <div
                          key={step.id}
                          onClick={() => handleToggleStep(step.id)}
                          className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer select-none transition-all duration-300 bg-white ${
                            step.completed
                              ? "border-zinc-200 text-zinc-400"
                              : "border-zinc-200 hover:border-zinc-300 hover:shadow-sm text-zinc-700 hover:text-zinc-900"
                          }`}
                        >
                          <button className="mt-0.5 transition-colors cursor-pointer">
                            {step.completed ? (
                              <CheckSquare className="h-4.5 w-4.5 text-indigo-600" />
                            ) : (
                              <Square className="h-4.5 w-4.5 text-zinc-300 hover:text-indigo-600" />
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs leading-relaxed ${step.completed ? "line-through text-zinc-400" : "font-medium"}`}>
                              {step.text}
                            </p>
                            <span className="text-[10px] font-mono text-zinc-400 mt-1 block">
                              Suggested time: {step.durationMinutes} mins
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-8 px-4 rounded-xl border border-dashed border-zinc-300 bg-white flex flex-col items-center justify-center gap-2.5 text-center">
                      <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
                        Procrastinating? It's usually because starting feels too big. Click <strong>AI Breakdown</strong> above to split this task into short, easy steps and create helpful starter drafts!
                      </p>
                      <button
                        onClick={handleBreakdown}
                        className="mt-1 flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 text-indigo-600 border border-zinc-200 font-bold text-xs transition-colors duration-200 cursor-pointer"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>Breakdown & Draft Work</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Panel 2: Copyable work assets (7/12 columns) */}
                <div className="lg:col-span-7 flex flex-col gap-3">
                  <div className="flex items-center justify-between mb-1">
                    <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-1.5">
                      <Zap className="h-4 w-4 text-indigo-500" />
                      AI Templates & Drafts
                    </h4>
                    {task.aiArtifacts.length > 0 && (
                      <span className="text-[10px] text-zinc-400 font-semibold">Ready to Use</span>
                    )}
                  </div>

                  {task.aiArtifacts.length > 0 ? (
                    <div className="flex flex-col gap-3 flex-1">
                      {/* Tabs selector for assets */}
                      {task.aiArtifacts.length > 1 && (
                        <div className="flex gap-1 border-b border-zinc-200 pb-2 flex-wrap">
                          {task.aiArtifacts.map((art) => (
                            <button
                              key={art.id}
                              onClick={() => setSelectedArtifactId(art.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all duration-200 cursor-pointer ${
                                (activeArtifact?.id === art.id)
                                  ? "bg-indigo-50 text-indigo-700 border border-indigo-100"
                                  : "text-zinc-500 hover:text-zinc-800 hover:bg-zinc-100"
                              }`}
                            >
                              {getArtifactIcon(art.type)}
                              <span>{art.name}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Codebox content screen */}
                      {activeArtifact && (
                        <div className="rounded-xl border border-zinc-200 bg-zinc-900 overflow-hidden flex flex-col flex-1">
                          <div className="px-4 py-2 bg-zinc-800 border-b border-zinc-700 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {getArtifactIcon(activeArtifact.type)}
                              <span className="text-xs font-mono text-zinc-200 font-bold">{activeArtifact.name}</span>
                            </div>
                            <button
                              id={`btn-copy-art-${activeArtifact.id}`}
                              onClick={() => handleCopy(activeArtifact.id, activeArtifact.content)}
                              className="flex items-center gap-1 text-[10px] font-mono text-zinc-300 hover:text-white bg-zinc-700/50 border border-zinc-600 px-2.5 py-1 rounded-lg transition-all duration-200 cursor-pointer"
                            >
                              {copiedId === activeArtifact.id ? (
                                <>
                                  <Check className="h-3 w-3 text-emerald-400" />
                                  <span className="text-emerald-400 font-bold">Copied!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="h-3 w-3" />
                                  <span>Copy Draft</span>
                                </>
                              )}
                            </button>
                          </div>
                          
                          <div className="p-4 overflow-y-auto max-h-72 font-mono text-xs text-zinc-100 leading-relaxed whitespace-pre-wrap">
                            {activeArtifact.content}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-8 px-4 rounded-xl border border-dashed border-zinc-300 bg-white flex flex-col items-center justify-center gap-2 text-center h-full">
                      <p className="text-xs text-zinc-500 max-w-xs leading-relaxed">
                        Clutch can draft starting templates, draft emails, summaries, or structured plans so you can skip the hard part and start with a completed 40% draft. Click <strong>AI Breakdown</strong> to get started!
                      </p>
                    </div>
                  )}
                </div>

              </div>

              {/* FOOTER ACTIONS AND DELETE CONTROL */}
              <div className="flex items-center justify-between border-t border-zinc-200 pt-4 flex-wrap gap-3">
                <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest font-bold flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-zinc-400" /> Deadline Target: {new Date(task.deadline).toLocaleString()}
                </p>
                <div className="flex gap-2">
                  <button
                    id={`btn-delete-${task.id}`}
                    onClick={() => onDeleteTask(task.id)}
                    className="flex items-center gap-1 text-xs text-rose-600 hover:text-rose-500 hover:bg-rose-50 px-2.5 py-1.5 rounded-lg border border-transparent hover:border-rose-100 transition-all duration-200 font-semibold cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete Task</span>
                  </button>
                </div>
              </div>

            </div>
          )}
        </div>
      )}
    </div>
  );
}
