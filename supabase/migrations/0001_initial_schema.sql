-- =============================================================================
-- Black Panther Fanworks — 0001 initial schema
-- Foundation: profiles, flairs, posts, post_flairs, comments, votes, relationships
-- Includes: signup trigger, vote-score + karma triggers, RLS, seeded flairs.
-- Run this in the Supabase dashboard -> SQL Editor (paste + Run).
-- =============================================================================

-- ----- Extensions -----------------------------------------------------------
create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists citext;     -- case-insensitive usernames

-- ----- Enum types -----------------------------------------------------------
create type user_role          as enum ('member', 'mod');
create type flair_scope        as enum ('post', 'member');
create type post_surface       as enum ('community', 'profile');
create type post_type          as enum ('text','link','image','video','poll','ask','ama','til','debate','vent');
create type vote_target        as enum ('post', 'comment');
create type relationship_type  as enum ('follow', 'mute', 'block');

-- ----- profiles -------------------------------------------------------------
-- One row per member. user_id links to a real login (nullable so we can seed
-- themed demo members who have no auth account).
create table profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid unique references auth.users(id) on delete cascade,
  username        citext unique not null,
  display_name    text not null default '',
  avatar_url      text,
  banner          text,
  role            user_role not null default 'member',
  member_flair_id uuid,                       -- FK added after flairs exists
  karma           integer not null default 0, -- server-maintained (see triggers)
  gold_earned     integer not null default 0, -- server-maintained
  created_at      timestamptz not null default now()
);

-- ----- flairs ---------------------------------------------------------------
create table flairs (
  id    uuid primary key default gen_random_uuid(),
  scope flair_scope not null,
  slug  text not null,
  label text not null,
  bg    text not null,   -- background hex
  fg    text not null,   -- foreground (text) hex
  unique (scope, slug)
);

alter table profiles
  add constraint profiles_member_flair_fk
  foreign key (member_flair_id) references flairs(id) on delete set null;

-- ----- posts ----------------------------------------------------------------
create table posts (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid not null references profiles(id) on delete cascade,
  surface      post_surface not null default 'community',
  type         post_type not null default 'text',
  title        text not null,
  body         text not null default '',
  media        jsonb not null default '[]',  -- image/video sets
  links        jsonb not null default '[]',  -- link posts
  poll_options jsonb not null default '[]',  -- poll posts
  pinned       boolean not null default false,
  vote_score   integer not null default 0,   -- server-maintained
  view_count   integer not null default 0,
  created_at   timestamptz not null default now(),
  edited_at    timestamptz
);
create index posts_author_idx  on posts (author_id);
create index posts_created_idx on posts (created_at desc);

-- ----- post_flairs (a post can carry one or more flairs) --------------------
create table post_flairs (
  post_id  uuid not null references posts(id)  on delete cascade,
  flair_id uuid not null references flairs(id) on delete cascade,
  primary key (post_id, flair_id)
);

-- ----- comments (self-referential nesting) ----------------------------------
create table comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references posts(id) on delete cascade,
  author_id  uuid not null references profiles(id) on delete cascade,
  parent_id  uuid references comments(id) on delete cascade,
  body       text not null,
  vote_score integer not null default 0,      -- server-maintained
  created_at timestamptz not null default now(),
  edited_at  timestamptz
);
create index comments_post_idx   on comments (post_id);
create index comments_parent_idx on comments (parent_id);

-- ----- votes (polymorphic over posts + comments) ----------------------------
create table votes (
  id          uuid primary key default gen_random_uuid(),
  voter_id    uuid not null references profiles(id) on delete cascade,
  target_type vote_target not null,
  target_id   uuid not null,
  value       smallint not null check (value in (-1, 1)),
  created_at  timestamptz not null default now(),
  unique (voter_id, target_type, target_id)
);
create index votes_target_idx on votes (target_type, target_id);

-- ----- relationships (follow / mute / block) --------------------------------
create table relationships (
  actor_id   uuid not null references profiles(id) on delete cascade,
  target_id  uuid not null references profiles(id) on delete cascade,
  type       relationship_type not null,
  created_at timestamptz not null default now(),
  primary key (actor_id, target_id, type),
  check (actor_id <> target_id)
);
create index relationships_target_idx on relationships (target_id, type);

-- =============================================================================
-- Helper functions
-- =============================================================================

-- The current request's profile id (null if logged out / no profile).
create or replace function current_profile_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from profiles where user_id = auth.uid()
$$;

-- Is the current request a moderator?
create or replace function is_mod()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where user_id = auth.uid() and role = 'mod')
$$;

-- =============================================================================
-- Auto-create a profile when a new auth user signs up
-- =============================================================================
create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  base_username text;
  final_username text;
  suffix int := 0;
begin
  base_username := regexp_replace(lower(split_part(new.email, '@', 1)), '[^a-z0-9_]', '', 'g');
  if base_username = '' then base_username := 'member'; end if;
  final_username := base_username;
  while exists (select 1 from profiles where username = final_username) loop
    suffix := suffix + 1;
    final_username := base_username || suffix::text;
  end loop;

  insert into profiles (user_id, username, display_name)
  values (new.id, final_username, final_username);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- =============================================================================
