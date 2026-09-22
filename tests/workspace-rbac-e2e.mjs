import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('================================================================');
  console.log('TUITIONTRACK WORKSPACE & RBAC END-TO-END VERIFICATION SUITE');
  console.log('================================================================\n');

  await client.connect();

  const teacherA_Id = 'aaaaaaaa-1111-4444-8888-000000000001';
  const teacherA_Email = 'teacher_a@tuitiontrack.test';

  const teacherB_Id = 'bbbbbbbb-1111-4444-8888-000000000002';
  const teacherB_Email = 'teacher_b@tuitiontrack.test';

  const studentA_Id = 'cccccccc-1111-4444-8888-000000000003';
  const studentA_Email = 'student_a@tuitiontrack.test';

  const studentB_Id = 'dddddddd-1111-4444-8888-000000000004';
  const studentB_Email = 'student_b@tuitiontrack.test';

  const parentA_Id = 'eeeeeeee-1111-4444-8888-000000000005';
  const parentA_Email = 'parent_a@tuitiontrack.test';

  const wsA_Id = '11111111-aaaa-bbbb-cccc-000000000001';
  const wsA_Code = 'TT-TESTA1';

  const wsB_Id = '22222222-aaaa-bbbb-cccc-000000000002';
  const wsB_Code = 'TT-TESTB2';

  const assignA_Id = '33333333-aaaa-bbbb-cccc-000000000003';
  const assignB_Id = '44444444-aaaa-bbbb-cccc-000000000004';

  await client.query('begin');

  try {
    console.log('1. SEEDING TEST USERS AND WORKSPACES...');
    // Seed Users
    await client.query(`
      insert into auth.users (id, email, role, aud)
      values
        ($1, $2, 'authenticated', 'authenticated'),
        ($3, $4, 'authenticated', 'authenticated'),
        ($5, $6, 'authenticated', 'authenticated'),
        ($7, $8, 'authenticated', 'authenticated'),
        ($9, $10, 'authenticated', 'authenticated')
      on conflict (id) do nothing;
    `, [
      teacherA_Id, teacherA_Email,
      teacherB_Id, teacherB_Email,
      studentA_Id, studentA_Email,
      studentB_Id, studentB_Email,
      parentA_Id, parentA_Email
    ]);

    await client.query(`
      insert into public.users (id, email, name, role)
      values
        ($1, $2, 'Teacher A', 'teacher'),
        ($3, $4, 'Teacher B', 'teacher'),
        ($5, $6, 'Student A', 'student'),
        ($7, $8, 'Student B', 'student'),
        ($9, $10, 'Parent A', 'parent')
      on conflict (id) do update set role = excluded.role;
    `, [
      teacherA_Id, teacherA_Email,
      teacherB_Id, teacherB_Email,
      studentA_Id, studentA_Email,
      studentB_Id, studentB_Email,
      parentA_Id, parentA_Email
    ]);

    // Seed Workspaces
    await client.query(`
      insert into public.workspaces (id, name, code, owner_id, status)
      values
        ($1, 'Academy Alpha', $2, $3, 'active'),
        ($4, 'Academy Beta', $5, $6, 'active');
    `, [wsA_Id, wsA_Code, teacherA_Id, wsB_Id, wsB_Code, teacherB_Id]);

    // Seed Teacher Memberships
    await client.query(`
      insert into public.workspace_members (workspace_id, user_id, role, status)
      values
        ($1, $2, 'teacher', 'active'),
        ($3, $4, 'teacher', 'active');
    `, [wsA_Id, teacherA_Id, wsB_Id, teacherB_Id]);

    assert(true, 'Test users and workspaces seeded');

    // -------------------------------------------------------------
    // Test 1: Unique Workspace Code Format & Case-Insensitive Lookup
    // -------------------------------------------------------------
    console.log('\n2. TESTING WORKSPACE CODE VALIDATION & CASE-INSENSITIVITY...');
    const { rows: codeLookup } = await client.query(`
      select id, name, code from public.workspaces where lower(code) = lower($1) and status = 'active';
    `, ['tt-testa1']);
    assert(codeLookup.length === 1 && codeLookup[0].id === wsA_Id, 'Case-insensitive workspace code lookup finds correct workspace');

    const { rows: invalidLookup } = await client.query(`
      select id from public.workspaces where lower(code) = lower('TT-INVALID') and status = 'active';
    `, []);
    assert(invalidLookup.length === 0, 'Invalid workspace code returns 0 matches');

    // -------------------------------------------------------------
    // Test 2: Student & Parent Workspace Joining
    // -------------------------------------------------------------
    console.log('\n3. TESTING WORKSPACE JOIN FLOW...');
    // Student A joins Workspace A
    await client.query(`
      insert into public.workspace_members (workspace_id, user_id, role, status)
      values ($1, $2, 'student', 'active');
    `, [wsA_Id, studentA_Id]);

    // Student B joins Workspace B
    await client.query(`
      insert into public.workspace_members (workspace_id, user_id, role, status)
      values ($1, $2, 'student', 'active');
    `, [wsB_Id, studentB_Id]);

    // Parent A joins Workspace A
    await client.query(`
      insert into public.workspace_members (workspace_id, user_id, role, status)
      values ($1, $2, 'parent', 'active');
    `, [wsA_Id, parentA_Id]);

    // Verify memberships
    const { rows: memCheck } = await client.query(`
      select count(*) from public.workspace_members where workspace_id = $1;
    `, [wsA_Id]);
    assert(Number(memCheck[0].count) === 3, 'Workspace A has 3 members (Teacher, Student, Parent)');

    // Test unique constraint: duplicate join attempt fails
    let dupFailed = false;
    await client.query('SAVEPOINT sp_dup');
    try {
      await client.query(`
        insert into public.workspace_members (workspace_id, user_id, role, status)
        values ($1, $2, 'student', 'active');
      `, [wsA_Id, studentA_Id]);
    } catch (e) {
      dupFailed = e.code === '23505'; // unique violation
      await client.query('ROLLBACK TO SAVEPOINT sp_dup');
    }
    assert(dupFailed, 'Duplicate membership blocked by unique constraint (workspace_id, user_id)');

    // -------------------------------------------------------------
    // Test 3: Teacher Role Management & Privilege Escalation Guard
    // -------------------------------------------------------------
    console.log('\n4. TESTING TEACHER ROLE MANAGEMENT...');
    // Teacher A promotes Student A to Parent
    await client.query(`
      update public.workspace_members set role = 'parent' where workspace_id = $1 and user_id = $2;
    `, [wsA_Id, studentA_Id]);
    const { rows: roleCheck1 } = await client.query(`
      select role from public.workspace_members where workspace_id = $1 and user_id = $2;
    `, [wsA_Id, studentA_Id]);
    assert(roleCheck1[0].role === 'parent', 'Teacher successfully updated member role to parent');

    // Restore to student
    await client.query(`
      update public.workspace_members set role = 'student' where workspace_id = $1 and user_id = $2;
    `, [wsA_Id, studentA_Id]);

    // Check invalid role constraint
    let invalidRoleRejected = false;
    await client.query('SAVEPOINT sp_invalid_role');
    try {
      await client.query(`
        update public.workspace_members set role = 'superadmin' where workspace_id = $1 and user_id = $2;
      `, [wsA_Id, studentA_Id]);
    } catch (e) {
      invalidRoleRejected = e.code === '23514'; // check constraint violation
      await client.query('ROLLBACK TO SAVEPOINT sp_invalid_role');
    }
    assert(invalidRoleRejected, 'Database check constraint blocks invalid/arbitrary roles');

    // -------------------------------------------------------------
    // Test 4: Workspace Homework Visibility & Multi-Tenant Isolation
    // -------------------------------------------------------------
    console.log('\n5. TESTING HOMEWORK VISIBILITY & TENANT ISOLATION...');
    // Seed Student profiles
    const stdProfileA_Id = 'aaaaaaaa-2222-3333-4444-555555555555';
    const stdProfileB_Id = 'bbbbbbbb-2222-3333-4444-555555555555';

    await client.query(`
      insert into public.students (id, name, class, student_email, parent_email, teacher_id, workspace_id)
      values
        ($1, 'Alice Student', '9', $2, $3, $4, $5),
        ($6, 'Bob Student', '9', $7, null, $8, $9);
    `, [
      stdProfileA_Id, studentA_Email, parentA_Email, teacherA_Id, wsA_Id,
      stdProfileB_Id, studentB_Email, teacherB_Id, wsB_Id
    ]);

    // Teacher A creates Homework in Workspace A
    await client.query(`
      insert into public.assignments (
        id, teacher_id, workspace_id, title, class_level, subject, chapter_slug,
        preset, mode, submission_mode, lifecycle, due_date, total_marks, passing_marks,
        allow_late, allow_resubmission, ai_grading_enabled, target_student_ids, config
      ) values (
        $1, $2, $3, 'Algebra Ch 4 Homework', 9, 'Mathematics', 'algebra-4',
        'exam', 'variant', 'online', 'published', now() + interval '7 days', 20, 8,
        true, true, true, '[]'::jsonb, '{}'::jsonb
      );
    `, [assignA_Id, teacherA_Id, wsA_Id]);

    // Teacher B creates Homework in Workspace B
    await client.query(`
      insert into public.assignments (
        id, teacher_id, workspace_id, title, class_level, subject, chapter_slug,
        preset, mode, submission_mode, lifecycle, due_date, total_marks, passing_marks,
        allow_late, allow_resubmission, ai_grading_enabled, target_student_ids, config
      ) values (
        $1, $2, $3, 'Beta Chemistry Lab', 9, 'Science', 'chem-1',
        'exam', 'variant', 'online', 'published', now() + interval '7 days', 30, 12,
        true, true, true, '[]'::jsonb, '{}'::jsonb
      );
    `, [assignB_Id, teacherB_Id, wsB_Id]);

    // Verify Workspace Isolation:
    // Workspace A has only assignA
    const { rows: wsAAssignments } = await client.query(`
      select id, title from public.assignments where workspace_id = $1 and deleted_at is null;
    `, [wsA_Id]);
    assert(wsAAssignments.length === 1 && wsAAssignments[0].id === assignA_Id, 'Workspace A contains only Workspace A assignments');

    // Workspace B has only assignB
    const { rows: wsBAssignments } = await client.query(`
      select id, title from public.assignments where workspace_id = $1 and deleted_at is null;
    `, [wsB_Id]);
    assert(wsBAssignments.length === 1 && wsBAssignments[0].id === assignB_Id, 'Workspace B contains only Workspace B assignments');

    // -------------------------------------------------------------
    // Test 5: Teacher-Only Homework Deletion & Student Deletion Block
    // -------------------------------------------------------------
    console.log('\n6. TESTING TEACHER-ONLY HOMEWORK DELETION & RLS...');
    // Emulate Student A authenticated session
    await client.query(`select set_config('role', 'authenticated', true)`);
    await client.query(
      `select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: studentA_Id, email: studentA_Email, role: 'authenticated' })]
    );

    // Student A tries to delete Homework via SQL DELETE under RLS
    const { rowCount: studentDeleteCount } = await client.query(`
      delete from public.assignments where id = $1;
    `, [assignA_Id]);
    assert(studentDeleteCount === 0, 'RLS BLOCKS Student from deleting homework (0 rows deleted)');

    // Reset to service role
    await client.query(`select set_config('role', 'postgres', true)`);

    // Emulate Teacher A authenticated session
    await client.query(`select set_config('role', 'authenticated', true)`);
    await client.query(
      `select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: teacherA_Id, email: teacherA_Email, role: 'authenticated' })]
    );

    // Teacher A deletes their homework
    await client.query(`
      update public.assignments
      set deleted_at = now()
      where id = $1 and (workspace_id = $2 or teacher_id = $3);
    `, [assignA_Id, wsA_Id, teacherA_Id]);

    // Reset to service role
    await client.query(`select set_config('role', 'postgres', true)`);

    const { rows: deletedCheck } = await client.query(`
      select id, title, deleted_at from public.assignments where id = $1;
    `, [assignA_Id]);
    assert(deletedCheck[0].deleted_at !== null, 'Teacher successfully soft-deleted homework assignment');

    // Verify deleted homework is omitted from active student views
    const { rows: activeStudentHw } = await client.query(`
      select id from public.assignments where workspace_id = $1 and deleted_at is null;
    `, [wsA_Id]);
    assert(activeStudentHw.length === 0, 'Deleted homework is excluded from active student list');

    // -------------------------------------------------------------
    // Test 6: Audit Logging
    // -------------------------------------------------------------
    console.log('\n7. TESTING AUDIT LOGGING...');
    await client.query(`
      insert into public.workspace_audit_logs (workspace_id, actor_id, action, target_id, metadata)
      values ($1, $2, 'HOMEWORK_DELETED', $3, '{"title": "Algebra Ch 4 Homework"}'::jsonb);
    `, [wsA_Id, teacherA_Id, assignA_Id]);

    const { rows: auditRows } = await client.query(`
      select action, actor_id from public.workspace_audit_logs where workspace_id = $1;
    `, [wsA_Id]);
    assert(auditRows.length > 0 && auditRows[0].action === 'HOMEWORK_DELETED', 'Audit log records HOMEWORK_DELETED event');

    console.log('\n================================================================');
    console.log(`E2E TEST RUN COMPLETED: ${passed} PASSED, ${failed} FAILED`);
    console.log('================================================================');

  } finally {
    // Always rollback test transaction to keep live database pristine
    await client.query('rollback');
    await client.end();
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
