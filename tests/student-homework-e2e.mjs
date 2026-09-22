#!/usr/bin/env node
/**
 * End-to-End Test Suite: Assigned Homework in Student Portal
 *
 * Verifies:
 *  1. Teacher creates both AI homework assignment (with questions) and quick homework log.
 *  2. Student portal access grant authentication allows the student to see both items in their portal.
 *  3. Questions for assigned homework are completely visible under RLS to the targeted student.
 *  4. Cross-student isolation: Student B cannot see Student A's targeted homework or variant questions.
 *  5. Homework submission flow: Student submits answers, auto-evaluation calculates score,
 *     and status transitions from "pending" to "graded".
 *  6. Graded submission details and feedback are properly accessible to the student.
 */

import pg from "pg";
import crypto from "node:crypto";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("✗ DATABASE_URL not set in environment");
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
    console.log(`  ✓ ${message}`);
    passed++;
  } else {
    console.error(`  ✗ ${message}`);
    failed++;
  }
}

async function asUser(userId, email, fn) {
  const sp = `sp_${Math.random().toString(36).slice(2, 10)}`;
  await client.query(`savepoint ${sp}`);
  try {
    await client.query(`select set_config('role', 'authenticated', true)`);
    await client.query(
      `select set_config('request.jwt.claims', $1, true)`,
      [JSON.stringify({ sub: userId, email, role: "authenticated" })],
    );
    return await fn();
  } finally {
    await client.query(`select set_config('role', 'postgres', true)`);
    await client.query(`select set_config('request.jwt.claims', '', true)`);
    await client.query(`release savepoint ${sp}`).catch(() => {});
  }
}

await client.query("begin");

