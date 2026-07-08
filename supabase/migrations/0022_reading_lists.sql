-- Reading lists / collections (MILESTONES §6): user-created, named, PUBLIC
-- collections of posts ("Shuri-Centric Longfics"). Anyone can browse a
-- collection or follow it; only the owner can edit it. Followed-list feed
-- integration is deliberately deferred — this ships create/edit/browse/follow.
--
-- Unlike bookmark_folders (private, over saves), collections are public and
-- reference posts directly. Idempotent throughout, per DB health rules.

create table if not exists collections (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles(id) on delete cascade,
  name        text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 300),
  created_at  timestamptz not null default now(),
  unique (owner_id, name)
);

create table if not exists collection_items (
  collection_id uuid not null references collections(id) on delete cascade,
  post_id       uuid not null references posts(id) on delete cascade,
  added_at      timestamptz not null default now(),
  primary key (collection_id, post_id)
);

create table if not exists collection_follows (
  follower_id   uuid not null references profiles(id) on delete cascade,
  collection_id uuid not null references collections(id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (follower_id, collection_id)
);

create index if not exists collections_owner_idx on collections (owner_id);
create index if not exists collection_items_post_idx on collection_items (post_id);
create index if not exists collection_follows_collection_idx on collection_follows (collection_id);

alter table collections        enable row level security;
alter table collection_items   enable row level security;
alter table collection_follows enable row level security;

-- Public read (collections are the public half of §6; folders stay private).
drop policy if exists collections_public_read on collections;
create policy collections_public_read on collections for select using (true);
drop policy if exists collection_items_public_read on collection_items;
create policy collection_items_public_read on collection_items for select using (true);
drop policy if exists collection_follows_public_read on collection_follows;
create policy collection_follows_public_read on collection_follows for select using (true);

-- Owner-only writes.
drop policy if exists collections_insert_own on collections;
create policy collections_insert_own on collections for insert
  with check (owner_id = current_profile_id());
drop policy if exists collections_update_own on collections;
create policy collections_update_own on collections for update
  using (owner_id = current_profile_id()) with check (owner_id = current_profile_id());
drop policy if exists collections_delete_own on collections;
create policy collections_delete_own on collections for delete
  using (owner_id = current_profile_id());

drop policy if exists collection_items_write_own on collection_items;
create policy collection_items_write_own on collection_items for insert
  with check (collection_id in (select id from collections where owner_id = current_profile_id()));
drop policy if exists collection_items_delete_own on collection_items;
create policy collection_items_delete_own on collection_items for delete
  using (collection_id in (select id from collections where owner_id = current_profile_id()));

-- Follows: own rows only (same shape as tag_follows).
drop policy if exists collection_follows_own_write on collection_follows;
create policy collection_follows_own_write on collection_follows for insert
  with check (follower_id = current_profile_id());
drop policy if exists collection_follows_own_delete on collection_follows;
create policy collection_follows_own_delete on collection_follows for delete
  using (follower_id = current_profile_id());

grant select, insert, update, delete on collections to authenticated;
grant select on collections to anon;
grant select, insert, delete on collection_items to authenticated;
grant select on collection_items to anon;
grant select, insert, delete on collection_follows to authenticated;
grant select on collection_follows to anon;
