/**
 * GET /api/learning/readiness — exam readiness prediction + skill mastery.
 */
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { computeExamReadiness } from "@/lib/learning-service";

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const result = await computeExamReadiness(session.user.id);
  return ok(result);
}
