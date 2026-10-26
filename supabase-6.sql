-- Part 6: run once in Supabase → SQL Editor, after supabase-5.sql.
-- Lets club leaders post scholarships and programs on Find opportunities, not just volunteer events.
alter table public.posts add column kind text not null default 'volunteer' check (kind in ('volunteer', 'scholarship', 'program'));
alter table public.posts add column link text;
alter table public.posts add column amount numeric(10, 2) check (amount >= 0);
