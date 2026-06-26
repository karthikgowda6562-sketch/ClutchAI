import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { requireAuth, AuthRequest } from "./src/middleware/auth.ts";
import { db } from "./src/db/index.ts";
import { getOrCreateUser } from "./src/db/users.ts";
import { tasks, habits, schedule, stats, chatHistory } from "./src/db/schema.ts";
import { eq, and, asc } from "drizzle-orm";
import { Task, ScheduleBlock, CoachMessage, Habit, ProductivityStats } from "./src/types.ts";

dotenv.config();

function parseLLMJson(text: string | undefined, defaultValue: any = {}): any {
  if (!text) return defaultValue;
  
  let cleaned = text.trim();
  
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/, "").trim();
  }
  
  const firstBrace = cleaned.indexOf("{");
  const firstBracket = cleaned.indexOf("[");
  
  let startIdx = -1;
  let endIdx = -1;
  
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIdx = firstBrace;
    endIdx = cleaned.lastIndexOf("}");
  } else if (firstBracket !== -1) {
    startIdx = firstBracket;
    endIdx = cleaned.lastIndexOf("]");
  }
  
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    cleaned = cleaned.substring(startIdx, endIdx + 1);
  }
  
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    try {
      const sanitized = cleaned.replace(/,\s*([\]}])/g, '$1');
      return JSON.parse(sanitized);
    } catch (e2) {
      console.error("Failed to parse cleaned JSON:", cleaned, e);
      return defaultValue;
    }
  }
}

const app = express();
const PORT = 3000;

app.use(express.json());

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "dummy_key",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const isProd = process.env.NODE_ENV === "production";

function calculateTaskRisk(task: any): { score: number; reason: string } {
  if (task.status === 'completed') {
    return { score: 0, reason: "Task successfully completed." };
  }

  const hoursLeft = (new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60);
  
  if (hoursLeft <= 0) {
    return { score: 100, reason: "The deadline has already passed!" };
  }

  const complexityRatio = Number(task.estimatedHours) / hoursLeft;
  let score = 0;
  let reason = "";

  if (complexityRatio >= 1.5) {
    score = Math.min(99, 90 + Math.round((complexityRatio - 1.5) * 10));
    reason = `Critical risk! You have ${Math.round(hoursLeft * 10) / 10} hours left, but need ${task.estimatedHours} hours. Overload factor is high.`;
  } else if (complexityRatio >= 0.8) {
    score = Math.round(75 + (complexityRatio - 0.8) * 20);
    reason = `High risk. Estimated effort (${task.estimatedHours}h) closely matches remaining time (${Math.round(hoursLeft * 10) / 10}h). Start immediately!`;
  } else if (complexityRatio >= 0.4) {
    score = Math.round(45 + (complexityRatio - 0.4) * 75);
    reason = `Moderate risk. Time is tightening (${Math.round(hoursLeft * 10) / 10}h left for ${task.estimatedHours}h of work). Recommend breaking it down.`;
  } else {
    score = Math.max(5, Math.round(complexityRatio * 100));
    reason = `Low risk. Sufficient margin remains (${Math.round(hoursLeft * 10) / 10}h left for ${task.estimatedHours}h of work). Maintain steady pace.`;
  }

  if (task.priority === 'high') {
    score = Math.min(99, score + 10);
  }

  return { score, reason };
}

// ==========================================
// API ROUTES (Firebase Authenticated via requireAuth)
// ==========================================

app.get("/api/tasks", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(req.user!.uid, req.user!.email || "");
    const userTasks = await db.select().from(tasks).where(eq(tasks.userId, user.id));
    
    const updatedTasks = [];
    for (const t of userTasks) {
      const parsedSteps = Array.isArray(t.breakdownSteps) ? t.breakdownSteps : JSON.parse(t.breakdownSteps as string || "[]");
      const parsedArtifacts = Array.isArray(t.aiArtifacts) ? t.aiArtifacts : JSON.parse(t.aiArtifacts as string || "[]");
      
      const taskObj = {
        ...t,
        breakdownSteps: parsedSteps,
        aiArtifacts: parsedArtifacts,
      };
      const risk = calculateTaskRisk(taskObj);
      
      await db.update(tasks)
        .set({ riskScore: risk.score, riskReason: risk.reason })
        .where(eq(tasks.id, t.id));
        
      updatedTasks.push({
        ...taskObj,
        riskScore: risk.score,
        riskReason: risk.reason,
      });
    }
    
    res.json(updatedTasks);
  } catch (error: any) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: "Failed to fetch tasks.", details: error.message });
  }
});

