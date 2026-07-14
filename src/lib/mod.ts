// Moderator actions — thin wrappers over the SECURITY DEFINER RPCs in
// migration 0007. Each is gated server-side by is_mod(); the UI only shows them
// to mods, but the database is the real enforcement.
import { supabase } from './supabase'

export async function modSetPinned(postId: string, pinned: boolean): Promise<void> {
  const { error } = await supabase.rpc('mod_set_pinned', { p_post: postId, p_pinned: pinned })
  if (error) throw error
}

export async function modRemovePost(postId: string): Promise<void> {
  const { error } = await supabase.rpc('mod_remove_post', { p_post: postId })
  if (error) throw error
}

export async function modSetPostFlairs(postId: string, slugs: string[]): Promise<void> {
  const { error } = await supabase.rpc('mod_set_post_flairs', { p_post: postId, p_slugs: slugs })
  if (error) throw error
}

export async function modAssignMemberFlair(profileId: string, slug: string | null): Promise<void> {
  const { error } = await supabase.rpc('mod_assign_member_flair', { p_profile: profileId, p_slug: slug })
  if (error) throw error
}

// ----- sidebar bookmarks (migration 0029) -----------------------------------

// Insert (id null) or update (id set) a bookmark; returns the row id. Exactly
// one of route/pinnedMatch should be non-null (the other passed as null).
export async function modUpsertSidebarBookmark(
  id: string | null, label: string, route: string | null, pinnedMatch: string | null): Promise<string> {
  const { data, error } = await supabase.rpc('mod_upsert_sidebar_bookmark', {
    p_id: id, p_label: label, p_route: route, p_pinned_match: pinnedMatch,
  })
  if (error) throw error
  return data as string
}

export async function modDeleteSidebarBookmark(id: string): Promise<void> {
  const { error } = await supabase.rpc('mod_delete_sidebar_bookmark', { p_id: id })
  if (error) throw error
}

// Reorder: positions are reassigned from the order of `ids`.
export async function modReorderSidebarBookmarks(ids: string[]): Promise<void> {
  const { error } = await supabase.rpc('mod_reorder_sidebar_bookmarks', { p_ids: ids })
  if (error) throw error
}
