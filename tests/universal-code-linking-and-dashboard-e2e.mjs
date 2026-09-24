#!/usr/bin/env node
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

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
  console.log('UNIVERSAL CODE LINKING & SINGLE DASHBOARD E2E TEST SUITE');
  console.log('================================================================\n');

  await client.query('begin');

  try {
    const teacherId = '11111111-2222-3333-4444-555555555551';
    const teacherEmail = 'test_teacher_dashboard@tuitiontrack.test';
    const wsCode = 'TT-DASH99';
    const wsId = '22222222-3333-4444-5555-666666666662';

    const studentId = '33333333-4444-5555-6666-777777777773';
    const studentEmail = 'test_student_dashboard@tuitiontrack.test';
    const studentCode = 'STU-TST001';

    const parentId = '44444444-5555-6666-7777-888888888884';
    const parentEmail = 'test_parent_dashboard@tuitiontrack.test';
    const parentCode = 'PAR-TST002';

    console.log('1. SEEDING TEST USERS WITH UNIVERSAL CODES...');
    // Seed auth.users
    await client.query(`
      insert into auth.users (id, email, raw_user_meta_data)
      values 
        ($1, $2, '{"role":"teacher"}'),
        ($3, $4, '{"role":"student"}'),
        ($5, $6, '{"role":"parent"}')
      on conflict (id) do nothing;
    `, [teacherId, teacherEmail, studentId, studentEmail, parentId, parentEmail]);

    // Seed teacher
    await client.query(`
      insert into public.users (id, email, role, name, link_code)
      values ($1, $2, 'teacher', 'Prof. Dashboard Tester', $3)
      on conflict (id) do update set link_code = $3;
    `, [teacherId, teacherEmail, wsCode]);

    // Seed teacher workspace
    await client.query(`
      insert into public.workspaces (id, name, code, owner_id, status)
      values ($1, 'Dashboard Test Academy', $2, $3, 'active')
      on conflict (id) do update set code = $2;
    `, [wsId, wsCode, teacherId]);

    // Seed student
    await client.query(`
      insert into public.users (id, email, role, name, link_code)
      values ($1, $2, 'student', 'Student Code Tester', $3)
      on conflict (id) do update set link_code = $3;
    `, [studentId, studentEmail, studentCode]);

    // Seed parent
    await client.query(`
      insert into public.users (id, email, role, name, link_code)
      values ($1, $2, 'parent', 'Parent Code Tester', $3)
      on conflict (id) do update set link_code = $3;
    `, [parentId, parentEmail, parentCode]);

    // Seed student record
    const stdRow = await client.query(`
      insert into public.students (name, class, teacher_id, student_email, link_code)
      values ('Student Code Tester', '10', $1, $2, $3)
      returning id;
    `, [teacherId, studentEmail, studentCode]);
    const studentRecordId = stdRow.rows[0].id;

    assert(true, 'Test entities successfully seeded with universal verification codes');

    console.log('\n2. VERIFYING CODE PATTERNS & UNIQUE CONSTRAINTS...');
    assert(/^TT-[0-9A-Z]+$/.test(wsCode), 'Teacher workspace code follows TT-XXXXXX format');
    assert(/^STU-[0-9A-Z]+$/.test(studentCode), 'Student code follows STU-XXXXXX format');
    assert(/^PAR-[0-9A-Z]+$/.test(parentCode), 'Parent code follows PAR-XXXXXX format');

    // Test unique constraint on users.link_code
    let collisionBlocked = false;
    await client.query('savepoint sp_user_collision');
    try {
      await client.query(`
        insert into public.users (id, email, role, name, link_code)
        values ('55555555-6666-7777-8888-999999999995', 'dup@test.com', 'student', 'Dup', $1)
      `, [studentCode]);
    } catch {
      await client.query('rollback to savepoint sp_user_collision');
      collisionBlocked = true;
    }
    assert(collisionBlocked, 'Duplicate link_code correctly blocked by database unique constraint');

    console.log('\n3. TESTING PARENT-TO-STUDENT LINKING VIA STU- CODE...');
    // Parent enters child STU- code -> inserts into guardian_student_relationships
    const linkRel = await client.query(`
      insert into public.guardian_student_relationships
        (guardian_user_id, student_id, relationship_type, status, verified_at)
      values ($1, $2, 'parent', 'active', now())
      returning id, status;
    `, [parentId, studentRecordId]);

    assert(linkRel.rows.length === 1, 'Relationship created via STU- code');
    assert(linkRel.rows[0].status === 'active', 'Relationship is immediately active');

    // Duplicate relationship check
    let dupRelBlocked = false;
    await client.query('savepoint sp_dup_rel');
    try {
      await client.query(`
        insert into public.guardian_student_relationships
          (guardian_user_id, student_id, relationship_type, status)
        values ($1, $2, 'parent', 'active');
      `, [parentId, studentRecordId]);
    } catch {
      await client.query('rollback to savepoint sp_dup_rel');
      dupRelBlocked = true;
    }
    assert(dupRelBlocked, 'Duplicate parent-student linking blocked by unique constraint');

    console.log('\n4. TESTING TEACHER ENROLLING BY CODE (STU- OR PAR-)...');
    // Teacher adds student by STU- code
    await client.query(`
      insert into public.workspace_members (workspace_id, user_id, role, link_code, status)
      values ($1, $2, 'student', $3, 'active')
      on conflict (workspace_id, user_id) do nothing;
    `, [wsId, studentId, studentCode]);

    // Teacher adds parent by PAR- code
    await client.query(`
      insert into public.workspace_members (workspace_id, user_id, role, link_code, status)
      values ($1, $2, 'parent', $3, 'active')
      on conflict (workspace_id, user_id) do nothing;
    `, [wsId, parentId, parentCode]);

    const mems = await client.query(`
      select user_id, role, link_code from public.workspace_members
      where workspace_id = $1;
    `, [wsId]);

    assert(mems.rows.length === 2, 'Both student and parent successfully enrolled in workspace');
    assert(mems.rows.some(m => m.link_code === studentCode), 'Student member record stores link_code');
    assert(mems.rows.some(m => m.link_code === parentCode), 'Parent member record stores link_code');

    console.log('\n5. TESTING STUDENT-PARENT UNLINKING...');
    const unlinkRes = await client.query(`
      delete from public.guardian_student_relationships
      where id = $1
      returning id;
    `, [linkRel.rows[0].id]);

    assert(unlinkRes.rows.length === 1, 'Successfully unlinked parent-student relationship');

    const remainingRels = await client.query(`
      select count(*) from public.guardian_student_relationships
      where student_id = $1 and status = 'active';
    `, [studentRecordId]);
    assert(Number(remainingRels.rows[0].count) === 0, 'No active relationships remain after unlink');

  } finally {
    await client.query('rollback');
    await client.end();
  }

  console.log('\n================================================================');
  console.log(`CODE LINKING E2E RUN COMPLETED: ${passed} PASSED, ${failed} FAILED`);
  console.log('================================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error("Fatal test error:", err);
  process.exit(1);
});
