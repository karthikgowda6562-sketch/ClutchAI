/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { 
  LayoutDashboard, 
  Flame, 
  CalendarDays, 
  MessageSquareCode, 
  Zap, 
  Sparkles,
  LogOut
} from "lucide-react";
import { useAuth } from "./AuthContext.tsx";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  streak: number;
}

export default function Sidebar({ activeTab, setActiveTab, streak }: SidebarProps) {
  const { user, logout } = useAuth();

  const menuItems = [
    { id: "dashboard", name: "Dashboard", icon: LayoutDashboard, badge: "Home" },
    { id: "workspace", name: "Google Workspace", icon: Sparkles, badge: "Google" },
    { id: "focus", name: "Focus Timer", icon: Flame, badge: "Clock" },
    { id: "schedule", name: "Day Planner", icon: CalendarDays, badge: "AI Plan" },
    { id: "coach", name: "AI Coach & Chat", icon: MessageSquareCode, badge: "Ask AI" },
  ];

  // Helper to extract initials
  const getInitials = () => {
    if (!user?.displayName) return "U";
    return user.displayName
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <div className="w-64 h-screen flex flex-col justify-between p-6 bg-white border-r border-zinc-200/80 font-sans text-zinc-700 backdrop-blur-md flex-shrink-0">
      <div className="flex flex-col gap-8">
        {/* App Branding */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/10">
            <Zap className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <span className="font-display font-bold text-lg tracking-tight text-zinc-900 flex items-center gap-0.5">
              Clutch<span className="text-indigo-600 font-extrabold">AI</span>
            </span>
            <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest font-semibold">Your Day Helper</p>
          </div>
        </div>

        {/* Dynamic AI System Health Status */}
        <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/60 flex flex-col gap-2">
          <div className="flex items-center justify-between text-xs font-mono text-zinc-600">
            <span className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
              AI Assistant
            </span>
            <span className="text-indigo-600 font-bold text-[10px]">READY</span>
          </div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
            <span className="text-[11px] text-zinc-700 font-medium truncate">Smart Assistant: Active</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex flex-col gap-1">
          <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-2 px-1">Navigation</p>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`btn-nav-${item.id}`}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl transition-all duration-200 group text-left cursor-pointer ${
                  isActive
                    ? "bg-indigo-50 text-indigo-700 font-semibold border-l-2 border-indigo-600 pl-3"
                    : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4.5 w-4.5 transition-colors duration-200 ${
                    isActive ? "text-indigo-600" : "text-zinc-400 group-hover:text-zinc-600"
                  }`} />
                  <span className="text-xs">{item.name}</span>
                </div>
                {item.badge && (
                  <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-medium ${
                    isActive
                      ? "bg-indigo-100 text-indigo-700"
                      : "bg-zinc-100 text-zinc-500"
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer User Profile & Streak Track */}
      <div className="flex flex-col gap-4">
        {user && (
          <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200/60 flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || "User"} 
                  className="h-8.5 w-8.5 rounded-lg object-cover border border-zinc-200"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="h-8.5 w-8.5 rounded-lg bg-indigo-100 border border-indigo-200 flex items-center justify-center text-indigo-700 font-bold text-xs">
                  {getInitials()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-zinc-900 truncate">{user.displayName || "Active User"}</p>
                <p className="text-[10px] text-zinc-500 truncate">{user.email}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
              <div className="flex items-center gap-1 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded-lg">
                <Flame className="h-3.5 w-3.5 text-rose-500" />
                <span className="text-xs font-bold text-rose-600">{streak}</span>
              </div>
              
              <button
                onClick={() => logout()}
                title="Log Out"
                className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer border-none bg-transparent"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between text-[10px] text-zinc-400 px-1">
          <span>Clutch AI Planner</span>
          <span className="flex items-center gap-1 font-mono">
            v1.5
          </span>
        </div>
      </div>
    </div>
  );
}
