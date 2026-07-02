/**
 * AI Lesson Studio — generates complete learning resources from uploaded documents.
 *
 * Generators:
 * - Presentations (slides with title, agenda, topics, examples, summary, Q&A, references)
 * - Study Notes (quick, detailed, lecture, exam, revision, one-page, key concepts, definitions, formula sheet, interview)
 * - Cheat Sheets (formulas, definitions, shortcuts, memory tricks, common mistakes, exam tips)
 * - Mind Maps (interactive hierarchical node structure)
 * - Courses (modules → lessons → topics → quizzes → flashcards → revision plan)
 * - Summaries (executive, student, detailed, exam, last-minute, bullet, interview prep)
 *
 * All generators use the existing AI pipeline and reflect the uploaded document.
 */
import { db } from "@/lib/db";
import { generateText, tryParseModelJSON } from "@/lib/ai";

// ============================================================
// SHARED HELPERS
// ============================================================

async function getDocumentContext(documentId: string) {
  const doc = await db.document.findUnique({
    where: { id: documentId },
    include: {
      chunks: { orderBy: { ordinal: "asc" }, take: 20 },
      topics: { where: { level: { lte: 2 } }, orderBy: { order: "asc" } },
    },
  });
  if (!doc) throw new Error("Document not found");

  const corpus = doc.chunks.map((c) => c.text).join("\n\n").slice(0, 15000) || doc.contentText.slice(0, 15000);
  const topicTitles = doc.topics.map((t) => t.title);

  return { doc, corpus, topicTitles };
}

async function aiGenerate(systemPrompt: string, userPrompt: string): Promise<string> {
  try {
    return await generateText([
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ]);
  } catch {
    return "";
  }
}

function parseJSON<T>(raw: string): T | null {
  return tryParseModelJSON<T>(raw);
}

// ============================================================
// FEATURE 1 — AI PRESENTATION GENERATOR
// ============================================================

export interface PresentationSlide {
  type: "title" | "agenda" | "topic" | "example" | "summary" | "revision" | "qa" | "references" | "objectives";
  title: string;
  content: string[];
  speakerNotes?: string;
  icon?: string;
}

export interface Presentation {
  title: string;
  subtitle: string;
  slides: PresentationSlide[];
}

export type PresentationStyle = "university" | "professional" | "minimal" | "dark" | "modern";

export async function generatePresentation(
  documentId: string,
  slideCount: number,
  style: PresentationStyle
): Promise<Presentation> {
  const { doc, corpus, topicTitles } = await getDocumentContext(documentId);

  const styleGuides: Record<PresentationStyle, string> = {
    university: "Academic style with clear structure, citations, and formal language.",
    professional: "Business-professional with clean layouts, data points, and executive tone.",
    minimal: "Minimalist with lots of whitespace, short text, and focus on key points.",
    dark: "Dark theme with high contrast, modern typography, and accent colors.",
    modern: "Modern design with bold colors, icons, and visual hierarchy.",
  };

  const systemPrompt = `You are an expert presentation designer. Create a professional ${slideCount}-slide presentation from the provided document.

Style: ${styleGuides[style]}

Return ONLY strict JSON (no markdown):
{
  "title": "presentation title",
  "subtitle": "one-line subtitle",
  "slides": [
    {
      "type": "title|agenda|topic|example|summary|revision|qa|references|objectives",
      "title": "slide title",
      "content": ["bullet point 1", "bullet point 2", "bullet point 3"],
      "speakerNotes": "what the presenter should say",
      "icon": "emoji icon"
    }
  ]
}

Rules:
- Include a title slide, agenda, topic slides, examples, summary, revision, Q&A, and references.
- Keep slide text minimal — 3-5 bullet points max per slide.
- Speaker notes should be 2-3 sentences.
- Use emoji icons relevant to each slide's content.
- Total slides should be approximately ${slideCount}.
- Content must be derived from the document, not generic.`;

  const userPrompt = `Document: ${doc.title}\nTopics: ${topicTitles.join(", ")}\n\nContent:\n${corpus}`;

  const raw = await aiGenerate(systemPrompt, userPrompt);
  const parsed = parseJSON<Presentation>(raw);
  if (!parsed || !parsed.slides) {
    return {
      title: doc.title,
      subtitle: "AI-Generated Presentation",
      slides: [
        { type: "title", title: doc.title, content: ["AI-Generated Presentation"], speakerNotes: "Welcome to this presentation.", icon: "📋" },
        { type: "summary", title: "Summary", content: ["Unable to generate full presentation. Please try again."], icon: "📝" },
      ],
    };
  }
  return parsed;
}

