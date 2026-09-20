export type PortalType = "parent" | "student";

export type PortalGrantStatus = "pending" | "active" | "revoked" | "expired";

export type PortalAccessGrant = {
  id: string;
  user_id: string | null;
  teacher_id: string;
  workspace_id: string | null;
  student_id: string;
  portal_type: PortalType;
  status: PortalGrantStatus;
  token_hash: string;
  target_email: string | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
  created_by: string | null;
};

export type StudentPortalStatus = {
  studentId: string;
  studentName: string;
  studentClass: string;
  parentEmail?: string | null;
  studentEmail?: string | null;
  parentGrant?: {
    id: string;
    status: PortalGrantStatus;
    expiresAt: string;
    lastUsedAt: string | null;
    targetEmail: string | null;
  } | null;
  studentGrant?: {
    id: string;
    status: PortalGrantStatus;
    expiresAt: string;
    lastUsedAt: string | null;
    targetEmail: string | null;
  } | null;
};

export type PortalPreview = {
  ok: boolean;
  portal_type?: PortalType;
  student_name?: string;
  student_class?: string;
  target_email?: string | null;
  is_active?: boolean;
  requires_auth?: boolean;
  error?: "invalid_token" | "revoked" | "expired" | "unknown";
};
