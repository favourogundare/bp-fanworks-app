-- Flooding Assistant (MILESTONES §9 mod toolkit): server-side post rate limit.
-- A BEFORE INSERT trigger caps how many posts a non-mod can create in a short
-- window, so a spammer can't flood the feed. Mods are exempt. Enforced in the
-- DB, so it holds regardless of client. Idempotent.
--
-- ponytail: fixed limit (5 posts / 10 min). If the community wants to tune it
-- without a migration, move the two constants to a mod-editable settings row
-- (pairs with the mod-editable-sidebar work) — deferred until that lands.

create or replace function enforce_post_rate_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_recent int;
begin
  -- Mods bypass the flood check.
  if exists (select 1 from profiles where id = new.author_id and role = 'mod') then
    return new;
  end if;
  select count(*) into v_recent
    from posts
   where author_id = new.author_id
     and created_at > now() - interval '10 minutes';
  if v_recent >= 5 then
    raise exception 'You''re posting too fast — up to 5 posts per 10 minutes. Please wait a moment.';
  end if;
  return new;
end;
$$;

drop trigger if exists posts_rate_limit on posts;
create trigger posts_rate_limit
  before insert on posts
  for each row execute function enforce_post_rate_limit();
