/**
 * AI Teaching Service — the core of NeuroLearn AI's teacher engine.
 *
 * Implements:
 * - Document understanding: analyzes documents into hierarchical topic structures
 * - Diagnostic assessment: adaptive initial assessment with mixed question types
 * - Learner profile: dynamic profiling from assessment responses
 * - Learning plan: personalized adaptive roadmap
 * - Interactive lessons: structured Explanation → Example → Visualization → Question → Feedback
 * - Socratic teaching: guides via questions instead of revealing answers
 * - Thinking analysis: evaluates reasoning, misconceptions, confidence
 * - Memory model: retention tracking with spaced repetition scheduling
 */
import { db } from "@/lib/db";
import { generateText, generateJSON, AIError } from "@/lib/ai";

// ============================================================
// STEP 1 — DOCUMENT UNDERSTANDING
// ============================================================

export interface AnalyzedTopic {
  title: string;
  summary: string;
  level: number; // 0=chapter, 1=topic, 2=subtopic, 3=concept
  difficulty: number; // 0..1
  estimatedMinutes: number;
  concepts: string[];
  formulas: string[];
  definitions: string[];
  children?: AnalyzedTopic[];
  prerequisites?: string[]; // titles of prerequisite topics
}

export interface DocumentAnalysis {
  title: string;
  overallSummary: string;
  topics: AnalyzedTopic[];
}

/**
 * Analyze a document and generate a complete hierarchical knowledge structure.
 * Identifies chapters, topics, subtopics, concepts, formulas, definitions,
 * prerequisites, difficulty, and estimated study time.
 */
export async function analyzeDocument(documentId: string): Promise<DocumentAnalysis> {
  const doc = await db.document.findUnique({
    where: { id: documentId },
    include: { chunks: { orderBy: { ordinal: "asc" } } },
  });
  if (!doc) throw new Error("Document not found");

  const corpus = doc.chunks.map((c) => c.text).join("\n\n").slice(0, 20000) || doc.contentText.slice(0, 20000);

  if (!corpus || corpus.trim().length === 0) {
    throw new Error("Document has no extractable text content. The file may be empty, image-based (scanned PDF without OCR), or in an unsupported format.");
  }

  console.log(`[analyzeDocument] Corpus length: ${corpus.length} chars, chunks: ${doc.chunks.length}`);

  const messages = [
    {
      role: "system" as const,
      content: `You are an expert curriculum designer and learning scientist. Analyze the provided document and extract a complete hierarchical knowledge structure.

Return ONLY strict JSON (no markdown fences) with this shape:
{
  "title": "string",
  "overallSummary": "2-3 sentence summary of the entire document",
  "topics": [
    {
      "title": "string (short, 2-6 words)",
      "summary": "1-2 sentence description of what this topic covers",
      "level": 0,
      "difficulty": 0.5,
      "estimatedMinutes": 15,
      "concepts": ["key concept 1", "key concept 2"],
      "formulas": ["formula if any (empty array if none)"],
      "definitions": ["definition if any (empty array if none)"],
      "children": [ /* nested topics with level+1 */ ],
      "prerequisites": ["title of another topic that must be learned first"]
    }
  ]
}

Rules:
- level 0 = chapter, level 1 = topic, level 2 = subtopic, level 3 = concept
- Nest topics as children. Aim for 2-4 levels of depth.
- Each leaf topic should be teachable in 5-30 minutes.
- difficulty is 0..1 (0.1=very easy, 0.9=very hard).
- prerequisites reference sibling or earlier topic titles.
- Extract real concepts, formulas, and definitions FROM the document text.
- Generate 5-15 top-level topics depending on document length.`,
    },
    { role: "user" as const, content: `Document title: ${doc.title}\n\nDocument text:\n\n${corpus}` },
  ];

  const { data, error } = await generateJSON<DocumentAnalysis>(messages);
  
  // Propagate the actual error from the AI service instead of swallowing it
  if (error) {
    console.error(`[analyzeDocument] AI error:`, error);
    throw new Error(`Analysis failed: ${error.message}`);
  }
  
  if (!data) {
    throw new Error("Analysis returned no data. The AI service may be unavailable.");
  }
  
  if (!data.topics || !Array.isArray(data.topics)) {
    console.error(`[analyzeDocument] Invalid analysis structure:`, JSON.stringify(data).slice(0, 500));
    throw new Error("Analysis returned an invalid structure. Expected a 'topics' array.");
  }

  if (data.topics.length === 0) {
    throw new Error("Analysis completed but no topics were extracted. The document may be too short or lack structured content.");
  }

  console.log(`[analyzeDocument] Success: ${data.topics.length} top-level topics extracted`);
  return data;
}