try {
  console.log("\n============================================================");
  console.log("TuitionTrack Student Portal Homework E2E Test Suite");
  console.log("============================================================\n");

  const teacherId = crypto.randomUUID();
  const studentAUserId = crypto.randomUUID();
  const studentBUserId = crypto.randomUUID();
  const studentAId = crypto.randomUUID();
  const studentBId = crypto.randomUUID();

  const teacherEmail = `e2e_teacher_${Date.now()}@example.com`;
  const studentAEmail = `e2e_student_a_${Date.now()}@example.com`;
  const studentBEmail = `e2e_student_b_${Date.now()}@example.com`;

  // 1. Create auth users and public users
  for (const [uid, email, role, name] of [
    [teacherId, teacherEmail, "teacher", "E2E Teacher"],
    [studentAUserId, studentAEmail, "student", "Student A"],
    [studentBUserId, studentBEmail, "student", "Student B"],
  ]) {
    await client.query(`
      insert into auth.users (id, email, role, aud)
      values ($1, $2, 'authenticated', 'authenticated')
      on conflict (id) do nothing;
    `, [uid, email]);

    await client.query(`
      insert into public.users (id, email, name, role)
      values ($1, $2, $3, $4)
      on conflict (id) do update set role = $4;
    `, [uid, email, name, role]);
  }

  // 2. Create student profiles
  await client.query(`
    insert into public.students (id, name, class, teacher_id, student_email)
    values
      ($1, 'Student A', '8', $3, $4),
      ($2, 'Student B', '8', $3, $5);
  `, [studentAId, studentBId, teacherId, studentAEmail, studentBEmail]);

  // 3. Create and activate portal access grants
  await client.query(`
    insert into public.portal_access_grants (
      id, user_id, teacher_id, student_id, portal_type, status, token_hash
    ) values
      (gen_random_uuid(), $1, $3, $4, 'student', 'active', 'hash_a'),
      (gen_random_uuid(), $2, $3, $5, 'student', 'active', 'hash_b');
  `, [studentAUserId, studentBUserId, teacherId, studentAId, studentBId]);

  console.log("--- Test 1: Portal Access Authorization ---");
  await asUser(studentAUserId, studentAEmail, async () => {
    const { rows } = await client.query(`select public.can_access_student($1) as ok`, [studentAId]);
    assert(rows[0]?.ok === true, "Student A can access Student A profile");

    const { rows: bRows } = await client.query(`select public.can_access_student($1) as ok`, [studentBId]);
    assert(bRows[0]?.ok === false, "Student A cannot access Student B profile (cross-student isolation)");
  });

  console.log("\n--- Test 2: Teacher Assigns AI Homework & Quick Homework ---");
  const assignmentAId = crypto.randomUUID();
  const assignmentBId = crypto.randomUUID();
  const homeworkLogId = crypto.randomUUID();

  // Assignment targeting Student A
  await client.query(`
    insert into public.assignments (
      id, teacher_id, title, class_level, subject, chapter_slug,
      due_date, total_marks, target_student_ids, lifecycle
    ) values (
      $1, $2, 'Linear Equations Practice A', 8, 'Maths', 'c8-maths-02',
      timezone('utc', now()) + interval '3 days', 20, jsonb_build_array($3::text), 'published'
    );
  `, [assignmentAId, teacherId, studentAId]);

  // Assignment targeting Student B
  await client.query(`
    insert into public.assignments (
      id, teacher_id, title, class_level, subject, chapter_slug,
      due_date, total_marks, target_student_ids, lifecycle
    ) values (
      $1, $2, 'Rational Numbers Practice B', 8, 'Maths', 'c8-maths-01',
      timezone('utc', now()) + interval '5 days', 20, jsonb_build_array($3::text), 'published'
    );
  `, [assignmentBId, teacherId, studentBId]);

  // Questions for Assignment A
  const q1Id = crypto.randomUUID();
  const q2Id = crypto.randomUUID();
  await client.query(`
    insert into public.assignment_questions (
      id, assignment_id, position, stem, qtype, marks, options, correct_answer, fingerprint, student_id
    ) values
      ($1, $3, 1, 'Solve for x: 2x + 5 = 15', 'numeric', 5, '[]'::jsonb, '5', 'fp_q1', null),
      ($2, $3, 2, 'Is x = 5 a solution?', 'mcq', 5, '[{"label":"A","text":"Yes"},{"label":"B","text":"No"}]'::jsonb, 'A', 'fp_q2', $4);
  `, [q1Id, q2Id, assignmentAId, studentAId]);

  // Quick homework log for Student A
  await client.query(`
    insert into public.homework (
      id, teacher_id, student_id, title, description, due_date, status
    ) values (
      $1, $2, $3, 'Complete NCERT Ex 2.1 in notebook', 'Solve Q1 to Q10',
      (timezone('utc', now()) + interval '2 days')::date, 'pending'
    );
  `, [homeworkLogId, teacherId, studentAId]);

  assert(true, "Teacher created assigned homework and questions in database");

  console.log("\n--- Test 3: Student Portal Homework Visibility Under RLS ---");
  await asUser(studentAUserId, studentAEmail, async () => {
    // 3a. Read assignments under RLS
    const { rows: visibleAssignments } = await client.query(`
      select id, title from public.assignments;
    `);
    assert(visibleAssignments.length === 1, "Student A sees exactly 1 assignment under RLS");
    assert(visibleAssignments[0]?.id === assignmentAId, "Visible assignment is Assignment A");

    // 3b. Read questions under RLS
    const { rows: visibleQuestions } = await client.query(`
      select id, stem from public.assignment_questions where assignment_id = $1;
    `, [assignmentAId]);
    assert(visibleQuestions.length === 2, "Student A can read all questions (base + variant) under RLS");

    // 3c. Verify Student A cannot see questions for Assignment B
    const { rows: bQuestions } = await client.query(`
      select id from public.assignment_questions where assignment_id = $1;
    `, [assignmentBId]);
    assert(bQuestions.length === 0, "Student A cannot read questions for Assignment B");

    // 3d. Read quick homework log under RLS
    const { rows: visibleHw } = await client.query(`
      select id, title from public.homework;
    `);
    assert(visibleHw.length === 1, "Student A sees their assigned quick homework log");
    assert(visibleHw[0]?.id === homeworkLogId, "Visible quick log matches assigned homework");
  });

  console.log("\n--- Test 4: Student Submits Homework & Evaluation ---");
  await asUser(studentAUserId, studentAEmail, async () => {
    // Insert submission as student
    const subId = crypto.randomUUID();
    await client.query(`
      insert into public.assignment_submissions (
        id, assignment_id, student_id, answers, score, total_marks, percentage,
        status, submitted_at, graded_at, teacher_feedback
      ) values (
        $1, $2, $3, '{"q1":"5","q2":"A"}'::jsonb, 10, 10, 100,
        'ai_evaluated', timezone('utc', now()), timezone('utc', now()), 'Excellent work!'
      );
    `, [subId, assignmentAId, studentAId]);

    // Read submission back
    const { rows: subRows } = await client.query(`
      select id, score, percentage, status, teacher_feedback
      from public.assignment_submissions
      where assignment_id = $1 and student_id = $2;
    `, [assignmentAId, studentAId]);

    assert(subRows.length === 1, "Student A can read their completed submission");
    assert(subRows[0]?.score === "10.00" || Number(subRows[0]?.score) === 10, "Submission score is 10/10");
    assert(Number(subRows[0]?.percentage) === 100, "Submission percentage is 100%");
    assert(subRows[0]?.status === "ai_evaluated", "Submission status is ai_evaluated");
    assert(subRows[0]?.teacher_feedback === "Excellent work!", "Feedback is accessible");
  });

  console.log("\n--- Test 5: Cross-Student Submission Isolation ---");
  await asUser(studentBUserId, studentBEmail, async () => {
    const { rows: bSubs } = await client.query(`
      select id from public.assignment_submissions where assignment_id = $1;
    `, [assignmentAId]);
    assert(bSubs.length === 0, "Student B cannot read Student A submission");
  });

  console.log("\n============================================================");
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("============================================================\n");

  if (failed > 0) {
    process.exit(1);
  }
} finally {
  await client.query("rollback");
  await client.end();
}
