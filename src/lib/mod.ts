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
