/**
 * Real Retrieval-Augmented Generation pipeline.
 * - Retrieves top-K document chunks via TF-IDF cosine similarity.
 * - Builds a grounded prompt with numbered citations.
 * - Returns citations alongside the generated answer.
 */
import { db } from "@/lib/db";
import { pseudoEmbed, cosineSimilarity } from "@/lib/learning";
import { generateText, generateJSON, type ChatTurn } from "@/lib/ai";

export interface Citation {
  documentId: string;
  documentTitle: string;
  chunkOrdinal: number;
  text: string;
  score: number;
}

export interface RetrievalResult {
  context: string;
  citations: Citation[];
}

/**
 * Retrieve the top-K most relevant chunks across the user's documents,
 * optionally scoped to a specific document or folder.
 */
export async function retrieve(
  userId: string,
  query: string,
  opts: { documentId?: string; folderId?: string; topK?: number } = {}
): Promise<RetrievalResult> {
  const topK = opts.topK ?? 5;
  const queryEmbed = pseudoEmbed(query);
  const queryTokens = new Set(query.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));

  const chunks = await db.documentChunk.findMany({
    where: {
      document: {
        userId,
        status: "ready",
        ...(opts.documentId ? { id: opts.documentId } : {}),
        ...(opts.folderId ? { folderId: opts.folderId } : {}),
      },
    },
    include: { document: { select: { id: true, title: true } } },
  });

  if (chunks.length === 0) {
    return { context: "", citations: [] };
  }

  const scored = chunks.map((c) => {
    let embed: number[] = [];
    try {
      embed = c.embedding ? JSON.parse(c.embedding) : [];
    } catch {
      embed = [];
    }
    const semantic = cosineSimilarity(queryEmbed, embed);
    const docTokens = c.text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    let overlap = 0;
    for (const t of docTokens) if (queryTokens.has(t)) overlap++;
    const idfWeight = docTokens.length > 0 ? Math.log(1 + overlap / Math.sqrt(docTokens.length)) : 0;
    const score = 0.55 * semantic + 0.45 * idfWeight;
    return {
      documentId: c.document.id,
      documentTitle: c.document.title,
      chunkOrdinal: c.ordinal,
      text: c.text,
      score,
    };
  });

  const top = scored.sort((a, b) => b.score - a.score).slice(0, topK);
  const context = top
    .map((c, i) => `[${i + 1}] (from "${c.documentTitle}")\n${c.text}`)
    .join("\n\n---\n\n");

  return { context, citations: top };
}

const RAG_SYSTEM = `You are NeuroTutor, the AI learning assistant inside NeuroLearn AI.

When the user asks about material they have uploaded, you will be given EXCERPTS from their document library as numbered citations like [1], [2], etc.

Rules:
- Ground your answer in the provided excerpts.
- Cite sources inline using the bracket notation, e.g. "Closures capture variables from their lexical scope [1]."
- If the excerpts do not contain the answer, say so clearly and answer from general knowledge, marking it as general knowledge.
- Use Markdown formatting.
- Be concise, accurate, and pedagogically sound.
- Never invent citations. Only cite excerpts that were actually provided.`;

/**
 * Generate a RAG answer with citations. Optionally includes conversation history.
 */
export async function ragAnswer(
  userId: string,
  query: string,
  history: ChatTurn[],
  scope?: { documentId?: string; folderId?: string }
): Promise<{ answer: string; citations: Citation[]; retrieval: RetrievalResult }> {
  const retrieval = await retrieve(userId, query, scope);

  const userContent = retrieval.context
    ? `Source excerpts:\n\n${retrieval.context}\n\n---\n\nUser question: ${query}`
    : `No relevant documents were found in the user's library.\n\nUser question: ${query}\n\n(Answer from general knowledge and note that no documents were available.)`;

  const messages: ChatTurn[] = [
    { role: "system", content: RAG_SYSTEM },
    ...history.slice(-6),
    { role: "user", content: userContent },
  ];

  try {
    const answer = await generateText(messages);
    return { answer, citations: retrieval.citations, retrieval };
  } catch {
    return { answer: "I couldn't generate an answer. Please try again.", citations: retrieval.citations, retrieval };
  }
}

/**
 * Generate quiz questions grounded in a specific document.
 */