app.post("/api/tasks", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(req.user!.uid, req.user!.email || "");
    const { title, description, category, deadline, estimatedHours, priority } = req.body;
    
    if (!title || !deadline || !estimatedHours) {
      return res.status(400).json({ error: "Title, deadline, and estimatedHours are required." });
    }

    const taskId = `task-${Date.now()}`;
    const newTask = {
      id: taskId,
      userId: user.id,
      title,
      description: description || "",
      category: category || "General",
      deadline,
      estimatedHours: String(estimatedHours),
      priority: priority || "medium",
      status: "pending",
      riskScore: 0,
      riskReason: "",
      breakdownSteps: [],
      aiArtifacts: [],
      emergencyPlanCreated: false
    };

    const risk = calculateTaskRisk(newTask);
    newTask.riskScore = risk.score;
    newTask.riskReason = risk.reason;

    await db.insert(tasks).values({
      ...newTask,
      breakdownSteps: JSON.stringify(newTask.breakdownSteps),
      aiArtifacts: JSON.stringify(newTask.aiArtifacts),
    });

    res.json(newTask);
  } catch (error: any) {
    console.error("Error creating task:", error);
    res.status(500).json({ error: "Failed to create task.", details: error.message });
  }
});

app.put("/api/tasks/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(req.user!.uid, req.user!.email || "");
    
    const existingTasks = await db.select().from(tasks).where(and(eq(tasks.id, req.params.id), eq(tasks.userId, user.id)));
    if (existingTasks.length === 0) {
      return res.status(404).json({ error: "Task not found." });
    }
    const currentTask = existingTasks[0];
    
    const title = req.body.title !== undefined ? req.body.title : currentTask.title;
    const description = req.body.description !== undefined ? req.body.description : currentTask.description;
    const category = req.body.category !== undefined ? req.body.category : currentTask.category;
    const deadline = req.body.deadline !== undefined ? req.body.deadline : currentTask.deadline;
    const estimatedHours = req.body.estimatedHours !== undefined ? String(req.body.estimatedHours) : currentTask.estimatedHours;
    const priority = req.body.priority !== undefined ? req.body.priority : currentTask.priority;
    const status = req.body.status !== undefined ? req.body.status : currentTask.status;
    const breakdownSteps = req.body.breakdownSteps !== undefined ? req.body.breakdownSteps : (typeof currentTask.breakdownSteps === 'string' ? JSON.parse(currentTask.breakdownSteps) : currentTask.breakdownSteps);
    const aiArtifacts = req.body.aiArtifacts !== undefined ? req.body.aiArtifacts : (typeof currentTask.aiArtifacts === 'string' ? JSON.parse(currentTask.aiArtifacts) : currentTask.aiArtifacts);
    const emergencyPlanCreated = req.body.emergencyPlanCreated !== undefined ? req.body.emergencyPlanCreated : currentTask.emergencyPlanCreated;

    const updatedTaskObj = {
      id: currentTask.id,
      userId: user.id,
      title,
      description,
      category,
      deadline,
      estimatedHours,
      priority,
      status,
      riskScore: 0,
      riskReason: "",
      breakdownSteps,
      aiArtifacts,
      emergencyPlanCreated,
    };

    const risk = calculateTaskRisk(updatedTaskObj);
    
    await db.update(tasks)
      .set({
        title,
        description,
        category,
        deadline,
        estimatedHours,
        priority,
        status,
        riskScore: risk.score,
        riskReason: risk.reason,
        breakdownSteps: Array.isArray(breakdownSteps) ? JSON.stringify(breakdownSteps) : breakdownSteps,
        aiArtifacts: Array.isArray(aiArtifacts) ? JSON.stringify(aiArtifacts) : aiArtifacts,
        emergencyPlanCreated,
      })
      .where(eq(tasks.id, req.params.id));

    if (status === 'completed' && currentTask.status !== 'completed') {
      const userStats = await db.select().from(stats).where(eq(stats.userId, user.id));
      if (userStats.length > 0) {
        const s = userStats[0];
        let newOnTime = s.onTimeCompletionRate;
        const isBeforeDeadline = new Date() < new Date(deadline);
        if (!isBeforeDeadline) {
          newOnTime = Math.max(10, s.onTimeCompletionRate - 5);
        } else {
          newOnTime = Math.min(100, s.onTimeCompletionRate + 2);
        }
        await db.update(stats)
          .set({
            tasksCompleted: s.tasksCompleted + 1,
            onTimeCompletionRate: newOnTime,
          })
          .where(eq(stats.userId, user.id));
      }
    }

    res.json({
      ...updatedTaskObj,
      riskScore: risk.score,
      riskReason: risk.reason,
    });
  } catch (error: any) {
    console.error("Error updating task:", error);
    res.status(500).json({ error: "Failed to update task.", details: error.message });
  }
});