// ============================================================
// FEATURE 2 — AI STUDY NOTES
// ============================================================

export type NoteStyle =
  | "quick" | "detailed" | "lecture" | "exam" | "revision"
  | "one-page" | "key-concepts" | "definitions" | "formula-sheet" | "interview";

export const NOTE_STYLES: { key: NoteStyle; label: string; icon: string; description: string }[] = [
  { key: "quick", label: "Quick Notes", icon: "⚡", description: "Fast overview of key points" },
  { key: "detailed", label: "Detailed Notes", icon: "📖", description: "Comprehensive in-depth notes" },
  { key: "lecture", label: "Lecture Notes", icon: "🎓", description: "Structured like a university lecture" },
  { key: "exam", label: "Exam Notes", icon: "📝", description: "Focused on what's likely on the exam" },
  { key: "revision", label: "Revision Notes", icon: "🔄", description: "Condensed for quick review" },
  { key: "one-page", label: "One-Page Summary", icon: "📄", description: "Everything on a single page" },
  { key: "key-concepts", label: "Key Concepts", icon: "💡", description: "Core concepts only" },
  { key: "definitions", label: "Definitions", icon: "📚", description: "All key terms and definitions" },
  { key: "formula-sheet", label: "Formula Sheet", icon: "🔢", description: "All formulas in one place" },
  { key: "interview", label: "Interview Notes", icon: "💼", description: "Interview-level depth" },
];

export async function generateNotes(documentId: string, style: NoteStyle): Promise<string> {
  const { doc, corpus, topicTitles } = await getDocumentContext(documentId);

  const stylePrompts: Record<NoteStyle, string> = {
    quick: "Create quick notes — short bullet points covering the most important concepts. Keep it concise and scannable.",
    detailed: "Create detailed notes — comprehensive coverage of every topic with explanations, examples, and context. Use headings and subheadings.",
    lecture: "Create lecture notes — structured like a university lecture with introduction, main content, examples, and conclusion. Include learning objectives.",
    exam: "Create exam notes — focus on what's most likely to appear on an exam. Include key formulas, definitions, common question types, and mark-scoring points.",
    revision: "Create revision notes — condensed, high-density notes for quick review before an exam. Use bullet points and tables.",
    "one-page": "Create a one-page summary — everything important on a single page. Use dense formatting with tables and bullet points.",
    "key-concepts": "Extract only the key concepts — the fundamental ideas the student must understand. Explain each in 1-2 sentences.",
    definitions: "Extract all key terms and definitions from the document. Format as a glossary with term: definition.",
    "formula-sheet": "Extract all formulas from the document. Include the formula, what each variable means, and when to use it.",
    interview: "Create interview preparation notes — technical depth, common interview questions on these topics, and key points to mention.",
  };

  const systemPrompt = `You are an expert academic note-taker. ${stylePrompts[style]}

Use Markdown formatting with:
- Headings (## for sections, ### for subsections)
- Bold for key terms
- Bullet points for lists
- Code blocks for formulas or code
- Tables where appropriate

The notes must be derived from the document content, not generic.`;

  const userPrompt = `Document: ${doc.title}\nTopics: ${topicTitles.join(", ")}\n\nContent:\n${corpus}`;

  return await aiGenerate(systemPrompt, userPrompt);
}

// ============================================================
// FEATURE 3 — AI CHEAT SHEETS
// ============================================================

export interface CheatSheet {
  title: string;
  formulas: { formula: string; description: string }[];
  definitions: { term: string; definition: string }[];
  concepts: string[];
  shortcuts: string[];
  memoryTricks: string[];
  commonMistakes: string[];
  examTips: string[];
}

