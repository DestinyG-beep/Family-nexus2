
-- Private profile avatars. Apply manually after review; do not run from the client.

create table if not exists public.profile_avatars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  bucket text not null default 'profile-avatars',
  storage_key text not null unique,
  mime_type text not null,
  file_size bigint not null,
  upload_complete boolean not null default false,
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.profile_avatars
  add column if not exists upload_complete boolean not null default false;

do $$
begin
  if exists (
    select 1
    from pg_constraint c
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = any(c.conkey)
    where c.conrelid = 'public.profiles'::regclass
      and c.contype = 'f'
      and a.attname = 'avatar_media_id'
      and c.confrelid <> 'public.profile_avatars'::regclass
  ) then
    raise exception
      'profiles.avatar_media_id already references a different table; review avatar compatibility before applying migration 008';
  end if;
end;
$$;

revoke all on public.profile_avatars from public, anon, authenticated;
alter table public.profile_avatars enable row level security;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'profile-avatars',
  'profile-avatars',
  false,
  10485760,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif'
  ]::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_read_profile_avatar_object(p_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_owner_id uuid;
begin
  if auth.uid() is null
     or p_name is null
     or split_part(p_name, '/', 1) !~* '^[0-9a-f-]{36}$'
  then
    return false;
  end if;

  v_owner_id := split_part(p_name, '/', 1)::uuid;

  return exists (
    select 1
    from public.profile_avatars pa
    where pa.user_id = v_owner_id
      and pa.storage_key = p_name
      and pa.bucket = 'profile-avatars'
      and pa.deleted_at is null
      and pa.upload_complete
      and (
        pa.user_id = auth.uid()
        or exists (
          select 1
          from public.family_members viewer
          join public.family_members owner_member
            on owner_member.family_id = viewer.family_id
           and owner_member.user_id = pa.user_id
          where viewer.user_id = auth.uid()
            and viewer.status = 'ACTIVE'
            and owner_member.status = 'ACTIVE'
        )
      )
      and exists (
        select 1
        from public.profiles current_profile
        where current_profile.id = pa.user_id
          and current_profile.avatar_media_id = pa.id
      )
  );
exception
  when others then
    return false;
end;
$$;

create or replace function public.can_upload_profile_avatar_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profile_avatars pa
    where pa.user_id = auth.uid()
      and pa.storage_key = p_name
      and pa.bucket = 'profile-avatars'
      and not pa.upload_complete
      and pa.deleted_at is null
      and p_name like auth.uid()::text || '/%'
  );
$$;

drop policy if exists "profile_avatars_objects_select"
  on storage.objects;

drop policy if exists "profile_avatars_objects_insert"
  on storage.objects;

drop policy if exists "profile_avatars_objects_update"
  on storage.objects;

drop policy if exists "profile_avatars_objects_delete"
  on storage.objects;

create policy "profile_avatars_objects_select"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'profile-avatars'
  and public.can_read_profile_avatar_object(name)
);

create policy "profile_avatars_objects_insert"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'profile-avatars'
  and public.can_upload_profile_avatar_object(name)
);

create policy "profile_avatars_objects_update"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'profile-avatars'
  and owner_id = auth.uid()::text
)
with check (
  bucket_id = 'profile-avatars'
  and owner_id = auth.uid()::text
);

create policy "profile_avatars_objects_delete"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'profile-avatars'
  and owner_id = auth.uid()::text
);

