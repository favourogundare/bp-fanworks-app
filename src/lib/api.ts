// Data layer: reads from Supabase and maps rows into the UI shapes in types.ts.
// Embeds use PostgREST's relationship syntax (author:profiles(...), etc.).
// posts<->profiles has TWO paths since poll_votes (0014), so embeds between
// those tables must name their FK (profiles!posts_author_id_fkey) or PostgREST
// rejects the query with PGRST201.

import { supabase } from './supabase'
import { timeAgo, accountAge, formatCount } from './time'
import { PROFILE_THEMES } from './palettes'
import type { UiComment, UiPost, UiPinned, UiProfile, UiUserPreview, UiCommissionListing, UiCommissionRequest, UiBookmark, UiCircle, UiCircleMember, UiWikiPage, UiWikiPageMeta, UiWikiRevision } from './types'

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

/** The signed-in member's identity for the app shell: profile id, username, mod flag, content prefs. */
export async function fetchMyIdentity(): Promise<{ profileId: string; username: string; isMod: boolean; blurMedia: boolean; spoilerFree: boolean; spoilerTags: string[]; mutedTags: string[] } | null> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return null
  const { data } = await supabase
    .from('profiles')
    .select('id, username, role, blur_media, spoiler_free, spoiler_tags, muted_tags')
    .eq('user_id', auth.user.id)
    .maybeSingle()
  if (!data) return null
  cachedProfileId = data.id
  return { profileId: data.id, username: data.username, isMod: data.role === 'mod', blurMedia: data.blur_media ?? true, spoilerFree: data.spoiler_free ?? false, spoilerTags: data.spoiler_tags ?? [], mutedTags: data.muted_tags ?? [] }
}

// ----- creating posts, comments, and uploading media -----
export async function createPost(input: {
  type: string
  title: string
  body: string
  flairSlugs: string[]
  media?: string[]
  pollOptions?: string[]
  contentWarnings?: string[]
  scheduledAt?: string | null
  surface?: 'community' | 'profile'
  circleId?: string | null // post into a circle; null/undefined = General feed
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
      poll_options: input.pollOptions ?? [],
      content_warnings: input.contentWarnings ?? [],
      scheduled_at: input.scheduledAt ?? null,
      circle_id: input.circleId ?? null,
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

// ----- reporting content (mod report queue) -----
/** File a report on a post or comment. Re-reporting the same target is a no-op. */
export async function submitReport(targetType: 'post' | 'comment', targetId: string, reason: string): Promise<void> {
  const me = await getMyProfileId()
  if (!me) throw new Error('Not signed in')
  const { error } = await supabase
    .from('reports')
    .insert({ reporter_id: me, target_type: targetType, target_id: targetId, reason: reason.slice(0, 500) })
  if (error && error.code !== '23505') throw error // 23505: already reported this target
}

// ----- creator post insights (MILESTONES §7 "Post analytics for creators", v1) -----

export type PostInsights = {
  score: number
  upvotes: number
  downvotes: number
  commentCount: number
}

/**
 * Aggregate engagement for ONE of the caller's own posts, read entirely from
 * already-public data (votes and comments are world-readable) — no migration,
 * no new tables. Returns null unless the signed-in member authored the post:
 * the numbers aren't secret, but insights are a creator-only surface, so the
 * author check lives here and not just in the UI. Save counts can't join v1 —
 * saved_items RLS (0011) is saver-private, so counting them needs a definer
 * RPC (deferred to v2 along with view tracking).
 */
export async function fetchMyPostInsights(postId: string): Promise<PostInsights | null> {
  const me = await getMyProfileId()
  if (!me) return null
  const { data: post } = await supabase
    .from('posts')
    .select('author_id, vote_score, comments(count)')
    .eq('id', postId)
    .maybeSingle()
  if (!post || post.author_id !== me) return null

  const countVotes = (value: number) =>
    supabase
      .from('votes')
      .select('*', { count: 'exact', head: true })
      .match({ target_type: 'post', target_id: postId, value })
  const [up, down] = await Promise.all([countVotes(1), countVotes(-1)])

  return {
    score: post.vote_score ?? 0,
    upvotes: up.count ?? 0,
    downvotes: down.count ?? 0,
    commentCount: (post as Row).comments?.[0]?.count ?? 0,
  }
}

// author embed names its FK: poll_votes added a second posts<->profiles path
// (many-to-many), so a bare profiles embed is ambiguous (PGRST201).
const POST_FIELDS =
  'id, title, body, type, pinned, profile_pinned_at, locked_at, scheduled_at, archived_at, vote_score, view_count, created_at, media, links, poll_options, content_warnings, ' +
  'author:profiles!posts_author_id_fkey(username), post_flairs(flairs(slug)), comments(count), circle:circles(slug, name), ' +
  'post_coauthors(profile:profiles(username))'

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
    pollOptions: Array.isArray(row.poll_options) ? (row.poll_options as string[]) : [],
    warnings: Array.isArray(row.content_warnings) ? (row.content_warnings as string[]) : [],
    pinned: !!row.pinned,
    locked: !!row.locked_at,
    profilePinned: !!row.profile_pinned_at,
    scheduledAt: row.scheduled_at ?? null,
    archived: !!row.archived_at,
    commentCount: row.comments?.[0]?.count ?? 0,
    comments: [],
    circle: row.circle ? { slug: row.circle.slug, name: row.circle.name } : null,
    coauthors: (row.post_coauthors ?? []).map((c: Row) => c.profile?.username).filter(Boolean) as string[],
  }
}

// ----- polls -----
export interface PollResults {
  counts: number[] // votes per option index
  total: number
  myVote: number | null // option index this member picked, or null
}

/** Live poll results for a post plus the signed-in member's current pick. */
export async function fetchPollResults(postId: string, optionCount: number): Promise<PollResults> {
  const me = await getMyProfileId()
  const { data, error } = await supabase
    .from('poll_votes')
    .select('voter_id, option_idx')
    .eq('post_id', postId)
  if (error) throw error
  const counts = new Array(optionCount).fill(0)
  let myVote: number | null = null
  for (const v of data ?? []) {
    if (v.option_idx >= 0 && v.option_idx < optionCount) counts[v.option_idx]++
    if (me && v.voter_id === me) myVote = v.option_idx
  }
  return { counts, total: (data ?? []).length, myVote }
}

/** Cast or change this member's vote on a poll (one vote per poll). */
export async function castPollVote(postId: string, optionIdx: number): Promise<void> {
  const me = await getMyProfileId()
  if (!me) throw new Error('Not signed in')
  const { error } = await supabase
    .from('poll_votes')
    .upsert({ post_id: postId, voter_id: me, option_idx: optionIdx }, { onConflict: 'post_id,voter_id' })
  if (error) throw error
}

