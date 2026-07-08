// Reading history for the "Continue Reading" shelf (MILESTONES §2).
// localStorage only — per-device by design, no DB, nothing leaves the browser.
// Users can clear it or disable tracking entirely; both survive reloads.

export type HistoryEntry = {
  id: string
  title: string
  author: string
  at: string // ISO timestamp of the visit
}

const KEY = 'bpf:reading-history'
const OFF_KEY = 'bpf:reading-history-off'
const MAX = 50

// localStorage can throw (Safari private mode, storage full) — history is a
// nice-to-have, so every access fails soft.
function read(): HistoryEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function write(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries))
  } catch {
    /* fail soft */
  }
}

export function isTrackingOff(): boolean {
  try {
    return localStorage.getItem(OFF_KEY) === '1'
  } catch {
    return false
  }
}

/** Disabling also clears the stored history — "stop tracking me" shouldn't leave a trail. */
export function setTrackingOff(off: boolean) {
  try {
    if (off) {
      localStorage.setItem(OFF_KEY, '1')
      localStorage.removeItem(KEY)
    } else {
      localStorage.removeItem(OFF_KEY)
    }
  } catch {
    /* fail soft */
  }
}

/** Record a post visit: most recent first, deduped by id, capped at MAX. */
export function recordView(e: { id: string; title: string; author: string }) {
  if (isTrackingOff()) return
  const rest = read().filter((h) => h.id !== e.id)
  write([{ ...e, at: new Date().toISOString() }, ...rest].slice(0, MAX))
}

export function getHistory(): HistoryEntry[] {
  return isTrackingOff() ? [] : read()
}

export function clearHistory() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* fail soft */
  }
}
