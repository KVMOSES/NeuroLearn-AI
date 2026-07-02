/**
 * POST /api/lesson-studio/export/pdf
 * Export text content (notes, summaries, cheat sheets) to PDF.
 */
import { getSession } from "@/lib/session";
import { ApiError } from "@/lib/api";
import { exportToPDF } from "@/lib/lesson-studio";
import { z } from "zod";

const schema = z.object({
  title: z.string(),
  content: z.string(),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  let body: unknown;
  try { body = await req.json(); } catch { return ApiError.Validation("Invalid JSON"); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  try {
    const pdfBuffer = await exportToPDF(parsed.data.title, parsed.data.content);
    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${parsed.data.title.replace(/[^a-zA-Z0-9]/g, "_")}.pdf"`,
      },
    });
  } catch (err) {
    return ApiError.Internal(err instanceof Error ? err.message : "PDF export failed");
  }
}