app.delete("/api/tasks/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(req.user!.uid, req.user!.email || "");
    const result = await db.delete(tasks).where(and(eq(tasks.id, req.params.id), eq(tasks.userId, user.id))).returning();
    if (result.length === 0) {
      return res.status(404).json({ error: "Task not found." });
    }
    res.json({ success: true, message: "Task deleted successfully." });
  } catch (error: any) {
    console.error("Error deleting task:", error);
    res.status(500).json({ error: "Failed to delete task.", details: error.message });
  }
});

app.post("/api/tasks/:id/breakdown", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(req.user!.uid, req.user!.email || "");
    
    const existingTasks = await db.select().from(tasks).where(and(eq(tasks.id, req.params.id), eq(tasks.userId, user.id)));
    if (existingTasks.length === 0) {
      return res.status(404).json({ error: "Task not found." });
    }
    const task = existingTasks[0];

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY environment variable is not configured.");
    }

    const systemPrompt = `You are Clutch, an autonomous elite AI Executive Assistant. 
The user is struggling with starting a task. You MUST do two things:
1. Break down the task into 3-5 hyper-focused, manageable sequential steps. Each step must have a short concrete focus action, and a specific recommended duration in minutes.
2. Generate 1 or 2 high-fidelity STARTER WORK ARTIFACTS (such as a starter code file, template email, outline, or structural blueprint) that directly solves the cold-start procrastination problem. The user can copy this starter draft to begin immediately.

Respond strictly in a valid JSON format with the following keys:
{
  "steps": [
    { "text": "Step 1 text description...", "durationMinutes": 20 }
  ],
  "artifacts": [
    { "name": "Starter Template Filename / Document Name", "type": "code|email|outline|document|plan", "content": "Full starter document text, code, or template structure..." }
  ],
  "motivationalNudge": "A brief, highly direct, encouraging, high-agency mentor quote to spark prompt action."
}`;

    const prompt = `Please analyze the following task:
Title: "${task.title}"
Description: "${task.description}"
Category: "${task.category}"
Estimated Effort: ${task.estimatedHours} Hours
Deadline: ${task.deadline} (Time remaining: ${Math.round((new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60))} hours)

Create a highly logical step breakdown and beautiful starter draft materials to make starting effortless. Ensure the artifacts have actual, premium contents (not placeholders).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  text: { type: Type.STRING },
                  durationMinutes: { type: Type.INTEGER }
                },
                required: ["text", "durationMinutes"]
              }
            },
            artifacts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  type: { type: Type.STRING },
                  content: { type: Type.STRING }
                },
                required: ["name", "type", "content"]
              }
            },
            motivationalNudge: { type: Type.STRING }
          },
          required: ["steps", "artifacts", "motivationalNudge"]
        }
      }
    });

    const result = parseLLMJson(response.text, {});
    
    const formattedSteps = (result.steps || []).map((s: any, idx: number) => ({
      id: `step-${Date.now()}-${idx}`,
      text: s.text,
      durationMinutes: Number(s.durationMinutes) || 15,
      completed: false
    }));

    const formattedArtifacts = (result.artifacts || []).map((art: any, idx: number) => ({
      id: `art-${Date.now()}-${idx}`,
      name: art.name || "Starter Asset",
      type: art.type || "outline",
      content: art.content || ""
    }));

    await db.update(tasks)
      .set({
        breakdownSteps: JSON.stringify(formattedSteps),
        aiArtifacts: JSON.stringify(formattedArtifacts),
        status: 'in_progress',
      })
      .where(eq(tasks.id, task.id));

    const userStats = await db.select().from(stats).where(eq(stats.userId, user.id));
    if (userStats.length > 0) {
      await db.update(stats)
        .set({ aiBreakdownsUsed: userStats[0].aiBreakdownsUsed + 1 })
        .where(eq(stats.userId, user.id));
    }

    await db.insert(chatHistory).values({
      id: `coach-${Date.now()}`,
      userId: user.id,
      sender: "ai",
      text: `⚡ I have analyzed and broken down "${task.title}"! ${result.motivationalNudge || "Let's take action step-by-step. Standard guidelines say starting takes 80% of the effort—so I've created interactive starting drafts for you in the Task panel!"}`,
      timestamp: new Date().toISOString(),
      category: "motivation"
    });

    res.json({
      task: {
        ...task,
        breakdownSteps: formattedSteps,
        aiArtifacts: formattedArtifacts,
        status: 'in_progress',
      },
      motivationalNudge: result.motivationalNudge,
    });
  } catch (error: any) {
    console.error("Gemini breakdown generation failed:", error);
    res.status(500).json({ error: "AI breakdown failed.", details: error.message });
  }
});

app.post("/api/tasks/:id/emergency", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(req.user!.uid, req.user!.email || "");
    
    const existingTasks = await db.select().from(tasks).where(and(eq(tasks.id, req.params.id), eq(tasks.userId, user.id)));
    if (existingTasks.length === 0) {
      return res.status(404).json({ error: "Task not found." });
    }
    const task = existingTasks[0];
    const parsedArtifacts = Array.isArray(task.aiArtifacts) ? task.aiArtifacts : JSON.parse(task.aiArtifacts as string || "[]");

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY not configured.");
    }

    const hoursLeft = (new Date(task.deadline).getTime() - Date.now()) / (1000 * 60 * 60);

    const systemPrompt = `You are Clutch, a high-octane emergency response AI Coordinator. 
