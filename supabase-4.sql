-- Part 4: run once in Supabase → SQL Editor, after supabase-3.sql. Adds a photo to each hours entry.
alter table public.hours add column photo text;

-- Private bucket: photos are only visible to the student who uploaded them, through short-lived links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 5242880, array['image/*']);

-- Each student's photos live in a folder named after their account id
create policy "Students upload their own photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Students see their own photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "Students delete their own photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
