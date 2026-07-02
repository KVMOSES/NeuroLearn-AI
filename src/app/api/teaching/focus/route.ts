/**
 * POST /api/teaching/focus — record a completed focus session and award XP.
 * GET  /api/teaching/focus — get the user's focus session stats.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { awardXP } from "@/lib/gamification";
import { z } from "zod";

const recordSchema = z.object({
  durationMinutes: z.number().int().min(1).max(120),
  topicId: z.string().optional(),
  type: z.enum(["pomodoro", "custom"]).default("pomodoro"),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  let body: unknown;
  try { body = await req.json(); } catch { return ApiError.Validation("Invalid JSON"); }
  const parsed = recordSchema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  const { durationMinutes, type } = parsed.data;

  // Award XP: 1 XP per minute of focused study
  const xpEarned = durationMinutes;
  const result = await awardXP(session.user.id, "lesson_complete", xpEarned, `focus-${type}-${durationMinutes}`);

  // Update streak (focus sessions count as activity)
  // The awardXP function already updates lastActivityDate

  return ok({
    recorded: true,
    durationMinutes,
    xpEarned,
    newTotalXP: result.newTotal,
    newLevel: result.newLevel,
    leveledUp: result.leveledUp,
  });
}

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  // Get focus XP events from the last 30 days
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const focusEvents = await db.xPEvent.findMany({
    where: {
      userId: session.user.id,
      reason: "lesson_complete",
      refId: { contains: "focus" },
      createdAt: { gte: since },
    },
    orderBy: { createdAt: "desc" },
  });

  const totalMinutes = focusEvents.reduce((s, e) => {
    const match = e.refId?.match(/focus-\w+-(\d+)/);
    return s + (match ? parseInt(match[1], 10) : 0);
  }, 0);

  // Group by day for the heatmap
  const byDay = new Map<string, number>();
  for (const e of focusEvents) {
    const key = e.createdAt.toISOString().slice(0, 10);
    const match = e.refId?.match(/focus-\w+-(\d+)/);
    const minutes = match ? parseInt(match[1], 10) : 0;
    byDay.set(key, (byDay.get(key) ?? 0) + minutes);
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayMinutes = byDay.get(today) ?? 0;

  return ok({
    totalSessions: focusEvents.length,
    totalMinutes,
    todayMinutes,
    sessionsByDay: Array.from(byDay.entries()).map(([date, minutes]) => ({ date, minutes })),
  });
}
