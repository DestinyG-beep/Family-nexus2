alter table public.media
  add column if not exists upload_complete boolean not null default true;

create index if not exists idx_media_family_created
  on public.media (family_id, created_at desc)
  where deleted_at is null and upload_complete = true;

alter table public.media enable row level security;
alter table public.media_likes enable row level security;
alter table public.media_pins enable row level security;

revoke all on public.media, public.media_likes, public.media_pins from public, anon, authenticated;
grant select, delete on public.media to authenticated;
grant update (deleted_at, deleted_by) on public.media to authenticated;
grant select, insert, delete on public.media_likes to authenticated;
grant select, insert, delete on public.media_pins to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'family-media',
  'family-media',
  false,
  52428800,
  array['image/*', 'video/*']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.can_read_family_media_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.media m
    where m.storage_key = p_name
      and m.bucket = 'family-media'
      and m.media_type::text in ('IMAGE', 'VIDEO')
      and m.upload_complete
      and m.deleted_at is null
      and public.is_active_family_member(m.family_id, auth.uid())
  );
$$;

create or replace function public.can_upload_family_media_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.media m
    where m.storage_key = p_name
      and m.bucket = 'family-media'
      and not m.upload_complete
      and m.media_type::text in ('IMAGE', 'VIDEO')
      and m.deleted_at is null
      and m.uploaded_by = auth.uid()
      and public.is_active_family_member(m.family_id, auth.uid())
      and m.storage_key = 'families/' || m.family_id::text || '/media/' || m.id::text
  );
$$;

create or replace function public.can_delete_family_media_object(p_name text)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.media m
    where m.storage_key = p_name
      and m.bucket = 'family-media'
      and m.media_type::text in ('IMAGE', 'VIDEO')
      and public.is_active_family_member(m.family_id, auth.uid())
      and (
        m.uploaded_by = auth.uid()
        or exists (
          select 1
          from public.family_members fm
          where fm.family_id = m.family_id
            and fm.user_id = auth.uid()
            and fm.status = 'ACTIVE'
            and fm.role::text in ('SUPERADMIN', 'ADMIN')
        )
      )
  );
$$;

create or replace function public.get_family_media(p_family_id uuid)
returns table (
  id uuid,
  family_id uuid,
  uploaded_by uuid,
  uploader_name text,
  bucket text,
  storage_key text,
  media_type text,
  mime_type text,
  file_name text,
  file_size bigint,
  width integer,
  height integer,
  duration_seconds integer,
  created_at timestamptz,
  like_count bigint,
  liked_by_me boolean,
  is_pinned boolean
)
language plpgsql
stable
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
  select
    m.id,
    m.family_id,
    m.uploaded_by,
    coalesce(p.name, 'Family member'),
    m.bucket,
    m.storage_key,
    m.media_type::text,
    m.mime_type,
    m.file_name,
    m.file_size,
    m.width,
    m.height,
    m.duration_seconds,
    m.created_at,
    coalesce(likes.total, 0)::bigint,
    coalesce(likes.liked_by_me, false),
    coalesce(pins.is_pinned, false)
  from public.media m
  left join public.profiles p on p.id = m.uploaded_by
  left join lateral (
    select
      count(*)::bigint as total,
      bool_or(ml.user_id = auth.uid()) as liked_by_me
    from public.media_likes ml
    where ml.media_id = m.id
  ) likes on true
  left join lateral (
    select bool_or(true) as is_pinned
    from public.media_pins mp
    where mp.media_id = m.id
  ) pins on true
  where m.family_id = p_family_id
    and m.bucket = 'family-media'
    and m.media_type::text in ('IMAGE', 'VIDEO')
    and m.deleted_at is null
    and m.upload_complete
  order by m.created_at desc
  limit 200;
end;
$$;

