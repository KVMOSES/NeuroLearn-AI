/**
 * GET /api/teaching/topics/:documentId
 * Returns the hierarchical topic tree for a document, with user progress and memory state.
 */
import { db } from "@/lib/db";
import { getSession } from "@/lib/session";
import { ok, ApiError } from "@/lib/api";

export async function GET(_req: Request, { params }: { params: Promise<{ documentId: string }> }) {
  const session = await getSession();
  if (!session) return ApiError.Unauthorized();
  const { documentId } = await params;

  const doc = await db.document.findFirst({ where: { id: documentId, userId: session.user.id } });
  if (!doc) return ApiError.NotFound("Document");

  const topics = await db.topic.findMany({
    where: { documentId },
    include: {
      prerequisites: { include: { prerequisite: { select: { id: true, title: true } } } },
      _count: { select: { questions: true, lessons: true } },
    },
    orderBy: [{ level: "asc" }, { order: "asc" }],
  });

  // Get user's memory states and learning plan items for these topics
  const [memoryStates, planItems] = await Promise.all([
    db.memoryState.findMany({ where: { userId: session.user.id, topicId: { in: topics.map((t) => t.id) } } }),
    db.learningPlanItem.findMany({
      where: { topicId: { in: topics.map((t) => t.id) }, plan: { userId: session.user.id } },
    }),
  ]);
  const memoryMap = new Map(memoryStates.map((m) => [m.topicId, m]));
  const planMap = new Map(planItems.map((p) => [p.topicId, p]));

  // Build hierarchical tree
  const topicMap = new Map(topics.map((t) => [t.id, { ...t, children: [] } as any]));
  const roots: any[] = [];
  for (const t of topics) {
    const node = topicMap.get(t.id)!;
    node.memory = memoryMap.get(t.id) ?? null;
    node.planItem = planMap.get(t.id) ?? null;
    node.concepts = t.concepts ? JSON.parse(t.concepts) : [];
    node.formulas = t.formulas ? JSON.parse(t.formulas) : [];
    node.definitions = t.definitions ? JSON.parse(t.definitions) : [];
    node.prerequisiteTitles = t.prerequisites.map((p) => p.prerequisite.title);
    if (t.parentId) {
      const parent = topicMap.get(t.parentId);
      if (parent) parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return ok({
    document: {
      id: doc.id,
      title: doc.title,
      summary: doc.summary,
      status: doc.status,
      wordCount: doc.wordCount,
    },
    topics: roots.map((t) => serializeTopic(t)),
    totalTopics: topics.length,
    analyzed: topics.length > 0,
  });
}

function serializeTopic(t: any): any {
  return {
    id: t.id,
    title: t.title,
    summary: t.summary,
    level: t.level,
    order: t.order,
    difficulty: t.difficulty,
    estimatedMinutes: t.estimatedMinutes,
    concepts: t.concepts,
    formulas: t.formulas,
    definitions: t.definitions,
    status: t.status,
    prerequisiteTitles: t.prerequisiteTitles,
    questionCount: t._count?.questions ?? 0,
    lessonCount: t._count?.lessons ?? 0,
    memory: t.memory ? {
      retention: t.memory.retention,
      retrievability: t.memory.retrievability,
      nextReview: t.memory.nextReview,
      repetitions: t.memory.repetitions,
    } : null,
    planStatus: t.planItem?.status ?? null,
    isWeak: t.planItem?.isWeak ?? false,
    children: (t.children || []).map((c: any) => serializeTopic(c)),
  };
}
