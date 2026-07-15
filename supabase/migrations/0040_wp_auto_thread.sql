-- Auto-create a discussion thread per tjadaka.com chapter (MILESTONES §12).
-- WordPress (publish hook via a small functions.php snippet, or Zapier/Make)
-- POSTs to the wp_create_discussion_thread() RPC through PostgREST:
--
--   POST https://<project>.supabase.co/rest/v1/rpc/wp_create_discussion_thread
--   headers: apikey: <anon key>, Content-Type: application/json
--   body: { "p_secret": "...", "p_wp_post_id": 123, "p_title": "...",
--           "p_url": "https://tjadaka.com/...", "p_excerpt": "..." }
--
-- No Edge Function on purpose: this project deploys DB changes as pasted
-- migrations only, and PostgREST already exposes functions — so the webhook
-- endpoint IS the database. The anon key is public; the shared secret in the
-- request body is the real gate.
--
-- SETUP AFTER APPLYING (SQL editor, values never committed to the repo):
--   insert into wp_webhook_config (secret, author_profile_id)
--   values ('<long random secret>', '<profile uuid to author the threads>');
--
-- Dedup: wp_threads maps each WordPress post id to its community post, so
-- webhook retries return the existing thread instead of duplicating it.
-- Idempotent throughout, per DB health rules.

create table if not exists wp_webhook_config (
  id                 boolean primary key default true check (id), -- single row
  secret             text not null check (char_length(secret) >= 16),
  author_profile_id  uuid not null references profiles(id),
  created_at         timestamptz not null default now()
);

create table if not exists wp_threads (
  wp_post_id bigint primary key,
  post_id    uuid not null references posts(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- RLS on, and deliberately NO policies and NO grants: neither table is
-- reachable through the API in any role. Only the SECURITY DEFINER function
-- below (and the SQL editor) can touch them.
alter table wp_webhook_config enable row level security;
alter table wp_threads        enable row level security;

create or replace function wp_create_discussion_thread(
  p_secret text, p_wp_post_id bigint, p_title text, p_url text, p_excerpt text default ''
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  cfg wp_webhook_config%rowtype;
  existing uuid;
  new_post uuid;
  clean_title text := left(coalesce(p_title, ''), 200);
begin
  select * into cfg from wp_webhook_config;
  if not found then
    raise exception 'Webhook not configured';
  end if;
  if p_secret is distinct from cfg.secret then
    raise exception 'Bad secret';
  end if;
  if clean_title = '' then
    raise exception 'Title required';
  end if;
  if p_url !~ '^https://tjadaka\.com/' then
    raise exception 'URL must be a tjadaka.com link';
  end if;

  -- Webhook retries / double-fires return the existing thread (idempotent).
  select post_id into existing from wp_threads where wp_post_id = p_wp_post_id;
  if existing is not null then
    return existing;
  end if;

  -- Runaway-loop guard: a misconfigured WP hook can't flood the feed.
  if (select count(*) from wp_threads where created_at > now() - interval '1 day') >= 20 then
    raise exception 'Auto-thread daily limit reached (20)';
  end if;

  insert into posts (author_id, surface, type, title, body)
  values (
    cfg.author_profile_id,
    'community',
    'debate',
    'Discussion: ' || clean_title,
    trim(both E'\n' from left(coalesce(p_excerpt, ''), 1000)
      || E'\n\n[Read the chapter on tjadaka.com](' || p_url || ')')
  )
  returning id into new_post;

  -- Tag it Fanfiction when the flair exists (best-effort, never fatal).
  insert into post_flairs (post_id, flair_id)
  select new_post, f.id from flairs f where f.scope = 'post' and f.slug = 'fanfiction'
  on conflict do nothing;

  insert into wp_threads (wp_post_id, post_id) values (p_wp_post_id, new_post);
  return new_post;
end;
$$;

grant execute on function wp_create_discussion_thread(text, bigint, text, text, text) to anon;
grant execute on function wp_create_discussion_thread(text, bigint, text, text, text) to authenticated;
