/**
 * Shared frontend type definitions (mirrors backend payloads).
 */

export type ViewKey =
  | "dashboard"
  | "learn"
  | "tutor"
  | "quizzes"
  | "flashcards"
  | "focus"
  | "analytics"
  | "gamification"
  | "knowledge"
  | "documents"
  | "classroom"
  | "lesson-studio"
  | "settings";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "TEACHER" | "ADMIN";
  avatarUrl: string | null;
  emailVerified: boolean;
  createdAt: string;
}

export interface AchievementEarned {
  slug: string;
  name: string;
  icon: string;
  tier: string;
  earnedAt: string;
}

export interface MeResponse {
  user: AuthUser;
  gamification: {
    totalXP: number;
    level: number;
    xpIntoLevel: number;
    xpForNextLevel: number;
    levelProgressPct: number;
    currentStreak: number;
    longestStreak: number;
    achievements: AchievementEarned[];
  };
  counts: {
    enrollments: number;
    lessonsCompleted: number;
    quizAttempts: number;
    flashcardsReviewed: number;
    conversations: number;
    documents: number;
  };
}

export interface CourseSummary {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  difficulty: string;
  color: string;
  estimatedHours: number;
  tags: string[];
  enrolledCount: number;
  enrolled: boolean;
  progress: number;
  completed: boolean;
  moduleCount: number;
  lessonCount: number;
  completedLessons: number;
  modules: {
    id: string;
    title: string;
    description: string | null;
    order: number;
    lessons: {
      id: string;
      title: string;
      summary: string;
      durationMin: number;
      order: number;
      status: "not_started" | "in_progress" | "completed";
      timeSpent: number;
      skillId: string | null;
    }[];
  }[];
}

export interface LessonDetail {
  id: string;
  title: string;
  summary: string;
  content: string;
  durationMin: number;
  skill: { id: string; name: string } | null;
  course: { id: string; title: string; slug: string };
  flashcards: { id: string; front: string; back: string; hint: string | null }[];
  quizzes: { id: string; title: string; questionCount: number }[];
  status: "not_started" | "in_progress" | "completed";
  timeSpent: number;
}

export interface FlashcardDueItem {
  reviewId?: string;
  flashcard: { id: string; front: string; back: string; hint: string | null; tags?: string | null };
  nextReview?: string;
  easeFactor?: number;
  repetitions?: number;
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: string[];
  difficulty?: number;
  skillId?: string | null;
  correctIndex?: number;
  explanation?: string | null;
}

export interface QuizListItem {
  id: string;
  title: string;
  description: string | null;
  difficulty: string;
  questionCount: number;
  document?: { id: string; title: string } | null;
  skill?: { id: string; name: string } | null;
  createdAt: string;
}

export interface ReadinessResponse {
  readiness: number;
  skills: { id: string; name: string; pKnown: number; observations: number }[];
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  name: string;
  avatarUrl: string | null;
  totalXP: number;
  level: number;
  currentStreak: number;
}

export interface AchievementDef {
  id: string;
  slug: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  xpReward: number;
  threshold: number;
  category: string;
  earned: boolean;
  earnedAt: string | null;
}

export interface DashboardAnalytics {
  summary: {
    enrolledCourses: number;
    completedCourses: number;
    lessonsCompleted: number;
    totalTimeSpent: number;
    quizAttempts: number;
    avgQuizScore: number;
    flashcardsReviewed: number;
    aiConversations: number;
    examReadiness: number;
  };
  xpSeries: { date: string; xp: number }[];
  quizSeries: { attempt: number; score: number }[];
  masteryByCategory: { category: string; mastery: number; skillCount: number }[];
  activityThisWeek: { quizzes: number; flashcards: number; lessons: number; conversations: number };
  streak: { current: number; logs: { date: string; xp: number }[] };
  skillMastery: { id: string; name: string; pKnown: number; observations: number }[];
}

export interface KnowledgeGraph {
  nodes: {
    id: string;
    name: string;
    category: string;
    mastery: number;
    observations: number;
    lessonCount: number;
  }[];
  edges: { source: string; target: string }[];
}

