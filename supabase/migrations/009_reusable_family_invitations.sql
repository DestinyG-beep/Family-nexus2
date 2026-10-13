-- Reusable family invitation links. Apply manually after review.

create or replace function public.create_reusable_family_invitation(
  p_family_id uuid,
  p_expires_in_days integer default 7
)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_token text := encode(gen_random_bytes(32), 'hex');
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;
  if p_expires_in_days is null or p_expires_in_days < 1 or p_expires_in_days > 30 then
    raise exception using errcode = '22023', message = 'Invitation expiry must be between 1 and 30 days';
  end if;
  if not exists (
    select 1 from public.family_members fm
    where fm.family_id = p_family_id and fm.user_id = v_user_id
      and fm.status = 'ACTIVE' and fm.role in ('SUPERADMIN', 'ADMIN')
  ) then
    raise exception using errcode = '42501', message = 'Only family admins can create invitations';
  end if;

  update public.family_invitations
  set status = 'REVOKED'
  where family_id = p_family_id and status = 'ACTIVE';

  insert into public.family_invitations (family_id, created_by, token_hash, expires_at, max_uses, status)
  values (p_family_id, v_user_id, encode(digest(v_token, 'sha256'), 'hex'), now() + make_interval(days => p_expires_in_days), 2147483647, 'ACTIVE');

  return v_token;
end;
$$;

create or replace function public.revoke_family_invitations(p_family_id uuid)
returns jsonb
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
    raise exception using errcode = '42501', message = 'Only family admins can revoke invitations';
  end if;

  update public.family_invitations set status = 'REVOKED'
  where family_id = p_family_id and status = 'ACTIVE';
  return jsonb_build_object('status', 'revoked');
end;
$$;

create or replace function public.join_family_with_reusable_invitation_password(p_token text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_invitation public.family_invitations%rowtype;
  v_family public.families%rowtype;
  v_existing public.family_members%rowtype;
  v_member_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;
  if p_token is null or length(trim(p_token)) < 32 or p_password is null then
    return jsonb_build_object('status', 'invalid_invitation');
  end if;

  select * into v_invitation
  from public.family_invitations
  where token_hash = encode(digest(trim(p_token), 'sha256'), 'hex')
  for update;
  if not found or v_invitation.max_uses <> 2147483647 then
    return jsonb_build_object('status', 'invalid_invitation');
  end if;
  if v_invitation.status = 'REVOKED' then
    return jsonb_build_object('status', 'invalid_invitation');
  end if;
  if v_invitation.status = 'EXPIRED' or v_invitation.expires_at <= now() then
    return jsonb_build_object('status', 'invitation_expired');
  end if;

  select * into v_family
  from public.families
  where id = v_invitation.family_id and deleted_at is null
  for update;
  if not found then
    return jsonb_build_object('status', 'invalid_invitation');
  end if;

  select * into v_existing
  from public.family_members
  where family_id = v_family.id and user_id = v_user_id
  for update;
  if found and v_existing.status = 'ACTIVE' then
    return jsonb_build_object('status', 'already_member');
  end if;
  if found and v_existing.status = 'RESTRICTED' then
    return jsonb_build_object('status', 'restricted');
  end if;

  if length(p_password) < 8 or crypt(p_password, v_family.password_hash) <> v_family.password_hash then
    return jsonb_build_object('status', 'invalid_password');
  end if;

  select count(*) into v_member_count
  from public.family_members
  where family_id = v_family.id and status <> 'REMOVED';
  if v_member_count >= v_family.member_limit then
    return jsonb_build_object('status', 'family_full');
  end if;

  if v_existing.id is not null then
    update public.family_members
    set role = 'MEMBER', status = 'ACTIVE', joined_at = now(), removed_at = null, removed_by = null, updated_at = now()
    where id = v_existing.id;
  else
    insert into public.family_members (family_id, user_id, role, status, joined_at, created_at, updated_at)
    values (v_family.id, v_user_id, 'MEMBER', 'ACTIVE', now(), now(), now());
  end if;

  return jsonb_build_object(
    'status', 'joined', 'family_id', v_family.id, 'family_name', v_family.name,
    'role', 'MEMBER', 'member_count', v_member_count + 1, 'member_limit', v_family.member_limit
  );
end;
$$;

revoke all on function public.create_reusable_family_invitation(uuid, integer) from public, anon, authenticated;
revoke all on function public.revoke_family_invitations(uuid) from public, anon, authenticated;
revoke all on function public.join_family_with_reusable_invitation_password(text, text) from public, anon, authenticated;
grant execute on function public.create_reusable_family_invitation(uuid, integer) to authenticated;
grant execute on function public.revoke_family_invitations(uuid) to authenticated;
grant execute on function public.join_family_with_reusable_invitation_password(text, text) to authenticated;