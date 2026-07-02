/**
 * GET /api/teaching/mission
 * Generates the user's "Today's Mission" — a set of real, actionable daily learning
 * goals derived from their learning plan, memory state, XP targets, and streak.
 *
 * Missions are NOT hardcoded. They are computed from real data:
 * - Topics scheduled for today in the learning plan
 * - Topics due for revision (memory model)
 * - XP earned today vs daily target
 * - Streak maintenance
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";

const DAILY_XP_TARGET = 100;

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const userId = session.user.id;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Gather all the data we need in parallel
  const [learningPlans, dueMemory, xpToday, profile, materials] = await Promise.all([
    db.learningPlan.findMany({
      where: { userId, status: "active" },
      include: {
        items: {
          where: {
            OR: [
              { status: "pending" },
              { status: "in_progress" },
              { status: "needs_revision" },
            ],
          },
          include: { topic: { select: { id: true, title: true, summary: true, difficulty: true, estimatedMinutes: true, documentId: true, document: { select: { title: true } } } } },
          orderBy: { order: "asc" },
          take: 10,
        },
        document: { select: { id: true, title: true } },
      },
    }),
    db.memoryState.findMany({
      where: { userId, nextReview: { lte: new Date() } },
      include: { topic: { select: { id: true, title: true, document: { select: { title: true } } } } },
      orderBy: { nextReview: "asc" },
      take: 10,
    }),
    db.xPEvent.aggregate({
      where: { userId, createdAt: { gte: today } },
      _sum: { amount: true },
    }),
    db.learnerProfile.findUnique({ where: { userId } }),
    db.document.findMany({
      where: { userId, status: "ready", topics: { none: {} } },
      select: { id: true, title: true },
      take: 5,
    }),
  ]);

  const xpEarnedToday = xpToday._sum.amount ?? 0;
  const xpProgress = Math.min(100, Math.round((xpEarnedToday / DAILY_XP_TARGET) * 100));

  // Build mission tasks from real data
  interface MissionTask {
    id: string;
    type: "learn" | "review" | "analyze" | "diagnostic" | "xp";
    title: string;
    description: string;
    targetId?: string;
    documentTitle?: string;
    estimatedMinutes: number;
    difficulty?: number;
    isWeak?: boolean;
    completed: boolean;
  }

  const tasks: MissionTask[] = [];

  // 1. Topics scheduled for today from learning plans
  for (const plan of learningPlans) {
    for (const item of plan.items) {
      if (tasks.length >= 5) break;
      tasks.push({
        id: `learn-${item.id}`,
        type: "learn",
        title: item.topic.title,
        description: item.topic.summary || `Learn this topic from ${item.topic.document.title}`,
        targetId: item.topicId,
        documentTitle: item.topic.document.title,
        estimatedMinutes: item.topic.estimatedMinutes,
        difficulty: item.topic.difficulty,
        isWeak: item.isWeak,
        completed: false,
      });
    }
  }

  // 2. Due revision topics (from memory model)
  for (const mem of dueMemory) {
    if (tasks.length >= 6) break;
    // Check if already added as a learn task
    if (tasks.some((t) => t.targetId === mem.topicId)) continue;
    tasks.push({
      id: `review-${mem.topicId}`,
      type: "review",
      title: `Review: ${mem.topic.title}`,
      description: `Spaced repetition review — your retention is dropping`,
      targetId: mem.topicId,
      documentTitle: mem.topic.document.title,
      estimatedMinutes: 5,
      completed: false,
    });
  }

  // 3. Unanalyzed documents that need analysis
  for (const doc of materials) {
    if (tasks.length >= 7) break;
    tasks.push({
      id: `analyze-${doc.id}`,
      type: "analyze",
      title: `Analyze: ${doc.title}`,
      description: "Let your AI teacher extract topics and create a learning plan",
      targetId: doc.id,
      estimatedMinutes: 2,
      completed: false,
    });
  }

  // 4. XP goal
  tasks.push({
    id: "xp-goal",
    type: "xp",
    title: `Earn ${DAILY_XP_TARGET} XP`,
    description: `${xpEarnedToday} / ${DAILY_XP_TARGET} XP earned today`,
    estimatedMinutes: 0,
    completed: xpEarnedToday >= DAILY_XP_TARGET,
  });

  // Compute estimated total time
  const totalMinutes = tasks
    .filter((t) => !t.completed && t.type !== "xp")
    .reduce((s, t) => s + t.estimatedMinutes, 0);

  // Streak info
  const streakActive = session.dbUser.currentStreak > 0;
  const lastActivity = session.dbUser.lastActivityDate;
  const streakAtRisk = !lastActivity || (today.getTime() - new Date(lastActivity).setHours(0, 0, 0, 0)) > 86400000;

  return ok({
    date: today.toISOString(),
    greeting: getGreeting(),
    xpEarnedToday,
    xpTarget: DAILY_XP_TARGET,
    xpProgress,
    streak: {
      current: session.dbUser.currentStreak,
      longest: session.dbUser.longestStreak,
      atRisk: streakAtRisk,
    },
    level: session.dbUser.level,
    totalXP: session.dbUser.totalXP,
    preferredStyle: profile?.preferredStyle ?? "balanced",
    estimatedMinutes: totalMinutes,
    taskCount: tasks.filter((t) => !t.completed).length,
    completedCount: tasks.filter((t) => t.completed).length,
    tasks,
  });
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
