-- Follow a tag (MILESTONES §2), part 2 of 2: table, RLS, and notify trigger.
-- Split from 0016 so the 'tagged_post' enum value is committed before anything
-- here references it.
--
-- Written idempotently on purpose: earlier deployments created tag_follows and
-- the trigger by hand from the old single-file 0016, so this migration must
-- succeed both on a fresh database and on one where those objects already
-- exist (it upgrades the latter in place with the FK and dedup index below).

create table if not exists tag_follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  flair_slug  text not null,
  created_at  timestamptz not null default now(),
  primary key (follower_id, flair_slug)
);

-- flairs is unique on (scope, slug), so a slug-only FK is impossible; carry a
-- scope column pinned to 'post' and reference the pair. Following a slug that
-- isn't a real post flair now fails at the database instead of silently.
alter table tag_follows add column if not exists scope flair_scope not null default 'post';
alter table tag_follows drop constraint if exists tag_follows_post_scope_check;
alter table tag_follows add constraint tag_follows_post_scope_check check (scope = 'post');
alter table tag_follows drop constraint if exists tag_follows_flair_fkey;
alter table tag_follows add constraint tag_follows_flair_fkey
  foreign key (scope, flair_slug) references flairs (scope, slug) on delete cascade;

create index if not exists tag_follows_slug_idx on tag_follows (flair_slug);

alter table tag_follows enable row level security;

drop policy if exists tag_follows_own on tag_follows;
create policy tag_follows_own on tag_follows for all
  using (follower_id = current_profile_id()) with check (follower_id = current_profile_id());

grant select, insert, delete on tag_follows to authenticated;

-- One tagged_post notification per (recipient, post), enforced by the index
-- rather than a read-then-write check: a post inserted with several followed
-- flairs fires this trigger once per flair row, and the ON CONFLICT path is
-- the only race-free dedup.
-- Clear any duplicates the old read-then-write dedup let through, or the
-- unique index below cannot build on an already-deployed database.
delete from notifications a
  using notifications b
 where a.type = 'tagged_post' and b.type = 'tagged_post'
   and a.recipient_id = b.recipient_id and a.post_id = b.post_id
   and (a.created_at > b.created_at or (a.created_at = b.created_at and a.id > b.id));

create unique index if not exists notifications_tagged_post_once
  on notifications (recipient_id, post_id) where type = 'tagged_post';

-- When a post gets a flair, notify everyone following that flair (except the
-- author). Rows are insert-only via this definer function; the notifications
-- RLS from 0012 already gates reads to the recipient.
create or replace function notify_tag_followers()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_slug   text;
  v_author uuid;
begin
  select slug into v_slug from flairs where id = new.flair_id;
  select author_id into v_author from posts where id = new.post_id;
  if v_slug is null or v_author is null then return new; end if;

  insert into notifications (recipient_id, actor_id, type, post_id)
  select tf.follower_id, v_author, 'tagged_post', new.post_id
    from tag_follows tf
   where tf.flair_slug = v_slug
     and tf.follower_id <> v_author
  on conflict (recipient_id, post_id) where type = 'tagged_post' do nothing;
  return new;
end;
$$;

drop trigger if exists post_flairs_notify_follows on post_flairs;
create trigger post_flairs_notify_follows
  after insert on post_flairs
  for each row execute function notify_tag_followers();
