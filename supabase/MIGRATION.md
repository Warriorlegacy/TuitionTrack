# Supabase Database Migration Guide

This project's database schema is defined in `supabase/schema.sql`.

## Prerequisites

1. Your Supabase project is linked to this Vercel project via Vercel's Supabase integration.
2. Environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are set in Vercel.

## How to Apply the Schema

### Option 1: Supabase Dashboard SQL Editor

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: **zlkkicrqwoxzhsfehouj**
3. Navigate to **SQL Editor** in the left sidebar
4. Click **New Query**
5. Open `supabase/schema.sql` from this project
6. Copy the entire contents and paste into the SQL Editor
7. Click **Run** (or press `Ctrl+Enter`)

The schema is fully idempotent — safe to run multiple times.

### Option 2: Supabase CLI (if access is configured)

```bash
# Login to Supabase CLI (if not already done)
supabase login

# Link to this project
supabase link --project-ref zlkkicrqwoxzhsfehouj

# Push the schema
supabase db push
```

## What the Schema Includes

- **Tables**: `users`, `students`, `homework`, `attendance`, `fees`, `tests`, `announcements`
- **Indexes**: Performance indexes on foreign keys and commonly queried columns
- **RLS (Row Level Security)**: Row-level security policies on all tables
- **Triggers**: Auto-updating `updated_at` timestamps
- **Functions**: `assign_user_role` RPC, helper functions for access control
- **Realtime**: All tables published to Supabase Realtime for live updates

## After Migration

1. Verify the schema was applied by checking the **Table Editor** in Supabase Dashboard
2. Test the app by signing up and onboarding as a teacher
3. CRUD operations should work immediately with RLS enforcing proper access control
