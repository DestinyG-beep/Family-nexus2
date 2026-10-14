-- Family administration MVP. Review and apply manually after migration 006.

create or replace function public.get_family_settings(p_family_id uuid)
returns table (
  id uuid,
  name text,
  member_limit integer,
  default_background_media_id uuid,
  owner_id uuid
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_active_family_member(p_family_id, auth.uid()) then
    raise exception using errcode = '42501', message = 'Active family membership required';
  end if;

  return query
  select f.id, f.name, f.member_limit, f.default_background_media_id, f.owner_id
  from public.families f
  where f.id = p_family_id and f.deleted_at is null;
end;
$$;

create or replace function public.get_family_admin_members(p_family_id uuid)
returns table (
  id uuid,
  user_id uuid,
  member_name text,
  email text,
  role text,
  status text,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;
  if not exists (
    select 1 from public.family_members fm
    where fm.family_id = p_family_id and fm.user_id = auth.uid()
      and fm.status = 'ACTIVE' and fm.role in ('SUPERADMIN', 'ADMIN')
  ) then
    raise exception using errcode = '42501', message = 'Family Admin access required';
  end if;

  return query
  select fm.id,
    fm.user_id,
    coalesce(p.name, 'Family member'),
    p.email,
    fm.role::text,
    fm.status::text,
    fm.joined_at
  from public.family_members fm
  left join public.profiles p on p.id = fm.user_id
  where fm.family_id = p_family_id
    and fm.status <> 'REMOVED'
  order by case when fm.role = 'SUPERADMIN' then 0 when fm.role = 'ADMIN' then 1 else 2 end,
    fm.joined_at,
    p.name;
end;
$$;

create or replace function public.update_family_member_role(
  p_family_id uuid,
  p_member_id uuid,
  p_role text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.family_members%rowtype;
  v_target public.family_members%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  select * into v_actor
  from public.family_members
  where family_id = p_family_id and user_id = auth.uid() and status = 'ACTIVE'
  for update;

  if not found or v_actor.role not in ('SUPERADMIN', 'ADMIN') then
    raise exception using errcode = '42501', message = 'Family administration access required';
  end if;

  if p_role is null or upper(trim(p_role)) not in ('ADMIN', 'MEMBER') then
    raise exception using errcode = '22023', message = 'Only Admin or Member roles are supported';
  end if;

  select * into v_target
  from public.family_members
  where id = p_member_id and family_id = p_family_id
  for update;

  if not found or v_target.status = 'REMOVED' then
    raise exception using errcode = '22023', message = 'That family member is unavailable';
  end if;

  if v_target.user_id = auth.uid() or v_target.role = 'SUPERADMIN' then
    raise exception using errcode = '42501', message = 'The primary Admin cannot be changed here';
  end if;

  if v_actor.role = 'ADMIN' and (v_target.role <> 'MEMBER' or upper(trim(p_role)) = 'ADMIN') then
    raise exception using errcode = '42501', message = 'Admins can only manage Member status and demotion';
  end if;

  update public.family_members
  set role = upper(trim(p_role))::public.family_role,
      updated_at = now()
  where id = v_target.id;

  insert into public.audit_logs (family_id, actor_id, action, target_type, target_id, metadata)
  values (p_family_id, auth.uid(), 'family_member_role_changed', 'family_member', v_target.id,
    jsonb_build_object('from_role', v_target.role::text, 'to_role', upper(trim(p_role))));

  return jsonb_build_object('status', 'updated');
end;
$$;

create or replace function public.set_family_member_status(
  p_family_id uuid,
  p_member_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.family_members%rowtype;
  v_target public.family_members%rowtype;
  v_status public.family_member_status;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  if p_status is null or upper(trim(p_status)) not in ('ACTIVE', 'RESTRICTED', 'REMOVED') then
    raise exception using errcode = '22023', message = 'Unsupported family member status';
  end if;
  v_status := upper(trim(p_status))::public.family_member_status;

  select * into v_actor
  from public.family_members
  where family_id = p_family_id and user_id = auth.uid() and status = 'ACTIVE'
  for update;

  if not found or v_actor.role not in ('SUPERADMIN', 'ADMIN') then
    raise exception using errcode = '42501', message = 'Family administration access required';
  end if;

  select * into v_target
  from public.family_members
  where id = p_member_id and family_id = p_family_id
  for update;

  if not found or v_target.status = 'REMOVED' then
    raise exception using errcode = '22023', message = 'That family member is unavailable';
  end if;

  if v_target.user_id = auth.uid() or v_target.role = 'SUPERADMIN' then
    raise exception using errcode = '42501', message = 'The primary Admin cannot be changed here';
  end if;

  if v_actor.role = 'ADMIN' and v_target.role <> 'MEMBER' then
    raise exception using errcode = '42501', message = 'Admins can only manage Members';
  end if;

  update public.family_members
  set status = v_status,
      removed_at = case when v_status = 'REMOVED' then now() else null end,
      removed_by = case when v_status = 'REMOVED' then auth.uid() else null end,
      updated_at = now()
  where id = v_target.id;

  insert into public.audit_logs (family_id, actor_id, action, target_type, target_id, metadata)
  values (p_family_id, auth.uid(), 'family_member_status_changed', 'family_member', v_target.id,
    jsonb_build_object('from_status', v_target.status::text, 'to_status', v_status::text));

  return jsonb_build_object('status', 'updated');
end;
$$;

create or replace function public.update_family_settings(
  p_family_id uuid,
  p_name text,
  p_member_limit integer
)
returns table (id uuid, name text, member_limit integer, default_background_media_id uuid, owner_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_family public.families%rowtype;
  v_active_count integer;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  select * into v_family
  from public.families
  where id = p_family_id and deleted_at is null
  for update;

  if not found or v_family.owner_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'Only the primary Admin can edit family settings';
  end if;

  select count(*)::integer into v_active_count
  from public.family_members
  where family_id = p_family_id and status <> 'REMOVED';

  if p_name is null or length(trim(p_name)) < 5 then
    raise exception using errcode = '22023', message = 'Family name must be at least 5 characters long';
  end if;
  if p_member_limit is null or p_member_limit < v_active_count then
    raise exception using errcode = '22023', message = 'Member limit cannot be below the current member count';
  end if;

  update public.families
  set name = trim(p_name), member_limit = p_member_limit, updated_at = now()
  where id = p_family_id;

  insert into public.audit_logs (family_id, actor_id, action, target_type, target_id, metadata)
  values (p_family_id, auth.uid(), 'family_settings_changed', 'family', p_family_id,
    jsonb_build_object('name', trim(p_name), 'member_limit', p_member_limit));

  return query
  select f.id, f.name, f.member_limit, f.default_background_media_id, f.owner_id
  from public.families f where f.id = p_family_id;
end;
$$;

revoke all on function public.get_family_settings(uuid) from public, anon, authenticated;
revoke all on function public.get_family_admin_members(uuid) from public, anon, authenticated;
revoke all on function public.update_family_member_role(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.set_family_member_status(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.update_family_settings(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.get_family_settings(uuid) to authenticated;
grant execute on function public.get_family_admin_members(uuid) to authenticated;
grant execute on function public.update_family_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.set_family_member_status(uuid, uuid, text) to authenticated;
grant execute on function public.update_family_settings(uuid, text, integer) to authenticated;