/**
 * Persist the analyzed topic structure to the database.
 */
export async function persistTopicStructure(documentId: string, analysis: DocumentAnalysis, userId: string): Promise<void> {
  // Flatten the nested topics and create them with parent relationships
  async function createTopics(topics: AnalyzedTopic[], parentId: string | null): Promise<void> {
    for (let i = 0; i < topics.length; i++) {
      const t = topics[i];
      const created = await db.topic.create({
        data: {
          documentId,
          parentId,
          authorId: userId,
          title: t.title,
          summary: t.summary,
          content: "",
          level: t.level,
          order: i,
          difficulty: t.difficulty,
          estimatedMinutes: t.estimatedMinutes,
          concepts: JSON.stringify(t.concepts || []),
          formulas: JSON.stringify(t.formulas || []),
          definitions: JSON.stringify(t.definitions || []),
          status: "ready",
        },
      });
      if (t.children && t.children.length > 0) {
        await createTopics(t.children, created.id);
      }
    }
  }

  await createTopics(analysis.topics, null);

  // Now resolve prerequisites by title (within the same document)
  const allTopics = await db.topic.findMany({ where: { documentId } });
  const titleToId = new Map(allTopics.map((t) => [t.title.toLowerCase(), t.id]));

  for (const t of analysis.topics) {
    await resolvePrereqs(t, allTopics, titleToId);
  }
}

async function resolvePrereqs(topic: AnalyzedTopic, allTopics: any[], titleToId: Map<string, string>): Promise<void> {
  const topicId = titleToId.get(topic.title.toLowerCase());
  if (!topicId) return;
  if (topic.prerequisites) {
    for (const prereqTitle of topic.prerequisites) {
      const prereqId = titleToId.get(prereqTitle.toLowerCase());
      if (prereqId && prereqId !== topicId) {
        try {
          await db.topicPrerequisite.create({ data: { topicId, prerequisiteId: prereqId } });
        } catch {
          // unique constraint — already exists
        }
      }
    }
  }
  if (topic.children) {
    for (const child of topic.children) {
      await resolvePrereqs(child, allTopics, titleToId);
    }
  }
}

// ============================================================
// STEP 3 — INITIAL / DIAGNOSTIC ASSESSMENT
// ============================================================

export interface DiagnosticQuestion {
  prompt: string;
  type: "mcq" | "truefalse" | "short" | "reasoning" | "scenario" | "numerical";
  options?: string[];
  correctIndex?: number;
  correctAnswer?: string[];
  numericAnswer?: number;
  numericTolerance?: number;
  explanation: string;
  difficulty: number;
  topicTitle: string;
  cognitiveLevel: "conceptual" | "reasoning" | "application" | "problem_solving";
}

/**
 * Generate an adaptive diagnostic assessment from a document's topic structure.
 * Questions start easy and become progressively harder, mixing question types
 * and cognitive levels.
 */
export async function generateDiagnostic(documentId: string, count: number = 8): Promise<DiagnosticQuestion[]> {
  const doc = await db.document.findUnique({
    where: { id: documentId },
    include: { topics: { where: { level: { gte: 1 } }, take: 20 } },
  });
  if (!doc) throw new Error("Document not found");

  const topicTitles = doc.topics.map((t) => t.title);
  const corpus = doc.contentText.slice(0, 10000);

  const messages = [
    {
      role: "system" as const,
      content: `You are an expert psychometrician creating a diagnostic assessment. Generate ${count} questions that start easy (difficulty 0.1-0.3) and become progressively harder (up to 0.8-0.9).

Mix these question types:
- "mcq": multiple choice (4 options, correctIndex 0-3)
- "truefalse": true/false (options ["True","False"], correctIndex 0 or 1)
- "short": short answer (correctAnswer = array of acceptable answers)
- "reasoning": open-ended reasoning (correctAnswer = array of key points to look for)
- "numerical": numeric answer (numericAnswer, numericTolerance)

Mix these cognitive levels: conceptual, reasoning, application, problem_solving.

Do NOT only ask factual questions. Include reasoning, application, and real-world scenario questions.

Return ONLY strict JSON array (no markdown):
[{
  "prompt": "string",
  "type": "mcq",
  "options": ["a","b","c","d"],
  "correctIndex": 0,
  "correctAnswer": null,
  "numericAnswer": null,
  "numericTolerance": null,
  "explanation": "string",
  "difficulty": 0.3,
  "topicTitle": "one of the topic titles",
  "cognitiveLevel": "conceptual"
}]

Rules:
- Order questions by increasing difficulty.
- For short/reasoning: correctAnswer is an array of acceptable answer strings.
- For numerical: provide numericAnswer and numericTolerance.
- All questions must be answerable from the document material.
- topicTitle must be one of: ${JSON.stringify(topicTitles)}`,
    },
    { role: "user" as const, content: `Document: ${doc.title}\nTopics: ${topicTitles.join(", ")}\n\nContent:\n${corpus}` },
  ];

  const { data, error } = await generateJSON<DiagnosticQuestion[]>(messages);
  if (error) {
    console.error(`[generateDiagnostic] AI error:`, error);
    throw new Error(`Diagnostic generation failed: ${error.message}`);
  }
  if (!data || !Array.isArray(data)) return [];
  return data;
}