The user is in a state of high panic because they are about to miss a high-priority deadline for: "${task.title}".
Generate a strictly tactical, minute-by-minute survival emergency plan. Cut ALL bloated scope.
Tell them exactly what to cut, what to deliver as a minimal viable deliverable, and exactly how to schedule their next 2-3 hours to ship on-time.

Respond strictly in a valid JSON format with the following keys:
{
  "survivalStrategy": "A 1-paragraph brutal scope-cut strategy.",
  "schedule": [
    { "timeblock": "Next 15 Mins", "action": "Exact triage action..." },
    { "timeblock": "Mins 15 - 45", "action": "Exact core action..." },
    { "timeblock": "Mins 45 - 90", "action": "Exact secondary action..." },
    { "timeblock": "Final 30 Mins", "action": "Polishing & submission prep..." }
  ],
  "starterEmailToStakeholder": "A professional message request for dynamic extension."
}`;

    const prompt = `EMERGENCY ACTION PLAN REQUIRED:
Task: "${task.title}"
Description: "${task.description}"
Time Left: ${Math.round(hoursLeft * 10) / 10} Hours
Estimated Original Effort: ${task.estimatedHours} Hours`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            survivalStrategy: { type: Type.STRING },
            schedule: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  timeblock: { type: Type.STRING },
                  action: { type: Type.STRING }
                },
                required: ["timeblock", "action"]
              }
            },
            starterEmailToStakeholder: { type: Type.STRING }
          },
          required: ["survivalStrategy", "schedule", "starterEmailToStakeholder"]
        }
      }
    });

    const result = parseLLMJson(response.text, {});

    const planContent = `### SURVIVAL STRATEGY
${result.survivalStrategy}

### EMERGENCY SURVIVAL TIMELINE
${(result.schedule || []).map((s: any) => `- **${s.timeblock}**: ${s.action}`).join('\n')}

### EXTENSION REQUEST EMAIL (Strategic Buffer)
\`\`\`
${result.starterEmailToStakeholder}
\`\`\`
`;

    const emergencyArtifact = {
      id: `emergency-plan-${Date.now()}`,
      name: "Tactical Survival Battleplan",
      type: "plan",
      content: planContent
    };

    const newArtifacts = [emergencyArtifact, ...parsedArtifacts];

    await db.update(tasks)
      .set({
        aiArtifacts: JSON.stringify(newArtifacts),
        emergencyPlanCreated: true,
        priority: 'high',
      })
      .where(eq(tasks.id, task.id));

    const userStats = await db.select().from(stats).where(eq(stats.userId, user.id));
    if (userStats.length > 0) {
      await db.update(stats)
        .set({ emergencyModesTriggered: userStats[0].emergencyModesTriggered + 1 })
        .where(eq(stats.userId, user.id));
    }

    await db.insert(chatHistory).values({
      id: `emergency-${Date.now()}`,
      userId: user.id,
      sender: "ai",
      text: `🚨 EMERGENCY MODE INITIATED for "${task.title}". We have zero margin. Here is the survival strategy: ${result.survivalStrategy}. I've posted the complete minute-by-minute timeline inside the task's artifacts! Let's lock in and execute.`,
      timestamp: new Date().toISOString(),
      category: "emergency"
    });

    res.json({
      task: {
        ...task,
        aiArtifacts: newArtifacts,
        emergencyPlanCreated: true,
        priority: 'high',
      },
      plan: result,
    });
  } catch (error: any) {
    console.error("Gemini emergency generation failed:", error);
    res.status(500).json({ error: "AI Emergency Generator failed." });
  }
});

