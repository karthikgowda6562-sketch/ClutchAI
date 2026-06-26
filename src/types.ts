/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskStatus = 'pending' | 'in_progress' | 'completed';
export type ArtifactType = 'code' | 'email' | 'outline' | 'document' | 'plan';

export interface BreakdownStep {
  id: string;
  text: string;
  durationMinutes: number;
  completed: boolean;
}

export interface AIArtifact {
  id: string;
  name: string;
  type: ArtifactType;
  content: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  deadline: string; // ISO String
  estimatedHours: number;
  priority: TaskPriority;
  status: TaskStatus;
  riskScore: number; // 0 to 100, predicted by Gemini based on time remaining vs estimated complexity
  riskReason?: string;
  breakdownSteps: BreakdownStep[];
  aiArtifacts: AIArtifact[];
  emergencyPlanCreated?: boolean;
}

export interface FocusSession {
  taskId: string | null;
  durationMinutes: number;
  timeSpentSeconds: number;
  isActive: boolean;
  isPaused: boolean;
  ambientSound: 'none' | 'lofi' | 'rain' | 'waves' | 'binaural';
}

export interface CoachMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string; // ISO String
  category?: 'coaching' | 'emergency' | 'motivation' | 'general';
}

export interface ScheduleBlock {
  id: string;
  taskId: string;
  taskTitle: string;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  isAIAllocated: boolean;
}

export interface Habit {
  id: string;
  name: string;
  frequency: 'daily' | 'weekly';
  streak: number;
  completedDates: string[]; // ['YYYY-MM-DD']
}

export interface ProductivityStats {
  focusTimeMinutes: number;
  tasksCompleted: number;
  onTimeCompletionRate: number;
  aiBreakdownsUsed: number;
  emergencyModesTriggered: number;
}
