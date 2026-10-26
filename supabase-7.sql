-- Part 7: run once in Supabase → SQL Editor, after supabase-6.sql.
-- Supervisor sign-off: a student sends their supervisor a secret link, and the supervisor approves the entry without an account.
alter table public.hours add column verify_token uuid unique;
alter table public.hours add column verified_at timestamptz;
alter table public.hours add column verified_by text;

-- Students can't mark their own hours as verified: they may only write these columns
revoke insert, update on public.hours from authenticated;
grant insert (date, org, activity, hours, supervisor, contact, photo) on public.hours to authenticated;
grant update (date, org, activity, hours, supervisor, contact, photo, verify_token) on public.hours to authenticated;

-- Changing what was signed off clears the sign-off
create function public.hours_clear_signoff() returns trigger language plpgsql as $$
begin
  if (new.date, new.org, new.activity, new.hours) is distinct from (old.date, old.org, old.activity, old.hours) then
    new.verified_at := null;
    new.verified_by := null;
  end if;
  return new;
end $$;
create trigger hours_clear_signoff before update on public.hours
  for each row execute function public.hours_clear_signoff();

-- Supervisors have no account, so they go through these two functions, which only reach the one entry the link points to
create function public.hours_for_signoff(token uuid)
returns table (student text, date date, org text, activity text, hours numeric, supervisor text, verified_at timestamptz, verified_by text)
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(p.name, ''), 'A student'), h.date, h.org, h.activity, h.hours, h.supervisor, h.verified_at, h.verified_by
  from public.hours h left join public.profiles p on p.id = h.user_id
  where h.verify_token = token;
$$;

create function public.sign_off_hours(token uuid, signer text)
returns boolean language sql security definer set search_path = public as $$
  update public.hours set verified_at = now(), verified_by = left(trim(signer), 80)
  where verify_token = token and verified_at is null and length(trim(signer)) > 0
    and user_id is distinct from auth.uid() -- a student can't sign off their own hours while logged in
  returning true;
$$;

grant execute on function public.hours_for_signoff(uuid), public.sign_off_hours(uuid, text) to anon, authenticated;