app.post("/api/coach/chat", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(req.user!.uid, req.user!.email || "");
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    const userMsgId = `user-${Date.now()}`;
    await db.insert(chatHistory).values({
      id: userMsgId,
      userId: user.id,
      sender: "user",
      text: message,
      timestamp: new Date().toISOString(),
      category: "general"
    });

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    const userTasks = await db.select().from(tasks).where(and(eq(tasks.userId, user.id), eq(tasks.status, "pending")));
    const activeTasksSummary = userTasks
      .map(t => `- [${t.priority.toUpperCase()}] "${t.title}" due on ${t.deadline} (${t.estimatedHours}h estimated effort).`)
      .join('\n');

    const systemPrompt = `You are Clutch, an Elite AI Executive Assistant, productivity coach, and battle-tested tech entrepreneur. 
Your tone is encouraging, objective, high-agency, smart, and direct. You hate passive reminders. 
You offer actual micro-workaround advice (e.g., recommend specific frameworks, suggest immediate shortcuts, or tell the user how to overcome cognitive resistance).
You are aware of the user's current pending tasks:
${activeTasksSummary || "No active tasks—they are completely caught up!"}

Always reply with a brief, highly actionable response. Use elegant formatting (markdown) for your tactical suggestions. Keep it under 200 words.`;

    const recentHistory = await db.select()
      .from(chatHistory)
      .where(eq(chatHistory.userId, user.id))
      .orderBy(asc(chatHistory.createdAt))
      .limit(8);

    const promptMessages = recentHistory.map(m => `${m.sender === 'ai' ? 'Clutch' : 'User'}: ${m.text}`).join('\n');

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: promptMessages,
      config: {
        systemInstruction: systemPrompt
      }
    });

    const replyText = response.text || "I'm lock-in, let's crush our goals!";
    const aiMsgId = `ai-${Date.now()}`;

    const newAiMsg = {
      id: aiMsgId,
      userId: user.id,
      sender: "ai" as const,
      text: replyText,
      timestamp: new Date().toISOString(),
      category: "coaching"
    };

    await db.insert(chatHistory).values(newAiMsg);

    res.json(newAiMsg);
  } catch (error: any) {
    console.error("Gemini coach chat failed:", error);
    res.status(500).json({ error: "Clutch Coach is offline." });
  }
});

app.delete("/api/coach/chat", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(req.user!.uid, req.user!.email || "");
    await db.delete(chatHistory).where(eq(chatHistory.userId, user.id));
    
    const initialMsg = {
      id: "m-init-1",
      userId: user.id,
      sender: "ai",
      text: "Hi! I am Clutch, your AI Executive Assistant. I don't just remind you to finish work—I analyze deadlines, predict delay risks, plan your schedule, and generate draft templates to help you start instantly. What are we crushing today?",
      timestamp: new Date().toISOString(),
      category: "general"
    };
    await db.insert(chatHistory).values(initialMsg);
    res.json([initialMsg]);
  } catch (error: any) {
    console.error("Error clearing chat history:", error);
    res.status(500).json({ error: "Failed to clear history." });
  }
});

app.get("/api/coach/chat", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(req.user!.uid, req.user!.email || "");
    const history = await db.select()
      .from(chatHistory)
      .where(eq(chatHistory.userId, user.id))
      .orderBy(asc(chatHistory.createdAt));

    if (history.length === 0) {
      const initialMsg = {
        id: "m-init-1",
        userId: user.id,
        sender: "ai",
        text: "Hi! I am Clutch, your AI Executive Assistant. I don't just remind you to finish work—I analyze deadlines, predict delay risks, plan your schedule, and generate draft templates to help you start instantly. What are we crushing today?",
        timestamp: new Date().toISOString(),
        category: "general"
      };
      await db.insert(chatHistory).values(initialMsg);
      return res.json([initialMsg]);
    }

    res.json(history);
  } catch (error: any) {
    console.error("Error fetching chat history:", error);
    res.status(500).json({ error: "Failed to fetch history." });
  }
});

app.get("/api/schedule", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(req.user!.uid, req.user!.email || "");
    const blocks = await db.select().from(schedule).where(eq(schedule.userId, user.id));
    res.json(blocks);
  } catch (error: any) {
    console.error("Error fetching schedule:", error);
    res.status(500).json({ error: "Failed to fetch schedule." });
  }
});

