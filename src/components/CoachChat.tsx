/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { 
  Send, 
  Sparkles, 
  Trash2, 
  HelpCircle, 
  Flame, 
  Terminal, 
  Zap,
  Bot
} from "lucide-react";
import { CoachMessage, Task } from "../types";

interface CoachChatProps {
  tasks: Task[];
  chatHistory: CoachMessage[];
  onSendMessage: (msg: string) => Promise<void>;
  onClearChat: () => Promise<void>;
}

export default function CoachChat({ tasks, chatHistory, onSendMessage, onClearChat }: CoachChatProps) {
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Auto scroll to bottom on new messages
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || isSending) return;
    
    setIsSending(true);
    setInputText("");
    
    try {
      await onSendMessage(textToSend);
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSend(inputText);
  };

  const promptChips = [
    {
      label: "🚨 Help Me Start",
      prompt: "Help! I am completely procrastinating right now. Give me a direct, no-excuse mentor perspective and prescribe a concrete, 5-minute kickstart action right now."
    },
    {
      label: "✂️ Simplify My Goals",
      prompt: "I have a looming deadline. Walk me through a brutal, fast-paced scope cut strategy. What features/details can I skip to ensure I deliver on time?"
    },
    {
      label: "💬 Solve a Problem",
      prompt: "Act like an elite tech advisor. Looking at my current active tasks, tell me which task is my absolute bottleneck right now, and what my immediate next step is."
    }
  ];

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col justify-between bg-white border border-zinc-200/80 rounded-2xl overflow-hidden font-sans shadow-sm relative text-zinc-800">
      
      {/* CHAT HEADER STATUS BAR */}
      <div className="px-5 py-4 bg-zinc-50 border-b border-zinc-200/80 flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-white animate-pulse"></span>
          </div>
          <div>
            <span className="font-display font-semibold text-zinc-900 text-sm flex items-center gap-1">
              AI Study Coach
            </span>
            <p className="text-[10px] text-zinc-500 font-medium">Always here to help you beat procrastination and draft content</p>
          </div>
        </div>

        <button
          id="btn-clear-chat"
          onClick={onClearChat}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-200 hover:border-rose-200 hover:bg-rose-50 text-xs text-zinc-500 hover:text-rose-600 transition-all duration-200 cursor-pointer"
          title="Clear Conversation Logs"
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span>Clear logs</span>
        </button>
      </div>

      {/* MESSAGES VIEW CONTAINER */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4 bg-zinc-50/30 relative z-10">
        {chatHistory.map((msg) => {
          const isAI = msg.sender === "ai";
          return (
            <div
              key={msg.id}
              className={`flex gap-3.5 max-w-[85%] ${isAI ? "mr-auto" : "ml-auto flex-row-reverse"}`}
            >
              {/* Message Avatar Icons */}
              <div className={`h-8 w-8 rounded-lg flex items-center justify-center border text-xs font-bold flex-shrink-0 ${
                isAI 
                  ? "bg-indigo-50 border-indigo-200 text-indigo-600" 
                  : "bg-zinc-100 border-zinc-200 text-zinc-700"
              }`}>
                {isAI ? "AI" : "Me"}
              </div>

              {/* Message Text Bubbles */}
              <div className={`p-4 rounded-2xl leading-relaxed text-xs border shadow-sm max-w-full ${
                isAI 
                  ? "bg-white border-zinc-200 text-zinc-800 rounded-tl-none whitespace-pre-wrap" 
                  : "bg-indigo-600 border-transparent text-white rounded-tr-none text-left"
              }`}>
                {msg.text}
                <span className={`block text-[8px] font-mono mt-1.5 ${isAI ? "text-zinc-400 text-left" : "text-indigo-200 text-right"}`}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}

        {/* AI Processing Bubble Loader */}
        {isSending && (
          <div className="flex gap-3.5 max-w-[85%] mr-auto">
            <div className="h-8 w-8 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center text-xs font-bold animate-pulse">
              AI
            </div>
            <div className="p-4 rounded-2xl bg-white border border-zinc-200 rounded-tl-none flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce"></span>
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0.15s' }}></span>
              <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-bounce" style={{ animationDelay: '0.3s' }}></span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* FOOTER ACTIONS: Direct Chips & Input Forms */}
      <div className="p-4 bg-zinc-50 border-t border-zinc-200/80 flex flex-col gap-4 relative z-10">
        
        {/* Quick Prompt Chips */}
        <div className="flex flex-wrap gap-2">
          {promptChips.map((chip, idx) => (
            <button
              key={idx}
              id={`btn-chip-${idx}`}
              onClick={() => handleSend(chip.prompt)}
              disabled={isSending}
              className="px-3 py-1.5 rounded-xl bg-white hover:bg-zinc-100 border border-zinc-200 text-xs font-medium text-zinc-600 hover:text-zinc-900 transition-all duration-200 cursor-pointer flex items-center gap-1 disabled:opacity-50 shadow-sm"
            >
              <span>{chip.label}</span>
            </button>
          ))}
        </div>

        {/* Chat input form */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            id="input-coach-chat"
            type="text"
            required
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={isSending}
            placeholder="Ask your coach anything... (e.g., 'Help me start' or 'Draft an email')"
            className="flex-1 px-4 py-3 rounded-xl bg-white border border-zinc-200 text-xs text-zinc-800 placeholder-zinc-400 focus:outline-none focus:border-indigo-500 transition-all font-sans shadow-sm"
          />
          <button
            id="btn-coach-send"
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="p-3 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white font-semibold transition-all shadow-md shadow-indigo-500/10 border-none flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>

      </div>
    </div>
  );
}
