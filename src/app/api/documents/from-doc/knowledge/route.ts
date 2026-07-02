/**
 * POST /api/documents/from-doc/knowledge — extract skills + edges from a document
 * and persist them as the user's knowledge graph.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { ragKnowledgeGraph } from "@/lib/rag";
import { z } from "zod";

const schema = z.object({ documentId: z.string() });

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
    const graph = await ragKnowledgeGraph(doc.id);
    if (graph.skills.length === 0) return ApiError.Internal("Failed to extract knowledge graph");

    // Persist skills (upsert by name) tied to this document
    const skillRecords = await Promise.all(
      graph.skills.map((s) =>
        db.skill.upsert({
          where: { name: s.name },
          create: {
            name: s.name,
            description: s.description,
            category: s.category || doc.title,
            sourceDocumentId: doc.id,
          },
          update: {
            description: s.description,
            category: s.category || doc.title,
            sourceDocumentId: doc.id,
          },
        })
      )
    );
    const nameToId = new Map(skillRecords.map((s) => [s.name, s.id]));

    // Persist edges
    let edgeCount = 0;
    for (const e of graph.edges) {
      const fromId = nameToId.get(e.from);
      const toId = nameToId.get(e.to);
      if (!fromId || !toId || fromId === toId) continue;
      try {
        await db.skillPrerequisite.create({ data: { skillId: toId, prerequisiteId: fromId } });
        edgeCount++;
      } catch {
        // unique constraint — edge already exists
      }
    }

    return ok({
      documentId: doc.id,
      summary: graph.summary,
      skillCount: skillRecords.length,
      edgeCount,
      skills: skillRecords.map((s) => ({ id: s.id, name: s.name, category: s.category })),
    });
  } catch (err) {
    return ApiError.Internal(err instanceof Error ? err.message : "Knowledge graph extraction failed");
  }
}
