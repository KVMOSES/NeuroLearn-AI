/**
 * Learning service — orchestrates progress, BKT updates, spaced repetition,
 * and exam-readiness prediction. Bridges repositories and domain algorithms.
 */
import { db } from "@/lib/db";
import {
  DEFAULT_BKT,
  DEFAULT_SM2,
  updateBKT,
  updateSM2,
  nextReviewDate,
  examReadiness,
  nextDifficulty,
  pickAdaptiveQuestion,
} from "@/lib/learning";
import { awardXP } from "@/lib/gamification";
import type { Question } from "@prisma/client";

// ============================================================
// LESSON PROGRESS
// ============================================================

export async function upsertLessonProgress(
  userId: string,
  lessonId: string,
  patch: { status?: "not_started" | "in_progress" | "completed"; timeSpent?: number }
) {
  const existing = await db.lessonProgress.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
  });

  const wasCompleted = existing?.status === "completed";
  const status = patch.status ?? existing?.status ?? "not_started";

  const updated = await db.lessonProgress.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: {
      userId,
      lessonId,
      status,
      timeSpent: patch.timeSpent ?? 0,
      lastOpened: new Date(),
      completedAt: status === "completed" ? new Date() : null,
    },
    update: {
      status,
      timeSpent: patch.timeSpent ? (existing?.timeSpent ?? 0) + patch.timeSpent : existing?.timeSpent ?? 0,
      lastOpened: new Date(),
      completedAt: status === "completed" && !wasCompleted ? new Date() : existing?.completedAt,
    },
  });

  // Award XP on completion (once)
  if (status === "completed" && !wasCompleted) {
    await awardXP(userId, "lesson_complete");
    await refreshEnrollmentProgress(userId, lessonId);
    // Update BKT for the lesson's skill (mark as learned transition)
    const lesson = await db.lesson.findUnique({ where: { id: lessonId } });
    if (lesson?.skillId) {
      await bumpSkillMastery(userId, lesson.skillId, true);
    }
  }

  return updated;
}

export async function refreshEnrollmentProgress(userId: string, lessonId: string) {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: { module: { include: { course: { include: { modules: { include: { lessons: true } } } } } } },
  });
  if (!lesson) return;
  const course = lesson.module.course;
  const allLessons = course.modules.flatMap((m) => m.lessons);
  const completed = await db.lessonProgress.count({
    where: { userId, lessonId: { in: allLessons.map((l) => l.id) }, status: "completed" },
  });
  const progress = allLessons.length > 0 ? completed / allLessons.length : 0;

  await db.enrollment.upsert({
    where: { userId_courseId: { userId, courseId: course.id } },
    create: { userId, courseId: course.id, progress, completedAt: progress >= 1 ? new Date() : null },
    update: { progress, completedAt: progress >= 1 ? new Date() : null },
  });
}

// ============================================================
// BKT — KNOWLEDGE STATE
// ============================================================

export async function getOrCreateKnowledgeState(userId: string, skillId: string) {
  return db.knowledgeState.upsert({
    where: { userId_skillId: { userId, skillId } },
    create: { userId, skillId, ...DEFAULT_BKT },
    update: {},
  });
}

export async function bumpSkillMastery(userId: string, skillId: string, correct: boolean) {
  const state = await getOrCreateKnowledgeState(userId, skillId);
  const updated = updateBKT(
    { pKnown: state.pKnown, pTransit: state.pTransit, pSlip: state.pSlip, pGuess: state.pGuess },
    correct
  );
  return db.knowledgeState.update({
    where: { id: state.id },
    data: {
      pKnown: updated.pKnown,
      observations: { increment: 1 },
      lastUpdated: new Date(),
    },
  });
}

/**
 * Aggregate exam readiness across all of a user's skills.
 */
export async function computeExamReadiness(userId: string): Promise<{
  readiness: number;
  skills: { id: string; name: string; pKnown: number; observations: number }[];
}> {
  const states = await db.knowledgeState.findMany({
    where: { userId },
    include: { skill: true },
  });
  if (states.length === 0) {
    return { readiness: 0, skills: [] };
  }
  const skills = states.map((s) => ({
    id: s.skillId,
    name: s.skill.name,
    pKnown: s.pKnown,
    observations: s.observations,
  }));
  return { readiness: Math.round(examReadiness(skills.map((s) => s.pKnown)) * 100), skills };
}

