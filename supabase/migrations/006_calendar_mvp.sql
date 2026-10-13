-- Calendar MVP authorization. Apply manually after review; do not run from the client.

create index if not exists idx_events_family_start
  on public.events (family_id, start_at asc)
  where deleted_at is null;

revoke all on public.events from public, anon, authenticated;
grant select, insert, update on public.events to authenticated;

alter table public.events enable row level security;

drop policy if exists "events_active_members_select" on public.events;
drop policy if exists "events_active_members_insert" on public.events;
drop policy if exists "events_creator_update" on public.events;

create policy "events_active_members_select"
on public.events
for select
using (
  deleted_at is null
  and public.is_active_family_member(family_id, auth.uid())
);

create policy "events_active_members_insert"
on public.events
for insert
with check (
  created_by = auth.uid()
  and public.is_active_family_member(family_id, auth.uid())
);

create policy "events_creator_update"
on public.events
for update
using (
  created_by = auth.uid()
  and deleted_at is null
  and public.is_active_family_member(family_id, auth.uid())
)
with check (
  created_by = auth.uid()
  and public.is_active_family_member(family_id, auth.uid())
);

create or replace function public.prevent_event_ownership_change()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.family_id <> old.family_id or new.created_by <> old.created_by then
    raise exception using errcode = '42501', message = 'Event ownership cannot be changed';
  end if;
  return new;
end;
$$;

drop trigger if exists events_immutable_ownership on public.events;
create trigger events_immutable_ownership
before update on public.events
for each row execute function public.prevent_event_ownership_change();

revoke all on function public.prevent_event_ownership_change() from public, anon, authenticated;