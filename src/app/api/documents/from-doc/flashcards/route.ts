/**
 * POST /api/documents/from-doc/flashcards — generate + persist flashcards from a document.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { ragFlashcards } from "@/lib/rag";
import { z } from "zod";
import { awardXP } from "@/lib/gamification";

const schema = z.object({
  documentId: z.string(),
  count: z.number().int().min(1).max(20).default(8),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  let body: unknown;
  try { body = await req.json(); } catch { return ApiError.Validation("Invalid JSON"); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  const doc = await db.document.findFirst({
    where: { id: parsed.data.documentId, userId: session.user.id },
  });
  if (!doc) return ApiError.NotFound("Document");

  try {
    const { flashcards } = await ragFlashcards(doc.id, parsed.data.count);
    if (flashcards.length === 0) return ApiError.Internal("Failed to generate flashcards from this document");

    const created = await Promise.all(
      flashcards.map((fc) =>
        db.flashcard.create({
          data: {
            authorId: session.user.id,
            documentId: doc.id,
            front: fc.front,
            back: fc.back,
            hint: fc.hint ?? null,
            tags: JSON.stringify([doc.title]),
          },
        })
      )
    );
    await awardXP(session.user.id, "flashcard_review", 0);
    return ok({
      documentId: doc.id,
      flashcardCount: created.length,
      flashcards: created.map((f) => ({ id: f.id, front: f.front, back: f.back, hint: f.hint })),
    });
  } catch (err) {
    return ApiError.Internal(err instanceof Error ? err.message : "Flashcard generation failed");
  }
}
