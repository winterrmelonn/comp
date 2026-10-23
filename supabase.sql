-- Run once in Supabase → SQL Editor. Each student can only see and change their own hours.
create table public.hours (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  date date not null,
  org text not null,
  activity text,
  hours numeric(5, 2) not null check (hours > 0 and hours <= 24),
  supervisor text,
  contact text,
  created_at timestamptz not null default now()
);

alter table public.hours enable row level security;
grant select, insert, delete on public.hours to authenticated;

create policy "Students manage their own hours" on public.hours
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
