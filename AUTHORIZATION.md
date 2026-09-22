# AUTHORIZATION.md — TuitionTrack Authorization & Role-Based Access Control

## 1. Principles of Authorization

1. **Server-Side Enforcement**: Client-side states (such as cookies, localStorage, or query parameters) are NEVER trusted as authority. Every mutation and query resolves the authenticated session from Supabase Auth (`auth.uid()`) and validates workspace membership.
2. **Explicit Hierarchy**:
   - `owner`: Workspace creator. Full administrative authority, role management, code rotation, and destructive actions. Ownership cannot be reassigned or stripped via normal member UI.
   - `teacher` / `admin`: Educational administrator. Can assign homework, view all students, manage classes, and delete homework assignments.
   - `student`: Learner. Access strictly limited to assigned homework, tests, 3D lessons, and personal progress. Strictly prohibited from deleting homework, viewing other students' submissions, or changing roles.
   - `parent`: Guardian. Access strictly limited to linked children via `guardian_student_relationships`. Cannot modify homework, assign work, or manage workspace members.

---

## 2. Centralized Authorization API (`src/lib/workspace/auth.ts`)

```typescript
// Fetch authenticated user's workspace context (cached per request)
const ctx = await getWorkspaceContextForUser(user.id);

// Check if a user is an authorized teacher/owner of a specific workspace
const isTeacher = await verifyWorkspaceTeacher(workspaceId, user.id);

// Verify role before performing role update
await updateMemberRole({
  workspaceId,
  targetUserId,
  newRole,
  actorUserId,
});
```

---

## 3. Server Actions & Mutation Guards

### 3.1 Homework Deletion Guard (`src/actions/workspace-actions.ts`)
```typescript
export async function deleteAssignmentAction(assignmentId: string) {
  const auth = await getAuthContext();
  if (!auth.user) {
    return { success: false, message: "Unauthorized. Please sign in." };
  }

  // Fetch assignment & verify workspace ownership
  const { data: assignment } = await admin
    .from("assignments")
    .select("id, title, workspace_id, teacher_id")
    .eq("id", assignmentId)
    .maybeSingle();

  // Strict check: Must be the creator OR an authorized teacher in the workspace
  const isAuthorizedTeacher =
    assignment.teacher_id === auth.user.id ||
    (assignment.workspace_id &&
      (await verifyWorkspaceTeacher(assignment.workspace_id, auth.user.id)));

  if (!isAuthorizedTeacher) {
    return {
      success: false,
      message: "Unauthorized. Only authorized teachers can delete assigned homework.",
    };
  }

  // Soft delete with audit log
  await admin.from("assignments").update({ deleted_at: new Date().toISOString() }).eq("id", assignmentId);
  await logWorkspaceAudit({ ... });
}
```

### 3.2 Member Role Update Guard (`src/lib/workspace/auth.ts`)
- Actors must have role `owner`, `admin`, or `teacher`.
- Target users with role `owner` cannot have their role modified.
- Normal member role transition is restricted to `student` ↔ `parent` ↔ `teacher`.
- Any attempt to bypass via API payload fails both at the TypeScript layer and at the database `CHECK` constraint:
  `CHECK (role in ('owner', 'admin', 'teacher', 'student', 'parent'))`.

---

## 4. PostgreSQL Row Level Security (RLS) Policies

### 4.1 Workspaces Table
```sql
CREATE POLICY "Workspaces viewable by members or owners"
ON public.workspaces FOR SELECT TO authenticated
USING (
  owner_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.workspace_members wm
    WHERE wm.workspace_id = id AND wm.user_id = auth.uid() AND wm.status = 'active'
  )
);
```

### 4.2 Workspace Members Table
```sql
CREATE POLICY "Workspace members viewable by fellow members"
ON public.workspace_members FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_workspace_member(workspace_id)
);

CREATE POLICY "Workspace members manageable by teacher or owner"
ON public.workspace_members FOR UPDATE TO authenticated
USING (public.is_workspace_teacher(workspace_id))
WITH CHECK (public.is_workspace_teacher(workspace_id));
```

### 4.3 Homework & Assignments Table (Teacher Delete Only)
```sql
CREATE POLICY "Assignments teacher delete policy"
ON public.assignments FOR DELETE TO authenticated
USING (
  teacher_id = auth.uid()
  OR (workspace_id IS NOT NULL AND public.is_workspace_teacher(workspace_id))
);

CREATE POLICY "Homework teacher delete policy"
ON public.homework FOR DELETE TO authenticated
USING (
  teacher_id = auth.uid()
  OR (workspace_id IS NOT NULL AND public.is_workspace_teacher(workspace_id))
);
```
Students and parents running `DELETE FROM public.homework WHERE id = ...` are blocked by PostgreSQL RLS with 0 affected rows.
