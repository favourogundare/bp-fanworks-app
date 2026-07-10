-- Moderation toolkit, slice 2 (MILESTONES §9): promote/remove mods and ban
-- from community. Builds on 0026 (log_mod_action). Idempotent throughout, per
-- DB health rules.
--
-- banned_at is NOT in the profiles column-level update grant (0001), so only
-- the definer RPC below can set it. Same for role.

alter table profiles add column if not exists banned_at timestamptz;

-- Is the current request from a banned member?
create or replace function is_banned()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where user_id = auth.uid() and banned_at is not null)
$$;

-- ----- promote / demote mods ---------------------------------------------------
create or replace function mod_set_role(p_profile uuid, p_mod boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_mod() then raise exception 'Not a moderator'; end if;
  if not p_mod
     and (select role from profiles where id = p_profile) = 'mod'
     and (select count(*) from profiles where role = 'mod') <= 1 then
    raise exception 'Cannot remove the last moderator';
  end if;
  update profiles
    set role = case when p_mod then 'mod'::user_role else 'member'::user_role end
    where id = p_profile;
  perform log_mod_action(case when p_mod then 'promote_mod' else 'demote_mod' end, 'profile', p_profile);
end;
$$;

-- ----- ban / unban ---------------------------------------------------------------
create or replace function mod_set_banned(p_profile uuid, p_banned boolean, p_reason text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_mod() then raise exception 'Not a moderator'; end if;
  if p_banned and (select role from profiles where id = p_profile) = 'mod' then
    raise exception 'Cannot ban a moderator — remove mod first';
  end if;
  update profiles
    set banned_at = case when p_banned then now() else null end
    where id = p_profile;
  perform log_mod_action(case when p_banned then 'ban_member' else 'unban_member' end, 'profile', p_profile,
    case when p_banned then coalesce(nullif(trim(p_reason), ''), '(no reason given)') else '' end);
end;
$$;

-- ----- enforcement: banned members cannot create content -------------------------
-- (They can still read; votes/DMs are a known gap for a later slice.)

drop policy if exists posts_insert_own on posts;
create policy posts_insert_own on posts for insert
  with check (author_id = current_profile_id() and not is_banned());

-- Keeps the 0026 locked-post condition, adds the ban check.
drop policy if exists comments_insert_own on comments;
create policy comments_insert_own on comments for insert
  with check (
    author_id = current_profile_id()
    and not is_banned()
    and (is_mod() or not exists (select 1 from posts p where p.id = post_id and p.locked_at is not null))
  );