create or replace function public.begin_profile_avatar_upload(
  p_mime_type text,
  p_file_size bigint
)
returns table (
  avatar_id uuid,
  bucket_id text,
  storage_key text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_avatar_id uuid := gen_random_uuid();
  v_mime text := lower(trim(coalesce(p_mime_type, '')));
  v_extension text;
  v_key text;
begin
  if v_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'Authentication required';
  end if;

  if v_mime not in (
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif'
  ) then
    raise exception using
      errcode = '22023',
      message = 'Only supported image avatars are allowed';
  end if;

  if p_file_size is null
     or p_file_size < 1
     or p_file_size > 10485760
  then
    raise exception using
      errcode = '22023',
      message = 'Avatar files must be 10 MB or smaller';
  end if;

  v_extension := case v_mime
    when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png'
    when 'image/webp' then 'webp'
    when 'image/gif' then 'gif'
    when 'image/heic' then 'heic'
    when 'image/heif' then 'heif'
  end;

  v_key :=
    v_user_id::text || '/' ||
    v_avatar_id::text || '.' ||
    v_extension;

  insert into public.profile_avatars (
    id,
    user_id,
    storage_key,
    mime_type,
    file_size
  )
  values (
    v_avatar_id,
    v_user_id,
    v_key,
    v_mime,
    p_file_size
  );

  return query
  select
    v_avatar_id,
    'profile-avatars'::text,
    v_key;
end;
$$;

create or replace function public.complete_profile_avatar_upload(
  p_avatar_id uuid
)
returns table (
  avatar_id uuid,
  storage_key text,
  previous_storage_key text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_avatar public.profile_avatars%rowtype;
  v_previous_id uuid;
  v_previous_key text;
begin
  if auth.uid() is null then
    raise exception using
      errcode = '28000',
      message = 'Authentication required';
  end if;

  select *
  into v_avatar
  from public.profile_avatars
  where id = p_avatar_id
    and user_id = auth.uid()
    and deleted_at is null
  for update;

  if not found then
    raise exception using
      errcode = '42501',
      message = 'Avatar upload is not available';
  end if;

  if not exists (
    select 1
    from storage.objects so
    where so.bucket_id = v_avatar.bucket
      and so.name = v_avatar.storage_key
  ) then
    raise exception using
      errcode = '22023',
      message = 'Avatar file was not uploaded';
  end if;

  select
    p.avatar_media_id,
    previous_avatar.storage_key
  into
    v_previous_id,
    v_previous_key
  from public.profiles p
  left join public.profile_avatars previous_avatar
    on previous_avatar.id = p.avatar_media_id
  where p.id = auth.uid()
  for update;

  update public.profile_avatars
  set upload_complete = true
  where id = v_avatar.id;

  update public.profiles
  set avatar_media_id = v_avatar.id,
      updated_at = now()
  where id = auth.uid();

  if v_previous_id is not null then
    update public.profile_avatars
    set deleted_at = now()
    where id = v_previous_id
      and user_id = auth.uid()
      and id <> v_avatar.id;
  end if;

  return query
  select
    v_avatar.id,
    v_avatar.storage_key,
    v_previous_key;
end;
$$;

create or replace function public.get_profile_avatar(
  p_user_id uuid
)
returns table (
  avatar_id uuid,
  storage_key text,
  mime_type text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or p_user_id is null then
    raise exception using
      errcode = '28000',
      message = 'Authentication required';
  end if;

  return query
  select
    pa.id,
    pa.storage_key,
    pa.mime_type
  from public.profiles p
  join public.profile_avatars pa
    on pa.id = p.avatar_media_id
  where p.id = p_user_id
    and p.avatar_media_id = pa.id
    and pa.deleted_at is null
    and pa.upload_complete
    and (
      p_user_id = auth.uid()
      or exists (
        select 1
        from public.family_members viewer
        join public.family_members owner_member
          on owner_member.family_id = viewer.family_id
         and owner_member.user_id = p_user_id
        where viewer.user_id = auth.uid()
          and viewer.status = 'ACTIVE'
          and owner_member.status = 'ACTIVE'
      )
    );
end;
$$;

revoke all on function
  public.can_read_profile_avatar_object(text)
from public, anon, authenticated;

revoke all on function
  public.can_upload_profile_avatar_object(text)
from public, anon, authenticated;

revoke all on function
  public.begin_profile_avatar_upload(text, bigint)
from public, anon, authenticated;

revoke all on function
  public.complete_profile_avatar_upload(uuid)
from public, anon, authenticated;

revoke all on function
  public.get_profile_avatar(uuid)
from public, anon, authenticated;

grant execute on function
  public.can_read_profile_avatar_object(text)
to authenticated;

grant execute on function
  public.can_upload_profile_avatar_object(text)
to authenticated;

grant execute on function
  public.begin_profile_avatar_upload(text, bigint)
to authenticated;

grant execute on function
  public.complete_profile_avatar_upload(uuid)
to authenticated;

grant execute on function
  public.get_profile_avatar(uuid)
to authenticated;

drop function if exists public.get_family_admin_members(uuid);

create function public.get_family_admin_members(
  p_family_id uuid
)
returns table (
  id uuid,
  user_id uuid,
  member_name text,
  email text,
  role text,
  status text,
  joined_at timestamptz,
  avatar_storage_key text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception using
      errcode = '28000',
      message = 'Authentication required';
  end if;

  if not exists (
    select 1
    from public.family_members fm
    where fm.family_id = p_family_id
      and fm.user_id = auth.uid()
      and fm.status = 'ACTIVE'
      and fm.role in ('SUPERADMIN', 'ADMIN')
  ) then
    raise exception using
      errcode = '42501',
      message = 'Family Admin access required';
  end if;

  return query
  select
    fm.id,
    fm.user_id,
    coalesce(p.name, 'Family member'),
    p.email,
    fm.role::text,
    fm.status::text,
    fm.joined_at,
    pa.storage_key
  from public.family_members fm
  left join public.profiles p
    on p.id = fm.user_id
  left join public.profile_avatars pa
    on pa.id = p.avatar_media_id
   and pa.deleted_at is null
   and pa.upload_complete
  where fm.family_id = p_family_id
    and fm.status <> 'REMOVED'
  order by
    case
      when fm.role = 'SUPERADMIN' then 0
      when fm.role = 'ADMIN' then 1
      else 2
    end,
    fm.joined_at,
    p.name;
end;
$$;

drop function if exists public.get_family_member_directory(uuid);

create function public.get_family_member_directory(
  p_family_id uuid
)
returns table (
  member_id uuid,
  member_name text,
  role text,
  avatar_storage_key text
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null
     or not public.is_active_family_member(
       p_family_id,
       auth.uid()
     )
  then
    raise exception using
      errcode = '42501',
      message = 'Active family membership required';
  end if;

  return query
  select
    fm.id,
    coalesce(p.name, 'Family member'),
    fm.role::text,
    pa.storage_key
  from public.family_members fm
  left join public.profiles p
    on p.id = fm.user_id
  left join public.profile_avatars pa
    on pa.id = p.avatar_media_id
   and pa.deleted_at is null
   and pa.upload_complete
  where fm.family_id = p_family_id
    and fm.status = 'ACTIVE'
  order by
    fm.joined_at,
    p.name;
end;
$$;

revoke all on function
  public.get_family_admin_members(uuid)
from public, anon, authenticated;

revoke all on function
  public.get_family_member_directory(uuid)
from public, anon, authenticated;

grant execute on function
  public.get_family_admin_members(uuid)
to authenticated;

grant execute on function
  public.get_family_member_directory(uuid)
to authenticated;
