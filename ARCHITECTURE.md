# ARCHITECTURE.md — TuitionTrack Multi-Tenant Platform Architecture

## 1. System Overview

TuitionTrack is a production-grade multi-tenant SaaS education platform built on Next.js 14 App Router, Supabase (PostgreSQL + Auth + Row Level Security), Tailwind CSS, Base UI/shadcn components, and TypeScript.

The system is structured around **Teacher Workspaces**, where each teacher owns a dedicated educational workspace with a unique join code (`TT-[A-Z0-9]{6}`). Students and parents join the teacher's workspace via this code, and access role-specific portals with strict tenant data isolation.

```
TuitionTrack Architecture
│
├── Teacher Workspace (/app/*)
│   ├── Workspace Owner / Teacher
│   ├── Member Management & Role Delegation (/app/workspace/members)
│   ├── Workspace Settings & Code Rotation (/app/workspace)
│   ├── AI Homework Studio & Quick Homework Management (/app/homework)
│   ├── Students, Parents, Attendance, Tests, Progress & Reports
│   └── Workspace Audit Trail
│
├── Student Portal (/student/*)
│   ├── Learning Dashboard (/student/dashboard)
│   ├── Homework & AI Assignment Player (/student/homework, /student/homework/[id])
│   ├── Interactive 3D Lessons (/student/lessons)
│   ├── Tests & Results (/student/tests)
│   └── Progress & Study History (/student/progress)
│
└── Parent Portal (/parent/*)
    ├── Child Monitoring Dashboard (/parent/dashboard)
    ├── Child Switcher (Multi-child support)
    ├── Child Homework & Submissions (/parent/homework)
    ├── Progress & Attendance Tracking (/parent/progress, /parent/attendance)
    └── Academic Reports & Fee Management (/parent/reports, /parent/fees)
```

---

## 2. Component Hierarchy & Flow

```mermaid
graph TD
    A[Visitor / User] --> B{Entry Route}
    B -->|/login or /signup| C[Role Selection Step]
    C -->|Teacher| D[Teacher Auth -> Auto-provision Workspace]
    C -->|Student| E[Enter Workspace Code -> Auth -> Join Workspace]
    C -->|Parent| F[Enter Workspace Code -> Auth -> Join Workspace]
    
    D --> G[/app/dashboard]
    E --> H[/student/dashboard]
    F --> I[/parent/dashboard]
    
    G --> J[Teacher Controls: Manage Members, Assign/Delete Homework, Rotate Code]
    H --> K[Student Controls: View/Submit Homework, View Tests & 3D Lessons]
    I --> L[Parent Controls: Monitor Linked Child Homework, Progress & Reports]
```

---

## 3. Core Database Entities

### 3.1 Workspaces (`public.workspaces`)
- `id` (UUID, Primary Key)
- `name` (Text, Workspace display name)
- `code` (Text, Unique, uppercase indexed join code e.g. `TT-6YEAEF`)
- `owner_id` (UUID, references `public.users.id`)
- `status` ('active' | 'archived' | 'suspended')
- `metadata` (JSONB)
- `created_at`, `updated_at` (Timestamptz)

### 3.2 Workspace Members (`public.workspace_members`)
- `id` (UUID, Primary Key)
- `workspace_id` (UUID, references `public.workspaces.id` ON DELETE CASCADE)
- `user_id` (UUID, references `public.users.id` ON DELETE CASCADE)
- `role` ('owner' | 'admin' | 'teacher' | 'student' | 'parent')
- `status` ('active' | 'invited' | 'suspended')
- `joined_at`, `created_at`, `updated_at` (Timestamptz)
- **Constraint**: `UNIQUE (workspace_id, user_id)`

### 3.3 Workspace Audit Logs (`public.workspace_audit_logs`)
- `id` (UUID, Primary Key)
- `workspace_id` (UUID, references `public.workspaces.id` ON DELETE CASCADE)
- `actor_id` (UUID, references `public.users.id` ON DELETE SET NULL)
- `action` (Text e.g. `ROLE_CHANGED`, `HOMEWORK_DELETED`, `WORKSPACE_CODE_ROTATED`)
- `target_id` (UUID)
- `metadata` (JSONB)
- `created_at` (Timestamptz)

### 3.4 Scoped Academic Resources
- **`public.homework`**: Scoped by `workspace_id`, contains `deleted_at` for soft-deletion.
- **`public.assignments`**: Scoped by `workspace_id`, contains `deleted_at` for soft-deletion.
- **`public.students`**: Scoped by `workspace_id`.
- **`public.guardian_student_relationships`**: Scoped by `workspace_id`.

---

## 4. Layered Request & Authorization Lifecycle

1. **Edge / Middleware (`src/lib/supabase/middleware.ts`)**:
   - Inspects authenticated user session.
   - Redirects unauthenticated visitors from protected routes (`/app/*`, `/student/*`, `/parent/*`).
   - Prevents role-confusion by routing authenticated users from `/login` or `/signup` to `/portal`.
2. **Dispatch Router (`src/app/portal/page.tsx`)**:
   - Queries server-side `getWorkspaceContextForUser(userId)`.
   - Dispatches user to their authoritative portal based on workspace membership:
     - Teacher/Owner -> `/app/dashboard`
     - Student -> `/student/dashboard`
     - Parent -> `/parent/dashboard`
3. **Server Actions (`src/actions/*`)**:
   - Explicitly checks `getAuthContext()` and `getWorkspaceContextForUser()`.
   - Rejects unauthorized requests at runtime before touching the database.
4. **Database Row Level Security (RLS)**:
   - PostgreSQL policies enforce tenant boundary on every query.
   - Helper functions `is_workspace_teacher(ws_id)` and `is_workspace_member(ws_id)` verify membership in the database engine itself.
