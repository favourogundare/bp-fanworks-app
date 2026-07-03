-- Notifications / inbox v1 (MILESTONES §8): reply and @mention notifications,
-- created by a trigger when a comment lands. vote_milestone is in the enum for
-- later but nothing emits it yet. Email digests deferred.
--
-- Writes happen ONLY inside the security-definer trigger — clients can read
-- their own rows and mark them read (update read_at), nothing else.

create type notification_type as enum ('reply', 'mention', 'vote_milestone');

create table notifications (
  id           uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references profiles(id) on delete cascade,
  actor_id     uuid references profiles(id) on delete cascade,
  type         notification_type not null,
  post_id      uuid references posts(id) on delete cascade,
  comment_id   uuid references comments(id) on delete cascade,
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);

create index notifications_recipient_idx on notifications (recipient_id, created_at desc);

alter table notifications enable row level security;

-- recipients read their own inbox and may only flip read_at (column grant below).
create policy notifications_select_own on notifications for select
  using (recipient_id = current_profile_id());
create policy notifications_update_own on notifications for update
  using (recipient_id = current_profile_id()) with check (recipient_id = current_profile_id());

grant select on notifications to authenticated;
grant update (read_at) on notifications to authenticated;
-- no insert/delete grant: rows are created by the trigger below, cleaned up by cascades.

-- On every new comment: notify the parent-comment author (or the post author
-- for top-level comments), then anyone @mentioned in the body. Never notify
-- yourself; never notify the same person twice for one comment.
create or replace function notify_on_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_actor     uuid := new.author_id;
  v_reply_to  uuid;
  v_mention   record;
  v_notified  uuid[] := array[]::uuid[];
begin
  -- reply target: parent comment's author, else the post's author
  if new.parent_id is not null then
    select author_id into v_reply_to from comments where id = new.parent_id;
  else
    select author_id into v_reply_to from posts where id = new.post_id;
  end if;

  if v_reply_to is not null and v_reply_to <> v_actor then
    insert into notifications (recipient_id, actor_id, type, post_id, comment_id)
      values (v_reply_to, v_actor, 'reply', new.post_id, new.id);
    v_notified := v_notified || v_reply_to;
  end if;

  -- @mentions: first 5 distinct usernames present in the body
  for v_mention in
    select p.id
      from (select distinct lower(m[1]) as uname
              from regexp_matches(new.body, '@([A-Za-z0-9_]{3,20})', 'g') m
             limit 5) u
      join profiles p on p.username = u.uname::citext
     where p.id <> v_actor
  loop
    if not (v_mention.id = any(v_notified)) then
      insert into notifications (recipient_id, actor_id, type, post_id, comment_id)
        values (v_mention.id, v_actor, 'mention', new.post_id, new.id);
      v_notified := v_notified || v_mention.id;
    end if;
  end loop;

  return new;
end;
$$;

create trigger comments_notify
  after insert on comments
  for each row execute function notify_on_comment();
