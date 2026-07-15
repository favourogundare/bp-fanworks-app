-- =============================================================================
-- Black Panther Fanworks — 0029 mod-editable sidebar bookmarks
-- Moves the hardcoded `community.bookmarks` (App.tsx) into the DB so mods can
-- add / edit / remove / reorder them. Public read; writes go through
-- SECURITY DEFINER RPCs gated by is_mod() — mirrors 0007_mod_actions.
-- Run after 0001-0026 (and pending 0027-0028). RLS + seed included.
-- =============================================================================

-- ----- table ----------------------------------------------------------------
-- A bookmark links either to an internal route (`route`) OR to a pinned post
-- matched by title regex (`pinned_match`) — never a hardcoded post id, exactly
-- like the current frontend `bookmarkPath()` logic.
create table if not exists sidebar_bookmarks (
  id           uuid primary key default gen_random_uuid(),
  label        text not null,
  route        text,               -- e.g. '/t/fanfiction'
  pinned_match text,               -- regex source, matched case-insensitively
  position     integer not null,   -- display order, ascending
  created_at   timestamptz not null default now(),
  constraint sidebar_bookmarks_target_ck
    check (route is not null or pinned_match is not null)
);

create index if not exists sidebar_bookmarks_position_idx on sidebar_bookmarks (position);

-- ----- RLS ------------------------------------------------------------------
-- World-readable (the sidebar is public). No client write policy at all, so
-- direct INSERT/UPDATE/DELETE from an anon/authenticated key is denied by RLS.
-- All writes must go through the mod RPCs below. (Same shape as `flairs`.)
alter table sidebar_bookmarks enable row level security;
drop policy if exists sidebar_bookmarks_select on sidebar_bookmarks;
create policy sidebar_bookmarks_select on sidebar_bookmarks for select using (true);

-- ----- mod write RPCs (SECURITY DEFINER, gated by is_mod) --------------------
-- Insert (p_id null) or update (p_id set) a bookmark. Returns the row id.
-- New bookmarks land at the end (max position + 1).
create or replace function mod_upsert_sidebar_bookmark(
  p_id uuid, p_label text, p_route text, p_pinned_match text)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  if not is_mod() then raise exception 'Not a moderator'; end if;
  if p_route is null and p_pinned_match is null then
    raise exception 'Bookmark needs a route or a pinned_match';
  end if;

  if p_id is null then
    insert into sidebar_bookmarks (label, route, pinned_match, position)
    values (p_label, p_route, p_pinned_match,
            coalesce((select max(position) + 1 from sidebar_bookmarks), 0))
    returning id into v_id;
  else
    update sidebar_bookmarks
      set label = p_label, route = p_route, pinned_match = p_pinned_match
      where id = p_id
      returning id into v_id;
    if v_id is null then raise exception 'Bookmark not found'; end if;
  end if;
  return v_id;
end;
$$;

-- Delete a bookmark.
create or replace function mod_delete_sidebar_bookmark(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_mod() then raise exception 'Not a moderator'; end if;
  delete from sidebar_bookmarks where id = p_id;
end;
$$;

-- Reorder: positions are assigned from the order of p_ids (index 0..n-1).
create or replace function mod_reorder_sidebar_bookmarks(p_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_mod() then raise exception 'Not a moderator'; end if;
  update sidebar_bookmarks b
    set position = ord.idx
    from (select id, (ordinality - 1) as idx
          from unnest(p_ids) with ordinality as u(id, ordinality)) ord
    where b.id = ord.id;
end;
$$;

-- ----- seed: current hardcoded bookmarks (App.tsx community.bookmarks) -------
-- Only seed when the table is empty, so a re-run / branch resync doesn't
-- duplicate the rows (there's no natural unique key besides the uuid id).
insert into sidebar_bookmarks (label, route, pinned_match, position)
select v.label, v.route, v.pinned_match, v.position from (values
  ('Wiki',                      null,            'lore megathread', 0),
  ('Fanfic Archive',            '/t/fanfiction', null,             1),
  ('Weekly Self-Promo Thread',  null,            'self-promo',      2),
  ('Commission Board',          '/commissions',  null,             3)
) as v(label, route, pinned_match, position)
where not exists (select 1 from sidebar_bookmarks);
