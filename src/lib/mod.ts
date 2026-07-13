// Moderator actions — thin wrappers over the SECURITY DEFINER RPCs in
// migration 0007. Each is gated server-side by is_mod(); the UI only shows them
// to mods, but the database is the real enforcement.
import { supabase } from './supabase'
import { getMyProfileId } from './api'

export async function modSetPinned(postId: string, pinned: boolean): Promise<void> {
  const { error } = await supabase.rpc('mod_set_pinned', { p_post: postId, p_pinned: pinned })
  if (error) throw error
}

export async function modRemovePost(postId: string, reason = ''): Promise<void> {
  const { error } = await supabase.rpc('mod_remove_post', { p_post: postId, p_reason: reason })
  if (error) throw error
}

/** Lock (or unlock) a post's comments. */
export async function modSetLocked(postId: string, locked: boolean): Promise<void> {
  const { error } = await supabase.rpc('mod_set_locked', { p_post: postId, p_locked: locked })
  if (error) throw error
}

export interface UiModAction {
  id: string
  mod: string // username
  action: string
  detail: string
  when: string // ISO
}

/** Recent mod actions, newest first (RLS: mods only). */
export async function fetchModLog(limit = 100): Promise<UiModAction[]> {
  const { data, error } = await supabase
    .from('mod_actions')
    .select('id, action, detail, created_at, mod:profiles(username)')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.id,
    mod: r.mod?.username ?? 'unknown',
    action: r.action,
    detail: r.detail ?? '',
    when: r.created_at,
  }))
}

/** Mod removal of any comment: soft-delete so child replies survive. */
export async function modRemoveComment(commentId: string, reason = ''): Promise<void> {
  const { error } = await supabase.rpc('mod_remove_comment', { p_comment: commentId, p_reason: reason })
  if (error) throw error
}

export interface UiReport {
  id: string
  targetType: 'post' | 'comment'
  targetId: string
  reason: string
  reporter: string // username
  status: 'open' | 'resolved' | 'dismissed'
  when: string // ISO
}

/** Reports, newest first (RLS: mods only). Two FKs to profiles, so name the reporter FK. */
export async function fetchReports(view: 'open' | 'closed' = 'open'): Promise<UiReport[]> {
  let q = supabase
    .from('reports')
    .select('id, target_type, target_id, reason, status, created_at, reporter:profiles!reports_reporter_id_fkey(username)')
    .order('created_at', { ascending: false })
    .limit(200)
  q = view === 'open' ? q.eq('status', 'open') : q.neq('status', 'open')
  const { data, error } = await q
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.id,
    targetType: r.target_type,
    targetId: r.target_id,
    reason: r.reason ?? '',
    reporter: r.reporter?.username ?? 'unknown',
    status: r.status,
    when: r.created_at,
  }))
}

/** Close a report: 'resolved' (actioned) or 'dismissed' (no action needed). */
export async function modResolveReport(reportId: string, status: 'resolved' | 'dismissed', note = ''): Promise<void> {
  const { error } = await supabase.rpc('mod_resolve_report', { p_report: reportId, p_status: status, p_note: note })
  if (error) throw error
}

export interface ReportTargetPreview {
  text: string // post title or comment body excerpt; '' if the target is gone
  link: string | null // in-app link to view the target; null if gone
  gone: boolean
}

/** Batch-load previews for report targets. Key: `${targetType}:${targetId}`. */
export async function fetchReportTargets(reports: UiReport[]): Promise<Record<string, ReportTargetPreview>> {
  const postIds = [...new Set(reports.filter((r) => r.targetType === 'post').map((r) => r.targetId))]
  const commentIds = [...new Set(reports.filter((r) => r.targetType === 'comment').map((r) => r.targetId))]
  const out: Record<string, ReportTargetPreview> = {}
  if (postIds.length) {
    const { data, error } = await supabase.from('posts').select('id, title').in('id', postIds)
    if (error) throw error
    for (const p of data ?? []) out[`post:${p.id}`] = { text: p.title, link: `/post/${p.id}`, gone: false }
  }
  if (commentIds.length) {
    const { data, error } = await supabase.from('comments').select('id, body, post_id, deleted_at').in('id', commentIds)
    if (error) throw error
    for (const c of data ?? [])
      out[`comment:${c.id}`] = { text: c.body, link: `/post/${c.post_id}#comment-${c.id}`, gone: !!c.deleted_at }
  }
  for (const r of reports) {
    const k = `${r.targetType}:${r.targetId}`
    if (!out[k]) out[k] = { text: '', link: null, gone: true } // target already removed
  }
  return out
}

export async function modSetPostFlairs(postId: string, slugs: string[]): Promise<void> {
  const { error } = await supabase.rpc('mod_set_post_flairs', { p_post: postId, p_slugs: slugs })
  if (error) throw error
}

/** Promote a member to mod, or demote a mod (the DB refuses to demote the last mod). */
export async function modSetRole(profileId: string, mod: boolean): Promise<void> {
  const { error } = await supabase.rpc('mod_set_role', { p_profile: profileId, p_mod: mod })
  if (error) throw error
}

/** Ban or unban a member (the DB refuses to ban a mod). Banned members can't post or comment. */
export async function modSetBanned(profileId: string, banned: boolean, reason = ''): Promise<void> {
  const { error } = await supabase.rpc('mod_set_banned', { p_profile: profileId, p_banned: banned, p_reason: reason })
  if (error) throw error
}

/** Mark/unmark my own comment as an official mod comment. */
export async function modSetCommentDistinguished(commentId: string, on: boolean): Promise<void> {
  const { error } = await supabase.rpc('mod_set_comment_distinguished', { p_comment: commentId, p_on: on })
  if (error) throw error
}

/** Pin/unpin my own top-level comment to the top of the thread (also distinguishes it). */
export async function modSetCommentSticky(commentId: string, on: boolean): Promise<void> {
  const { error } = await supabase.rpc('mod_set_comment_sticky', { p_comment: commentId, p_on: on })
  if (error) throw error
}

export async function modAssignMemberFlair(profileId: string, slug: string | null): Promise<void> {
  const { error } = await supabase.rpc('mod_assign_member_flair', { p_profile: profileId, p_slug: slug })
  if (error) throw error
}

// ----- saved responses (canned mod replies, MILESTONES §9) -----

export interface UiSavedResponse {
  id: string
  title: string
  body: string
}

/** All saved responses, newest first (mods only via RLS). */
export async function fetchSavedResponses(): Promise<UiSavedResponse[]> {
  const { data, error } = await supabase
    .from('mod_saved_responses')
    .select('id, title, body')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as UiSavedResponse[]
}

export async function createSavedResponse(title: string, body: string): Promise<UiSavedResponse> {
  const me = await getMyProfileId()
  if (!me) throw new Error('Not signed in')
  const { data, error } = await supabase
    .from('mod_saved_responses')
    .insert({ title: title.trim(), body: body.trim(), created_by: me })
    .select('id, title, body')
    .single()
  if (error) throw error
  return data as UiSavedResponse
}

export async function deleteSavedResponse(id: string): Promise<void> {
  const { error } = await supabase.from('mod_saved_responses').delete().eq('id', id)
  if (error) throw error
}
