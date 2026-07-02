/**
 * POST /api/teaching/analyze/:documentId
 * Analyzes a document and creates a hierarchical topic structure with
 * prerequisites, difficulty, concepts, formulas, and definitions.
 */

import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { analyzeDocument, persistTopicStructure } from "@/lib/teaching";
import { awardXP } from "@/lib/gamification";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const { documentId } = await params;

  const doc = await db.document.findFirst({
    where: {
      id: documentId,
      userId: session.user.id,
    },
  });

  if (!doc) return ApiError.NotFound("Document");

  if (doc.status !== "ready") {
    return ApiError.Validation("Document is not ready for analysis");
  }

  const existingTopics = await db.topic.count({
    where: { documentId },
  });

  if (existingTopics > 0) {
    return ok({
      alreadyAnalyzed: true,
      topicCount: existingTopics,
    });
  }

  try {
    console.log("========== ANALYSIS START ==========");
    console.log("Document:", documentId);
    console.log("User:", session.user.id);

    const analysis = await analyzeDocument(documentId);

    console.log("AI analysis completed successfully.");

    await persistTopicStructure(
      documentId,
      analysis,
      session.user.id
    );

    console.log("Topics saved successfully.");

    await awardXP(
      session.user.id,
      "document_upload",
      30,
      documentId
    );

    console.log("XP awarded.");
    console.log("========== ANALYSIS COMPLETE ==========");

    return ok({
      analyzed: true,
      title: analysis.title,
      summary: analysis.overallSummary,
      topicCount: await db.topic.count({
        where: { documentId },
      }),
    });
  } catch (err) {
    console.error("\n========== ANALYSIS FAILED ==========");
    console.error(err);

    if (err instanceof Error) {
      console.error("Message:", err.message);
      console.error("Stack:");
      console.error(err.stack);
    }

    console.error("Document ID:", documentId);
    console.error("User ID:", session.user.id);
    console.error("=====================================\n");

    return ApiError.Internal(
      err instanceof Error ? err.message : "Analysis failed"
    );
  }
}