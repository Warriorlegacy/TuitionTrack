"use server";

import { revalidatePath } from "next/cache";
import { getAuthContext } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  getWorkspaceByCode,
  joinWorkspaceByCode,
  regenerateWorkspaceCode,
  updateMemberRole,
  verifyWorkspaceTeacher,
  logWorkspaceAudit,
  listWorkspaceMembers,
  getWorkspaceContextForUser,
} from "@/lib/workspace/auth";

/**
 * Validates a workspace code prior to signup or login
 */
export async function validateWorkspaceCodeAction(rawCode: string) {
  if (!rawCode || !rawCode.trim()) {
    return { valid: false, error: "Please enter a workspace code." };
  }

  try {
    const ws = await getWorkspaceByCode(rawCode);
    if (!ws) {
      return {
        valid: false,
        error: "Workspace not found. Please verify the code provided by your teacher.",
      };
    }

    if (ws.status !== "active") {
      return {
        valid: false,
        error: "This teacher workspace is currently unavailable.",
      };
    }

    return {
      valid: true,
      workspaceName: ws.name,
      workspaceCode: ws.code,
      workspaceId: ws.id,
    };
  } catch (err) {
    console.error("validateWorkspaceCodeAction error:", err);
    return { valid: false, error: "Failed to validate workspace code." };
  }
}

/**
 * Joins the authenticated user to a workspace
 */
export async function joinWorkspaceAction({
  code,
  role,
}: {
  code: string;
  role: "student" | "parent";
}) {
  const auth = await getAuthContext();
  if (!auth.user) {
    return { success: false, message: "Please sign in to join this workspace." };
  }

  try {
    const result = await joinWorkspaceByCode({
      code,
      userId: auth.user.id,
      role,
    });

    if (!result.success) {
      return result;
    }

    revalidatePath("/app/dashboard");
    revalidatePath("/student/dashboard");
    revalidatePath("/parent/dashboard");

    const destination = role === "student" ? "/student/dashboard" : "/parent/dashboard";
    return {
      success: true,
      message: result.message,
      alreadyMember: result.alreadyMember,
      redirectUrl: destination,
    };
  } catch (err) {
    console.error("joinWorkspaceAction error:", err);
    return { success: false, message: "An unexpected error occurred while joining workspace." };
  }
}

/**
 * Regenerate workspace code (Teacher only)
 */
export async function regenerateWorkspaceCodeAction(workspaceId: string) {
  const auth = await getAuthContext();
  if (!auth.user) {
    return { success: false, message: "Unauthorized. Please sign in." };
  }

  try {
    const result = await regenerateWorkspaceCode(workspaceId, auth.user.id);
    if (result.success) {
      revalidatePath("/app/workspace");
      revalidatePath("/app/settings");
    }
    return result;
  } catch (err) {
    console.error("regenerateWorkspaceCodeAction error:", err);
    return { success: false, message: "Failed to regenerate workspace code." };
  }
}

/**
 * Change a member's role (Teacher only)
 */
export async function updateMemberRoleAction({
  workspaceId,
  targetUserId,
  newRole,
}: {
  workspaceId: string;
  targetUserId: string;
  newRole: "student" | "parent" | "teacher";
}) {
  const auth = await getAuthContext();
  if (!auth.user) {
    return { success: false, message: "Unauthorized. Please sign in." };
  }

  try {
    const result = await updateMemberRole({
      workspaceId,
      actorId: auth.user.id,
      targetUserId,
      newRole,
    });

    if (result.success) {
      revalidatePath("/app/workspace/members");
      revalidatePath("/app/workspace");
    }

    return result;
  } catch (err) {
    console.error("updateMemberRoleAction error:", err);
    return { success: false, message: "Failed to update member role." };
  }
}

/**
 * List workspace members (Teacher only)
 */
export async function listWorkspaceMembersAction(workspaceId: string) {
  const auth = await getAuthContext();
  if (!auth.user) {
    return { success: false, members: [], message: "Unauthorized. Please sign in." };
  }

  return listWorkspaceMembers(workspaceId, auth.user.id);
}

/**
 * Fetch current user's active workspace
 */