export interface ChatMessage {
  id?: string;
  role: "user" | "assistant" | "system";
  content: string;
  citations?: Citation[] | null;
  createdAt?: string;
}

export interface Citation {
  documentId: string;
  documentTitle: string;
  chunkOrdinal: number;
  text: string;
  score: number;
}

export interface ConversationSummary {
  id: string;
  title: string;
  context: string | null;
  messageCount: number;
  updatedAt: string;
  pinned?: boolean;
}

export interface DocSummary {
  id: string;
  title: string;
  sourceType: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  wordCount: number;
  pageCount: number;
  summary: string | null;
  folderId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  chunkCount: number;
  flashcardCount: number;
  quizCount: number;
}

export interface DocDetail extends DocSummary {
  contentPreview: string;
  contentLength: number;
  folder?: { id: string; name: string; color: string } | null;
  storagePath?: string | null;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  documentCount: number;
  createdAt: string;
}

export interface SearchResult {
  type: "document" | "conversation" | "flashcard" | "lesson" | "quiz" | "course" | "skill";
  id: string;
  title: string;
  snippet: string;
  url: ViewKey;
  meta?: Record<string, string>;
}

export interface ClassroomSummary {
  id: string;
  name: string;
  description: string | null;
  code: string;
  role: string;
  owner: { name: string; avatarUrl: string | null };
  memberCount: number;
  assignmentCount: number;
  courseCount: number;
  createdAt: string;
}

export interface ClassroomDetail extends ClassroomSummary {
  owner: { id: string; name: string; avatarUrl: string | null };
  members: {
    id: string;
    name: string;
    avatarUrl: string | null;
    level: number;
    totalXP: number;
    memberRole: string;
    joinedAt: string;
  }[];
  assignments: {
    id: string;
    title: string;
    description: string;
    dueDate: string;
    maxScore: number;
    mySubmission: { status: string; score: number | null; feedback: string | null } | null;
  }[];
  announcements: Announcement[];
  courses: { id: string; title: string; slug: string }[];
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  author: { name: string; avatarUrl: string | null };
  classroom: string | null;
}

export interface KnowledgeBuildResult {
  documentId: string;
  summary: string;
  skillCount: number;
  edgeCount: number;
  skills: { id: string; name: string; category: string }[];
}

// ============================================================
// AI TEACHER DOMAIN TYPES
// ============================================================

export interface MaterialSummary {
  id: string;
  title: string;
  sourceType: string;
  wordCount: number;
  summary: string | null;
  updatedAt: string;
  analyzed: boolean;
  topicCount: number;
  chunkCount: number;
  flashcardCount: number;
  quizCount: number;
  hasDiagnostic: boolean;
  diagnosticStatus: string | null;
  planStatus: string | null;
  planProgress: number;
}

export interface TopicNode {
  id: string;
  title: string;
  summary: string;
  level: number;
  order: number;
  difficulty: number;
  estimatedMinutes: number;
  concepts: string[];
  formulas: string[];
  definitions: string[];
  status: string;
  prerequisiteTitles: string[];
  questionCount: number;
  lessonCount: number;
  memory: { retention: number; retrievability: number; nextReview: string; repetitions: number } | null;
  planStatus: string | null;
  isWeak: boolean;
  children: TopicNode[];
}

export interface TopicTreeResponse {
  document: { id: string; title: string; summary: string | null; status: string; wordCount: number };
  topics: TopicNode[];
  totalTopics: number;
  analyzed: boolean;
}

export interface DiagnosticQuestionDTO {
  id: string;
  prompt: string;
  type: "mcq" | "truefalse" | "short" | "reasoning" | "scenario" | "numerical";
  options?: string[];
  explanation: string;
  difficulty: number;
  topicTitle: string;
  cognitiveLevel: "conceptual" | "reasoning" | "application" | "problem_solving";
}

