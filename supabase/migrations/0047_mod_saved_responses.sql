-- Saved responses (MILESTONES §9 mod toolkit): canned mod replies the team
-- reuses when removing content / resolving reports (e.g. "Rule 3: source your
-- art"). Shared across the mod team — any mod reads and manages all of them.
-- Idempotent.

create table if not exists mod_saved_responses (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (char_length(title) between 1 and 80),
  body       text not null check (char_length(body) between 1 and 2000),
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists mod_saved_responses_created_idx on mod_saved_responses (created_at desc);

alter table mod_saved_responses enable row level security;

-- Mods only, all of it (small trusted team — shared read + manage).
drop policy if exists mod_saved_responses_all on mod_saved_responses;
create policy mod_saved_responses_all on mod_saved_responses for all
  using (is_mod()) with check (is_mod() and created_by = current_profile_id());

grant select, insert, delete on mod_saved_responses to authenticated;
