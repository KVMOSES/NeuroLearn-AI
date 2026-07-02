/**
 * PPTX text extraction — reads slide XML directly from the .pptx zip archive.
 * No external dependency beyond jszip (already installed).
 */
import JSZip from "jszip";

export async function extractPptxText(buffer: Buffer): Promise<{ text: string; pageCount: number }> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    // Slide files live at ppt/slides/slide1.xml, slide2.xml, ...
    const slideEntries = Object.keys(zip.files)
      .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
      .sort((a, b) => {
        const na = parseInt(a.match(/slide(\d+)\.xml/)?.[1] ?? "0", 10);
        const nb = parseInt(b.match(/slide(\d+)\.xml/)?.[1] ?? "0", 10);
        return na - nb;
      });

    if (slideEntries.length === 0) {
      return { text: "", pageCount: 0 };
    }

    const slides: string[] = [];
    for (const entry of slideEntries) {
      const xml = await zip.files[entry].async("string");
      // Extract <a:t>...</a:t> text runs and join with spaces
      const matches = xml.match(/<a:t>([^<]*)<\/a:t>/g) || [];
      const text = matches
        .map((m) => m.replace(/<a:t>|<\/a:t>/g, ""))
        .join(" ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'");
      if (text.trim()) slides.push(text);
    }
    return { text: slides.join("\n\n"), pageCount: slides.length };
  } catch (err) {
    throw new Error(
      `PPTX extraction failed: ${err instanceof Error ? err.message : "unknown error"}`
    );
  }
}
