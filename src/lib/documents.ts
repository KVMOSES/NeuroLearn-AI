/**
 * Real document processing pipeline.
 * - Parses PDF (unpdf), DOCX (mammoth), PPTX (officeparser), TXT/MD (direct).
 * - Chunks text, generates TF-IDF embeddings, persists DocumentChunk rows.
 * - Stores original bytes via Vercel Blob (production) or local /storage (development),
 *   never writing to the read-only application directory on Vercel.
 */
import { db } from "@/lib/db";
import { pseudoEmbed } from "@/lib/learning";
import { summarizeDocument } from "@/lib/ai";
import { extractPdfText } from "@/lib/parsers/pdf";
import { extractDocxText } from "@/lib/parsers/docx";
import { extractPptxText } from "@/lib/parsers/pptx";
import { storeFile, readFile, deleteFile } from "@/lib/blob";
import path from "path";

export type DocSource = "pdf" | "docx" | "pptx" | "txt" | "md";

export function detectSource(mimeType: string, fileName: string): DocSource {
  const ext = path.extname(fileName).slice(1).toLowerCase();
  if (ext === "pdf" || mimeType === "application/pdf") return "pdf";
  if (ext === "docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") return "docx";
  if (ext === "pptx" || mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") return "pptx";
  if (ext === "md" || mimeType === "text/markdown") return "md";
  return "txt";
}

/**
 * Extract plain text from a file buffer based on its source type.
 * For parsers that require a file path (some PDF/Office libs), writes
 * a transient copy to /tmp and removes it after extraction.
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
 * Full ingestion pipeline: store bytes via Blob/local, extract text, chunk, embed, summarize.
 * No filesystem writes to application directory — uses Vercel Blob in production,
 * /tmp for transient parser files (cleaned up after), and local /storage as dev fallback.
 */
export async function ingestDocument(
  userId: string,
  file: { name: string; type: string; size: number; buffer: Buffer },
  opts: { folderId?: string; tags?: string[] } = {}
): Promise<IngestResult> {
  const source = detectSource(file.type, file.name);
  const title = file.name.replace(/\.[^.]+$/, "");

  // Store original bytes — uses Vercel Blob (production) or local /storage (dev)
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
 * Works with both Vercel Blob URLs and local paths.
 */
export async function readDocumentBytes(doc: { storagePath: string | null }): Promise<Buffer | null> {
  if (!doc.storagePath) return null;
  return readFile(doc.storagePath);
}

/**
 * Delete the stored file for a document.
 * Works with both Vercel Blob URLs and local paths.
 */
export async function deleteDocumentBytes(storagePath: string | null): Promise<void> {
  if (!storagePath) return;
  return deleteFile(storagePath);
}