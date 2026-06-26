import { pgTable, serial, text, integer, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(),
  description: text('description').default('').notNull(),
  category: text('category').default('General').notNull(),
  deadline: text('deadline').notNull(),
  estimatedHours: text('estimated_hours').notNull(),
  priority: text('priority').default('medium').notNull(),
  status: text('status').default('pending').notNull(),
  riskScore: integer('risk_score').default(0).notNull(),
  riskReason: text('risk_reason').default('').notNull(),
  breakdownSteps: jsonb('breakdown_steps').default('[]').notNull(),
  aiArtifacts: jsonb('ai_artifacts').default('[]').notNull(),
  emergencyPlanCreated: boolean('emergency_plan_created').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const habits = pgTable('habits', {
  id: text('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  frequency: text('frequency').default('daily').notNull(),
  streak: integer('streak').default(0).notNull(),
  completedDates: jsonb('completed_dates').default('[]').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const schedule = pgTable('schedule', {
  id: text('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  taskId: text('task_id'),
  taskTitle: text('task_title'),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  isAIAllocated: boolean('is_ai_allocated').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const stats = pgTable('stats', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull().unique(),
  focusTimeMinutes: integer('focus_time_minutes').default(0).notNull(),
  tasksCompleted: integer('tasks_completed').default(0).notNull(),
  onTimeCompletionRate: integer('on_time_completion_rate').default(80).notNull(),
  aiBreakdownsUsed: integer('ai_breakdowns_used').default(0).notNull(),
  emergencyModesTriggered: integer('emergency_modes_triggered').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const chatHistory = pgTable('chat_history', {
  id: text('id').primaryKey(),
  userId: integer('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  sender: text('sender').notNull(),
  text: text('text').notNull(),
  category: text('category').default('general').notNull(),
  timestamp: text('timestamp').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  tasks: many(tasks),
  habits: many(habits),
  schedule: many(schedule),
  chatHistory: many(chatHistory),
  stats: one(stats, {
    fields: [users.id],
    references: [stats.userId],
  }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  user: one(users, {
    fields: [tasks.userId],
    references: [users.id],
  }),
}));

export const habitsRelations = relations(habits, ({ one }) => ({
  user: one(users, {
    fields: [habits.userId],
    references: [users.id],
  }),
}));

export const scheduleRelations = relations(schedule, ({ one }) => ({
  user: one(users, {
    fields: [schedule.userId],
    references: [users.id],
  }),
}));

export const statsRelations = relations(stats, ({ one }) => ({
  user: one(users, {
    fields: [stats.userId],
    references: [users.id],
  }),
}));

export const chatHistoryRelations = relations(chatHistory, ({ one }) => ({
  user: one(users, {
    fields: [chatHistory.userId],
    references: [users.id],
  }),
}));
