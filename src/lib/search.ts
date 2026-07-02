/**
 * Global search across documents, conversations, flashcards, lessons, quizzes, and courses.
 */
import { db } from "@/lib/db";

export interface SearchResult {
  type: "document" | "conversation" | "flashcard" | "lesson" | "quiz" | "course" | "skill";
  id: string;
  title: string;
  snippet: string;
  url: string;
  meta?: Record<string, string>;
}

export async function globalSearch(userId: string, query: string, limit = 20): Promise<SearchResult[]> {
  const q = query.trim();
  if (!q) return [];

  const results: SearchResult[] = [];

  // Documents — search title + content + chunk text
  const docs = await db.document.findMany({
    where: {
      userId,
      OR: [
        { title: { contains: q } },
        { contentText: { contains: q } },
        { tags: { contains: q } },
      ],
    },
    take: 8,
    orderBy: { updatedAt: "desc" },
  });
  for (const d of docs) {
    const idx = d.contentText.toLowerCase().indexOf(q.toLowerCase());
    const snippet = idx >= 0
      ? "…" + d.contentText.slice(Math.max(0, idx - 60), idx + 120) + "…"
      : d.summary ?? d.title;
    results.push({
      type: "document",
      id: d.id,
      title: d.title,
      snippet,
      url: "documents",
      meta: { sourceType: d.sourceType, words: String(d.wordCount) },
    });
  }

  // Conversations + messages
  const conversations = await db.conversation.findMany({
    where: {
      userId,
      OR: [{ title: { contains: q } }],
    },
    take: 5,
    orderBy: { updatedAt: "desc" },
  });
  for (const c of conversations) {
    results.push({
      type: "conversation",
      id: c.id,
      title: c.title,
      snippet: c.context ?? "AI conversation",
      url: "tutor",
    });
  }
  // messages containing the query
  const messages = await db.message.findMany({
    where: { conversation: { userId }, content: { contains: q } },
    include: { conversation: true },
    take: 5,
    orderBy: { createdAt: "desc" },
  });
  for (const m of messages) {
    const idx = m.content.toLowerCase().indexOf(q.toLowerCase());
    const snippet = idx >= 0 ? "…" + m.content.slice(Math.max(0, idx - 50), idx + 120) + "…" : m.content.slice(0, 140);
    results.push({
      type: "conversation",
      id: m.conversationId,
      title: m.conversation.title,
      snippet,
      url: "tutor",
      meta: { role: m.role },
    });
  }

  // Flashcards
  const flashcards = await db.flashcard.findMany({
    where: {
      OR: [
        { authorId: userId, front: { contains: q } },
        { authorId: userId, back: { contains: q } },
        { lesson: { module: { course: { enrollments: { some: { userId } } } } }, front: { contains: q } },
      ],
    },
    take: 6,
  });
  for (const f of flashcards) {
    results.push({
      type: "flashcard",
      id: f.id,
      title: f.front,
      snippet: f.back,
      url: "flashcards",
    });
  }

  // Lessons
  const lessons = await db.lesson.findMany({
    where: {
      OR: [
        { title: { contains: q } },
        { summary: { contains: q } },
        { content: { contains: q } },
      ],
    },
    include: { module: { include: { course: true } } },
    take: 6,
  });
  for (const l of lessons) {
    results.push({
      type: "lesson",
      id: l.id,
      title: l.title,
      snippet: l.summary,
      url: "learn",
      meta: { course: l.module.course.title },
    });
  }

  // Quizzes
  const quizzes = await db.quiz.findMany({
    where: { title: { contains: q } },
    take: 5,
  });
  for (const qz of quizzes) {
    results.push({
      type: "quiz",
      id: qz.id,
      title: qz.title,
      snippet: qz.description ?? "",
      url: "quizzes",
    });
  }

  // Courses
  const courses = await db.course.findMany({
    where: {
      published: true,
      OR: [
        { title: { contains: q } },
        { description: { contains: q } },
        { category: { contains: q } },
      ],
    },
    take: 6,
  });
  for (const c of courses) {
    results.push({
      type: "course",
      id: c.id,
      title: c.title,
      snippet: c.description,
      url: "learn",
      meta: { category: c.category, difficulty: c.difficulty },
    });
  }

  // Skills
  const skills = await db.skill.findMany({
    where: {
      OR: [{ name: { contains: q } }, { description: { contains: q } }],
    },
    take: 5,
  });
  for (const s of skills) {
    results.push({
      type: "skill",
      id: s.id,
      title: s.name,
      snippet: s.description ?? "",
      url: "knowledge",
      meta: { category: s.category ?? "" },
    });
  }

  // Dedupe by id+type and return top N
  const seen = new Set<string>();
  const unique: SearchResult[] = [];
  for (const r of results) {
    const key = `${r.type}:${r.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(r);
  }
  return unique.slice(0, limit);
}
