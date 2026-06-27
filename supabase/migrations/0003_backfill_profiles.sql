-- =============================================================================
-- Black Panther Fanworks — 0003 backfill profiles
-- Creates a profile for any auth user that predates the signup trigger from
-- 0001 (e.g. accounts made during Milestone 2 testing). Idempotent: only acts
-- on auth users that don't already have a profile.
-- Run in the Supabase SQL Editor.
-- =============================================================================

do $$
declare
  u record;
  base_username  text;
  final_username text;
  suffix int;
begin
  for u in
    select au.id, au.email
    from auth.users au
    left join profiles p on p.user_id = au.id
    where p.id is null
  loop
    base_username := regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9_]', '', 'g');
    if base_username = '' then base_username := 'member'; end if;

    final_username := base_username;
    suffix := 0;
    while exists (select 1 from profiles where username = final_username) loop
      suffix := suffix + 1;
      final_username := base_username || suffix::text;
    end loop;

    insert into profiles (user_id, username, display_name)
    values (u.id, final_username, final_username);
    raise notice 'Created profile "%" for %', final_username, u.email;
  end loop;
end;
$$;
