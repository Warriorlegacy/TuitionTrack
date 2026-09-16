-- TuitionTrack BYOK: Bring Your Own Key for multi-provider AI
-- Supports OpenAI, Anthropic, Google, Groq, Together AI, OpenRouter, HuggingFace
-- Encrypted at rest; users manage their own keys via Settings.

create extension if not exists pgcrypto;

-- ── Enums ──────────────────────────────────────────────────────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'ai_provider') then
    create type public.ai_provider as enum (
      'openai','anthropic','google','groq','together','openrouter','huggingface','custom'
    );
  end if;
  if not exists (select 1 from pg_type where typname = 'ai_key_status') then
    create type public.ai_key_status as enum ('active','revoked','expired');
  end if;
end $$;

-- ── Tables ─────────────────────────────────────────────────────────
create table if not exists public.user_ai_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  provider public.ai_provider not null,
  label text not null default 'Default',
  encrypted_key text not null,
  key_fingerprint text not null,
  status public.ai_key_status not null default 'active',
  last_used_at timestamptz,
  last_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (user_id, provider, label)
);

create table if not exists public.user_ai_preferences (
  user_id uuid primary key references public.users (id) on delete cascade,
  default_provider public.ai_provider not null default 'openrouter',
  default_model text not null default 'openai/gpt-4o-mini',
  tier_a_model text,
  tier_b_model text,
  tier_c_model text,
  allow_free_fallbacks boolean not null default true,
  prefer_free_tiers boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

-- ── Indexes ────────────────────────────────────────────────────────
create index if not exists idx_ai_keys_user on public.user_ai_keys (user_id);
create index if not exists idx_ai_keys_provider on public.user_ai_keys (provider);
create index if not exists idx_ai_keys_status on public.user_ai_keys (status);

-- ── Triggers ───────────────────────────────────────────────────────
drop trigger if exists ai_keys_set_updated_at on public.user_ai_keys;
create trigger ai_keys_set_updated_at
  before update on public.user_ai_keys
  for each row execute function public.set_updated_at();

drop trigger if exists ai_prefs_set_updated_at on public.user_ai_preferences;
create trigger ai_prefs_set_updated_at
  before update on public.user_ai_preferences
  for each row execute function public.set_updated_at();

-- ── RLS ────────────────────────────────────────────────────────────
alter table public.user_ai_keys enable row level security;
alter table public.user_ai_preferences enable row level security;

drop policy if exists "ai_keys own" on public.user_ai_keys;
create policy "ai_keys own"
  on public.user_ai_keys for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "ai_prefs own" on public.user_ai_preferences;
create policy "ai_prefs own"
  on public.user_ai_preferences for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
