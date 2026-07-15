/**
 * Vercel Blob storage utility with local filesystem fallback.
 *
 * - When BLOB_READ_WRITE_TOKEN is set (Vercel production), uses @vercel/blob.
 * - Otherwise falls back to local /storage directory (local development).
 *
 * The storagePath stored in the database will be either:
 *   - A full Blob URL (e.g. https://xxx.public.blob.vercel-storage.com/...)
 *   - A relative local path (e.g. storage/uuid-filename.pdf)
 */
import { put, del } from "@vercel/blob";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

const STORAGE_DIR = path.join(process.cwd(), "storage");

/** Whether Vercel Blob is configured via environment variable */
function useBlob(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

async function ensureLocalDir() {
  try {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  } catch {
    // ignore
  }
}

/**
 * Store a file buffer and return a storage identifier.
 * On Vercel: returns the full Blob URL.
 * Locally: returns a relative path like "storage/uuid-filename".
 */
export async function storeFile(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const safeName = `${randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  if (useBlob()) {
    const blob = await put(safeName, buffer, {
      access: "public",
      contentType: "application/octet-stream",
    });
    return blob.url;
  }

  // Local fallback
  await ensureLocalDir();
  const filePath = path.join(STORAGE_DIR, safeName);
  await fs.writeFile(filePath, buffer);
  return path.join("storage", safeName);
}

/**
 * Read stored file bytes.
 * Accepts either a full Blob URL or a relative local path.
 */
export async function readFile(storagePath: string): Promise<Buffer | null> {
  if (!storagePath) return null;

  // If it's a Blob URL, fetch it
  if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
    try {
      const res = await fetch(storagePath);
      if (!res.ok) return null;
      const arrayBuffer = await res.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch {
      return null;
    }
  }

  // Local path
  try {
    const abs = path.join(process.cwd(), storagePath);
    return await fs.readFile(abs);
  } catch {
    return null;
  }
}

/**
 * Delete a stored file.
 * Accepts either a full Blob URL or a relative local path.
 */
export async function deleteFile(storagePath: string): Promise<void> {
  if (!storagePath) return;

  if (storagePath.startsWith("http://") || storagePath.startsWith("https://")) {
    try {
      await del(storagePath);
    } catch {
      // ignore
    }
    return;
  }

  // Local path
  try {
    const abs = path.join(process.cwd(), storagePath);
    await fs.unlink(abs);
  } catch {
    // ignore missing file
  }
}

/**
 * Write a transient file to /tmp for processing (e.g. during parsing).
 * These files are automatically cleaned up by the OS but we delete them
 * explicitly after use.
 */
export async function writeTempFile(
  buffer: Buffer,
  fileName: string
): Promise<string> {
  const tmpDir = path.join("/tmp", "neurolearn");
  await fs.mkdir(tmpDir, { recursive: true });
  const tmpPath = path.join(tmpDir, `${randomUUID()}-${fileName}`);
  await fs.writeFile(tmpPath, buffer);
  return tmpPath;
}

/**
 * Delete a transient /tmp file.
 */
export async function deleteTempFile(tmpPath: string): Promise<void> {
  try {
    await fs.unlink(tmpPath);
  } catch {
    // ignore
  }
}