// ============================================================
// SPACED REPETITION — FLASHCARDS
// ============================================================

export async function reviewFlashcard(userId: string, flashcardId: string, quality: number) {
  const existing = await db.flashcardReview.findUnique({
    where: { userId_flashcardId: { userId, flashcardId } },
  });
  const prev = existing
    ? { repetitions: existing.repetitions, interval: existing.interval, easeFactor: existing.easeFactor }
    : DEFAULT_SM2;
  const next = updateSM2(prev, quality);
  const due = nextReviewDate(next.interval);

  const record = await db.flashcardReview.upsert({
    where: { userId_flashcardId: { userId, flashcardId } },
    create: {
      userId,
      flashcardId,
      quality,
      repetitions: next.repetitions,
      interval: next.interval,
      easeFactor: next.easeFactor,
      nextReview: due,
      reviewedAt: new Date(),
    },
    update: {
      quality,
      repetitions: next.repetitions,
      interval: next.interval,
      easeFactor: next.easeFactor,
      nextReview: due,
      reviewedAt: new Date(),
    },
  });

  await awardXP(userId, "flashcard_review");
  return record;
}

/**
 * Flashcards due for review now (or never reviewed).
 * Includes both catalog flashcards and user-authored / document-generated ones.
 */
export async function getDueFlashcards(userId: string, limit = 20) {
  const now = new Date();
  const due = await db.flashcardReview.findMany({
    where: { userId, nextReview: { lte: now } },
    include: { flashcard: true },
    take: limit,
    orderBy: { nextReview: "asc" },
  });
  // Fresh: flashcards the user has never reviewed — prefer their own (authored / from-doc) then catalog
  const reviewedIds = new Set(due.map((r) => r.flashcardId));
  const own = await db.flashcard.findMany({
    where: { id: { notIn: [...reviewedIds] }, OR: [{ authorId: userId }, { document: { userId } }] },
    take: Math.max(0, limit - due.length),
  });
  const remaining = Math.max(0, limit - due.length - own.length);
  const catalog = remaining > 0
    ? await db.flashcard.findMany({
        where: { id: { notIn: [...reviewedIds, ...own.map((f) => f.id)] } },
        take: remaining,
      })
    : [];
  const fresh = [...own, ...catalog];
  return {
    due: due.map((r) => ({ review: r, flashcard: r.flashcard })),
    fresh: fresh.map((f) => ({ flashcard: f })),
  };
}

// ============================================================
// ADAPTIVE QUIZ ENGINE
// ============================================================

export interface AdaptiveSession {
  attemptId: string;
  question: Question | null;
  progress: { answered: number; correct: number; total: number };
  finished: boolean;
  mastery: number;
}

/**
 * Start an adaptive quiz session. Creates a QuizAttempt.
 */
export async function startAdaptiveQuiz(
  userId: string,
  opts: { skillId?: string; lessonId?: string; quizId?: string; questionCount: number }
): Promise<AdaptiveSession> {
  // Find or create a quiz to anchor the attempt
  let quiz = opts.quizId ? await db.quiz.findUnique({ where: { id: opts.quizId } }) : null;

  if (!quiz) {
    // Build a quiz from available questions matching skill/lesson
    const questions = await db.question.findMany({
      where: {
        ...(opts.skillId ? { skillId: opts.skillId } : {}),
        ...(opts.lessonId ? { quiz: { lessonId: opts.lessonId } } : {}),
      },
      include: { quiz: true },
      take: opts.questionCount,
    });
    if (questions.length === 0) {
      // fallback: any questions
      const fallback = await db.question.findMany({ take: opts.questionCount, include: { quiz: true } });
      if (fallback.length === 0) {
        throw new Error("No questions available");
      }
      quiz = await db.quiz.create({
        data: {
          title: "Adaptive Session",
          description: "Auto-generated adaptive quiz",
          difficulty: "adaptive",
        },
      });
    } else {
      quiz = await db.quiz.create({
        data: {
          title: "Adaptive Session",
          description: `Adaptive quiz for ${opts.skillId ? "skill" : "lesson"}`,
          difficulty: "adaptive",
          skillId: opts.skillId,
        },
      });
    }
  }

  const attempt = await db.quizAttempt.create({
    data: { userId, quizId: quiz.id, total: opts.questionCount },
  });

  const question = await selectNextQuestion(userId, opts.skillId, new Set(), 0.5);
  return {
    attemptId: attempt.id,
    question,
    progress: { answered: 0, correct: 0, total: opts.questionCount },
    finished: false,
    mastery: 0.5,
  };
}

