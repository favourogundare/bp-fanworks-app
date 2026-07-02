-- Personal saved/bookmarked posts and comments (MILESTONES §6 "Save / bookmark").
-- Reuses the vote_target enum ('post' | 'comment'). Strictly private: RLS keeps
-- every operation scoped to the saver's own rows. Foundation for bookmark
-- folders and reading lists later.

create table saved_items (
  saver_id    uuid not null references profiles(id) on delete cascade,
  target_type vote_target not null,
  target_id   uuid not null,
  created_at  timestamptz not null default now(),
  primary key (saver_id, target_type, target_id)
);

create index saved_items_saver_idx on saved_items (saver_id, created_at desc);

alter table saved_items enable row level security;

-- saved items: private — only the saver can see or manage their rows.
create policy saved_items_own on saved_items for all
  using (saver_id = current_profile_id()) with check (saver_id = current_profile_id());

grant select, insert, delete on saved_items to authenticated;
