-- Commission board (MILESTONES §9): a dedicated space where artists advertise
-- open commission slots and members post commission requests. Two independent
-- public listing tables — no matching/messaging built in, that happens off
-- platform (Ko-fi / a form link / DMs). Community guidelines are shown
-- client-side only; this migration just holds the data.
--
-- Same shape as collections (0022): public read, owner-only write, mods can
-- delete to clear drama. Idempotent throughout, per DB health rules.

create table if not exists commission_listings (
  id            uuid primary key default gen_random_uuid(),
  artist_id     uuid not null references profiles(id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 80),
  description   text not null default '' check (char_length(description) <= 2000),
  price_info    text not null default '' check (char_length(price_info) <= 200),
  contact_url   text not null default '' check (char_length(contact_url) <= 300),
  slots_total   int not null default 1 check (slots_total between 1 and 50),
  slots_filled  int not null default 0 check (slots_filled >= 0),
  status        text not null default 'open' check (status in ('open', 'waitlist', 'closed')),
  created_at    timestamptz not null default now(),
  check (slots_filled <= slots_total)
);

create table if not exists commission_requests (
  id            uuid primary key default gen_random_uuid(),
  requester_id  uuid not null references profiles(id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 80),
  description   text not null default '' check (char_length(description) <= 2000),
  budget        text not null default '' check (char_length(budget) <= 100),
  status        text not null default 'open' check (status in ('open', 'fulfilled', 'closed')),
  created_at    timestamptz not null default now()
);

create index if not exists commission_listings_artist_idx on commission_listings (artist_id);
create index if not exists commission_listings_status_created_idx on commission_listings (status, created_at desc);
create index if not exists commission_requests_requester_idx on commission_requests (requester_id);
create index if not exists commission_requests_status_created_idx on commission_requests (status, created_at desc);

alter table commission_listings enable row level security;
alter table commission_requests enable row level security;

-- Public read.
drop policy if exists commission_listings_public_read on commission_listings;
create policy commission_listings_public_read on commission_listings for select using (true);
drop policy if exists commission_requests_public_read on commission_requests;
create policy commission_requests_public_read on commission_requests for select using (true);

-- Owner-only insert/update.
drop policy if exists commission_listings_insert_own on commission_listings;
create policy commission_listings_insert_own on commission_listings for insert
  with check (artist_id = current_profile_id());
drop policy if exists commission_listings_update_own on commission_listings;
create policy commission_listings_update_own on commission_listings for update
  using (artist_id = current_profile_id()) with check (artist_id = current_profile_id());

drop policy if exists commission_requests_insert_own on commission_requests;
create policy commission_requests_insert_own on commission_requests for insert
  with check (requester_id = current_profile_id());
drop policy if exists commission_requests_update_own on commission_requests;
create policy commission_requests_update_own on commission_requests for update
  using (requester_id = current_profile_id()) with check (requester_id = current_profile_id());

-- Delete: owner or mod (mods can remove listings/requests that break rules).
drop policy if exists commission_listings_delete_own_or_mod on commission_listings;
create policy commission_listings_delete_own_or_mod on commission_listings for delete
  using (artist_id = current_profile_id() or is_mod());
drop policy if exists commission_requests_delete_own_or_mod on commission_requests;
create policy commission_requests_delete_own_or_mod on commission_requests for delete
  using (requester_id = current_profile_id() or is_mod());

grant select, insert, update, delete on commission_listings to authenticated;
grant select on commission_listings to anon;
grant select, insert, update, delete on commission_requests to authenticated;
grant select on commission_requests to anon;
