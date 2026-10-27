-- Part 14: run once in Supabase → SQL Editor, after supabase-13.sql.
-- Club leaderboard on each school page. Clubs come from the Clubs section students fill in on Edit profile
-- (same name, any capitalization, counts as one club), so a club shows up once a student at the school lists it.
--   members: students at the school who list the club with "To: Present"
--   events:  approved events submitted by a student at the school with the club as the organization
--   hours:   all volunteer hours logged by those members
-- Only students at the school see its leaderboard (it adds up members' hours, which are otherwise private)
create function public.is_school_member(sid text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and school_id = sid)
$$;

create function public.school_clubs(sid text) returns table (club text, members bigint, events bigint, hours numeric)
  language sql stable security definer set search_path = public as $$
  with m as (
    select distinct p.id as uid, lower(trim(c->>'club')) as k, trim(c->>'club') as name
    from profiles p cross join lateral jsonb_array_elements(p.memberships) c
    where p.school_id = sid and coalesce(trim(c->>'club'), '') <> '' and coalesce(c->>'end', 'Present') = 'Present'
  ),
  clubs as (select k, mode() within group (order by name) as club, count(distinct uid) as members from m group by k),
  hrs as (select x.k, sum(h.hours) as hours from (select distinct k, uid from m) x join hours h on h.user_id = x.uid group by x.k),
  ev as (
    select lower(trim(a.org)) as k, count(*) as events
    from event_applications a join profiles p on p.id = a.submitted_by
    where p.school_id = sid and a.status = 'approved' group by 1
  )
  select c.club, c.members, coalesce(ev.events, 0), coalesce(hrs.hours, 0)
  from clubs c left join hrs using (k) left join ev using (k)
  where public.is_school_member(sid)
$$;

revoke execute on function public.school_clubs(text), public.is_school_member(text) from public;
grant execute on function public.school_clubs(text), public.is_school_member(text) to authenticated;
