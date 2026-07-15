/**
 * POST /api/lesson-studio/presentation
 * Generate a premium presentation from a document.
 * Supports style, color palette, slide count, and progress tracking via streaming.
 */
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { generatePresentation, type PresentationStyle, type ColorPalette } from "@/lib/lesson-studio";
import { z } from "zod";

const schema = z.object({
  documentId: z.string(),
  slideCount: z.number().int().min(3).max(30).default(10),
  style: z.enum(["university", "professional", "minimal", "dark", "modern", "vibrant", "elegant"]).default("modern"),
  palette: z.enum(["default", "ocean", "sunset", "forest", "midnight", "coral", "lavender"]).default("default"),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  let body: unknown;
  try { body = await req.json(); } catch { return ApiError.Validation("Invalid JSON"); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  try {
    const presentation = await generatePresentation(
      parsed.data.documentId,
      parsed.data.slideCount,
      parsed.data.style as PresentationStyle,
      parsed.data.palette as ColorPalette
    );
    return ok({ presentation });
  } catch (err) {
    return ApiError.Internal(err instanceof Error ? err.message : "Generation failed");
  }
}