// ============================================================
// STEP 4 — LEARNER MODEL
// ============================================================

export interface LearnerProfileUpdate {
  priorKnowledge: number;
  conceptualUnderstanding: number;
  reasoningAbility: number;
  confidence: number;
  learningSpeed: number;
  preferredStyle: "beginner" | "intermediate" | "advanced" | "balanced";
  strengths: string[];
  weaknesses: string[];
  misconceptions: { topic: string; description: string }[];
}

/**
 * Analyze diagnostic responses and build/update the learner profile.
 * Estimates prior knowledge, conceptual understanding, reasoning ability,
 * confidence, misconceptions, and weak/strong areas.
 */
export async function analyzeDiagnosticResponses(
  userId: string,
  sessionId: string,
  responses: { question: DiagnosticQuestion; selectedIndex?: number; textAnswer?: string; numericAnswer?: number; correct: boolean; score: number }[]
): Promise<LearnerProfileUpdate> {
  const responseSummary = responses.map((r, i) => ({
    q: i + 1,
    type: r.question.type,
    cognitiveLevel: r.question.cognitiveLevel,
    topic: r.question.topicTitle,
    difficulty: r.question.difficulty,
    correct: r.correct,
    score: r.score,
    studentAnswer: r.selectedIndex !== undefined ? r.selectedIndex : r.textAnswer ?? r.numericAnswer,
    correctAnswer: r.question.correctIndex !== undefined ? r.question.correctIndex : r.question.correctAnswer ?? r.question.numericAnswer,
  }));

  const messages = [
    {
      role: "system" as const,
      content: `You are an expert educational psychologist analyzing student diagnostic responses.

Return ONLY valid JSON matching this structure:
{
  "priorKnowledge": 0.0-1.0,
  "conceptualUnderstanding": 0.0-1.0,
  "reasoningAbility": 0.0-1.0,
  "confidence": 0.0-1.0,
  "learningSpeed": 0.0-1.0,
  "preferredStyle": "beginner|intermediate|advanced|balanced",
  "strengths": ["topic or skill they are strong in"],
  "weaknesses": ["topic or skill they struggle with"],
  "misconceptions": [{"topic": "topic name", "description": "specific misconception"}]
}

Analyze the student's responses and estimate their profile based on performance, question types, and difficulty levels.`,
    },
    { role: "user" as const, content: `Diagnostic responses: ${JSON.stringify(responseSummary)}` },
  ];

  let profile: LearnerProfileUpdate & {
    visualPreference?: number;
    readingPreference?: number;
    problemSolving?: number;
    logicalThinking?: number;
    memoryRetention?: number;
    attentionSpan?: number;
  };

  const { data, error } = await generateJSON<typeof profile>(messages);

  if (error || !data) {
    // Fallback: compute simple statistics
    const avgScore = responses.reduce((s, r) => s + r.score, 0) / responses.length;
    profile = {
      priorKnowledge: avgScore,
      conceptualUnderstanding: avgScore,
      reasoningAbility: avgScore * 0.8,
      confidence: avgScore,
      learningSpeed: 0.5,
      preferredStyle: avgScore < 0.4 ? "beginner" : avgScore < 0.7 ? "intermediate" : "advanced",
      strengths: [],
      weaknesses: [],
      misconceptions: [],
      visualPreference: 0.5,
      readingPreference: 0.5,
      problemSolving: avgScore * 0.7,
      logicalThinking: avgScore * 0.8,
      memoryRetention: 0.5,
      attentionSpan: 0.5,
    };
  } else {
    profile = data;
  }

  // Persist the profile (including Learning DNA fields)
  await db.learnerProfile.upsert({
    where: { userId },
    create: {
      userId,
      priorKnowledge: profile.priorKnowledge,
      conceptualUnderstanding: profile.conceptualUnderstanding,
      reasoningAbility: profile.reasoningAbility,
      confidence: profile.confidence,
      learningSpeed: profile.learningSpeed,
      preferredStyle: profile.preferredStyle,
      visualPreference: profile.visualPreference ?? 0.5,
      readingPreference: profile.readingPreference ?? 0.5,
      problemSolving: profile.problemSolving ?? 0.3,
      logicalThinking: profile.logicalThinking ?? 0.3,
      memoryRetention: profile.memoryRetention ?? 0.5,
      attentionSpan: profile.attentionSpan ?? 0.5,
      strengths: JSON.stringify(profile.strengths || []),
      weaknesses: JSON.stringify(profile.weaknesses || []),
      misconceptions: JSON.stringify(profile.misconceptions || []),
      totalAssessed: responses.length,
      lastUpdated: new Date(),
    },
    update: {
      priorKnowledge: profile.priorKnowledge,
      conceptualUnderstanding: profile.conceptualUnderstanding,
      reasoningAbility: profile.reasoningAbility,
      confidence: profile.confidence,
      learningSpeed: profile.learningSpeed,
      preferredStyle: profile.preferredStyle,
      visualPreference: profile.visualPreference ?? 0.5,
      readingPreference: profile.readingPreference ?? 0.5,
      problemSolving: profile.problemSolving ?? 0.3,
      logicalThinking: profile.logicalThinking ?? 0.3,
      memoryRetention: profile.memoryRetention ?? 0.5,
      attentionSpan: profile.attentionSpan ?? 0.5,
      strengths: JSON.stringify(profile.strengths || []),
      weaknesses: JSON.stringify(profile.weaknesses || []),
      misconceptions: JSON.stringify(profile.misconceptions || []),
      totalAssessed: { increment: responses.length },
      lastUpdated: new Date(),
    },
  });

  // Update diagnostic session
  await db.diagnosticSession.update({
    where: { id: sessionId },
    data: {
      status: "completed",
      completedAt: new Date(),
      questionCount: responses.length,
      correctCount: responses.filter((r) => r.correct).length,
      results: JSON.stringify(profile),
    },
  });

  return profile;
}

