"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthContext, requireTeacherContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeOptional } from "@/lib/utils";
import type { AppRole } from "@/lib/db/types";

type ActionResult = {
  success: boolean;
  message: string;
};

const studentSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, "Student name is required"),
  class: z.string().trim().min(1, "Class is required"),
  parent_name: z.string().optional().or(z.literal("")),
  parent_phone: z.string().optional().or(z.literal("")),
  parent_email: z.string().email("Invalid parent email").optional().or(z.literal("")),
  student_email: z.string().email("Invalid student email").optional().or(z.literal("")),
});

const homeworkSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2),
  description: z.string().optional(),
  due_date: z.string().min(1),
  student_ids: z.array(z.string().uuid()).min(1),
  status: z.enum(["pending", "completed"]).default("pending"),
});

const attendanceSchema = z.object({
  date: z.string().min(1),
  entries: z.array(
    z.object({
      student_id: z.string().uuid(),
      present: z.boolean(),
    }),
  ),
});

const feeSchema = z.object({
  id: z.string().uuid().optional(),
  student_id: z.string().uuid(),
  amount: z.coerce.number().positive(),
  status: z.enum(["paid", "unpaid", "overdue"]),
  due_date: z.string().min(1),
});

const testSchema = z.object({
  id: z.string().uuid().optional(),
  student_id: z.string().uuid(),
  subject: z.string().min(2),
  marks: z.coerce.number().min(0),
  total: z.coerce.number().positive(),
  date: z.string().min(1),
});

const announcementSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(2),
  message: z.string().min(4),
});

function revalidatePortal() {
  [
    "/app/dashboard",
    "/app/students",
    "/app/homework",
    "/app/attendance",
    "/app/tests",
    "/app/fees",
    "/app/announcements",
    "/app/reports",
    "/app/settings",
  ].forEach((path) => revalidatePath(path));
}

export async function signOutAction() {
  const supabase = createSupabaseServerClient();
  // Local scope: sign out this device only. Global would invalidate the
  // refresh token server-side and log the user out of their phone too —
  // the exact "auto-logout" complaint this polish fixes.
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Still redirect: a failed network call must not trap the user.
  }
  redirect("/login");
}

export async function completeOnboardingAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const context = await getAuthContext();

  if (!context.user || !context.user.email) {
    redirect("/login");
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
      .from("users")
      .upsert({
        id: context.user.id,
        email: context.user.email.toLowerCase(),
        name,
        role: context.profile?.role ?? "teacher",
      });

  if (error) {
    console.error("Error in completeOnboardingAction:", error);
    // Continue anyway as this is not critical for onboarding flow
  }

  revalidatePortal();
  redirect("/app/dashboard");
}

export async function saveStudentAction(input: z.infer<typeof studentSchema>): Promise<ActionResult> {
  const parsed = studentSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid student data." };
  }

  const context = await requireTeacherContext();
  if (!context.configured || !context.profile) {
    return { success: false, message: "Supabase is not configured." };
  }

  const admin = createSupabaseAdminClient();
  const payload = {
    name: parsed.data.name.trim(),
    class: parsed.data.class.trim(),
    parent_name: parsed.data.parent_name?.trim() || "",
    parent_phone: parsed.data.parent_phone?.trim() || "",
    parent_email: normalizeOptional(parsed.data.parent_email),
    student_email: normalizeOptional(parsed.data.student_email),
    teacher_id: context.profile.id,
  };

  const { error } = parsed.data.id
    ? await admin
        .from("students")
        .update(payload)
        .eq("id", parsed.data.id)
        .eq("teacher_id", context.profile.id)
    : await admin.from("students").insert(payload);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePortal();
  return {
    success: true,
    message: parsed.data.id ? "Student updated successfully." : "Student added successfully.",
  };
}

export async function deleteStudentAction(id: string): Promise<ActionResult> {
  const context = await requireTeacherContext();
  if (!context.configured || !context.profile) {
    return { success: false, message: "Supabase is not configured." };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("students")
    .delete()
    .eq("id", id)
    .eq("teacher_id", context.profile.id);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePortal();
  return { success: true, message: "Student deleted successfully." };
}

export async function saveHomeworkAction(
  input: z.infer<typeof homeworkSchema>,
): Promise<ActionResult> {
  const parsed = homeworkSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid homework data." };
  }

  const context = await requireTeacherContext();
  if (!context.configured || !context.profile) {
    return { success: false, message: "Supabase is not configured." };
  }

  const supabase = createSupabaseServerClient();
  const basePayload = {
    title: parsed.data.title,
    description: normalizeOptional(parsed.data.description),
    due_date: parsed.data.due_date,
    status: parsed.data.status,
    teacher_id: context.profile.id,
  };

  const { error } = parsed.data.id
    ? await supabase
        .from("homework")
        .update({
          ...basePayload,
          student_id: parsed.data.student_ids[0],
        })
        .eq("id", parsed.data.id)
        .eq("teacher_id", context.profile.id)
    : await supabase.from("homework").insert(
        parsed.data.student_ids.map((studentId) => ({
          ...basePayload,
          student_id: studentId,
        })),
      );

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePortal();
  return {
    success: true,
    message: parsed.data.id ? "Homework updated successfully." : "Homework assigned successfully.",
  };
}

