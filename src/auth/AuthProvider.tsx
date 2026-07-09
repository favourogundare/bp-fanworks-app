import { createContext, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { resetProfileCache } from '../lib/api'
import { getAccounts, upsertAccount, removeAccount } from '../lib/accountRoster'
import type { RosterAccount } from '../lib/accountRoster'

type AuthResult = { error: string | null }

interface AuthContextValue {
  session: Session | null
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<AuthResult>
  signUp: (email: string, password: string) => Promise<AuthResult>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<AuthResult>
  // Multi-account switching (MILESTONES §10).
  accounts: RosterAccount[]
  switchAccount: (userId: string) => Promise<AuthResult>
  addingAccount: boolean
  startAddAccount: () => void
  cancelAddAccount: () => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<RosterAccount[]>(() => getAccounts())
  const [addingAccount, setAddingAccount] = useState(false)

  useEffect(() => {
    // 1. Restore any persisted session on first load.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) upsertAccount(data.session)
      setSession(data.session)
      setAccounts(getAccounts())
      setLoading(false)
    })

    // 2. Keep React in sync with sign in / sign out / token refresh, and keep
    //    the roster's stored tokens fresh as they rotate.
    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (nextSession) upsertAccount(nextSession)
      // A real sign-in (password/OAuth/switch) ends any "add account" flow;
      // background TOKEN_REFRESHED must NOT, or it would yank the login screen.
      if (event === 'SIGNED_IN') setAddingAccount(false)
      setSession(nextSession)
      setAccounts(getAccounts())
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const signIn = async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signUp = async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    resetProfileCache()
    // Sign out only the ACTIVE account. If other accounts remain in the roster,
    // switch to one instead of dropping all the way to the login screen.
    const current = session?.user?.id
    if (current) removeAccount(current)
    const remaining = getAccounts()
    setAccounts(remaining)
    if (remaining.length > 0) {
      const { error } = await supabase.auth.setSession({
        access_token: remaining[0].accessToken,
        refresh_token: remaining[0].refreshToken,
      })
      if (!error) return
      // Stored token no longer valid — fall through to a full sign-out.
      removeAccount(remaining[0].userId)
      setAccounts(getAccounts())
    }
    await supabase.auth.signOut()
  }

  const switchAccount = async (userId: string): Promise<AuthResult> => {
    const acc = getAccounts().find((a) => a.userId === userId)
    if (!acc) return { error: 'Account not found' }
    if (acc.userId === session?.user?.id) return { error: null } // already active
    resetProfileCache()
    const { error } = await supabase.auth.setSession({
      access_token: acc.accessToken,
      refresh_token: acc.refreshToken,
    })
    if (error) {
      // Rotated/expired stored token — drop it and report so the UI can prompt
      // a fresh sign-in for that account.
      removeAccount(userId)
      setAccounts(getAccounts())
      return { error: error.message }
    }
    return { error: null }
  }

  const startAddAccount = () => setAddingAccount(true)
  const cancelAddAccount = () => setAddingAccount(false)

  const resetPassword = async (email: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { error: error?.message ?? null }
  }

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    loading,
    signIn,
    signUp,
    signOut,
    resetPassword,
    accounts,
    switchAccount,
    addingAccount,
    startAddAccount,
    cancelAddAccount,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
