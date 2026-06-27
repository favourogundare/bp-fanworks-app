import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { AuthProvider, useAuth } from './auth/AuthProvider.tsx'
import { LoginScreen } from './auth/LoginScreen.tsx'
import { isSupabaseConfigured } from './lib/supabase.ts'

function Root() {
  const { session, loading } = useAuth()

  if (!isSupabaseConfigured) return <SetupNotice />
  if (loading) return <Splash />
  if (!session) return <LoginScreen />
  return <App />
}

function Splash() {
  return (
    <div style={centered}>
      <div style={{ color: '#9b9488', fontSize: 14 }}>Loading…</div>
    </div>
  )
}

function SetupNotice() {
  return (
    <div style={centered}>
      <div
        style={{
          maxWidth: 460,
          background: '#15141a',
          border: '1px solid #2e2b22',
          borderRadius: 16,
          padding: 24,
          color: '#ECE8DF',
        }}
      >
        <h1 style={{ color: '#C8A24A', fontSize: 20, margin: '0 0 12px' }}>Almost there</h1>
        <p style={{ color: '#9b9488', fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          Add your Supabase anon key to <code style={code}>.env</code> as{' '}
          <code style={code}>VITE_SUPABASE_ANON_KEY</code>, then restart the dev server
          (<code style={code}>npm run dev</code>). Find it in the Supabase dashboard under
          <strong> Project Settings → API</strong>.
        </p>
      </div>
    </div>
  )
}

const centered = {
  minHeight: '100vh',
  background: '#0B0B0F',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
  fontFamily: 'Inter, system-ui, sans-serif',
} as const

const code = {
  background: '#1F1E26',
  borderRadius: 4,
  padding: '1px 6px',
  fontSize: 13,
  color: '#C8A24A',
} as const

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <Root />
    </AuthProvider>
  </StrictMode>,
)
