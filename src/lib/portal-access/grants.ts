import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PortalAccessGrant, PortalPreview, PortalType, StudentPortalStatus } from "./types";
import type { PortalGrantStatus } from "./types";

/**
 * Effective portal access across EVERY login path — not just grant rows.
 * Students reach the portal via workspace-code joins (an account whose email
 * matches `student_email` resolves access) and parents via verified guardian
 * relationships; both bypass `portal_access_grants` entirely, which is why
 * teacher surfaces showed "NOT GENERATED" for working logins.
 *
 * Both callers are teacher-gated pages, so the supplementary lookups use the
 * admin client; grant reads stay on the request client as before.
 */
async function getEffectiveAccess(
  students: { id: string; student_email?: string | null }[],
  grantsByStudent: Map<string, PortalAccessGrant[]>,
): Promise<{
  studentVia: Map<string, "grant" | "account">;
  parentLinked: Set<string>;
}> {
  const studentVia = new Map<string, "grant" | "account">();
  const parentLinked = new Set<string>();
  if (students.length === 0) return { studentVia, parentLinked };

  students.forEach((s) => {
    const gs = grantsByStudent.get(s.id) ?? [];
    if (gs.some((g) => g.portal_type === "student" && g.status === "active")) {
      studentVia.set(s.id, "grant");
    }
    if (gs.some((g) => g.portal_type === "parent" && g.status === "active")) {
      parentLinked.add(`grant:${s.id}`);
    }
  });

  const admin = createSupabaseAdminClient();
  const ids = students.map((s) => s.id);

  const { data: rels } = await admin
    .from("guardian_student_relationships")
    .select("student_id")
    .in("student_id", ids)
    .eq("status", "active")
    .not("verified_at", "is", null);
  ((rels ?? []) as { student_id: string }[]).forEach((r) => {
    parentLinked.add(r.student_id);
  });

  const emails = Array.from(
    new Set(
      students.map((s) => (s.student_email ?? "").trim().toLowerCase()).filter(Boolean),
    ),
  );
  if (emails.length > 0) {
    const { data: users } = await admin.from("users").select("email").in("email", emails);
    const existing = new Set(
      ((users ?? []) as { email: string }[]).map((u) => u.email.toLowerCase()),
    );
    students.forEach((s) => {
      if (
        !studentVia.has(s.id) &&
        existing.has((s.student_email ?? "").trim().toLowerCase())
      ) {
        studentVia.set(s.id, "account");
      }
    });
  }

  return { studentVia, parentLinked };
}

function toDisplayStatus(
  grant: { status: PortalGrantStatus } | undefined,
  effectiveActive: boolean,
): PortalGrantStatus | "not_generated" {
  if (effectiveActive) return "active";
  return grant?.status ?? "not_generated";
}

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
  const grantsByStudent = new Map<string, PortalAccessGrant[]>();
  for (const g of grantList) {
    const arr = grantsByStudent.get(g.student_id) ?? [];
    arr.push(g);
    grantsByStudent.set(g.student_id, arr);
  }
  const { studentVia, parentLinked } = await getEffectiveAccess(students, grantsByStudent);

  const toGrant = (g: PortalAccessGrant | undefined) =>
    g
      ? {
          id: g.id,
          status: g.status,
          expiresAt: g.expires_at,
          lastUsedAt: g.last_used_at,
          targetEmail: g.target_email,
        }
      : null;

  const studentStatuses: StudentPortalStatus[] = students.map((s) => {
    const sGrants = grantsByStudent.get(s.id) ?? [];
    const parentG = sGrants.find((g) => g.portal_type === "parent");
    const studentG = sGrants.find((g) => g.portal_type === "student");
    const studentEffective = studentVia.has(s.id);
    const parentEffective = parentLinked.has(s.id) || parentLinked.has(`grant:${s.id}`);
    const parentDisplay = toDisplayStatus(parentG, parentEffective);
    const studentDisplay = toDisplayStatus(studentG, studentEffective);

    return {
      studentId: s.id,
      studentName: s.name,
      studentClass: s.class,
      parentEmail: s.parent_email,
      studentEmail: s.student_email,
      parentGrant: toGrant(parentG),
      studentGrant: toGrant(studentG),
      parentDisplayStatus: parentDisplay,
      studentDisplayStatus: studentDisplay,
      parentAccessVia:
        parentDisplay === "active" ? (parentG?.status === "active" ? "grant" : "relationship") : null,
      studentAccessVia: studentDisplay === "active" ? (studentVia.get(s.id) ?? null) : null,
    };
  });

  let parentsActive = 0;
  let parentsPending = 0;
  let studentsActive = 0;
  let studentsPending = 0;

  studentStatuses.forEach((st) => {
    if (st.parentDisplayStatus === "active") parentsActive++;
    else if (st.parentGrant?.status === "pending") parentsPending++;

    if (st.studentDisplayStatus === "active") studentsActive++;
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
  const { studentVia, parentLinked } = await getEffectiveAccess(
    [{ id: student.id, student_email: student.student_email }],
    new Map([[student.id, grantList]]),
  );
  const studentEffective = studentVia.has(student.id);
  const parentEffective = parentLinked.has(student.id) || parentLinked.has(`grant:${student.id}`);
  const parentDisplay = toDisplayStatus(parentG, parentEffective);
  const studentDisplay = toDisplayStatus(studentG, studentEffective);

  const toGrant = (g: PortalAccessGrant | undefined) =>
    g
      ? {
          id: g.id,
          status: g.status,
          expiresAt: g.expires_at,
          lastUsedAt: g.last_used_at,
          targetEmail: g.target_email,
        }
      : null;

  return {
    studentId: student.id,
    studentName: student.name,
    studentClass: student.class,
    parentEmail: student.parent_email,
    studentEmail: student.student_email,
    parentGrant: toGrant(parentG),
    studentGrant: toGrant(studentG),
    parentDisplayStatus: parentDisplay,
    studentDisplayStatus: studentDisplay,
    parentAccessVia:
      parentDisplay === "active" ? (parentG?.status === "active" ? "grant" : "relationship") : null,
    studentAccessVia: studentDisplay === "active" ? (studentVia.get(student.id) ?? null) : null,
  };
}
