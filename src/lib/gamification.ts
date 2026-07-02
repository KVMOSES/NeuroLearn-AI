/**
 * Gamification service — awards XP, updates levels, grants achievements,
 * maintains streaks. All side-effecting learning actions route through here.
 */
import { db } from "@/lib/db";
import { XP_REWARDS, levelForXP, XpReason } from "@/lib/learning";

export interface XpResult {
  awarded: number;
  newTotal: number;
  newLevel: number;
  leveledUp: boolean;
  achievements: { name: string; slug: string; xp: number }[];
}

/**
 * Award XP and handle level-up + achievement side effects.
 */
export async function awardXP(
  userId: string,
  reason: XpReason,
  amountOverride?: number,
  refId?: string
): Promise<XpResult> {
  const amount = amountOverride ?? XP_REWARDS[reason] ?? 0;
  if (amount <= 0) {
    const u = await db.user.findUnique({ where: { id: userId } });
    return {
      awarded: 0,
      newTotal: u?.totalXP ?? 0,
      newLevel: u?.level ?? 1,
      leveledUp: false,
      achievements: [],
    };
  }

  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const newTotal = user.totalXP + amount;
  const newLevel = levelForXP(newTotal);
  const leveledUp = newLevel > user.level;

  await db.$transaction([
    db.xPEvent.create({
      data: { userId, amount, reason, refId },
    }),
    db.user.update({
      where: { id: userId },
      data: {
        totalXP: newTotal,
        level: newLevel,
        lastActivityDate: new Date(),
      },
    }),
  ]);

  // Update streak log for today
  await updateStreak(userId, amount);

  // Evaluate achievements
  const achievements = await evaluateAchievements(userId);

  return { awarded: amount, newTotal, newLevel, leveledUp, achievements };
}

/**
 * Update the user's daily streak. If activity is on a consecutive day, increment;
 * if same day, just accumulate XP; if gap, reset to 1.
 */
export async function updateStreak(userId: string, xpEarned: number) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return;

  const now = new Date();
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const last = user.lastActivityDate ? startOfDay(user.lastActivityDate) : null;

  let currentStreak = user.currentStreak;
  if (!last) {
    currentStreak = 1;
  } else if (last.getTime() === today.getTime()) {
    // same day — no streak change
  } else if (last.getTime() === yesterday.getTime()) {
    currentStreak += 1;
  } else {
    currentStreak = 1;
  }

  const longestStreak = Math.max(user.longestStreak, currentStreak);

  await db.user.update({
    where: { id: userId },
    data: { currentStreak, longestStreak, lastActivityDate: now },
  });

  // upsert streak log for today
  await db.streakLog.upsert({
    where: { userId_date: { userId, date: today } },
    create: { userId, date: today, xpEarned },
    update: { xpEarned: { increment: xpEarned } },
  });

  // Streak bonus XP at milestones
  if ([7, 30, 100].includes(currentStreak) && last?.getTime() !== today.getTime()) {
    await db.xPEvent.create({
      data: { userId, amount: XP_REWARDS.streak_bonus, reason: "streak_bonus", refId: `streak-${currentStreak}` },
    });
    await db.user.update({
      where: { id: userId },
      data: { totalXP: { increment: XP_REWARDS.streak_bonus } },
    });
  }
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Evaluate and grant achievements. Returns newly earned ones.
 */
export async function evaluateAchievements(
  userId: string
): Promise<{ name: string; slug: string; xp: number }[]> {
  const earned: { name: string; slug: string; xp: number }[] = [];

  const [user, existingAchievements, allAchievements] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.userAchievement.findMany({ where: { userId }, include: { achievement: true } }),
    db.achievement.findMany(),
  ]);
  if (!user) return earned;

  const have = new Set(existingAchievements.map((a) => a.achievement.slug));

  // Compute metrics
  const [lessonsCompleted, quizzesPassed, flashcardsReviewed, perfectQuizzes, docsUploaded] =
    await Promise.all([
      db.lessonProgress.count({ where: { userId, status: "completed" } }),
      db.quizAttempt.count({ where: { userId, score: { gte: 0.7 } } }),
      db.flashcardReview.count({ where: { userId } }),
      db.quizAttempt.count({ where: { userId, score: 1 } }),
      db.document.count({ where: { userId } }),
    ]);

  const metrics: Record<string, number> = {
    lessons_completed: lessonsCompleted,
    quizzes_passed: quizzesPassed,
    flashcards_reviewed: flashcardsReviewed,
    perfect_quizzes: perfectQuizzes,
    documents_uploaded: docsUploaded,
    current_streak: user.currentStreak,
    longest_streak: user.longestStreak,
    level: user.level,
    xp: user.totalXP,
  };

  for (const ach of allAchievements) {
    if (have.has(ach.slug)) continue;
    const metric = metrics[ach.category] ?? 0;
    // Map achievement category to metric
    const mapping: Record<string, string> = {
      learning: "lessons_completed",
      streak: "current_streak",
      mastery: "perfect_quizzes",
      social: "documents_uploaded",
    };
    const metricKey = mapping[ach.category] ?? ach.category;
    const value = metrics[metricKey] ?? 0;
    if (value >= ach.threshold) {
      await db.userAchievement.create({
        data: { userId, achievementId: ach.id },
      });
      // Bonus XP
      await db.user.update({
        where: { id: userId },
        data: { totalXP: { increment: ach.xpReward } },
      });
      await db.xPEvent.create({
        data: { userId, amount: ach.xpReward, reason: "achievement", refId: ach.id },
      });
      earned.push({ name: ach.name, slug: ach.slug, xp: ach.xpReward });
    }
  }

  return earned;
}

/**
 * Leaderboard — top N users by totalXP this period.
 */
export async function getLeaderboard(limit = 10) {
  const users = await db.user.findMany({
    orderBy: { totalXP: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      avatarUrl: true,
      totalXP: true,
      level: true,
      currentStreak: true,
    },
  });
  return users.map((u, i) => ({ rank: i + 1, ...u }));
}