app.post("/api/schedule", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(req.user!.uid, req.user!.email || "");
    const { taskId, taskTitle, startTime, endTime } = req.body;

    if (!taskId || !taskTitle || !startTime || !endTime) {
      return res.status(400).json({ error: "Missing scheduling details." });
    }

    const blockId = `block-${Date.now()}`;
    const newBlock = {
      id: blockId,
      userId: user.id,
      taskId,
      taskTitle,
      startTime,
      endTime,
      isAIAllocated: false
    };

    await db.insert(schedule).values(newBlock);
    res.json(newBlock);
  } catch (error: any) {
    console.error("Error creating schedule block:", error);
    res.status(500).json({ error: "Failed to create schedule block." });
  }
});

app.delete("/api/schedule/:id", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(req.user!.uid, req.user!.email || "");
    await db.delete(schedule).where(and(eq(schedule.id, req.params.id), eq(schedule.userId, user.id)));
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting schedule block:", error);
    res.status(500).json({ error: "Failed to delete block." });
  }
});

app.post("/api/schedule/auto-plan", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(req.user!.uid, req.user!.email || "");
    const activeTasks = await db.select().from(tasks).where(and(eq(tasks.userId, user.id), eq(tasks.status, "pending")));

    if (activeTasks.length === 0) {
      return res.json({ message: "No active tasks to schedule today!" });
    }

    if (!process.env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured.");
    }

    const systemPrompt = `You are Clutch's Smart Scheduling Engine. 
Create a realistic schedule block layout for a single day. 
Assign the active tasks to specific timeblocks based on priority, remaining duration, and typical cognitive performance windows.
Schedule around a standard workday of 09:00 to 18:00.

Respond strictly in a valid JSON format:
[
  { "taskId": "exact-task-id-here", "taskTitle": "Exact Task Title", "startTime": "09:30", "endTime": "11:30" }
]`;

    const prompt = `Generate daily calendar blocks for these active tasks:\n` +
      activeTasks.map(t => `- Task ID: "${t.id}", Title: "${t.title}", Priority: "${t.priority}", Est Hours: ${t.estimatedHours}, Deadline: "${t.deadline}"`).join('\n');

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              taskId: { type: Type.STRING },
              taskTitle: { type: Type.STRING },
              startTime: { type: Type.STRING },
              endTime: { type: Type.STRING }
            },
            required: ["taskId", "taskTitle", "startTime", "endTime"]
          }
        }
      }
    });

    const blocks = parseLLMJson(response.text, []);

    await db.delete(schedule).where(eq(schedule.userId, user.id));

    const formattedBlocks = [];
    for (let idx = 0; idx < blocks.length; idx++) {
      const b = blocks[idx];
      const newBlock = {
        id: `block-${Date.now()}-${idx}`,
        userId: user.id,
        taskId: b.taskId || "task-unknown",
        taskTitle: b.taskTitle || "Unscheduled Task",
        startTime: b.startTime || "09:00",
        endTime: b.endTime || "10:00",
        isAIAllocated: true
      };
      await db.insert(schedule).values(newBlock);
      formattedBlocks.push(newBlock);
    }

    await db.insert(chatHistory).values({
      id: `schedule-notif-${Date.now()}`,
      userId: user.id,
      sender: "ai",
      text: `📅 I have auto-planned your calendar blocks for today! I scheduled ${formattedBlocks.length} focus sessions optimized for your active task deadlines and mental energy curves. Check your calendar!`,
      timestamp: new Date().toISOString(),
      category: "general"
    });

    res.json(formattedBlocks);
  } catch (error: any) {
    console.error("Gemini scheduler failed:", error);
    res.status(500).json({ error: "Auto-scheduling failed." });
  }
});

app.get("/api/habits", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(req.user!.uid, req.user!.email || "");
    const userHabits = await db.select().from(habits).where(eq(habits.userId, user.id));
    
    const parsedHabits = userHabits.map(h => ({
      ...h,
      completedDates: Array.isArray(h.completedDates) ? h.completedDates : JSON.parse(h.completedDates as string || "[]"),
    }));
    res.json(parsedHabits);
  } catch (error: any) {
    console.error("Error fetching habits:", error);
    res.status(500).json({ error: "Failed to fetch habits." });
  }
});

app.post("/api/habits", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(req.user!.uid, req.user!.email || "");
    const { name, frequency } = req.body;
    
    if (!name) return res.status(400).json({ error: "Habit name required." });

    const newHabit = {
      id: `habit-${Date.now()}`,
      userId: user.id,
      name,
      frequency: frequency || "daily",
      streak: 0,
      completedDates: []
    };

    await db.insert(habits).values({
      ...newHabit,
      completedDates: JSON.stringify([]),
    });

    res.json(newHabit);
  } catch (error: any) {
    console.error("Error creating habit:", error);
    res.status(500).json({ error: "Failed to create habit." });
  }
});