// ============================================================
// STEP 5 — PERSONALIZED LEARNING PLAN
// ============================================================

/**
 * Generate a personalized adaptive learning roadmap based on the learner profile.
 * Prioritizes weak topics, prerequisites, and schedules revision.
 */
export async function generateLearningPlan(userId: string, documentId: string): Promise<void> {
  const [profile, topics] = await Promise.all([
    db.learnerProfile.findUnique({ where: { userId } }),
    db.topic.findMany({
      where: { documentId, level: { gte: 1 } }, // skip chapter-level
      include: { prerequisites: true },
      orderBy: { order: "asc" },
    }),
  ]);

  if (topics.length === 0) throw new Error("No topics found. Analyze the document first.");

  const weaknesses = profile?.weaknesses ? JSON.parse(profile.weaknesses) : [];
  const strengths = profile?.strengths ? JSON.parse(profile.strengths) : [];
  const priorKnowledge = profile?.priorKnowledge ?? 0.3;
  const learningSpeed = profile?.learningSpeed ?? 0.5;

  // Determine topic ordering: prerequisites first, then weak topics, then by difficulty
  const weakSet = new Set(weaknesses.map((w: string) => w.toLowerCase()));
  const strongSet = new Set(strengths.map((s: string) => s.toLowerCase()));
  const topicMap = new Map(topics.map((t) => [t.id, t]));
  const completed = new Set<string>();
  const ordered: { topicId: string; isWeak: boolean; isPrereq: boolean }[] = [];

  // Topological sort by prerequisites
  function visit(topicId: string, visited: Set<string>) {
    if (visited.has(topicId)) return;
    visited.add(topicId);
    const topic = topicMap.get(topicId);
    if (!topic) return;
    for (const prereq of topic.prerequisites) {
      visit(prereq.prerequisiteId, visited);
    }
    if (!completed.has(topicId)) {
      const isWeak = weakSet.has(topic.title.toLowerCase());
      const isPrereq = topics.some((t) => t.prerequisites.some((p) => p.prerequisiteId === topicId));
      // Skip topics the student is already strong in (but still include as prereqs)
      if (!strongSet.has(topic.title.toLowerCase()) || isPrereq) {
        ordered.push({ topicId, isWeak, isPrereq });
        completed.add(topicId);
      }
    }
  }

  for (const t of topics) visit(t.id, new Set());

  // Create or update the learning plan
  const plan = await db.learningPlan.upsert({
    where: { userId_documentId: { userId, documentId } },
    create: {
      userId,
      documentId,
      totalTopics: ordered.length,
      estimatedMinutes: ordered.reduce((s, o) => s + (topicMap.get(o.topicId)?.estimatedMinutes ?? 15), 0),
    },
    update: {
      totalTopics: ordered.length,
      estimatedMinutes: ordered.reduce((s, o) => s + (topicMap.get(o.topicId)?.estimatedMinutes ?? 15), 0),
    },
  });

  // Clear old items and create new ones
  await db.learningPlanItem.deleteMany({ where: { planId: plan.id } });
  const now = new Date();
  for (let i = 0; i < ordered.length; i++) {
    const item = ordered[i];
    // Schedule: first few today, rest spread out based on learning speed
    const scheduledFor = new Date(now);
    scheduledFor.setDate(scheduledFor.getDate() + Math.floor(i / Math.max(1, Math.ceil(3 * learningSpeed + 1))));
    await db.learningPlanItem.create({
      data: {
        planId: plan.id,
        topicId: item.topicId,
        order: i,
        status: "pending",
        isWeak: item.isWeak,
        isPrereq: item.isPrereq,
        scheduledFor,
      },
    });
  }
}

