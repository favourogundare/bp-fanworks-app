-- Post collaboration / co-authors (MILESTONES §4): credit 2+ members on one
-- post. posts.author_id stays the primary author; post_coauthors adds the
-- others. Joint works surface on every credited member's profile shelf, and
-- the collaboration shows on the post page.
--
-- "Added/removed with permission": only the post's author may add a co-author
-- (RLS checks posts.author_id); a co-author may remove themselves (opt-out).
-- No accept/invite flow — the author credits collaborators directly, and any
-- co-author can leave. Idempotent throughout, per DB health rules.

create table if not exists post_coauthors (
  post_id    uuid not null references posts(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  added_at   timestamptz not null default now(),
  primary key (post_id, profile_id)
);

create index if not exists post_coauthors_profile_idx on post_coauthors (profile_id);

alter table post_coauthors enable row level security;

-- Public read (credits are shown to everyone).
drop policy if exists post_coauthors_public_read on post_coauthors;
create policy post_coauthors_public_read on post_coauthors for select using (true);

-- Insert: only the post's author may add co-authors, and never themselves.
drop policy if exists post_coauthors_author_add on post_coauthors;
create policy post_coauthors_author_add on post_coauthors for insert
  with check (
    profile_id <> current_profile_id()
    and exists (select 1 from posts p where p.id = post_id and p.author_id = current_profile_id())
  );

-- Delete: the post's author (remove a credit) or the co-author (leave).
drop policy if exists post_coauthors_author_or_self_remove on post_coauthors;
create policy post_coauthors_author_or_self_remove on post_coauthors for delete
  using (
    profile_id = current_profile_id()
    or exists (select 1 from posts p where p.id = post_id and p.author_id = current_profile_id())
  );

grant select on post_coauthors to anon;
grant select, insert, delete on post_coauthors to authenticated;
