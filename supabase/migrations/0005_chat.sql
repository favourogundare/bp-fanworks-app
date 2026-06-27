-- =============================================================================
-- Black Panther Fanworks — 0005 chat (one-to-one direct messages)
-- conversations + messages, with RLS that:
--   - only lets the two participants read a conversation and its messages
--   - REFUSES a message insert when either party blocks the other
-- Plus a get_or_create_conversation() RPC and realtime on messages.
-- Run in the Supabase SQL Editor (after 0001-0004).
-- =============================================================================

-- ----- conversations (a canonical pair of two members) ----------------------
create table conversations (
  id         uuid primary key default gen_random_uuid(),
  user_a     uuid not null references profiles(id) on delete cascade,
  user_b     uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a <> user_b)
);

-- ----- messages -------------------------------------------------------------
create table messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  sender_id       uuid not null references profiles(id) on delete cascade,
  body            text not null,
  created_at      timestamptz not null default now(),
  read_at         timestamptz
);
create index messages_conversation_idx on messages (conversation_id, created_at);

-- =============================================================================
-- Find (or create) the 1:1 conversation between the caller and `other`.
-- Enforces the block rule and canonical (user_a < user_b) ordering so a pair
-- never gets two conversation rows.
-- =============================================================================
create or replace function get_or_create_conversation(other uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := current_profile_id();
  a uuid;
  b uuid;
  conv uuid;
begin
  if me is null then raise exception 'Not signed in'; end if;
  if me = other then raise exception 'Cannot message yourself'; end if;

  if exists (
    select 1 from relationships
    where type = 'block'
      and ((actor_id = me and target_id = other) or (actor_id = other and target_id = me))
  ) then
    raise exception 'Messaging is blocked between these users';
  end if;

  if me::text < other::text then a := me; b := other; else a := other; b := me; end if;

  select id into conv from conversations where user_a = a and user_b = b;
  if conv is null then
    insert into conversations (user_a, user_b) values (a, b) returning id into conv;
  end if;
  return conv;
end;
$$;

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table conversations enable row level security;
alter table messages      enable row level security;

-- conversations: a participant may read theirs. Inserts happen only through the
-- RPC above (no client insert policy), so the block check can't be bypassed.
create policy conversations_select on conversations for select
  using (user_a = current_profile_id() or user_b = current_profile_id());

-- messages: participants may read.
create policy messages_select on messages for select
  using (exists (
    select 1 from conversations c
    where c.id = conversation_id
      and (c.user_a = current_profile_id() or c.user_b = current_profile_id())
  ));

-- messages: you may insert only as yourself, only into a conversation you're in,
-- and only if neither participant blocks the other. This is the enforcement the
-- scope demands — a blocked user's INSERT is rejected by the database.
create policy messages_insert on messages for insert
  with check (
    sender_id = current_profile_id()
    and exists (
      select 1 from conversations c
      where c.id = conversation_id
        and (c.user_a = current_profile_id() or c.user_b = current_profile_id())
    )
    and not exists (
      select 1 from relationships r
      join conversations c on c.id = conversation_id
      where r.type = 'block'
        and ( (r.actor_id = c.user_a and r.target_id = c.user_b)
           or (r.actor_id = c.user_b and r.target_id = c.user_a) )
    )
  );

-- messages: a participant may mark messages read (update read_at).
create policy messages_update on messages for update
  using (exists (
    select 1 from conversations c
    where c.id = conversation_id
      and (c.user_a = current_profile_id() or c.user_b = current_profile_id())
  ));

-- =============================================================================
-- Realtime: stream new messages to the chat drawer.
-- =============================================================================
alter publication supabase_realtime add table messages;
