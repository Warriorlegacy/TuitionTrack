import { z } from "zod";

// Phase 0 org contracts (mirrors 20260915000000 migration checks).

export const orgRole = z.enum(["owner", "tutor", "parent", "student"]);
export type OrgRoleInput = z.infer<typeof orgRole>;

export const orgSchema = z.object({
  name: z.string().min(1).max(120),
});
export type OrgInput = z.infer<typeof orgSchema>;

export const orgMemberSchema = z.object({
  org_id: z.string().uuid(),
  user_id: z.string().uuid(),
  role: orgRole,
});
export type OrgMemberInput = z.infer<typeof orgMemberSchema>;

export const batchSchema = z.object({
  org_id: z.string().uuid(),
  name: z.string().min(1).max(120),
  teacher_id: z.string().uuid().optional(),
});
export type BatchInput = z.infer<typeof batchSchema>;

export const enrollmentSchema = z.object({
  batch_id: z.string().uuid(),
  student_id: z.string().uuid(),
});
export type EnrollmentInput = z.infer<typeof enrollmentSchema>;

export const guardianLinkSchema = z.object({
  student_id: z.string().uuid(),
  guardian_user_id: z.string().uuid().optional(),
  guardian_email: z.string().email().max(255).optional(),
  relationship: z.string().min(1).max(40).default("parent"),
  // verified_consent_at is set server-side on consent capture, never by clients
}).refine((v) => v.guardian_user_id ?? v.guardian_email, {
  message: "guardian_user_id or guardian_email is required",
});
export type GuardianLinkInput = z.infer<typeof guardianLinkSchema>;