export async function getActiveWorkspaceAction() {
  const auth = await getAuthContext();
  if (!auth.user) {
    return { success: false, message: "Not authenticated" };
  }

  const wsContext = await getWorkspaceContextForUser(auth.user.id);
  return {
    success: true,
    workspace: wsContext.workspace,
    role: wsContext.role,
    isTeacher: wsContext.isTeacher,
  };
}

/**
 * DELETE ASSIGNMENT — TEACHER ONLY
 * Strictly blocked from students and parents.
 */
export async function deleteAssignmentAction(assignmentId: string) {
  const auth = await getAuthContext();
  if (!auth.user) {
    return { success: false, message: "Unauthorized. Please sign in." };
  }

  const admin = createSupabaseAdminClient();

  // 1. Fetch assignment to inspect workspace and teacher
  const { data: assignment, error: fetchErr } = await admin
    .from("assignments")
    .select("id, title, workspace_id, teacher_id")
    .eq("id", assignmentId)
    .maybeSingle();

  if (fetchErr || !assignment) {
    return { success: false, message: "Assignment not found." };
  }

  const typedAssignment = assignment as {
    id: string;
    title: string;
    workspace_id: string | null;
    teacher_id: string;
  };

  // 2. Enforce Teacher / Owner verification
  const isAuthorizedTeacher =
    typedAssignment.teacher_id === auth.user.id ||
    (typedAssignment.workspace_id &&
      (await verifyWorkspaceTeacher(typedAssignment.workspace_id, auth.user.id)));

  if (!isAuthorizedTeacher) {
    return {
      success: false,
      message: "Unauthorized. Only authorized teachers can delete assigned homework.",
    };
  }

  // 3. Perform safe soft-deletion
  const now = new Date().toISOString();
  const { error: delErr } = await admin
    .from("assignments")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", assignmentId);

  if (delErr) {
    console.error("Error deleting assignment:", delErr);
    return { success: false, message: "Failed to delete homework assignment." };
  }

  // 4. Audit logging
  if (typedAssignment.workspace_id) {
    await logWorkspaceAudit({
      workspaceId: typedAssignment.workspace_id,
      actorId: auth.user.id,
      action: "HOMEWORK_DELETED",
      targetId: typedAssignment.id,
      metadata: { title: typedAssignment.title, type: "ai_assignment" },
    });
  }

  // 5. Revalidate cache
  revalidatePath("/app/homework");
  revalidatePath("/app/dashboard");
  revalidatePath("/student/homework");
  revalidatePath("/student/dashboard");
  revalidatePath("/parent/homework");
  revalidatePath("/parent/dashboard");

  return {
    success: true,
    message: `Assignment "${typedAssignment.title}" deleted successfully.`,
  };
}

/**
 * DELETE QUICK HOMEWORK — TEACHER ONLY
 */
export async function deleteHomeworkAction(
  homeworkId: string
): Promise<{ success: boolean; message: string }> {
  const auth = await getAuthContext();
  if (!auth.user) {
    return { success: false, message: "Unauthorized. Please sign in." };
  }

  const admin = createSupabaseAdminClient();

  const { data: item, error: fetchErr } = await admin
    .from("homework")
    .select("id, title, workspace_id, teacher_id")
    .eq("id", homeworkId)
    .maybeSingle();

  if (fetchErr || !item) {
    return { success: false, message: "Homework task not found." };
  }

  const typedItem = item as {
    id: string;
    title: string;
    workspace_id: string | null;
    teacher_id: string;
  };

  const isAuthorizedTeacher =
    typedItem.teacher_id === auth.user.id ||
    (typedItem.workspace_id &&
      (await verifyWorkspaceTeacher(typedItem.workspace_id, auth.user.id)));

  if (!isAuthorizedTeacher) {
    return {
      success: false,
      message: "Unauthorized. Only authorized teachers can delete homework.",
    };
  }

  const now = new Date().toISOString();
  const { error: delErr } = await admin
    .from("homework")
    .update({ deleted_at: now, updated_at: now })
    .eq("id", homeworkId);

  if (delErr) {
    console.error("Error deleting homework task:", delErr);
    return { success: false, message: "Failed to delete homework." };
  }

  if (typedItem.workspace_id) {
    await logWorkspaceAudit({
      workspaceId: typedItem.workspace_id,
      actorId: auth.user.id,
      action: "HOMEWORK_DELETED",
      targetId: typedItem.id,
      metadata: { title: typedItem.title, type: "quick_homework" },
    });
  }

  revalidatePath("/app/homework");
  revalidatePath("/app/dashboard");
  revalidatePath("/student/homework");
  revalidatePath("/student/dashboard");
  revalidatePath("/parent/homework");
  revalidatePath("/parent/dashboard");

  return {
    success: true,
    message: `Homework "${typedItem.title}" deleted successfully.`,
  };
}

