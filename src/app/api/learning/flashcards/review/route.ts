/**
 * POST /api/learning/flashcards/review — record a flashcard review (SM-2).
 */
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { flashcardReviewSchema } from "@/lib/validators";
import { reviewFlashcard } from "@/lib/learning-service";

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiError.Validation("Invalid JSON body");
  }
  const parsed = flashcardReviewSchema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  const review = await reviewFlashcard(session.user.id, parsed.data.flashcardId, parsed.data.quality);
  return ok({
    review: {
      id: review.id,
      repetitions: review.repetitions,
      interval: review.interval,
      easeFactor: review.easeFactor,
      nextReview: review.nextReview,
    },
  });
}
