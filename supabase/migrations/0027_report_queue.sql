-- Reporting → mod report queue (MILESTONES §9). Users flag posts/comments;
-- mods action them from /mod/reports. Builds on 0026 (log_mod_action /
-- mod_actions). Idempotent throughout, per DB health rules.

-- ----- reports table -----------------------------------------------------------
create table if not exists reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment')),
  target_id   uuid not null,               -- no FK: the target may be removed later
  reason      text not null default '' check (char_length(reason) <= 500),
  status      text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolved_by uuid references profiles(id),
  resolved_at timestamptz,
  created_at  timestamptz not null default now()
);

-- One report per user per target; re-reporting is a no-op client-side.
create unique index if not exists reports_one_per_reporter
  on reports (reporter_id, target_type, target_id);
create index if not exists reports_status_idx on reports (status, created_at desc);

alter table reports enable row level security;

drop policy if exists reports_insert_own on reports;
create policy reports_insert_own on reports for insert
  with check (reporter_id = current_profile_id());

drop policy if exists reports_mod_read on reports;
create policy reports_mod_read on reports for select using (is_mod());

grant select, insert on reports to authenticated;

-- ----- mod RPCs ------------------------------------------------------------------

-- Close a report as 'resolved' (actioned) or 'dismissed' (no action needed).
create or replace function mod_resolve_report(p_report uuid, p_status text, p_note text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_mod() then raise exception 'Not a moderator'; end if;
  if p_status not in ('resolved', 'dismissed') then raise exception 'Bad status %', p_status; end if;
  update reports
    set status = p_status, resolved_by = current_profile_id(), resolved_at = now()
    where id = p_report and status = 'open';
  if found then
    perform log_mod_action(
      case when p_status = 'resolved' then 'resolve_report' else 'dismiss_report' end,
      'report', p_report, p_note);
  end if;
end;
$$;

-- Remove any comment (mod version of the author soft-delete: blank the body,
-- stamp deleted_at so child replies survive).
create or replace function mod_remove_comment(p_comment uuid, p_reason text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_mod() then raise exception 'Not a moderator'; end if;
  update comments
    set body = '[removed by moderators]', deleted_at = now()
    where id = p_comment and deleted_at is null;
  if found then
    perform log_mod_action('remove_comment', 'comment', p_comment,
      coalesce(nullif(trim(p_reason), ''), '(no reason given)'));
  end if;
end;
$$;
