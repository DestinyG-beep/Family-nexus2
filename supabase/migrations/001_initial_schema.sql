create extension if not exists "pgcrypto";

create type family_role as enum ('SUPERADMIN', 'ADMIN', 'MEMBER');
create type family_member_status as enum ('ACTIVE', 'RESTRICTED', 'REMOVED');
create type media_type as enum ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT');
create type invitation_status as enum ('ACTIVE', 'EXPIRED', 'REVOKED', 'EXHAUSTED');
create type theme_option as enum ('LIGHT', 'DARK', 'SYSTEM');
create type conversation_type as enum ('FAMILY', 'DIRECT');
create type message_type as enum ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO', 'VOICE', 'DOCUMENT');

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  name text not null,
  email text,
  phone_number text,
  residence text,
  avatar_media_id uuid,
  profile_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) >= 5),
  password_hash text not null,
  member_limit integer not null check (member_limit > 0),
  default_background_media_id uuid,
  owner_id uuid not null,
  created_by uuid not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists family_members (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role family_role not null default 'MEMBER',
  status family_member_status not null default 'ACTIVE',
  joined_at timestamptz default now(),
  removed_at timestamptz,
  removed_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (family_id, user_id)
);

create table if not exists permission_definitions (
  key text primary key,
  description text not null,
  category text not null,
  created_at timestamptz default now()
);

create table if not exists family_member_permissions (
  id uuid primary key default gen_random_uuid(),
  family_member_id uuid not null references family_members(id) on delete cascade,
  permission_key text not null references permission_definitions(key),
  enabled boolean not null default true,
  granted_by uuid,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (family_member_id, permission_key)
);

create table if not exists family_member_settings (
  id uuid primary key default gen_random_uuid(),
  family_member_id uuid not null references family_members(id) on delete cascade,
  background_media_id uuid,
  theme theme_option not null default 'SYSTEM',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists family_invitations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  created_by uuid not null,
  token_hash text not null,
  expires_at timestamptz not null,
  max_uses integer not null default 1,
  uses integer not null default 0,
  status invitation_status not null default 'ACTIVE',
  created_at timestamptz default now()
);

create table if not exists media (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  uploaded_by uuid not null references profiles(id),
  storage_provider text not null default 'supabase',
  bucket text not null,
  storage_key text not null,
  media_type media_type not null,
  mime_type text,
  file_name text,
  file_size bigint,
  width integer,
  height integer,
  duration_seconds integer,
  thumbnail_storage_key text,
  created_at timestamptz default now(),
  deleted_at timestamptz,
  deleted_by uuid
);

create table if not exists media_likes (
  media_id uuid not null references media(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (media_id, user_id)
);

create table if not exists media_pins (
  media_id uuid not null references media(id) on delete cascade,
  pinned_by uuid not null references profiles(id),
  pinned_at timestamptz default now()
);

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  created_by uuid not null references profiles(id),
  name text not null,
  start_at timestamptz,
  location_name text,
  map_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  deleted_at timestamptz
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id),
  type conversation_type not null,
  created_at timestamptz default now()
);

create table if not exists conversation_members (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  user_id uuid not null references profiles(id),
  joined_at timestamptz default now(),
  unique (conversation_id, user_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id uuid not null references profiles(id),
  type message_type not null default 'TEXT',
  content text,
  created_at timestamptz default now()
);

create table if not exists message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references messages(id) on delete cascade,
  media_id uuid not null references media(id),
  created_at timestamptz default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  title text not null,
  body text,
  read_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id),
  push_token text not null,
  platform text not null,
  created_at timestamptz default now()
);

create table if not exists audit_logs (
  id uuid primary key default gen_random_uuid(),
  family_id uuid references families(id),
  actor_id uuid references profiles(id),
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb,
  created_at timestamptz default now()
);

create index if not exists idx_family_members_family_id on family_members(family_id);
create index if not exists idx_family_members_user_id on family_members(user_id);
create index if not exists idx_media_family_id on media(family_id);
create index if not exists idx_events_family_id on events(family_id);
create index if not exists idx_messages_conversation_id on messages(conversation_id);
