-- Part 13: run once in Supabase → SQL Editor, after supabase-12.sql.
-- Schools: students pick their school from the national school list (NCES) on Edit profile, which saves its id here.
-- Each school gets a page of the comp. students there and the events they've posted.
alter table public.profiles add column school_id text check (school_id ~ '^[A-Za-z0-9]{1,16}$');

-- Students at a school: names only, and only for logged-in students (profiles are otherwise private)
create function public.school_members(sid text) returns table (name text)
  language sql stable security definer set search_path = public as $$
  select coalesce(nullif(trim(p.name), ''), 'A student') from profiles p where p.school_id = sid order by 1
$$;

-- Events at a school: approved, upcoming events submitted by a logged-in student whose profile has that school
create function public.school_events(sid text) returns setof public.approved_events
  language sql stable security definer set search_path = public as $$
  select e.* from approved_events e
    join event_applications a on a.id = e.id
    join profiles p on p.id = a.submitted_by
  where p.school_id = sid
  order by e.date, e.start_time
$$;

revoke execute on function public.school_members(text), public.school_events(text) from public;
grant execute on function public.school_members(text) to authenticated;
grant execute on function public.school_events(text) to anon, authenticated;
