/**
 * DOCX text extraction using mammoth.
 */
import mammoth from "mammoth";

export async function extractDocxText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  try {
    const result = await mammoth.extractRawText({ buffer });
    return { text: result.value, pageCount: 0 };
  } catch (err) {
    throw new Error(
      `DOCX extraction failed: ${err instanceof Error ? err.message : "unknown error"}`
    );
  }
}
