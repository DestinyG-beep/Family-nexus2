-- Cursor pagination for the private family media gallery. Apply manually after migration 010.
create or replace function public.get_family_media_page(
  p_family_id uuid,
  p_limit integer default 30,
  p_before_created_at timestamptz default null,
  p_before_id uuid default null
)
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
  if p_limit is null or p_limit < 1 or p_limit > 50 then
    raise exception using errcode = '22023', message = 'Media page size must be between 1 and 50';
  end if;

  return query
  select m.id, m.family_id, m.uploaded_by, coalesce(p.name, 'Family member'), m.bucket,
    m.storage_key, m.media_type::text, m.mime_type, m.file_name, m.file_size,
    m.width, m.height, m.duration_seconds, m.created_at,
    coalesce(likes.total, 0)::bigint, coalesce(likes.liked_by_me, false), coalesce(pins.is_pinned, false)
  from public.media m
  left join public.profiles p on p.id = m.uploaded_by
  left join lateral (
    select count(*)::bigint as total, bool_or(ml.user_id = auth.uid()) as liked_by_me
    from public.media_likes ml where ml.media_id = m.id
  ) likes on true
  left join lateral (
    select bool_or(true) as is_pinned from public.media_pins mp where mp.media_id = m.id
  ) pins on true
  where m.family_id = p_family_id
    and m.bucket = 'family-media'
    and m.media_type::text in ('IMAGE', 'VIDEO')
    and m.deleted_at is null
    and m.upload_complete
    and (p_before_created_at is null or (m.created_at, m.id) < (p_before_created_at, p_before_id))
  order by m.created_at desc, m.id desc
  limit p_limit;
end;
$$;

revoke all on function public.get_family_media_page(uuid, integer, timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.get_family_media_page(uuid, integer, timestamptz, uuid) to authenticated;