-- Working polls (MILESTONES §4). The poll post type and posts.poll_options
-- (jsonb array of choice strings) already exist; this adds the vote store.
--
-- One vote per member per poll (PK post_id+voter_id) — changing your pick is an
-- update, not a second row. Counts are public so everyone sees results; you may
-- only cast/change your own vote.

create table poll_votes (
  post_id    uuid not null references posts(id) on delete cascade,
  voter_id   uuid not null references profiles(id) on delete cascade,
  option_idx smallint not null,
  created_at timestamptz not null default now(),
  primary key (post_id, voter_id)
);

create index poll_votes_post_idx on poll_votes (post_id);

alter table poll_votes enable row level security;

create policy poll_votes_select    on poll_votes for select using (true);
create policy poll_votes_write_own on poll_votes for all
  using (voter_id = current_profile_id()) with check (voter_id = current_profile_id());

grant select, insert, update, delete on poll_votes to authenticated;