async function selectNextQuestion(
  userId: string,
  skillId: string | undefined,
  exclude: Set<string>,
  targetDifficulty: number
): Promise<Question | null> {
  const where = skillId ? { skillId } : {};
  const pool = await db.question.findMany({ where });
  const picked = pickAdaptiveQuestion(pool, targetDifficulty, exclude, (q) => q.id);
  return picked ?? null;
}

/**
 * Submit an answer in an adaptive quiz; returns correctness + next question.
 */
export async function submitAdaptiveAnswer(
  userId: string,
  attemptId: string,
  questionId: string,
  selectedIndex: number,
  timeMs = 0
): Promise<{
  correct: boolean;
  explanation: string | null;
  mastery: number;
  finished: boolean;
  nextQuestion: Question | null;
  progress: { answered: number; correct: number; total: number };
}> {
  const question = await db.question.findUnique({ where: { id: questionId } });
  if (!question) throw new Error("Question not found");

  const attempt = await db.quizAttempt.findUnique({
    where: { id: attemptId },
    include: { answers: true },
  });
  if (!attempt || attempt.userId !== userId) throw new Error("Invalid attempt");

  const correct = selectedIndex === question.correctIndex;

  // Record answer
  await db.answer.create({
    data: { attemptId, questionId, selectedIndex, correct, timeMs },
  });

  // Update BKT if skill attached
  let mastery = 0.5;
  if (question.skillId) {
    const state = await bumpSkillMastery(userId, question.skillId, correct);
    mastery = state.pKnown;
  }

  const answeredCount = attempt.answers.length + 1;
  const correctCount = attempt.answers.filter((a) => a.correct).length + (correct ? 1 : 0);
  const total = attempt.total || 5;
  const finished = answeredCount >= total;

  // Update attempt score
  await db.quizAttempt.update({
    where: { id: attemptId },
    data: {
      score: correctCount / answeredCount,
      completedAt: finished ? new Date() : null,
    },
  });

  // Pick next question adaptively
  const exclude = new Set([...attempt.answers.map((a) => a.questionId), questionId]);
  const recentCorrectRate = correctCount / answeredCount;
  const target = nextDifficulty(mastery, recentCorrectRate);
  const nextQuestion = finished
    ? null
    : await selectNextQuestion(userId, question.skillId ?? undefined, exclude, target);

  if (finished) {
    const score = correctCount / answeredCount;
    if (score >= 0.7) await awardXP(userId, "quiz_pass");
    if (score === 1) await awardXP(userId, "quiz_perfect");
  }

  return {
    correct,
    explanation: question.explanation,
    mastery,
    finished,
    nextQuestion,
    progress: { answered: answeredCount, correct: correctCount, total },
  };
}

// ============================================================
// KNOWLEDGE GRAPH
// ============================================================

export async function getKnowledgeGraph(userId: string) {
  const skills = await db.skill.findMany({
    include: {
      states: { where: { userId } },
      prerequisites: { include: { prerequisite: true } },
      dependents: { include: { skill: true } },
      lessons: { select: { id: true, title: true } },
    },
  });

  const nodes = skills.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category ?? "general",
    mastery: s.states[0]?.pKnown ?? 0,
    observations: s.states[0]?.observations ?? 0,
    lessonCount: s.lessons.length,
  }));

  const edges: { source: string; target: string }[] = [];
  for (const s of skills) {
    for (const p of s.prerequisites) {
      edges.push({ source: p.prerequisiteId, target: s.id });
    }
  }

  return { nodes, edges };
}
