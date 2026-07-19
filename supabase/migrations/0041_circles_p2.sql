-- Circles Phase 2 (MILESTONES §9): private/invite circles + per-circle mod
-- tooling. Builds on 0037 (circles / circle_members / posts.circle_id).
--
-- Private circles: the circle row stays world-readable (so a private circle is
-- still discoverable in the /circles directory by name/description), but its
-- posts and comments are visible only to its members (and site mods). Joining a
-- private circle is invite-only — a circle mod adds members via circle_add_member;
-- there is no self-serve join. Public circles behave exactly as in Phase 1.
--
-- Per-circle mod tooling: a circle's mods (creator seeded as mod in 0037, plus
-- anyone they promote) and site mods can add members, promote/demote between
-- member and mod, and remove members. These run through SECURITY DEFINER RPCs
-- that check circle-mod authority server-side, so circle_members table RLS stays
-- locked down (no direct cross-user writes).
--
-- Idempotent throughout, per DB health rules.

-- 1. Visibility flag. Existing rows default to 'public' (Phase 1 behaviour).
alter table circles add column if not exists visibility text not null default 'public'
  check (visibility in ('public', 'private'));

-- 2. Central visibility predicate: can the current request see content in this
-- circle? Null circle (General feed) and public circles are always visible;
-- private circles require membership or site-mod. SECURITY DEFINER so the
-- membership lookup isn't itself blocked by RLS. Used by the posts and comments
-- select policies below so the rule lives in exactly one place.
create or replace function can_see_circle(p_circle uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    p_circle is null
    or is_mod()
    or exists (select 1 from circles c
               where c.id = p_circle and c.visibility = 'public')
    or exists (select 1 from circle_members m
               where m.circle_id = p_circle and m.profile_id = current_profile_id());
$$;

-- Is the current request a mod of this specific circle (its creator, a promoted
-- circle mod, or a site mod)?
create or replace function is_circle_mod(p_circle uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select
    is_mod()
    or exists (select 1 from circles c
               where c.id = p_circle and c.creator_id = current_profile_id())
    or exists (select 1 from circle_members m
               where m.circle_id = p_circle
                 and m.profile_id = current_profile_id() and m.role = 'mod');
$$;

-- 3. Gate post + comment reads behind can_see_circle(). Replaces the Phase 1
-- posts_select ("using (true)") and 0001's comments_select. General-feed and
-- public-circle content is unaffected; private-circle content is hidden from
-- non-members.
drop policy if exists posts_select on posts;
create policy posts_select on posts for select
  using (can_see_circle(circle_id));

drop policy if exists comments_select on comments;
create policy comments_select on comments for select
  using (exists (select 1 from posts p
                 where p.id = comments.post_id and can_see_circle(p.circle_id)));

-- 4. Self-join is allowed only for public circles now. Private circles get
-- members solely through circle_add_member (below), which bypasses this via
-- SECURITY DEFINER.
drop policy if exists circle_members_join_self on circle_members;
create policy circle_members_join_self on circle_members for insert
  with check (
    profile_id = current_profile_id() and role = 'member'
    and exists (select 1 from circles c
                where c.id = circle_id and c.visibility = 'public')
  );

-- 5. create_circle gains a visibility argument. Drop the 3-arg Phase 1 version
-- first so the new 4-arg (with default) isn't ambiguous against it.
drop function if exists create_circle(text, text, text);
create or replace function create_circle(
  p_slug text, p_name text, p_description text default '', p_visibility text default 'public')
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
  if coalesce(p_visibility, 'public') not in ('public', 'private') then
    raise exception 'Visibility must be public or private';
  end if;
  if (select count(*) from circles
      where creator_id = me and created_at > now() - interval '1 day') >= 3 then
    raise exception 'Circle creation limit reached (3 per day)';
  end if;

  insert into circles (slug, name, description, creator_id, visibility)
  values (p_slug, p_name, coalesce(p_description, ''), me, coalesce(p_visibility, 'public'))
  returning id into new_id;

  insert into circle_members (circle_id, profile_id, role)
  values (new_id, me, 'mod');

  return new_id;
end;
$$;

-- 6. Per-circle mod tooling. Each RPC checks is_circle_mod(p_circle) and runs as
-- definer so it can write circle_members rows for other users (which the table
-- RLS forbids directly).

-- Add (invite) a member to a circle by username. Idempotent — re-adding an
-- existing member is a no-op. This is how people get into private circles.
create or replace function circle_add_member(p_circle uuid, p_username text)
returns void language plpgsql security definer set search_path = public as $$
declare
  target uuid;
begin
  if not is_circle_mod(p_circle) then
    raise exception 'Not a mod of this circle';
  end if;
  select id into target from profiles where username = p_username;
  if target is null then
    raise exception 'No such user';
  end if;
  insert into circle_members (circle_id, profile_id, role)
  values (p_circle, target, 'member')
  on conflict (circle_id, profile_id) do nothing;
end;
$$;

-- Promote/demote a member between 'member' and 'mod'. The creator can't be
-- demoted (they always retain mod).
create or replace function circle_set_role(p_circle uuid, p_profile uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_circle_mod(p_circle) then
    raise exception 'Not a mod of this circle';
  end if;
  if p_role not in ('member', 'mod') then
    raise exception 'Role must be member or mod';
  end if;
  if exists (select 1 from circles c where c.id = p_circle and c.creator_id = p_profile) then
    raise exception 'The creator is always a mod';
  end if;
  update circle_members set role = p_role
    where circle_id = p_circle and profile_id = p_profile;
end;
$$;

-- Remove a member from a circle. The creator can't be removed.
create or replace function circle_remove_member(p_circle uuid, p_profile uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_circle_mod(p_circle) then
    raise exception 'Not a mod of this circle';
  end if;
  if exists (select 1 from circles c where c.id = p_circle and c.creator_id = p_profile) then
    raise exception 'The creator can''t be removed';
  end if;
  delete from circle_members where circle_id = p_circle and profile_id = p_profile;
end;
$$;

grant execute on function can_see_circle(uuid) to anon, authenticated;
grant execute on function is_circle_mod(uuid) to authenticated;
grant execute on function create_circle(text, text, text, text) to authenticated;
grant execute on function circle_add_member(uuid, text) to authenticated;
grant execute on function circle_set_role(uuid, uuid, text) to authenticated;
grant execute on function circle_remove_member(uuid, uuid) to authenticated;
