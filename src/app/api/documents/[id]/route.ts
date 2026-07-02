/**
 * GET    /api/documents/[id] — document detail + chunks
 * PATCH  /api/documents/[id] — rename / move folder / retag
 * DELETE /api/documents/[id] — remove document + chunks + stored bytes
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { readDocumentBytes } from "@/lib/documents";
import fs from "fs/promises";
import path from "path";
import { z } from "zod";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const { id } = await params;

  const doc = await db.document.findFirst({
    where: { id, userId: session.user.id },
    include: {
      folder: true,
      chunks: { orderBy: { ordinal: "asc" }, take: 1 },
      _count: { select: { flashcards: true, quizzes: true, chunks: true } },
    },
  });
  if (!doc) return ApiError.NotFound("Document");

  return ok({
    document: {
      id: doc.id,
      title: doc.title,
      sourceType: doc.sourceType,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      sizeBytes: doc.sizeBytes,
      status: doc.status,
      wordCount: doc.wordCount,
      pageCount: doc.pageCount,
      summary: doc.summary,
      contentPreview: doc.contentText.slice(0, 2000),
      contentLength: doc.contentText.length,
      folder: doc.folder,
      tags: doc.tags ? JSON.parse(doc.tags) : [],
      storagePath: doc.storagePath,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      chunkCount: doc._count.chunks,
      flashcardCount: doc._count.flashcards,
      quizCount: doc._count.quizzes,
    },
  });
}

const patchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  folderId: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return ApiError.Validation("Invalid JSON");
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return ApiError.Validation("Validation failed", parsed.error.flatten());

  const existing = await db.document.findFirst({ where: { id, userId: session.user.id } });
  if (!existing) return ApiError.NotFound("Document");

  const updated = await db.document.update({
    where: { id },
    data: {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.folderId !== undefined ? { folderId: parsed.data.folderId } : {}),
      ...(parsed.data.tags !== undefined ? { tags: JSON.stringify(parsed.data.tags) } : {}),
    },
  });
  return ok({ document: { id: updated.id, title: updated.title, folderId: updated.folderId } });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const { id } = await params;

  const doc = await db.document.findFirst({ where: { id, userId: session.user.id } });
  if (!doc) return ApiError.NotFound("Document");

  // remove stored bytes
  if (doc.storagePath) {
    try {
      await fs.unlink(path.join(process.cwd(), doc.storagePath));
    } catch {
      // ignore missing file
    }
  }
  await db.document.delete({ where: { id } });
  return ok({ deleted: true });
}
