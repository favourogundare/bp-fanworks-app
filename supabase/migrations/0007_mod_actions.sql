-- =============================================================================
-- Black Panther Fanworks — 0007 moderator actions
-- SECURITY DEFINER RPCs that let moderators act on ANY post/member (bypassing
-- the "own content only" RLS), each gated by is_mod(). Run after 0001-0006.
-- =============================================================================

-- Pin / unpin a post to the landing highlights.
create or replace function mod_set_pinned(p_post uuid, p_pinned boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_mod() then raise exception 'Not a moderator'; end if;
  update posts set pinned = p_pinned where id = p_post;
end;
$$;

-- Remove (delete) any post.
create or replace function mod_remove_post(p_post uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_mod() then raise exception 'Not a moderator'; end if;
  delete from posts where id = p_post;
end;
$$;

-- Re-flair a post: replace its flairs with the given slugs.
create or replace function mod_set_post_flairs(p_post uuid, p_slugs text[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_mod() then raise exception 'Not a moderator'; end if;
  delete from post_flairs where post_id = p_post;
  insert into post_flairs (post_id, flair_id)
    select p_post, f.id from flairs f where f.scope = 'post' and f.slug = any(p_slugs);
end;
$$;

-- Assign (or clear, with null) a member flair on any profile.
create or replace function mod_assign_member_flair(p_profile uuid, p_slug text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_mod() then raise exception 'Not a moderator'; end if;
  update profiles
    set member_flair_id = (select id from flairs where scope = 'member' and slug = p_slug)
    where id = p_profile;
end;
$$;
