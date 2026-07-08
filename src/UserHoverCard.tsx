// Desktop username hover cards. A single global host (mounted once in
// AppLayout) renders the one active card, driven by a module-level store —
// every trigger writes into the same store instead of owning its own visible
// state, so at most one card is ever on screen even if the pointer crosses
// several usernames quickly.

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, MouseEvent, RefObject } from "react";
import { Link } from "react-router-dom";
import { Shield, UserPlus, UserMinus } from "lucide-react";
import { fetchUserPreview, getRelationshipState, setRelationship } from "./lib/api";
import type { UiUserPreview } from "./lib/types";

const HOVER_INTENT_MS = 200; // delay before a hover fires a fetch — filters accidental passes
const CLOSE_DELAY_MS = 150; // grace period so moving from the username onto the card itself doesn't close it

function hashSeed(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

// Mirrors the Avatar component in App.tsx (same hash-gradient scheme) without
// importing from App.tsx, which would create a circular import.
function PreviewAvatar({ seed, size }: { seed: string; size: number }) {
  const h = hashSeed(seed);
  return (
    <div
      style={{
        width: size, height: size, borderRadius: "50%", flexShrink: 0,
        background: `linear-gradient(135deg, hsl(${h},45%,42%), hsl(${(h + 50) % 360},45%,30%))`,
      }}
    />
  );
}

// ----- singleton "which card is open" store -----
type HoverTarget = { username: string; rect: DOMRect } | null;

let target: HoverTarget = null;
let closeTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return target;
}

function openTarget(username: string, rect: DOMRect) {
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
  target = { username, rect };
  emit();
}

function scheduleClose() {
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = setTimeout(() => { target = null; closeTimer = null; emit(); }, CLOSE_DELAY_MS);
}

function cancelClose() {
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
}

// Dismiss the card immediately (no grace period) — used when a same-tab
// navigation is about to unmount whatever it was anchored to.
function closeNow() {
  if (closeTimer) { clearTimeout(closeTimer); closeTimer = null; }
  target = null;
  emit();
}

// Same check <Link> itself uses to decide whether to do an in-app same-tab
// navigation vs. letting the browser handle it natively (new tab, etc).
function isPlainLeftClick(e: MouseEvent) {
  return e.button === 0 && !e.metaKey && !e.altKey && !e.ctrlKey && !e.shiftKey;
}

/** Attach to a username element to open its hover card after a short hover-intent delay. */
export function useUsernameHoverCard(username: string) {
  const intentTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (intentTimer.current) clearTimeout(intentTimer.current); }, []);

  return {
    onMouseEnter: (e: MouseEvent<HTMLElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      if (intentTimer.current) clearTimeout(intentTimer.current);
      intentTimer.current = setTimeout(() => openTarget(username, rect), HOVER_INTENT_MS);
    },
    onMouseLeave: () => {
      if (intentTimer.current) { clearTimeout(intentTimer.current); intentTimer.current = null; }
      scheduleClose();
    },
  };
}

// ----- session cache: preview + follow state, keyed by username -----
// No TTL/invalidation: this is a low-stakes preview (name/flair/join-date
// rarely change mid-session). The one mutable field, follow state, is patched
// in place when the card's own follow button is used, so re-hovering the
// same user reflects the change without a refetch.
type CacheEntry = { preview: UiUserPreview; follow: boolean };
const cache = new Map<string, CacheEntry>();

