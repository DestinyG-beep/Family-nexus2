revoke all on function public.join_family_with_invitation(text) from public, anon, authenticated;

create or replace function public.join_family_with_invitation_password(p_token text, p_password text)
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
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  if p_token is null or length(trim(p_token)) < 32 or p_password is null then
    return jsonb_build_object('status', 'invalid_invitation');
  end if;

  select *
  into v_invitation
  from public.family_invitations fi
  where fi.token_hash = encode(digest(trim(p_token), 'sha256'), 'hex');

  if not found then
    return jsonb_build_object('status', 'invalid_invitation');
  end if;

  select *
  into v_family
  from public.families f
  where f.id = v_invitation.family_id
    and f.deleted_at is null;

  if not found then
    return jsonb_build_object('status', 'invalid_invitation');
  end if;

  select *
  into v_existing
  from public.family_members fm
  where fm.family_id = v_family.id
    and fm.user_id = v_user_id;

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

  if length(p_password) < 8 or crypt(p_password, v_family.password_hash) <> v_family.password_hash then
    return jsonb_build_object('status', 'invalid_password');
  end if;

  return public.join_family_with_invitation(trim(p_token));
end;
$$;

create or replace function public.get_family_member_directory(p_family_id uuid)
returns table(member_name text, role text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  if not public.is_active_family_member(p_family_id, auth.uid()) then
    raise exception using errcode = '42501', message = 'Active family membership required';
  end if;

  return query
  select coalesce(p.name, 'Family member'), fm.role::text
  from public.family_members fm
  left join public.profiles p on p.id = fm.user_id
  where fm.family_id = p_family_id
    and fm.status = 'ACTIVE'
  order by fm.joined_at, p.name;
end;
$$;

revoke all on function public.join_family_with_invitation_password(text, text) from public, anon, authenticated;
grant execute on function public.join_family_with_invitation_password(text, text) to authenticated;
revoke all on function public.get_family_member_directory(uuid) from public, anon, authenticated;
grant execute on function public.get_family_member_directory(uuid) to authenticated;