/** Live community stats for the sidebar: joined members and contribution posts. */
export async function fetchCommunityStats(): Promise<{ members: number; contributions: number }> {
  const [membersRes, contribRes] = await Promise.all([
    supabase.from('community_members').select('member_id', { count: 'exact', head: true }),
    supabase.from('posts').select('id', { count: 'exact', head: true }).eq('surface', 'community'),
  ])
  return { members: membersRes.count ?? 0, contributions: contribRes.count ?? 0 }
}

// ----- community membership -----

/** Whether the signed-in member has joined the community. */
export async function fetchMyMembership(): Promise<boolean> {
  const me = await getMyProfileId()
  if (!me) return false
  const { data } = await supabase.from('community_members').select('member_id').eq('member_id', me).maybeSingle()
  return !!data
}

/** Join (on=true) or leave the community. */
export async function setMembership(on: boolean): Promise<void> {
  const me = await getMyProfileId()
  if (!me) throw new Error('Not signed in')
  if (on) {
    const { error } = await supabase
      .from('community_members')
      .upsert({ member_id: me }, { onConflict: 'member_id' })
    if (error) throw error
  } else {
    const { error } = await supabase.from('community_members').delete().eq('member_id', me)
    if (error) throw error
  }
}

export type FeedSort = 'hot' | 'top' | 'new'

// ponytail: Reddit hot algorithm; tune 45000 (≈12.5h window) if feed feels stale/churny
function hotScore(row: Row): number {
  const s = row.vote_score ?? 0
  const order = Math.log10(Math.max(Math.abs(s), 1))
  const sign = s > 0 ? 1 : s < 0 ? -1 : 0
  const secs = new Date(row.created_at).getTime() / 1000 - 1_600_000_000 // epoch offset keeps numbers small
  return order * sign + secs / 45000
}

/** Community posts by sort (excludes pinned highlights). */
export async function fetchCommunityFeed(sort: FeedSort = 'new'): Promise<UiPost[]> {
  const q = supabase
    .from('posts')
    .select(POST_FIELDS)
    .eq('surface', 'community')
    .eq('pinned', false)
    .is('circle_id', null) // circle posts live in their circle, not the General feed
    .is('archived_at', null)
  if (sort === 'top') q.order('vote_score', { ascending: false }).order('created_at', { ascending: false })
  else q.order('created_at', { ascending: false }) // 'new' and 'hot' both start newest-first
  const { data, error } = await q
  if (error) throw error
  const rows = data ?? []
  if (sort === 'hot') rows.sort((a, b) => hotScore(b) - hotScore(a)) // ponytail: client sort, feed unpaginated & small
  return rows.map(mapPost)
}

/** Community posts carrying the given flair slug, newest first (for /t/:slug). */
export async function fetchTagFeed(slug: string): Promise<UiPost[]> {
  // Rooted at the join table: one row per (post, matched flair), so posts with
  // several flairs can't come back duplicated (which an !inner embed on posts
  // does). Client-side sort because PostgREST can't order parents by embed cols.
  const { data, error } = await supabase
    .from('post_flairs')
    .select(`flairs!inner(slug), post:posts!inner(${POST_FIELDS})`)
    .eq('flairs.slug', slug)
    .eq('post.surface', 'community')
    .is('post.archived_at', null)
  if (error) throw error
  return (data ?? [])
    .map((r: Row) => r.post)
    .filter(Boolean)
    .sort((a: Row, b: Row) => (a.created_at < b.created_at ? 1 : -1))
    .map(mapPost)
}

// ----- followed tags (flairs) -----

/** Flair slugs the signed-in member follows. */
export async function fetchMyFollowedTags(): Promise<string[]> {
  const me = await getMyProfileId()
  if (!me) return []
  const { data } = await supabase.from('tag_follows').select('flair_slug').eq('follower_id', me)
  return (data ?? []).map((r: Row) => r.flair_slug)
}

/** Follow (on=true) or unfollow a flair. */
export async function toggleTagFollow(slug: string, on: boolean): Promise<void> {
  const me = await getMyProfileId()
  if (!me) throw new Error('Not signed in')
  if (on) {
    const { error } = await supabase
      .from('tag_follows')
      .upsert({ follower_id: me, flair_slug: slug }, { onConflict: 'follower_id,flair_slug' })
    if (error) throw error
  } else {
    const { error } = await supabase.from('tag_follows').delete().match({ follower_id: me, flair_slug: slug })
    if (error) throw error
  }
}

/** Community posts carrying any flair the member follows, newest first. */
export async function fetchFollowedFeed(): Promise<UiPost[]> {
  // Following = posts carrying a followed tag + posts in followed reading
  // lists, merged and deduped, newest first.
  const me = await getMyProfileId()
  const [slugs, listFollows] = await Promise.all([
    fetchMyFollowedTags(),
    me
      ? supabase.from('collection_follows').select('collection_id').eq('follower_id', me)
      : Promise.resolve({ data: [] as Row[], error: null }),
  ])
  const listIds = (listFollows.data ?? []).map((r: Row) => r.collection_id)
  if (!slugs.length && !listIds.length) return []

  const [tagRes, listRes] = await Promise.all([
    slugs.length
      ? // Same join-rooted shape as fetchTagFeed.
        supabase
          .from('post_flairs')
          .select(`flairs!inner(slug), post:posts!inner(${POST_FIELDS})`)
          .in('flairs.slug', slugs)
          .eq('post.surface', 'community')
          .is('post.archived_at', null)
      : Promise.resolve({ data: [] as Row[], error: null }),
    listIds.length
      ? // List posts are included regardless of surface — a list is a
        // deliberate curation, so profile-surface posts belong too.
        supabase
          .from('collection_items')
          .select(`collection_id, post:posts!inner(${POST_FIELDS})`)
          .in('collection_id', listIds)
          .is('post.archived_at', null)
      : Promise.resolve({ data: [] as Row[], error: null }),
  ])
  if (tagRes.error) throw tagRes.error
  if (listRes.error) throw listRes.error

  const seen = new Set<string>()
  return [...(tagRes.data ?? []), ...(listRes.data ?? [])]
    .map((r: Row) => r.post)
    .filter((p: Row) => p && !seen.has(p.id) && seen.add(p.id))
    .sort((a: Row, b: Row) => (a.created_at < b.created_at ? 1 : -1))
    .map(mapPost)
}

// ----- saved / bookmarked items (private, RLS-scoped to the saver) -----