// ============================================================
// STEP 6+7 — INTERACTIVE LESSONS
// ============================================================

export interface LessonStep {
  type: "explanation" | "example" | "visualization" | "question" | "feedback" | "summary";
  title: string;
  content: string;
  // For question steps:
  questionType?: "mcq" | "truefalse" | "short" | "reasoning";
  options?: string[];
  correctIndex?: number;
  correctAnswer?: string[];
  hint?: string;
  // For visualization steps:
  visualizationType?: "diagram" | "analogy" | "comparison" | "step_by_step";
}

/**
 * Generate a structured interactive lesson for a topic.
 * Adapts teaching style to the learner's level.
 */
export async function generateInteractiveLesson(topicId: string, userId: string): Promise<{ lessonId: string; steps: LessonStep[] }> {
  const topic = await db.topic.findUnique({ where: { id: topicId }, include: { document: true } });
  if (!topic) throw new Error("Topic not found");

  const profile = await db.learnerProfile.findUnique({ where: { userId } });
  const style = profile?.preferredStyle ?? "balanced";
  const prior = profile?.priorKnowledge ?? 0.3;

  // Check if a lesson already exists
  const existing = await db.interactiveLesson.findFirst({ where: { topicId }, orderBy: { createdAt: "desc" } });
  if (existing) {
    return { lessonId: existing.id, steps: JSON.parse(existing.stepsJson) };
  }

  // Gather source material from the document
  const docContent = topic.document.contentText.slice(0, 6000);
  const concepts = topic.concepts ? JSON.parse(topic.concepts) : [];
  const formulas = topic.formulas ? JSON.parse(topic.formulas) : [];
  const definitions = topic.definitions ? JSON.parse(topic.definitions) : [];

  const styleGuide = {
    beginner: "Use simple language, analogies, and step-by-step explanations. Define all terms. Use everyday examples.",
    intermediate: "Use moderate detail with practical examples. Assume basic familiarity. Focus on application.",
    advanced: "Use technical depth. Include edge cases, proofs, and optimization considerations. Interview-level discussion.",
    balanced: "Adapt naturally — start simple, then add depth. Use a mix of approaches.",
  }[style];

  const messages = [
    {
      role: "system" as const,
      content: `You are an expert AI teacher creating an interactive lesson. Create a structured lesson with 6-10 steps following this flow:

Explanation → Example → Visualization → Question → Feedback → (repeat for sub-concepts) → Summary

Teaching style: ${styleGuide}

The student's prior knowledge level is ${Math.round(prior * 100)}%.

Return ONLY strict JSON (no markdown):
{
  "steps": [
    {
      "type": "explanation",
      "title": "step title",
      "content": "markdown content explaining the concept"
    },
    {
      "type": "example",
      "title": "step title",
      "content": "a concrete worked example in markdown"
    },
    {
      "type": "visualization",
      "title": "step title",
      "content": "describe a visual diagram, analogy, or comparison that helps the student visualize the concept",
      "visualizationType": "diagram|analogy|comparison|step_by_step"
    },
    {
      "type": "question",
      "title": "check your understanding",
      "content": "the question prompt",
      "questionType": "mcq|truefalse|short|reasoning",
      "options": ["a","b","c","d"],
      "correctIndex": 0,
      "correctAnswer": null,
      "hint": "a hint if the student is stuck"
    },
    {
      "type": "feedback",
      "title": "feedback",
      "content": "explanation of the correct answer and common mistakes"
    },
    {
      "type": "summary",
      "title": "key takeaways",
      "content": "summary of what was learned"
    }
  ]
}

Rules:
- Start with an explanation step.
- Include at least 2 question steps with feedback after each.
- Use the document's actual concepts, formulas, and definitions.
- Make questions test understanding, not just memorization.
- For visualization steps, describe something the student can picture mentally.
- Content should be in Markdown.`,
    },
    {
      role: "user" as const,
      content: `Topic: ${topic.title}\nSummary: ${topic.summary}\nKey concepts: ${JSON.stringify(concepts)}\nFormulas: ${JSON.stringify(formulas)}\nDefinitions: ${JSON.stringify(definitions)}\n\nSource material:\n${docContent}`,
    },
  ];

  const { data, error } = await generateJSON<{ steps: LessonStep[] }>(messages);
  let steps: LessonStep[];

  if (error || !data || !Array.isArray(data.steps)) {
    steps = [
      { type: "explanation", title: topic.title, content: topic.summary },
      { type: "summary", title: "Summary", content: "Lesson generation encountered an issue. Please try again." },
    ];
  } else {
    steps = data.steps;
  }

  const lesson = await db.interactiveLesson.create({
    data: {
      topicId,
      title: topic.title,
      description: topic.summary,
      stepsJson: JSON.stringify(steps),
      stepCount: steps.length,
    },
  });

  return { lessonId: lesson.id, steps };
}

