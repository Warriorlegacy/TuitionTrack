import { z } from "zod";

export const tutorMode = z.enum([
  "socratic", "exam_coach", "concept_teacher", "doubt_solver",
  "mistake_coach", "viva", "revision", "homework", "teacher_clone", "parent_safe",
]);
export type TutorMode = z.infer<typeof tutorMode>;

export const tutorSchema = z.object({
  student_id: z.string().uuid(),
  message: z.string().min(1).max(4000),
  mode: tutorMode.default("socratic"),
  conversation_id: z.string().uuid().optional(),
  concept_id: z.string().uuid().optional(),
  source_only: z.boolean().default(false), // source-grounded RAG (#21)
});
export type TutorInput = z.infer<typeof tutorSchema>;

export const quizSchema = z.object({
  student_id: z.string().uuid(),
  concept_id: z.string().uuid().optional(),
  count: z.number().int().min(1).max(10).default(5),
  difficulty: z.number().int().min(1).max(5).default(3),
  qtype: z.enum(["mcq", "numeric", "short"]).default("mcq"),
});
export type QuizInput = z.infer<typeof quizSchema>;

export const flashcardSchema = z.object({
  student_id: z.string().uuid(),
  concept_id: z.string().uuid().optional(),
  count: z.number().int().min(1).max(20).default(8),
  front: z.string().optional(),
  back: z.string().optional(),
});
export type FlashcardInput = z.infer<typeof flashcardSchema>;

export const documentSchema = z.object({
  student_id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  source_type: z.enum(["pdf", "image", "text", "docx"]).default("pdf"),
  content: z.string().min(1).max(60000), // MVP: inline text; storage upload next
  language: z.string().default("en"),
});
export type DocumentInput = z.infer<typeof documentSchema>;

export const submitSchema = z.object({
  student_id: z.string().uuid(),
  responses: z.array(z.object({
    assessment_item_id: z.string().uuid(),
    answer: z.unknown(),
    time_ms: z.number().int().min(0).max(3_600_000).optional(),
    confidence: z.number().int().min(1).max(5).optional(),
    hints_used: z.number().int().min(0).max(10).default(0),
  })).min(1).max(100),
  idempotency_key: z.string().max(100).optional(),
});
export type SubmitInput = z.infer<typeof submitSchema>;

export const reviewAnswerSchema = z.object({
  spaced_item_id: z.string().uuid(),
  student_id: z.string().uuid(),
  grade: z.number().int().min(1).max(4), // 1 again … 4 easy
  response_ms: z.number().int().min(0).optional(),
});
export type ReviewAnswerInput = z.infer<typeof reviewAnswerSchema>;

export const planGenerateSchema = z.object({
  student_id: z.string().uuid(),
  budget_min: z.number().int().min(15).max(600).default(120),
  days: z.number().int().min(1).max(30).default(7),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), // YYYY-MM-DD
  target_score: z.number().min(0).max(100).optional(),
  title: z.string().min(1).max(120).default("Study plan"),
});
export type PlanGenerateInput = z.infer<typeof planGenerateSchema>;

// Planner read-path (#18): student marks a plan task done/skipped/deferred.
export const planTaskUpdateSchema = z.object({
  student_id: z.string().uuid(),
  task_id: z.string().uuid(),
  status: z.enum(["pending", "done", "skipped"]),
});
export type PlanTaskUpdateInput = z.infer<typeof planTaskUpdateSchema>;
