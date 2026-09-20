import "server-only";

import { redirect } from "next/navigation";
import { getAuthContext, type AuthContext } from "@/lib/auth";
import type { StudentRow } from "@/lib/db/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type StudentAuthContext = AuthContext & {
  student: StudentRow | null;
  isStudent: boolean;
};

export async function getStudentContext(): Promise<StudentAuthContext> {
  const base = await getAuthContext();

  if (!base.user) {
    return {
      ...base,
      student: null,
      isStudent: false,
    };
  }

  const supabase = createSupabaseServerClient();

  // 1. Check active portal_access_grants for student portal
  const { data: grant } = await supabase
    .from("portal_access_grants")
    .select("student_id, status")
    .eq("user_id", base.user.id)
    .eq("portal_type", "student")
    .eq("status", "active")
    .order("last_used_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let studentId: string | undefined = (grant as { student_id?: string } | null)?.student_id;

  // 2. Fallback: Check student_email match
  if (!studentId && base.email) {
    const { data: std } = await supabase
      .from("students")
      .select("id")
      .ilike("student_email", base.email)
      .limit(1)
      .maybeSingle();
    studentId = std?.id;
  }

  if (!studentId) {
    return {
      ...base,
      student: null,
      isStudent: base.role === "student",
    };
  }

  const { data: student } = await supabase
    .from("students")
    .select("*")
    .eq("id", studentId)
    .maybeSingle<StudentRow>();

  return {
    ...base,
    student: student ?? null,
    isStudent: Boolean(student) || base.role === "student",
  };
}

export async function requireStudentContext(): Promise<StudentAuthContext> {
  const context = await getStudentContext();

  if (!context.user) {
    redirect("/login?next=/student/dashboard");
  }

  return context;
}
