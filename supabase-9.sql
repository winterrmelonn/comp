-- Part 9: run once in Supabase → SQL Editor, after supabase-8.sql.
-- Reviewers approve event applications on review.html. Admins are reviewers who can also add or remove reviewers.
-- Approved events show on Discover through the approved_events view (public columns only, no contact info).

create table public.reviewers (
  user_id uuid primary key references auth.users on delete cascade,
  role text not null default 'reviewer' check (role in ('admin', 'reviewer')),
  added_at timestamptz not null default now()
);
alter table public.reviewers enable row level security;

create function public.is_reviewer() returns boolean language sql stable security definer set search_path = public
  as $$ select exists (select 1 from reviewers where user_id = auth.uid()) $$;
create function public.is_admin() returns boolean language sql stable security definer set search_path = public
  as $$ select exists (select 1 from reviewers where user_id = auth.uid() and role = 'admin') $$;

create policy "reviewers see the team" on public.reviewers for select to authenticated using (public.is_reviewer());
create policy "admins manage the team" on public.reviewers for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- Review fields on applications; reviewers can read and decide on every application
alter table public.event_applications add column reviewed_by uuid references auth.users on delete set null;
alter table public.event_applications add column reviewed_at timestamptz;
alter table public.event_applications add column review_note text;
create policy "reviewers read applications" on public.event_applications for select to authenticated using (public.is_reviewer());
create policy "reviewers decide applications" on public.event_applications for update to authenticated
  using (public.is_reviewer()) with check (public.is_reviewer());

-- Public listing: approved, upcoming, without the organizer's private contact details
create view public.approved_events as
  select id, title, kind, category, description, date, start_time, end_time, repeats, format, address,
         eligibility, capacity, hours_offered, cost, link, org, org_url
  from public.event_applications
  where status = 'approved' and date >= current_date;
grant select on public.approved_events to anon, authenticated;

-- Admins add a reviewer (or another admin) by the email they signed up with
create function public.add_reviewer(email text, new_role text default 'reviewer') returns text
  language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'Only admins can add reviewers'; end if;
  if new_role not in ('admin', 'reviewer') then raise exception 'Role must be admin or reviewer'; end if;
  select id into uid from auth.users where lower(auth.users.email) = lower(add_reviewer.email);
  if uid is null then raise exception 'No account with that email. Ask them to sign up first.'; end if;
  insert into reviewers (user_id, role) values (uid, new_role) on conflict (user_id) do update set role = excluded.role;
  return 'ok';
end $$;

-- The team with emails, for reviewers only
create function public.list_reviewers() returns table (user_id uuid, email text, role text)
  language sql stable security definer set search_path = public as $$
  select r.user_id, u.email::text, r.role from reviewers r join auth.users u on u.id = r.user_id
  where public.is_reviewer() order by r.role, u.email
$$;

-- Bootstrap: make yourself the first admin (replace the email, run once)
-- insert into public.reviewers (user_id, role) select id, 'admin' from auth.users where email = 'you@example.com';
