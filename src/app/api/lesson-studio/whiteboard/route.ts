/**
 * POST /api/lesson-studio/whiteboard — generate an AI whiteboard explanation.
 */
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { generateWhiteboard } from "@/lib/lesson-studio";
import { z } from "zod";

const schema = z.object({
  documentId: z.string(),
  topicId: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  let body: unknown;
  try { body = await req.json(); } catch { return ApiError.Validation("Invalid JSON"); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  try {
    const whiteboard = await generateWhiteboard(parsed.data.documentId, parsed.data.topicId ?? null);
    return ok({ whiteboard });
  } catch (err) {
    return ApiError.Internal(err instanceof Error ? err.message : "Generation failed");
  }
}
