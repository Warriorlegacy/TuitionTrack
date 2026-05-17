import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { AppRole, StudentRow, UserRow } from "@/lib/db/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type AuthContext = {
  configured: boolean;
  user: User | null;
  profile: UserRow | null;
  role: AppRole | null;
  email: string | null;
  accessibleStudents: StudentRow[];
  teacherIds: string[];
  canManage: boolean;
};

export async function getAuthContext(): Promise<AuthContext> {
  if (!isSupabaseConfigured()) {
    return {
      configured: false,
      user: null,
      profile: null,
      role: null,
      email: null,
      accessibleStudents: [],
      teacherIds: [],
      canManage: false,
    };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      configured: true,
      user: null,
      profile: null,
      role: null,
      email: null,
      accessibleStudents: [],
      teacherIds: [],
      canManage: false,
    };
  }

  const email = user.email?.toLowerCase() ?? null;
  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .maybeSingle<UserRow>();

  // Use metadata role as fallback if profile record is missing
  const metadataRole = user.user_metadata?.role as AppRole | undefined;
  const effectiveRole = profile?.role ?? metadataRole ?? "teacher";

  let accessibleStudents: StudentRow[] = [];

  if (effectiveRole === "teacher") {
    const { data } = await supabase
      .from("students")
      .select("*")
      .eq("teacher_id", user.id)
      .order("created_at", { ascending: false });
    accessibleStudents = (data as StudentRow[] | null) ?? [];
  } else if (effectiveRole === "parent" && email) {
    const { data } = await supabase
      .from("students")
      .select("*")
      .ilike("parent_email", email)
      .order("created_at", { ascending: false });
    accessibleStudents = (data as StudentRow[] | null) ?? [];
  } else if (effectiveRole === "student" && email) {
    const { data } = await supabase
      .from("students")
      .select("*")
      .ilike("student_email", email)
      .order("created_at", { ascending: false });
    accessibleStudents = (data as StudentRow[] | null) ?? [];
  }

  const teacherIds = Array.from(
    new Set([
      ...(effectiveRole === "teacher" ? [user.id] : []),
      ...accessibleStudents.map((student) => student.teacher_id),
    ]),
  );

  return {
    configured: true,
    user,
    profile: profile ?? null,
    role: effectiveRole,
    email,
    accessibleStudents,
    teacherIds,
    canManage: effectiveRole === "teacher",
  };
}

export async function requireAuthContext() {
  const context = await getAuthContext();

  if (!context.configured) {
    return context;
  }

  if (!context.user) {
    redirect("/login");
  }

  if (!context.profile && context.role === "teacher") {
    redirect("/auth/onboarding");
  }

  if (context.role === "teacher" && context.profile && !context.profile.name) {
    redirect("/auth/onboarding");
  }

  return context;
}

export async function requireTeacherContext() {
  const context = await requireAuthContext();

  if (!context.configured) {
    return context;
  }

  if (context.role !== "teacher") {
    redirect("/app/dashboard");
  }

  return context;
}
