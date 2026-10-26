-- Part 5: run once in Supabase → SQL Editor, after supabase-4.sql. Adds scholarship and program tracking.

-- Scholarships and programs (summer programs, internships, competitions...) a student is tracking. Private to each student.
create table public.tracked (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  kind text not null check (kind in ('scholarship', 'program')),
  name text not null,
  org text,
  amount numeric(10, 2) check (amount >= 0), -- scholarships
  category text,                             -- programs: summer program, internship, competition...
  deadline date,
  link text,
  status text not null default 'interested' check (status in ('interested', 'applying', 'submitted', 'accepted', 'rejected')),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.tracked enable row level security;
grant select, insert, update, delete on public.tracked to authenticated;

create policy "Students manage their own tracked items" on public.tracked
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
