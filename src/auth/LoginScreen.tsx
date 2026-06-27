import { useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { useAuth } from './AuthProvider'

// Black & gold "golden-jaguar" palette, matching the community pages.
const c = {
  bg: '#0B0B0F',
  panel: '#15141a',
  panel2: '#1F1E26',
  border: '#2e2b22',
  text: '#ECE8DF',
  muted: '#9b9488',
  heading: '#C8A24A',
  accent: '#C8A24A',
  accentText: '#15110a',
  error: '#e0726b',
  ok: '#8fce9b',
}

type Mode = 'signin' | 'signup' | 'reset'

export function LoginScreen() {
  const { signIn, signUp, resetPassword } = useAuth()
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

        <h2 style={{ color: c.text, fontSize: 16, fontWeight: 700, margin: '14px 0 4px' }}>{title}</h2>

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
        </div>
      </form>
    </div>
  )

  function switchMode(next: Mode) {
    setMode(next)
    setError(null)
    setNotice(null)
  }
}

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
  background: 'radial-gradient(circle at 35% 30%, #2a2a2e, #050505)',
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

const linkBtn: CSSProperties = {
  background: 'none',
  border: 'none',
  color: c.heading,
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  padding: 0,
}
