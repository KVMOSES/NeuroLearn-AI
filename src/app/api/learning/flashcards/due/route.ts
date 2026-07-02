/**
 * GET /api/learning/flashcards/due — due + fresh flashcards for review.
 */
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { getDueFlashcards } from "@/lib/learning-service";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const url = new URL(req.url);
  const limit = Number(url.searchParams.get("limit") ?? 20);
  const result = await getDueFlashcards(session.user.id, Math.min(limit, 50));

  return ok({
    due: result.due.map((d) => ({
      reviewId: d.review.id,
      flashcard: d.flashcard,
      nextReview: d.review.nextReview,
      easeFactor: d.review.easeFactor,
      repetitions: d.review.repetitions,
    })),
    fresh: result.fresh.map((f) => ({ flashcard: f.flashcard })),
    totalDue: result.due.length,
    totalFresh: result.fresh.length,
  });
}
