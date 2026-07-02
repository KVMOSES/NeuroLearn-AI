/**
 * GET /api/gamification/xp-history — XP events over time (last 30 days).
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const since = new Date();
  since.setDate(since.getDate() - 30);

  const events = await db.xPEvent.findMany({
    where: { userId: session.user.id, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
  });

  // Bucket by day
  const byDay = new Map<string, number>();
  for (const e of events) {
    const key = e.createdAt.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + e.amount);
  }

  const series: { date: string; xp: number }[] = [];
  const cursor = new Date(since);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(0, 0, 0, 0);
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10);
    series.push({ date: key, xp: byDay.get(key) ?? 0 });
    cursor.setDate(cursor.getDate() + 1);
  }

  const byReason = new Map<string, number>();
  for (const e of events) {
    byReason.set(e.reason, (byReason.get(e.reason) ?? 0) + e.amount);
  }

  return ok({
    series,
    byReason: Array.from(byReason.entries()).map(([reason, amount]) => ({ reason, amount })),
    totalXP30d: events.reduce((s, e) => s + e.amount, 0),
    eventCount: events.length,
  });
}