/** Whether the signed-in member has saved this target. */
export async function getMySaved(targetType: VoteTarget, targetId: string): Promise<boolean> {
  const me = await getMyProfileId()
  if (!me) return false
  const { data } = await supabase
    .from('saved_items')
    .select('target_id')
    .match({ saver_id: me, target_type: targetType, target_id: targetId })
    .maybeSingle()
  return !!data
}

/** Save (on=true) or unsave a post/comment. */
export async function toggleSaved(targetType: VoteTarget, targetId: string, on: boolean): Promise<void> {
  const me = await getMyProfileId()
  if (!me) throw new Error('Not signed in')
  if (on) {
    const { error } = await supabase
      .from('saved_items')
      .upsert({ saver_id: me, target_type: targetType, target_id: targetId }, { onConflict: 'saver_id,target_type,target_id' })
    if (error) throw error
  } else {
    // Folders are views over saves: unsaving must also drop the item from all of
    // this member's folders (RLS scopes the delete to folders they own). Do this
    // FIRST and check the result — if it fails we bail before removing the save,
    // so we never leave a folder pointing at an unsaved item (which would inflate
    // folder counts and surface phantom rows in the folder view).
    const { error: folderErr } = await supabase
      .from('folder_items')
      .delete()
      .match({ target_type: targetType, target_id: targetId })
    if (folderErr) throw folderErr
    const { error } = await supabase
      .from('saved_items')
      .delete()
      .match({ saver_id: me, target_type: targetType, target_id: targetId })
    if (error) throw error
  }
}

// ----- post follows (persisted "Follow" button on a post) -----

/** Whether the signed-in member is following this post. */
export async function getMyPostFollow(postId: string): Promise<boolean> {
  const me = await getMyProfileId()
  if (!me) return false
  const { data } = await supabase
    .from('post_follows')
    .select('post_id')
    .match({ follower_id: me, post_id: postId })
    .maybeSingle()
  return !!data
}

/** Follow (on=true) or unfollow a post. */
export async function togglePostFollow(postId: string, on: boolean): Promise<void> {
  const me = await getMyProfileId()
  if (!me) throw new Error('Not signed in')
  if (on) {
    const { error } = await supabase
      .from('post_follows')
      .upsert({ follower_id: me, post_id: postId }, { onConflict: 'follower_id,post_id' })
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('post_follows')
      .delete()
      .match({ follower_id: me, post_id: postId })
    if (error) throw error
  }
}

// ----- pinned profile posts -----

/** Pin (on=true) or unpin one of your own posts on your profile. RLS
 *  posts_update_own restricts this to the author's rows. */
export async function setProfilePin(postId: string, on: boolean): Promise<void> {
  const { error } = await supabase
    .from('posts')
    .update({ profile_pinned_at: on ? new Date().toISOString() : null })
    .eq('id', postId)
  if (error) throw error
}

// ----- post archive / vault (MILESTONES §4) -----

/** Archive (on=true) or unarchive one of your own posts. Archived posts drop
 *  out of feeds/tags/search but stay reachable by direct link. Same RLS path
 *  as setProfilePin: posts_update_own limits this to the author's rows. */
export async function setPostArchived(postId: string, on: boolean): Promise<void> {
  const { error } = await supabase
    .from('posts')
    .update({ archived_at: on ? new Date().toISOString() : null })
    .eq('id', postId)
  if (error) throw error
}

/** The signed-in member's archived posts (both surfaces), newest archive first.
 *  Backs the owner-only "Archived" tab on their profile. */
export async function fetchMyArchivedPosts(): Promise<UiPost[]> {
  const me = await getMyProfileId()
  if (!me) return []
  const { data, error } = await supabase
    .from('posts')
    .select(POST_FIELDS)
    .eq('author_id', me)
    .not('archived_at', 'is', null)
    .order('archived_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapPost)
}

/** Live state for the ids in the local reading history, in the order given.
 *  The "Continue Reading" shelf stores snapshots taken at view time, so it
 *  needs the current row to stay honest: ids that come back missing (deleted
 *  or mod-removed) and archived posts are dropped, and the title/author here
 *  are fresh, so a rename doesn't leave a stale card on the shelf.
 *
 *  Same archived filter as the feed/tag/search paths, with no author
 *  exception — an author's own archived posts live in their Archived tab
 *  (fetchMyArchivedPosts), not on the shelf.
 *
 *  Lean select: the shelf renders a title and a byline, nothing else. The
 *  author embed names its FK for the reason given at POST_FIELDS. */
export async function fetchHistoryPosts(
  ids: string[],
): Promise<{ id: string; title: string; author: string }[]> {
  if (!ids.length) return []
  const { data, error } = await supabase
    .from('posts')
    .select('id, title, author:profiles!posts_author_id_fkey(username)')
    .in('id', ids)
    .is('archived_at', null)
  if (error) throw error
  const order = new Map(ids.map((id, i) => [id, i]))
  return (data ?? [])
    .sort((a: Row, b: Row) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((r: Row) => ({
      id: r.id,
      title: r.title,
      author: r.author?.username ?? 'unknown',
    }))
}

// ----- reading lists / collections (public, followable; MILESTONES §6) -----

export interface UiCollection {
  id: string
  name: string
  description: string
  owner: string // username
  count: number // posts in the list
  followers: number
}

function mapCollection(r: Row): UiCollection {
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    owner: r.owner?.username ?? 'unknown',
    count: r.collection_items?.[0]?.count ?? 0,
    followers: r.collection_follows?.[0]?.count ?? 0,
  }
}

const COLLECTION_FIELDS =
  'id, name, description, created_at, owner:profiles!collections_owner_id_fkey!inner(username), collection_items(count), collection_follows(count)'

/** A member's public collections, oldest first. */
export async function fetchCollectionsByUser(username: string): Promise<UiCollection[]> {
  const { data, error } = await supabase
    .from('collections')
    .select(COLLECTION_FIELDS)
    .eq('owner.username', username)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapCollection)
}

/** One collection's header info, or null if it doesn't exist. */
export async function fetchCollection(id: string): Promise<UiCollection | null> {
  const { data } = await supabase
    .from('collections')
    .select(COLLECTION_FIELDS)
    .eq('id', id)
    .maybeSingle()
  return data ? mapCollection(data) : null
}

