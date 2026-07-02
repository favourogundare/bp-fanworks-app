import { useEffect, useState } from 'react'
import type { CSSProperties, FormEvent } from 'react'
import { supabase } from '../lib/supabase'
import { goldPair, pawGradient } from '../lib/palettes'
import { useTheme } from '../lib/theme'

// Landing page for the link in the password-reset email. Supabase processes the
// recovery token in the URL on load (detectSessionInUrl) and establishes a
// short-lived session; we then let the member set a new password.

export function ResetPasswordPage() {
  const { mode: themeMode } = useTheme()
  const c = goldPair[themeMode]
  const [ready, setReady] = useState(false) // a recovery session is present
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { if (data.session) setReady(true) })
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session) setReady(true)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(error.message)
    else {
      setDone(true)
      setTimeout(() => { window.location.assign('/') }, 1600)
    }
  }

  const page: CSSProperties = { minHeight: '100vh', background: c.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: 'Inter, system-ui, sans-serif' }
  const card: CSSProperties = { width: 380, maxWidth: '100%', background: c.panel, border: `1px solid ${c.border}`, borderRadius: 16, padding: 24, boxSizing: 'border-box' }
  const paw: CSSProperties = {
    width: 44, height: 44, borderRadius: '50%',
    background: pawGradient[themeMode],
    border: `2px solid ${c.accent}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
  }
  const label: CSSProperties = { display: 'block', color: c.muted, fontSize: 12, fontWeight: 600, margin: '12px 0 4px' }
  const input: CSSProperties = { width: '100%', background: c.bg, border: `1px solid ${c.border}`, borderRadius: 10, padding: '10px 12px', color: c.text, fontSize: 14, boxSizing: 'border-box' }
  const submitBtn: CSSProperties = { width: '100%', marginTop: 18, background: c.accent, color: c.accentText, border: 'none', borderRadius: 999, padding: '11px 0', fontSize: 14, fontWeight: 800, cursor: 'pointer' }

  return (
    <div style={page}>
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
          <div style={paw}>🐾</div>
          <h1 style={{ color: c.heading, fontSize: 20, fontWeight: 800, margin: 0 }}>Black Panther Fanworks</h1>
        </div>

        {done ? (
          <div style={{ color: c.ok, fontSize: 14, marginTop: 8 }}>Password updated — signing you in…</div>
        ) : !ready ? (
          <div style={{ color: c.muted, fontSize: 14, marginTop: 8, lineHeight: 1.6 }}>
            Open this page from the reset link in your email. If you got here by accident,{' '}
            <a href="/" style={{ color: c.heading }}>go back home</a>.
          </div>
        ) : (
          <form onSubmit={submit}>
            <h2 style={{ color: c.text, fontSize: 16, fontWeight: 700, margin: '12px 0 4px' }}>Choose a new password</h2>
            <label style={label}>New password</label>
            <input type="password" required minLength={6} autoComplete="new-password" value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" style={input} />
            {error && <div style={{ color: c.error, fontSize: 13, marginTop: 10 }}>{error}</div>}
            <button type="submit" disabled={busy} style={{ ...submitBtn, opacity: busy ? 0.6 : 1 }}>
              {busy ? 'Saving…' : 'Update password'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
