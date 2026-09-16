-- Backfill orgs/batches/guardian_links from legacy teacher_id data.
-- Idempotent: safe to re-run. Same block as migration 20260915000000
-- (extracted so it can run standalone in the SQL editor / psql).
-- EXPECT after run: fixtures rls-checks.sql probes #5 and #7 return 0 rows.

do $$
declare
  r record; v_org uuid; v_batch uuid;
begin
  for r in select id, coalesce(nullif(name, ''), email, 'Tutor') as tname
           from public.users where role = 'teacher' loop
    select id into v_org from public.orgs where created_by = r.id limit 1;
    if v_org is null then
      insert into public.orgs (name, created_by)
      values (r.tname || '''s Tuition', r.id) returning id into v_org;
    end if;
    insert into public.org_members (org_id, user_id, role)
    values (v_org, r.id, 'owner') on conflict do nothing;
    update public.students set org_id = v_org
    where teacher_id = r.id and org_id is null;
    select id into v_batch from public.batches
    where org_id = v_org and name = 'Default batch' limit 1;
    if v_batch is null then
      insert into public.batches (org_id, name, teacher_id)
      values (v_org, 'Default batch', r.id) returning id into v_batch;
    end if;
    insert into public.batch_enrollments (batch_id, student_id)
    select v_batch, s.id from public.students s where s.org_id = v_org
    on conflict do nothing;
    insert into public.guardian_links (student_id, guardian_email, relationship)
    select s.id, lower(s.parent_email), 'parent'
    from public.students s where s.org_id = v_org and s.parent_email is not null
      and not exists (
        select 1 from public.guardian_links g
        where g.student_id = s.id
          and lower(coalesce(g.guardian_email, '')) = lower(s.parent_email)
      );
  end loop;
end $$;

-- verify
select count(*) as orgs, (select count(*) from public.org_members) as members,
  (select count(*) from public.batches) as batches,
  (select count(*) from public.batch_enrollments) as enrollments,
  (select count(*) from public.guardian_links) as guardian_links,
  (select count(*) from public.students where org_id is null) as orphans;
-- EXPECT: orphans = 0
