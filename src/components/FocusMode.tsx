/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { 
  Play, 
  Pause, 
  RotateCcw, 
  Flame, 
  Volume2, 
  VolumeX, 
  Sparkles, 
  CheckCircle,
  HelpCircle,
  Clock,
  ListChecks,
  Compass
} from "lucide-react";
import { Task, FocusSession } from "../types";

interface FocusModeProps {
  tasks: Task[];
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onAddFocusMinutes: (minutes: number) => void;
}

export default function FocusMode({ tasks, onUpdateTask, onAddFocusMinutes }: FocusModeProps) {
  const activeTasks = tasks.filter(t => t.status !== 'completed');
  const [selectedTaskId, setSelectedTaskId] = useState<string>("");
  const [sessionTime, setSessionTime] = useState(25 * 60); // 25 minutes default
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedSound, setSelectedSound] = useState<'none' | 'lofi' | 'rain' | 'waves' | 'binaural'>('none');
  const [cyclesCompleted, setCyclesCompleted] = useState(0);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Default to first active task if available
  useEffect(() => {
    if (activeTasks.length > 0 && !selectedTaskId) {
      setSelectedTaskId(activeTasks[0].id);
    }
  }, [activeTasks, selectedTaskId]);

  const activeTask = tasks.find(t => t.id === selectedTaskId);

  // Timer Countdown Effect
  useEffect(() => {
    if (isActive && !isPaused) {
      timerRef.current = setInterval(() => {
        setSessionTime((prev) => {
          if (prev <= 1) {
            // Focus completed!
            clearInterval(timerRef.current!);
            setIsActive(false);
            setCyclesCompleted(c => c + 1);
            onAddFocusMinutes(25); // Add 25 minutes focus stats
            
            // Audio cue (using HTML5 synthesizer beep)
            playBeep();
            alert("🎯 Focus session completed! Outstanding job. Take a 5-minute breather!");
            return 25 * 60;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isActive, isPaused]);

  // Audio synthesizer beep helper
  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 note
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 1.5);
      osc.stop(ctx.currentTime + 1.5);
    } catch (e) {
      console.log("Audio API not supported directly in iframe context");
    }
  };

  const handleStart = () => {
    setIsActive(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    setIsPaused(true);
  };

  const handleReset = () => {
    setIsActive(false);
    setIsPaused(false);
    setSessionTime(25 * 60);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleToggleStep = (stepId: string) => {
    if (!activeTask) return;
    const updatedSteps = activeTask.breakdownSteps.map(s => {
      if (s.id === stepId) return { ...s, completed: !s.completed };
      return s;
    });

    onUpdateTask(activeTask.id, { breakdownSteps: updatedSteps });
  };

  const sounds = [
    { id: 'none', name: 'Silence', icon: VolumeX },
    { id: 'lofi', name: 'Lofi Chill Beats', icon: Volume2 },
    { id: 'rain', name: 'Rainstorm Ambient', icon: Volume2 },
    { id: 'waves', name: 'Ocean Waves', icon: Volume2 },
    { id: 'binaural', name: 'Binaural Alpha Waves', icon: Volume2 }
  ];

  const progressPercent = ((25 * 60 - sessionTime) / (25 * 60)) * 100;

  return (
    <div className="space-y-6 font-sans relative z-10 text-zinc-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-display font-bold text-zinc-900 tracking-tight flex items-center gap-2">
            <Flame className="h-5.5 w-5.5 text-rose-500" />
            Focus Timer
          </h2>
          <p className="text-xs text-zinc-500">Pick a task, start the 25-minute timer, and work on your checklist steps to get things done!</p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-3.5 py-1.5 rounded-xl self-start sm:self-center">
          <Sparkles className="h-4 w-4 text-indigo-600" />
          <span className="text-xs font-semibold text-indigo-800">Sessions Completed Today: <strong>{cyclesCompleted}</strong></span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Focus clock (7/12 cols) */}
        <div className="lg:col-span-7 bg-white border border-zinc-200/80 p-6 rounded-2xl flex flex-col items-center justify-center relative min-h-[440px] shadow-sm">
          
          {/* Glowing Ambient Background Ring */}
          <div className="absolute inset-0 flex items-center justify-center opacity-5 blur-3xl pointer-events-none">
            <div className="h-64 w-64 rounded-full bg-indigo-500"></div>
          </div>

          <div className="w-full max-w-sm mb-6 z-10">
            <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 mb-2">What task are you focusing on?</label>
            <select
              id="select-focus-task"
              value={selectedTaskId}
              onChange={(e) => {
                setSelectedTaskId(e.target.value);
                handleReset();
              }}
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs font-medium text-zinc-800 focus:outline-none focus:border-indigo-500 shadow-sm cursor-pointer"
            >
              {activeTasks.length > 0 ? (
                activeTasks.map(t => (
                  <option key={t.id} value={t.id}>[{t.category}] {t.title}</option>
                ))
              ) : (
                <option value="">No active tasks remaining</option>
              )}
            </select>
          </div>

          {/* Interactive Clock Timer Ring */}
          <div className="relative h-64 w-64 flex items-center justify-center mb-8 z-10">
            <svg className="absolute inset-0 h-full w-full transform -rotate-90">
              <circle
                cx="128"
                cy="128"
                r="110"
                className="stroke-zinc-100 fill-none"
                strokeWidth="10"
              />
              <circle
                cx="128"
                cy="128"
                r="110"
                className="stroke-indigo-600 fill-none transition-all duration-300"
                strokeWidth="8"
                strokeDasharray="691"
                strokeDashoffset={691 - (691 * progressPercent) / 100}
                strokeLinecap="round"
              />
            </svg>
            <div className="flex flex-col items-center justify-center text-center">
              <span className="text-5xl font-display font-bold text-zinc-900 tracking-widest tabular-nums">
                {formatTime(sessionTime)}
              </span>
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-400 mt-2 font-bold">
                {isActive ? (isPaused ? "Timer Paused" : "Session Active") : "Ready to Start"}
              </span>
            </div>
          </div>

          {/* Timing Control Switches */}
          <div className="flex items-center gap-3 z-10">
            {isActive && !isPaused ? (
              <button
                id="btn-focus-pause"
                onClick={handlePause}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200 text-zinc-800 font-bold text-xs transition-all duration-200 cursor-pointer"
              >
                <Pause className="h-4.5 w-4.5 text-indigo-600" />
                <span>Pause Session</span>
              </button>
            ) : (
              <button
                id="btn-focus-start"
                onClick={handleStart}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white font-bold text-xs transition-all duration-200 shadow-md shadow-indigo-500/10 cursor-pointer"
              >
                <Play className="h-4.5 w-4.5" />
                <span>Start Focus</span>
              </button>
            )}

            <button
              id="btn-focus-reset"
              onClick={handleReset}
              className="p-3 rounded-xl bg-zinc-100 hover:bg-zinc-200/80 border border-zinc-200 hover:text-zinc-950 text-zinc-500 transition-all duration-200 cursor-pointer"
              title="Reset Timer"
            >
              <RotateCcw className="h-4.5 w-4.5" />
            </button>
          </div>

        </div>

        {/* RIGHT COLUMN: Focus checklist & ambient soundtracks (5/12 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          
          {/* Section A: Ambient Soundtracks (Visual mock) */}
          <div className="bg-white border border-zinc-200/80 p-5 rounded-2xl relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-2">
                <Compass className="h-4.5 w-4.5 text-indigo-500" />
                Play Background Sounds
              </h4>
              {/* Animated Equalizer Visual Indicator */}
              {selectedSound !== 'none' && (
                <div className="flex items-end gap-0.5 h-6">
                  <div className="eq-bar"></div>
                  <div className="eq-bar"></div>
                  <div className="eq-bar"></div>
                  <div className="eq-bar"></div>
                  <div className="eq-bar"></div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 relative z-10">
              {sounds.map((sound) => {
                const SoundIcon = sound.icon;
                const isSelected = selectedSound === sound.id;
                return (
                  <button
                    key={sound.id}
                    id={`btn-sound-${sound.id}`}
                    onClick={() => setSelectedSound(sound.id as any)}
                    className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all duration-300 cursor-pointer ${
                      isSelected
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm font-semibold"
                        : "bg-white border-zinc-200 hover:bg-zinc-50 text-zinc-600 hover:text-zinc-800"
                    }`}
                  >
                    <SoundIcon className={`h-4.5 w-4.5 ${isSelected ? "text-indigo-600" : "text-zinc-400"}`} />
                    <span className="text-xs">{sound.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section B: Current Focus Task Active Steps Checkbox List */}
          <div className="bg-white border border-zinc-200/80 p-5 rounded-2xl flex-1 flex flex-col relative overflow-hidden shadow-sm min-h-[220px]">
            <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-2 mb-4">
              <ListChecks className="h-4.5 w-4.5 text-indigo-500" />
              Steps for this Task
            </h4>

            {activeTask ? (
              <div className="space-y-2 overflow-y-auto max-h-[220px] flex-1 relative z-10">
                {activeTask.breakdownSteps && activeTask.breakdownSteps.length > 0 ? (
                  activeTask.breakdownSteps.map((step) => (
                    <div
                      key={step.id}
                      onClick={() => handleToggleStep(step.id)}
                      className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer select-none transition-all duration-200 ${
                        step.completed
                          ? "bg-zinc-50 border-zinc-200 text-zinc-400"
                          : "bg-white border-zinc-200 hover:border-zinc-300 text-zinc-700 hover:text-zinc-900"
                      }`}
                    >
                      <button className="mt-0.5 cursor-pointer">
                        {step.completed ? (
                          <CheckCircle className="h-4 w-4 text-indigo-600" />
                        ) : (
                          <div className="h-4 w-4 rounded-full border-2 border-zinc-300 hover:border-indigo-600"></div>
                        )}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs leading-relaxed ${step.completed ? "line-through text-zinc-400" : "font-medium"}`}>
                          {step.text}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 flex flex-col items-center justify-center text-center gap-1.5 h-full">
                    <p className="text-xs text-zinc-500 max-w-xs leading-relaxed font-medium">No checklist generated yet for this task.</p>
                    <p className="text-[11px] text-zinc-400 max-w-xs leading-relaxed">Go to the <strong>Dashboard</strong> tab first and click <strong>AI Breakdown</strong> on this task to create your steps list!</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 flex flex-col items-center justify-center text-center gap-1.5 h-full flex-1 relative z-10">
                <p className="text-xs text-zinc-400 max-w-xs leading-relaxed font-medium">Select or add a task on the left, and its helpful step-by-step checklist will appear here to keep you on track.</p>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}
