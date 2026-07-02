/**
 * POST /api/documents/search — semantic + keyword search across the user's documents.
 */
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { z } from "zod";
import { retrieve } from "@/lib/rag";

const schema = z.object({
  query: z.string().min(1).max(500),
  folderId: z.string().optional(),
  documentId: z.string().optional(),
  topK: z.number().int().min(1).max(20).optional().default(8),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  let body: unknown;
  try { body = await req.json(); } catch { return ApiError.Validation("Invalid JSON"); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  const result = await retrieve(session.user.id, parsed.data.query, {
    documentId: parsed.data.documentId,
    folderId: parsed.data.folderId,
    topK: parsed.data.topK,
  });
  return ok({ query: parsed.data.query, citations: result.citations });
}
