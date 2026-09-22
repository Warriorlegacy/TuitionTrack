# TEST_PLAN.md — TuitionTrack Verification & Test Plan

## 1. Automated Test Suites

The repository contains two end-to-end test suites verifying authentication, workspace scoping, role-based access control, homework visibility, and student homework workflows:

### Suite 1: Workspace & RBAC Verification (`tests/workspace-rbac-e2e.mjs`)
Run command: `node tests/workspace-rbac-e2e.mjs`
- **Test 1**: Seeding test users, teachers, students, and workspaces.
- **Test 2**: Case-insensitive workspace code lookup & invalid code rejection.
- **Test 3**: Workspace join flow & duplicate membership prevention (`UNIQUE (workspace_id, user_id)`).
- **Test 4**: Teacher role management & database CHECK constraint validation for roles.
- **Test 5**: Homework visibility & multi-tenant isolation across Workspace A and Workspace B.
- **Test 6**: Teacher-only homework deletion, RLS student delete block, soft-delete verification.
- **Test 7**: Workspace audit logging (`HOMEWORK_DELETED` event).
- **Result**: 13/13 tests passing.

### Suite 2: Student Homework & Question Visibility (`tests/student-homework-e2e.mjs`)
Run command: `node tests/student-homework-e2e.mjs`
- **Test 1**: Portal access authorization & cross-student profile isolation.
- **Test 2**: Teacher assigns AI homework & quick homework.
- **Test 3**: Student portal homework visibility under RLS (Assignment A visible, Assignment B blocked; Question stems visible).
- **Test 4**: Student homework submission & automatic evaluation scoring.
- **Test 5**: Cross-student submission isolation (Student B cannot view Student A submission).
- **Result**: 15/15 tests passing.

---

## 2. Type & Lint Verification

- **TypeScript Typecheck**:
  Command: `npm run typecheck`
  Target: `tsc --noEmit`
  Result: 0 errors.

- **ESLint Code Quality**:
  Command: `npm run lint`
  Target: Next.js ESLint
  Result: `✔ No ESLint warnings or errors`.

- **Production Build**:
  Command: `npm run build`
  Target: `next build`
  Result: 71/71 static and dynamic pages generated with 0 errors.

---

## 3. Manual Verification Checklist

| Scenario | Steps to Verify | Expected Outcome |
| :--- | :--- | :--- |
| **Role Selection at Login/Signup** | 1. Navigate to `/login` or `/signup`<br>2. Observe the screen asking "How are you using TuitionTrack?" with Teacher, Student, Parent cards | Role selection screen appears first. Selecting Teacher proceeds to auth; selecting Student/Parent prompts for Workspace Code. |
| **Workspace Code Validation** | 1. Choose Student on `/signup`<br>2. Type invalid code `TT-XXXXXX`<br>3. Type valid code `TT-6YEAEF` | Invalid code shows warning badge; valid code shows green checkmark with "Piyush's Classroom". |
| **Teacher Workspace Settings** | 1. Log in as teacher Piyush<br>2. Visit `/app/workspace`<br>3. Click "Copy Code"<br>4. Click "Rotate Code" | Dialog asks for confirmation. Rotating generates a new valid code and logs an audit record. |
| **Teacher Member Management** | 1. Log in as teacher<br>2. Visit `/app/workspace/members`<br>3. Inspect list of members<br>4. Click "Change Role" on a student | Dropdown allows selecting Parent or Teacher. Owner role is protected. Updating changes member role and records an audit log. |
| **Teacher Delete Homework** | 1. Log in as teacher<br>2. Visit `/app/homework`<br>3. Click the red trash icon on an assignment or quick homework<br>4. Confirm deletion | Dialog confirms deletion. Assignment is soft-deleted and disappears from teacher, student, and parent views. |
| **Student Homework Portal** | 1. Log in as student<br>2. Visit `/student/homework`<br>3. View assigned homework<br>4. Click "Start Homework" | Student sees targeted homework; can open homework player; has zero delete buttons or administrative controls. |
| **Parent Portal Scoping** | 1. Log in as parent<br>2. Visit `/parent/homework` | Parent only sees homework for their linked child. Cannot edit, assign, or delete homework. |
