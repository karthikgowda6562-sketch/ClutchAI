import { db } from './index.ts';
import { users, stats } from './schema.ts';
import { eq } from 'drizzle-orm';

export async function getOrCreateUser(uid: string, email: string) {
  try {
    const userResult = await db.insert(users)
      .values({
        uid,
        email,
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
        },
      })
      .returning();

    const user = userResult[0];

    await db.insert(stats)
      .values({
        userId: user.id,
        focusTimeMinutes: 0,
        tasksCompleted: 0,
        onTimeCompletionRate: 80,
        aiBreakdownsUsed: 0,
        emergencyModesTriggered: 0,
      })
      .onConflictDoNothing();

    return user;
  } catch (error) {
    console.error('Error in getOrCreateUser:', error);
    throw new Error('Failed to synchronize user state in database.', { cause: error });
  }
}