// ============================================================
// STEP 8 — SOCRATIC TEACHING
// ============================================================

/**
 * Generate a Socratic teaching response — guides the student via questions
 * instead of revealing the answer. Uses the learner profile and lesson context.
 */
export async function socraticTeach(
  userId: string,
  topicId: string,
  studentInput: string | null,
  context: { stepIndex: number; lessonSteps: LessonStep[]; previousInteractions: { role: string; content: string }[] }
): Promise<string> {
  const topic = await db.topic.findUnique({ where: { id: topicId } });
  if (!topic) throw new Error("Topic not found");

  const profile = await db.learnerProfile.findUnique({ where: { userId } });
  const style = profile?.preferredStyle ?? "balanced";
  const misconceptions = profile?.misconceptions ? JSON.parse(profile.misconceptions) : [];

  const systemPrompt = `You are an AI teacher using the Socratic method. You are teaching "${topic.title}".

Your rules:
- NEVER reveal the answer directly on the first attempt.
- Guide the student by asking probing questions that lead them to discover the answer.
- If the student is stuck, give a hint — not the answer.
- If the student has tried 2+ times and is clearly frustrated, give a partial explanation and ask a simpler follow-up.
- Identify misconceptions from the student's responses and address them with targeted questions.
- Adapt your style to the learner's level: ${style}.
- Known misconceptions for this learner: ${JSON.stringify(misconceptions)}
- Keep responses concise (2-4 sentences). End with a question whenever possible.
- Use Markdown formatting.

Current lesson context:
- Step ${context.stepIndex + 1} of ${context.lessonSteps.length}
- Current step content: ${context.lessonSteps[context.stepIndex]?.content ?? "N/A"}

${context.previousInteractions.length > 0 ? "Previous interactions in this lesson:" : "This is the start of the interaction."}
${context.previousInteractions.slice(-6).map((i) => `${i.role}: ${i.content}`).join("\n")}`;

  const userMessage = studentInput
    ? `Student said: "${studentInput}"\n\nRespond using the Socratic method.`
    : `The student is starting this topic. Begin with a brief intro and a question to gauge their understanding.`;

  const messages = [
    { role: "system" as const, content: systemPrompt },
    { role: "user" as const, content: userMessage },
  ];

  try {
    const text = await generateText(messages);
    return text;
  } catch {
    return "Let's think about this step by step. What do you already know about this topic?";
  }
}

// ============================================================
// STEP 10 — THINKING ANALYSIS
// ============================================================

export interface AnswerAnalysis {
  correct: boolean;
  score: number; // 0..1 partial credit
  reasoning: "strong" | "adequate" | "weak" | "absent";
  misconceptions: string[];
  confidence: "high" | "medium" | "low";
  explanationQuality: "excellent" | "good" | "fair" | "poor";
  feedback: string;
  suggestions: string[];
}

/**
 * Analyze a student's answer for reasoning quality, misconceptions,
 * confidence, and explanation quality. Provides constructive feedback.
 */
