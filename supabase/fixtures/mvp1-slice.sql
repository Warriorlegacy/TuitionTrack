-- MVP-1 slice fixtures: Class 10 Maths → Quadratic Equations loop.
-- Run AFTER 20260914000000_ai_learning_loop.sql in the SQL editor (teacher must exist).
-- Picks the earliest teacher + their earliest student automatically.
-- Fixed UUIDs for syllabus/questions/assessment so curl tests are deterministic.

do $$
declare
  t_id uuid; s_id uuid;
begin
  select id into t_id from public.users where role = 'teacher' order by created_at limit 1;
  if t_id is null then raise exception 'No teacher in public.users — sign up first.'; end if;
  select id into s_id from public.students where teacher_id = t_id order by created_at limit 1;
  if s_id is null then raise exception 'No student for teacher % — add one in the portal first.', t_id; end if;

  insert into public.syllabus_nodes (id, teacher_id, parent_id, level, title, code, exam) values
    ('11111111-1111-4111-8111-111111111111', t_id, null, 'exam', 'Class 10 Board', 'CBSE-X', 'CBSE Class 10'),
    ('22222222-2222-4222-8222-222222222222', t_id, '11111111-1111-4111-8111-111111111111', 'subject', 'Mathematics', 'MATH-X', 'CBSE Class 10'),
    ('33333333-3333-4333-8333-333333333333', t_id, '22222222-2222-4222-8222-222222222222', 'chapter', 'Quadratic Equations', 'MATH-X-QE', 'CBSE Class 10'),
    ('44444444-4444-4444-8444-444444444444', t_id, '33333333-3333-4333-8333-333333333333', 'topic', 'Factorization method', 'QE-FACT', 'CBSE Class 10'),
    ('55555555-5555-4555-8555-555555555555', t_id, '44444444-4444-4444-8444-444444444444', 'concept', 'Roots by factorization', 'QE-FACT-ROOTS', 'CBSE Class 10'),
    ('66666666-6666-4666-8666-666666666666', t_id, '55555555-5555-4555-8555-555555555555', 'skill', 'Factorize x^2+bx+c', 'QE-FACT-S1', 'CBSE Class 10')
  on conflict (id) do nothing;

  insert into public.documents (id, teacher_id, student_id, title, source_type, status, quality_score, language, metadata) values
    ('a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0', t_id, s_id, 'Quadratic notes Ch.4', 'text', 'ready', 0.8, 'en',
     '{"chars": 320, "inline": true, "raw": "Quadratic equation standard form is ax^2 + bx + c = 0 with a not zero. Roots by factorization: split the middle term so that product equals a*c and sum equals b. Example: x^2 - 5x + 6 = (x-2)(x-3), roots 2 and 3. Discriminant D = b^2 - 4ac tells nature of roots."}')
  on conflict (id) do nothing;

  insert into public.document_chunks (document_id, chunk_index, content, page_no, token_count, concept_id) values
    ('a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0', 0, 'Quadratic equation standard form is ax^2 + bx + c = 0 with a not zero. Roots by factorization: split the middle term so that product equals a*c and sum equals b.', 1, 45, '55555555-5555-4555-8555-555555555555'),
    ('a0a0a0a0-a0a0-4a0a-8a0a-a0a0a0a0a0a0', 1, 'Example: x^2 - 5x + 6 = (x-2)(x-3), roots 2 and 3. Discriminant D = b^2 - 4ac tells nature of roots.', 1, 30, '55555555-5555-4555-8555-555555555555')
  on conflict (document_id, chunk_index) do nothing;

  insert into public.questions (id, teacher_id, syllabus_node_id, stem, qtype, difficulty, marks, language, generated_by, quality_score, risk_level, status) values
    ('b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1', t_id, '55555555-5555-4555-8555-555555555555', 'For x^2 - 5x + 6 = 0, which factorization is correct?', 'mcq', 2, 1, 'en', 'teacher', 0.9, 'low', 'published'),
    ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', t_id, '55555555-5555-4555-8555-555555555555', 'Find the smaller root of x^2 - 5x + 6 = 0.', 'numeric', 2, 1, 'en', 'teacher', 0.9, 'low', 'published'),
    ('b3b3b3b3-b3b3-4b3b-8b3b-b3b3b3b3b3b3', t_id, '55555555-5555-4555-8555-555555555555', 'State the discriminant of 2x^2 + 3x + 1 = 0.', 'numeric', 3, 2, 'en', 'teacher', 0.85, 'medium', 'published')
  on conflict (id) do nothing;

  insert into public.question_options (question_id, label, text, is_correct, rationale) values
    ('b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1', 'A', '(x-2)(x-3)', true, 'Correct split: -2 + -3 = -5, product 6.'),
    ('b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1', 'B', '(x+2)(x+3)', false, 'Sign error trap.'),
    ('b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1', 'C', '(x-1)(x-6)', false, 'Wrong split: sum -7.'),
    ('b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1', 'D', '(x-5)(x-1)', false, 'Wrong split: product 5.')
  on conflict (question_id, label) do nothing;

  insert into public.question_solutions (question_id, steps, final_answer, verified_by) values
    ('b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1', '[{"t": "Split -5x into -2x and -3x, factor by grouping."}]', 'A', 'teacher'),
    ('b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', '[{"t": "(x-2)(x-3)=0 so x=2 or x=3; smaller is 2."}]', '2', 'deterministic'),
    ('b3b3b3b3-b3b3-4b3b-8b3b-b3b3b3b3b3b3', '[{"t": "D = 9 - 8 = 1."}]', '1', 'deterministic')
  on conflict (question_id) do nothing;

  insert into public.assessments (id, teacher_id, title, exam, subject, total_marks, duration_sec, status) values
    ('c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0', t_id, 'Quadratic drill 1', 'CBSE Class 10', 'Mathematics', 4, 600, 'published')
  on conflict (id) do nothing;

  insert into public.assessment_items (id, assessment_id, question_id, position, marks) values
    ('d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d1d1', 'c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0', 'b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1', 1, 1),
    ('d2d2d2d2-d2d2-4d2d-8d2d-d2d2d2d2d2d2', 'c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0', 'b2b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 2, 1),
    ('d3d3d3d3-d3d3-4d3d-8d3d-d3d3d3d3d3d3', 'c0c0c0c0-c0c0-4c0c-8c0c-c0c0c0c0c0c0', 'b3b3b3b3-b3b3-4b3b-8b3b-b3b3b3b3b3b3', 3, 2)
  on conflict (id) do nothing;

  raise notice 'Fixtures ready: teacher %, student %', t_id, s_id;
end $$;
