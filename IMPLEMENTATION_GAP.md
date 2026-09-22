# IMPLEMENTATION_GAP.md — TuitionTrack Multi-Tenant Workspace & RBAC Overhaul

## 1. Executive Summary
TuitionTrack is currently evolving from a single-teacher, email/grant-linked SaaS into a true **multi-tenant education platform** structured around **Teacher Workspaces**. This document details the gap analysis between the existing codebase and the comprehensive specifications for workspace codes, role-based access control, homework management, and portal simplifications.

---

## 2. Current Architecture vs. Required Architecture

| Domain | Current Architecture | Required Architecture | Gap / Action |
| :--- | :--- | :--- | :--- |
| **Tenancy Model** | Implicit single-teacher scoping via `teacher_id` foreign keys; orphan `orgs` table with 1 row; `portal_access_grants` linking students. | First-class **Teacher Workspace** (`workspaces` table) with a unique human-friendly join code (e.g., `TT-P7K4X9`), where all classes, students, homework, and permissions belong to `workspace_id`. | Create canonical `workspaces`, `workspace_members`, and `workspace_audit_logs` tables; link all entities to `workspace_id`. |
| **Workspace Codes** | None. Invitations previously relied on per-grant token hashes or email matching. | Unique, human-readable, indexed join code (e.g., `TT-P7K4X9`) generated for every workspace. Can be viewed, copied, and rotated with confirmation. | Implement workspace code generator (`TT-[A-Z0-9]{6}`), unique constraint, rotation with confirmation, and validation endpoint. |
| **Authentication Flow** | Generic `/login` and `/signup` with optional query param (`role`). Directly displays login/signup forms. | **"How are you using TuitionTrack?"** initial screen with 3 large options: 👨‍🏫 Teacher, 🎓 Student, 👨‍👩‍👧 Parent. Flow branches dynamically based on selection. | Redesign `/login` and `/signup` entry page with role selection; require workspace code for students and parents before registration/join. |
| **Teacher Workspace Onboarding** | New teacher creates account -> goes to `/auth/onboarding` -> no workspace entity created. | Teacher signs up -> automatically creates a teacher workspace, generates unique code, assigns teacher as workspace owner. | Hook workspace creation into teacher signup/first login; display workspace code prominently. |
| **Student / Parent Join Flow** | Required a 1-to-1 token grant link (`/portal/student/[token]`). | Entering the teacher's workspace code links the student or parent to that workspace. | Build `/join` / workspace code redemption flow verifying workspace validity and creating membership. |
| **Role Management** | Fixed roles in `public.users.role`. No interface for teachers to manage or reassign roles. | Teachers have a dedicated **Workspace Members** page (`/app/workspace/members`) to inspect members and change roles (`student` ↔ `parent` ↔ `teacher`). Privileged roles strictly protected. | Build member directory table, role update server actions with audit logging, and authorization guard against self-elevation. |
| **Homework Management** | Dual disconnected tables: `assignments` (AI Studio) and `homework` (Quick Logs). No delete button on AI assignments; quick logs deletion has no confirmation or cascade. | All homework belongs to the teacher workspace. Accessible to all students targeted in that workspace. Teacher-only deletion with confirmation dialog, cascading to questions/submissions. | Add workspace scoping; add delete confirmation dialog and server action with RLS protection; students and parents strictly blocked from deleting. |
| **Student Portal** | Was querying only `public.homework` (showing empty state). Contains potential access to unnecessary endpoints. | Minimal, focused on learning: Dashboard, Homework, Assignments, Tests, Progress, Profile. Shows both AI assignments and tasks with status, player launcher, and zero teacher/admin controls. | Streamlined student navigation; student homework player at `/student/homework/[id]`; strip administrative endpoints. |
| **Parent Portal** | Complex navigation with redundant features (19 nav links). | Minimal, focused on child monitoring: Dashboard, Child Progress, Homework, Assignments, Tests, Attendance, Reports, Profile. Only sees linked children. | Simplify parent navigation and sidebar; remove teacher/admin controls; enforce `guardian_student_relationships` strictly. |
| **Authorization Layer** | Dispersed checks (`context.canManage`, `context.role === 'teacher'`). | Centralized server-side authorization: `can(user, workspace, permission)`, `requireWorkspaceMembership()`, `requireRole()`. | Implement `@/lib/auth/permissions.ts` with explicit permission checks across API routes and server actions. |

