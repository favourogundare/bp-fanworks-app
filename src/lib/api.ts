// Data layer: reads from Supabase and maps rows into the UI shapes in types.ts.
// Embeds use PostgREST's relationship syntax (author:profiles(...), etc.), which
// works because each foreign key here is unambiguous.

import { supabase } from './supabase'
import { timeAgo, accountAge, formatCount } from './time'
import type { UiComment, UiPost, UiPinned, UiProfile } from './types'

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
    links: Array.isArray(row.links) ? (row.links as string[]) : [],
    pinned: !!row.pinned,
    commentCount: row.comments?.[0]?.count ?? 0,
    comments: [],
  }
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
    nodes.set(r.id, {
      id: r.id,
      author: r.author?.username ?? 'unknown',
      when: timeAgo(r.created_at),
      flair: r.author_id === postAuthorId ? 'OP' : null,
      body: r.body,
      votes: r.vote_score ?? 0,
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
    .select('id, body, vote_score, parent_id, created_at, author_id, author:profiles(username)')
    .eq('post_id', id)
    .order('created_at', { ascending: true })
  if (cErr) throw cErr

  const tree = buildCommentTree(comments ?? [], post.author_id)
  return { ...mapPost(post), comments: tree, commentCount: countTree(tree) }
}

/** A member profile + their profile-surface posts, with follower/contribution counts. */
export async function fetchProfile(username: string): Promise<UiProfile | null> {
  const { data: p, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, role, karma, gold_earned, banner, created_at, member_flair:flairs(label)')
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
    username: p.username,
    display: p.display_name || p.username,
    flair: (p.member_flair as Row | null)?.label ?? null,
    banner: p.banner || '',
    followers: followersRes.count ?? 0,
    karma: (p.karma ?? 0).toLocaleString(),
    contributions: contribRes.count ?? 0,
    age: accountAge(p.created_at),
    gold: p.gold_earned ?? 0,
    achievements: 'No achievements yet',
    unlocked: 0,
    isMod: p.role === 'mod',
    posts: (postsRes.data ?? []).map(mapPost),
  }
}
