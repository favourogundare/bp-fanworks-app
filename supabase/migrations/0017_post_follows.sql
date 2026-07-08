-- Persist the post-level Follow button (MILESTONES §8): it was cosmetic
-- local state that reset on reload. Owner-scoped, same shape as saved_items.

create table post_follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  post_id     uuid not null references posts(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (follower_id, post_id)
);

create index post_follows_post_idx on post_follows (post_id);

alter table post_follows enable row level security;

create policy post_follows_own on post_follows for all
  using (follower_id = current_profile_id()) with check (follower_id = current_profile_id());

grant select, insert, delete on post_follows to authenticated;
