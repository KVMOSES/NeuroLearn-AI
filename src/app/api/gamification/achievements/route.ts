/**
 * GET /api/gamification/achievements — all achievements + earned status.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const [all, earned] = await Promise.all([
    db.achievement.findMany({ orderBy: { tier: "asc" } }),
    db.userAchievement.findMany({
      where: { userId: session.user.id },
      include: { achievement: true },
    }),
  ]);
  const earnedMap = new Map(earned.map((e) => [e.achievement.slug, e.earnedAt]));

  return ok({
    achievements: all.map((a) => ({
      id: a.id,
      slug: a.slug,
      name: a.name,
      description: a.description,
      icon: a.icon,
      tier: a.tier,
      xpReward: a.xpReward,
      threshold: a.threshold,
      category: a.category,
      earned: earnedMap.has(a.slug),
      earnedAt: earnedMap.get(a.slug) ?? null,
    })),
    earnedCount: earned.length,
    totalCount: all.length,
  });
}
