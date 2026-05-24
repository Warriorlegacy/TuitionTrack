"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getAuthContext, requireTeacherContext } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeOptional } from "@/lib/utils";
import type { AppRole } from "@/lib/db/types";

type ActionResult = {
  success: boolean;
  message: string;
};

const studentSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(2),
  class: z.string().min(1),
  parent_name: z.string().min(2),
  parent_phone: z.string().min(6),
  parent_email: z.string().email().optional().or(z.literal("")),
  student_email: z.string().email().optional().or(z.literal("")),
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
  await supabase.auth.signOut();
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

  const supabase = createSupabaseServerClient();
  const payload = {
    name: parsed.data.name,
    class: parsed.data.class,
    parent_name: parsed.data.parent_name,
    parent_phone: parsed.data.parent_phone,
    parent_email: normalizeOptional(parsed.data.parent_email),
    student_email: normalizeOptional(parsed.data.student_email),
    teacher_id: context.profile.id,
  };

  const { error } = parsed.data.id
    ? await supabase
        .from("students")
        .update(payload)
        .eq("id", parsed.data.id)
        .eq("teacher_id", context.profile.id)
    : await supabase.from("students").insert(payload);

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

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
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
    return { success: false, message: "Supabase is not configured." };
  }

  const supabase = createSupabaseServerClient();
  const { error } = await supabase
    .from("homework")
    .delete()
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

export async function updateProfileAction(name: string, role: AppRole): Promise<ActionResult> {
  const context = await getAuthContext();
  if (!context.configured || !context.user || !context.user.email) {
    return { success: false, message: "Supabase is not configured." };
  }

const supabase = createSupabaseServerClient();
  
  // Update public profile
  const { error: profileError } = await supabase
    .from("users")
    .upsert({
      id: context.user.id,
      email: context.user.email.toLowerCase(),
      name: name.trim(),
      role: role,
    });

  if (profileError) {
    return { success: false, message: profileError.message };
  }

  // Sync role to Auth metadata as well
  const { error: authError } = await supabase.auth.updateUser({
    data: { role },
  });

  if (authError) {
    console.warn("Profile updated but Auth metadata sync failed:", authError.message);
  }

  revalidatePortal();
  return { success: true, message: "Profile updated successfully." };
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
