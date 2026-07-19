// Mod mail (MILESTONES §9): member ↔ mod-team threads. RLS scopes reads — a
// member sees only their own threads, a mod sees all — so the same fetch works
// for both. See migration 0033.
import { supabase } from './supabase'
import { getMyProfileId } from './api'
import { timeAgo } from './time'

export interface UiModmailThread {
  id: string
  subject: string
  status: 'open' | 'closed'
  memberName: string
  when: string // last activity, humanized
}

export interface UiModmailMessage {
  id: string
  body: string
  fromMod: boolean
  senderName: string
  when: string
}

/** Threads visible to the caller, most-recent activity first. */
export async function fetchModmailThreads(): Promise<UiModmailThread[]> {
  const { data, error } = await supabase
    .from('modmail_threads')
    .select('id, subject, status, last_at, member:profiles!modmail_threads_member_id_fkey(username)')
    .order('last_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.id,
    subject: r.subject,
    status: r.status,
    memberName: r.member?.username ?? 'unknown',
    when: timeAgo(r.last_at),
  }))
}

export async function fetchModmailMessages(threadId: string): Promise<UiModmailMessage[]> {
  const { data, error } = await supabase
    .from('modmail_messages')
    .select('id, body, from_mod, created_at, sender:profiles!modmail_messages_sender_id_fkey(username)')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: r.id,
    body: r.body,
    fromMod: r.from_mod,
    senderName: r.sender?.username ?? 'unknown',
    when: timeAgo(r.created_at),
  }))
}

/** A member opens a new thread with a first message. Returns the thread id. */
export async function createModmailThread(subject: string, body: string): Promise<string> {
  const me = await getMyProfileId()
  if (!me) throw new Error('Not signed in')
  const { data, error } = await supabase
    .from('modmail_threads')
    .insert({ member_id: me, subject: subject.trim() })
    .select('id')
    .single()
  if (error) throw error
  const { error: mErr } = await supabase
    .from('modmail_messages')
    .insert({ thread_id: data.id, sender_id: me, from_mod: false, body: body.trim() })
  if (mErr) throw mErr
  return data.id
}

/** Reply to a thread. `fromMod` must match whether the caller is a mod (RLS enforces). */
export async function sendModmailMessage(threadId: string, body: string, fromMod: boolean): Promise<void> {
  const me = await getMyProfileId()
  if (!me) throw new Error('Not signed in')
  const { error } = await supabase
    .from('modmail_messages')
    .insert({ thread_id: threadId, sender_id: me, from_mod: fromMod, body: body.trim() })
  if (error) throw error
}

/** Mods close / reopen a thread (RLS restricts to mods). */
export async function setModmailStatus(threadId: string, status: 'open' | 'closed'): Promise<void> {
  const { error } = await supabase.from('modmail_threads').update({ status }).eq('id', threadId)
  if (error) throw error
}
