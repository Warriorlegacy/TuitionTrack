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

  // A transient Auth outage (cold start, network blip) must never read as
  // "logged out". Retry once on transport-level failures only — a genuine
  // missing/invalid session returns immediately with no delay.
  const isTransientAuthError = (error: { message?: string; status?: number } | null) => {
    if (!error) return false;
    if (typeof error.status === "number" && error.status >= 500) return true;
    return /fetch failed|network|timeout|econn|socket|502|503|504/i.test(
      error.message ?? "",
    );
  };

  const readUser = async () => supabase.auth.getUser();

  let user: User | null = null;
  try {
    const first = await readUser();
    user = first.data.user;
    if (!user && isTransientAuthError(first.error)) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const retry = await readUser();
      user = retry.data.user;
    }
  } catch {
    // Network threw instead of returning an error — one retry, then logout.
    try {
      await new Promise((resolve) => setTimeout(resolve, 500));
      user = (await readUser()).data.user;
    } catch {
      user = null;
    }
  }

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

  // DB failures below must degrade to fallbacks, never to "logged out":
  // the user is authenticated at this point, so a profile/students query
  // blip returns partial context instead of bouncing to /login.
  try {
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
      let { data } = await supabase
        .from("students")
        .select("*")
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });

      if (!data || data.length === 0) {
        try {
          const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
          const admin = createSupabaseAdminClient();
          const { data: adminData } = await admin
            .from("students")
            .select("*")
            .eq("teacher_id", user.id)
            .order("created_at", { ascending: false });
          if (adminData && adminData.length > 0) {
            data = adminData;
          }
        } catch {
          // ignore fallback error
        }
      }

      accessibleStudents = (data as StudentRow[] | null) ?? [];
    } else if (effectiveRole === "parent" && email) {
      let { data } = await supabase
        .from("students")
        .select("*")
        .ilike("parent_email", email)
        .order("created_at", { ascending: false });

      if (!data || data.length === 0) {
        try {
          const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
          const admin = createSupabaseAdminClient();
          const { data: adminData } = await admin
            .from("students")
            .select("*")
            .ilike("parent_email", email)
            .order("created_at", { ascending: false });
          if (adminData && adminData.length > 0) {
            data = adminData;
          }
        } catch {
          // ignore fallback
        }
      }

      accessibleStudents = (data as StudentRow[] | null) ?? [];
    } else if (effectiveRole === "student" && email) {
      let { data } = await supabase
        .from("students")
        .select("*")
        .ilike("student_email", email)
        .order("created_at", { ascending: false });

      if (!data || data.length === 0) {
        try {
          const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
          const admin = createSupabaseAdminClient();
          const { data: adminData } = await admin
            .from("students")
            .select("*")
            .ilike("student_email", email)
            .order("created_at", { ascending: false });
          if (adminData && adminData.length > 0) {
            data = adminData;
          }
        } catch {
          // ignore fallback
        }
      }

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
  } catch {
    const metadataRole = (user.user_metadata?.role as AppRole | undefined) ?? "teacher";
    return {
      configured: true,
      user,
      profile: null,
      role: metadataRole,
      email,
      accessibleStudents: [],
      teacherIds: metadataRole === "teacher" ? [user.id] : [],
      canManage: metadataRole === "teacher",
    };
  }
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
