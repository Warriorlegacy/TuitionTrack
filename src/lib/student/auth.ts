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

  // 3. Fallback: Check workspace membership
  if (!studentId && base.user) {
    try {
      const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
      const admin = createSupabaseAdminClient();
      const { data: wsMem } = await admin
        .from("workspace_members")
        .select("workspace_id, role, workspace:workspaces(id, owner_id)")
        .eq("user_id", base.user.id)
        .eq("status", "active")
        .maybeSingle();

      if (wsMem && (wsMem.role === "student" || base.role === "student")) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const wsOwnerId = (wsMem.workspace as any)?.owner_id;
        // Check if student profile exists in this workspace
        const { data: existingStd } = await admin
          .from("students")
          .select("id")
          .eq("workspace_id", wsMem.workspace_id)
          .ilike("student_email", base.email || "")
          .maybeSingle();

        if (existingStd) {
          studentId = existingStd.id;
        } else if (wsOwnerId) {
          // Provision student profile in teacher's workspace
          const studentName = base.profile?.name || base.user.user_metadata?.name || "Student";
          const { data: newStd } = await admin
            .from("students")
            .insert({
              name: studentName,
              class: "9",
              student_email: base.email,
              teacher_id: wsOwnerId,
              workspace_id: wsMem.workspace_id,
              parent_name: "Parent",
              parent_phone: "",
            })
            .select("id")
            .single();

          if (newStd) {
            studentId = newStd.id;
          }
        }
      }
    } catch {
      // ignore fallback error
    }
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
