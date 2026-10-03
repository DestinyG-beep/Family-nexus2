alter table public.family_invitations enable row level security;
revoke all on public.family_invitations from public, anon, authenticated;

create or replace function public.get_family_invitation(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_invitation public.family_invitations%rowtype;
  v_family_name text;
  v_already_member boolean := false;
  v_status text;
begin
  if p_token is null or length(trim(p_token)) < 32 then
    return jsonb_build_object('status', 'invalid');
  end if;

  select *
  into v_invitation
  from public.family_invitations fi
  where fi.token_hash = encode(digest(trim(p_token), 'sha256'), 'hex');

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  select f.name
  into v_family_name
  from public.families f
  where f.id = v_invitation.family_id
    and f.deleted_at is null;

  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  if auth.uid() is not null then
    select exists (
      select 1
      from public.family_members fm
      where fm.family_id = v_invitation.family_id
        and fm.user_id = auth.uid()
        and fm.status = 'ACTIVE'
    ) into v_already_member;
  end if;

  if v_already_member then
    return jsonb_build_object('status', 'already_member', 'family_name', v_family_name);
  end if;

  if v_invitation.status = 'REVOKED' then
    return jsonb_build_object('status', 'revoked');
  end if;

  if v_invitation.status = 'EXPIRED' or v_invitation.expires_at <= now() then
    return jsonb_build_object('status', 'expired');
  end if;

  if v_invitation.status = 'EXHAUSTED' or v_invitation.uses >= v_invitation.max_uses then
    return jsonb_build_object('status', 'exhausted');
  end if;

  v_status := 'valid';

  return jsonb_build_object(
    'status', v_status,
    'family_name', v_family_name
  );
end;
$$;

create or replace function public.create_family_invitation(
  p_family_id uuid,
  p_expires_in_days integer default 7,
  p_max_uses integer default 1
)
returns text
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_token text;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  if p_expires_in_days is null or p_expires_in_days < 1 or p_expires_in_days > 30 then
    raise exception using errcode = '22023', message = 'Invitation expiry must be between 1 and 30 days';
  end if;

  if p_max_uses is null or p_max_uses < 1 or p_max_uses > 100 then
    raise exception using errcode = '22023', message = 'Invitation use limit must be between 1 and 100';
  end if;

  if not exists (
    select 1
    from public.family_members fm
    where fm.family_id = p_family_id
      and fm.user_id = v_user_id
      and fm.status = 'ACTIVE'
      and fm.role in ('SUPERADMIN', 'ADMIN')
  ) then
    raise exception using errcode = '42501', message = 'Only family owners and administrators can create invitations';
  end if;

  if not exists (
    select 1
    from public.families f
    where f.id = p_family_id
      and f.deleted_at is null
  ) then
    raise exception using errcode = 'P0002', message = 'Family not found';
  end if;

  v_token := encode(gen_random_bytes(32), 'hex');

  insert into public.family_invitations (
    family_id,
    created_by,
    token_hash,
    expires_at,
    max_uses,
    status
  )
  values (
    p_family_id,
    v_user_id,
    encode(digest(v_token, 'sha256'), 'hex'),
    now() + make_interval(days => p_expires_in_days),
    p_max_uses,
    'ACTIVE'
  );

  return v_token;
end;
$$;

create or replace function public.join_family_by_credentials(p_family_name text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_family_id uuid;
  v_match_count integer;
  v_family public.families%rowtype;
  v_existing public.family_members%rowtype;
  v_member_count integer;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  if p_family_name is null or length(trim(p_family_name)) < 5 or p_password is null or length(p_password) < 8 then
    return jsonb_build_object('status', 'invalid_credentials');
  end if;

  select count(*), (array_agg(matches.id))[1]
  into v_match_count, v_family_id
  from (
    select f.id
    from public.families f
    where lower(f.name) = lower(trim(p_family_name))
      and f.deleted_at is null
      and crypt(p_password, f.password_hash) = f.password_hash
    limit 2
  ) as matches;

  if v_match_count <> 1 then
    return jsonb_build_object('status', 'invalid_credentials');
  end if;

  select *
  into v_family
  from public.families f
  where f.id = v_family_id
    and f.deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('status', 'invalid_credentials');
  end if;

  select *
  into v_existing
  from public.family_members fm
  where fm.family_id = v_family.id
    and fm.user_id = v_user_id
  for update;

  if found and v_existing.status = 'ACTIVE' then
    return jsonb_build_object('status', 'already_member');
  end if;

  if found and v_existing.status = 'RESTRICTED' then
    return jsonb_build_object('status', 'restricted');
  end if;

  select count(*)
  into v_member_count
  from public.family_members fm
  where fm.family_id = v_family.id
    and fm.status <> 'REMOVED';

  if v_member_count >= v_family.member_limit then
    return jsonb_build_object('status', 'family_full');
  end if;

  if v_existing.id is not null then
    update public.family_members
    set role = 'MEMBER',
        status = 'ACTIVE',
        joined_at = now(),
        removed_at = null,
        removed_by = null,
        updated_at = now()
    where id = v_existing.id;
  else
    insert into public.family_members (family_id, user_id, role, status, joined_at, created_at, updated_at)
    values (v_family.id, v_user_id, 'MEMBER', 'ACTIVE', now(), now(), now());
  end if;

  return jsonb_build_object(
    'status', 'joined',
    'family_id', v_family.id,
    'family_name', v_family.name,
    'role', 'MEMBER',
    'member_count', v_member_count + 1,
    'member_limit', v_family.member_limit
  );
end;
$$;

create or replace function public.join_family_with_invitation(p_token text)
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

  if p_token is null or length(trim(p_token)) < 32 then
    return jsonb_build_object('status', 'invalid_invitation');
  end if;

  select *
  into v_invitation
  from public.family_invitations fi
  where fi.token_hash = encode(digest(trim(p_token), 'sha256'), 'hex')
  for update;

  if not found then
    return jsonb_build_object('status', 'invalid_invitation');
  end if;

  select *
  into v_family
  from public.families f
  where f.id = v_invitation.family_id
    and f.deleted_at is null
  for update;

  if not found then
    return jsonb_build_object('status', 'invalid_invitation');
  end if;

  select *
  into v_existing
  from public.family_members fm
  where fm.family_id = v_family.id
    and fm.user_id = v_user_id
  for update;

  if found and v_existing.status = 'ACTIVE' then
    return jsonb_build_object('status', 'already_member');
  end if;

  if found and v_existing.status = 'RESTRICTED' then
    return jsonb_build_object('status', 'restricted');
  end if;

  if v_invitation.status = 'REVOKED' then
    return jsonb_build_object('status', 'invalid_invitation');
  end if;

  if v_invitation.status = 'EXPIRED' or v_invitation.expires_at <= now() then
    return jsonb_build_object('status', 'invitation_expired');
  end if;

  if v_invitation.status = 'EXHAUSTED' or v_invitation.uses >= v_invitation.max_uses then
    return jsonb_build_object('status', 'invitation_exhausted');
  end if;

  select count(*)
  into v_member_count
  from public.family_members fm
  where fm.family_id = v_family.id
    and fm.status <> 'REMOVED';

  if v_member_count >= v_family.member_limit then
    return jsonb_build_object('status', 'family_full');
  end if;

  if v_existing.id is not null then
    update public.family_members
    set role = 'MEMBER',
        status = 'ACTIVE',
        joined_at = now(),
        removed_at = null,
        removed_by = null,
        updated_at = now()
    where id = v_existing.id;
  else
    insert into public.family_members (family_id, user_id, role, status, joined_at, created_at, updated_at)
    values (v_family.id, v_user_id, 'MEMBER', 'ACTIVE', now(), now(), now());
  end if;

  update public.family_invitations
  set uses = uses + 1,
      status = case when uses + 1 >= max_uses then 'EXHAUSTED'::public.invitation_status else status end
  where id = v_invitation.id;

  return jsonb_build_object(
    'status', 'joined',
    'family_id', v_family.id,
    'family_name', v_family.name,
    'role', 'MEMBER',
    'member_count', v_member_count + 1,
    'member_limit', v_family.member_limit
  );
end;
$$;

revoke all on function public.get_family_invitation(text) from public, anon, authenticated;
grant execute on function public.get_family_invitation(text) to anon, authenticated;
revoke all on function public.create_family_invitation(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.create_family_invitation(uuid, integer, integer) to authenticated;
revoke all on function public.join_family_by_credentials(text, text) from public, anon, authenticated;
grant execute on function public.join_family_by_credentials(text, text) to authenticated;
revoke all on function public.join_family_with_invitation(text) from public, anon, authenticated;
grant execute on function public.join_family_with_invitation(text) to authenticated;