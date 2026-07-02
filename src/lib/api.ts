// Data layer: reads from Supabase and maps rows into the UI shapes in types.ts.
// Embeds use PostgREST's relationship syntax (author:profiles(...), etc.), which
// works because each foreign key here is unambiguous.

import { supabase } from './supabase'
import { timeAgo, accountAge, formatCount } from './time'
import type { UiComment, UiPost, UiPinned, UiProfile, UiUserPreview } from './types'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

// ----- current member identity (cached) -----
let cachedProfileId: string | null = null

/** The signed-in member's profile id (cached for the session). */
export async function getMyProfileId(): Promise<string | null> {
  if (cachedProfileId) return cachedProfileId
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', auth.user.id)
    .maybeSingle()
  cachedProfileId = data?.id ?? null
  return cachedProfileId
}

/** Clear the cached profile id (call on sign-out). */
export function resetProfileCache() {
  cachedProfileId = null
}

/** The signed-in member's identity for the app shell: profile id, username, mod flag. */
export async function fetchMyIdentity(): Promise<{ profileId: string; username: string; isMod: boolean } | null> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data } = await supabase
    .from('profiles')
    .select('id, username, role')
    .eq('user_id', auth.user.id)
    .maybeSingle()
  if (!data) return null
  cachedProfileId = data.id
  return { profileId: data.id, username: data.username, isMod: data.role === 'mod' }
}

// ----- creating posts, comments, and uploading media -----
export async function createPost(input: {
  type: string
  title: string
  body: string
  flairSlugs: string[]
  media?: string[]
  surface?: 'community' | 'profile'
}): Promise<string> {
  const me = await getMyProfileId()
  if (!me) throw new Error('Not signed in')
  const { data: post, error } = await supabase
    .from('posts')
    .insert({
      author_id: me,
      surface: input.surface ?? 'community',
      type: input.type,
      title: input.title,
      body: input.body,
      media: input.media ?? [],
    })
    .select('id')
    .single()
  if (error) throw error

  if (input.flairSlugs?.length) {
    const { data: flairs } = await supabase
      .from('flairs')
      .select('id, slug')
      .eq('scope', 'post')
      .in('slug', input.flairSlugs)
    const rows = (flairs ?? []).map((f: Row) => ({ post_id: post.id, flair_id: f.id }))
    if (rows.length) {
      const { error: fErr } = await supabase.from('post_flairs').insert(rows)
      if (fErr) throw fErr
    }
  }
  return post.id
}

export async function createComment(input: {
  postId: string
  body: string
  parentId?: string | null
}): Promise<void> {
  const me = await getMyProfileId()
  if (!me) throw new Error('Not signed in')
  const { error } = await supabase.from('comments').insert({
    post_id: input.postId,
    author_id: me,
    parent_id: input.parentId ?? null,
    body: input.body,
  })
  if (error) throw error
}

// ----- editing / deleting own content (RLS enforces ownership) -----
export async function updatePost(id: string, fields: { title: string; body: string }): Promise<void> {
  const { error } = await supabase
    .from('posts')
    .update({ title: fields.title, body: fields.body })
    .eq('id', id)
  if (error) throw error
}

export async function deletePost(id: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', id)
  if (error) throw error
}

export async function updateComment(id: string, body: string): Promise<void> {
  const { error } = await supabase.from('comments').update({ body }).eq('id', id)
  if (error) throw error
}

