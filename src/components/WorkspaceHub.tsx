/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { 
  Calendar, 
  Mail, 
  CheckSquare, 
  FileText, 
  Plus, 
  Search, 
  Sparkles, 
  RefreshCw, 
  Trash2, 
  User, 
  Clock, 
  ArrowRight, 
  ChevronRight, 
  Check, 
  Send, 
  Pin, 
  AlertCircle, 
  ArrowUpRight,
  Eye,
  BookOpen
} from "lucide-react";
import { useAuth } from "./AuthContext.tsx";
import { Task } from "../types.ts";

interface WorkspaceHubProps {
  tasks: Task[];
  onAddTask: (task: {
    title: string;
    description: string;
    category: string;
    deadline: string;
    estimatedHours: number;
    priority: 'low' | 'medium' | 'high';
  }) => Promise<void>;
  showToast: (text: string, type?: 'success' | 'info' | 'error') => void;
  token: string | null;
}

// Local Interfaces for Workspace API Responses
interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  htmlLink?: string;
}

interface GmailMessage {
  id: string;
  threadId: string;
  sender: string;
  subject: string;
  snippet: string;
  date: string;
  body?: string;
  isUnread?: boolean;
}

interface GoogleTask {
  id: string;
  title: string;
  notes?: string;
  due?: string;
  status: 'needsAction' | 'completed';
}

interface GoogleTaskList {
  id: string;
  title: string;
}

interface KeepNote {
  id: string;
  title: string;
  content: string;
  color: string; // e.g. 'bg-yellow-50 border-yellow-200'
  isPinned: boolean;
  createdAt: string;
}