export async function generateCheatSheet(documentId: string): Promise<CheatSheet> {
  const { doc, corpus, topicTitles } = await getDocumentContext(documentId);

  const systemPrompt = `You are an expert at creating concise cheat sheets. Generate a cheat sheet from the provided document.

Return ONLY strict JSON (no markdown):
{
  "title": "cheat sheet title",
  "formulas": [{"formula": "the formula", "description": "when to use it"}],
  "definitions": [{"term": "key term", "definition": "short definition"}],
  "concepts": ["key concept 1", "key concept 2"],
  "shortcuts": ["shortcut or trick 1", "shortcut or trick 2"],
  "memoryTricks": ["mnemonic or memory aid 1"],
  "commonMistakes": ["common mistake 1", "how to avoid it"],
  "examTips": ["exam tip 1", "exam tip 2"]
}

Rules:
- Be concise — this is a cheat sheet, not full notes.
- Only include formulas, definitions, and concepts that appear in the document.
- Memory tricks should help remember the specific concepts in this document.
- Common mistakes should be specific to this document's topics.`;

  const userPrompt = `Document: ${doc.title}\nTopics: ${topicTitles.join(", ")}\n\nContent:\n${corpus}`;

  const raw = await aiGenerate(systemPrompt, userPrompt);
  const parsed = parseJSON<CheatSheet>(raw);
  if (!parsed) {
    return {
      title: doc.title + " — Cheat Sheet",
      formulas: [],
      definitions: [],
      concepts: [],
      shortcuts: [],
      memoryTricks: [],
      commonMistakes: [],
      examTips: [],
    };
  }
  return parsed;
}

// ============================================================
// FEATURE 4 — AI MIND MAPS
// ============================================================

export interface MindMapNode {
  id: string;
  label: string;
  children?: MindMapNode[];
  description?: string;
  topicId?: string;
}

export interface MindMap {
  title: string;
  root: MindMapNode;
}

export async function generateMindMap(documentId: string): Promise<MindMap> {
  const { doc, corpus } = await getDocumentContext(documentId);

  // Try to use existing topics from the database first
  const topics = await db.topic.findMany({
    where: { documentId },
    include: { children: true },
    orderBy: [{ level: "asc" }, { order: "asc" }],
  });

  if (topics.length > 0) {
    // Build mind map from existing topic structure
    const roots = topics.filter((t) => !t.parentId);
    const buildNode = (topic: any): MindMapNode => ({
      id: topic.id,
      label: topic.title,
      description: topic.summary,
      topicId: topic.id,
      children: topics
        .filter((t) => t.parentId === topic.id)
        .map(buildNode),
    });
    return {
      title: doc.title,
      root: {
        id: "root",
        label: doc.title,
        children: roots.map(buildNode),
      },
    };
  }

  // Fallback: generate via AI
  const systemPrompt = `You are an expert at creating mind maps. Generate a hierarchical mind map from the document.

Return ONLY strict JSON (no markdown):
{
  "title": "mind map title",
  "root": {
    "id": "root",
    "label": "central topic",
    "children": [
      {
        "id": "unique-id",
        "label": "branch topic",
        "description": "short description",
        "children": [
          { "id": "unique-id-2", "label": "sub-topic", "description": "short description" }
        ]
      }
    ]
  }
}

Rules:
- 3-5 main branches from the root.
- Each branch should have 2-4 sub-topics.
- Labels should be short (2-4 words).
- IDs must be unique strings.`;

  const userPrompt = `Document: ${doc.title}\n\nContent:\n${corpus}`;

  const raw = await aiGenerate(systemPrompt, userPrompt);
  const parsed = parseJSON<MindMap>(raw);
  if (!parsed || !parsed.root) {
    return {
      title: doc.title,
      root: { id: "root", label: doc.title, children: [] },
    };
  }
  return parsed;
}

// ============================================================
// FEATURE 5 — AI COURSE GENERATOR
// ============================================================

export interface GeneratedCourse {
  title: string;
  description: string;
  modules: {
    title: string;
    summary: string;
    lessons: {
      title: string;
      summary: string;
      objectives: string[];
      estimatedMinutes: number;
    }[];
  }[];
}