app.post("/api/habits/:id/toggle", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(req.user!.uid, req.user!.email || "");
    const existingHabits = await db.select().from(habits).where(and(eq(habits.id, req.params.id), eq(habits.userId, user.id)));

    if (existingHabits.length === 0) return res.status(404).json({ error: "Habit not found." });

    const habit = existingHabits[0];
    const completedDates: string[] = Array.isArray(habit.completedDates) 
      ? habit.completedDates as string[]
      : JSON.parse(habit.completedDates as string || "[]");
      
    const todayStr = new Date().toISOString().split('T')[0];
    const dateIndex = completedDates.indexOf(todayStr);

    let newStreak = habit.streak;
    if (dateIndex > -1) {
      completedDates.splice(dateIndex, 1);
      newStreak = Math.max(0, habit.streak - 1);
    } else {
      completedDates.push(todayStr);
      newStreak += 1;
      
      const userStats = await db.select().from(stats).where(eq(stats.userId, user.id));
      if (userStats.length > 0) {
        await db.update(stats)
          .set({ focusTimeMinutes: userStats[0].focusTimeMinutes + 15 })
          .where(eq(stats.userId, user.id));
      }
    }

    await db.update(habits)
      .set({
        completedDates: JSON.stringify(completedDates),
        streak: newStreak,
      })
      .where(eq(habits.id, habit.id));

    res.json({
      ...habit,
      completedDates,
      streak: newStreak,
    });
  } catch (error: any) {
    console.error("Error toggling habit:", error);
    res.status(500).json({ error: "Failed to toggle habit." });
  }
});

app.get("/api/stats", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(req.user!.uid, req.user!.email || "");
    const userStats = await db.select().from(stats).where(eq(stats.userId, user.id));
    if (userStats.length === 0) {
      return res.json({
        focusTimeMinutes: 0,
        tasksCompleted: 0,
        onTimeCompletionRate: 80,
        aiBreakdownsUsed: 0,
        emergencyModesTriggered: 0,
      });
    }
    res.json(userStats[0]);
  } catch (error: any) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ error: "Failed to fetch stats." });
  }
});

app.post("/api/stats/add-focus", requireAuth, async (req: AuthRequest, res) => {
  try {
    const user = await getOrCreateUser(req.user!.uid, req.user!.email || "");
    const { minutes } = req.body;
    if (minutes) {
      const userStats = await db.select().from(stats).where(eq(stats.userId, user.id));
      if (userStats.length > 0) {
        await db.update(stats)
          .set({ focusTimeMinutes: userStats[0].focusTimeMinutes + Number(minutes) })
          .where(eq(stats.userId, user.id));
      }
    }
    const finalStats = await db.select().from(stats).where(eq(stats.userId, user.id));
    res.json(finalStats[0]);
  } catch (error: any) {
    console.error("Error adding focus time:", error);
    res.status(500).json({ error: "Failed to add focus time." });
  }
});

// ==========================================
// GOOGLE WORKSPACE AI HELPER API ENDPOINTS
// ==========================================

app.post("/api/workspace/ai/summarize-email", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { subject, sender, body } = req.body;
    if (!subject || !sender || !body) {
      return res.status(400).json({ error: "Email subject, sender, and body are required." });
    }

    const systemPrompt = `You are Clutch, an elite AI Executive Assistant. 
Analyze the provided email and output a structured JSON response containing:
1. A concise, professional summary (3 short bullet points).
2. An assessment of the emotional tone/urgency (e.g., "Urgent / Client Request", "Neutral / Announcement", "Polite / Question").
3. A polished, high-agency draft reply that addresses the email directly.

Respond strictly in valid JSON using this schema:
{
  "summary": ["string"],
  "tone": "string",
  "replyDraft": "string"
}`;

    const prompt = `Please summarize and write a draft reply for this email:
Sender: ${sender}
Subject: ${subject}
Body: ${body}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            tone: { type: Type.STRING },
            replyDraft: { type: Type.STRING }
          },
          required: ["summary", "tone", "replyDraft"]
        }
      }
    });

    const result = parseLLMJson(response.text);
    res.json(result);
  } catch (error: any) {
    console.error("Error summarizing email:", error);
    res.status(500).json({ error: "Failed to summarize email." });
  }
});

app.post("/api/workspace/ai/draft-email", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { prompt: userPrompt, recipient, subject: emailSubject, originalContent } = req.body;
    if (!userPrompt) {
      return res.status(400).json({ error: "Prompt is required to draft email." });
    }

    const systemPrompt = `You are Clutch, an elite AI Executive Assistant.
Draft or refine a professional, warm, clear, and action-oriented business email based on the user's brief notes and context.
Provide a compelling subject line and a beautifully formatted body.

Respond strictly in valid JSON using this schema:
{
  "subject": "string",
  "body": "string"
}`;

    const prompt = `Draft an email with the following details:
Recipient: ${recipient || "unspecified"}
Original Subject Context: ${emailSubject || "unspecified"}
User Request/Notes: "${userPrompt}"
${originalContent ? `Original Reference Email Context:\n${originalContent}` : ""}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            subject: { type: Type.STRING },
            body: { type: Type.STRING }
          },
          required: ["subject", "body"]
        }
      }
    });

    const result = parseLLMJson(response.text);
    res.json(result);
  } catch (error: any) {
    console.error("Error drafting email:", error);
    res.status(500).json({ error: "Failed to draft email." });
  }
});

