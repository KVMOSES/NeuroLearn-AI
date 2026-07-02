/**
 * GET /api/teaching/predictions — learning predictions (exam readiness, forgetting forecast).
 */
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { getLearningPredictions } from "@/lib/atlas-engine";

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const predictions = await getLearningPredictions(session.user.id);
  return ok({ predictions });
}
