import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type WorkspaceRole = "owner" | "admin" | "teacher" | "student" | "parent";

export type Workspace = {
  id: string;
  name: string;
  code: string;
  owner_id: string;
  status: "active" | "archived" | "suspended";
  settings?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type WorkspaceMember = {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  status: "active" | "invited" | "suspended";
  link_code?: string | null;
  joined_at: string;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    name: string | null;
    email: string;
    link_code?: string | null;
  };
};

export type WorkspaceContext = {
  workspace: Workspace | null;
  membership: WorkspaceMember | null;
  role: WorkspaceRole | null;
  isTeacher: boolean;
  isStudent: boolean;
  isParent: boolean;
};

/**
 * Generate a friendly, unambiguous workspace code (e.g. TT-7K4X9P)
 */
export function generateWorkspaceCode(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "TT-";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Normalize workspace code entered by user
 */
export function normalizeWorkspaceCode(code: string): string {
  let clean = code.trim().toUpperCase();
  if (!clean.startsWith("TT-") && !clean.startsWith("TCH-") && clean.length === 6) {
    clean = `TT-${clean}`;
  }
  return clean;
}

/**
 * Fetch or auto-provision workspace context for a user
 */
export async function getWorkspaceContextForUser(userId: string): Promise<WorkspaceContext> {
  const admin = createSupabaseAdminClient();

  // 1. Check if user is a member of any workspace
  const { data: members, error: memErr } = await admin
    .from("workspace_members")
    .select("*, workspace:workspaces(*)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  if (!memErr && members && members.length > 0) {
    // Prefer teacher/owner workspace if user has multiple
    const primaryMember =
      members.find((m) => m.role === "owner" || m.role === "teacher" || m.role === "admin") ||
      members[0];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ws = (primaryMember as any).workspace as Workspace | null;
    const role = primaryMember.role as WorkspaceRole;

    return {
      workspace: ws,
      membership: primaryMember as unknown as WorkspaceMember,
      role,
      isTeacher: role === "teacher" || role === "owner" || role === "admin",
      isStudent: role === "student",
      isParent: role === "parent",
    };
  }

  // 2. Check if user owns a workspace directly
  const { data: ownedWs } = await admin
    .from("workspaces")
    .select("*")
    .eq("owner_id", userId)
    .eq("status", "active")
    .maybeSingle<Workspace>();

  if (ownedWs) {
    // Ensure membership record exists
    const { data: newMem } = await admin
      .from("workspace_members")
      .upsert(
        {
          workspace_id: ownedWs.id,
          user_id: userId,
          role: "teacher",
          status: "active",
        },
        { onConflict: "workspace_id,user_id" }
      )
      .select("*")
      .single<WorkspaceMember>();

    return {
      workspace: ownedWs,
      membership: newMem ?? null,
      role: "teacher",
      isTeacher: true,
      isStudent: false,
      isParent: false,
    };
  }

  // 3. If user is a teacher in users table, auto-provision workspace
  const { data: userProfile } = await admin
    .from("users")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (userProfile && userProfile.role === "teacher") {
    let wsCode = generateWorkspaceCode();
    // Guarantee uniqueness
    for (let attempts = 0; attempts < 5; attempts++) {
      const { data: existing } = await admin
        .from("workspaces")
        .select("id")
        .eq("code", wsCode)
        .maybeSingle();
      if (!existing) break;
      wsCode = generateWorkspaceCode();
    }

    const wsName = `${userProfile.name?.trim() || "Teacher"}'s Classroom`;
    const { data: createdWs, error: createErr } = await admin
      .from("workspaces")
      .insert({
        name: wsName,
        code: wsCode,
        owner_id: userId,
        status: "active",
      })
      .select("*")
      .single<Workspace>();

    if (createdWs && !createErr) {
      const { data: newMem } = await admin
        .from("workspace_members")
        .insert({
          workspace_id: createdWs.id,
          user_id: userId,
          role: "teacher",
          status: "active",
        })
        .select("*")
        .single<WorkspaceMember>();

      // Link any existing students of this teacher to this workspace
      await admin
        .from("students")
        .update({ workspace_id: createdWs.id })
        .eq("teacher_id", userId);

      // Link any existing assignments of this teacher to this workspace
      await admin
        .from("assignments")
        .update({ workspace_id: createdWs.id })
        .eq("teacher_id", userId);

      return {
        workspace: createdWs,
        membership: newMem ?? null,
        role: "teacher",
        isTeacher: true,
        isStudent: false,
        isParent: false,
      };
    }
  }

  return {
    workspace: null,
    membership: null,
    role: null,
    isTeacher: false,
    isStudent: false,
    isParent: false,
  };
}

/**
 * Get active workspace by code (case-insensitive)
 */
export async function getWorkspaceByCode(rawCode: string): Promise<Workspace | null> {
  const admin = createSupabaseAdminClient();
  const normalized = normalizeWorkspaceCode(rawCode);

  const { data, error } = await admin
    .from("workspaces")
    .select("*")
    .ilike("code", normalized)
    .eq("status", "active")
    .maybeSingle<Workspace>();

  if (error || !data) {
    return null;
  }

  return data;
}

/**
 * Join a workspace by code
 */
export async function joinWorkspaceByCode({
  code,
  userId,
  role,
}: {
  code: string;
  userId: string;
  role: "student" | "parent";
}): Promise<{
  success: boolean;
  message: string;
  workspace?: Workspace;
  membership?: WorkspaceMember;
  alreadyMember?: boolean;
}> {
  const admin = createSupabaseAdminClient();
  const ws = await getWorkspaceByCode(code);

  if (!ws) {
    return {
      success: false,
      message: "Workspace not found. Please verify the code provided by your teacher.",
    };
  }

  if (ws.status !== "active") {
    return {
      success: false,
      message: "This teacher workspace is currently unavailable.",
    };
  }

  // Check if already a member
  const { data: existingMem } = await admin
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", ws.id)
    .eq("user_id", userId)
    .maybeSingle<WorkspaceMember>();

  if (existingMem) {
    return {
      success: true,
      message: "You're already a member of this workspace.",
      workspace: ws,
      membership: existingMem,
      alreadyMember: true,
    };
  }

  // Insert membership
  const { data: newMem, error: insertErr } = await admin
    .from("workspace_members")
    .insert({
      workspace_id: ws.id,
      user_id: userId,
      role,
      status: "active",
    })
    .select("*")
    .single<WorkspaceMember>();

  if (insertErr || !newMem) {
    console.error("Error joining workspace:", insertErr);
    return {
      success: false,
      message: "Failed to join workspace. Please try again.",
    };
  }

  // Update user profile role in users table if needed
  await admin
    .from("users")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", userId);

  // If student, link student record by email match
  const { data: userRecord } = await admin
    .from("users")
    .select("email, name")
    .eq("id", userId)
    .maybeSingle();

  if (userRecord?.email) {
    if (role === "student") {
      await admin
        .from("students")
        .update({ workspace_id: ws.id })
        .eq("workspace_id", ws.id)
        .ilike("student_email", userRecord.email);
    } else if (role === "parent") {
      // If parent, check for children with matching parent email in this workspace
      const { data: matchedStudents } = await admin
        .from("students")
        .select("id")
        .eq("workspace_id", ws.id)
        .ilike("parent_email", userRecord.email);

      if (matchedStudents && matchedStudents.length > 0) {
        for (const s of matchedStudents) {
          await admin.from("guardian_student_relationships").upsert(
            {
              workspace_id: ws.id,
              guardian_user_id: userId,
              student_id: s.id,
              relationship_type: "guardian",
              status: "active",
              created_via: "workspace_code",
            },
            { onConflict: "id" }
          );
        }
      }
    }
  }

  // Log audit
  await logWorkspaceAudit({
    workspaceId: ws.id,
    actorId: userId,
    action: "MEMBER_JOINED",
    targetId: userId,
    metadata: { role, code: ws.code },
  });

  return {
    success: true,
    message: `Successfully joined ${ws.name}!`,
    workspace: ws,
    membership: newMem,
  };
}

/**
 * Regenerate a workspace code (Teacher only)
 */
export async function regenerateWorkspaceCode(
  workspaceId: string,
  actorId: string
): Promise<{ success: boolean; newCode?: string; message: string }> {
  const admin = createSupabaseAdminClient();

  // Verify actor is teacher/owner
  const isTeacher = await verifyWorkspaceTeacher(workspaceId, actorId);
  if (!isTeacher) {
    return { success: false, message: "Unauthorized. Only teachers can regenerate workspace codes." };
  }

  let newCode = generateWorkspaceCode();
  for (let attempts = 0; attempts < 5; attempts++) {
    const { data: existing } = await admin
      .from("workspaces")
      .select("id")
      .eq("code", newCode)
      .maybeSingle();
    if (!existing) break;
    newCode = generateWorkspaceCode();
  }

  const { error } = await admin
    .from("workspaces")
    .update({
      code: newCode,
      updated_at: new Date().toISOString(),
    })
    .eq("id", workspaceId);

  if (error) {
    return { success: false, message: "Failed to rotate workspace code." };
  }

  await logWorkspaceAudit({
    workspaceId,
    actorId,
    action: "WORKSPACE_CODE_REGENERATED",
    targetId: workspaceId,
    metadata: { newCode },
  });

  return {
    success: true,
    newCode,
    message: "Workspace code regenerated successfully.",
  };
}

/**
 * Update member role in workspace (Teacher only)
 */
export async function updateMemberRole({
  workspaceId,
  actorId,
  targetUserId,
  newRole,
}: {
  workspaceId: string;
  actorId: string;
  targetUserId: string;
  newRole: "student" | "parent" | "teacher";
}): Promise<{ success: boolean; message: string }> {
  const admin = createSupabaseAdminClient();

  // 1. Verify actor is teacher/owner
  const isTeacher = await verifyWorkspaceTeacher(workspaceId, actorId);
  if (!isTeacher) {
    return { success: false, message: "Unauthorized. Only teachers can change member roles." };
  }

  // 2. Prevent unauthorized role escalations
  if (newRole !== "student" && newRole !== "parent" && newRole !== "teacher") {
    return { success: false, message: "Invalid target role." };
  }

  // 3. Update workspace_members
  const { error: memErr } = await admin
    .from("workspace_members")
    .update({
      role: newRole,
      updated_at: new Date().toISOString(),
    })
    .eq("workspace_id", workspaceId)
    .eq("user_id", targetUserId);

  if (memErr) {
    console.error("Error updating member role:", memErr);
    return { success: false, message: "Failed to update member role." };
  }

  // 4. Update user's role in public.users
  await admin
    .from("users")
    .update({
      role: newRole,
      updated_at: new Date().toISOString(),
    })
    .eq("id", targetUserId);

  // 5. Audit log
  await logWorkspaceAudit({
    workspaceId,
    actorId,
    action: "ROLE_CHANGED",
    targetId: targetUserId,
    metadata: { newRole },
  });

  return { success: true, message: `Role updated to ${newRole}.` };
}

/**
 * Check if a user is an authorized teacher/owner of the workspace
 */
export async function verifyWorkspaceTeacher(
  workspaceId: string,
  userId: string
): Promise<boolean> {
  const admin = createSupabaseAdminClient();

  const { data: ws } = await admin
    .from("workspaces")
    .select("owner_id")
    .eq("id", workspaceId)
    .maybeSingle();

  if (ws && ws.owner_id === userId) {
    return true;
  }

  const { data: member } = await admin
    .from("workspace_members")
    .select("role, status")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  return Boolean(
    member &&
      (member.role === "owner" || member.role === "admin" || member.role === "teacher")
  );
}

/**
 * Log audit events
 */
export async function logWorkspaceAudit({
  workspaceId,
  actorId,
  action,
  targetId,
  metadata = {},
}: {
  workspaceId: string;
  actorId: string | null;
  action: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const admin = createSupabaseAdminClient();
    await admin.from("workspace_audit_logs").insert({
      workspace_id: workspaceId,
      actor_id: actorId,
      action,
      target_id: targetId ?? null,
      metadata,
    });
  } catch (err) {
    console.error("[audit] Failed to write audit log:", err);
  }
}

/**
 * List members of a workspace (Teacher only)
 */
export async function listWorkspaceMembers(
  workspaceId: string,
  actorId: string
): Promise<{ success: boolean; members: WorkspaceMember[]; message?: string }> {
  const isTeacher = await verifyWorkspaceTeacher(workspaceId, actorId);
  if (!isTeacher) {
    return { success: false, members: [], message: "Unauthorized." };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("workspace_members")
    .select(`
      id,
      workspace_id,
      user_id,
      role,
      status,
      link_code,
      joined_at,
      created_at,
      updated_at,
      user:users(id, name, email, link_code)
    `)
    .eq("workspace_id", workspaceId)
    .order("joined_at", { ascending: false });

  if (error || !data) {
    return { success: false, members: [], message: error?.message || "Failed to load members." };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { success: true, members: data as any[] };
}
