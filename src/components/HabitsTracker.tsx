/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Flame, Check, Plus, RefreshCw, Zap } from "lucide-react";
import { Habit } from "../types";

interface HabitsTrackerProps {
  habits: Habit[];
  onToggleHabit: (id: string) => Promise<void>;
  onAddHabit: (name: string, frequency: 'daily' | 'weekly') => Promise<void>;
}

export default function HabitsTracker({ habits, onToggleHabit, onAddHabit }: HabitsTrackerProps) {
  const [newHabitName, setNewHabitName] = useState("");
  const [isAdding, setIsAdding] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHabitName.trim()) return;

    await onAddHabit(newHabitName, 'daily');
    setNewHabitName("");
    setIsAdding(false);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="bg-white p-5 rounded-2xl border border-zinc-200/80 shadow-sm font-sans flex flex-col gap-4 relative overflow-hidden text-zinc-800">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xs font-mono uppercase tracking-wider text-zinc-500 font-bold flex items-center gap-2">
            <Zap className="h-4 w-4 text-indigo-600 animate-pulse" />
            Daily Habits
          </h3>
          <p className="text-[11px] text-zinc-400 leading-relaxed font-medium">Simple daily habits to build consistency and keep your momentum going.</p>
        </div>
        <button
          id="btn-add-habit-toggle"
          onClick={() => setIsAdding(!isAdding)}
          className="p-1.5 rounded-lg bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-500 hover:text-zinc-800 transition-all text-xs cursor-pointer"
          title="Add New Daily Habit"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="flex gap-2 animate-fade-in relative z-10">
          <input
            id="input-habit-name"
            type="text"
            required
            value={newHabitName}
            onChange={(e) => setNewHabitName(e.target.value)}
            placeholder="e.g., Clear physical desk"
            className="flex-1 px-3.5 py-1.5 rounded-xl bg-white border border-zinc-200 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-indigo-500 font-sans shadow-sm"
          />
          <button
            id="btn-habit-submit"
            type="submit"
            className="px-3.5 py-1.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white font-bold text-xs border-none cursor-pointer"
          >
            Add
          </button>
        </form>
      )}

      <div className="space-y-2 max-h-[220px] overflow-y-auto relative z-10">
        {habits.map((habit) => {
          const isCompletedToday = habit.completedDates.includes(todayStr);
          return (
            <div
              key={habit.id}
              onClick={() => onToggleHabit(habit.id)}
              className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer select-none transition-all duration-300 ${
                isCompletedToday
                  ? "bg-zinc-50 border-zinc-200"
                  : "bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/30"
              }`}
            >
              <div className="flex items-center gap-3">
                <button
                  id={`btn-toggle-habit-${habit.id}`}
                  className={`h-5 w-5 rounded-lg flex items-center justify-center border transition-all duration-300 cursor-pointer ${
                    isCompletedToday
                      ? "bg-indigo-50 border-indigo-200 text-indigo-600"
                      : "border-zinc-300 text-transparent hover:border-indigo-500"
                  }`}
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <span className={`text-xs ${isCompletedToday ? "line-through text-zinc-400" : "text-zinc-700 font-semibold"}`}>
                  {habit.name}
                </span>
              </div>

              {/* Streak Tracker */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${
                habit.streak > 0 
                  ? "bg-rose-50 border-rose-100 text-rose-700 font-bold" 
                  : "bg-zinc-50 border-zinc-200 text-zinc-400 font-medium"
              }`}>
                <Flame className={`h-3.5 w-3.5 ${habit.streak > 0 ? "text-rose-500 animate-bounce" : "text-zinc-400"}`} />
                <span className="text-xs font-mono">{habit.streak}d streak</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
