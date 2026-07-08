-- Follow a tag (MILESTONES §2): follow flairs, get a "Following" feed, and a
-- notification when a new post is tagged with one you follow.
--
-- NOTE: `alter type ... add value` cannot be used in the same transaction that
-- adds it. The Supabase SQL editor runs this file in one transaction, so if it
-- errors on the trigger's 'tagged_post' cast, run THIS FIRST statement on its
-- own, then run the rest.

alter type notification_type add value if not exists 'tagged_post';

create table tag_follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  flair_slug  text not null,
  created_at  timestamptz not null default now(),
  primary key (follower_id, flair_slug)
);

create index tag_follows_slug_idx on tag_follows (flair_slug);

alter table tag_follows enable row level security;

create policy tag_follows_own on tag_follows for all
  using (follower_id = current_profile_id()) with check (follower_id = current_profile_id());

grant select, insert, delete on tag_follows to authenticated;

-- When a post gets a flair, notify everyone following that flair (except the
-- author). Dedup so a post carrying several followed flairs still yields one
-- notification per follower. Rows are insert-only via this definer function;
-- the notifications RLS from 0012 already gates reads to the recipient.
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
     and not exists (
       select 1 from notifications n
        where n.recipient_id = tf.follower_id
          and n.post_id = new.post_id
          and n.type = 'tagged_post'
     );
  return new;
end;
$$;

create trigger post_flairs_notify_follows
  after insert on post_flairs
  for each row execute function notify_tag_followers();
