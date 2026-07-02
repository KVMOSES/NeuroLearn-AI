/**
 * POST /api/lesson-studio/textbook — generate a complete textbook.
 */
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { generateTextbook } from "@/lib/lesson-studio";
import { z } from "zod";

const schema = z.object({ documentId: z.string() });

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  let body: unknown;
  try { body = await req.json(); } catch { return ApiError.Validation("Invalid JSON"); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  try {
    const textbook = await generateTextbook(parsed.data.documentId);
    return ok({ textbook });
  } catch (err) {
    return ApiError.Internal(err instanceof Error ? err.message : "Generation failed");
  }
}
