-- Moderation toolkit, slice 3 (MILESTONES §9): distinguish / sticky mod
-- comments. A mod can mark their own comment as an official mod comment
-- (distinguish), and pin a top-level one to the top of the thread (sticky —
-- which also distinguishes it, Reddit-style). Builds on 0027 (log_mod_action).
-- Idempotent throughout, per DB health rules.

alter table comments add column if not exists distinguished_at timestamptz;
alter table comments add column if not exists stickied_at timestamptz;

-- comments_update_own lets an author update their own row, and Supabase's
-- default table grant is column-unrestricted — without this lockdown any
-- author could self-distinguish. Clients only ever write body (edit) and
-- body+deleted_at (soft delete); everything else goes through definer RPCs
-- (vote_score is maintained by definer trigger functions, unaffected).
revoke update on comments from authenticated;
grant update (body, deleted_at) on comments to authenticated;

create or replace function mod_set_comment_distinguished(p_comment uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_mod() then raise exception 'Not a moderator'; end if;
  if (select author_id from comments where id = p_comment) <> current_profile_id() then
    raise exception 'Mods can only distinguish their own comments';
  end if;
  update comments
    set distinguished_at = case when p_on then now() else null end,
        stickied_at = case when p_on then stickied_at else null end -- undistinguish also unsticks
    where id = p_comment;
  perform log_mod_action(case when p_on then 'distinguish_comment' else 'undistinguish_comment' end, 'comment', p_comment);
end;
$$;

create or replace function mod_set_comment_sticky(p_comment uuid, p_on boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_mod() then raise exception 'Not a moderator'; end if;
  if (select author_id from comments where id = p_comment) <> current_profile_id() then
    raise exception 'Mods can only sticky their own comments';
  end if;
  if p_on and (select parent_id from comments where id = p_comment) is not null then
    raise exception 'Only top-level comments can be stickied';
  end if;
  update comments
    set stickied_at = case when p_on then now() else null end,
        distinguished_at = case when p_on then coalesce(distinguished_at, now()) else distinguished_at end
    where id = p_comment;
  perform log_mod_action(case when p_on then 'sticky_comment' else 'unsticky_comment' end, 'comment', p_comment);
end;
$$;