/** The posts in a collection, newest post first. */
export async function fetchCollectionPosts(id: string): Promise<UiPost[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(`${POST_FIELDS}, collection_items!inner(collection_id)`)
    .eq('collection_items.collection_id', id)
    .is('archived_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapPost)
}

/** Create a collection; duplicate names surface as a unique-violation error. */
export async function createCollection(name: string, description = ''): Promise<string> {
  const me = await getMyProfileId()
  if (!me) throw new Error('Not signed in')
  const clean = name.trim()
  if (!clean || clean.length > 60) throw new Error('List names are 1-60 characters')
  if (description.length > 300) throw new Error('Descriptions are up to 300 characters')
  const { data, error } = await supabase
    .from('collections')
    .insert({ owner_id: me, name: clean, description: description.trim() })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

/** Delete a collection (its item and follow rows cascade; posts stay). */
export async function deleteCollection(id: string): Promise<void> {
  const { error } = await supabase.from('collections').delete().eq('id', id)
  if (error) throw error
}

/** The member's own collections (for the per-post picker), oldest first. */
export async function fetchMyCollections(): Promise<UiCollection[]> {
  const me = await getMyProfileId()
  if (!me) return []
  const { data, error } = await supabase
    .from('collections')
    .select(COLLECTION_FIELDS)
    .eq('owner_id', me)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(mapCollection)
}

/** Ids of the member's collections that already contain this post. */
export async function fetchCollectionMembership(postId: string): Promise<string[]> {
  const me = await getMyProfileId()
  if (!me) return []
  const { data } = await supabase
    .from('collection_items')
    .select('collection_id, collections!inner(owner_id)')
    .eq('post_id', postId)
    .eq('collections.owner_id', me)
  return (data ?? []).map((r: Row) => r.collection_id)
}

/** Add (on=true) or remove a post from a collection the member owns. */
export async function toggleCollectionItem(collectionId: string, postId: string, on: boolean): Promise<void> {
  if (on) {
    const { error } = await supabase
      .from('collection_items')
      .upsert({ collection_id: collectionId, post_id: postId }, { onConflict: 'collection_id,post_id' })
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('collection_items')
      .delete()
      .match({ collection_id: collectionId, post_id: postId })
    if (error) throw error
  }
}

/** Whether the signed-in member follows this collection. */
export async function getMyCollectionFollow(collectionId: string): Promise<boolean> {
  const me = await getMyProfileId()
  if (!me) return false
  const { data } = await supabase
    .from('collection_follows')
    .select('collection_id')
    .match({ follower_id: me, collection_id: collectionId })
    .maybeSingle()
  return !!data
}

/** Follow (on=true) or unfollow a collection. */
export async function toggleCollectionFollow(collectionId: string, on: boolean): Promise<void> {
  const me = await getMyProfileId()
  if (!me) throw new Error('Not signed in')
  if (on) {
    const { error } = await supabase
      .from('collection_follows')
      .upsert({ follower_id: me, collection_id: collectionId }, { onConflict: 'follower_id,collection_id' })
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('collection_follows')
      .delete()
      .match({ follower_id: me, collection_id: collectionId })
    if (error) throw error
  }
}

// ----- bookmark folders (private, RLS-scoped to the owner) -----

export interface UiFolder {
  id: string
  name: string
  count: number
}

/** The member's folders with item counts, oldest first (stable chip order). */
export async function fetchMyFolders(): Promise<UiFolder[]> {
  const me = await getMyProfileId()
  if (!me) return []
  const { data, error } = await supabase
    .from('bookmark_folders')
    .select('id, name, created_at, folder_items(count)')
    .eq('owner_id', me)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r: Row) => ({ id: r.id, name: r.name, count: r.folder_items?.[0]?.count ?? 0 }))
}

/** Create a folder; duplicate names surface as a unique-violation error. */
export async function createFolder(name: string): Promise<UiFolder> {
  const me = await getMyProfileId()
  if (!me) throw new Error('Not signed in')
  const clean = name.trim()
  if (!clean || clean.length > 40) throw new Error('Folder names are 1-40 characters')
  const { data, error } = await supabase
    .from('bookmark_folders')
    .insert({ owner_id: me, name: clean })
    .select('id, name')
    .single()
  if (error) throw error
  return { id: data.id, name: data.name, count: 0 }
}

/** Delete a folder (its item rows cascade; the saves themselves stay). */
export async function deleteFolder(folderId: string): Promise<void> {
  const { error } = await supabase.from('bookmark_folders').delete().eq('id', folderId)
  if (error) throw error
}

/** Folder ids this saved item currently sits in (for the per-item picker). */
export async function fetchFolderMembership(targetType: VoteTarget, targetId: string): Promise<string[]> {
  const { data } = await supabase
    .from('folder_items')
    .select('folder_id')
    .match({ target_type: targetType, target_id: targetId })
  return (data ?? []).map((r: Row) => r.folder_id)
}

/** Put a saved item into (on=true) or take it out of a folder. */
export async function toggleFolderItem(folderId: string, targetType: VoteTarget, targetId: string, on: boolean): Promise<void> {
  if (on) {
    const { error } = await supabase
      .from('folder_items')
      .upsert({ folder_id: folderId, target_type: targetType, target_id: targetId }, { onConflict: 'folder_id,target_type,target_id' })
    if (error) throw error
  } else {
    const { error } = await supabase
      .from('folder_items')
      .delete()
      .match({ folder_id: folderId, target_type: targetType, target_id: targetId })
    if (error) throw error
  }
}

