/**
 * Real document processing pipeline.
 * - Parses PDF (unpdf), DOCX (mammoth), PPTX (officeparser), TXT/MD (direct).
 * - Chunks text, generates TF-IDF embeddings, persists DocumentChunk rows.
 * - Stores original bytes under /storage for preview/re-download (local fallback when not on Vercel).
 */
import { db } from "@/lib/db";
import { pseudoEmbed } from "@/lib/learning";
import { summarizeDocument } from "@/lib/ai";
import { extractPdfText } from "@/lib/parsers/pdf";
import { extractDocxText } from "@/lib/parsers/docx";
import { extractPptxText } from "@/lib/parsers/pptx";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const STORAGE_DIR = path.join(process.cwd(), "storage");

export type DocSource = "pdf" | "docx" | "pptx" | "txt" | "md";

export function detectSource(mimeType: string, fileName: string): DocSource {
  const ext = path.extname(fileName).slice(1).toLowerCase();
  if (ext === "pdf" || mimeType === "application/pdf") return "pdf";
  if (ext === "docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (ext === "pptx" || mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return "pptx";
  if (ext === "md" || mimeType === "text/markdown") return "md";
  return "txt";
}

async function ensureStorage() {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

/**
 * Store a file to the local storage directory.
 * Falls back to local storage when Vercel Blob is unavailable.
 */
async function storeFile(buffer: Buffer, fileName: string): Promise<string> {
  await ensureStorage();
  const safeName = `${randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const filePath = path.join(STORAGE_DIR, safeName);
  await fs.writeFile(filePath, buffer);
  return path.join("storage", safeName);
}

/**
 * Extract plain text from a file buffer based on its source type.
 */
export async function extractText(
  source: DocSource,
  buffer: Buffer,
  fileName: string
): Promise<{ text: string; pageCount: number }> {
  switch (source) {
    case "pdf":
      return extractPdfText(buffer);
    case "docx":
      return extractDocxText(buffer);
    case "pptx":
      return extractPptxText(buffer);
    case "md":
    case "txt":
    default: {
      const text = buffer.toString("utf-8");
      return { text, pageCount: 0 };
    }
  }
}

/**
 * Chunk text into overlapping passages sized for retrieval.
 */
export function chunkText(text: string, size = 500, overlap = 100): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= size) return clean ? [clean] : [];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    const end = Math.min(clean.length, i + size);
    // try to break on a sentence/space boundary
    let boundary = end;
    if (end < clean.length) {
      const slice = clean.slice(i, end);
      const lastStop = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("\n"));
      if (lastStop > size * 0.5) boundary = i + lastStop + 1;
    }
    chunks.push(clean.slice(i, boundary).trim());
    if (boundary >= clean.length) break;
    i = boundary - overlap;
    if (i < 0) i = 0;
  }
  return chunks.filter((c) => c.length > 0);
}

function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export interface IngestResult {
  documentId: string;
  title: string;
  chunkCount: number;
  wordCount: number;
  pageCount: number;
  status: string;
}

/**
 * Full ingestion pipeline: store bytes, extract text, chunk, embed, summarize.
 */
export async function ingestDocument(
  userId: string,
  file: { name: string; type: string; size: number; buffer: Buffer },
  opts: { folderId?: string; tags?: string[] } = {}
): Promise<IngestResult> {
  await ensureStorage();
  const source = detectSource(file.type, file.name);
  const title = file.name.replace(/\.[^.]+$/, "");

  // Store original bytes to local storage
  const storagePath = await storeFile(file.buffer, file.name);

  // Create the document row in processing state
  const doc = await db.document.create({
    data: {
      userId,
      folderId: opts.folderId ?? null,
      title,
      sourceType: source,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      contentText: "",
      storagePath,
      tags: opts.tags ? JSON.stringify(opts.tags) : null,
      status: "processing",
    },
  });

  try {
    const { text, pageCount } = await extractText(source, file.buffer, file.name);
    const cleanText = text.trim();
    const wordCount = countWords(cleanText);

    if (cleanText.length === 0) {
      await db.document.update({
        where: { id: doc.id },
        data: { status: "failed" },
      });
      throw new Error("No text could be extracted from this file. The file may be empty, image-based (scanned PDF without OCR), or in an unsupported format.");
    }

    const chunks = chunkText(cleanText);
    
    // Try to summarize, but don't fail if AI is unavailable
    let summary = "";
    try {
      summary = await summarizeDocument(cleanText);
    } catch {
      // AI unavailable — continue without summary
    }

    await db.$transaction([
      db.document.update({
        where: { id: doc.id },
        data: {
          contentText: cleanText,
          summary: summary || null,
          status: "ready",
          wordCount,
          pageCount,
        },
      }),
      db.documentChunk.createMany({
        data: chunks.map((text, ordinal) => ({
          documentId: doc.id,
          ordinal,
          text,
          embedding: JSON.stringify(pseudoEmbed(text)),
        })),
      }),
    ]);

    return {
      documentId: doc.id,
      title,
      chunkCount: chunks.length,
      wordCount,
      pageCount,
      status: "ready",
    };
  } catch (err) {
    // Update document status to failed with the error message
    const errorMessage = err instanceof Error ? err.message : "Unknown error during document processing";
    await db.document.update({
      where: { id: doc.id },
      data: { 
        status: "failed",
        summary: null,
        contentText: errorMessage,
      },
    });
    throw err;
  }
}

/**
 * Read the stored original bytes for a document (preview/download).
 */
export async function readDocumentBytes(doc: { storagePath: string | null }): Promise<Buffer | null> {
  if (!doc.storagePath) return null;
  const abs = path.join(process.cwd(), doc.storagePath);
  try {
    return await fs.readFile(abs);
  } catch {
    return null;
  }
}

/**
 * Delete the stored file for a document.
 */
export async function deleteDocumentBytes(storagePath: string | null): Promise<void> {
  if (!storagePath) return;
  const abs = path.join(process.cwd(), storagePath);
  try {
    await fs.unlink(abs);
  } catch {
    // ignore missing file
  }
}