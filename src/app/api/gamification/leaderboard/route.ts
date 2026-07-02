/**
 * GET /api/gamification/leaderboard — top users by XP.
 */
import { ok, ApiError } from "@/lib/api";
import { getLeaderboard } from "@/lib/gamification";
import { getSession } from "@/lib/session";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? 10);
  const board = await getLeaderboard(Math.min(limit, 50));

  const myRank = board.findIndex((b) => b.id === session.user.id);
  return ok({
    leaderboard: board,
    myRank: myRank >= 0 ? myRank + 1 : null,
  });
}
