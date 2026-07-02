/**
 * POST /api/lesson-studio/notes
 * Generate study notes from a document.
 */
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { generateNotes, type NoteStyle, NOTE_STYLES } from "@/lib/lesson-studio";
import { z } from "zod";

const validStyles = NOTE_STYLES.map((s) => s.key) as [NoteStyle, ...NoteStyle[]];

const schema = z.object({
  documentId: z.string(),
  style: z.enum(validStyles),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  let body: unknown;
  try { body = await req.json(); } catch { return ApiError.Validation("Invalid JSON"); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  try {
    const notes = await generateNotes(parsed.data.documentId, parsed.data.style);
    return ok({ notes, style: parsed.data.style });
  } catch (err) {
    return ApiError.Internal(err instanceof Error ? err.message : "Generation failed");
  }
}