export async function generateCourse(documentId: string): Promise<GeneratedCourse> {
  const { doc, corpus, topicTitles } = await getDocumentContext(documentId);

  const systemPrompt = `You are an expert course designer. Convert the provided document into a complete structured course.

Return ONLY strict JSON (no markdown):
{
  "title": "course title",
  "description": "2-3 sentence course description",
  "modules": [
    {
      "title": "module title",
      "summary": "what this module covers",
      "lessons": [
        {
          "title": "lesson title",
          "summary": "lesson summary",
          "objectives": ["learning objective 1", "learning objective 2"],
          "estimatedMinutes": 15
        }
      ]
    }
  ]
}

Rules:
- Create 3-5 modules.
- Each module should have 2-4 lessons.
- Include clear learning objectives for each lesson.
- Estimate realistic study time per lesson.
- The course should cover the entire document content.
- Structure should progress from fundamentals to advanced topics.`;

  const userPrompt = `Document: ${doc.title}\nTopics: ${topicTitles.join(", ")}\n\nContent:\n${corpus}`;

  const raw = await aiGenerate(systemPrompt, userPrompt);
  const parsed = parseJSON<GeneratedCourse>(raw);
  if (!parsed || !parsed.modules) {
    return {
      title: doc.title,
      description: "A course generated from your document.",
      modules: [],
    };
  }
  return parsed;
}

// ============================================================
// FEATURE 6 — AI SUMMARY MODES
// ============================================================

export type SummaryStyle =
  | "executive" | "student" | "detailed" | "exam"
  | "last-minute" | "bullet" | "interview-prep";

export const SUMMARY_STYLES: { key: SummaryStyle; label: string; icon: string; description: string }[] = [
  { key: "executive", label: "Executive Summary", icon: "📊", description: "High-level overview for decision-makers" },
  { key: "student", label: "Student Summary", icon: "🎓", description: "Clear summary optimized for learning" },
  { key: "detailed", label: "Detailed Summary", icon: "📖", description: "Comprehensive summary with all details" },
  { key: "exam", label: "Exam Summary", icon: "📝", description: "Key points for exam preparation" },
  { key: "last-minute", label: "Last Minute Revision", icon: "⏰", description: "Ultra-condensed for quick review" },
  { key: "bullet", label: "Bullet Notes", icon: "📋", description: "Pure bullet-point format" },
  { key: "interview-prep", label: "Interview Preparation", icon: "💼", description: "Key talking points for interviews" },
];

export async function generateSummary(documentId: string, style: SummaryStyle): Promise<string> {
  const { doc, corpus, topicTitles } = await getDocumentContext(documentId);

  const stylePrompts: Record<SummaryStyle, string> = {
    executive: "Create an executive summary — high-level overview focusing on key takeaways, strategic insights, and implications. 200-300 words.",
    student: "Create a student-friendly summary — clear, accessible language that helps a student understand the main points. 300-400 words.",
    detailed: "Create a detailed summary — comprehensive coverage of all key points with context. 500-700 words.",
    exam: "Create an exam summary — focus on what's most likely to be tested, key formulas, definitions, and concepts. 300-400 words.",
    "last-minute": "Create a last-minute revision summary — ultra-condensed, only the absolute essentials. 100-150 words. Use bullet points only.",
    bullet: "Create bullet notes — pure bullet-point format with no paragraphs. Each bullet should be a self-contained point.",
    "interview-prep": "Create interview preparation notes — key talking points, common questions, and technical depth for interview scenarios.",
  };

  const systemPrompt = `You are an expert at summarizing educational content. ${stylePrompts[style]}

Use Markdown formatting. The summary must be derived from the document content.`;

  const userPrompt = `Document: ${doc.title}\nTopics: ${topicTitles.join(", ")}\n\nContent:\n${corpus}`;

  return await aiGenerate(systemPrompt, userPrompt);
}

// ============================================================
// FEATURE 7 — SMART EXPORTS
// ============================================================

/**
 * Generate a PPTX file from a presentation structure.
 */
