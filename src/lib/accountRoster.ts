// Multi-account roster for Instagram-style account switching (MILESTONES §10).
// localStorage only, no DB: holds each signed-in account's tokens so we can swap
// the active Supabase session with setSession instead of a full re-login.
//
// ponytail: refresh tokens rotate on use. A stored token for an idle account
// stays valid until its inactivity timeout; switching to it refreshes + rotates
// it. The known "hard edge" (same account live in two tabs invalidating a stored
// token) is handled by treating a failed switch as "drop that account and fall
// back to login" rather than trying to keep rotation perfectly in sync.

import type { Session } from '@supabase/supabase-js'

export interface RosterAccount {
  userId: string
  email: string
  accessToken: string
  refreshToken: string
}

const KEY = 'bpf:accounts'

function read(): RosterAccount[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function write(list: RosterAccount[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list))
  } catch {
    /* fail soft */
  }
}

export function getAccounts(): RosterAccount[] {
  return read()
}

/** Insert or refresh an account from a live session; called on every auth change. */
export function upsertAccount(session: Session): void {
  const u = session.user
  if (!u?.id || !session.refresh_token) return
  const entry: RosterAccount = {
    userId: u.id,
    email: u.email ?? '(no email)',
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
  }
  write([...read().filter((a) => a.userId !== u.id), entry])
}

export function removeAccount(userId: string): void {
  write(read().filter((a) => a.userId !== userId))
}