// ----- positioning: clamp the card inside the viewport -----
function useClampedStyle(rect: DOMRect | null, cardRef: RefObject<HTMLDivElement | null>, resizeKey: string) {
  const [style, setStyle] = useState<CSSProperties>({ position: "fixed", opacity: 0, top: -9999, left: -9999 });
  useLayoutEffect(() => {
    if (!rect || !cardRef.current) return;
    const el = cardRef.current;
    const margin = 8;
    const w = el.offsetWidth;
    const h = el.offsetHeight;

    let left = rect.left;
    if (left + w > window.innerWidth - margin) left = window.innerWidth - w - margin;
    if (left < margin) left = margin;

    let top = rect.bottom + margin;
    if (top + h > window.innerHeight - margin) {
      const above = rect.top - h - margin;
      top = above > margin ? above : margin; // if it doesn't fit above either, just clamp to the top margin
    }

    setStyle({ position: "fixed", top, left, opacity: 1, transition: "opacity 80ms ease" });
    // resizeKey forces a re-measure when the card's content (loading -> ready) changes its height.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rect, resizeKey]);
  return style;
}

/** Mounted once (in AppLayout). Renders the single active hover card, if any. */
export function UserHoverCardHost({ t, myUsername }: { t: any; myUsername: string | null }) {
  const hover = useSyncExternalStore(subscribe, getSnapshot);
  const [entry, setEntry] = useState<CacheEntry | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!hover) return;
    const { username } = hover;
    const cached = cache.get(username);
    if (cached) { setEntry(cached); setStatus("ready"); return; }

    let active = true;
    setEntry(null);
    setStatus("loading");
    (async () => {
      try {
        const preview = await fetchUserPreview(username);
        if (!active) return;
        if (!preview) { setStatus("error"); return; }
        const follow = preview.username === myUsername ? false : (await getRelationshipState(preview.id)).follow;
        if (!active) return;
        const next = { preview, follow };
        cache.set(username, next);
        setEntry(next);
        setStatus("ready");
      } catch (e) {
        console.error("hover card preview failed", e);
        if (active) setStatus("error");
      }
    })();
    return () => { active = false; };
  }, [hover, myUsername]);

  const style = useClampedStyle(hover?.rect ?? null, cardRef, `${status}:${entry?.preview.id ?? ""}`);

  if (!hover) return null;

  const toggleFollow = () => {
    if (!entry) return;
    const next = { ...entry, follow: !entry.follow };
    cache.set(hover.username, next);
    setEntry(next); // optimistic
    setRelationship(entry.preview.id, "follow", next.follow).catch((e) => {
      console.error("hover card follow toggle failed", e);
      cache.set(hover.username, entry);
      setEntry(entry); // revert
    });
  };

  return (
    <div
      ref={cardRef}
      onMouseEnter={cancelClose}
      onMouseLeave={scheduleClose}
      style={{
        ...style, zIndex: 70, width: 260, background: t.panel, border: `1px solid ${t.border}`,
        borderRadius: 12, padding: 14, boxShadow: "0 8px 24px rgba(0,0,0,.4)",
      }}
    >
      {status === "loading" && <div style={{ color: t.muted, fontSize: 13 }}>Loading…</div>}
      {status === "error" && <div style={{ color: t.muted, fontSize: 13 }}>Couldn't load this profile.</div>}
      {status === "ready" && entry && (
        <>
          <Link
            to={`/user/${entry.preview.username}`}
            onClick={(e) => { if (isPlainLeftClick(e)) closeNow(); }}
            style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, textDecoration: "none", color: "inherit" }}
          >
            <PreviewAvatar seed={entry.preview.username} size={40} />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: t.text, fontWeight: 800, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{entry.preview.display}</span>
                {entry.preview.isMod && <Shield size={14} color="#ff4500" />}
              </div>
              <div style={{ color: t.muted, fontSize: 12 }}>{entry.preview.username}</div>
            </div>
          </Link>
          {entry.preview.flair && (
            <span style={{ display: "inline-block", background: "#6b3f1d", color: "#ffd9a8", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, marginBottom: 8 }}>{entry.preview.flair}</span>
          )}
          <div style={{ color: t.muted, fontSize: 12, marginBottom: entry.preview.username === myUsername ? 0 : 10 }}>Joined {entry.preview.age}</div>
          {entry.preview.username !== myUsername && (
            <button
              onClick={toggleFollow}
              style={{
                display: "flex", alignItems: "center", gap: 6, width: "100%", justifyContent: "center",
                background: entry.follow ? t.accent : t.panel2, color: entry.follow ? t.accentText : t.text,
                border: `1px solid ${entry.follow ? t.accent : t.border}`, borderRadius: 999, padding: "6px 0",
                cursor: "pointer", fontWeight: 700, fontSize: 13,
              }}
            >
              {entry.follow ? <UserMinus size={14} /> : <UserPlus size={14} />}
              {entry.follow ? "Following" : "Follow"}
            </button>
          )}
        </>
      )}
    </div>
  );
}