/**
 * UNIVERSAL CODE LINKING ACTIONS (Teacher, Student, Parent)
 */

export async function getUserUniqueCodeAction(): Promise<{
  success: boolean;
  code: string | null;
  role: string | null;
  error?: string;
}> {
  const auth = await getAuthContext();
  if (!auth.user) {
    return { success: false, code: null, role: null, error: "Not authenticated" };
  }

  const admin = createSupabaseAdminClient();
  const userId = auth.user.id;

  // 1. If teacher, workspace code TT-XXXXXX is the primary shareable code
  if (auth.role === "teacher") {
    const wsCtx = await getWorkspaceContextForUser(userId);
    if (wsCtx.workspace?.code) {
      return { success: true, code: wsCtx.workspace.code, role: "teacher" };
    }
  }

  // 2. Check public.users.link_code
  const { data: userRow } = await admin
    .from("users")
    .select("link_code, role, name, email")
    .eq("id", userId)
    .maybeSingle();

  if (userRow?.link_code) {
    return {
      success: true,
      code: userRow.link_code,
      role: userRow.role,
    };
  }

  // 3. Check students table if student
  if (auth.role === "student" && auth.user.email) {
    const { data: std } = await admin
      .from("students")
      .select("link_code")
      .ilike("student_email", auth.user.email)
      .not("link_code", "is", null)
      .limit(1)
      .maybeSingle();
    if (std?.link_code) {
      await admin.from("users").update({ link_code: std.link_code }).eq("id", userId);
      return { success: true, code: std.link_code, role: "student" };
    }
  }

  // 4. Check workspace_members
  const { data: mem } = await admin
    .from("workspace_members")
    .select("link_code, role")
    .eq("user_id", userId)
    .not("link_code", "is", null)
    .limit(1)
    .maybeSingle();
  if (mem?.link_code) {
    await admin.from("users").update({ link_code: mem.link_code }).eq("id", userId);
    return { success: true, code: mem.link_code, role: mem.role };
  }

  // 5. Fallback: generate and persist link_code
  const prefix = auth.role === "parent" ? "PAR-" : auth.role === "teacher" ? "TCH-" : "STU-";
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let generated = prefix;
  for (let i = 0; i < 6; i++) {
    generated += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  await admin.from("users").update({ link_code: generated }).eq("id", userId);
  return { success: true, code: generated, role: auth.role };
}

/**
 * Link Student by Unique Code (STU-XXXXXX)
 * Can be called by:
 * - Parent: links student as their child
 * - Teacher: adds student into their active classroom workspace
 */
export async function linkStudentByCodeAction(rawCode: string): Promise<{
  success: boolean;
  message: string;
  student?: { id: string; name: string; class: string };
}> {
  const auth = await getAuthContext();
  if (!auth.user) {
    return { success: false, message: "Please sign in to continue." };
  }

  const cleanCode = rawCode.trim().toUpperCase();
  if (!cleanCode) {
    return { success: false, message: "Please enter a valid student code." };
  }

  const admin = createSupabaseAdminClient();

  // 1. Find student by link_code in students table
  let studentRecord: { id: string; name: string; class: string; workspace_id: string | null; student_email: string | null } | null = null;

  const { data: stdByCode } = await admin
    .from("students")
    .select("id, name, class, workspace_id, student_email")
    .ilike("link_code", cleanCode)
    .limit(1)
    .maybeSingle();

  if (stdByCode) {
    studentRecord = stdByCode;
  } else {
    // Check if user has this link_code in users or workspace_members
    const { data: userByCode } = await admin
      .from("users")
      .select("id, name, email, role")
      .ilike("link_code", cleanCode)
      .maybeSingle();

    if (userByCode) {
      // Find or create student row for this student user
      const { data: existingStd } = await admin
        .from("students")
        .select("id, name, class, workspace_id, student_email")
        .ilike("student_email", userByCode.email)
        .limit(1)
        .maybeSingle();

      if (existingStd) {
        studentRecord = existingStd;
      } else {
        const wsCtx = await getWorkspaceContextForUser(auth.user.id);
        const fallbackTeacherId = wsCtx.workspace?.owner_id || auth.user.id;

        // Provision student row
        const { data: newStd } = await admin
          .from("students")
          .insert({
            name: userByCode.name || "Student",
            class: "9",
            student_email: userByCode.email,
            link_code: cleanCode,
            parent_name: "Parent",
            parent_phone: "",
            teacher_id: fallbackTeacherId,
          })
          .select("id, name, class, workspace_id, student_email")
          .single();
        if (newStd) {
          studentRecord = newStd;
        }
      }
    }
  }

  if (!studentRecord) {
    return {
      success: false,
      message: "No student found with this code. Please check the code and try again.",
    };
  }

  // 2. If caller is TEACHER: Add student to teacher's workspace
  if (auth.role === "teacher") {
    const wsCtx = await getWorkspaceContextForUser(auth.user.id);
    if (!wsCtx.workspace) {
      return { success: false, message: "No active teacher workspace found." };
    }

    const wsId = wsCtx.workspace.id;

    // Link student record to teacher and workspace
    await admin
      .from("students")
      .update({ workspace_id: wsId, teacher_id: auth.user.id })
      .eq("id", studentRecord.id);

    // If student has a user account, add them to workspace_members
    if (studentRecord.student_email) {
      const { data: stuUser } = await admin
        .from("users")
        .select("id")
        .ilike("email", studentRecord.student_email)
        .maybeSingle();

      if (stuUser) {
        await admin.from("workspace_members").upsert(
          {
            workspace_id: wsId,
            user_id: stuUser.id,
            role: "student",
            status: "active",
            link_code: cleanCode,
          },
          { onConflict: "workspace_id,user_id" }
        );
      }
    }

    revalidatePath("/app/students");
    revalidatePath("/app/workspace/members");
    revalidatePath("/app/dashboard");

    return {
      success: true,
      message: `Student "${studentRecord.name}" successfully added to your classroom workspace!`,
      student: studentRecord,
    };
  }

  // 3. If caller is PARENT:
  // Link student to this parent
  const now = new Date().toISOString();
  const { error: relErr } = await admin
    .from("guardian_student_relationships")
    .upsert(
      {
        guardian_user_id: auth.user.id,
        student_id: studentRecord.id,
        relationship_type: "guardian",
        status: "active",
        verified_at: now,
        verified_by: auth.user.id,
        verification_method: "student_code",
        created_via: "unique_code",
        workspace_id: studentRecord.workspace_id,
      },
      { onConflict: "guardian_user_id,student_id" }
    );

  if (relErr) {
    console.error("Error linking child by code:", relErr);
    return { success: false, message: "Failed to link child. Please try again." };
  }

  // Also ensure parent is enrolled in student's workspace if student is in one
  if (studentRecord.workspace_id) {
    await admin.from("workspace_members").upsert(
      {
        workspace_id: studentRecord.workspace_id,
        user_id: auth.user.id,
        role: "parent",
        status: "active",
      },
      { onConflict: "workspace_id,user_id" }
    );
  }

  revalidatePath("/parent");
  revalidatePath("/parent/dashboard");
  revalidatePath("/parent/profile");
  revalidatePath("/student/dashboard");

  return {
    success: true,
    message: `Child "${studentRecord.name}" (Class ${studentRecord.class}) successfully linked to your account!`,
    student: studentRecord,
  };
}

/**
 * Link Parent by Unique Code (PAR-XXXXXX)
 * Can be called by:
 * - Student: links parent to themselves
 * - Teacher: adds parent into their classroom workspace
 */
export async function linkParentByCodeAction(rawCode: string): Promise<{
  success: boolean;
  message: string;
  parent?: { id: string; name: string | null; email: string };
}> {
  const auth = await getAuthContext();
  if (!auth.user) {
    return { success: false, message: "Please sign in to continue." };
  }

  const cleanCode = rawCode.trim().toUpperCase();
  if (!cleanCode) {
    return { success: false, message: "Please enter a valid parent code." };
  }

  const admin = createSupabaseAdminClient();

  // Find parent by link_code in users or workspace_members
  let parentUser: { id: string; name: string | null; email: string } | null = null;

  const { data: userRow } = await admin
    .from("users")
    .select("id, name, email, role")
    .ilike("link_code", cleanCode)
    .maybeSingle();

  if (userRow) {
    parentUser = userRow;
  } else {
    const { data: memRow } = await admin
      .from("workspace_members")
      .select("user_id, user:users(id, name, email)")
      .ilike("link_code", cleanCode)
      .maybeSingle();

    if (memRow && memRow.user) {
      parentUser = memRow.user as unknown as { id: string; name: string | null; email: string };
    }
  }

  if (!parentUser) {
    return {
      success: false,
      message: "No parent found with this verification code. Please check the code.",
    };
  }

  // 1. If caller is TEACHER: Add parent to workspace
  if (auth.role === "teacher") {
    const wsCtx = await getWorkspaceContextForUser(auth.user.id);
    if (!wsCtx.workspace) {
      return { success: false, message: "No active teacher workspace found." };
    }

    await admin.from("workspace_members").upsert(
      {
        workspace_id: wsCtx.workspace.id,
        user_id: parentUser.id,
        role: "parent",
        status: "active",
        link_code: cleanCode,
      },
      { onConflict: "workspace_id,user_id" }
    );

    revalidatePath("/app/workspace/members");
    revalidatePath("/app/students");
    return {
      success: true,
      message: `Parent "${parentUser.name || parentUser.email}" added to your workspace!`,
      parent: parentUser,
    };
  }

  // 2. If caller is STUDENT: Link this parent to caller's student record
  let studentId: string | null = null;
  let studentWsId: string | null = null;

  if (auth.user.email) {
    const { data: std } = await admin
      .from("students")
      .select("id, workspace_id")
      .ilike("student_email", auth.user.email)
      .limit(1)
      .maybeSingle();
    if (std) {
      studentId = std.id;
      studentWsId = std.workspace_id;
    }
  }

  if (!studentId) {
    const wsCtx = await getWorkspaceContextForUser(auth.user.id);
    const fallbackTeacherId = wsCtx.workspace?.owner_id || auth.user.id;

    const { data: newStd } = await admin
      .from("students")
      .insert({
        name: auth.profile?.name || auth.user.user_metadata?.name || "Student",
        class: "9",
        student_email: auth.user.email,
        parent_name: parentUser.name || "Parent",
        parent_email: parentUser.email,
        parent_phone: "",
        teacher_id: fallbackTeacherId,
      })
      .select("id, workspace_id")
      .single();
    if (newStd) {
      studentId = newStd.id;
      studentWsId = newStd.workspace_id;
    }
  }

  if (!studentId) {
    return { success: false, message: "Could not resolve your student profile." };
  }

  const now = new Date().toISOString();
  const { error: relErr } = await admin
    .from("guardian_student_relationships")
    .upsert(
      {
        guardian_user_id: parentUser.id,
        student_id: studentId,
        relationship_type: "guardian",
        status: "active",
        verified_at: now,
        verified_by: auth.user.id,
        verification_method: "parent_code",
        created_via: "unique_code",
        workspace_id: studentWsId,
      },
      { onConflict: "guardian_user_id,student_id" }
    );

  if (relErr) {
    console.error("Error linking parent by code:", relErr);
    return { success: false, message: "Failed to link parent. Please try again." };
  }

  // Also enroll parent in student's workspace if student is in one
  if (studentWsId) {
    await admin.from("workspace_members").upsert(
      {
        workspace_id: studentWsId,
        user_id: parentUser.id,
        role: "parent",
        status: "active",
      },
      { onConflict: "workspace_id,user_id" }
    );
  }

  revalidatePath("/student/dashboard");
  revalidatePath("/student/profile");
  revalidatePath("/parent");
  revalidatePath("/parent/dashboard");

  return {
    success: true,
    message: `Parent "${parentUser.name || parentUser.email}" successfully linked with your account!`,
    parent: parentUser,
  };
}

/**
 * Universal Add Member by Code (Teacher Action)
 * Accepts either STU-XXXXXX or PAR-XXXXXX
 */
export async function teacherAddMemberByCodeAction(rawCode: string): Promise<{
  success: boolean;
  message: string;
}> {
  const code = rawCode.trim().toUpperCase();
  if (!code) {
    return { success: false, message: "Please enter a student or parent code." };
  }

  if (code.startsWith("PAR-")) {
    return linkParentByCodeAction(code);
  } else if (code.startsWith("STU-")) {
    return linkStudentByCodeAction(code);
  }

  // If prefix is omitted or unknown, try student first then parent
  const stdRes = await linkStudentByCodeAction(code);
  if (stdRes.success) return stdRes;

  const parRes = await linkParentByCodeAction(code);
  if (parRes.success) return parRes;

  return {
    success: false,
    message: `No student or parent found matching code "${code}". Please verify the code.`,
  };
}

/**
 * Teacher Links Parent and Student within Workspace
 */
export async function teacherLinkParentStudentAction({
  studentId,
  parentUserId,
}: {
  studentId: string;
  parentUserId: string;
}): Promise<{ success: boolean; message: string }> {
  const auth = await getAuthContext();
  if (!auth.user) {
    return { success: false, message: "Unauthorized. Please sign in." };
  }

  const admin = createSupabaseAdminClient();
  const wsCtx = await getWorkspaceContextForUser(auth.user.id);
  if (!wsCtx.isTeacher || !wsCtx.workspace) {
    return { success: false, message: "Unauthorized. Only teachers can link students and parents." };
  }

  const now = new Date().toISOString();
  const { error } = await admin
    .from("guardian_student_relationships")
    .upsert(
      {
        workspace_id: wsCtx.workspace.id,
        guardian_user_id: parentUserId,
        student_id: studentId,
        relationship_type: "guardian",
        status: "active",
        verified_at: now,
        verified_by: auth.user.id,
        verification_method: "teacher_manual",
        created_via: "teacher_workspace",
      },
      { onConflict: "guardian_user_id,student_id" }
    );

  if (error) {
    console.error("Error linking parent and student:", error);
    return { success: false, message: "Failed to link parent and student." };
  }

  revalidatePath("/app/workspace/members");
  revalidatePath("/app/students");
  revalidatePath("/parent");
  revalidatePath("/parent/dashboard");
  revalidatePath("/student/dashboard");

  return { success: true, message: "Parent and student linked successfully." };
}

/**
 * Unlink Parent and Student Relationship
 */
export async function unlinkParentStudentAction(relationshipId: string): Promise<{
  success: boolean;
  message: string;
}> {
  const auth = await getAuthContext();
  if (!auth.user) {
    return { success: false, message: "Unauthorized. Please sign in." };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("guardian_student_relationships")
    .delete()
    .eq("id", relationshipId);

  if (error) {
    return { success: false, message: "Failed to unlink relationship." };
  }

  revalidatePath("/parent");
  revalidatePath("/parent/dashboard");
  revalidatePath("/student/dashboard");
  revalidatePath("/app/workspace/members");
  revalidatePath("/app/students");

  return { success: true, message: "Relationship unlinked successfully." };
}

/**
 * Get Parents Linked to Current Student
 */
export async function getStudentLinkedParentsAction(): Promise<{
  success: boolean;
  parents: Array<{
    relationshipId: string;
    relationshipType: string;
    verifiedAt: string | null;
    parent: { id: string; name: string | null; email: string; link_code: string | null };
  }>;
}> {
  const auth = await getAuthContext();
  if (!auth.user) return { success: false, parents: [] };

  const admin = createSupabaseAdminClient();

  let studentId: string | null = null;
  if (auth.user.email) {
    const { data: std } = await admin
      .from("students")
      .select("id")
      .ilike("student_email", auth.user.email)
      .limit(1)
      .maybeSingle();
    studentId = std?.id || null;
  }

  if (!studentId) return { success: true, parents: [] };

  const { data: rels } = await admin
    .from("guardian_student_relationships")
    .select("id, relationship_type, status, verified_at, parent:users!guardian_user_id(id, name, email, link_code)")
    .eq("student_id", studentId)
    .eq("status", "active");

  return {
    success: true,
    parents: (rels || []).map((r) => {
      const rel = r as unknown as {
        id: string | number;
        relationship_type: string;
        verified_at: string | null;
        parent: { id: string; name: string | null; email: string; link_code: string | null };
      };
      return {
        relationshipId: String(rel.id),
        relationshipType: String(rel.relationship_type),
        verifiedAt: rel.verified_at ?? null,
        parent: rel.parent,
      };
    }),
  };
}
