/**
 * POST /api/documents/from-doc/quiz — generate + persist a quiz from a document.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { ragQuiz } from "@/lib/rag";
import { z } from "zod";
import { awardXP } from "@/lib/gamification";

const schema = z.object({
  documentId: z.string(),
  count: z.number().int().min(1).max(10).default(5),
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
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
    const { questions } = await ragQuiz(doc.id, parsed.data.count, parsed.data.difficulty);
    if (questions.length === 0) return ApiError.Internal("Failed to generate questions from this document");

    const quiz = await db.quiz.create({
      data: {
        title: `Quiz: ${doc.title}`,
        description: `Auto-generated from ${doc.fileName}`,
        documentId: doc.id,
        authorId: session.user.id,
        difficulty: parsed.data.difficulty,
      },
    });
    for (const q of questions) {
      await db.question.create({
        data: {
          quizId: quiz.id,
          prompt: q.prompt,
          options: JSON.stringify(q.options),
          correctIndex: q.correctIndex,
          explanation: q.explanation,
          difficulty: q.difficulty,
        },
      });
    }
    await awardXP(session.user.id, "document_upload", 0);
    return ok({
      quizId: quiz.id,
      title: quiz.title,
      questionCount: questions.length,
      questions: questions.map((q, i) => ({
        id: `gen-${i}`,
        prompt: q.prompt,
        options: q.options,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
        difficulty: q.difficulty,
      })),
    });
  } catch (err) {
    return ApiError.Internal(err instanceof Error ? err.message : "Quiz generation failed");
  }
}
