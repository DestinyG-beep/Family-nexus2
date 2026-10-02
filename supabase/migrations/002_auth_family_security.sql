create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, profile_completed, created_at, updated_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'Family member'),
    new.email,
    false,
    now(),
    now()
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.is_active_family_member(p_family_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_members fm
    where fm.family_id = p_family_id
      and fm.user_id = p_user_id
      and fm.status = 'ACTIVE'
  );
$$;

create or replace function public.create_family(p_name text, p_password text, p_member_limit integer)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_member_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if length(trim(p_name)) < 5 then
    raise exception 'Family name must be at least 5 characters long';
  end if;

  if length(trim(p_password)) < 8 then
    raise exception 'Family password must be at least 8 characters long';
  end if;

  if p_member_limit is null or p_member_limit <= 0 then
    raise exception 'Member limit must be a positive integer';
  end if;

  insert into public.families (
    name,
    password_hash,
    member_limit,
    owner_id,
    created_by,
    created_at,
    updated_at
  )
  values (
    trim(p_name),
    crypt(p_password, gen_salt('bf')),
    p_member_limit,
    v_user_id,
    v_user_id,
    now(),
    now()
  )
  returning id into v_family_id;

  insert into public.family_members (
    family_id,
    user_id,
    role,
    status,
    joined_at,
    created_at,
    updated_at
  )
  values (
    v_family_id,
    v_user_id,
    'SUPERADMIN',
    'ACTIVE',
    now(),
    now(),
    now()
  )
  returning id into v_member_id;

  insert into public.family_member_settings (family_member_id, theme, created_at, updated_at)
  values (v_member_id, 'SYSTEM', now(), now());

  insert into public.conversations (family_id, type, created_at)
  values (v_family_id, 'FAMILY', now());

  return v_family_id;
end;
$$;

revoke all on public.profiles from public;
revoke all on public.families from public;
revoke all on public.family_members from public;

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.families to authenticated;
grant select, insert, update on public.family_members to authenticated;

-- Only active family members may read family rows, and password hashes remain hidden from normal queries.
revoke select(password_hash) on public.families from authenticated;
revoke update(password_hash) on public.families from authenticated;

alter table public.profiles enable row level security;
alter table public.families enable row level security;
alter table public.family_members enable row level security;

create policy "profiles_owner_select"
on public.profiles
for select
using (auth.uid() = id);

create policy "profiles_owner_insert"
on public.profiles
for insert
with check (auth.uid() = id);

create policy "profiles_owner_update"
on public.profiles
for update
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "families_active_members_select"
on public.families
for select
using (public.is_active_family_member(id, auth.uid()));

create policy "families_owner_update"
on public.families
for update
using (owner_id = auth.uid())
with check (owner_id = old.owner_id and created_by = old.created_by);

create policy "family_members_active_family_select"
on public.family_members
for select
using (public.is_active_family_member(family_id, auth.uid()));

create policy "family_members_self_update"
on public.family_members
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id and role = old.role);

create policy "family_members_no_client_insert"
on public.family_members
for insert
with check (false);

create policy "family_members_no_client_delete"
on public.family_members
for delete
using (false);