export async function exportPresentationToPPTX(presentation: Presentation, style: PresentationStyle): Promise<Buffer> {
  const pptxgen = await import("pptxgenjs");
  const pptx = new pptxgen.default();

  // Theme colors
  const themes: Record<PresentationStyle, { bg: string; text: string; accent: string }> = {
    university: { bg: "FFFFFF", text: "1A1A2E", accent: "4A5568" },
    professional: { bg: "FFFFFF", text: "1A202C", accent: "2B6CB0" },
    minimal: { bg: "FFFFFF", text: "1A1A1A", accent: "718096" },
    dark: { bg: "1A1A2E", text: "FFFFFF", accent: "E94560" },
    modern: { bg: "F7FAFC", text: "1A202C", accent: "805AD5" },
  };
  const theme = themes[style];

  pptx.defineLayout({ name: "CUSTOM", width: 10, height: 5.625 });
  pptx.layout = "CUSTOM";

  for (const slide of presentation.slides) {
    const s = pptx.addSlide();
    s.background = { color: theme.bg };

    if (slide.type === "title") {
      s.addText(slide.title, {
        x: 0.5, y: 1.5, w: 9, h: 1.5,
        fontSize: 36, bold: true, color: theme.text,
        align: "center", fontFace: "Arial",
      });
      if (slide.content[0]) {
        s.addText(slide.content[0], {
          x: 0.5, y: 3, w: 9, h: 0.75,
          fontSize: 20, color: theme.accent,
          align: "center", fontFace: "Arial",
        });
      }
    } else {
      s.addText(slide.title, {
        x: 0.5, y: 0.3, w: 9, h: 0.8,
        fontSize: 28, bold: true, color: theme.text,
        fontFace: "Arial",
      });

      const bulletText = slide.content.map((c) => ({
        text: c,
        options: { bullet: true, fontSize: 16, color: theme.text, breakLine: true },
      }));
      s.addText(bulletText as any, {
        x: 0.5, y: 1.3, w: 9, h: 3.5,
        fontSize: 16, color: theme.text,
        fontFace: "Arial",
      });

      if (slide.speakerNotes) {
        s.addNotes(slide.speakerNotes);
      }
    }
  }

  const data = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.from(data as ArrayBuffer);
}

/**
 * Generate a PDF from text content (notes, summaries, cheat sheets).
 */
