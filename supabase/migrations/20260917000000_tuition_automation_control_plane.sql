-- TuitionTrack AI automation control plane + messaging (Part 4, §§4.1–4.2 only).
-- Additive + idempotent. Money/consent/KB tables deliberately deferred.
-- org_id scoping matches 20260915000000 (public.orgs exists); RLS style copies
-- the org helpers (is_org_member / is_org_staff, SECURITY DEFINER, no recursion).
-- Service role bypasses RLS implicitly — cron/agents use the admin client.

create extension if not exists pgcrypto;

-- ── Tables ───────────────────────────────────────────────────────
create table if not exists public.agent_runs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs (id) on delete cascade,
  agent         text not null,
  trigger       text not null,
  subject_type  text,
  subject_id    uuid,
  status        text not null default 'running'
    check (status in ('running','success','failed','escalated','blocked_by_budget')),
  autonomy      text not null check (autonomy in ('L2','L3','L4')),
  input         jsonb not null default '{}'::jsonb,
  output        jsonb,
  model         text,
  input_tokens  int,
  output_tokens int,
  cost_paise    int not null default 0,
  latency_ms    int,
  error         text,
  created_at    timestamptz not null default timezone('utc', now())
);

create table if not exists public.automation_rules (
  org_id                uuid not null references public.orgs (id) on delete cascade,
  agent                 text not null,
  enabled               boolean not null default true,
  autonomy              text not null default 'L3' check (autonomy in ('L2','L3','L4')),
  monthly_cap_paise     int not null default 50000,
  per_student_daily_calls int not null default 20,
  config                jsonb not null default '{}'::jsonb,
  updated_at            timestamptz not null default timezone('utc', now()),
  primary key (org_id, agent)
);

create table if not exists public.approvals (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.orgs (id) on delete cascade,
  agent_run_id   uuid references public.agent_runs (id) on delete set null,
  kind           text not null check (kind in ('message','worksheet','grade','post')),
  payload        jsonb not null default '{}'::jsonb,
  preview        text not null,
  status         text not null default 'pending'
    check (status in ('pending','approved','edited','rejected','expired')),
  edited_payload jsonb,
  decided_by     uuid references public.users (id) on delete set null,
  decided_at     timestamptz,
  expires_at     timestamptz not null default timezone('utc', now()) + interval '48 hours',
  created_at     timestamptz not null default timezone('utc', now())
);

-- Ops tasks (human work). Distinct from public.plan_tasks (study-plan items).
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.orgs (id) on delete cascade,
  title        text not null,
  detail       text,
  priority     smallint not null default 3 check (priority between 1 and 5),
  due_on       date,
  subject_type text,
  subject_id   uuid,
  source       text,
  status       text not null default 'open' check (status in ('open','done','dropped')),
  created_at   timestamptz not null default timezone('utc', now()),
  completed_at timestamptz
);

create table if not exists public.message_templates (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid not null references public.orgs (id) on delete cascade,
  key              text not null,
  channel          text not null check (channel in ('whatsapp','email','push')),
  wa_category      text check (wa_category in ('utility','marketing','auth')),
  wa_template_name text,
  locale           text not null default 'en',
  body             text not null,
  variables        jsonb not null default '[]'::jsonb,
  active           boolean not null default true,
  unique (org_id, key, locale)
);

create table if not exists public.message_outbox (
  id             uuid primary key default gen_random_uuid(),
  org_id         uuid not null references public.orgs (id) on delete cascade,
  channel        text not null,
  to_identity    text not null,
  recipient_type text not null check (recipient_type in ('parent','student','lead','self')),
  template_key   text,
  variables      jsonb not null default '{}'::jsonb,
  body           text,
  agent_run_id   uuid references public.agent_runs (id) on delete set null,
  dedupe_key     text,
  send_after     timestamptz not null default timezone('utc', now()),
  status         text not null default 'queued'
    check (status in ('queued','sent','delivered','read','failed','cancelled','suppressed')),
  provider_id    text,
  cost_paise     int,
  error          text,
  attempts       smallint not null default 0,
  created_at     timestamptz not null default timezone('utc', now()),
  unique (org_id, dedupe_key)
);

