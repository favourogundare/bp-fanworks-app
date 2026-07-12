-- =============================================================================
-- Black Panther Fanworks — 0026 community membership + self-service flair
-- Two independent pieces (JOIN §…):
--   (a) community_members: persist Join/Leave so the "Wakandans" count and the
--       button state are real (today the sidebar counts every profile row).
--   (b) set_my_member_flair(): let a member pick their OWN member flair. The
--       0001 grant already lets a member write profiles.member_flair_id, but the
--       direct path can't constrain scope — a client could point it at a
--       'post'-scope flair. This RPC resolves the slug within scope='member'
--       and writes only the caller's row (current_profile_id()), mirroring the
--       mod-only mod_assign_member_flair() from 0007. Run after 0001-0023.
-- =============================================================================

-- ----- community_members ----------------------------------------------------
-- One row per member of the (single) community. Public-readable so the member
-- count / roster reads match world-readable profiles; writable only by the
-- member themselves, mirroring the votes / tag_follows own-row pattern.
create table if not exists community_members (
  member_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (member_id)
);

alter table community_members enable row level security;

drop policy if exists community_members_select on community_members;
create policy community_members_select    on community_members for select using (true);
drop policy if exists community_members_write_own on community_members;
create policy community_members_write_own on community_members for all
  using      (member_id = current_profile_id())
  with check (member_id = current_profile_id());

grant select, insert, delete on community_members to authenticated;

-- Seed every existing profile as a member so the "Wakandans" count stays
-- truthful across the cutover (it counted all profiles before this migration).
insert into community_members (member_id)
  select id from profiles
  on conflict (member_id) do nothing;

-- ----- self-service member flair --------------------------------------------
-- Set (or clear, with null) the CALLER's own member flair. security definer so
-- it can resolve the flair id, but it only ever touches current_profile_id()'s
-- row, so a member can never change anyone else's flair. Slug is resolved
-- inside scope='member', so a 'post' flair slug clears the flair instead of
-- leaking a post flair onto a profile.
create or replace function set_my_member_flair(p_slug text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update profiles
    set member_flair_id = (select id from flairs where scope = 'member' and slug = p_slug)
    where id = current_profile_id();
end;
$$;

-- =============================================================================
-- Reverse (run to undo this migration):
--   drop function if exists set_my_member_flair(text);
--   drop table if exists community_members;   -- policies drop with the table
-- =============================================================================
