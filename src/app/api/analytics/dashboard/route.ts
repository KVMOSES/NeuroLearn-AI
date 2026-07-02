/**
 * GET /api/analytics/dashboard — aggregated learning analytics for the user.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { computeExamReadiness } from "@/lib/learning-service";

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const userId = session.user.id;

  const [
    enrollments,
    lessonProgress,
    quizAttempts,
    flashcardReviews,
    xpEvents,
    streakLogs,
    conversations,
    readiness,
  ] = await Promise.all([
    db.enrollment.findMany({ where: { userId }, include: { course: true } }),
    db.lessonProgress.findMany({ where: { userId } }),
    db.quizAttempt.findMany({ where: { userId }, orderBy: { startedAt: "asc" } }),
    db.flashcardReview.findMany({ where: { userId }, orderBy: { reviewedAt: "asc" } }),
    db.xPEvent.findMany({ where: { userId }, orderBy: { createdAt: "asc" } }),
    db.streakLog.findMany({ where: { userId }, orderBy: { date: "asc" } }),
    db.conversation.findMany({ where: { userId } }),
    computeExamReadiness(userId),
  ]);

  // XP over last 14 days
  const since = new Date();
  since.setDate(since.getDate() - 13);
  since.setHours(0, 0, 0, 0);
  const xpByDay = new Map<string, number>();
  for (const e of xpEvents) {
    if (e.createdAt < since) continue;
    const key = e.createdAt.toISOString().slice(0, 10);
    xpByDay.set(key, (xpByDay.get(key) ?? 0) + e.amount);
  }
  const xpSeries: { date: string; xp: number }[] = [];
  const cursor = new Date(since);
  for (let i = 0; i < 14; i++) {
    const key = cursor.toISOString().slice(0, 10);
    xpSeries.push({ date: key, xp: xpByDay.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  // Quiz score trend
  const quizSeries = quizAttempts
    .filter((a) => a.completedAt)
    .slice(-10)
    .map((a, i) => ({ attempt: i + 1, score: Math.round(a.score * 100) }));

  // Mastery by category
  const skillStates = await db.knowledgeState.findMany({
    where: { userId },
    include: { skill: true },
  });
  const byCategory = new Map<string, { sum: number; count: number }>();
  for (const s of skillStates) {
    const cat = s.skill.category ?? "General";
    const cur = byCategory.get(cat) ?? { sum: 0, count: 0 };
    cur.sum += s.pKnown;
    cur.count += 1;
    byCategory.set(cat, cur);
  }
  const masteryByCategory = Array.from(byCategory.entries()).map(([category, v]) => ({
    category,
    mastery: Math.round((v.sum / v.count) * 100),
    skillCount: v.count,
  }));

  // Activity distribution (last 7 days)
  const activitySince = new Date();
  activitySince.setDate(activitySince.getDate() - 6);
  activitySince.setHours(0, 0, 0, 0);
  const recentQuiz = quizAttempts.filter((a) => a.startedAt >= activitySince).length;
  const recentFlash = flashcardReviews.filter((r) => r.reviewedAt >= activitySince).length;
  const recentLessons = lessonProgress.filter(
    (l) => l.completedAt && l.completedAt >= activitySince
  ).length;
  const recentChat = conversations.filter((c) => c.updatedAt >= activitySince).length;

  return ok({
    summary: {
      enrolledCourses: enrollments.length,
      completedCourses: enrollments.filter((e) => e.completedAt).length,
      lessonsCompleted: lessonProgress.filter((l) => l.status === "completed").length,
      totalTimeSpent: lessonProgress.reduce((s, l) => s + l.timeSpent, 0),
      quizAttempts: quizAttempts.length,
      avgQuizScore: quizAttempts.length
        ? Math.round((quizAttempts.reduce((s, a) => s + a.score, 0) / quizAttempts.length) * 100)
        : 0,
      flashcardsReviewed: flashcardReviews.length,
      aiConversations: conversations.length,
      examReadiness: readiness.readiness,
    },
    xpSeries,
    quizSeries,
    masteryByCategory,
    activityThisWeek: {
      quizzes: recentQuiz,
      flashcards: recentFlash,
      lessons: recentLessons,
      conversations: recentChat,
    },
    streak: {
      current: streakLogs.length > 0 ? streakLogs.length : 0,
      logs: streakLogs.slice(-30).map((s) => ({ date: s.date, xp: s.xpEarned })),
    },
    skillMastery: readiness.skills,
  });
}
