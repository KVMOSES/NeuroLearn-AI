/**
 * GET /api/teaching/profile — get the current user's learner profile.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";

export async function GET() {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const profile = await db.learnerProfile.findUnique({ where: { userId: session.user.id } });
  if (!profile) {
    return ok({ profile: null });
  }

  return ok({
    profile: {
      priorKnowledge: Math.round(profile.priorKnowledge * 100),
      conceptualUnderstanding: Math.round(profile.conceptualUnderstanding * 100),
      reasoningAbility: Math.round(profile.reasoningAbility * 100),
      confidence: Math.round(profile.confidence * 100),
      learningSpeed: Math.round(profile.learningSpeed * 100),
      preferredStyle: profile.preferredStyle,
      strengths: profile.strengths ? JSON.parse(profile.strengths) : [],
      weaknesses: profile.weaknesses ? JSON.parse(profile.weaknesses) : [],
      misconceptions: profile.misconceptions ? JSON.parse(profile.misconceptions) : [],
      totalAssessed: profile.totalAssessed,
      lastUpdated: profile.lastUpdated,
    },
  });
}
