-- Part 10: run once in Supabase → SQL Editor, after supabase-9.sql.
-- Catalog drafts: AI-drafted Discover entries (scripts/extract-opportunity.mjs) wait here until a reviewer approves them
-- on review.html. Approved drafts show on Discover through the approved_catalog view, on top of data/catalog.json.
create table public.catalog_drafts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  updates text,                 -- id of the data/catalog.json entry this changes; null for a new entry
  entry jsonb not null,         -- catalog-shaped entry: kind, name, org, url, deadline, dueMonth, grades, fields...
  evidence jsonb,               -- exact quotes from the page
  confidence text check (confidence in ('high', 'medium', 'low')),
  concerns jsonb not null default '[]',
  source_url text,
  reviewed_by uuid references auth.users on delete set null,
  reviewed_at timestamptz,
  review_note text
);
alter table public.catalog_drafts enable row level security;
-- Reviewers do everything; the extraction script writes with the service role key, which bypasses RLS
create policy "reviewers manage drafts" on public.catalog_drafts for all to authenticated
  using (public.is_reviewer()) with check (public.is_reviewer());

-- Public: approved entries only, without evidence or reviewer details
create view public.approved_catalog as
  select id, updates, entry, reviewed_at from public.catalog_drafts where status = 'approved';
grant select on public.approved_catalog to anon, authenticated;
