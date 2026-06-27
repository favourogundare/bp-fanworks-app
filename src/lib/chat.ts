// Chat data layer: conversations, messages, sending, and realtime subscription.
import { supabase } from './supabase'
import { getMyProfileId } from './api'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

export interface UiMessage {
  id: string
  fromMe: boolean
  body: string
  createdAt: string
}

export interface UiConversation {
  id: string
  otherProfileId: string
  otherUsername: string
}

/** Find or create the 1:1 conversation with another member (block-enforced server-side). */
export async function getOrCreateConversation(otherProfileId: string): Promise<string> {
  const { data, error } = await supabase.rpc('get_or_create_conversation', { other: otherProfileId })
  if (error) throw error
  return data as string
}

/** All of my conversations, newest first, with the other participant resolved. */
export async function fetchConversations(): Promise<UiConversation[]> {
  const me = await getMyProfileId()
  if (!me) return []
  const { data, error } = await supabase
    .from('conversations')
    .select('id, user_a, user_b, a:profiles!conversations_user_a_fkey(username), b:profiles!conversations_user_b_fkey(username)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map((c: Row) => {
    const meIsA = c.user_a === me
    return {
      id: c.id,
      otherProfileId: meIsA ? c.user_b : c.user_a,
      otherUsername: (meIsA ? c.b?.username : c.a?.username) ?? 'unknown',
    }
  })
}

/** All messages in a conversation, oldest first. */
export async function fetchMessages(conversationId: string): Promise<UiMessage[]> {
  const me = await getMyProfileId()
  const { data, error } = await supabase
    .from('messages')
    .select('id, sender_id, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map((m: Row) => ({
    id: m.id,
    fromMe: m.sender_id === me,
    body: m.body,
    createdAt: m.created_at,
  }))
}

/** Send a message. The DB rejects this if either participant blocks the other. */
export async function sendMessage(conversationId: string, body: string): Promise<UiMessage> {
  const me = await getMyProfileId()
  if (!me) throw new Error('Not signed in')
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_id: me, body })
    .select('id, body, created_at')
    .single()
  if (error) throw error
  return { id: data.id, fromMe: true, body: data.body, createdAt: data.created_at }
}

/**
 * Subscribe to new messages in a conversation. Calls onMessage for each insert.
 * Returns an unsubscribe function.
 */
export function subscribeToMessages(
  conversationId: string,
  myProfileId: string | null,
  onMessage: (m: UiMessage) => void,
): () => void {
  const channel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => {
        const m = payload.new as Row
        onMessage({
          id: m.id,
          fromMe: m.sender_id === myProfileId,
          body: m.body,
          createdAt: m.created_at,
        })
      },
    )
    .subscribe()
  return () => { supabase.removeChannel(channel) }
}
