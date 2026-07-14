/**
 * PDF text extraction using unpdf (serverless-friendly, no native deps).
 * Uses the high-level extractText API which handles PDF parsing internally.
 */
import { extractText } from "unpdf";

export async function extractPdfText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  try {
    const result = await extractText(new Uint8Array(buffer), { mergePages: true });
    return {
      text: result.text,
      pageCount: result.totalPages ?? 0,
    };
  } catch (err) {
    // Fallback: try per-page extraction via PDFDocumentProxy
    try {
      const { getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(buffer));
      const total = pdf.numPages ?? 0;
      if (total === 0) throw new Error("PDF appears to have no pages");

      const pages: string[] = [];
      for (let i = 1; i <= total; i++) {
        try {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const text = content.items
            .map((item: any) => (typeof item.str === "string" ? item.str : ""))
            .join(" ");
          pages.push(text);
        } catch {
          // skip unreadable page
        }
      }
      if (pages.length === 0) {
        throw new Error("No text could be extracted from any page");
      }
      return { text: pages.join("\n\n"), pageCount: total };
    } catch (fallbackErr) {
      throw new Error(
        `PDF extraction failed: ${err instanceof Error ? err.message : "unknown error"}` +
        (fallbackErr instanceof Error ? ` (fallback: ${fallbackErr.message})` : "")
      );
    }
  }
}
