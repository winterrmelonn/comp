-- Part 11: run once in Supabase → SQL Editor, after supabase-10.sql.
-- Lets the tracker hold colleges (colleges.html) next to scholarships and programs.
alter table public.tracked drop constraint if exists tracked_kind_check;
alter table public.tracked add constraint tracked_kind_check check (kind in ('scholarship', 'program', 'college'));
