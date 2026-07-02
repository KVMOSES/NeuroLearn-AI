/**
 * POST /api/lesson-studio/export/pptx
 * Export a presentation to PPTX.
 */
import { getSession } from "@/lib/session";
import { ApiError } from "@/lib/api";
import { exportPresentationToPPTX, type Presentation, type PresentationStyle } from "@/lib/lesson-studio";
import { z } from "zod";

const schema = z.object({
  presentation: z.any(),
  style: z.enum(["university", "professional", "minimal", "dark", "modern"]).default("modern"),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  let body: unknown;
  try { body = await req.json(); } catch { return ApiError.Validation("Invalid JSON"); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  try {
    const pptxBuffer = await exportPresentationToPPTX(parsed.data.presentation as Presentation, parsed.data.style as PresentationStyle);
    return new Response(new Uint8Array(pptxBuffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${(parsed.data.presentation.title || "presentation").replace(/[^a-zA-Z0-9]/g, "_")}.pptx"`,
      },
    });
  } catch (err) {
    return ApiError.Internal(err instanceof Error ? err.message : "PPTX export failed");
  }
}
