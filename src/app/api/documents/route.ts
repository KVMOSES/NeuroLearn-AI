/**
 * GET  /api/documents        — list user's documents (with folders, tags, filters)
 * POST /api/documents        — multipart upload (file + optional folderId/tags)
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";
import { ingestDocument, detectSource } from "@/lib/documents";
import { awardXP } from "@/lib/gamification";
import { z } from "zod";

export async function GET(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const url = new URL(req.url);
  const folderId = url.searchParams.get("folderId");
  const sourceType = url.searchParams.get("sourceType");
  const q = url.searchParams.get("q");

  const docs = await db.document.findMany({
    where: {
      userId: session.user.id,
      ...(folderId === "null" || folderId === "none" ? { folderId: null } : folderId ? { folderId } : {}),
      ...(sourceType ? { sourceType } : {}),
      ...(q ? { OR: [{ title: { contains: q } }, { contentText: { contains: q } }] } : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { chunks: true, flashcards: true, quizzes: true } } },
  });

  return ok({
    documents: docs.map((d) => ({
      id: d.id,
      title: d.title,
      sourceType: d.sourceType,
      fileName: d.fileName,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      status: d.status,
      wordCount: d.wordCount,
      pageCount: d.pageCount,
      summary: d.summary,
      folderId: d.folderId,
      tags: d.tags ? JSON.parse(d.tags) : [],
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      chunkCount: d._count.chunks,
      flashcardCount: d._count.flashcards,
      quizCount: d._count.quizzes,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return ApiError.Validation("Expected multipart/form-data upload");
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return ApiError.Validation("Failed to parse form data");
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return ApiError.Validation("No file uploaded. Use field name 'file'.");
  }

  const MAX = 25 * 1024 * 1024; // 25MB
  if (file.size > MAX) {
    return ApiError.Validation("File too large (max 25MB)");
  }

  const folderId = (form.get("folderId") as string) || null;
  const tagsRaw = form.get("tags") as string | null;
  let tags: string[] = [];
  if (tagsRaw) {
    try {
      tags = JSON.parse(tagsRaw);
    } catch {
      tags = tagsRaw.split(",").map((t) => t.trim()).filter(Boolean);
    }
  }

  // Validate source type is supported
  const source = detectSource(file.type, file.name);
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const result = await ingestDocument(
      session.user.id,
      { name: file.name, type: file.type, size: file.size, buffer },
      { folderId: folderId || undefined, tags }
    );
    await awardXP(session.user.id, "document_upload");
    return ok(result, undefined, 201);
  } catch (err) {
    return ApiError.Internal(err instanceof Error ? err.message : "Document ingestion failed");
  }
}