// Soft delete: keep the row (blank its body, stamp deleted_at) so child replies
// survive. Hard-deleting would cascade to replies via comments.parent_id and
// destroy other members' content. RLS comments_update_own restricts this to the
// comment's author, same path as an edit. (See migration 0008.)
export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase
    .from('comments')
    .update({ body: '[deleted]', deleted_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Upload files to the public post-media bucket; returns their public URLs. */
export async function uploadMedia(files: File[]): Promise<string[]> {
  const urls: string[] = []
  for (const file of files) {
    const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const path = `${crypto.randomUUID()}-${safe}`
    const { error } = await supabase.storage.from('post-media').upload(path, file)
    if (error) throw error
    urls.push(supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl)
  }
  return urls
}

// ----- voting -----
type VoteTarget = 'post' | 'comment'

/** The signed-in member's current vote on a target: 1, -1, or 0 (none). */
export async function getMyVote(targetType: VoteTarget, targetId: string): Promise<number> {
  const voterId = await getMyProfileId()
  if (!voterId) return 0
  const { data } = await supabase
    .from('votes')
    .select('value')
    .match({ voter_id: voterId, target_type: targetType, target_id: targetId })
    .maybeSingle()
  return data?.value ?? 0
}

/**
 * Cast or clear a vote. value of 0 removes the vote; otherwise upserts +1/-1.
 * The DB triggers recompute the target's score and the author's karma.
 */
export async function castVote(targetType: VoteTarget, targetId: string, value: number): Promise<void> {
  const voterId = await getMyProfileId()
  if (!voterId) throw new Error('Not signed in')
  if (value === 0) {
    const { error } = await supabase
      .from('votes')
      .delete()
      .match({ voter_id: voterId, target_type: targetType, target_id: targetId })
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('votes')
      .upsert(
        { voter_id: voterId, target_type: targetType, target_id: targetId, value },
        { onConflict: 'voter_id,target_type,target_id' },
      )
    if (error) throw error
  }
}

const POST_FIELDS =
  'id, title, body, type, pinned, vote_score, view_count, created_at, media, links, ' +
  'author:profiles(username), post_flairs(flairs(slug)), comments(count)'

function mapPost(row: Row): UiPost {
  return {
    id: row.id,
    author: row.author?.username ?? 'unknown',
    when: timeAgo(row.created_at),
    title: row.title,
    flairs: (row.post_flairs ?? [])
      .map((pf: Row) => pf.flairs?.slug)
      .filter(Boolean) as string[],
    type: row.type,
    body: row.body ?? '',
    votes: row.vote_score ?? 0,
    views: row.view_count ? formatCount(row.view_count) : undefined,
    image: Array.isArray(row.media) && row.media.length > 0,
    media: Array.isArray(row.media) ? (row.media as string[]) : [],
    links: Array.isArray(row.links) ? (row.links as string[]) : [],
    pinned: !!row.pinned,
    commentCount: row.comments?.[0]?.count ?? 0,
    comments: [],
  }
}

/** Live community stats for the sidebar: total members and contribution posts. */
export async function fetchCommunityStats(): Promise<{ members: number; contributions: number }> {
  const [membersRes, contribRes] = await Promise.all([
    supabase.from('profiles').select('id', { count: 'exact', head: true }),
    supabase.from('posts').select('id', { count: 'exact', head: true }).eq('surface', 'community'),
  ])
  return { members: membersRes.count ?? 0, contributions: contribRes.count ?? 0 }
}

/** Newest community posts (excludes pinned highlights). */
export async function fetchCommunityFeed(): Promise<UiPost[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_FIELDS)
    .eq('surface', 'community')
    .eq('pinned', false)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapPost)
}

/** Pinned "Community highlights" cards. */
export async function fetchPinned(): Promise<UiPinned[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('id, title, vote_score, comments(count)')
    .eq('surface', 'community')
    .eq('pinned', true)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r: Row) => ({
    id: r.id,
    title: r.title,
    votes: r.vote_score ?? 0,
    comments: r.comments?.[0]?.count ?? 0,
  }))
}

function buildCommentTree(rows: Row[], postAuthorId: string): UiComment[] {
  const nodes = new Map<string, UiComment>()
  const roots: UiComment[] = []
  for (const r of rows) {
    const deleted = !!r.deleted_at
    nodes.set(r.id, {
      id: r.id,
      author: deleted ? '[deleted]' : (r.author?.username ?? 'unknown'),
      when: timeAgo(r.created_at),
      flair: deleted ? null : (r.author_id === postAuthorId ? 'OP' : null),
      body: deleted ? '[deleted]' : r.body,
      votes: r.vote_score ?? 0,
      deleted,
      replies: [],
    })
  }
  for (const r of rows) {
    const node = nodes.get(r.id)!
    const parent = r.parent_id ? nodes.get(r.parent_id) : undefined
    if (parent) parent.replies.push(node)
    else roots.push(node)
  }
  return roots
}

function countTree(nodes: UiComment[]): number {
  return nodes.reduce((sum, n) => sum + 1 + countTree(n.replies), 0)
}

/** A single post with its full, nested comment thread. */
export async function fetchPostWithComments(id: string): Promise<UiPost> {
  const { data: post, error } = await supabase
    .from('posts')
    .select(`${POST_FIELDS}, author_id`)
    .eq('id', id)
    .single()
  if (error) throw error

  const { data: comments, error: cErr } = await supabase
    .from('comments')
    .select('id, body, vote_score, parent_id, created_at, author_id, deleted_at, author:profiles(username)')
    .eq('post_id', id)
    .order('created_at', { ascending: true })
  if (cErr) throw cErr

  const tree = buildCommentTree(comments ?? [], post.author_id)
  return { ...mapPost(post), comments: tree, commentCount: countTree(tree) }
}

