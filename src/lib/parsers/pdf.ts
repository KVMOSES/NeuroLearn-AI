/**
 * PDF text extraction using unpdf (serverless-friendly, no native deps).
 */
import { extractText, getDocumentProxy } from "unpdf";

export async function extractPdfText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  try {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const pages: string[] = [];
    const total = pdf.numPages ?? 0;
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
      // fallback: try unpdf's higher-level extractText
      const result = await extractText(pdf, { mergePages: true });
      return { text: result.text, pageCount: result.totalPages ?? 0 };
    }
    return { text: pages.join("\n\n"), pageCount: total };
  } catch (err) {
    throw new Error(
      `PDF extraction failed: ${err instanceof Error ? err.message : "unknown error"}`
    );
  }
}
