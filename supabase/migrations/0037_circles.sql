-- Circles Phase 1 (MILESTONES §9): public sub-communities. Anyone can create
-- a Circle; a post lives either in one Circle (posts.circle_id) or in the
-- General feed (circle_id null). Phase 1 is public-only: every circle is
-- readable and postable by any signed-in member, so posts RLS is untouched —
-- the General feed simply filters circle_id is null client-side. Private /
-- invite circles are Phase 2 and will revisit visibility RLS.
--
-- Creation goes through the create_circle() RPC (spam guardrail: 3 circles
-- per member per day, slug format enforced). The creator is seeded as the
-- circle's mod; broader per-circle mod management is deferred.
-- Idempotent throughout, per DB health rules.

create table if not exists circles (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  name        text not null check (char_length(name) between 1 and 60),
  description text not null default '' check (char_length(description) <= 500),
  creator_id  uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists circle_members (
  circle_id  uuid not null references circles(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role       text not null default 'member' check (role in ('member', 'mod')),
  joined_at  timestamptz not null default now(),
  primary key (circle_id, profile_id)
);

alter table posts add column if not exists circle_id uuid references circles(id) on delete cascade;

create index if not exists circles_creator_idx on circles (creator_id);
create index if not exists circle_members_profile_idx on circle_members (profile_id);
create index if not exists posts_circle_idx on posts (circle_id) where circle_id is not null;

alter table circles        enable row level security;
alter table circle_members enable row level security;

-- Public read (Phase 1: all circles are public).
drop policy if exists circles_public_read on circles;
create policy circles_public_read on circles for select using (true);
drop policy if exists circle_members_public_read on circle_members;
create policy circle_members_public_read on circle_members for select using (true);

-- No direct insert policy on circles — creation only via create_circle() RPC.

-- Update: circle creator, a mod of that circle, or a site mod.
drop policy if exists circles_update_mods on circles;
create policy circles_update_mods on circles for update
  using (
    creator_id = current_profile_id() or is_mod()
    or exists (select 1 from circle_members m
               where m.circle_id = id and m.profile_id = current_profile_id() and m.role = 'mod')
  )
  with check (
    creator_id = current_profile_id() or is_mod()
    or exists (select 1 from circle_members m
               where m.circle_id = id and m.profile_id = current_profile_id() and m.role = 'mod')
  );

-- Delete: creator or site mod.
drop policy if exists circles_delete_creator_or_mod on circles;
create policy circles_delete_creator_or_mod on circles for delete
  using (creator_id = current_profile_id() or is_mod());

-- Membership: join as yourself (plain member only — mod rows come from the
-- RPC or later tooling); leave yourself; site mods can kick.
drop policy if exists circle_members_join_self on circle_members;
create policy circle_members_join_self on circle_members for insert
  with check (profile_id = current_profile_id() and role = 'member');
drop policy if exists circle_members_leave_self_or_mod on circle_members;
create policy circle_members_leave_self_or_mod on circle_members for delete
  using (profile_id = current_profile_id() or is_mod());

-- Spam-guarded creation: validates the slug, caps members at 3 new circles
-- per rolling day, and seeds the creator as the circle's mod.
create or replace function create_circle(p_slug text, p_name text, p_description text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := current_profile_id();
  new_id uuid;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  if p_slug !~ '^[a-z0-9][a-z0-9-]{0,39}$' then
    raise exception 'Slug must be 1-40 chars: lowercase letters, numbers, dashes';
  end if;
  if char_length(coalesce(p_name, '')) not between 1 and 60 then
    raise exception 'Name must be 1-60 characters';
  end if;
  if (select count(*) from circles
      where creator_id = me and created_at > now() - interval '1 day') >= 3 then
    raise exception 'Circle creation limit reached (3 per day)';
  end if;

  insert into circles (slug, name, description, creator_id)
  values (p_slug, p_name, coalesce(p_description, ''), me)
  returning id into new_id;

  insert into circle_members (circle_id, profile_id, role)
  values (new_id, me, 'mod');

  return new_id;
end;
$$;

grant select on circles to anon;
grant select, update, delete on circles to authenticated;
grant select on circle_members to anon;
grant select, insert, delete on circle_members to authenticated;
grant execute on function create_circle(text, text, text) to authenticated;