export async function analyzeThinking(
  question: { prompt: string; type: string; correctAnswer?: string | null; correctIndex?: number | null; options?: string | null; explanation?: string | null },
  studentAnswer: { selectedIndex?: number | null; textAnswer?: string | null; numericAnswer?: number | null; timeMs?: number }
): Promise<AnswerAnalysis> {
  let correctAnswerStr = "";
  if (question.type === "mcq" || question.type === "truefalse") {
    const options = question.options ? JSON.parse(question.options) : [];
    correctAnswerStr = options[question.correctIndex ?? 0] ?? "";
  } else if (question.type === "short" || question.type === "reasoning") {
    correctAnswerStr = question.correctAnswer ?? "";
  } else if (question.type === "numerical") {
    correctAnswerStr = String(question.correctAnswer ?? "");
  }

  let studentAnswerStr = "";
  if (studentAnswer.selectedIndex !== null && studentAnswer.selectedIndex !== undefined) {
    const options = question.options ? JSON.parse(question.options) : [];
    studentAnswerStr = options[studentAnswer.selectedIndex] ?? "";
  } else if (studentAnswer.textAnswer) {
    studentAnswerStr = studentAnswer.textAnswer;
  } else if (studentAnswer.numericAnswer !== null && studentAnswer.numericAnswer !== undefined) {
    studentAnswerStr = String(studentAnswer.numericAnswer);
  }

  // Quick objective check first
  let objectivelyCorrect = false;
  if (question.type === "mcq" || question.type === "truefalse") {
    objectivelyCorrect = studentAnswer.selectedIndex === question.correctIndex;
  } else if (question.type === "numerical") {
    const target = parseFloat(question.correctAnswer ?? "0");
    const tolerance = 0.01;
    objectivelyCorrect = studentAnswer.numericAnswer !== null && Math.abs((studentAnswer.numericAnswer ?? 0) - target) <= tolerance;
  } else {
    // For short/reasoning, use AI to determine correctness
    objectivelyCorrect = false; // will be determined by AI
  }

  // For MCQ/truefalse/numerical, skip AI analysis if it's a simple correct/incorrect
  if ((question.type === "mcq" || question.type === "truefalse" || question.type === "numerical") && objectivelyCorrect) {
    return {
      correct: true,
      score: 1,
      reasoning: "adequate",
      misconceptions: [],
      confidence: studentAnswer.timeMs && studentAnswer.timeMs < 10000 ? "high" : "medium",
      explanationQuality: "good",
      feedback: "Correct! Well done.",
      suggestions: [],
    };
  }

  const messages = [
    {
      role: "system" as const,
      content: `You are an expert teacher analyzing a student's answer. Evaluate the reasoning, identify misconceptions, assess confidence, and provide constructive feedback.

Return ONLY strict JSON (no markdown):
{
  "correct": true/false,
  "score": 0.0-1.0,
  "reasoning": "strong|adequate|weak|absent",
  "misconceptions": ["specific misconceptions identified, empty if none"],
  "confidence": "high|medium|low",
  "explanationQuality": "excellent|good|fair|poor",
  "feedback": "constructive feedback in 2-3 sentences",
  "suggestions": ["what the student should review or practice next"]
}

Rules:
- For MCQ/truefalse: "correct" is objective, but still analyze reasoning if the student provided any explanation.
- For short/reasoning: determine if the answer captures the key points. Give partial credit (score 0.0-1.0).
- For numerical: check if the answer is within tolerance.
- Identify specific misconceptions from wrong answers (e.g., "confuses correlation with causation").
- Confidence is inferred from answer quality, not just speed.
- Feedback should be constructive and specific — not just "incorrect".`,
    },
    {
      role: "user" as const,
      content: `Question: ${question.prompt}\nType: ${question.type}\nCorrect answer: ${correctAnswerStr}\nExplanation: ${question.explanation ?? "N/A"}\n\nStudent answer: ${studentAnswerStr}\nTime taken: ${studentAnswer.timeMs ?? 0}ms`,
    },
  ];

  const { data, error } = await generateJSON<AnswerAnalysis>(messages);

  if (!error && data) {
    return data;
  } else {
    return {
      correct: objectivelyCorrect,
      score: objectivelyCorrect ? 1 : 0,
      reasoning: "adequate",
      misconceptions: [],
      confidence: "medium",
      explanationQuality: "fair",
      feedback: objectivelyCorrect ? "Correct!" : "Not quite right. Review the material and try again.",
      suggestions: [],
    };
  }
}

// ============================================================
// STEP 11 — MEMORY MODEL (FSRS-inspired)
// ============================================================

/**
 * Update memory retention for a topic after a review/practice.
 * Uses a simplified FSRS (Free Spaced Repetition Scheduler) model:
 * - retention = exp(-days / stability)
 * - stability increases with correct reviews, decreases with incorrect
 */