-- Vote score + karma maintenance
-- vote_score on the target is the sum of votes; an author's karma is the sum of
-- vote_scores across all their posts + comments. Recomputed on any vote change.
-- =============================================================================
create or replace function recompute_vote_target(p_type vote_target, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_score  int;
  v_author uuid;
begin
  select coalesce(sum(value), 0) into v_score
    from votes where target_type = p_type and target_id = p_id;

  if p_type = 'post' then
    update posts set vote_score = v_score where id = p_id returning author_id into v_author;
  else
    update comments set vote_score = v_score where id = p_id returning author_id into v_author;
  end if;

  if v_author is not null then
    update profiles p set karma =
      coalesce((select sum(vote_score) from posts    where author_id = p.id), 0) +
      coalesce((select sum(vote_score) from comments where author_id = p.id), 0)
    where p.id = v_author;
  end if;
end;
$$;

create or replace function on_vote_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    perform recompute_vote_target(old.target_type, old.target_id);
    return old;
  end if;
  perform recompute_vote_target(new.target_type, new.target_id);
  if tg_op = 'UPDATE' and (old.target_id <> new.target_id or old.target_type <> new.target_type) then
    perform recompute_vote_target(old.target_type, old.target_id);
  end if;
  return new;
end;
$$;

create trigger votes_after_change
  after insert or update or delete on votes
  for each row execute function on_vote_change();

-- =============================================================================
-- Row Level Security
-- =============================================================================
alter table profiles      enable row level security;
alter table flairs        enable row level security;
alter table posts         enable row level security;
alter table post_flairs   enable row level security;
alter table comments      enable row level security;
alter table votes         enable row level security;
alter table relationships enable row level security;

-- profiles: world-readable; you may update only your own, and only presentational
-- columns (karma/role/gold are locked at the column-grant level below).
create policy profiles_select     on profiles for select using (true);
create policy profiles_update_own on profiles for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- flairs: world-readable. Writes reserved for mods/service (no client policy).
create policy flairs_select on flairs for select using (true);

-- posts: world-readable; author may insert/update/delete own.
create policy posts_select     on posts for select using (true);
create policy posts_insert_own on posts for insert with check (author_id = current_profile_id());
create policy posts_update_own on posts for update
  using (author_id = current_profile_id()) with check (author_id = current_profile_id());
create policy posts_delete_own on posts for delete using (author_id = current_profile_id());

-- post_flairs: readable by all; writable only by the post's author.
create policy post_flairs_select    on post_flairs for select using (true);
create policy post_flairs_write_own on post_flairs for all
  using      (exists (select 1 from posts p where p.id = post_id and p.author_id = current_profile_id()))
  with check (exists (select 1 from posts p where p.id = post_id and p.author_id = current_profile_id()));

-- comments: world-readable; author may insert/update/delete own.
create policy comments_select     on comments for select using (true);
create policy comments_insert_own on comments for insert with check (author_id = current_profile_id());
create policy comments_update_own on comments for update
  using (author_id = current_profile_id()) with check (author_id = current_profile_id());
create policy comments_delete_own on comments for delete using (author_id = current_profile_id());

-- votes: readable by all; you may only cast/change your own vote.
create policy votes_select    on votes for select using (true);
create policy votes_write_own on votes for all
  using (voter_id = current_profile_id()) with check (voter_id = current_profile_id());

-- relationships: visible to either side; you may only manage rows you initiated.
create policy relationships_select_own on relationships for select
  using (actor_id = current_profile_id() or target_id = current_profile_id());
create policy relationships_write_own on relationships for all
  using (actor_id = current_profile_id()) with check (actor_id = current_profile_id());

-- =============================================================================
-- Column-level lockdown: karma / role / gold_earned are server-maintained.
-- Even though a member can UPDATE their own profile row, they cannot touch
-- these columns — Postgres rejects the write. This is what makes karma
-- tamper-resistant. (Mod role assignment will go through a definer RPC later.)
-- =============================================================================
revoke update on profiles from authenticated;
grant  update (display_name, avatar_url, banner, member_flair_id) on profiles to authenticated;
-- profile rows are created by the signup trigger only:
revoke insert, delete on profiles from authenticated;

-- =============================================================================
-- Seed: flairs (post flairs from the prototype + themed member flairs)
-- =============================================================================
insert into flairs (scope, slug, label, bg, fg) values
  ('post',   'fanfiction',       'Fanfiction',       '#6A1B9A', '#f0e2ff'),
  ('post',   'art',              'Art',              '#8B4CC2', '#1a0b26'),
  ('post',   'music',            'Music',            '#267BA3', '#e6f5ff'),
  ('post',   'cosplay',          'Cosplay',          '#2FB7C8', '#06222a'),
  ('post',   'discussion',       'Discussion',       '#214E7A', '#dbeaff'),
  ('post',   'question',         'Question',         '#173B63', '#cfe0f5'),
  ('post',   'news',             'News',             '#C8A24A', '#1a1405'),
  ('post',   'meme',             'Meme',             '#4B0F5E', '#f3dcff'),
  ('post',   'nsfw',             'NSFW',             '#7a1f1f', '#ffd9d9'),
  ('member', 'dora-milaje',      'Dora Milaje',      '#6b3f1d', '#ffd9a8'),
  ('member', 'wakandan-council', 'Wakandan Council', '#173B63', '#cfe0f5'),
  ('member', 'jabari',           'Jabari',           '#214E7A', '#dbeaff'),
  ('member', 'outrider',         'Outrider',         '#4B0F5E', '#f3dcff'),
  ('member', 'wkabi-stan',       E'W\'Kabi Stan',    '#6b3f1d', '#ffd9a8');
