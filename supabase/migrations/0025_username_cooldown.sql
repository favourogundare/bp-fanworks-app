-- Username change with a 30-day cooldown (MILESTONES §7).
--
-- The rule lives in the database, not the client: the direct column grant
-- from 0009 is revoked and the only write path is the SECURITY DEFINER RPC
-- below, which stamps username_changed_at and refuses changes inside the
-- window. Display name stays freely editable (no cooldown). Idempotent.

alter table profiles add column if not exists username_changed_at timestamptz;

-- Username writes go through the RPC only.
revoke update (username) on profiles from authenticated;

create or replace function change_username(p_username text)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_id      uuid := current_profile_id();
  v_current text;
  v_changed timestamptz;
begin
  if v_id is null then raise exception 'Not signed in'; end if;
  if p_username !~ '^[A-Za-z0-9_]{3,20}$' then
    raise exception 'Username must be 3-20 characters: letters, numbers, underscore';
  end if;
  select username, username_changed_at into v_current, v_changed from profiles where id = v_id;
  if p_username = v_current then return; end if; -- no-op must not burn the cooldown
  if v_changed is not null and v_changed > now() - interval '30 days' then
    raise exception 'You can change your username again on %',
      to_char(v_changed + interval '30 days', 'FMMonth DD, YYYY');
  end if;
  update profiles set username = p_username, username_changed_at = now() where id = v_id;
end;
$$;

revoke all on function change_username(text) from public;
grant execute on function change_username(text) to authenticated;
