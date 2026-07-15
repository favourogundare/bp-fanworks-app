-- Mod mail (MILESTONES §9 mod toolkit): member ↔ mod-team threads. A member
-- opens a thread to the mod team; ANY mod sees all threads and can reply. This
-- is a shared team inbox — distinct from the 1:1 chat system (0005). Idempotent.

create table if not exists modmail_threads (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references profiles(id) on delete cascade,
  subject    text not null check (char_length(subject) between 1 and 120),
  status     text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  last_at    timestamptz not null default now()
);

create table if not exists modmail_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references modmail_threads(id) on delete cascade,
  sender_id  uuid not null references profiles(id) on delete cascade,
  from_mod   boolean not null default false,   -- sent acting as a mod?
  body       text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index if not exists modmail_threads_last_idx on modmail_threads (last_at desc);
create index if not exists modmail_messages_thread_idx on modmail_messages (thread_id, created_at);

alter table modmail_threads  enable row level security;
alter table modmail_messages enable row level security;

-- Threads: the owning member sees their own; mods see all.
drop policy if exists modmail_threads_read on modmail_threads;
create policy modmail_threads_read on modmail_threads for select
  using (member_id = current_profile_id() or is_mod());
-- Members open their own threads.
drop policy if exists modmail_threads_insert on modmail_threads;
create policy modmail_threads_insert on modmail_threads for insert
  with check (member_id = current_profile_id());
-- Only mods change status (close / reopen).
drop policy if exists modmail_threads_update on modmail_threads;
create policy modmail_threads_update on modmail_threads for update
  using (is_mod()) with check (is_mod());

grant select, insert, update on modmail_threads to authenticated;

-- Messages: readable to whoever can see the thread; you can only post as
-- yourself, into a thread you own (as member) or any thread (as mod), and
-- from_mod must match whether you're a mod.
drop policy if exists modmail_messages_read on modmail_messages;
create policy modmail_messages_read on modmail_messages for select
  using (thread_id in (select id from modmail_threads
                       where member_id = current_profile_id() or is_mod()));
drop policy if exists modmail_messages_insert on modmail_messages;
create policy modmail_messages_insert on modmail_messages for insert
  with check (
    sender_id = current_profile_id()
    and from_mod = is_mod()
    and thread_id in (select id from modmail_threads
                      where member_id = current_profile_id() or is_mod())
  );

grant select, insert on modmail_messages to authenticated;

-- Bump the thread's last_at (and reopen on a new message) whenever a message
-- lands, so the mod queue sorts by recent activity.
create or replace function modmail_touch_thread()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update modmail_threads set last_at = now() where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists modmail_message_touch on modmail_messages;
create trigger modmail_message_touch
  after insert on modmail_messages
  for each row execute function modmail_touch_thread();
