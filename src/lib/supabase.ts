import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

/**
 * True only when both env vars are present. The UI uses this to show a setup
 * notice instead of a broken login form when .env hasn't been filled in yet.
 */
export const isSupabaseConfigured = Boolean(url && anonKey)

// Fall back to harmless placeholders so createClient() doesn't throw before the
// keys are configured; the gate in main.tsx blocks real usage until it's set up.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
)
