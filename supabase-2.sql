-- Part 2: run once in Supabase → SQL Editor, after supabase.sql. Adds editing hours, profiles, clubs and posts.

grant update on public.hours to authenticated;

-- One profile per account. Private to its owner for now.
create table public.profiles (
  id uuid primary key default auth.uid() references auth.users on delete cascade,
  name text,
  school text,
  clubs text[] not null default '{}'
);
alter table public.profiles enable row level security;
grant select, insert, update on public.profiles to authenticated;
create policy "Students manage their own profile" on public.profiles
  for all to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Clubs registered by their leaders. Anyone can read them.
create table public.clubs (
  id bigint generated always as identity primary key,
  leader_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  description text,
  meets text,
  contact text,
  created_at timestamptz not null default now()
);
alter table public.clubs enable row level security;
grant select on public.clubs to anon, authenticated;
grant insert, update, delete on public.clubs to authenticated;
create policy "Anyone can see clubs" on public.clubs for select using (true);
create policy "Leaders manage their own clubs" on public.clubs
  for all to authenticated
  using (leader_id = auth.uid())
  with check (leader_id = auth.uid());

-- Volunteer opportunities. Anyone can read; only a club's leader can post for it.
create table public.posts (
  id bigint generated always as identity primary key,
  club_id bigint not null references public.clubs on delete cascade,
  author_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  date date not null,
  time text,
  location text,
  details text,
  created_at timestamptz not null default now()
);
alter table public.posts enable row level security;
grant select on public.posts to anon, authenticated;
grant insert, delete on public.posts to authenticated;
create policy "Anyone can see posts" on public.posts for select using (true);
create policy "Leaders post for their own clubs" on public.posts
  for insert to authenticated
  with check (author_id = auth.uid() and exists (select 1 from public.clubs where id = club_id and leader_id = auth.uid()));
create policy "Authors delete their own posts" on public.posts
  for delete to authenticated
  using (author_id = auth.uid());