export default function WorkspaceHub({ tasks, onAddTask, showToast, token }: WorkspaceHubProps) {
  const { googleAccessToken, signInWithGoogle, user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<"calendar" | "gmail" | "tasks" | "keep">("calendar");
  const [isLoading, setIsLoading] = useState(false);

  // -------------------------------------------------------------
  // STATE DEFINITIONS FOR THE FOUR WORKSPACE INTEGRATIONS
  // -------------------------------------------------------------
  
  // 1. Google Calendar States
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [newCalEvent, setNewCalEvent] = useState({
    summary: "",
    description: "",
    startTime: "",
    endTime: "",
  });
  const [aiOptimizedSchedule, setAiOptimizedSchedule] = useState<{
    title: string;
    reason: string;
    startTime: string;
    endTime: string;
  }[] | null>(null);
  const [isOptimizingCalendar, setIsOptimizingCalendar] = useState(false);

  // 2. Gmail States
  const [emails, setEmails] = useState<GmailMessage[]>([]);
  const [emailSearch, setEmailSearch] = useState("");
  const [activeEmail, setActiveEmail] = useState<GmailMessage | null>(null);
  const [emailSummary, setEmailSummary] = useState<{
    summary: string[];
    tone: string;
    replyDraft: string;
  } | null>(null);
  const [isSummarizingEmail, setIsSummarizingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState({
    to: "",
    subject: "",
    body: "",
    aiPrompt: ""
  });
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);

  // 3. Google Tasks States
  const [taskLists, setTaskLists] = useState<GoogleTaskList[]>([]);
  const [selectedTaskListId, setSelectedTaskListId] = useState<string>("");
  const [googleTasksList, setGoogleTasksList] = useState<GoogleTask[]>([]);
  const [newGoogleTaskTitle, setNewGoogleTaskTitle] = useState("");

  // 4. Google Keep Clone States
  const [keepNotes, setKeepNotes] = useState<KeepNote[]>([]);
  const [newKeepNote, setNewKeepNote] = useState({ title: "", content: "", color: "yellow" });
  const [isExtractingNote, setIsExtractingNote] = useState<string | null>(null);

  const colors = [
    { name: "yellow", bg: "bg-amber-50 border-amber-200/80 text-amber-900" },
    { name: "indigo", bg: "bg-indigo-50 border-indigo-100/80 text-indigo-900" },
    { name: "rose", bg: "bg-rose-50 border-rose-150 text-rose-900" },
    { name: "emerald", bg: "bg-emerald-50 border-emerald-150 text-emerald-900" },
    { name: "sky", bg: "bg-sky-50 border-sky-150 text-sky-900" },
  ];

  // Fetch Authenticated Backend Helper
  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      }
    });
  };

  // -------------------------------------------------------------
  // INITIALIZERS & CORE WORKSPACE FETCHERS
  // -------------------------------------------------------------
  useEffect(() => {
    if (googleAccessToken) {
      fetchCalendarData();
      fetchGmailData();
      fetchTasksLists();
    }
    // Load local Keep notes always
    const cachedKeep = localStorage.getItem("clutch_keep_notes");
    if (cachedKeep) {
      setKeepNotes(JSON.parse(cachedKeep));
    } else {
      const defaultNotes: KeepNote[] = [
        {
          id: "note-1",
          title: "💡 Brainstorm: Product Launch Strategy",
          content: "- Pitch decks to stakeholders on Monday\n- Finalize landing page copy with marketing\n- Send introductory newsletter on product features",
          color: "yellow",
          isPinned: true,
          createdAt: new Date().toISOString()
        },
        {
          id: "note-2",
          title: "🛒 Personal Groceries & Coding snacks",
          content: "- Cold brew coffee concentrate\n- Protein bars & unsalted almonds\n- Sparkling spring water (lime flavour)",
          color: "sky",
          isPinned: false,
          createdAt: new Date().toISOString()
        }
      ];
      setKeepNotes(defaultNotes);
      localStorage.setItem("clutch_keep_notes", JSON.stringify(defaultNotes));
    }
  }, [googleAccessToken]);

  // Save Keep notes on change
  useEffect(() => {
    if (keepNotes.length > 0) {
      localStorage.setItem("clutch_keep_notes", JSON.stringify(keepNotes));
    }
  }, [keepNotes]);

  // -------------------------------------------------------------
  // 1. GOOGLE CALENDAR CONTROLLERS
  // -------------------------------------------------------------
  const fetchCalendarData = async () => {
    if (!googleAccessToken) return;
    setIsLoading(true);
    try {
      // Fetch primary calendar events from today onward
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const timeMin = now.toISOString();

      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&orderBy=startTime&singleEvents=true&maxResults=15`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${googleAccessToken}` }
      });
      const data = await res.json();
      if (data.items) {
        setCalendarEvents(data.items);
      } else {
        console.error("No items returned in calendar list:", data);
      }
    } catch (err) {
      console.error("Failed to fetch Google Calendar events:", err);
      showToast("Could not sync Google Calendar. Please refresh.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCalendarEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleAccessToken) return;
    if (!newCalEvent.summary || !newCalEvent.startTime || !newCalEvent.endTime) {
      showToast("Please provide event title and start/end times.", "error");
      return;
    }

    // Require user confirmation for mutations
    const confirmed = window.confirm(`Create Google Calendar Event: "${newCalEvent.summary}"?`);
    if (!confirmed) return;

    try {
      setIsLoading(true);
      const startDateTime = new Date(newCalEvent.startTime).toISOString();
      const endDateTime = new Date(newCalEvent.endTime).toISOString();

      const eventBody = {
        summary: newCalEvent.summary,
        description: newCalEvent.description,
        start: { dateTime: startDateTime },
        end: { dateTime: endDateTime }
      };

      const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(eventBody)
      });

      if (res.ok) {
        showToast("📅 Calendar event successfully created and synchronized!", "success");
        setNewCalEvent({ summary: "", description: "", startTime: "", endTime: "" });
        fetchCalendarData();
      } else {
        throw new Error("Failed to insert calendar event.");
      }
    } catch (err) {
      console.error(err);
      showToast("Error creating calendar event.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerCalendarAI = async () => {
    if (!googleAccessToken) return;
    setIsOptimizingCalendar(true);
    try {
      const activeClutchTasks = tasks.filter(t => t.status !== "completed");
      const mappedCalEvents = calendarEvents.map(e => ({
        title: e.summary,
        start: e.start.dateTime || e.start.date,
        end: e.end.dateTime || e.end.date
      }));

      const res = await authenticatedFetch("/api/workspace/ai/optimize-schedule", {
        method: "POST",
        body: JSON.stringify({
          tasks: activeClutchTasks,
          calendarEvents: mappedCalEvents
        })
      });

      const data = await res.json();
      if (data.recommendedBlocks) {
        setAiOptimizedSchedule(data.recommendedBlocks);
        showToast("⚡ Gemini generated an optimal productivity schedule around your events!", "success");
      } else {
        throw new Error("No schedule returned.");
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to optimize calendar schedule.", "error");
    } finally {
      setIsOptimizingCalendar(false);
    }
  };

  const pushOptimizedBlockToGoogleCalendar = async (block: { title: string; startTime: string; endTime: string }) => {
    if (!googleAccessToken) return;
    try {
      // Map today's HH:MM to actual local Date ISO string
      const today = new Date();
      const [sh, sm] = block.startTime.split(":");
      const [eh, em] = block.endTime.split(":");

      const startDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), Number(sh), Number(sm));
      const endDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), Number(eh), Number(em));

      const eventBody = {
        summary: `🎯 [Focus] ${block.title}`,
        description: "ClutchAI Scheduled Focus Sprint Block",
        start: { dateTime: startDate.toISOString() },
        end: { dateTime: endDate.toISOString() }
      };

      const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(eventBody)
      });

      if (res.ok) {
        showToast(`Synced "${block.title}" to your calendar!`, "success");
        fetchCalendarData();
      } else {
        throw new Error();
      }
    } catch (err) {
      showToast("Error syncing block to calendar.", "error");
    }
  };

  // -------------------------------------------------------------
  // 2. GMAIL INBOX CONTROLLERS
  // -------------------------------------------------------------
  const fetchGmailData = async () => {
    if (!googleAccessToken) return;
    setIsLoading(true);
    try {
      // List last 10 messages from Inbox
      const listUrl = "https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=8&q=label:INBOX";
      const res = await fetch(listUrl, {
        headers: { Authorization: `Bearer ${googleAccessToken}` }
      });
      const listData = await res.json();

      if (listData.messages && listData.messages.length > 0) {
        const fullMessages = await Promise.all(
          listData.messages.map(async (msg: { id: string }) => {
            const detailUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`;
            const detailRes = await fetch(detailUrl, {
              headers: { Authorization: `Bearer ${googleAccessToken}` }
            });
            const detailData = await detailRes.json();

            // Extract headers
            const headers = detailData.payload.headers;
            const subjectHeader = headers.find((h: any) => h.name.toLowerCase() === "subject");
            const fromHeader = headers.find((h: any) => h.name.toLowerCase() === "from");
            const dateHeader = headers.find((h: any) => h.name.toLowerCase() === "date");

            const isUnread = detailData.labelIds.includes("UNREAD");

            // Extract snippet or body content
            let body = detailData.snippet;
            if (detailData.payload.parts && detailData.payload.parts[0]) {
              body = detailData.payload.parts[0].body.data 
                ? atob(detailData.payload.parts[0].body.data.replace(/-/g, '+').replace(/_/g, '/'))
                : detailData.snippet;
            }

            return {
              id: msg.id,
              threadId: detailData.threadId,
              sender: fromHeader ? fromHeader.value : "Unknown Sender",
              subject: subjectHeader ? subjectHeader.value : "No Subject",
              snippet: detailData.snippet || "No preview description available.",
              body: body,
              date: dateHeader ? new Date(dateHeader.value).toLocaleString() : "Unknown Date",
              isUnread: isUnread
            };
          })
        );
        setEmails(fullMessages);
      } else {
        setEmails([]);
      }
    } catch (err) {
      console.error("Failed to fetch Gmail data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSummarizeEmail = async (email: GmailMessage) => {
    setActiveEmail(email);
    setIsSummarizingEmail(true);
    setEmailSummary(null);
    try {
      const res = await authenticatedFetch("/api/workspace/ai/summarize-email", {
        method: "POST",
        body: JSON.stringify({
          subject: email.subject,
          sender: email.sender,
          body: email.body || email.snippet
        })
      });
      const data = await res.json();
      if (data.summary) {
        setEmailSummary(data);
      } else {
        throw new Error();
      }
    } catch (err) {
      showToast("Failed to run smart AI email summarizer.", "error");
    } finally {
      setIsSummarizingEmail(false);
    }
  };

  const handleEnhanceEmailWithAI = async () => {
    if (!newEmail.aiPrompt) {
      showToast("Please enter some brief notes for Gemini to draft.", "error");
      return;
    }
    setIsGeneratingDraft(true);
    try {
      const res = await authenticatedFetch("/api/workspace/ai/draft-email", {
        method: "POST",
        body: JSON.stringify({
          prompt: newEmail.aiPrompt,
          recipient: newEmail.to,
          subject: newEmail.subject,
          originalContent: activeEmail ? `Sender: ${activeEmail.sender}\nSubject: ${activeEmail.subject}\nSnippet: ${activeEmail.snippet}` : undefined
        })
      });
      const data = await res.json();
      if (data.body) {
        setNewEmail(prev => ({
          ...prev,
          subject: data.subject || prev.subject,
          body: data.body
        }));
        showToast("⚡ Gemini generated a polite, professional draft email!", "success");
      }
    } catch (err) {
      showToast("Failed to draft email with AI.", "error");
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleSendEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleAccessToken) return;
    if (!newEmail.to || !newEmail.subject || !newEmail.body) {
      showToast("Recipient, subject, and body are required.", "error");
      return;
    }

    // Explicit confirmation for destructive / outgoing mutative actions
    const confirmed = window.confirm(`Are you sure you want to send this email to ${newEmail.to}?`);
    if (!confirmed) return;

    try {
      setIsLoading(true);

      // Construct raw MIME email format for Gmail API
      const mailString = [
        `To: ${newEmail.to}`,
        'Content-Type: text/plain; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: ${newEmail.subject}`,
        '',
        newEmail.body
      ].join('\n');

      const encodedMail = btoa(unescape(encodeURIComponent(mailString)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      const res = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ raw: encodedMail })
      });

      if (res.ok) {
        showToast("📨 Email sent successfully through Gmail!", "success");
        setNewEmail({ to: "", subject: "", body: "", aiPrompt: "" });
        setActiveEmail(null);
        fetchGmailData();
      } else {
        throw new Error();
      }
    } catch (err) {
      showToast("Error sending email.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // 3. GOOGLE TASKS CONTROLLERS
  // -------------------------------------------------------------
  const fetchTasksLists = async () => {
    if (!googleAccessToken) return;
    try {
      const res = await fetch("https://tasks.googleapis.com/tasks/v1/users/@me/lists", {
        headers: { Authorization: `Bearer ${googleAccessToken}` }
      });
      const data = await res.json();
      if (data.items && data.items.length > 0) {
        setTaskLists(data.items);
        setSelectedTaskListId(data.items[0].id);
        fetchGoogleTasks(data.items[0].id);
      }
    } catch (err) {
      console.error("Failed to fetch task lists:", err);
    }
  };

  const fetchGoogleTasks = async (listId: string) => {
    if (!googleAccessToken || !listId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${listId}/tasks`, {
        headers: { Authorization: `Bearer ${googleAccessToken}` }
      });
      const data = await res.json();
      setGoogleTasksList(data.items || []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGoogleTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleAccessToken || !selectedTaskListId || !newGoogleTaskTitle) return;

    try {
      setIsLoading(true);
      const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${selectedTaskListId}/tasks`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ title: newGoogleTaskTitle })
      });

      if (res.ok) {
        showToast("Task pinned to Google Tasks list!", "success");
        setNewGoogleTaskTitle("");
        fetchGoogleTasks(selectedTaskListId);
      }
    } catch (err) {
      showToast("Error creating task in Google Tasks.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleGoogleTaskStatus = async (task: GoogleTask) => {
    if (!googleAccessToken || !selectedTaskListId) return;
    try {
      const newStatus = task.status === 'completed' ? 'needsAction' : 'completed';
      const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${selectedTaskListId}/tasks/${task.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        showToast("Google Task status updated!", "success");
        fetchGoogleTasks(selectedTaskListId);
      }
    } catch (err) {
      showToast("Error toggling Google Task status.", "error");
    }
  };

  const exportClutchTaskToGoogleTasks = async (clutchTask: Task) => {
    if (!googleAccessToken || !selectedTaskListId) {
      showToast("Connect to Google first to export.", "error");
      return;
    }
    try {
      setIsLoading(true);
      const res = await fetch(`https://tasks.googleapis.com/tasks/v1/lists/${selectedTaskListId}/tasks`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleAccessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          title: clutchTask.title,
          notes: clutchTask.description || `Priority: ${clutchTask.priority}. Deadline: ${clutchTask.deadline}`
        })
      });

      if (res.ok) {
        showToast(`Exported "${clutchTask.title}" successfully to Google Tasks!`, "success");
        fetchGoogleTasks(selectedTaskListId);
      }
    } catch (err) {
      showToast("Export failed.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  const importGoogleTaskToClutch = async (gTask: GoogleTask) => {
    try {
      setIsLoading(true);
      await onAddTask({
        title: gTask.title,
        description: gTask.notes || "Imported from Google Tasks.",
        category: "Imported",
        deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Default: Tomorrow
        estimatedHours: 1,
        priority: "medium"
      });
      showToast(`Imported "${gTask.title}" into Clutch Workspace!`, "success");
    } catch (err) {
      showToast("Import failed.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  // -------------------------------------------------------------
  // 4. GOOGLE KEEP COMPONENT CONTROLLERS (LocalStorage/SaaS hybrid)
  // -------------------------------------------------------------
  const handleCreateKeepNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeepNote.title && !newKeepNote.content) {
      showToast("Note content cannot be empty.", "error");
      return;
    }

    const note: KeepNote = {
      id: `keep-${Date.now()}`,
      title: newKeepNote.title || "Untitled Note",
      content: newKeepNote.content,
      color: newKeepNote.color,
      isPinned: false,
      createdAt: new Date().toISOString()
    };

    setKeepNotes(prev => [note, ...prev]);
    setNewKeepNote({ title: "", content: "", color: "yellow" });
    showToast("Keep note saved in workspace board!", "success");
  };

  const handleTogglePinNote = (id: string) => {
    setKeepNotes(prev => prev.map(n => n.id === id ? { ...n, isPinned: !n.isPinned } : n));
  };

  const handleDeleteKeepNote = (id: string) => {
    if (window.confirm("Remove this Keep Note from your workspace board?")) {
      setKeepNotes(prev => prev.filter(n => n.id !== id));
      showToast("Note cleared.", "info");
    }
  };

  const handleAIKeepNoteExtractor = async (note: KeepNote) => {
    setIsExtractingNote(note.id);
    try {
      const res = await authenticatedFetch("/api/workspace/ai/extract-keep-note", {
        method: "POST",
        body: JSON.stringify({
          title: note.title,
          content: note.content
        })
      });
      const data = await res.json();
      if (data.tasks && data.tasks.length > 0) {
        for (const extractedTask of data.tasks) {
          await onAddTask({
            title: extractedTask.title,
            description: extractedTask.description || "Extracted from Keep notes.",
            category: extractedTask.category || "General",
            deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 Days from now
            estimatedHours: extractedTask.estimatedHours || 1,
            priority: extractedTask.priority || "medium"
          });
        }
        showToast(`🔮 Extracted and scheduled ${data.tasks.length} Clutch tasks from Note!`, "success");
      } else {
        showToast("No actionable tasks identified in this note.", "info");
      }
    } catch (err) {
      showToast("Error extracting note tasks.", "error");
    } finally {
      setIsExtractingNote(null);
    }
  };

  // -------------------------------------------------------------
  // GENERAL SUBTAB NAVIGATION
  // -------------------------------------------------------------
  const subTabs = [
    { id: "calendar", name: "Google Calendar", icon: Calendar, badge: calendarEvents.length > 0 ? `${calendarEvents.length} Events` : "Active" },
    { id: "gmail", name: "Gmail Inbox", icon: Mail, badge: emails.filter(e => e.isUnread).length > 0 ? `${emails.filter(e => e.isUnread).length} Unread` : "Synced" },
    { id: "tasks", name: "Google Tasks", icon: CheckSquare, badge: googleTasksList.length > 0 ? `${googleTasksList.length} Tasks` : "Direct Connect" },
    { id: "keep", name: "Google Keep", icon: FileText, badge: "Inspiration Board" }
  ] as const;

  // Unauthenticated Connection Gate
  if (!googleAccessToken) {
    return (
      <div className="bg-white border border-zinc-200/80 rounded-3xl p-10 shadow-lg flex flex-col items-center justify-center text-center max-w-2xl mx-auto my-12 relative overflow-hidden">
        {/* Ambient Decorative glow */}
        <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-indigo-50 rounded-full blur-[80px] pointer-events-none"></div>

        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-md shadow-indigo-500/10 mb-6">
          <Sparkles className="h-7 w-7 text-white" />
        </div>

        <h2 className="text-xl font-bold tracking-tight text-zinc-900 font-display mb-2">Connect Google Workspace Tools</h2>
        <p className="text-xs text-zinc-500 max-w-md leading-relaxed mb-8">
          Unlock your real schedule! Link Google Calendar, Gmail, Google Keep, and Google Tasks with Clutch AI to build a seamless unified day helper.
        </p>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-2 gap-4 text-left w-full max-w-lg mb-8">
          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-150">
            <Calendar className="h-5 w-5 text-indigo-600 mb-2" />
            <h4 className="text-xs font-bold text-zinc-800">Calendar Planner</h4>
            <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">Map schedules, see conflicts, and deploy focus times easily.</p>
          </div>
          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-150">
            <Mail className="h-5 w-5 text-indigo-600 mb-2" />
            <h4 className="text-xs font-bold text-zinc-800">Gmail Assistant</h4>
            <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">Instantly summarize unread emails and draft responses.</p>
          </div>
          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-150">
            <CheckSquare className="h-5 w-5 text-indigo-600 mb-2" />
            <h4 className="text-xs font-bold text-zinc-800">Tasks Synchronizer</h4>
            <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">Bidirectional import and export between lists in 1-click.</p>
          </div>
          <div className="p-4 rounded-2xl bg-zinc-50 border border-zinc-150">
            <FileText className="h-5 w-5 text-indigo-600 mb-2" />
            <h4 className="text-xs font-bold text-zinc-800">Keep Board Integration</h4>
            <p className="text-[11px] text-zinc-500 mt-0.5 leading-relaxed">Sticky notes with custom AI extractors mapping your lists.</p>
          </div>
        </div>

        <button
          onClick={() => signInWithGoogle()}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 hover:from-indigo-400 hover:to-violet-500 text-white font-bold text-sm transition-all duration-300 shadow-md shadow-indigo-500/10 cursor-pointer"
        >
          <Sparkles className="h-4 w-4" />
          <span>Connect Google Workspace</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header with workspace status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-white border border-zinc-200 shadow-sm">
        <div className="flex gap-4.5 items-center">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center border border-indigo-100">
            <Sparkles className="h-5 w-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-900 tracking-tight flex items-center gap-1.5">
              Google Workspace Hub
            </h2>
            <p className="text-xs text-zinc-500">
              Direct secure sync on Google Calendar, Gmail, Tasks and Keep.
            </p>
          </div>
        </div>

        {/* Sync Status Badge */}
        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100/80 px-3.5 py-1.5 rounded-full shadow-sm text-xs text-indigo-700 font-bold">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Google Sync: ACTIVE</span>
        </div>
      </div>

      {/* 2. Horizontal Subtab bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {subTabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`flex items-center justify-between p-3 px-4 rounded-xl transition-all duration-300 border text-left cursor-pointer ${
                isActive 
                  ? "bg-white border-zinc-300 text-zinc-900 font-bold shadow-md shadow-zinc-100 scale-[1.01]" 
                  : "bg-zinc-50/50 border-zinc-200 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`h-4.5 w-4.5 ${isActive ? "text-indigo-600" : "text-zinc-400"}`} />
                <span className="text-xs">{tab.name}</span>
              </div>
              <span className={`px-1.5 py-0.5 rounded-md text-[9px] font-mono ${isActive ? "bg-indigo-50 text-indigo-600 font-bold" : "bg-zinc-200/60 text-zinc-500"}`}>
                {tab.badge}
              </span>
            </button>
          );
        })}
      </div>

      {/* 3. Subtab Content Area */}
      <div className="bg-white border border-zinc-200 rounded-3xl shadow-sm p-6 relative min-h-[400px]">
        {isLoading && (
          <div className="absolute inset-0 bg-white/80 z-20 flex items-center justify-center backdrop-blur-[1px]">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-indigo-600 animate-spin" />
              <span className="text-xs font-mono font-bold text-zinc-500 uppercase tracking-widest">Syncing Google Account...</span>
            </div>
          </div>
        )}

        {/* SUBTAB 1: GOOGLE CALENDAR */}
        {activeSubTab === "calendar" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-zinc-100 pb-5">
              <div>
                <h3 className="text-sm font-bold text-zinc-850 flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-indigo-600" />
                  Primary Calendar Schedule
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">Keep track of your client events, meetings, and upcoming daily agendas.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchCalendarData}
                  className="p-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors text-zinc-500"
                  title="Force Reload Calendar"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
                <button
                  onClick={handleTriggerCalendarAI}
                  disabled={isOptimizingCalendar}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs transition-colors border-none cursor-pointer"
                >
                  {isOptimizingCalendar ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                  )}
                  <span>AI Optimize Agenda</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Event Lists (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-bold mb-2">Today's Schedule</h4>
                
                {calendarEvents.length === 0 ? (
                  <div className="py-12 border border-dashed border-zinc-200 rounded-2xl flex flex-col items-center justify-center text-center p-4">
                    <Calendar className="h-8 w-8 text-zinc-300 mb-2" />
                    <p className="text-xs font-semibold text-zinc-650">No events found on your Google Calendar today!</p>
                    <p className="text-[11px] text-zinc-400 mt-0.5">Use the Form on the right to schedule some upcoming slots.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {calendarEvents.map(event => {
                      const startTime = event.start.dateTime 
                        ? new Date(event.start.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                        : event.start.date || "All Day";
                      const endTime = event.end.dateTime 
                        ? new Date(event.end.dateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) 
                        : "All Day";

                      return (
                        <div key={event.id} className="p-3.5 rounded-xl border border-zinc-200/80 bg-zinc-50/60 hover:bg-zinc-150/30 transition-colors flex items-start justify-between gap-4">
                          <div className="flex gap-3 items-start min-w-0">
                            <div className="p-2 rounded-lg bg-indigo-50 border border-indigo-100/50 text-indigo-600 flex-shrink-0">
                              <Clock className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <h5 className="text-xs font-bold text-zinc-800 truncate">{event.summary}</h5>
                              <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-1">{event.description || "No description provided."}</p>
                              <span className="text-[10px] font-mono text-indigo-600 font-bold mt-1 inline-block bg-indigo-50 px-2 py-0.5 rounded">
                                {startTime} - {endTime}
                              </span>
                            </div>
                          </div>
                          {event.htmlLink && (
                            <a 
                              href={event.htmlLink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="p-1.5 rounded-lg text-zinc-400 hover:text-indigo-600 hover:bg-zinc-100 transition-all flex-shrink-0"
                              title="Open in Google Calendar"
                            >
                              <ArrowUpRight className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* AI Optimized Schedule Panel */}
                {aiOptimizedSchedule && (
                  <div className="p-5 rounded-2xl bg-indigo-50 border border-indigo-100 space-y-4 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-4.5 w-4.5 text-indigo-600" />
                        <h4 className="text-xs font-bold text-indigo-900 tracking-tight">AI Recommended Focus Timeline</h4>
                      </div>
                      <button 
                        onClick={() => setAiOptimizedSchedule(null)}
                        className="text-[10px] text-indigo-500 font-semibold hover:underline bg-transparent border-none cursor-pointer"
                      >
                        Reset Suggestion
                      </button>
                    </div>

                    <div className="space-y-3">
                      {aiOptimizedSchedule.map((block, idx) => (
                        <div key={idx} className="p-3 bg-white border border-indigo-100/80 rounded-xl flex items-center justify-between gap-4 shadow-sm">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                {block.startTime} - {block.endTime}
                              </span>
                              <h5 className="text-xs font-bold text-zinc-800">{block.title}</h5>
                            </div>
                            <p className="text-[10px] text-zinc-500 mt-1">{block.reason}</p>
                          </div>
                          
                          <button
                            onClick={() => pushOptimizedBlockToGoogleCalendar(block)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[10px] transition-all border-none cursor-pointer shadow-sm"
                          >
                            <span>Add to Calendar</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Quick Event Planner Form (5 cols) */}
              <div className="lg:col-span-5 bg-zinc-50 border border-zinc-200 rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-500 font-bold">New Agenda Slot</h4>
                
                <form onSubmit={handleCreateCalendarEvent} className="space-y-3.5">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold mb-1">Event Summary</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Design Sync & Brainstorm"
                      value={newCalEvent.summary}
                      onChange={(e) => setNewCalEvent({ ...newCalEvent, summary: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-lg border border-zinc-200 bg-white focus:border-indigo-500 focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold mb-1">Description (Optional)</label>
                    <textarea
                      placeholder="Agendas, Google Meet link details, notes..."
                      value={newCalEvent.description}
                      onChange={(e) => setNewCalEvent({ ...newCalEvent, description: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-lg border border-zinc-200 bg-white focus:border-indigo-500 focus:outline-none h-16 resize-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold mb-1">Starts</label>
                      <input
                        type="datetime-local"
                        required
                        value={newCalEvent.startTime}
                        onChange={(e) => setNewCalEvent({ ...newCalEvent, startTime: e.target.value })}
                        className="w-full text-[11px] p-2 rounded-lg border border-zinc-200 bg-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold mb-1">Ends</label>
                      <input
                        type="datetime-local"
                        required
                        value={newCalEvent.endTime}
                        onChange={(e) => setNewCalEvent({ ...newCalEvent, endTime: e.target.value })}
                        className="w-full text-[11px] p-2 rounded-lg border border-zinc-200 bg-white focus:border-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition-all border-none shadow-sm flex items-center justify-center gap-1.5 cursor-pointer mt-4"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create Event</span>
                  </button>
                </form>
              </div>

            </div>
          </div>
        )}

        {/* SUBTAB 2: GMAIL INBOX */}
        {activeSubTab === "gmail" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-zinc-100 pb-5">
              <div>
                <h3 className="text-sm font-bold text-zinc-850 flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-indigo-600" />
                  Gmail Inbox & Digest Assistant
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">Summary-focused email viewer to stay unblocked without email swamp overload.</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={fetchGmailData}
                  className="p-2 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors text-zinc-500"
                  title="Reload Emails"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Emails List (7 cols) */}
              <div className="lg:col-span-7 space-y-3">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search recent emails..."
                    value={emailSearch}
                    onChange={(e) => setEmailSearch(e.target.value)}
                    className="w-full text-xs pl-9 pr-4 py-2 rounded-xl border border-zinc-200 focus:border-indigo-500 focus:outline-none bg-zinc-50"
                  />
                </div>

                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
                  {emails.length === 0 ? (
                    <div className="py-12 text-center text-zinc-450 border border-dashed border-zinc-150 rounded-2xl">
                      <Mail className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
                      <p className="text-xs font-semibold">No emails found in your primary inbox!</p>
                    </div>
                  ) : (
                    emails
                      .filter(email => 
                        email.subject.toLowerCase().includes(emailSearch.toLowerCase()) || 
                        email.sender.toLowerCase().includes(emailSearch.toLowerCase())
                      )
                      .map(email => (
                        <div
                          key={email.id}
                          onClick={() => handleSummarizeEmail(email)}
                          className={`p-3.5 rounded-xl border transition-all duration-200 cursor-pointer text-left flex flex-col gap-1.5 relative ${
                            activeEmail?.id === email.id
                              ? "bg-indigo-50/50 border-indigo-200/80 ring-1 ring-indigo-200"
                              : "bg-white border-zinc-150 hover:border-zinc-250 hover:shadow-sm"
                          }`}
                        >
                          {email.isUnread && (
                            <span className="absolute top-4 right-4 h-2 w-2 rounded-full bg-indigo-600"></span>
                          )}

                          <div className="flex items-center justify-between gap-4">
                            <span className="text-[11px] font-bold text-zinc-800 truncate max-w-[200px]">{email.sender}</span>
                            <span className="text-[10px] font-mono text-zinc-400">{email.date.split(",")[0]}</span>
                          </div>
                          
                          <h5 className={`text-xs truncate ${email.isUnread ? "font-bold text-zinc-900" : "font-medium text-zinc-700"}`}>
                            {email.subject}
                          </h5>
                          
                          <p className="text-[10px] text-zinc-400 line-clamp-1 leading-normal">{email.snippet}</p>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Detailed Email Drawer & Reply AI Box (5 cols) */}
              <div className="lg:col-span-5 bg-zinc-50 border border-zinc-200 rounded-2xl p-5 space-y-4">
                
                {activeEmail ? (
                  <div className="space-y-4">
                    <div className="border-b border-zinc-200 pb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-zinc-400">EMAIL READER</span>
                        <button 
                          onClick={() => { setActiveEmail(null); setEmailSummary(null); }}
                          className="text-[10px] font-bold text-zinc-400 hover:text-rose-500 bg-transparent border-none cursor-pointer"
                        >
                          Clear
                        </button>
                      </div>
                      <h4 className="text-xs font-bold text-zinc-800 tracking-tight mt-1">{activeEmail.subject}</h4>
                      <p className="text-[10px] text-zinc-400 mt-0.5">From: {activeEmail.sender}</p>
                    </div>

                    {/* AI Smart Summary Panel */}
                    {isSummarizingEmail ? (
                      <div className="p-4 rounded-xl bg-white border border-indigo-100 flex flex-col items-center justify-center text-center gap-2">
                        <RefreshCw className="h-4 w-4 text-indigo-600 animate-spin" />
                        <span className="text-[10px] font-mono font-bold text-indigo-600">GEMINI SUMMARIZING...</span>
                      </div>
                    ) : emailSummary ? (
                      <div className="p-4.5 rounded-xl bg-white border border-indigo-100/80 space-y-3 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded text-indigo-700 font-bold">
                            {emailSummary.tone}
                          </span>
                          <span className="text-[10px] text-zinc-400 flex items-center gap-1 font-mono">
                            <Sparkles className="h-3 w-3 text-indigo-500" />
                            Gemini AI
                          </span>
                        </div>

                        <div className="space-y-1">
                          <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">AI Summary</p>
                          <ul className="list-disc pl-4 text-[11px] text-zinc-650 leading-relaxed space-y-1">
                            {emailSummary.summary.map((point, index) => (
                              <li key={index}>{point}</li>
                            ))}
                          </ul>
                        </div>

                        <div className="space-y-1.5 border-t border-zinc-100 pt-3">
                          <div className="flex items-center justify-between">
                            <p className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold">AI Smart Reply</p>
                            <button
                              onClick={() => {
                                setNewEmail(prev => ({
                                  ...prev,
                                  to: activeEmail.sender.match(/<([^>]+)>/)?.[1] || activeEmail.sender,
                                  subject: `Re: ${activeEmail.subject}`,
                                  body: emailSummary.replyDraft
                                }));
                                showToast("Smart Reply loaded in Composer below!", "success");
                              }}
                              className="text-[10px] text-indigo-600 hover:underline font-bold bg-transparent border-none cursor-pointer"
                            >
                              Load in Composer
                            </button>
                          </div>
                          <div className="p-2.5 rounded-lg bg-zinc-50 border border-zinc-250 text-[10px] text-zinc-600 font-mono leading-relaxed max-h-32 overflow-y-auto whitespace-pre-line">
                            {emailSummary.replyDraft}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 bg-white border border-zinc-200 rounded-xl max-h-36 overflow-y-auto text-[11px] text-zinc-600 leading-relaxed whitespace-pre-line">
                        {activeEmail.body || activeEmail.snippet}
                      </div>
                    )}

                    {/* Compose Quick Email Reply Form */}
                    <div className="space-y-3 border-t border-zinc-200 pt-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest font-bold">Quick Reply Composer</span>
                        <span className="text-[10px] text-indigo-600 font-bold flex items-center gap-1">
                          <Sparkles className="h-3 w-3" />
                          Gemini Assisted
                        </span>
                      </div>

                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Recipient email address"
                          value={newEmail.to}
                          onChange={(e) => setNewEmail({ ...newEmail, to: e.target.value })}
                          className="w-full text-xs p-2 rounded-lg border border-zinc-200 focus:outline-none focus:border-indigo-500 bg-white"
                        />
                        <input
                          type="text"
                          placeholder="Email subject"
                          value={newEmail.subject}
                          onChange={(e) => setNewEmail({ ...newEmail, subject: e.target.value })}
                          className="w-full text-xs p-2 rounded-lg border border-zinc-200 focus:outline-none focus:border-indigo-500 bg-white"
                        />

                        {/* AI drafting helper */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="Briefly notes to draft: e.g. accept proposal but push time by 1 hour"
                            value={newEmail.aiPrompt}
                            onChange={(e) => setNewEmail({ ...newEmail, aiPrompt: e.target.value })}
                            className="flex-1 text-[11px] p-2 rounded-lg border border-zinc-200 bg-white"
                          />
                          <button
                            type="button"
                            onClick={handleEnhanceEmailWithAI}
                            disabled={isGeneratingDraft}
                            className="p-2 px-3 rounded-lg bg-indigo-50 text-indigo-600 text-[10px] font-bold border-none cursor-pointer flex items-center gap-1 hover:bg-indigo-100 transition-all"
                          >
                            {isGeneratingDraft ? <RefreshCw className="h-3 w-3 animate-spin text-indigo-600" /> : <Sparkles className="h-3 w-3" />}
                            <span>Draft AI</span>
                          </button>
                        </div>

                        <textarea
                          placeholder="Compose your email body..."
                          value={newEmail.body}
                          onChange={(e) => setNewEmail({ ...newEmail, body: e.target.value })}
                          className="w-full text-xs p-2 rounded-lg border border-zinc-200 focus:outline-none focus:border-indigo-500 bg-white h-24 resize-none"
                        />
                      </div>

                      <button
                        onClick={handleSendEmail}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 transition-colors border-none shadow-sm cursor-pointer"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>Send Email</span>
                      </button>
                    </div>

                  </div>
                ) : (
                  <div className="py-24 text-center text-zinc-400">
                    <BookOpen className="h-8 w-8 text-zinc-300 mx-auto mb-2" />
                    <p className="text-xs font-semibold">Select an email to view detail summaries</p>
                    <p className="text-[10px] text-zinc-400 mt-0.5 leading-relaxed">Gemini will automatically parse context and suggest response drafts instantly.</p>
                  </div>
                )}

              </div>

            </div>
          </div>
        )}

        {/* SUBTAB 3: GOOGLE TASKS */}
        {activeSubTab === "tasks" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-zinc-100 pb-5">
              <div>
                <h3 className="text-sm font-bold text-zinc-850 flex items-center gap-1.5">
                  <CheckSquare className="h-4 w-4 text-indigo-600" />
                  Google Tasks Direct Connector
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">Bidirectional syncing engine to import and export your tasks.</p>
              </div>

              <div className="flex items-center gap-3">
                <select
                  value={selectedTaskListId}
                  onChange={(e) => {
                    setSelectedTaskListId(e.target.value);
                    fetchGoogleTasks(e.target.value);
                  }}
                  className="text-xs p-2.5 rounded-xl border border-zinc-200 bg-white focus:outline-none focus:border-indigo-500"
                >
                  {taskLists.map(list => (
                    <option key={list.id} value={list.id}>{list.title}</option>
                  ))}
                </select>

                <button
                  onClick={() => fetchGoogleTasks(selectedTaskListId)}
                  className="p-2.5 rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors text-zinc-500"
                  title="Reload Google Tasks"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Google Tasks List (6 cols) */}
              <div className="lg:col-span-6 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-bold">Google Tasks Checkbox List</h4>
                  <span className="text-[10px] bg-zinc-100 text-zinc-500 px-2 py-0.5 rounded font-bold font-mono">
                    {googleTasksList.filter(t => t.status === "needsAction").length} Active
                  </span>
                </div>

                <form onSubmit={handleCreateGoogleTask} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    placeholder="Create a task inside Google Tasks..."
                    required
                    value={newGoogleTaskTitle}
                    onChange={(e) => setNewGoogleTaskTitle(e.target.value)}
                    className="flex-1 text-xs p-2.5 rounded-lg border border-zinc-200 focus:outline-none focus:border-indigo-500 bg-white"
                  />
                  <button
                    type="submit"
                    className="p-2.5 px-4 rounded-lg bg-zinc-800 text-white font-bold text-xs transition-colors border-none cursor-pointer flex items-center justify-center gap-1 shadow-sm hover:bg-zinc-700"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Pin</span>
                  </button>
                </form>

                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {googleTasksList.length === 0 ? (
                    <div className="py-12 text-center text-zinc-400 border border-dashed border-zinc-150 rounded-2xl p-4">
                      <p className="text-xs font-semibold">No tasks found in this Google Task list.</p>
                    </div>
                  ) : (
                    googleTasksList.map(gTask => {
                      const isCompleted = gTask.status === "completed";
                      return (
                        <div
                          key={gTask.id}
                          className="p-3 bg-zinc-50/60 border border-zinc-200/80 rounded-xl flex items-center justify-between gap-4"
                        >
                          <div className="flex gap-3 items-center min-w-0">
                            <button
                              onClick={() => handleToggleGoogleTaskStatus(gTask)}
                              className={`h-4.5 w-4.5 rounded-md border flex items-center justify-center cursor-pointer flex-shrink-0 bg-transparent transition-all ${
                                isCompleted 
                                  ? "bg-indigo-600 border-indigo-600 text-white" 
                                  : "border-zinc-350 hover:border-indigo-500"
                              }`}
                            >
                              {isCompleted && <Check className="h-3 w-3 text-white font-black" />}
                            </button>
                            <div className="min-w-0">
                              <p className={`text-xs font-semibold text-zinc-800 truncate ${isCompleted ? "line-through text-zinc-400" : ""}`}>
                                {gTask.title}
                              </p>
                              {gTask.notes && (
                                <p className="text-[9px] text-zinc-400 truncate max-w-sm mt-0.5">{gTask.notes}</p>
                              )}
                            </div>
                          </div>

                          <button
                            onClick={() => importGoogleTaskToClutch(gTask)}
                            className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:underline bg-transparent border-none cursor-pointer"
                            title="Import to Clutch Daily Checklist"
                          >
                            <span>Import</span>
                            <ChevronRight className="h-3 w-3" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Clutch Sync Export Hub (6 cols) */}
              <div className="lg:col-span-6 bg-zinc-50 border border-zinc-200 rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-bold mb-2">Clutch Task Export Console</h4>
                <p className="text-[10px] text-zinc-500 leading-relaxed leading-normal">
                  Send active Clutch workspace daily tasks to your Google Tasks account instantly to track goals on your mobile widget or Gmail app seamlessly.
                </p>

                <div className="space-y-2.5 max-h-[350px] overflow-y-auto pr-1">
                  {tasks.filter(t => t.status !== "completed").length === 0 ? (
                    <div className="py-12 text-center text-zinc-400 bg-white border border-dashed border-zinc-150 rounded-2xl">
                      <p className="text-xs font-semibold">No active Clutch tasks to export.</p>
                    </div>
                  ) : (
                    tasks
                      .filter(t => t.status !== "completed")
                      .map(cTask => (
                        <div
                          key={cTask.id}
                          className="p-3 bg-white border border-zinc-200 rounded-xl flex items-center justify-between gap-4 shadow-sm"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                cTask.priority === "high" 
                                  ? "bg-rose-500" 
                                  : cTask.priority === "medium" 
                                    ? "bg-amber-500" 
                                    : "bg-emerald-500"
                              }`}></span>
                              <h5 className="text-xs font-bold text-zinc-800 truncate">{cTask.title}</h5>
                            </div>
                            <p className="text-[9px] text-zinc-400 mt-1 truncate max-w-xs">{cTask.description || "No description."}</p>
                          </div>

                          <button
                            onClick={() => exportClutchTaskToGoogleTasks(cTask)}
                            className="flex items-center gap-1 py-1.5 px-3 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-white text-[10px] font-bold border-none transition-all cursor-pointer shadow-sm"
                          >
                            <span>Export</span>
                            <ArrowUpRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                  )}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* SUBTAB 4: GOOGLE KEEP */}
        {activeSubTab === "keep" && (
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-zinc-100 pb-5">
              <div>
                <h3 className="text-sm font-bold text-zinc-850 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-indigo-600" />
                  Google Keep Inspiration Board
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">Capture instant thoughts, notes, checklist snippets, and extract Clutch tasks using AI.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Note creator (4 cols) */}
              <div className="lg:col-span-4 bg-zinc-50 border border-zinc-200 rounded-2xl p-5 space-y-4">
                <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-500 font-bold">New Workspace Note</h4>
                
                <form onSubmit={handleCreateKeepNote} className="space-y-3">
                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold mb-1">Title</label>
                    <input
                      type="text"
                      placeholder="Title of your note..."
                      value={newKeepNote.title}
                      onChange={(e) => setNewKeepNote({ ...newKeepNote, title: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-lg border border-zinc-200 bg-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold mb-1">Note Content</label>
                    <textarea
                      placeholder="Start capturing list or thoughts here..."
                      value={newKeepNote.content}
                      onChange={(e) => setNewKeepNote({ ...newKeepNote, content: e.target.value })}
                      className="w-full text-xs p-2.5 rounded-lg border border-zinc-200 bg-white focus:outline-none focus:border-indigo-500 h-28 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono uppercase tracking-wider text-zinc-400 font-bold mb-1.5">Color Theme</label>
                    <div className="flex items-center gap-2">
                      {colors.map(color => (
                        <button
                          key={color.name}
                          type="button"
                          onClick={() => setNewKeepNote({ ...newKeepNote, color: color.name })}
                          className={`h-6.5 w-6.5 rounded-full border-2 cursor-pointer transition-all ${
                            newKeepNote.color === color.name 
                              ? "border-zinc-800 scale-110 shadow-sm" 
                              : "border-transparent"
                          } ${color.bg.split(" ")[0]}`}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2 px-4 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs transition-all border-none flex items-center justify-center gap-1.5 cursor-pointer mt-4"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Save Keep Note</span>
                  </button>
                </form>
              </div>

              {/* Note cards grid (8 cols) */}
              <div className="lg:col-span-8 space-y-4">
                <h4 className="text-xs font-mono uppercase tracking-wider text-zinc-400 font-bold">Workspace Sticky Cards</h4>

                {keepNotes.length === 0 ? (
                  <div className="py-24 border border-dashed border-zinc-200 rounded-3xl flex flex-col items-center justify-center text-center p-4">
                    <p className="text-xs font-semibold text-zinc-650">No keep notes captured yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {keepNotes
                      .sort((a, b) => (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0))
                      .map(note => {
                        const activeColor = colors.find(c => c.name === note.color) || colors[0];
                        return (
                          <div
                            key={note.id}
                            className={`p-4.5 rounded-2xl border flex flex-col justify-between min-h-48 transition-all duration-300 hover:shadow-md hover:scale-[1.01] ${activeColor.bg}`}
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <h5 className="text-xs font-bold truncate pr-4">{note.title}</h5>
                                <button
                                  onClick={() => handleTogglePinNote(note.id)}
                                  className="text-zinc-400 hover:text-zinc-950 p-1 rounded-lg bg-white/40 hover:bg-white/70 border-none cursor-pointer"
                                  title={note.isPinned ? "Unpin Note" : "Pin Note"}
                                >
                                  <Pin className={`h-3.5 w-3.5 ${note.isPinned ? "fill-zinc-700 text-zinc-700" : ""}`} />
                                </button>
                              </div>
                              
                              <p className="text-[11px] font-medium leading-relaxed whitespace-pre-line text-zinc-700 max-h-32 overflow-y-auto pr-1">
                                {note.content}
                              </p>
                            </div>

                            <div className="flex items-center justify-between border-t border-zinc-900/10 pt-3.5 mt-4">
                              <button
                                onClick={() => handleAIKeepNoteExtractor(note)}
                                disabled={isExtractingNote !== null}
                                className="flex items-center gap-1.5 p-1 px-2.5 rounded-lg bg-white/80 hover:bg-white text-zinc-800 text-[10px] font-bold border border-zinc-200/50 cursor-pointer shadow-sm disabled:opacity-55"
                                title="Use Gemini AI to extract structured tasks from notes"
                              >
                                {isExtractingNote === note.id ? (
                                  <RefreshCw className="h-3.5 w-3.5 animate-spin text-indigo-600" />
                                ) : (
                                  <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                                )}
                                <span>AI Extract tasks</span>
                              </button>

                              <button
                                onClick={() => handleDeleteKeepNote(note.id)}
                                className="p-1.5 rounded-lg text-zinc-400 hover:text-rose-600 hover:bg-rose-50 border-none cursor-pointer bg-white/40"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