/** The member's saved posts, most recently saved first (optionally one folder). */
export async function fetchSavedPosts(folderId?: string): Promise<UiPost[]> {
  const me = await getMyProfileId()
  if (!me) return []
  const { data: saves } = folderId
    ? await supabase
        .from('folder_items')
        .select('target_id, created_at')
        .eq('folder_id', folderId)
        .eq('target_type', 'post')
        .order('created_at', { ascending: false })
    : await supabase
        .from('saved_items')
        .select('target_id, created_at')
        .eq('saver_id', me)
        .eq('target_type', 'post')
        .order('created_at', { ascending: false })
  const ids = (saves ?? []).map((s: Row) => s.target_id)
  if (!ids.length) return []
  const { data, error } = await supabase.from('posts').select(POST_FIELDS).in('id', ids)
  if (error) throw error
  const order = new Map(ids.map((id: string, i: number) => [id, i]))
  return (data ?? [])
    .sort((a: Row, b: Row) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map(mapPost)
}

export interface SavedComment {
  id: string
  postId: string
  postTitle: string
  author: string
  when: string
  body: string
}

/** The member's saved comments as snippets linking back to their posts. */
export async function fetchSavedComments(folderId?: string): Promise<SavedComment[]> {
  const me = await getMyProfileId()
  if (!me) return []
  const { data: saves } = folderId
    ? await supabase
        .from('folder_items')
        .select('target_id, created_at')
        .eq('folder_id', folderId)
        .eq('target_type', 'comment')
        .order('created_at', { ascending: false })
    : await supabase
        .from('saved_items')
        .select('target_id, created_at')
        .eq('saver_id', me)
        .eq('target_type', 'comment')
        .order('created_at', { ascending: false })
  const ids = (saves ?? []).map((s: Row) => s.target_id)
  if (!ids.length) return []
  const { data, error } = await supabase
    .from('comments')
    .select('id, post_id, body, created_at, author:profiles(username), post:posts(title)')
    .in('id', ids)
  if (error) throw error
  const order = new Map(ids.map((id: string, i: number) => [id, i]))
  return (data ?? [])
    .sort((a: Row, b: Row) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    .map((r: Row) => ({
      id: r.id,
      postId: r.post_id,
      postTitle: r.post?.title ?? '',
      author: r.author?.username ?? 'unknown',
      when: timeAgo(r.created_at),
      body: r.body ?? '',
    }))
}

// ----- notifications / inbox (rows created by DB trigger; client reads + marks read) -----

export interface UiNotification {
  id: string
  type: 'reply' | 'mention' | 'vote_milestone' | 'tagged_post'
  actor: string
  postId: string | null
  postTitle: string
  when: string
  unread: boolean
}

/** The member's notifications, newest first. */
export async function fetchNotifications(): Promise<UiNotification[]> {
  const me = await getMyProfileId()
  if (!me) return []
  const { data, error } = await supabase
    .from('notifications')
    .select('id, type, read_at, created_at, post_id, actor:profiles!notifications_actor_id_fkey(username), post:posts(title)')
    .eq('recipient_id', me)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return (data ?? []).map((r: Row) => ({
    id: r.id,
    type: r.type,
    actor: r.actor?.username ?? 'someone',
    postId: r.post_id ?? null,
    postTitle: r.post?.title ?? '',
    when: timeAgo(r.created_at),
    unread: !r.read_at,
  }))
}

/** Count of unread notifications (for the header badge). */
export async function fetchUnreadCount(): Promise<number> {
  const me = await getMyProfileId()
  if (!me) return 0
  const { count } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', me)
    .is('read_at', null)
  return count ?? 0
}

/** Mark every unread notification read. */
export async function markAllNotificationsRead(): Promise<void> {
  const me = await getMyProfileId()
  if (!me) return
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('recipient_id', me)
    .is('read_at', null)
  if (error) throw error
}

/** Full-text search over community posts (title + body, websearch syntax). */
export async function searchPosts(query: string): Promise<UiPost[]> {
  const q = query.trim()
  if (!q) return []
  const { data, error } = await supabase
    .from('posts')
    .select(POST_FIELDS)
    .eq('surface', 'community')
    .is('archived_at', null)
    .textSearch('search_tsv', q, { type: 'websearch', config: 'english' })
    .order('created_at', { ascending: false }) // ponytail: recency order; ts_rank needs an RPC if relevance ordering matters later
    .limit(50)
  if (error) throw error
  return (data ?? []).map(mapPost)
}

/** Pinned "Community highlights" cards. */
/** Community-sidebar bookmarks, ordered for display. Public read (RLS). */
export async function fetchSidebarBookmarks(): Promise<UiBookmark[]> {
  const { data, error } = await supabase
    .from('sidebar_bookmarks')
    .select('id, label, route, pinned_match, position')
    .order('position', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r: Row) => ({
    id: r.id,
    label: r.label,
    route: r.route ?? null,
    pinnedMatch: r.pinned_match ?? null,
    position: r.position,
  }))
}

export async function fetchPinned(): Promise<UiPinned[]> {
  const { data, error } = await supabase
    .from('posts')
    .select('id, title, vote_score, comments(count)')
    .eq('surface', 'community')
    .eq('pinned', true)
    .is('circle_id', null)
    .is('archived_at', null)
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
      distinguished: !deleted && !!r.distinguished_at,
      stickied: !deleted && !!r.stickied_at,
      replies: [],
    })
  }
  for (const r of rows) {
    const node = nodes.get(r.id)!
    const parent = r.parent_id ? nodes.get(r.parent_id) : undefined
    if (parent) parent.replies.push(node)
    else roots.push(node)
  }
  // Stickied mod comments float to the top; stable sort keeps created-at order otherwise.
  roots.sort((a, b) => (b.stickied ? 1 : 0) - (a.stickied ? 1 : 0))
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
    .select('id, body, vote_score, parent_id, created_at, author_id, deleted_at, distinguished_at, stickied_at, author:profiles(username)')
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
const PROFILE_CORE_FIELDS = 'id, username, display_name, role, created_at, member_flair:flairs(slug, label)'

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

// ----- profile editing (RLS: own row only; column grant in migrations 0001 + 0009) -----

export const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/

