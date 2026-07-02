/**
 * GET /api/auth/me — current authenticated user profile (dashboard-ready payload).
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { levelProgress } from "@/lib/learning";

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    include: {
      achievements: { include: { achievement: true } },
    },
  });
  if (!user) return ApiError.NotFound("User");

  // Counts computed separately to avoid filtered-relation count limitations
  const [
    enrollmentsCount,
    lessonsCompletedCount,
    quizAttemptsCount,
    flashcardReviewsCount,
    conversationsCount,
    documentsCount,
  ] = await Promise.all([
    db.enrollment.count({ where: { userId: user.id } }),
    db.lessonProgress.count({ where: { userId: user.id, status: "completed" } }),
    db.quizAttempt.count({ where: { userId: user.id } }),
    db.flashcardReview.count({ where: { userId: user.id } }),
    db.conversation.count({ where: { userId: user.id } }),
    db.document.count({ where: { userId: user.id } }),
  ]);

  const { level, current, needed, pct } = levelProgress(user.totalXP);

  return ok({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
    },
    gamification: {
      totalXP: user.totalXP,
      level,
      xpIntoLevel: current,
      xpForNextLevel: needed,
      levelProgressPct: Math.round(pct),
      currentStreak: user.currentStreak,
      longestStreak: user.longestStreak,
      achievements: user.achievements.map((a) => ({
        slug: a.achievement.slug,
        name: a.achievement.name,
        icon: a.achievement.icon,
        tier: a.achievement.tier,
        earnedAt: a.earnedAt,
      })),
    },
    counts: {
      enrollments: enrollmentsCount,
      lessonsCompleted: lessonsCompletedCount,
      quizAttempts: quizAttemptsCount,
      flashcardsReviewed: flashcardReviewsCount,
      conversations: conversationsCount,
      documents: documentsCount,
    },
  });
}