export async function updateMemoryState(userId: string, topicId: string, quality: number): Promise<void> {
  // quality: 0-5 (0=forgot, 5=perfect)
  const existing = await db.memoryState.findUnique({
    where: { userId_topicId: { userId, topicId } },
  });

  const now = new Date();
  let stability = existing?.stability ?? 1.0;
  let repetitions = (existing?.repetitions ?? 0) + 1;
  let retention = existing?.retention ?? 0.5;

  // Update stability based on quality
  if (quality >= 3) {
    // Correct — increase stability
    const factor = 1 + (quality - 2) * 0.5;
    stability *= factor;
  } else {
    // Incorrect — reset stability
    stability = Math.max(0.5, stability * 0.3);
    repetitions = 1;
  }

  // Cap stability
  stability = Math.min(stability, 365);

  // Calculate next review interval
  // Retention drops as exp(-days/stability). Target 90% retention.
  // days = -stability * ln(0.9) ≈ stability * 0.105
  const intervalDays = Math.max(1, Math.round(stability * 0.105 * (quality >= 4 ? 1.5 : 1)));
  const nextReview = new Date(now);
  nextReview.setDate(nextReview.getDate() + intervalDays);

  // Current retrievability
  const daysSinceReview = existing?.lastReview
    ? (now.getTime() - existing.lastReview.getTime()) / (1000 * 60 * 60 * 24)
    : 0;
  const retrievability = Math.exp(-daysSinceReview / stability);

  await db.memoryState.upsert({
    where: { userId_topicId: { userId, topicId } },
    create: {
      userId,
      topicId,
      retention: quality >= 3 ? Math.min(1, retention + 0.1) : Math.max(0.1, retention - 0.2),
      stability,
      retrievability,
      repetitions,
      lastReview: now,
      nextReview,
    },
    update: {
      retention: quality >= 3 ? Math.min(1, retention + 0.1) : Math.max(0.1, retention - 0.2),
      stability,
      retrievability,
      repetitions,
      lastReview: now,
      nextReview,
    },
  });
}

/**
 * Get topics due for revision based on the memory model.
 */
export async function getDueRevisionTopics(userId: string, limit: number = 10): Promise<{ topicId: string; topic: any; retrievability: number; nextReview: Date }[]> {
  const now = new Date();
  const due = await db.memoryState.findMany({
    where: { userId, nextReview: { lte: now } },
    include: { topic: true },
    orderBy: { nextReview: "asc" },
    take: limit,
  });
  return due.map((d) => ({ topicId: d.topicId, topic: d.topic, retrievability: d.retrievability, nextReview: d.nextReview }));
}

// ============================================================
// STEP 13 — AI TUTOR (context-aware)
// ============================================================

/**
 * Generate a context-aware AI tutor response that remembers:
 * - Previous conversations
 * - Previous assessments
 * - Learning progress
 * - Uploaded documents
 * - Learner profile (Learning DNA)
 * Adapts explanations and teaching style automatically using the selected teaching mode.
 */
export async function tutorTeach(
  userId: string,
  message: string,
  history: { role: string; content: string }[],
  context?: { topicId?: string; documentId?: string }
): Promise<string> {
  const profile = await db.learnerProfile.findUnique({ where: { userId } });
  const prior = profile?.priorKnowledge ?? 0.3;
  const misconceptions = profile?.misconceptions ? JSON.parse(profile.misconceptions) : [];
  const strengths = profile?.strengths ? JSON.parse(profile.strengths) : [];
  const weaknesses = profile?.weaknesses ? JSON.parse(profile.weaknesses) : [];
  const mistakePatterns = profile?.mistakePatterns ? JSON.parse(profile.mistakePatterns) : [];

  // Resolve teaching mode (auto → pick from DNA)
  const { resolveTeachingMode, getTeachingModePrompt } = await import("@/lib/learning-dna");
  const effectiveMode = await resolveTeachingMode(userId);

  let topicContext = "";
  if (context?.topicId) {
    const topic = await db.topic.findUnique({ where: { id: context.topicId } });
    if (topic) {
      topicContext = `\n\n[Current topic: ${topic.title}]\n${topic.summary}\nKey concepts: ${topic.concepts ?? "[]"}`;
    }
  }

  // Build the system prompt using the teaching mode + Learning DNA
  const dnaPrompt = getTeachingModePrompt(effectiveMode, {
    priorKnowledge: prior,
    reasoningAbility: profile?.reasoningAbility ?? 0.3,
    confidence: profile?.confidence ?? 0.5,
    learningSpeed: profile?.learningSpeed ?? 0.5,
    visualPreference: profile?.visualPreference ?? 0.5,
    readingPreference: profile?.readingPreference ?? 0.5,
    strengths,
    weaknesses,
    misconceptions,
    mistakePatterns,
  });

  const messages = [
    {
      role: "system" as const,
      content: `You are NeuroTutor, a personal AI Teacher that adapts to how each student learns. You are NOT a chatbot — you are a mentor.

${dnaPrompt}
${topicContext}`,
    },
    ...history.slice(-8).map((h) => ({ role: h.role as "user" | "assistant", content: h.content })),
    { role: "user" as const, content: message },
  ];

  try {
    const text = await generateText(messages);
    return text;
  } catch {
    return "I'm here to help you learn. What would you like to explore?";
  }
}