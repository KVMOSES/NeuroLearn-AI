/**
 * GET /api/documents/[id]/preview — stream the original file bytes for preview/download.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ApiError } from "@/lib/api";
import { readDocumentBytes } from "@/lib/documents";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const { id } = await params;

  const doc = await db.document.findFirst({ where: { id, userId: session.user.id } });
  if (!doc) return ApiError.NotFound("Document");

  const bytes = await readDocumentBytes(doc);
  if (!bytes) return ApiError.NotFound("File not stored");

  const headers = new Headers();
  headers.set("Content-Type", doc.mimeType || "application/octet-stream");
  headers.set("Content-Length", String(bytes.length));
  headers.set(
    "Content-Disposition",
    `inline; filename="${encodeURIComponent(doc.fileName)}"`
  );
  return new Response(new Uint8Array(bytes), { headers });
}
