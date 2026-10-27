-- Part 8: run once in Supabase → SQL Editor, after supabase-7.sql.
-- Event applications: anyone can submit an event to be listed on Find opportunities. Submissions are
-- write-only for the public; reviewers read and approve them in the Supabase dashboard (Table editor),
-- then publish approved ones to posts.
create table public.event_applications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  title text not null check (char_length(title) between 1 and 120),
  kind text not null default 'volunteer' check (kind in ('volunteer', 'workshop', 'competition', 'info', 'other')),
  category text,
  description text not null check (char_length(description) <= 2000),
  date date not null,
  start_time time not null,
  end_time time not null,
  repeats text,
  format text not null default 'in_person' check (format in ('in_person', 'virtual', 'hybrid')),
  address text,
  eligibility text,
  capacity int check (capacity > 0),
  hours_offered numeric(5, 2) check (hours_offered >= 0),
  cost text check (cost in ('free', 'paid')),
  link text,
  org text not null check (char_length(org) between 1 and 120),
  org_url text,
  contact_name text not null,
  contact_role text,
  contact_email text not null check (contact_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  contact_phone text,
  supervisor text,
  submitted_by uuid default auth.uid() references auth.users on delete set null
);
alter table public.event_applications enable row level security;
-- Anyone (logged in or not) can submit, but only as pending
create policy "anyone can apply" on public.event_applications for insert to anon, authenticated
  with check (status = 'pending');
-- Logged-in organizers can see their own submissions and status
create policy "see own applications" on public.event_applications for select to authenticated
  using (submitted_by = auth.uid());
