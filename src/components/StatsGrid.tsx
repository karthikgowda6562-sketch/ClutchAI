/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { 
  Hourglass, 
  CheckCircle2, 
  Sparkles, 
  AlertTriangle,
  ChevronRight
} from "lucide-react";
import { ProductivityStats } from "../types";

interface StatsGridProps {
  stats: ProductivityStats;
}

export default function StatsGrid({ stats }: StatsGridProps) {
  const metricCards = [
    {
      name: "Focus Time",
      value: `${Math.round((stats.focusTimeMinutes / 60) * 10) / 10}h`,
      sub: `${stats.focusTimeMinutes} minutes spent studying/working`,
      icon: Hourglass,
      color: "from-indigo-50/60 to-violet-50/30",
      border: "border-indigo-100",
      textGlow: "text-indigo-600"
    },
    {
      name: "On-Time Rating",
      value: `${stats.onTimeCompletionRate}%`,
      sub: stats.onTimeCompletionRate >= 85 ? "Excellent task completion speed!" : "Slightly behind schedule",
      icon: CheckCircle2,
      color: stats.onTimeCompletionRate >= 85 ? "from-emerald-50/60 to-teal-50/30" : "from-amber-50/60 to-yellow-50/30",
      border: stats.onTimeCompletionRate >= 85 ? "border-emerald-100" : "border-amber-100",
      textGlow: stats.onTimeCompletionRate >= 85 ? "text-emerald-600" : "text-amber-600"
    },
    {
      name: "AI Help Steps",
      value: stats.aiBreakdownsUsed,
      sub: "Tasks broken down by AI",
      icon: Sparkles,
      color: "from-purple-50/60 to-indigo-50/30",
      border: "border-purple-100",
      textGlow: "text-purple-600"
    },
    {
      name: "Quick Help Plans",
      value: stats.emergencyModesTriggered,
      sub: "Urgent deadline plans created",
      icon: AlertTriangle,
      color: stats.emergencyModesTriggered > 0 ? "from-rose-50 to-red-50/40" : "from-zinc-50 to-zinc-100/40",
      border: stats.emergencyModesTriggered > 0 ? "border-rose-150 animate-pulse" : "border-zinc-200",
      textGlow: stats.emergencyModesTriggered > 0 ? "text-rose-600" : "text-zinc-500"
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-sans">
      {metricCards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className={`p-5 rounded-2xl bg-gradient-to-br ${card.color} border ${card.border} hover:border-zinc-300 transition-all duration-300 shadow-sm relative overflow-hidden bg-white`}
          >
            {/* Background mesh glow on each card */}
            <div className="absolute top-0 right-0 -mr-6 -mt-6 w-20 h-20 bg-zinc-100/50 rounded-full blur-xl pointer-events-none"></div>

            <div className="flex items-center justify-between mb-3 relative z-10">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-500">{card.name}</span>
              <div className="p-1.5 rounded-lg bg-zinc-50 border border-zinc-200">
                <Icon className="h-4 w-4 text-zinc-700" />
              </div>
            </div>
            
            <div className="flex items-baseline gap-1 relative z-10">
              <span className={`text-3xl font-display font-bold ${card.textGlow}`}>{card.value}</span>
              <span className="text-[10px] font-mono text-zinc-400">/ total</span>
            </div>

            <p className="text-xs text-zinc-500 mt-2.5 flex items-center gap-1 relative z-10 font-medium">
              <ChevronRight className="h-3.5 w-3.5 text-zinc-400" />
              {card.sub}
            </p>
          </div>
        );
      })}
    </div>
  );
}