create or replace function public.begin_family_media_upload(
  p_family_id uuid,
  p_media_type text,
  p_mime_type text,
  p_file_name text,
  p_file_size bigint,
  p_width integer default null,
  p_height integer default null,
  p_duration_seconds integer default null
)
returns table (media_id uuid, bucket_id text, storage_key text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_media_id uuid := gen_random_uuid();
  v_media_type public.media_type;
  v_mime_type text := lower(trim(coalesce(p_mime_type, '')));
  v_file_name text := left(coalesce(nullif(trim(p_file_name), ''), 'Family upload'), 255);
  v_storage_key text;
begin
  if v_user_id is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  if not public.is_active_family_member(p_family_id, v_user_id) then
    raise exception using errcode = '42501', message = 'Active family membership required';
  end if;

  if p_media_type is null or upper(p_media_type) not in ('IMAGE', 'VIDEO') then
    raise exception using errcode = '22023', message = 'Only images and videos are supported';
  end if;

  if p_file_size is null or p_file_size < 1 or p_file_size > 52428800 then
    raise exception using errcode = '22023', message = 'Media files must be smaller than 50 MB';
  end if;

  if (upper(p_media_type) = 'IMAGE' and v_mime_type not in (
        'image/jpeg', 'image/png', 'image/webp', 'image/gif',
        'image/heic', 'image/heif', 'image/avif'
      ))
     or (upper(p_media_type) = 'VIDEO' and v_mime_type not in (
        'video/mp4', 'video/quicktime', 'video/webm',
        'video/x-m4v', 'video/3gpp', 'video/3gpp2'
      )) then
    raise exception using errcode = '22023', message = 'This image or video format is not supported';
  end if;

  if (p_width is not null and p_width < 0)
     or (p_height is not null and p_height < 0)
     or (p_duration_seconds is not null and p_duration_seconds < 0) then
    raise exception using errcode = '22023', message = 'Media details are invalid';
  end if;

  v_media_type := upper(p_media_type)::public.media_type;
  v_storage_key := 'families/' || p_family_id::text || '/media/' || v_media_id::text;

  insert into public.media (
    id,
    family_id,
    uploaded_by,
    bucket,
    storage_key,
    media_type,
    mime_type,
    file_name,
    file_size,
    width,
    height,
    duration_seconds,
    upload_complete
  )
  values (
    v_media_id,
    p_family_id,
    v_user_id,
    'family-media',
    v_storage_key,
    v_media_type,
    v_mime_type,
    v_file_name,
    p_file_size,
    p_width,
    p_height,
    p_duration_seconds,
    false
  );

  return query select v_media_id, 'family-media'::text, v_storage_key;
end;
$$;

create or replace function public.complete_family_media_upload(p_media_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  if exists (
    select 1
    from public.media m
    join storage.objects o on o.bucket_id = m.bucket and o.name = m.storage_key
    where m.id = p_media_id
      and m.uploaded_by = auth.uid()
      and m.upload_complete
      and m.deleted_at is null
      and public.is_active_family_member(m.family_id, auth.uid())
  ) then
    return true;
  end if;

  update public.media m
  set upload_complete = true
  where m.id = p_media_id
    and m.uploaded_by = auth.uid()
    and not m.upload_complete
    and m.deleted_at is null
    and public.is_active_family_member(m.family_id, auth.uid())
    and exists (
      select 1
      from storage.objects o
      where o.bucket_id = m.bucket
        and o.name = m.storage_key
    );

  if not found then
    raise exception using errcode = 'P0002', message = 'Uploaded media was not found';
  end if;

  return true;
end;
$$;

create or replace function public.cancel_family_media_upload(p_media_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, storage, pg_temp
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  delete from public.media m
  where m.id = p_media_id
    and m.uploaded_by = auth.uid()
    and not m.upload_complete
    and m.deleted_at is null
    and public.is_active_family_member(m.family_id, auth.uid())
    and not exists (
      select 1
      from storage.objects o
      where o.bucket_id = m.bucket
        and o.name = m.storage_key
    );

  if not found and exists (
    select 1
    from public.media m
    where m.id = p_media_id
      and m.uploaded_by = auth.uid()
      and not m.upload_complete
      and m.deleted_at is null
  ) then
    raise exception using errcode = '55000', message = 'Temporary media file still exists';
  end if;

  return true;
end;
$$;

create or replace function public.delete_family_media(p_media_id uuid)
returns table (bucket text, storage_key text)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_bucket text;
  v_storage_key text;
begin
  if auth.uid() is null then
    raise exception using errcode = '28000', message = 'Authentication required';
  end if;

  update public.media m
  set deleted_at = now(),
      deleted_by = auth.uid()
  where m.id = p_media_id
    and m.bucket = 'family-media'
    and m.media_type::text in ('IMAGE', 'VIDEO')
    and m.upload_complete
    and m.deleted_at is null
    and public.is_active_family_member(m.family_id, auth.uid())
    and (
      m.uploaded_by = auth.uid()
      or exists (
        select 1
        from public.family_members fm
        where fm.family_id = m.family_id
          and fm.user_id = auth.uid()
          and fm.status = 'ACTIVE'
          and fm.role::text in ('SUPERADMIN', 'ADMIN')
      )
    )
  returning m.bucket, m.storage_key into v_bucket, v_storage_key;

  if not found then
    raise exception using errcode = '42501', message = 'Media could not be deleted';
  end if;

  return query select v_bucket, v_storage_key;
end;
$$;

revoke all on function public.can_read_family_media_object(text) from public, anon, authenticated;
revoke all on function public.can_upload_family_media_object(text) from public, anon, authenticated;
revoke all on function public.can_delete_family_media_object(text) from public, anon, authenticated;
revoke all on function public.get_family_media(uuid) from public, anon, authenticated;
revoke all on function public.begin_family_media_upload(uuid, text, text, text, bigint, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.complete_family_media_upload(uuid) from public, anon, authenticated;
revoke all on function public.cancel_family_media_upload(uuid) from public, anon, authenticated;
revoke all on function public.delete_family_media(uuid) from public, anon, authenticated;
grant execute on function public.can_read_family_media_object(text) to authenticated;
grant execute on function public.can_upload_family_media_object(text) to authenticated;
grant execute on function public.can_delete_family_media_object(text) to authenticated;
grant execute on function public.get_family_media(uuid) to authenticated;
grant execute on function public.begin_family_media_upload(uuid, text, text, text, bigint, integer, integer, integer) to authenticated;
grant execute on function public.complete_family_media_upload(uuid) to authenticated;
grant execute on function public.cancel_family_media_upload(uuid) to authenticated;
grant execute on function public.delete_family_media(uuid) to authenticated;

drop policy if exists "family_media_member_select" on public.media;
drop policy if exists "family_media_authorized_soft_delete" on public.media;
drop policy if exists "family_media_owner_delete_pending" on public.media;
drop policy if exists "family_media_likes_member_select" on public.media_likes;
drop policy if exists "family_media_likes_self_insert" on public.media_likes;
drop policy if exists "family_media_likes_self_delete" on public.media_likes;
drop policy if exists "family_media_pins_member_select" on public.media_pins;
drop policy if exists "family_media_pins_admin_insert" on public.media_pins;
drop policy if exists "family_media_pins_admin_delete" on public.media_pins;

create policy "family_media_member_select"
on public.media for select to authenticated
using (
  bucket = 'family-media'
  and media_type::text in ('IMAGE', 'VIDEO')
  and upload_complete
  and deleted_at is null
  and public.is_active_family_member(family_id, auth.uid())
);

create policy "family_media_authorized_soft_delete"
on public.media for update to authenticated
using (
  bucket = 'family-media'
  and media_type::text in ('IMAGE', 'VIDEO')
  and upload_complete
  and deleted_at is null
  and public.is_active_family_member(family_id, auth.uid())
  and (
    uploaded_by = auth.uid()
    or exists (
      select 1
      from public.family_members fm
      where fm.family_id = media.family_id
        and fm.user_id = auth.uid()
        and fm.status = 'ACTIVE'
        and fm.role::text in ('SUPERADMIN', 'ADMIN')
    )
  )
)
with check (
  bucket = 'family-media'
  and media_type::text in ('IMAGE', 'VIDEO')
  and upload_complete
  and deleted_at is not null
  and deleted_by = auth.uid()
  and public.is_active_family_member(family_id, auth.uid())
);

create policy "family_media_owner_delete_pending"
on public.media for delete to authenticated
using (
  bucket = 'family-media'
  and media_type::text in ('IMAGE', 'VIDEO')
  and not upload_complete
  and deleted_at is null
  and uploaded_by = auth.uid()
  and public.is_active_family_member(family_id, auth.uid())
);

create policy "family_media_likes_member_select"
on public.media_likes for select to authenticated
using (
  exists (
    select 1
    from public.media m
    where m.id = media_likes.media_id
      and m.bucket = 'family-media'
      and m.media_type::text in ('IMAGE', 'VIDEO')
      and m.deleted_at is null
      and m.upload_complete
      and public.is_active_family_member(m.family_id, auth.uid())
  )
);

create policy "family_media_likes_self_insert"
on public.media_likes for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (
    select 1
    from public.media m
    where m.id = media_likes.media_id
      and m.bucket = 'family-media'
      and m.media_type::text in ('IMAGE', 'VIDEO')
      and m.deleted_at is null
      and m.upload_complete
      and public.is_active_family_member(m.family_id, auth.uid())
  )
);

create policy "family_media_likes_self_delete"
on public.media_likes for delete to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1
    from public.media m
    where m.id = media_likes.media_id
      and m.bucket = 'family-media'
      and m.media_type::text in ('IMAGE', 'VIDEO')
      and m.deleted_at is null
      and m.upload_complete
      and public.is_active_family_member(m.family_id, auth.uid())
  )
);

create policy "family_media_pins_member_select"
on public.media_pins for select to authenticated
using (
  exists (
    select 1
    from public.media m
    where m.id = media_pins.media_id
      and m.bucket = 'family-media'
      and m.media_type::text in ('IMAGE', 'VIDEO')
      and m.deleted_at is null
      and m.upload_complete
      and public.is_active_family_member(m.family_id, auth.uid())
  )
);

create policy "family_media_pins_admin_insert"
on public.media_pins for insert to authenticated
with check (
  pinned_by = auth.uid()
  and exists (
    select 1
    from public.media m
    join public.family_members fm on fm.family_id = m.family_id
    where m.id = media_pins.media_id
      and m.bucket = 'family-media'
      and m.media_type::text in ('IMAGE', 'VIDEO')
      and m.deleted_at is null
      and m.upload_complete
      and fm.user_id = auth.uid()
      and fm.status = 'ACTIVE'
      and fm.role::text in ('SUPERADMIN', 'ADMIN')
  )
);

create policy "family_media_pins_admin_delete"
on public.media_pins for delete to authenticated
using (
  exists (
    select 1
    from public.media m
    join public.family_members fm on fm.family_id = m.family_id
    where m.id = media_pins.media_id
      and m.bucket = 'family-media'
      and m.media_type::text in ('IMAGE', 'VIDEO')
      and m.deleted_at is null
      and m.upload_complete
      and fm.user_id = auth.uid()
      and fm.status = 'ACTIVE'
      and fm.role::text in ('SUPERADMIN', 'ADMIN')
  )
);

drop policy if exists "family_media_private_select" on storage.objects;
drop policy if exists "family_media_pending_insert" on storage.objects;
drop policy if exists "family_media_authorized_delete" on storage.objects;

create policy "family_media_private_select"
on storage.objects for select to authenticated
using (
  bucket_id = 'family-media'
  and public.can_read_family_media_object(name)
);

create policy "family_media_pending_insert"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'family-media'
  and public.can_upload_family_media_object(name)
);

create policy "family_media_authorized_delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'family-media'
  and public.can_delete_family_media_object(name)
);