app.post("/api/workspace/ai/optimize-schedule", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { tasks: activeTasks, calendarEvents } = req.body;

    const systemPrompt = `You are Clutch, an elite AI Productivity Architect.
Analyze the user's active tasks and existing Google Calendar schedule for today.
Find free time gaps and suggest a beautifully engineered, high-productivity calendar timeline.
Each recommended block should target a specific task or deep work focus, with an explicit start/end time and a solid productivity reason.

Respond strictly in valid JSON using this schema:
{
  "recommendedBlocks": [
    {
      "title": "string",
      "reason": "string",
      "startTime": "string", // Format: HH:MM, e.g. "09:30"
      "endTime": "string" // Format: HH:MM, e.g. "11:00"
    }
  ]
}`;

    const prompt = `Analyze these elements and optimize today's schedule:
Active Tasks:
${JSON.stringify(activeTasks || [])}

Existing Calendar Events:
${JSON.stringify(calendarEvents || [])}

Current Time: ${new Date().toISOString()}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            recommendedBlocks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  reason: { type: Type.STRING },
                  startTime: { type: Type.STRING },
                  endTime: { type: Type.STRING }
                },
                required: ["title", "reason", "startTime", "endTime"]
              }
            }
          },
          required: ["recommendedBlocks"]
        }
      }
    });

    const result = parseLLMJson(response.text);
    res.json(result);
  } catch (error: any) {
    console.error("Error optimizing schedule:", error);
    res.status(500).json({ error: "Failed to optimize schedule." });
  }
});

app.post("/api/workspace/ai/extract-keep-note", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { title, content } = req.body;
    if (!title && !content) {
      return res.status(400).json({ error: "Note title or content is required." });
    }

    const systemPrompt = `You are Clutch, an elite AI Organizer.
Analyze the provided Google Keep style note (title and body).
Extract any structured, actionable tasks that can be added to the user's daily to-do list.
Each task must have a clear title, a brief description, a sensible productivity category, estimated hours, and a priority level (low, medium, high).

Respond strictly in valid JSON using this schema:
{
  "tasks": [
    {
      "title": "string",
      "description": "string",
      "category": "string",
      "estimatedHours": number,
      "priority": "low" | "medium" | "high"
    }
  ]
}`;

    const prompt = `Extract tasks from this note:
Note Title: "${title || "Untitled Note"}"
Note Content:
"${content || ""}"`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  category: { type: Type.STRING },
                  estimatedHours: { type: Type.NUMBER },
                  priority: { type: Type.STRING }
                },
                required: ["title", "description", "category", "estimatedHours", "priority"]
              }
            }
          },
          required: ["tasks"]
        }
      }
    });

    const result = parseLLMJson(response.text);
    res.json(result);
  } catch (error: any) {
    console.error("Error extracting note tasks:", error);
    res.status(500).json({ error: "Failed to extract tasks from note." });
  }
});

if (!isProd) {
  createViteServer({
    server: { middlewareMode: true },
    appType: "spa",
  }).then((vite) => {
    app.use(vite.middlewares);
    
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        return next();
      }
      const indexHtml = path.join(process.cwd(), "index.html");
      res.sendFile(indexHtml);
    });

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running in development on port ${PORT}`);
    });
  });
} else {
  const distPath = path.join(process.cwd(), "dist");
  app.use(express.static(distPath));
  
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    res.sendFile(path.join(distPath, "index.html"));
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running in production on port ${PORT}`);
  });
}
