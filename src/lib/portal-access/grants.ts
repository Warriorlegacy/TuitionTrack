import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PortalAccessGrant, PortalPreview, PortalType, StudentPortalStatus } from "./types";

export function buildPortalUrl(origin: string, portalType: PortalType, token: string): string {
  const clean = origin.replace(/\/+$/, "");
  return `${clean}/portal/${portalType}/${token}`;
}

export type CreateGrantResult =
  | {
      ok: true;
      grantId: string;
      token: string;
      portalType: PortalType;
      studentId: string;
      studentName: string;
      expiresAt: string;
      isRegenerated: boolean;
    }
  | { ok: false; error: string };

export async function createOrRegeneratePortalGrant(
  studentId: string,
  portalType: PortalType,
  targetEmail?: string | null,
): Promise<CreateGrantResult> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.rpc("create_or_regenerate_portal_grant", {
    p_student_id: studentId,
    p_portal_type: portalType,
    p_target_email: targetEmail || null,
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to create portal grant" };
  }

  const res = data as {
    ok: boolean;
    error?: string;
    grant_id?: string;
    token?: string;
    portal_type?: PortalType;
    student_id?: string;
    student_name?: string;
    expires_at?: string;
    is_regenerated?: boolean;
  };

  if (!res.ok || !res.token || !res.grant_id) {
    return { ok: false, error: res.error ?? "Failed to create portal grant" };
  }

  return {
    ok: true,
    grantId: res.grant_id,
    token: res.token,
    portalType: res.portal_type!,
    studentId: res.student_id!,
    studentName: res.student_name ?? "Student",
    expiresAt: res.expires_at ?? new Date().toISOString(),
    isRegenerated: res.is_regenerated ?? false,
  };
}

export async function revokePortalGrant(grantId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.rpc("revoke_portal_grant", {
    p_grant_id: grantId,
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "Failed to revoke portal grant" };
  }

  const res = data as { ok: boolean; error?: string };
  return { ok: res.ok, error: res.error };
}

export async function previewPortalGrant(token: string): Promise<PortalPreview> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.rpc("preview_portal_grant", {
    p_token: token,
  });

  if (error || !data) {
    return { ok: false, error: "invalid_token" };
  }

  return data as PortalPreview;
}

export async function redeemPortalGrant(
  token: string,
): Promise<{ ok: boolean; portal_type?: PortalType; student_id?: string; error?: string }> {
  const supabase = createSupabaseServerClient();

  const { data, error } = await supabase.rpc("redeem_portal_grant", {
    p_token: token,
  });

  if (error || !data) {
    return { ok: false, error: error?.message ?? "unknown" };
  }

  const res = data as {
    ok: boolean;
    error?: string;
    portal_type?: PortalType;
    student_id?: string;
  };

  return res;
}

export async function getTeacherPortalAccessOverview(): Promise<{
  students: StudentPortalStatus[];
  stats: {
    totalStudents: number;
    parentsActive: number;
    parentsPending: number;
    studentsActive: number;
    studentsPending: number;
  };
}> {
  const supabase = createSupabaseServerClient();

  const { data: students, error: studentErr } = await supabase
    .from("students")
    .select("id, name, class, parent_email, student_email")
    .order("name", { ascending: true });

  if (studentErr || !students) {
    return {
      students: [],
      stats: {
        totalStudents: 0,
        parentsActive: 0,
        parentsPending: 0,
        studentsActive: 0,
        studentsPending: 0,
      },
    };
  }

  const { data: grants } = await supabase
    .from("portal_access_grants")
    .select("id, student_id, portal_type, status, expires_at, last_used_at, target_email");

  const grantList = (grants ?? []) as PortalAccessGrant[];

  const studentStatuses: StudentPortalStatus[] = students.map((s) => {
    const sGrants = grantList.filter((g) => g.student_id === s.id);
    const parentG = sGrants.find((g) => g.portal_type === "parent");
    const studentG = sGrants.find((g) => g.portal_type === "student");

    return {
      studentId: s.id,
      studentName: s.name,
      studentClass: s.class,
      parentEmail: s.parent_email,
      studentEmail: s.student_email,
      parentGrant: parentG
        ? {
            id: parentG.id,
            status: parentG.status,
            expiresAt: parentG.expires_at,
            lastUsedAt: parentG.last_used_at,
            targetEmail: parentG.target_email,
          }
        : null,
      studentGrant: studentG
        ? {
            id: studentG.id,
            status: studentG.status,
            expiresAt: studentG.expires_at,
            lastUsedAt: studentG.last_used_at,
            targetEmail: studentG.target_email,
          }
        : null,
    };
  });

  let parentsActive = 0;
  let parentsPending = 0;
  let studentsActive = 0;
  let studentsPending = 0;

  studentStatuses.forEach((st) => {
    if (st.parentGrant?.status === "active") parentsActive++;
    else if (st.parentGrant?.status === "pending") parentsPending++;

    if (st.studentGrant?.status === "active") studentsActive++;
    else if (st.studentGrant?.status === "pending") studentsPending++;
  });

  return {
    students: studentStatuses,
    stats: {
      totalStudents: students.length,
      parentsActive,
      parentsPending,
      studentsActive,
      studentsPending,
    },
  };
}

export async function getStudentPortalAccess(studentId: string): Promise<StudentPortalStatus | null> {
  const supabase = createSupabaseServerClient();

  const { data: student, error } = await supabase
    .from("students")
    .select("id, name, class, parent_email, student_email")
    .eq("id", studentId)
    .maybeSingle();

  if (error || !student) return null;

  const { data: grants } = await supabase
    .from("portal_access_grants")
    .select("id, student_id, portal_type, status, expires_at, last_used_at, target_email")
    .eq("student_id", studentId);

  const grantList = (grants ?? []) as PortalAccessGrant[];
  const parentG = grantList.find((g) => g.portal_type === "parent");
  const studentG = grantList.find((g) => g.portal_type === "student");

  return {
    studentId: student.id,
    studentName: student.name,
    studentClass: student.class,
    parentEmail: student.parent_email,
    studentEmail: student.student_email,
    parentGrant: parentG
      ? {
          id: parentG.id,
          status: parentG.status,
          expiresAt: parentG.expires_at,
          lastUsedAt: parentG.last_used_at,
          targetEmail: parentG.target_email,
        }
      : null,
    studentGrant: studentG
      ? {
          id: studentG.id,
          status: studentG.status,
          expiresAt: studentG.expires_at,
          lastUsedAt: studentG.last_used_at,
          targetEmail: studentG.target_email,
        }
      : null,
  };
}