/** Editable profile fields. Username collisions surface as a unique-violation error. */
export async function updateMyProfile(fields: {
  username?: string
  display_name?: string
  banner?: string
  avatar_url?: string
  ao3_url?: string | null
  kofi_url?: string | null
  tumblr_url?: string | null
  twitter_url?: string | null
  ao3_works?: string[]
  blur_media?: boolean
  spoiler_free?: boolean
  spoiler_tags?: string[]
  muted_tags?: string[]
  profile_theme?: string | null
}): Promise<void> {
  const me = await getMyProfileId()
  if (!me) throw new Error('Not signed in')
  if (fields.username !== undefined && !USERNAME_RE.test(fields.username))
    throw new Error('Username must be 3-20 characters: letters, numbers, underscore')
  // Creator links render as hrefs on public profiles — require https to block
  // javascript:/data: URLs at the trust boundary.
  for (const u of [fields.ao3_url, fields.kofi_url, fields.tumblr_url, fields.twitter_url])
    if (u && !/^https:\/\//i.test(u)) throw new Error('Links must start with https://')
  // Presets only — mirrors the profiles_profile_theme_check constraint (0027).
  if (fields.profile_theme != null && !PROFILE_THEMES[fields.profile_theme])
    throw new Error('Unknown profile theme')
  // Username changes go through the change_username RPC: the direct column
  // grant was revoked in 0025 so the 30-day cooldown is enforced in the DB.
  const { username, ...rest } = fields
  if (username !== undefined) {
    const { error } = await supabase.rpc('change_username', { p_username: username })
    if (error) throw error
  }
  if (Object.keys(rest).length) {
    const { error } = await supabase.from('profiles').update(rest).eq('id', me)
    if (error) throw error
  }
}

/** Set (or clear, with null) the signed-in member's own member flair by slug.
 *  Goes through the set_my_member_flair RPC (0026) so the slug is resolved
 *  within scope='member' and only the caller's row is touched. */
export async function setMyMemberFlair(slug: string | null): Promise<void> {
  const { error } = await supabase.rpc('set_my_member_flair', { p_slug: slug })
  if (error) throw error
}

// The file input's accept="image/*" is advisory only; enforce a real allowlist
// and size cap before upload. SVG is excluded on purpose: it can carry scripts
// and the bucket serves files publicly.
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024
const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

/** Error message if the file can't be used as an avatar, else null. */
export function validateAvatarFile(file: File): string | null {
  if (!AVATAR_TYPES.includes(file.type)) return 'Avatar must be a JPEG, PNG, WebP, or GIF image.'
  if (file.size > AVATAR_MAX_BYTES) return 'Avatar image must be 2 MB or smaller.'
  return null
}

/**
 * Upload an avatar image; returns its public URL (avatars/ prefix in the
 * post-media bucket). Uploads the new file before deleting the old one (found
 * via previousUrl) so a failure can't leave the member avatarless; the delete
 * is best-effort, since a missed cleanup just leaves an orphan.
 * Paths stay random on purpose: post-media has no UPDATE policy and its INSERT
 * policy is bucket-wide (0006), so a predictable per-member path could be
 * pre-claimed by another member and never reclaimed (DELETE is owner-only).
 */
export async function uploadAvatar(file: File, previousUrl?: string | null): Promise<string> {
  const invalid = validateAvatarFile(file)
  if (invalid) throw new Error(invalid)
  const path = `avatars/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
  const { error } = await supabase.storage.from('post-media').upload(path, file)
  if (error) throw error
  // Only delete objects we recognize as this app's avatars; the owner-scoped
  // DELETE policy limits the blast radius to the member's own files regardless.
  const oldPath = previousUrl?.split('?')[0].split('/object/public/post-media/')[1]
  if (oldPath?.startsWith('avatars/')) {
    try {
      const { error: cleanupError } = await supabase.storage.from('post-media').remove([oldPath])
      if (cleanupError) console.warn('old avatar cleanup failed', cleanupError)
    } catch (e) {
      console.warn('old avatar cleanup failed', e)
    }
  }
  return supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl
}

/** Members this member has muted or blocked, for the settings panel. */
export async function fetchMyMutes(): Promise<{ id: string; username: string; type: RelType }[]> {
  const me = await getMyProfileId()
  if (!me) return []
  const { data } = await supabase
    .from('relationships')
    .select('type, target:profiles!relationships_target_id_fkey(id, username)')
    .eq('actor_id', me)
    .in('type', ['mute', 'block'])
  return (data ?? [])
    .filter((r: Row) => r.target)
    .map((r: Row) => ({ id: r.target.id, username: r.target.username, type: r.type }))
}

/** A member profile + their profile-surface posts, with follower/contribution counts. */
export async function fetchProfile(username: string): Promise<UiProfile | null> {
  const { data: p, error } = await supabase
    .from('profiles')
    .select(`${PROFILE_CORE_FIELDS}, karma, gold_earned, banner, avatar_url, ao3_url, ao3_verified, kofi_url, tumblr_url, twitter_url, ao3_works, blur_media, spoiler_free, spoiler_tags, muted_tags, profile_theme, username_changed_at, banned_at`)
    .eq('username', username)
    .maybeSingle()
  if (error) throw error
  if (!p) return null

  const [postsRes, coauthoredRes, followersRes, contribRes] = await Promise.all([
    supabase
      .from('posts')
      .select(POST_FIELDS)
      .eq('author_id', p.id)
      .eq('surface', 'profile')
      .is('archived_at', null)
      .order('profile_pinned_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false }),
    // Joint works: profile-shelf posts this member is credited on as a co-author.
    supabase
      .from('post_coauthors')
      .select(`post:posts!inner(${POST_FIELDS})`)
      .eq('profile_id', p.id)
      .eq('post.surface', 'profile')
      .is('post.archived_at', null),
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

  // Merge authored + co-authored, dedup by id, keep pinned-first then newest.
  const authored = (postsRes.data ?? []).map(mapPost)
  const coauthored = (coauthoredRes.data ?? []).map((r: Row) => r.post).filter(Boolean).map(mapPost)
  const seen = new Set(authored.map((p2) => p2.id))
  const allPosts = [...authored, ...coauthored.filter((p2) => !seen.has(p2.id))]
    .sort((a, b) => (Number(b.profilePinned) - Number(a.profilePinned)))

  return {
    ...mapProfileCore(p),
    banned: !!p.banned_at,
    flairSlug: (p.member_flair as Row | null)?.slug ?? null,
    banner: p.banner || '',
    avatarUrl: p.avatar_url ?? null,
    ao3: p.ao3_url ?? null,
    ao3Verified: p.ao3_verified ?? false,
    ao3Works: p.ao3_works ?? [],
    kofi: p.kofi_url ?? null,
    tumblr: p.tumblr_url ?? null,
    twitter: p.twitter_url ?? null,
    blurMedia: p.blur_media ?? true,
    spoilerFree: p.spoiler_free ?? false,
    spoilerTags: p.spoiler_tags ?? [],
    mutedTags: p.muted_tags ?? [],
    profileTheme: p.profile_theme ?? null,
    usernameChangedAt: p.username_changed_at ?? null,
    followers: followersRes.count ?? 0,
    karma: (p.karma ?? 0).toLocaleString(),
    contributions: contribRes.count ?? 0,
    gold: p.gold_earned ?? 0,
    achievements: 'No achievements yet',
    unlocked: 0,
    posts: allPosts,
  }
}

// ----- post co-authors (MILESTONES §4) -----

/** Add a co-author to a post by username (post author only, enforced by RLS). */
export async function addCoauthor(postId: string, username: string): Promise<void> {
  const { data: prof, error: pErr } = await supabase
    .from('profiles').select('id').eq('username', username).maybeSingle()
  if (pErr) throw pErr
  if (!prof) throw new Error(`No member named ${username}`)
  const { error } = await supabase.from('post_coauthors').insert({ post_id: postId, profile_id: prof.id })
  if (error) throw error.code === '23505' ? new Error(`${username} is already a co-author`) : error
}

/** Remove a co-author by username (post author or the co-author themselves). */
export async function removeCoauthor(postId: string, username: string): Promise<void> {
  const { data: prof, error: pErr } = await supabase
    .from('profiles').select('id').eq('username', username).maybeSingle()
  if (pErr) throw pErr
  if (!prof) return
  const { error } = await supabase.from('post_coauthors')
    .delete().eq('post_id', postId).eq('profile_id', prof.id)
  if (error) throw error
}

// ----- circles (public sub-communities; MILESTONES §9 Phase 1) -----

const CIRCLE_FIELDS = 'id, slug, name, description, creator_id, visibility, created_at, circle_members(count)'

function mapCircle(r: Row, mine: Map<string, 'member' | 'mod'>): UiCircle {
  const myRole = mine.get(r.id) ?? null
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description ?? '',
    creatorId: r.creator_id,
    visibility: r.visibility === 'private' ? 'private' : 'public',
    members: r.circle_members?.[0]?.count ?? 0,
    joined: myRole !== null,
    myRole,
    createdAt: r.created_at,
  }
}

// ----- commission board (public listings; MILESTONES §9) -----

const STATUS_RANK: Record<string, number> = { open: 0, waitlist: 1, fulfilled: 1, closed: 2 }

function mapCommissionListing(r: Row): UiCommissionListing {
  return {
    id: r.id,
    artistId: r.artist_id,
    artist: r.artist?.username ?? 'unknown',
    artistDisplay: r.artist?.display_name || r.artist?.username || 'unknown',
    title: r.title,
    description: r.description ?? '',
    priceInfo: r.price_info ?? '',
    contactUrl: r.contact_url ?? '',
    slotsTotal: r.slots_total,
    slotsFilled: r.slots_filled,
    status: r.status,
    createdAt: r.created_at,
  }
}

/** The signed-in member's circle roles by circle id (empty map when signed out). */
async function myCircleRoles(): Promise<Map<string, 'member' | 'mod'>> {
  const me = await getMyProfileId()
  if (!me) return new Map()
  const { data, error } = await supabase
    .from('circle_members')
    .select('circle_id, role')
    .eq('profile_id', me)
  if (error) throw error
  return new Map((data ?? []).map((r: Row) => [r.circle_id, r.role === 'mod' ? 'mod' : 'member']))
}

/** All circles for the /circles directory, biggest first. */
export async function listCircles(): Promise<UiCircle[]> {
  const [{ data, error }, mine] = await Promise.all([
    supabase.from('circles').select(CIRCLE_FIELDS),
    myCircleRoles(),
  ])
  if (error) throw error
  return (data ?? [])
    .map((r: Row) => mapCircle(r, mine))
    .sort((a, b) => b.members - a.members || a.name.localeCompare(b.name))
}

/** One circle by slug, or null. */
export async function fetchCircle(slug: string): Promise<UiCircle | null> {
  const [{ data, error }, mine] = await Promise.all([
    supabase.from('circles').select(CIRCLE_FIELDS).eq('slug', slug).maybeSingle(),
    myCircleRoles(),
  ])
  if (error) throw error
  return data ? mapCircle(data, mine) : null
}

/** Create a circle via the spam-guarded RPC; returns the new circle id. */
export async function createCircle(input: { slug: string; name: string; description?: string; visibility?: 'public' | 'private' }): Promise<string> {
  const { data, error } = await supabase.rpc('create_circle', {
    p_slug: input.slug.trim(),
    p_name: input.name.trim(),
    p_description: (input.description ?? '').trim(),
    p_visibility: input.visibility ?? 'public',
  })
  if (error) throw error
  return data as string
}

/** Members of a circle for the mod panel: mods first, then by join time. */
export async function fetchCircleMembers(circleId: string): Promise<UiCircleMember[]> {
  const { data, error } = await supabase
    .from('circle_members')
    .select('profile_id, role, joined_at, profile:profiles(username, display_name), circle:circles(creator_id)')
    .eq('circle_id', circleId)
    .order('joined_at', { ascending: true })
  if (error) throw error
  return (data ?? [])
    .map((r: Row): UiCircleMember => ({
      profileId: r.profile_id,
      username: r.profile?.username ?? 'unknown',
      displayName: r.profile?.display_name || r.profile?.username || 'unknown',
      role: r.role === 'mod' ? 'mod' : 'member',
      isCreator: r.circle?.creator_id === r.profile_id,
      joinedAt: r.joined_at,
    }))
    .sort((a, b) => Number(b.isCreator) - Number(a.isCreator) || Number(b.role === 'mod') - Number(a.role === 'mod'))
}

/** Invite/add a member to a circle by username (circle mods only). */
export async function circleAddMember(circleId: string, username: string): Promise<void> {
  const { error } = await supabase.rpc('circle_add_member', { p_circle: circleId, p_username: username.trim() })
  if (error) throw error
}

/** Promote or demote a member between 'member' and 'mod' (circle mods only). */
export async function circleSetRole(circleId: string, profileId: string, role: 'member' | 'mod'): Promise<void> {
  const { error } = await supabase.rpc('circle_set_role', { p_circle: circleId, p_profile: profileId, p_role: role })
  if (error) throw error
}

/** Remove a member from a circle (circle mods only). */
export async function circleRemoveMember(circleId: string, profileId: string): Promise<void> {
  const { error } = await supabase.rpc('circle_remove_member', { p_circle: circleId, p_profile: profileId })
  if (error) throw error
}

/** Join a circle as the signed-in member. */
export async function joinCircle(circleId: string): Promise<void> {
  const me = await getMyProfileId()
  if (!me) throw new Error('Not signed in')
  const { error } = await supabase
    .from('circle_members')
    .insert({ circle_id: circleId, profile_id: me })
  if (error && error.code !== '23505') throw error // already joined = fine
}

/** Leave a circle. */
export async function leaveCircle(circleId: string): Promise<void> {
  const me = await getMyProfileId()
  if (!me) throw new Error('Not signed in')
  const { error } = await supabase
    .from('circle_members')
    .delete()
    .eq('circle_id', circleId)
    .eq('profile_id', me)
  if (error) throw error
}

/** Posts inside one circle, newest first. */
export async function fetchCircleFeed(circleId: string): Promise<UiPost[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_FIELDS)
    .eq('circle_id', circleId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapPost)
}

const COMMISSION_LISTING_FIELDS =
  'id, artist_id, title, description, price_info, contact_url, slots_total, slots_filled, status, created_at, artist:profiles!commission_listings_artist_id_fkey(username, display_name)'

/** All commission listings, newest first with open/waitlist surfaced above closed. */
export async function listCommissionListings(): Promise<UiCommissionListing[]> {
  const { data, error } = await supabase
    .from('commission_listings')
    .select(COMMISSION_LISTING_FIELDS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? [])
    .map(mapCommissionListing)
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
}

/** Create a commission listing owned by the signed-in member. */
export async function createCommissionListing(fields: {
  title: string
  description?: string
  priceInfo?: string
  contactUrl?: string
  slotsTotal?: number
}): Promise<string> {
  const me = await getMyProfileId()
  if (!me) throw new Error('Not signed in')
  const title = fields.title.trim()
  if (!title || title.length > 80) throw new Error('Titles are 1-80 characters')
  const { data, error } = await supabase
    .from('commission_listings')
    .insert({
      artist_id: me,
      title,
      description: (fields.description ?? '').trim(),
      price_info: (fields.priceInfo ?? '').trim(),
      contact_url: (fields.contactUrl ?? '').trim(),
      slots_total: fields.slotsTotal ?? 1,
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

/** Update a commission listing the member owns. */
export async function updateCommissionListing(
  id: string,
  patch: Partial<{
    title: string
    description: string
    priceInfo: string
    contactUrl: string
    slotsTotal: number
    slotsFilled: number
    status: UiCommissionListing['status']
  }>,
): Promise<void> {
  const row: Row = {}
  if (patch.title !== undefined) row.title = patch.title.trim()
  if (patch.description !== undefined) row.description = patch.description.trim()
  if (patch.priceInfo !== undefined) row.price_info = patch.priceInfo.trim()
  if (patch.contactUrl !== undefined) row.contact_url = patch.contactUrl.trim()
  if (patch.slotsTotal !== undefined) row.slots_total = patch.slotsTotal
  if (patch.slotsFilled !== undefined) row.slots_filled = patch.slotsFilled
  if (patch.status !== undefined) row.status = patch.status
  const { error } = await supabase.from('commission_listings').update(row).eq('id', id)
  if (error) throw error
}

/** Delete a commission listing (own listing, or any listing if a mod). */
export async function deleteCommissionListing(id: string): Promise<void> {
  const { error } = await supabase.from('commission_listings').delete().eq('id', id)
  if (error) throw error
}

function mapCommissionRequest(r: Row): UiCommissionRequest {
  return {
    id: r.id,
    requesterId: r.requester_id,
    requester: r.requester?.username ?? 'unknown',
    requesterDisplay: r.requester?.display_name || r.requester?.username || 'unknown',
    title: r.title,
    description: r.description ?? '',
    budget: r.budget ?? '',
    status: r.status,
    createdAt: r.created_at,
  }
}

const COMMISSION_REQUEST_FIELDS =
  'id, requester_id, title, description, budget, status, created_at, requester:profiles!commission_requests_requester_id_fkey(username, display_name)'

/** All commission requests, newest first with open surfaced above fulfilled/closed. */
export async function listCommissionRequests(): Promise<UiCommissionRequest[]> {
  const { data, error } = await supabase
    .from('commission_requests')
    .select(COMMISSION_REQUEST_FIELDS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? [])
    .map(mapCommissionRequest)
    .sort((a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status])
}

/** Create a commission request owned by the signed-in member. */
export async function createCommissionRequest(fields: {
  title: string
  description?: string
  budget?: string
}): Promise<string> {
  const me = await getMyProfileId()
  if (!me) throw new Error('Not signed in')
  const title = fields.title.trim()
  if (!title || title.length > 80) throw new Error('Titles are 1-80 characters')
  const { data, error } = await supabase
    .from('commission_requests')
    .insert({
      requester_id: me,
      title,
      description: (fields.description ?? '').trim(),
      budget: (fields.budget ?? '').trim(),
    })
    .select('id')
    .single()
  if (error) throw error
  return data.id
}

/** Update a commission request the member owns (status at minimum). */
export async function updateCommissionRequest(
  id: string,
  patch: Partial<{ title: string; description: string; budget: string; status: UiCommissionRequest['status'] }>,
): Promise<void> {
  const row: Row = {}
  if (patch.title !== undefined) row.title = patch.title.trim()
  if (patch.description !== undefined) row.description = patch.description.trim()
  if (patch.budget !== undefined) row.budget = patch.budget.trim()
  if (patch.status !== undefined) row.status = patch.status
  const { error } = await supabase.from('commission_requests').update(row).eq('id', id)
  if (error) throw error
}

/** Delete a commission request (own request, or any request if a mod). */
export async function deleteCommissionRequest(id: string): Promise<void> {
  const { error } = await supabase.from('commission_requests').delete().eq('id', id)
  if (error) throw error
}

// ----- community wiki (collaborative pages + revisions; MILESTONES §9) -----

/** Wiki page index (metadata only), alphabetical by title. */
export async function listWikiPages(): Promise<UiWikiPageMeta[]> {
  const { data, error } = await supabase
    .from('wiki_pages')
    .select('slug, title, edit_locked, updated_at, editor:profiles!wiki_pages_updated_by_fkey(username)')
    .order('title', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r: Row) => ({
    slug: r.slug,
    title: r.title,
    editLocked: !!r.edit_locked,
    updatedBy: r.editor?.username ?? null,
    updatedAt: r.updated_at,
  }))
}

/** One wiki page by slug, or null if it doesn't exist yet. */
export async function fetchWikiPage(slug: string): Promise<UiWikiPage | null> {
  const { data, error } = await supabase
    .from('wiki_pages')
    .select('id, slug, title, body, edit_locked, created_at, updated_at, ' +
      'creator:profiles!wiki_pages_created_by_fkey(username), editor:profiles!wiki_pages_updated_by_fkey(username)')
    .eq('slug', slug)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const r = data as Row
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    body: r.body ?? '',
    editLocked: !!r.edit_locked,
    createdBy: r.creator?.username ?? null,
    createdAt: r.created_at,
    updatedBy: r.editor?.username ?? null,
    updatedAt: r.updated_at,
  }
}

/** Create or edit a wiki page (writes a revision); returns the page id. */
export async function saveWikiPage(input: { slug: string; title: string; body: string; summary?: string }): Promise<string> {
  const { data, error } = await supabase.rpc('save_wiki_page', {
    p_slug: input.slug.trim(),
    p_title: input.title.trim(),
    p_body: input.body,
    p_summary: (input.summary ?? '').trim(),
  })
  if (error) throw error
  return data as string
}

/** Lock or unlock a page's editability (moderators only, enforced in the DB). */
export async function setWikiLock(slug: string, locked: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_wiki_lock', { p_slug: slug, p_locked: locked })
  if (error) throw error
}

/** Delete a wiki page (moderators only via RLS); revisions cascade. */
export async function deleteWikiPage(slug: string): Promise<void> {
  const { error } = await supabase.from('wiki_pages').delete().eq('slug', slug)
  if (error) throw error
}

/** Revision history for a page, newest first. */
export async function fetchWikiRevisions(pageId: string): Promise<UiWikiRevision[]> {
  const { data, error } = await supabase
    .from('wiki_revisions')
    .select('id, title, body, summary, created_at, editor:profiles!wiki_revisions_editor_id_fkey(username)')
    .eq('page_id', pageId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r: Row) => ({
    id: r.id,
    title: r.title,
    body: r.body ?? '',
    summary: r.summary ?? '',
    editor: r.editor?.username ?? null,
    createdAt: r.created_at,
  }))
}
