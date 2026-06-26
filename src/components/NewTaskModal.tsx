/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { X, Sparkles, Plus, Calendar } from "lucide-react";
import { TaskPriority } from "../types";

interface NewTaskModalProps {
  onClose: () => void;
  onAddTask: (task: {
    title: string;
    description: string;
    category: string;
    deadline: string;
    estimatedHours: number;
    priority: TaskPriority;
  }) => Promise<void>;
}

export default function NewTaskModal({ onClose, onAddTask }: NewTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Academic");
  const [estimatedHours, setEstimatedHours] = useState<number>(3);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  
  // Set default deadline to tomorrow same time
  const defaultDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const [deadline, setDeadline] = useState(defaultDeadline);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !deadline || !estimatedHours) return;

    setIsSubmitting(true);
    try {
      await onAddTask({
        title,
        description,
        category,
        deadline: new Date(deadline).toISOString(),
        estimatedHours,
        priority
      });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = ["Academic", "Hackathon", "Personal", "Entrepreneurship", "Financial", "Work"];

  return (
    <div className="fixed inset-0 bg-zinc-950/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in font-sans">
      <div 
        className="w-full max-w-lg bg-white border border-zinc-200/80 rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[90vh] relative z-50"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER BAR */}
        <div className="px-6 py-4 bg-zinc-50 border-b border-zinc-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4.5 w-4.5 text-indigo-600 animate-pulse" />
            <h3 className="text-base font-display font-semibold text-zinc-950 tracking-tight">Add New Task</h3>
          </div>
          <button
            id="btn-close-modal"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* FORM CONTAINER */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 flex-1">
          <div>
            <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Task Title *</label>
            <input
              id="input-task-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Write report or prepare slides"
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-indigo-500 font-sans shadow-sm"
            />
          </div>

          <div>
            <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Description</label>
            <textarea
              id="input-task-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details here. Our AI can use this text to break down your task into simple, sequential checklist steps!"
              className="w-full px-4 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-indigo-500 font-sans shadow-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Category</label>
              <select
                id="select-task-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:border-indigo-500 font-sans shadow-sm cursor-pointer"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Priority</label>
              <select
                id="select-task-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as any)}
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:border-indigo-500 font-sans font-medium shadow-sm cursor-pointer"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Deadline target *</label>
              <input
                id="input-task-deadline"
                type="datetime-local"
                required
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:border-indigo-500 font-mono shadow-sm cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500 mb-1.5">Estimated Hours *</label>
              <input
                id="input-task-effort"
                type="number"
                required
                min={0.1}
                step={0.1}
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(Number(e.target.value))}
                className="w-full px-4 py-2.5 rounded-xl bg-white border border-zinc-200 text-xs text-zinc-800 focus:outline-none focus:border-indigo-500 font-mono shadow-sm"
              />
            </div>
          </div>

          {/* ACTIONS */}
          <div className="border-t border-zinc-200/80 pt-5 flex items-center justify-end gap-3">
            <button
              id="btn-cancel-modal"
              type="button"
              onClick={onClose}
              className="px-4.5 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-zinc-600 hover:text-zinc-800 border border-zinc-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-submit-task"
              type="submit"
              disabled={isSubmitting || !title}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white font-bold text-xs transition-colors shadow-md shadow-indigo-500/10 border-none flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              <span>Create Task</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
