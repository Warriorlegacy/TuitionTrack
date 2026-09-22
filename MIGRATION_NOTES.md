# MIGRATION_NOTES.md — Production Migration & Data Preservation

## 1. Migration Overview

- **Migration File**: `supabase/migrations/20260922020000_multi_tenant_workspace_core.sql`
- **Applied Status**: Successfully executed against Supabase PostgreSQL.
- **Safety Strategy**: Zero data loss, zero destructive column drops, non-blocking backward-compatible additions.

---

## 2. Backward-Compatible Changes

### 2.1 Table Additions
- `public.workspaces`: Dedicated workspace table with unique join codes.
- `public.workspace_members`: Normalized memberships connecting users to workspaces.
- `public.workspace_audit_logs`: Audit trail for compliance and administrative history.

### 2.2 Additive Foreign Keys with Nullable Defaults
Existing tables received a nullable `workspace_id uuid references public.workspaces(id)`:
- `public.homework.workspace_id`
- `public.homework.deleted_at`
- `public.assignments.workspace_id`
- `public.assignments.deleted_at`
- `public.students.workspace_id`
- `public.students.deleted_at`
- `public.guardian_student_relationships.workspace_id`

Existing applications reading or writing these tables without `workspace_id` continue functioning normally.

---

## 3. Data Backfill Execution

During the execution of migration `20260922020000_multi_tenant_workspace_core.sql`:

1. **Teachers -> Workspaces**:
   Every user in `public.users` with `role = 'teacher'` had a workspace created automatically:
   - Example: Teacher Piyush (`f5dfba3f-d31c-4b9a-b44c-3baec49a5b6d`) was provisioned workspace "Piyush's Classroom" with code `TT-6YEAEF`.
   - Workspace member record created with `role = 'owner'`, `status = 'active'`.

2. **Students -> Workspace Scoping**:
   All 10 existing students in `public.students` were mapped to their teacher's newly provisioned workspace:
   ```sql
   UPDATE public.students s
   SET workspace_id = w.id
   FROM public.workspaces w
   WHERE s.teacher_id = w.owner_id AND s.workspace_id IS NULL;
   ```
   **Result**: 10/10 students backfilled.

3. **Assignments -> Workspace Scoping**:
   All 8 existing assignments in `public.assignments` were mapped to their teacher's workspace:
   ```sql
   UPDATE public.assignments a
   SET workspace_id = w.id
   FROM public.workspaces w
   WHERE a.teacher_id = w.owner_id AND a.workspace_id IS NULL;
   ```
   **Result**: 8/8 assignments backfilled.

4. **Homework -> Workspace Scoping**:
   All existing quick homework tasks in `public.homework` were mapped to their teacher's workspace:
   ```sql
   UPDATE public.homework h
   SET workspace_id = w.id
   FROM public.workspaces w
   WHERE h.teacher_id = w.owner_id AND h.workspace_id IS NULL;
   ```

5. **Students/Parents as Workspace Members**:
   Any registered users corresponding to students or guardians were registered into `public.workspace_members` with their matching roles.

---

## 4. Verification Check

All existing production records remain intact, readable, and functional. No orphaned records were produced.