create table if not exists public.inbound_messages (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references public.orgs (id) on delete cascade,
  channel       text not null,
  from_identity text not null,
  body          text,
  media_url     text,
  matched_type  text,
  matched_id    uuid,
  intent        text,
  handled_by    text,
  created_at    timestamptz not null default timezone('utc', now())
);

-- ── Indexes (guide §§4.1–4.2) ────────────────────────────────────
create index if not exists idx_agent_runs_org_agent_created
  on public.agent_runs (org_id, agent, created_at desc);
create index if not exists idx_approvals_org_status_created
  on public.approvals (org_id, status, created_at desc);
create index if not exists idx_outbox_status_send_after
  on public.message_outbox (status, send_after);

-- ── Grants (policies alone don't grant) ──────────────────────────
grant select, insert, update, delete on public.agent_runs to authenticated;
grant select, insert, update, delete on public.automation_rules to authenticated;
grant select, insert, update, delete on public.approvals to authenticated;
grant select, insert, update, delete on public.tasks to authenticated;
grant select, insert, update, delete on public.message_templates to authenticated;
grant select, insert, update, delete on public.message_outbox to authenticated;
grant select, insert, update, delete on public.inbound_messages to authenticated;

-- ── RLS ──────────────────────────────────────────────────────────
alter table public.agent_runs enable row level security;
alter table public.automation_rules enable row level security;
alter table public.approvals enable row level security;
alter table public.tasks enable row level security;
alter table public.message_templates enable row level security;
alter table public.message_outbox enable row level security;
alter table public.inbound_messages enable row level security;

-- agent_runs: members read, staff write
drop policy if exists "runs member select" on public.agent_runs;
create policy "runs member select" on public.agent_runs for select to authenticated
  using (public.is_org_member(org_id));
drop policy if exists "runs staff write" on public.agent_runs;
create policy "runs staff write" on public.agent_runs for all to authenticated
  using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id));

-- automation_rules: members read, staff write (kill-switch toggle is staff)
drop policy if exists "rules member select" on public.automation_rules;
create policy "rules member select" on public.automation_rules for select to authenticated
  using (public.is_org_member(org_id));
drop policy if exists "rules staff write" on public.automation_rules;
create policy "rules staff write" on public.automation_rules for all to authenticated
  using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id));

-- approvals: members read, staff decide
drop policy if exists "approvals member select" on public.approvals;
create policy "approvals member select" on public.approvals for select to authenticated
  using (public.is_org_member(org_id));
drop policy if exists "approvals staff write" on public.approvals;
create policy "approvals staff write" on public.approvals for all to authenticated
  using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id));

-- tasks: members read, staff write
drop policy if exists "tasks member select" on public.tasks;
create policy "tasks member select" on public.tasks for select to authenticated
  using (public.is_org_member(org_id));
drop policy if exists "tasks staff write" on public.tasks;
create policy "tasks staff write" on public.tasks for all to authenticated
  using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id));

-- message_templates: members read, staff write
drop policy if exists "templates member select" on public.message_templates;
create policy "templates member select" on public.message_templates for select to authenticated
  using (public.is_org_member(org_id));
drop policy if exists "templates staff write" on public.message_templates;
create policy "templates staff write" on public.message_templates for all to authenticated
  using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id));

-- message_outbox: members read, staff write
drop policy if exists "outbox member select" on public.message_outbox;
create policy "outbox member select" on public.message_outbox for select to authenticated
  using (public.is_org_member(org_id));
drop policy if exists "outbox staff write" on public.message_outbox;
create policy "outbox staff write" on public.message_outbox for all to authenticated
  using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id));

-- inbound_messages: members read, staff write
drop policy if exists "inbound member select" on public.inbound_messages;
create policy "inbound member select" on public.inbound_messages for select to authenticated
  using (public.is_org_member(org_id));
drop policy if exists "inbound staff write" on public.inbound_messages;
create policy "inbound staff write" on public.inbound_messages for all to authenticated
  using (public.is_org_staff(org_id)) with check (public.is_org_staff(org_id));

-- ── updated_at trigger ───────────────────────────────────────────
drop trigger if exists automation_rules_set_updated_at on public.automation_rules;
create trigger automation_rules_set_updated_at before update on public.automation_rules
  for each row execute function public.set_updated_at();