export interface LearnerProfileDTO {
  priorKnowledge: number;
  conceptualUnderstanding: number;
  reasoningAbility: number;
  confidence: number;
  learningSpeed: number;
  preferredStyle: "beginner" | "intermediate" | "advanced" | "balanced";
  strengths: string[];
  weaknesses: string[];
  misconceptions: { topic: string; description: string }[];
  totalAssessed: number;
  lastUpdated: string;
}

export interface LearningPlanDTO {
  id: string;
  status: string;
  totalTopics: number;
  completedTopics: number;
  estimatedMinutes: number;
  items: {
    id: string;
    order: number;
    status: string;
    isWeak: boolean;
    isPrereq: boolean;
    scheduledFor: string | null;
    topic: { id: string; title: string; summary: string; level: number; difficulty: number; estimatedMinutes: number };
  }[];
}

export interface LessonStepDTO {
  type: "explanation" | "example" | "visualization" | "question" | "feedback" | "summary";
  title: string;
  content: string;
  questionType?: "mcq" | "truefalse" | "short" | "reasoning";
  options?: string[];
  correctIndex?: number;
  correctAnswer?: string[];
  hint?: string;
  visualizationType?: "diagram" | "analogy" | "comparison" | "step_by_step";
  index: number;
}

export interface LessonSessionDTO {
  sessionId: string;
  lessonId: string;
  topic: { id: string; title: string; summary: string };
  steps: LessonStepDTO[];
  totalSteps: number;
  currentStep: number;
}

export interface AnswerAnalysisDTO {
  correct: boolean;
  score: number;
  reasoning: "strong" | "adequate" | "weak" | "absent";
  misconceptions: string[];
  confidence: "high" | "medium" | "low";
  explanationQuality: "excellent" | "good" | "fair" | "poor";
  feedback: string;
  suggestions: string[];
}

export interface TeachingAnalyticsDTO {
  profile: LearnerProfileDTO | null;
  conceptMastery: { topic: string; document: string; retention: number; retrievability: number; repetitions: number; nextReview: string }[];
  strongTopics: string[];
  weakTopics: string[];
  quizTrend: { attempt: number; score: number; quiz: string }[];
  reasoningImprovement: number;
  avgQuizScore: number;
  planProgress: { document: string; totalTopics: number; completedTopics: number; progress: number; estimatedMinutes: number }[];
  stats: {
    totalLessons: number;
    completedLessons: number;
    totalQuizzes: number;
    avgRetention: number;
    timeSpentMinutes: number;
    diagnosticsCompleted: number;
    topicsTracked: number;
  };
}

export interface MemoryDueDTO {
  due: { topicId: string; title: string; document: string; retrievability: number; nextReview: string }[];
  stats: { totalTracked: number; dueCount: number; avgRetention: number; strongCount: number; weakCount: number };
}

export interface MissionTask {
  id: string;
  type: "learn" | "review" | "analyze" | "diagnostic" | "xp";
  title: string;
  description: string;
  targetId?: string;
  documentTitle?: string;
  estimatedMinutes: number;
  difficulty?: number;
  isWeak?: boolean;
  completed: boolean;
}

export interface MissionDTO {
  date: string;
  greeting: string;
  xpEarnedToday: number;
  xpTarget: number;
  xpProgress: number;
  streak: { current: number; longest: number; atRisk: boolean };
  level: number;
  totalXP: number;
  preferredStyle: string;
  estimatedMinutes: number;
  taskCount: number;
  completedCount: number;
  tasks: MissionTask[];
}

export interface JourneyEvent {
  id: string;
  type: "lesson" | "quiz" | "diagnostic" | "document" | "xp";
  title: string;
  description: string;
  timestamp: string;
  icon: string;
  xp?: number;
  meta?: Record<string, string | number>;
}

export interface JourneyDTO {
  timeline: JourneyEvent[];
  summary: {
    totalXP30d: number;
    lessonsCompleted: number;
    quizzesPassed: number;
    diagnosticsCompleted: number;
    documentsUploaded: number;
    activeDays: number;
  };
}
