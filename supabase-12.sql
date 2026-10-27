-- Part 12: run once in Supabase → SQL Editor, after supabase-11.sql.
-- This project doesn't grant table access to the API roles automatically, so the tables from parts 8–10 need explicit
-- grants. Row level security still decides which rows each person can see or change; grants only open the door.
grant insert on public.event_applications to anon, authenticated;
grant select, update on public.event_applications to authenticated;
grant select, insert, update, delete on public.reviewers to authenticated;
grant select, insert, update, delete on public.catalog_drafts to authenticated;
grant select on public.approved_events, public.approved_catalog to anon, authenticated;
grant execute on function public.is_reviewer(), public.is_admin(), public.list_reviewers(), public.add_reviewer(text, text) to authenticated;
