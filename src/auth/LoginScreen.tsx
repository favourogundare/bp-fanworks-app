import { useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { useAuth } from './AuthProvider'
import { goldPair, pawGradient } from '../lib/palettes'
import { useTheme } from '../lib/theme'

type Mode = 'signin' | 'signup' | 'reset'

export function LoginScreen() {
  const { signIn, signInWithProvider, signUp, resetPassword, addingAccount, cancelAddAccount } = useAuth()
  const { mode: themeMode } = useTheme()
  const c = goldPair[themeMode]
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setBusy(true)
    try {
      if (mode === 'reset') {
        const { error } = await resetPassword(email)
        if (error) setError(error)
        else setNotice('Check your email for a password reset link.')
      } else if (mode === 'signup') {
        const { error } = await signUp(email, password)
        if (error) setError(error)
        else setNotice('Account created. Check your email to confirm, then sign in.')
      } else {
        const { error } = await signIn(email, password)
        if (error) setError(error)
        // On success, the auth listener swaps this screen for the app automatically.
      }
    } finally {
      setBusy(false)
    }
  }

  const title =
    mode === 'signup' ? 'Create your account' : mode === 'reset' ? 'Reset your password' : 'Sign in'
  const submitLabel =
    mode === 'signup' ? 'Sign up' : mode === 'reset' ? 'Send reset link' : 'Sign in'

  const page: CSSProperties = {
    minHeight: '100vh',
    background: c.bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    fontFamily: 'Inter, system-ui, sans-serif',
  }

  const card: CSSProperties = {
    width: 380,
    maxWidth: '100%',
    background: c.panel,
    border: `1px solid ${c.border}`,
    borderRadius: 16,
    padding: 24,
    boxSizing: 'border-box',
  }

  const paw: CSSProperties = {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: pawGradient[themeMode],
    border: `2px solid ${c.accent}`,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 22,
    flexShrink: 0,
  }

  const labelStyle: CSSProperties = {
    display: 'block',
    color: c.muted,
    fontSize: 12,
    fontWeight: 600,
    margin: '12px 0 4px',
  }

  const input: CSSProperties = {
    width: '100%',
    background: c.bg,
    border: `1px solid ${c.border}`,
    borderRadius: 10,
    padding: '10px 12px',
    color: c.text,
    fontSize: 14,
    boxSizing: 'border-box',
  }

  const submitBtn: CSSProperties = {
    width: '100%',
    marginTop: 18,
    background: c.accent,
    color: c.accentText,
    border: 'none',
    borderRadius: 999,
    padding: '11px 0',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
  }

  const providerBtn: CSSProperties = {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: c.bg,
    color: c.text,
    border: `1px solid ${c.border}`,
    borderRadius: 999,
    padding: '10px 0',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  }

  const linkBtn: CSSProperties = {
    background: 'none',
    border: 'none',
    color: c.heading,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    padding: 0,
  }

  return (
    <div style={page}>
      <form onSubmit={handleSubmit} style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={paw}>🐾</div>
          <div>
            <h1 style={{ color: c.heading, fontSize: 22, fontWeight: 800, margin: 0 }}>
              Black Panther Fanworks
            </h1>
            <div style={{ color: c.muted, fontSize: 13 }}>Wakanda Forever.</div>
          </div>
        </div>

        <h2 style={{ color: c.text, fontSize: 16, fontWeight: 700, margin: '14px 0 4px' }}>
          {addingAccount ? 'Add another account' : title}
        </h2>
        {addingAccount && (
          <div style={{ color: c.muted, fontSize: 12, marginBottom: 4 }}>
            Sign in to a second account — you can switch between them from the account menu.
          </div>
        )}

        <label style={labelStyle}>Email</label>
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          style={input}
        />

        {mode !== 'reset' && (
          <>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              required
              minLength={6}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={input}
            />
          </>
        )}

        {error && <div style={{ color: c.error, fontSize: 13, marginTop: 10 }}>{error}</div>}
        {notice && <div style={{ color: c.ok, fontSize: 13, marginTop: 10 }}>{notice}</div>}

        <button type="submit" disabled={busy} style={{ ...submitBtn, opacity: busy ? 0.6 : 1 }}>
          {busy ? 'Please wait…' : submitLabel}
        </button>

        {mode !== 'reset' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '16px 0 0', color: c.muted, fontSize: 12 }}>
              <div style={{ flex: 1, height: 1, background: c.border }} />
              or continue with
              <div style={{ flex: 1, height: 1, background: c.border }} />
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
              <button type="button" disabled={busy} onClick={() => handleProvider('discord')} style={providerBtn}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="#5865F2" aria-hidden="true"><path d="M20.32 4.37a19.8 19.8 0 0 0-4.89-1.52.07.07 0 0 0-.08.04c-.21.38-.44.87-.6 1.25a18.3 18.3 0 0 0-5.5 0 12.6 12.6 0 0 0-.61-1.25.08.08 0 0 0-.08-.04 19.7 19.7 0 0 0-4.88 1.52.07.07 0 0 0-.04.03C.53 9.05-.32 13.58.1 18.06a.08.08 0 0 0 .03.05 19.9 19.9 0 0 0 6 3.03.08.08 0 0 0 .08-.03c.46-.63.87-1.3 1.23-2a.08.08 0 0 0-.04-.1 13 13 0 0 1-1.87-.9.08.08 0 0 1-.01-.12l.37-.29a.07.07 0 0 1 .08-.01 14.2 14.2 0 0 0 12.06 0 .07.07 0 0 1 .08 0l.37.3a.08.08 0 0 1 0 .12 12.3 12.3 0 0 1-1.88.9.08.08 0 0 0-.04.1c.36.7.78 1.36 1.23 2a.08.08 0 0 0 .08.02 19.8 19.8 0 0 0 6.03-3.02.08.08 0 0 0 .03-.06c.5-5.18-.84-9.67-3.55-13.66a.06.06 0 0 0-.03-.03ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.96-2.42 2.16-2.42 1.21 0 2.18 1.1 2.16 2.42 0 1.34-.96 2.42-2.16 2.42Zm7.97 0c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.95-2.42 2.15-2.42 1.22 0 2.18 1.1 2.16 2.42 0 1.34-.94 2.42-2.16 2.42Z"/></svg>
                Discord
              </button>
              <button type="button" disabled={busy} onClick={() => handleProvider('google')} style={providerBtn}>
                <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 40.2 44 35 44 24c0-1.3-.1-2.6-.4-3.9z"/></svg>
                Google
              </button>
            </div>
          </>
        )}

        <div style={{ marginTop: 16, fontSize: 13, color: c.muted, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {mode === 'signin' && (
            <>
              <button type="button" style={linkBtn} onClick={() => switchMode('signup')}>
                Create an account
              </button>
              <span>·</span>
              <button type="button" style={linkBtn} onClick={() => switchMode('reset')}>
                Forgot password?
              </button>
            </>
          )}
          {mode === 'signup' && (
            <button type="button" style={linkBtn} onClick={() => switchMode('signin')}>
              Already have an account? Sign in
            </button>
          )}
          {mode === 'reset' && (
            <button type="button" style={linkBtn} onClick={() => switchMode('signin')}>
              Back to sign in
            </button>
          )}
          {addingAccount && (
            <>
              <span>·</span>
              <button type="button" style={linkBtn} onClick={cancelAddAccount}>
                Cancel
              </button>
            </>
          )}
        </div>
      </form>
    </div>
  )

  async function handleProvider(provider: 'discord' | 'google') {
    setError(null)
    setNotice(null)
    setBusy(true)
    const { error } = await signInWithProvider(provider)
    // On success the browser redirects away; we only regain control on failure.
    if (error) {
      setError(error)
      setBusy(false)
    }
  }

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
  }
}
