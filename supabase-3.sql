-- Part 3: run once in Supabase → SQL Editor, after supabase-2.sql.
-- Replaces the plain club list with club, role and dates, and adds an Instagram handle.
alter table public.profiles drop column clubs;
alter table public.profiles add column memberships jsonb not null default '[]' check (jsonb_typeof(memberships) = 'array');
alter table public.profiles add column instagram text check (instagram ~ '^[A-Za-z0-9._]{1,30}$');
