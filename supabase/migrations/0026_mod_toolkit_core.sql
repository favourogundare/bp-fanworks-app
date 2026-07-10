-- Moderation toolkit, slice 1 (MILESTONES §9): mod action log, comment
-- locking, and removal reasons. Builds on the 0007 RPCs — every mod action now
-- writes an audit row. 0025 is reserved for join/self-flair (PR #64).
-- Idempotent throughout, per DB health rules.

-- ----- mod action log ---------------------------------------------------------
-- Insert-only audit of moderator actions. Mods read it; nothing writes it except
-- the SECURITY DEFINER RPCs below (no insert grant, and the helper's execute
-- privilege is revoked from clients).
create table if not exists mod_actions (
  id          uuid primary key default gen_random_uuid(),
  mod_id      uuid not null references profiles(id) on delete cascade,
  action      text not null,             -- e.g. 'remove_post', 'lock_comments'
  target_type text not null,             -- 'post' | 'profile'
  target_id   uuid,                      -- may outlive its target (removed posts)
  detail      text not null default '',  -- reason / human context
  created_at  timestamptz not null default now()
);

create index if not exists mod_actions_created_idx on mod_actions (created_at desc);

alter table mod_actions enable row level security;

drop policy if exists mod_actions_mod_read on mod_actions;
create policy mod_actions_mod_read on mod_actions for select using (is_mod());

grant select on mod_actions to authenticated;

create or replace function log_mod_action(p_action text, p_target_type text, p_target uuid, p_detail text default '')
returns void language sql security definer set search_path = public as $$
  insert into mod_actions (mod_id, action, target_type, target_id, detail)
  values (current_profile_id(), p_action, p_target_type, p_target, coalesce(p_detail, ''))
$$;

-- Only the definer RPCs below may log; clients cannot call this directly.
revoke all on function log_mod_action(text, text, uuid, text) from public, authenticated, anon;

-- ----- comment locking --------------------------------------------------------
alter table posts add column if not exists locked_at timestamptz;

create or replace function mod_set_locked(p_post uuid, p_locked boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_mod() then raise exception 'Not a moderator'; end if;
  update posts set locked_at = case when p_locked then now() else null end where id = p_post;
  perform log_mod_action(case when p_locked then 'lock_comments' else 'unlock_comments' end, 'post', p_post);
end;
$$;

-- Locking is enforced in the DB, not just the UI: the comments insert policy
-- now refuses non-mod comments on a locked post.
drop policy if exists comments_insert_own on comments;
create policy comments_insert_own on comments for insert
  with check (
    author_id = current_profile_id()
    and (is_mod() or not exists (select 1 from posts p where p.id = post_id and p.locked_at is not null))
  );

-- ----- existing 0007 RPCs: add logging (+ removal reason) ---------------------

create or replace function mod_set_pinned(p_post uuid, p_pinned boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_mod() then raise exception 'Not a moderator'; end if;
  update posts set pinned = p_pinned where id = p_post;
  perform log_mod_action(case when p_pinned then 'pin_post' else 'unpin_post' end, 'post', p_post);
end;
$$;

-- The 1-arg version must go before the 2-arg (defaulted) version exists, or
-- PostgREST sees an ambiguous overload for {p_post}-only calls.
drop function if exists mod_remove_post(uuid);

create or replace function mod_remove_post(p_post uuid, p_reason text default '')
returns void language plpgsql security definer set search_path = public as $$
declare
  v_title text;
begin
  if not is_mod() then raise exception 'Not a moderator'; end if;
  select title into v_title from posts where id = p_post;
  delete from posts where id = p_post;
  perform log_mod_action('remove_post', 'post', p_post,
    coalesce(nullif(trim(p_reason), ''), '(no reason given)') || ' — "' || coalesce(v_title, '?') || '"');
end;
$$;

create or replace function mod_set_post_flairs(p_post uuid, p_slugs text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_mod() then raise exception 'Not a moderator'; end if;
  delete from post_flairs where post_id = p_post;
  insert into post_flairs (post_id, flair_id)
    select p_post, f.id from flairs f where f.scope = 'post' and f.slug = any(p_slugs);
  perform log_mod_action('set_post_flairs', 'post', p_post, array_to_string(p_slugs, ', '));
end;
$$;

create or replace function mod_assign_member_flair(p_profile uuid, p_slug text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_mod() then raise exception 'Not a moderator'; end if;
  update profiles
    set member_flair_id = (select id from flairs where scope = 'member' and slug = p_slug)
    where id = p_profile;
  perform log_mod_action('assign_member_flair', 'profile', p_profile, coalesce(p_slug, '(cleared)'));
end;
$$;
