/**
 * POST /api/lesson-studio/video — generate an AI video lesson from a document.
 */
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { generateVideoLesson } from "@/lib/lesson-studio";
import { z } from "zod";

const schema = z.object({
  documentId: z.string(),
  topicId: z.string().nullable().optional(),
  teachingStyle: z.enum(["friendly", "academic", "energetic", "calm"]).default("friendly"),
  voice: z.enum(["nova", "atlas", "sage", "spark"]).default("nova"),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  let body: unknown;
  try { body = await req.json(); } catch { return ApiError.Validation("Invalid JSON"); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  try {
    const video = await generateVideoLesson(
      parsed.data.documentId,
      parsed.data.topicId ?? null,
      parsed.data.teachingStyle,
      parsed.data.voice
    );
    return ok({ video });
  } catch (err) {
    return ApiError.Internal(err instanceof Error ? err.message : "Generation failed");
  }
}
