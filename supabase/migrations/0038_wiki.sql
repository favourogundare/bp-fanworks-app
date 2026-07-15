-- Community wiki (MILESTONES §9): collaborative pages — character bios, ship
-- manifestos, lore deep-dives, resources. Every save writes an immutable
-- revision (page history), and mods can lock a page so only moderators edit it.
--
-- All writes go through save_wiki_page() so the permission check (locked pages
-- are mod-only) and the revision write happen atomically in one place; the
-- tables take no direct insert/update grants. Restoring an old revision is just
-- a normal save with that revision's title/body — no special path. Idempotent
-- throughout, per DB health rules.

create table if not exists wiki_pages (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{0,59}$'),
  title       text not null check (char_length(title) between 1 and 120),
  body        text not null default '',
  edit_locked boolean not null default false,  -- true = only mods may edit
  created_by  uuid references profiles(id) on delete set null,
  updated_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists wiki_revisions (
  id         uuid primary key default gen_random_uuid(),
  page_id    uuid not null references wiki_pages(id) on delete cascade,
  title      text not null,
  body       text not null,
  summary    text not null default '' check (char_length(summary) <= 200),
  editor_id  uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists wiki_revisions_page_idx on wiki_revisions (page_id, created_at desc);

alter table wiki_pages     enable row level security;
alter table wiki_revisions enable row level security;

-- Public read; history is public too.
drop policy if exists wiki_pages_public_read on wiki_pages;
create policy wiki_pages_public_read on wiki_pages for select using (true);
drop policy if exists wiki_revisions_public_read on wiki_revisions;
create policy wiki_revisions_public_read on wiki_revisions for select using (true);

-- No direct insert/update — writes only via save_wiki_page(). Mods can delete a
-- page (revisions cascade with it).
drop policy if exists wiki_pages_delete_mod on wiki_pages;
create policy wiki_pages_delete_mod on wiki_pages for delete using (is_mod());

-- Create or edit a page and append a revision, atomically. Locked pages are
-- moderator-only; new-page creation is capped at 15 per member per day.
create or replace function save_wiki_page(p_slug text, p_title text, p_body text, p_summary text default '')
returns uuid language plpgsql security definer set search_path = public as $$
declare
  me uuid := current_profile_id();
  existing wiki_pages%rowtype;
  page_id uuid;
begin
  if me is null then
    raise exception 'Not signed in';
  end if;
  if p_slug !~ '^[a-z0-9][a-z0-9-]{0,59}$' then
    raise exception 'Slug must be 1-60 chars: lowercase letters, numbers, dashes';
  end if;
  if char_length(coalesce(p_title, '')) not between 1 and 120 then
    raise exception 'Title must be 1-120 characters';
  end if;

  select * into existing from wiki_pages where slug = p_slug;

  if found then
    if existing.edit_locked and not is_mod() then
      raise exception 'This page is locked; only moderators can edit it';
    end if;
    update wiki_pages
       set title = p_title, body = coalesce(p_body, ''), updated_by = me, updated_at = now()
     where id = existing.id;
    page_id := existing.id;
  else
    if (select count(*) from wiki_pages
        where created_by = me and created_at > now() - interval '1 day') >= 15 then
      raise exception 'New-page limit reached (15 per day)';
    end if;
    insert into wiki_pages (slug, title, body, created_by, updated_by)
    values (p_slug, p_title, coalesce(p_body, ''), me, me)
    returning id into page_id;
  end if;

  insert into wiki_revisions (page_id, title, body, summary, editor_id)
  values (page_id, p_title, coalesce(p_body, ''), coalesce(p_summary, ''), me);

  return page_id;
end;
$$;

-- Mods lock/unlock a page's editability.
create or replace function set_wiki_lock(p_slug text, p_locked boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_mod() then
    raise exception 'Not a moderator';
  end if;
  update wiki_pages set edit_locked = p_locked where slug = p_slug;
end;
$$;

grant select on wiki_pages to anon;
grant select, delete on wiki_pages to authenticated;
grant select on wiki_revisions to anon;
grant select on wiki_revisions to authenticated;
grant execute on function save_wiki_page(text, text, text, text) to authenticated;
grant execute on function set_wiki_lock(text, boolean) to authenticated;