export async function deleteHomeworkAction(id: string): Promise<ActionResult> {
  const context = await requireTeacherContext();
  if (!context.configured || !context.profile) {
    return { success: false, message: "Unauthorized. Only teachers can delete homework." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("homework")
    .update({ deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("teacher_id", context.profile.id);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePortal();
  return { success: true, message: "Homework deleted successfully." };
}

export async function toggleHomeworkStatusAction(
  id: string,
  status: "pending" | "completed",
): Promise<ActionResult> {
  const context = await requireTeacherContext();
  if (!context.configured || !context.profile) {
    return { success: false, message: "Supabase is not configured." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("homework")
    .update({ status })
    .eq("id", id)
    .eq("teacher_id", context.profile.id);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePortal();
  return { success: true, message: "Homework status updated." };
}

export async function saveAttendanceAction(
  input: z.infer<typeof attendanceSchema>,
): Promise<ActionResult> {
  const parsed = attendanceSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Invalid attendance data." };
  }

  const context = await requireTeacherContext();
  if (!context.configured || !context.profile) {
    return { success: false, message: "Supabase is not configured." };
  }

  const supabase = createSupabaseServerClient();
  const teacherId = context.profile.id;
  const { error } = await supabase.from("attendance").upsert(
    parsed.data.entries.map((entry) => ({
      student_id: entry.student_id,
      present: entry.present,
      date: parsed.data.date,
      teacher_id: teacherId,
    })),
    { onConflict: "student_id,date" },
  );

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePortal();
  return { success: true, message: "Attendance saved successfully." };
}

export async function saveFeeAction(input: z.infer<typeof feeSchema>): Promise<ActionResult> {
  const parsed = feeSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Invalid fee data." };
  }

  const context = await requireTeacherContext();
  if (!context.configured || !context.profile) {
    return { success: false, message: "Supabase is not configured." };
  }

  const supabase = createSupabaseServerClient();
  const payload = {
    student_id: parsed.data.student_id,
    amount: parsed.data.amount,
    status: parsed.data.status,
    due_date: parsed.data.due_date,
    teacher_id: context.profile.id,
  };

  const { error } = parsed.data.id
    ? await supabase
        .from("fees")
        .update(payload)
        .eq("id", parsed.data.id)
        .eq("teacher_id", context.profile.id)
    : await supabase.from("fees").insert(payload);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePortal();
  return { success: true, message: parsed.data.id ? "Fee updated." : "Fee added successfully." };
}

export async function deleteFeeAction(id: string): Promise<ActionResult> {
  const context = await requireTeacherContext();
  if (!context.configured || !context.profile) {
    return { success: false, message: "Supabase is not configured." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("fees")
    .delete()
    .eq("id", id)
    .eq("teacher_id", context.profile.id);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePortal();
  return { success: true, message: "Fee deleted successfully." };
}

export async function saveTestAction(input: z.infer<typeof testSchema>): Promise<ActionResult> {
  const parsed = testSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Invalid test data." };
  }

  const context = await requireTeacherContext();
  if (!context.configured || !context.profile) {
    return { success: false, message: "Supabase is not configured." };
  }

  const supabase = createSupabaseServerClient();
  const payload = {
    student_id: parsed.data.student_id,
    subject: parsed.data.subject,
    marks: parsed.data.marks,
    total: parsed.data.total,
    date: parsed.data.date,
    teacher_id: context.profile.id,
  };

  const { error } = parsed.data.id
    ? await supabase
        .from("tests")
        .update(payload)
        .eq("id", parsed.data.id)
        .eq("teacher_id", context.profile.id)
    : await supabase.from("tests").insert(payload);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePortal();
  return { success: true, message: parsed.data.id ? "Test updated." : "Test added successfully." };
}

export async function deleteTestAction(id: string): Promise<ActionResult> {
  const context = await requireTeacherContext();
  if (!context.configured || !context.profile) {
    return { success: false, message: "Supabase is not configured." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("tests")
    .delete()
    .eq("id", id)
    .eq("teacher_id", context.profile.id);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePortal();
  return { success: true, message: "Test deleted successfully." };
}

export async function saveAnnouncementAction(
  input: z.infer<typeof announcementSchema>,
): Promise<ActionResult> {
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: "Invalid announcement data." };
  }

  const context = await requireTeacherContext();
  if (!context.configured || !context.profile) {
    return { success: false, message: "Supabase is not configured." };
  }

  const supabase = createSupabaseServerClient();
  const payload = {
    title: parsed.data.title,
    message: parsed.data.message,
    teacher_id: context.profile.id,
  };

  const { error } = parsed.data.id
    ? await supabase
        .from("announcements")
        .update(payload)
        .eq("id", parsed.data.id)
        .eq("teacher_id", context.profile.id)
    : await supabase.from("announcements").insert(payload);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePortal();
  return {
    success: true,
    message: parsed.data.id ? "Announcement updated." : "Announcement sent successfully.",
  };
}

export async function deleteAnnouncementAction(id: string): Promise<ActionResult> {
  const context = await requireTeacherContext();
  if (!context.configured || !context.profile) {
    return { success: false, message: "Supabase is not configured." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", id)
    .eq("teacher_id", context.profile.id);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePortal();
  return { success: true, message: "Announcement deleted successfully." };
}

export async function updateProfileAction(name: string, _role: AppRole): Promise<ActionResult> {
  void _role; // kept for call-site compatibility; roles are never client-settable.
  const context = await getAuthContext();
  if (!context.configured || !context.user || !context.user.email) {
    return { success: false, message: "Supabase is not configured." };
  }

  const trimmed = name.trim();
  if (!trimmed) {
    return { success: false, message: "Display name is required." };
  }

  // ponytail: role is deliberately NOT taken from the client — the old version
  // let any signed-in user escalate themselves to teacher via the role select.
  // Role changes go through assignUserRoleAction / updateMemberRoleAction only.
  const currentRole =
    context.profile?.role ?? (context.user.user_metadata?.role as AppRole | undefined) ?? "teacher";

const supabase = createSupabaseServerClient();

  // Update public profile
  const { error: profileError } = await supabase
    .from("users")
    .upsert({
      id: context.user.id,
      email: context.user.email.toLowerCase(),
      name: trimmed,
      role: currentRole,
    });

  if (profileError) {
    return { success: false, message: profileError.message };
  }

  revalidatePortal();
  return { success: true, message: "Profile updated successfully." };
}

const studentProfileSchema = z.object({
  name: z.string().trim().min(1, "Student name is required").max(120),
  class: z.string().trim().min(1, "Class is required").max(20),
  parent_name: z.string().trim().max(120).optional().or(z.literal("")),
  parent_phone: z.string().trim().max(30).optional().or(z.literal("")),
});

/**
 * Update the caller's OWN student profile (student role only).
 * The row is resolved server-side from the session — no client-supplied id —
 * so a student can never edit another student's record. Academic data
 * (class, emails) is teacher-managed and intentionally not editable here.
 */
export async function updateStudentProfileAction(
  input: z.infer<typeof studentProfileSchema>,
): Promise<ActionResult> {
  const parsed = studentProfileSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid profile data." };
  }

  const { getStudentContext } = await import("@/lib/student/auth");
  const context = await getStudentContext();
  if (!context.user || !context.student) {
    return { success: false, message: "No student profile linked to this account." };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("students")
    .update({
      name: parsed.data.name.trim(),
      class: parsed.data.class.trim(),
      parent_name: parsed.data.parent_name?.trim() || "",
      parent_phone: parsed.data.parent_phone?.trim() || "",
    })
    .eq("id", context.student.id);

  if (error) {
    return { success: false, message: error.message };
  }

  // Best-effort display-name sync; never fails the update.
  await admin.from("users").update({ name: parsed.data.name.trim() }).eq("id", context.user.id);

  revalidatePath("/student/profile");
  revalidatePath("/student/dashboard");
  return { success: true, message: "Profile updated successfully." };
}

const linkedChildClassSchema = z.object({
  studentId: z.string().uuid("A valid student is required."),
  class: z.string().trim().min(1, "Class is required.").max(20),
});

/**
 * Let a parent update a LINKED child's class. The caller must hold an active,
 * verified guardian relationship for that exact student — anything else is
 * rejected before touching the database.
 */
export async function updateLinkedChildClassAction(
  input: z.infer<typeof linkedChildClassSchema>,
): Promise<ActionResult> {
  const parsed = linkedChildClassSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Invalid class data." };
  }

  const context = await getAuthContext();
  if (!context.user) {
    return { success: false, message: "Please sign in." };
  }

  const admin = createSupabaseAdminClient();
  const { data: rel } = await admin
    .from("guardian_student_relationships")
    .select("id")
    .eq("guardian_user_id", context.user.id)
    .eq("student_id", parsed.data.studentId)
    .eq("status", "active")
    .not("verified_at", "is", null)
    .limit(1)
    .maybeSingle();

  if (!rel) {
    return { success: false, message: "Unauthorized. This child is not linked to your account." };
  }

  const { error } = await admin
    .from("students")
    .update({ class: parsed.data.class.trim() })
    .eq("id", parsed.data.studentId);

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePath("/parent/profile");
  revalidatePath("/parent/dashboard");
  return { success: true, message: "Class updated successfully." };
}

/**
 * Permanently delete the caller's own account (any role).
 * Removes memberships, guardian links and portal grants, then the public
 * profile row and the Auth user. Academic records teachers rely on
 * (students rows, submissions) are left intact — only the login is removed.
 */
export async function deleteAccountAction(): Promise<ActionResult> {
  const context = await getAuthContext();
  if (!context.user) {
    return { success: false, message: "Not signed in." };
  }
  const userId = context.user.id;

  try {
    const admin = createSupabaseAdminClient();
    await admin.from("workspace_members").delete().eq("user_id", userId);
    await admin.from("guardian_student_relationships").delete().eq("guardian_user_id", userId);
    await admin.from("portal_access_grants").delete().eq("user_id", userId);

    const { error: profileError } = await admin.from("users").delete().eq("id", userId);
    if (profileError) {
      return { success: false, message: profileError.message };
    }

    const { error: authError } = await admin.auth.admin.deleteUser(userId);
    if (authError) {
      return { success: false, message: authError.message };
    }
  } catch (err) {
    console.error("deleteAccountAction error:", err);
    return { success: false, message: (err as Error).message || "Failed to delete account." };
  }

  const supabase = createSupabaseServerClient();
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Session is already dead server-side; still redirect.
  }
  redirect("/login");
}

export async function assignUserRoleAction(email: string, role: AppRole): Promise<ActionResult> {
  const context = await requireTeacherContext();
  if (!context.configured || !context.profile) {
    return { success: false, message: "Supabase is not configured." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("assign_user_role", {
    target_email: email,
    new_role: role,
  });

  if (error) {
    return { success: false, message: error.message };
  }

  revalidatePortal();
  return { success: true, message: `Successfully assigned role as ${role}.` };
}

type ReportRow = {
  id: string;
  content: string;
  status: string;
};

export async function generateReportAction(input: {
  student_id: string;
  subject?: string;
  language?: "en" | "hi";
  tutor_notes?: string;
}): Promise<ActionResult & { report?: ReportRow }> {
  const context = await requireTeacherContext();
  if (!context.configured || !context.user) {
    return { success: false, message: "Unauthorized" };
  }

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/reports/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Pass cookies to the API route to maintain session
        Cookie: cookies().toString(),
      },
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, message: error.error || "Failed to generate report." };
    }

    const report = (await response.json()) as ReportRow;
    revalidatePortal();
    return { success: true, message: "Report generated successfully.", report };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

export async function sendReportAction(reportId: string, email?: string): Promise<ActionResult> {
  const context = await requireTeacherContext();
  if (!context.configured || !context.user) {
    return { success: false, message: "Unauthorized" };
  }

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || ''}/api/reports/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: cookies().toString(),
      },
      body: JSON.stringify({ report_id: reportId, email }),
    });

    if (!response.ok) {
      const error = await response.json();
      return { success: false, message: error.error || "Failed to send report." };
    }

    revalidatePortal();
    return { success: true, message: "Report sent successfully." };
  } catch (err) {
    return { success: false, message: (err as Error).message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// REMOVED — insecure invitation actions.
//
// Three actions were deleted here as part of the parent portal security work:
//
//   getStudentInviteDetails(studentId)
//     Used an admin (RLS-bypassing) client to look up a student by an
//     unauthenticated, caller-supplied id, confirming whether a UUID existed
//     and returning the student's name, class and teacher.
//
//   claimStudentInviteAction(studentId, asRole)
//     Trusted that caller-supplied id and wrote the caller's email straight
//     onto the student row to grant access — no token, expiry, revocation,
//     verification or audit trail. This was the primary parent-access
//     vulnerability.
//
//   updateStudentAccessAction(studentId, parentEmail, studentEmail)
//     Wrote students.parent_email directly, which the authorization predicate
//     then trusted. Removed because RLS no longer consults that column.
//
// They are replaced by:
//   /parent/invite/<token>       — single-use, expiring, revocable token
//   src/actions/parent-invites.ts — createParentInviteAction,
//                                   revokeParentInviteAction,
//                                   acceptParentInviteAction,
//                                   revokeGuardianAccessAction
//
// Verified by tests/parent-portal-security.mjs (45 assertions).
// ─────────────────────────────────────────────────────────────────────────────

