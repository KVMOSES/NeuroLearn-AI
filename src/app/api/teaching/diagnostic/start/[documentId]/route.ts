/**
 * POST /api/teaching/diagnostic/start/:documentId
 * Generates an adaptive diagnostic assessment with mixed question types.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { generateDiagnostic, type DiagnosticQuestion } from "@/lib/teaching";
import { z } from "zod";

const schema = z.object({ count: z.number().int().min(4).max(15).default(8) });

export async function POST(req: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const { documentId } = await params;

  const doc = await db.document.findFirst({ where: { id: documentId, userId: session.user.id } });
  if (!doc) return ApiError.NotFound("Document");

  let body: unknown = {};
  try { body = await req.json(); } catch { /* allow empty */ }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  // Check topics exist — if not, need to analyze first
  const topicCount = await db.topic.count({ where: { documentId } });
  if (topicCount === 0) {
    return ApiError.Validation("Document has not been analyzed yet. Call /api/teaching/analyze first.");
  }

  try {
    const questions = await generateDiagnostic(documentId, parsed.data.count);
    if (questions.length === 0) return ApiError.Internal("Failed to generate diagnostic questions");

    // Create diagnostic session
    const diagSession = await db.diagnosticSession.create({
      data: { userId: session.user.id, documentId, status: "active" },
    });

    return ok({
      sessionId: diagSession.id,
      questions: questions.map((q, i) => ({
        id: `diag-${i}`,
        ...q,
        // Don't send correct answers to the client
        correctIndex: undefined,
        correctAnswer: undefined,
        numericAnswer: undefined,
      })),
    });
  } catch (err) {
    return ApiError.Internal(err instanceof Error ? err.message : "Failed to start diagnostic");
  }
}
