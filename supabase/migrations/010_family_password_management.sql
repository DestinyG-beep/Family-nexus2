-- Secure family password change and reset flows. Apply manually after migration 009.

create or replace function public.change_family_password(
  p_family_id uuid,
  p_current_password text,
  p_new_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_family public.families%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  select * into v_family
  from public.families
  where id = p_family_id and deleted_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Family unavailable';
  end if;

  if v_family.owner_id <> v_user_id or not exists (
    select 1
    from public.family_members fm
    where fm.family_id = p_family_id
      and fm.user_id = v_user_id
      and fm.role = 'SUPERADMIN'
      and fm.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'Primary Admin required';
  end if;

  if p_current_password is null or crypt(p_current_password, v_family.password_hash) <> v_family.password_hash then
    raise exception using errcode = '22023', message = 'Current family password is incorrect';
  end if;

  if p_new_password is null or length(p_new_password) < 8 then
    raise exception using errcode = '22023', message = 'Family password must be at least 8 characters long';
  end if;

  update public.families
  set password_hash = crypt(p_new_password, gen_salt('bf')), updated_at = now()
  where id = p_family_id;

  insert into public.audit_logs (family_id, actor_id, action, target_type, target_id, metadata)
  values (p_family_id, v_user_id, 'family_password_changed', 'family', p_family_id, '{}'::jsonb);

  return jsonb_build_object('status', 'updated');
end;
$$;

create or replace function public.reset_family_password(
  p_family_id uuid,
  p_new_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_family public.families%rowtype;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  select * into v_family
  from public.families
  where id = p_family_id and deleted_at is null
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'Family unavailable';
  end if;

  if v_family.owner_id <> v_user_id or not exists (
    select 1
    from public.family_members fm
    where fm.family_id = p_family_id
      and fm.user_id = v_user_id
      and fm.role = 'SUPERADMIN'
      and fm.status = 'ACTIVE'
  ) then
    raise exception using errcode = '42501', message = 'Primary Admin required';
  end if;

  if p_new_password is null or length(p_new_password) < 8 then
    raise exception using errcode = '22023', message = 'Family password must be at least 8 characters long';
  end if;

  update public.families
  set password_hash = crypt(p_new_password, gen_salt('bf')), updated_at = now()
  where id = p_family_id;

  insert into public.audit_logs (family_id, actor_id, action, target_type, target_id, metadata)
  values (p_family_id, v_user_id, 'family_password_reset', 'family', p_family_id, '{}'::jsonb);

  return jsonb_build_object('status', 'reset');
end;
$$;

revoke all on function public.change_family_password(uuid, text, text) from public, anon, authenticated;
revoke all on function public.reset_family_password(uuid, text) from public, anon, authenticated;
grant execute on function public.change_family_password(uuid, text, text) to authenticated;
grant execute on function public.reset_family_password(uuid, text) to authenticated;