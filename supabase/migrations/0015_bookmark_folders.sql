-- Bookmark folders (MILESTONES §6): named folders over the saved list
-- ("To Read", "Recs"); a saved item can sit in one or many folders.
--
-- folder_items references targets the same way saved_items does
-- (vote_target + uuid) rather than saved_items' composite PK — folders are a
-- view over saves, and the client removes folder rows when an item is unsaved.
-- Everything is private: RLS scopes folders to their owner, and folder_items
-- to rows whose folder the member owns.

create table bookmark_folders (
  id         uuid primary key default gen_random_uuid(),
  owner_id   uuid not null references profiles(id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table folder_items (
  folder_id   uuid not null references bookmark_folders(id) on delete cascade,
  target_type vote_target not null,
  target_id   uuid not null,
  created_at  timestamptz not null default now(),
  primary key (folder_id, target_type, target_id)
);

create index folder_items_target_idx on folder_items (target_type, target_id);

alter table bookmark_folders enable row level security;
alter table folder_items     enable row level security;

create policy folders_own on bookmark_folders for all
  using (owner_id = current_profile_id()) with check (owner_id = current_profile_id());

create policy folder_items_own on folder_items for all
  using (folder_id in (select id from bookmark_folders where owner_id = current_profile_id()))
  with check (folder_id in (select id from bookmark_folders where owner_id = current_profile_id()));

grant select, insert, update, delete on bookmark_folders to authenticated;
grant select, insert, delete on folder_items to authenticated;