---

## 3. Database Schema Changes

### 3.1 New Tables to Introduce
1. **`public.workspaces`**:
   - `id` (uuid, primary key)
   - `name` (text, not null)
   - `code` (text, not null, unique, uppercase indexed)
   - `owner_id` (uuid, references `public.users(id)`)
   - `status` (text, not null default 'active')
   - `created_at` (timestamptz)
   - `updated_at` (timestamptz)

2. **`public.workspace_members`**:
   - `id` (uuid, primary key)
   - `workspace_id` (uuid, references `public.workspaces(id)` on delete cascade)
   - `user_id` (uuid, references `public.users(id)` on delete cascade)
   - `role` (text, check in `'owner', 'teacher', 'student', 'parent'`)
   - `status` (text, default 'active')
   - `joined_at` (timestamptz)
   - `created_at` (timestamptz)
   - `updated_at` (timestamptz)
   - Unique constraint: `(workspace_id, user_id)`

3. **`public.workspace_audit_logs`**:
   - `id` (uuid, primary key)
   - `workspace_id` (uuid, references `public.workspaces(id)` on delete cascade)
   - `actor_id` (uuid, references `public.users(id)` on delete set null)
   - `action` (text, not null)
   - `target_id` (uuid)
   - `metadata` (jsonb, default '{}')
   - `created_at` (timestamptz)

### 3.2 Additive Columns to Existing Tables (Zero Data Loss)
- `public.students`: add `workspace_id uuid references public.workspaces(id)`
- `public.homework`: add `workspace_id uuid references public.workspaces(id)`, add `deleted_at timestamptz`
- `public.assignments`: add `workspace_id uuid references public.workspaces(id)`, add `deleted_at timestamptz`
- `public.guardian_student_relationships`: add `workspace_id uuid references public.workspaces(id)`

---

## 4. Security & Multi-Tenant Isolation Risks

1. **Client-Controlled Workspace IDs**:
   - *Risk*: A rogue user passes arbitrary `workspace_id` in request payloads to access or mutate other tenants' data.
   - *Mitigation*: Never trust client-supplied `workspace_id`. Resolve active workspace from authenticated session and `workspace_members` table on the server.
2. **Privilege Escalation in Member Management**:
   - *Risk*: A student or parent submits `action=changeRole` with `role=teacher` to grant themselves administrative authority.
   - *Mitigation*: Role changes require verified `owner` or `teacher` role in `workspace_members` for that workspace. Self-elevation and changing owner role are rejected server-side and by database RLS.
3. **Unauthorized Homework Deletion**:
   - *Risk*: Direct POST/DELETE call to delete homework items without teacher role check.
   - *Mitigation*: Both server action and database RLS enforce that only teachers in the owning workspace can delete homework. Students and parents have zero delete policies.
4. **Code Enumeration / Brute Force**:
   - *Risk*: Script attempts random 6-character codes.
   - *Mitigation*: 36^6 ≈ 2.17 billion combinations; rate-limiting on workspace code resolution; codes case-normalized.

---

## 5. Migration Strategy
1. Backfill a workspace for every existing teacher in `public.users` (`role = 'teacher'`).
2. Backfill `workspace_members` for each teacher as `role = 'owner'`.
3. Associate existing students with their teacher's workspace (`students.teacher_id -> workspaces.owner_id`).
4. Associate existing homework and assignments with their creator's workspace.
5. Backfill existing student and parent users into `workspace_members` based on existing relationships.

---

## 6. Implementation Phases
- **Phase 1**: Database Migration (`20260922020000_multi_tenant_workspace_core.sql`) + Data Backfill.
- **Phase 2**: Centralized Authorization & Workspace Helper Module (`src/lib/workspace/auth.ts`).
- **Phase 3**: Authentication Entry Flow ("How are you using TuitionTrack?" + Workspace Code validation).
- **Phase 4**: Teacher Workspace Management & Workspace Code View/Rotate (`/app/workspace`).
- **Phase 5**: Teacher Member Management & Role Change (`/app/workspace/members`).
- **Phase 6**: Homework Management & Safe Deletion with Confirmation Dialog.
- **Phase 7**: Student Portal Simplification & Homework Integration.
- **Phase 8**: Parent Portal Simplification.
- **Phase 9**: Automated E2E Security Test Suite & Production Build.