export async function ragQuiz(
  documentId: string,
  count: number,
  difficulty: "easy" | "medium" | "hard"
): Promise<{
  questions: { prompt: string; options: string[]; correctIndex: number; explanation: string; difficulty: number }[];
}> {
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Document not found");

  const chunks = await db.documentChunk.findMany({
    where: { documentId },
    orderBy: { ordinal: "asc" },
  });
  const corpus = chunks.map((c) => c.text).join("\n\n").slice(0, 10000) || doc.contentText.slice(0, 10000);

  const diffLine =
    difficulty === "easy" ? "Aim difficulty 0.1-0.4" : difficulty === "hard" ? "Aim difficulty 0.7-0.95" : "Aim difficulty 0.4-0.7";

  const { data: parsed } = await generateJSON<
    { prompt: string; options: string[]; correctIndex: number; explanation: string; difficulty: number }[]
  >([
    {
      role: "system",
      content: `You generate multiple-choice quiz questions strictly from the provided source text. Return ONLY a JSON array (no markdown fences, no commentary) with this shape:
[{"prompt":"string","options":["a","b","c","d"],"correctIndex":0,"explanation":"string","difficulty":0.5}]
Rules: exactly 4 options; correctIndex 0-based; difficulty is a float 0..1; ${diffLine}; every answer must be derivable from the source text.`,
    },
    {
      role: "user",
      content: `Source text:\n\n${corpus}\n\nGenerate ${count} questions.`,
    },
  ]);
  return { questions: Array.isArray(parsed) ? parsed : [] };
}

/**
 * Generate flashcards grounded in a specific document.
 */
export async function ragFlashcards(
  documentId: string,
  count: number
): Promise<{ flashcards: { front: string; back: string; hint?: string }[] }> {
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Document not found");

  const chunks = await db.documentChunk.findMany({
    where: { documentId },
    orderBy: { ordinal: "asc" },
  });
  const corpus = chunks.map((c) => c.text).join("\n\n").slice(0, 10000) || doc.contentText.slice(0, 10000);

  const { data: parsed } = await generateJSON<{ front: string; back: string; hint?: string }[]>([
    {
      role: "system",
      content: `You generate spaced-repetition flashcards from the provided source text. Return ONLY a JSON array (no markdown, no commentary):
[{"front":"string","back":"string","hint":"string?"}]
Rules: fronts must be atomic questions or cloze prompts; backs must be concise (<= 2 sentences); derived strictly from the source text.`,
    },
    {
      role: "user",
      content: `Source text:\n\n${corpus}\n\nGenerate ${count} flashcards.`,
    },
  ]);
  return { flashcards: Array.isArray(parsed) ? parsed : [] };
}

/**
 * Extract a knowledge graph (skills + prerequisite edges) from a document.
 */
export async function ragKnowledgeGraph(
  documentId: string
): Promise<{
  skills: { name: string; description: string; category: string }[];
  edges: { from: string; to: string }[];
  summary: string;
}> {
  const doc = await db.document.findUnique({ where: { id: documentId } });
  if (!doc) throw new Error("Document not found");

  const chunks = await db.documentChunk.findMany({
    where: { documentId },
    orderBy: { ordinal: "asc" },
  });
  const corpus = chunks.map((c) => c.text).join("\n\n").slice(0, 12000) || doc.contentText.slice(0, 12000);

  const { data: parsed } = await generateJSON<{
    skills: { name: string; description: string; category: string }[];
    edges: { from: string; to: string }[];
    summary: string;
  }>([
    {
      role: "system",
      content: `You are a learning scientist. From the provided source text, extract a knowledge graph of the core concepts and their prerequisite relationships. Return ONLY strict JSON (no markdown):
{
  "skills": [{"name":"string","description":"string","category":"string"}],
  "edges": [{"from":"skill name","to":"dependent skill name"}],
  "summary": "one-paragraph summary of the document's learning structure"
}
Rules: skill names must be short (2-5 words); categories should group related skills; an edge from A to B means "A is a prerequisite for B"; include 5-15 skills.`,
    },
    { role: "user", content: `Source text:\n\n${corpus}` },
  ]);

  return {
    skills: Array.isArray(parsed?.skills) ? parsed.skills : [],
    edges: Array.isArray(parsed?.edges) ? parsed.edges : [],
    summary: typeof parsed?.summary === "string" ? parsed.summary : "",
  };
}
