/**
 * GET /api/teaching/insights — get AI-generated learning insights from Learning DNA.
 */
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { generateInsights } from "@/lib/learning-dna";

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const insights = await generateInsights(session.user.id);
  return ok({ insights });
}