// ----- relationships (follow / mute / block) -----
export type RelType = 'follow' | 'mute' | 'block'

/** This member's current relationship flags toward a target profile. */
export async function getRelationshipState(
  targetProfileId: string,
): Promise<{ follow: boolean; mute: boolean; block: boolean }> {
  const me = await getMyProfileId()
  const blank = { follow: false, mute: false, block: false }
  if (!me) return blank
  const { data } = await supabase
    .from('relationships')
    .select('type')
    .eq('actor_id', me)
    .eq('target_id', targetProfileId)
  const types = new Set((data ?? []).map((r: Row) => r.type))
  return { follow: types.has('follow'), mute: types.has('mute'), block: types.has('block') }
}

/** Add (on=true) or remove (on=false) a relationship of the given type. */
export async function setRelationship(targetProfileId: string, type: RelType, on: boolean): Promise<void> {
  const me = await getMyProfileId()
  if (!me) throw new Error('Not signed in')
  if (me === targetProfileId) throw new Error("You can't do that to yourself")
  if (on) {
    const { error } = await supabase
      .from('relationships')
      .upsert({ actor_id: me, target_id: targetProfileId, type }, { onConflict: 'actor_id,target_id,type' })
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('relationships')
      .delete()
      .match({ actor_id: me, target_id: targetProfileId, type })
    if (error) throw error
  }
}

/** Usernames whose posts should be hidden from this member's feed (muted OR blocked). */
export async function fetchHiddenUsernames(): Promise<string[]> {
  const me = await getMyProfileId()
  if (!me) return []
  const { data } = await supabase
    .from('relationships')
    .select('type, target:profiles!relationships_target_id_fkey(username)')
    .eq('actor_id', me)
    .in('type', ['mute', 'block'])
  return (data ?? []).map((r: Row) => r.target?.username).filter(Boolean) as string[]
}

// Fields shared by the full profile-page fetch and the lightweight hover-card
// preview fetch below.
const PROFILE_CORE_FIELDS = 'id, username, display_name, role, created_at, member_flair:flairs(label)'

function mapProfileCore(p: Row): UiUserPreview {
  return {
    id: p.id,
    username: p.username,
    display: p.display_name || p.username,
    flair: (p.member_flair as Row | null)?.label ?? null,
    age: accountAge(p.created_at),
    isMod: p.role === 'mod',
  }
}

/** Lean profile fields for a username hover card — no posts, no counts. */
export async function fetchUserPreview(username: string): Promise<UiUserPreview | null> {
  const { data: p, error } = await supabase
    .from('profiles')
    .select(PROFILE_CORE_FIELDS)
    .eq('username', username)
    .maybeSingle()
  if (error) throw error
  if (!p) return null
  return mapProfileCore(p)
}

/** A member profile + their profile-surface posts, with follower/contribution counts. */
export async function fetchProfile(username: string): Promise<UiProfile | null> {
  const { data: p, error } = await supabase
    .from('profiles')
    .select(`${PROFILE_CORE_FIELDS}, karma, gold_earned, banner`)
    .eq('username', username)
    .maybeSingle()
  if (error) throw error
  if (!p) return null

  const [postsRes, followersRes, contribRes] = await Promise.all([
    supabase
      .from('posts')
      .select(POST_FIELDS)
      .eq('author_id', p.id)
      .eq('surface', 'profile')
      .order('created_at', { ascending: false }),
    supabase
      .from('relationships')
      .select('*', { count: 'exact', head: true })
      .eq('target_id', p.id)
      .eq('type', 'follow'),
    supabase
      .from('posts')
      .select('*', { count: 'exact', head: true })
      .eq('author_id', p.id),
  ])

  return {
    ...mapProfileCore(p),
    banner: p.banner || '',
    followers: followersRes.count ?? 0,
    karma: (p.karma ?? 0).toLocaleString(),
    contributions: contribRes.count ?? 0,
    gold: p.gold_earned ?? 0,
    achievements: 'No achievements yet',
    unlocked: 0,
    posts: (postsRes.data ?? []).map(mapPost),
  }
}
