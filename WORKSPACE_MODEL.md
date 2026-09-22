# WORKSPACE_MODEL.md — TuitionTrack Workspace Model & Join Flow

## 1. Workspace Code Specification

Every Teacher Workspace is assigned a globally unique join code designed for human clarity:
- **Format**: `TT-XXXXXX` (e.g. `TT-P7K4X9`, `TT-6YEAEF`)
- **Character set**: `23456789ABCDEFGHJKLMNPQRSTUVWXYZ` (32 characters, excluding ambiguous characters `0`, `O`, `1`, `I`).
- **Storage**: Uppercase, unique constraint in `public.workspaces.code`, indexed for `O(1)` lookups.
- **Normalization**: Input is trimmed, converted to uppercase, and automatically prepended with `TT-` if the user enters just the 6-character suffix.

---

## 2. Workspace Code Generation Function

Stored procedure `public.generate_workspace_code()` in PostgreSQL:
```sql
CREATE OR REPLACE FUNCTION public.generate_workspace_code()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  chars text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  res text;
  done boolean := false;
BEGIN
  WHILE NOT done LOOP
    res := 'TT-';
    FOR i IN 1..6 LOOP
      res := res || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM public.workspaces WHERE code = res) THEN
      done := true;
    END IF;
  END LOOP;
  RETURN res;
END;
$$;
```

---

## 3. Workspace Lifecycle

### 3.1 Workspace Provisioning (Teacher Signup / First Login)
When a teacher signs up:
1. An account is created in `auth.users` and `public.users` with `role = 'teacher'`.
2. A workspace is automatically provisioned:
   ```typescript
   const code = generateWorkspaceCode();
   const { data: ws } = await admin.from("workspaces").insert({
     name: `${teacherName}'s Classroom`,
     code,
     owner_id: teacherId,
     status: "active"
   }).select().single();
   ```
3. A membership record is created in `public.workspace_members`:
   `role = 'owner'`, `status = 'active'`.
4. The teacher is redirected to `/app/dashboard` and can view/copy the code anytime from `/app/workspace` and `/app/settings`.

### 3.2 Workspace Code Rotation
Teachers can rotate their workspace code from the Workspace Settings card:
1. Teacher clicks **Rotate Code**.
2. An interactive confirmation dialog warns that previously shared codes will stop accepting new members, but existing members will remain active.
3. Upon confirmation, `regenerateWorkspaceCodeAction(workspaceId)` generates a new unique code, updates `public.workspaces.code`, and records an audit event (`WORKSPACE_CODE_ROTATED`).

### 3.3 Workspace Join Flow (Student & Parent)
1. **Entry**: User chooses Student or Parent on the auth card.
2. **Code Entry**: Enters the teacher's code (e.g. `TT-6YEAEF`).
3. **Live Validation**: As the user types, `validateWorkspaceCodeAction(code)` queries the database and verifies:
   - Code exists.
   - Workspace status is `active`.
   - Returns the verified workspace name (e.g. "Piyush's Classroom").
4. **Authentication & Auto-Join**:
   - The user completes login or signup.
   - Upon successful auth, `joinWorkspaceByCode(code, user.id, requestedRole)` creates the `workspace_members` record.
   - Prevents duplicate joins (`UNIQUE (workspace_id, user_id)` constraint).
   - Provisions a linked student profile if joining as a student.
5. **Redirection**: User is redirected to `/student/dashboard` or `/parent/dashboard`.
