/**
 * Zod validation schemas for all API inputs.
 */
import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(80),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  role: z.enum(["STUDENT", "TEACHER", "ADMIN"]).optional().default("STUDENT"),
});

export const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  deviceFingerprint: z.string().optional(),
});

export const chatMessageSchema = z.object({
  conversationId: z.string().optional(),
  message: z.string().min(1).max(4000),
  context: z
    .object({
      skillId: z.string().optional(),
      lessonId: z.string().optional(),
      courseId: z.string().optional(),
    })
    .optional(),
});

export const flashcardReviewSchema = z.object({
  flashcardId: z.string(),
  quality: z.number().int().min(0).max(5),
});

export const quizAnswerSchema = z.object({
  attemptId: z.string(),
  questionId: z.string(),
  selectedIndex: z.number().int().min(0),
  timeMs: z.number().int().min(0).optional().default(0),
});

export const startQuizSchema = z.object({
  quizId: z.string().optional(),
  skillId: z.string().optional(),
  lessonId: z.string().optional(),
  adaptive: z.boolean().optional().default(true),
  questionCount: z.number().int().min(1).max(20).optional().default(5),
});

export const lessonProgressSchema = z.object({
  lessonId: z.string(),
  status: z.enum(["not_started", "in_progress", "completed"]).optional(),
  timeSpent: z.number().int().min(0).optional(),
});

export const documentUploadSchema = z.object({
  title: z.string().min(1).max(200),
  sourceType: z.enum(["pdf", "docx", "text"]),
  contentText: z.string().min(1).max(500_000),
  mimeType: z.string().optional(),
  sizeBytes: z.number().int().min(0).optional(),
});

export const documentSearchSchema = z.object({
  query: z.string().min(1).max(500),
  topK: z.number().int().min(1).max(20).optional().default(5),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChatMessageInput = z.infer<typeof chatMessageSchema>;
export type FlashcardReviewInput = z.infer<typeof flashcardReviewSchema>;
export type QuizAnswerInput = z.infer<typeof quizAnswerSchema>;
export type StartQuizInput = z.infer<typeof startQuizSchema>;
export type LessonProgressInput = z.infer<typeof lessonProgressSchema>;
export type DocumentUploadInput = z.infer<typeof documentUploadSchema>;
export type DocumentSearchInput = z.infer<typeof documentSearchSchema>;