export async function exportToPDF(title: string, content: string): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  // Title
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  const titleLines = doc.splitTextToSize(title, maxWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 28 + 10;

  // Content — strip markdown for PDF
  const lines = content.split("\n");
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      y += 8;
      continue;
    }

    // Detect headings
    if (trimmed.startsWith("## ")) {
      y += 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      const text = trimmed.replace(/^##\s+/, "").replace(/\*\*/g, "");
      const wrapped = doc.splitTextToSize(text, maxWidth);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 18 + 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
    } else if (trimmed.startsWith("### ")) {
      y += 6;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      const text = trimmed.replace(/^###\s+/, "").replace(/\*\*/g, "");
      const wrapped = doc.splitTextToSize(text, maxWidth);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 16 + 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const text = trimmed.replace(/^[-*]\s+/, "").replace(/\*\*/g, "");
      const wrapped = doc.splitTextToSize("• " + text, maxWidth - 15);
      doc.text(wrapped, margin + 15, y);
      y += wrapped.length * 15 + 2;
    } else {
      const text = trimmed.replace(/\*\*/g, "").replace(/`/g, "");
      const wrapped = doc.splitTextToSize(text, maxWidth);
      doc.text(wrapped, margin, y);
      y += wrapped.length * 15 + 2;
    }

    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  }

  return Buffer.from(doc.output("arraybuffer"));
}

// ============================================================
// FEATURE 3 — AI VIDEO LESSON GENERATOR
// ============================================================

export interface VideoChapter {
  title: string;
  startSegment: number;
  duration: number;
}

export interface VideoSegment {
  id: number;
  type: "intro" | "objectives" | "explanation" | "example" | "visualization" | "quiz" | "summary" | "revision";
  title: string;
  narration: string;
  visualDescription: string;
  duration: number; // seconds
  quizQuestion?: {
    prompt: string;
    options: string[];
    correctIndex: number;
    explanation: string;
  };
}

export interface VideoLesson {
  title: string;
  description: string;
  totalDuration: number;
  segments: VideoSegment[];
  chapters: VideoChapter[];
  teachingStyle: string;
  voice: string;
}

export async function generateVideoLesson(
  documentId: string,
  topicId: string | null,
  teachingStyle: string,
  voice: string
): Promise<VideoLesson> {
  const { doc, corpus, topicTitles } = await getDocumentContext(documentId);

  let topicContext = "";
  if (topicId) {
    const topic = await db.topic.findUnique({ where: { id: topicId } });
    if (topic) topicContext = `\nFocus on topic: ${topic.title}\n${topic.summary}`;
  }

  const systemPrompt = `You are an expert educational video scriptwriter. Create a complete video lesson script from the document.

The teaching style is: ${teachingStyle}
The AI voice is: ${voice}

Return ONLY strict JSON (no markdown):
{
  "title": "lesson title",
  "description": "1-2 sentence description",
  "totalDuration": 300,
  "segments": [
    {
      "id": 1,
      "type": "intro|objectives|explanation|example|visualization|quiz|summary|revision",
      "title": "segment title",
      "narration": "what the AI narrator says (spoken text, conversational, 2-4 sentences)",
      "visualDescription": "what appears on screen (diagrams, text, animations described in detail)",
      "duration": 30,
      "quizQuestion": null
    }
  ],
  "chapters": [
    {"title": "chapter name", "startSegment": 1, "duration": 60}
  ],
  "teachingStyle": "${teachingStyle}",
  "voice": "${voice}"
}

Rules:
- Include segments: intro, objectives, 2-3 explanation segments, example, visualization, quiz (with question), summary, revision.
- Narration should be conversational and spoken-style (not written text).
- Visual descriptions should be detailed enough to render (e.g., "Show a flowchart with 3 boxes connected by arrows: Input → Process → Output").
- Quiz segments must include a quizQuestion object.
- Total duration should be 3-8 minutes (180-480 seconds).
- Each segment should be 15-60 seconds.${topicContext}`;

  const userPrompt = `Document: ${doc.title}\nTopics: ${topicTitles.join(", ")}\n\nContent:\n${corpus}`;

  const raw = await aiGenerate(systemPrompt, userPrompt);
  const parsed = parseJSON<VideoLesson>(raw);
  if (!parsed || !parsed.segments) {
    return {
      title: doc.title,
      description: "AI-Generated Video Lesson",
      totalDuration: 180,
      segments: [
        { id: 1, type: "intro", title: "Introduction", narration: "Welcome to this lesson.", visualDescription: "Title slide", duration: 30 },
        { id: 2, type: "summary", title: "Summary", narration: "That concludes our lesson.", visualDescription: "Summary slide", duration: 30 },
      ],
      chapters: [{ title: "Introduction", startSegment: 1, duration: 60 }],
      teachingStyle,
      voice,
    };
  }
  return parsed;
}

// ============================================================
// FEATURE 5 — AI WHITEBOARD
// ============================================================

export interface WhiteboardStep {
  step: number;
  title: string;
  description: string;
  narration: string;
  diagram: {
    type: "flowchart" | "tree" | "graph" | "mindmap" | "timeline" | "architecture" | "math" | "er-diagram" | "uml";
    nodes: { id: string; label: string; x: number; y: number }[];
    edges: { from: string; to: string; label?: string }[];
  };
  duration: number;
}

export interface Whiteboard {
  title: string;
  description: string;
  steps: WhiteboardStep[];
}

export async function generateWhiteboard(documentId: string, topicId: string | null): Promise<Whiteboard> {
  const { doc, corpus, topicTitles } = await getDocumentContext(documentId);

  let topicContext = "";
  if (topicId) {
    const topic = await db.topic.findUnique({ where: { id: topicId } });
    if (topic) topicContext = `\nFocus on topic: ${topic.title}`;
  }

  const systemPrompt = `You are an expert at creating animated whiteboard explanations. Create a step-by-step whiteboard explanation from the document.

Return ONLY strict JSON (no markdown):
{
  "title": "whiteboard title",
  "description": "what this whiteboard explains",
  "steps": [
    {
      "step": 1,
      "title": "step title",
      "description": "what this step shows",
      "narration": "what to say while drawing this step",
      "diagram": {
        "type": "flowchart|tree|graph|mindmap|timeline|architecture|math|er-diagram|uml",
        "nodes": [{"id": "n1", "label": "Node Label", "x": 100, "y": 100}],
        "edges": [{"from": "n1", "to": "n2", "label": "optional edge label"}]
      },
      "duration": 15
    }
  ]
}

Rules:
- Create 4-8 steps that build up the explanation progressively.
- Each step adds new nodes/edges to the diagram.
- Node coordinates should be spread across a 800x400 canvas (x: 0-800, y: 0-400).
- The diagram type should match the concept being explained.
- Narration should explain what's being drawn.${topicContext}`;

  const userPrompt = `Document: ${doc.title}\nTopics: ${topicTitles.join(", ")}\n\nContent:\n${corpus}`;

  const raw = await aiGenerate(systemPrompt, userPrompt);
  const parsed = parseJSON<Whiteboard>(raw);
  if (!parsed || !parsed.steps) {
    return {
      title: doc.title,
      description: "AI Whiteboard Explanation",
      steps: [{ step: 1, title: "Overview", description: "Key concept", narration: "Let's start with the basics.", diagram: { type: "mindmap", nodes: [{ id: "n1", label: doc.title, x: 400, y: 200 }], edges: [] }, duration: 15 }],
    };
  }
  return parsed;
}

// ============================================================
// FEATURE 8 — AI TEXTBOOK GENERATOR
// ============================================================

export interface TextbookChapter {
  number: number;
  title: string;
  summary: string;
  content: string;
  keyTerms: { term: string; definition: string }[];
  examples: string[];
  exercises: string[];
  commonMistakes: string[];
}

export interface Textbook {
  title: string;
  subtitle: string;
  author: string;
  tableOfContents: { chapter: number; title: string; page: number }[];
  chapters: TextbookChapter[];
  glossary: { term: string; definition: string }[];
  references: string[];
}

export async function generateTextbook(documentId: string): Promise<Textbook> {
  const { doc, corpus, topicTitles } = await getDocumentContext(documentId);

  const systemPrompt = `You are an expert textbook author. Transform the document into a complete, professionally written textbook.

Return ONLY strict JSON (no markdown):
{
  "title": "textbook title",
  "subtitle": "subtitle",
  "author": "NeuroLearn AI",
  "tableOfContents": [{"chapter": 1, "title": "chapter title", "page": 1}],
  "chapters": [
    {
      "number": 1,
      "title": "chapter title",
      "summary": "chapter summary",
      "content": "full chapter content in Markdown with ## headings, **bold**, lists, tables, code blocks, and callout boxes (> Note: ...)",
      "keyTerms": [{"term": "term", "definition": "definition"}],
      "examples": ["worked example 1", "worked example 2"],
      "exercises": ["exercise question 1", "exercise question 2"],
      "commonMistakes": ["common mistake 1 and how to avoid it"]
    }
  ],
  "glossary": [{"term": "term", "definition": "definition"}],
  "references": ["reference 1", "reference 2"]
}

Rules:
- Create 3-6 chapters covering the entire document.
- Content should be professionally written (not AI-sounding).
- Include real examples and exercises derived from the document.
- Use proper Markdown formatting with headings, bold, lists, tables, and code blocks.
- Key terms and glossary should cover all important definitions.`;

  const userPrompt = `Document: ${doc.title}\nTopics: ${topicTitles.join(", ")}\n\nContent:\n${corpus}`;

  const raw = await aiGenerate(systemPrompt, userPrompt);
  const parsed = parseJSON<Textbook>(raw);
  if (!parsed || !parsed.chapters) {
    return {
      title: doc.title,
      subtitle: "AI-Generated Textbook",
      author: "NeuroLearn AI",
      tableOfContents: [],
      chapters: [],
      glossary: [],
      references: [],
    };
  }
  return parsed;
}

// ============================================================
// FEATURE 6 — INTERACTIVE CONCEPT MAP (enhanced)
// ============================================================

export interface ConceptMapNode {
  id: string;
  label: string;
  description: string;
  category: string;
  difficulty: number;
  estimatedMinutes: number;
  mastery: number;
  status: "locked" | "available" | "in_progress" | "mastered";
  prerequisites: string[];
  x: number;
  y: number;
}

export interface ConceptMapEdge {
  from: string;
  to: string;
  type: "prerequisite" | "related" | "leads_to";
}

export interface ConceptMap {
  title: string;
  nodes: ConceptMapNode[];
  edges: ConceptMapEdge[];
}

export async function generateConceptMap(documentId: string, userId: string): Promise<ConceptMap> {
  const { doc } = await getDocumentContext(documentId);

  // Use existing topics from DB
  const topics = await db.topic.findMany({
    where: { documentId },
    include: { prerequisites: true },
    orderBy: [{ level: "asc" }, { order: "asc" }],
  });

  // Get user's mastery for each topic
  const memoryStates = await db.memoryState.findMany({
    where: { userId, topicId: { in: topics.map((t) => t.id) } },
  });
  const masteryMap = new Map(memoryStates.map((m) => [m.topicId, m.retention]));

  // Layout: circular with levels
  const levelGroups = new Map<number, typeof topics>();
  for (const t of topics) {
    const group = levelGroups.get(t.level) ?? [];
    group.push(t);
    levelGroups.set(t.level, group);
  }

  const nodes: ConceptMapNode[] = [];
  const edges: ConceptMapEdge[] = [];

  for (const [level, group] of levelGroups) {
    const radius = 150 + level * 100;
    const cx = 400;
    const cy = 300;
    group.forEach((t, i) => {
      const angle = (i / group.length) * Math.PI * 2 - Math.PI / 2;
      const mastery = masteryMap.get(t.id) ?? 0;
      const hasPrereqs = t.prerequisites.length > 0;
      const prereqsMet = t.prerequisites.every((p) => (masteryMap.get(p.prerequisiteId) ?? 0) > 0.5);

      nodes.push({
        id: t.id,
        label: t.title,
        description: t.summary,
        category: doc.title,
        difficulty: t.difficulty,
        estimatedMinutes: t.estimatedMinutes,
        mastery,
        status: mastery > 0.7 ? "mastered" : mastery > 0.3 ? "in_progress" : hasPrereqs && !prereqsMet ? "locked" : "available",
        prerequisites: t.prerequisites.map((p) => p.prerequisiteId),
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      });

      for (const prereq of t.prerequisites) {
        edges.push({ from: prereq.prerequisiteId, to: t.id, type: "prerequisite" });
      }
    });
  }

  return { title: doc.title, nodes, edges };
}

// ============================================================
// FEATURE 14 — CAREER CONNECTIONS
// ============================================================

export interface CareerPath {
  title: string;
  description: string;
  skills: string[];
  salaryRange: string;
  demand: "high" | "medium" | "low";
  projects: string[];
  nextSteps: string[];
}

export interface CareerConnections {
  documentTitle: string;
  primaryField: string;
  careerPaths: CareerPath[];
  skillChain: string[];
  recommendedNextLearning: string[];
}

export async function generateCareerConnections(documentId: string): Promise<CareerConnections> {
  const { doc, corpus, topicTitles } = await getDocumentContext(documentId);

  const systemPrompt = `You are an expert career counselor. Analyze the document and show where this knowledge is used in careers.

Return ONLY strict JSON (no markdown):
{
  "documentTitle": "title",
  "primaryField": "main field (e.g., Software Engineering, Data Science, Finance)",
  "careerPaths": [
    {
      "title": "career title",
      "description": "how this knowledge applies to this career",
      "skills": ["skill 1", "skill 2"],
      "salaryRange": "$XX,000 - $XX,000",
      "demand": "high|medium|low",
      "projects": ["project idea 1", "project idea 2"],
      "nextSteps": ["what to learn next 1", "what to learn next 2"]
    }
  ],
  "skillChain": ["Foundation → Intermediate → Advanced → Specialized"],
  "recommendedNextLearning": ["topic 1", "topic 2", "topic 3"]
}

Rules:
- Identify 3-5 career paths where this knowledge is directly applicable.
- Include realistic salary ranges.
- Projects should be practical and buildable with this knowledge.
- Skill chain should show progression from what they're learning now to advanced specializations.`;

  const userPrompt = `Document: ${doc.title}\nTopics: ${topicTitles.join(", ")}\n\nContent:\n${corpus}`;

  const raw = await aiGenerate(systemPrompt, userPrompt);
  const parsed = parseJSON<CareerConnections>(raw);
  if (!parsed || !parsed.careerPaths) {
    return {
      documentTitle: doc.title,
      primaryField: "General",
      careerPaths: [],
      skillChain: [],
      recommendedNextLearning: [],
    };
  }
  return parsed;
}
