import React, { useState, useEffect, useMemo, useRef, useContext, createContext } from "react";
import {
  Plus, Bell, BellOff, MoreHorizontal, ArrowUp, ArrowDown, MessageCircle,
  Share2, Search, ChevronDown, ChevronUp, ChevronRight, Pin, Shield, BookOpen, TriangleAlert,
  Globe, ArrowLeft, Send, X, Image as ImageIcon, Link2, BarChart3, Video,
  FileText, HelpCircle, Megaphone, Lightbulb, MessageSquare, UserPlus,
  UserMinus, VolumeX, Flag, Gift, Star, Eye, EyeOff, Repeat2, LogOut, Sun, Moon, Pencil, ExternalLink, Bookmark,
} from "lucide-react";
import { Routes, Route, Navigate, Outlet, useNavigate, useLocation, useParams, useOutletContext, useSearchParams } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { LoginScreen } from "./auth/LoginScreen";
import { ResetPasswordPage } from "./auth/ResetPasswordPage";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { fetchCommunityFeed, fetchCommunityStats, fetchPinned, fetchPostWithComments, fetchProfile, getMyVote, castVote, getRelationshipState, setRelationship, fetchHiddenUsernames, getMyProfileId, fetchMyIdentity, createPost, createComment, uploadMedia, updatePost, deletePost, updateComment, deleteComment, updateMyProfile, uploadAvatar, fetchMyMutes, USERNAME_RE, fetchTagFeed, searchPosts, getMySaved, toggleSaved, fetchSavedPosts, fetchSavedComments, castPollVote, fetchPollResults, fetchNotifications, fetchUnreadCount, markAllNotificationsRead, fetchMyFollowedTags, toggleTagFollow, fetchFollowedFeed, getMyPostFollow, togglePostFollow, fetchMyFolders, createFolder, deleteFolder, fetchFolderMembership, toggleFolderItem, fetchCollectionsByUser, fetchCollection, fetchCollectionPosts, createCollection, deleteCollection, fetchMyCollections, fetchCollectionMembership, toggleCollectionItem, getMyCollectionFollow, toggleCollectionFollow } from "./lib/api";
import type { FeedSort, UiNotification, UiFolder, UiCollection } from "./lib/api";
import type { UiPost, UiPinned, UiProfile } from "./lib/types";
import { recordView, getHistory, clearHistory, isTrackingOff, setTrackingOff } from "./lib/readingHistory";
import { timeAgo } from "./lib/time";
import type { HistoryEntry } from "./lib/readingHistory";
import { getOrCreateConversation, fetchConversations, fetchMessages, sendMessage, subscribeToMessages } from "./lib/chat";
import type { UiMessage, UiConversation } from "./lib/chat";
import { modSetPinned, modRemovePost, modSetPostFlairs, modAssignMemberFlair } from "./lib/mod";
import { setPageMeta, clip } from "./lib/seo";
import { useUsernameHoverCard, UserHoverCardHost } from "./UserHoverCard";
import { goldPair, neutralPair } from "./lib/palettes";
import type { Palette } from "./lib/palettes";
import { useTheme } from "./lib/theme";
import { useBreakpoint } from "./lib/useBreakpoint";

/*
  BLACK PANTHER FANWORKS — single-community prototype
  ---------------------------------------------------
  Frontend prototype only: all state is in-memory (resets on reload).
  Login, real chat, persistent karma, cross-user block/mute, and moderation
  need a backend. See the build/buy notes in chat.

  Palette = "Luxury Designer Board" (black / gold / purple / teal).
  Community + post pages use the black-gold theme.
  The MEMBER page keeps the neutral Reddit-dark theme, by request.
*/

// ----- Community -----
const community = {
  name: "Black Panther Fanworks",
  short: "Black Panther Fanworks",
  blurb:
    "A Wakanda-first community for fanfiction, art, music, cosplay, and discussion rooted in the Black Panther MCU films and comics canon. Source your artwork, flair your posts, and engage in good faith. Wakanda Forever.",
  created: "Jun 27, 2026",
  // Bookmarks link to a route (`to`) or to a pinned post matched by title
  // (`pinnedMatch`) so we never hardcode post ids.
  bookmarks: [
    { label: "Wiki", pinnedMatch: /lore megathread/i },
    { label: "Fanfic Archive", to: "/t/fanfiction" },
    { label: "Weekly Self-Promo Thread", pinnedMatch: /self-promo/i },
  ],
  rules: [
    { title: "Source All Artwork and Scans", desc: "All fanart, cosplay photos, or music must clearly credit the original artist or creator in the post title or a comment. If you are the creator, you may tag it as [OC]." },
    { title: "Keep It Wakanda-Centric", desc: "This is a Wakanda-first community. The main focus of all posts should be characters, locations, and lore from the Black Panther MCU films and comics canon. Other Marvel characters are welcome if the post connects them to Wakandan characters or themes." },
    { title: "Mark NSFW and Mature Content", desc: "All sexually explicit, graphically violent, or otherwise NSFW content must be marked with the NSFW tag. Explicit images, including suggestive cosplay poses and mature artwork, must not appear as thumbnails. Fanfics with explicit ratings must be tagged accordingly with warnings clearly visible." },
    { title: "Use Post Flairs Correctly", desc: "All posts must use the appropriate flair: Fanfiction, Art, Music, Cosplay, Discussion, Question, News, Meme, etc. This keeps the community organised and easy to browse. Mods may re-flair or remove posts that lack a flair." },
    { title: "Political Discussion Is Welcome, Civility Is Required", desc: "Wakanda's stories have always been political, and this community will not censor political posts or commentary. However, any post or comment that cannot remain civil, or that devolves into personal attacks, abuse, or harassment, will be removed." },
    { title: "Paid Promotions", desc: "Advertising (or soliciting) ANY paid services is prohibited. Non-paid self-promo for fanfic, art, music, collab etc is allowed but only on the corresponding Weekly/Monthly Thread." },
    { title: "Engage With Kindness and Good Faith", desc: "Assume others are commenting in good faith, and respond accordingly. Do not jump to the worst possible interpretation of someone's words. If you're unsure about someone's meaning, ask for clarification before reacting." },
    { title: "Moderator Discretion", desc: "We're very open about what can be posted here, but we leave most things up to moderator discretion. The mod team discuss most moderating decisions and take everything on a case-by-case basis." },
  ],
};

// ----- Flairs (from the "Use Post Flairs Correctly" rule) -----
const POST_FLAIRS = {
  fanfiction: { label: "Fanfiction", bg: "#6A1B9A", fg: "#f0e2ff" },
  art:        { label: "Art",        bg: "#8B4CC2", fg: "#1a0b26" },
  music:      { label: "Music",      bg: "#267BA3", fg: "#e6f5ff" },
  cosplay:    { label: "Cosplay",    bg: "#2FB7C8", fg: "#06222a" },
  discussion: { label: "Discussion", bg: "#214E7A", fg: "#dbeaff" },
  question:   { label: "Question",   bg: "#173B63", fg: "#cfe0f5" },
  news:       { label: "News",       bg: "#C8A24A", fg: "#1a1405" },
  meme:       { label: "Meme",       bg: "#4B0F5E", fg: "#f3dcff" },
  nsfw:       { label: "NSFW",       bg: "#7a1f1f", fg: "#ffd9d9" },
};

const HOTTAKE_BODY =
  "About Me: I am a Black American Woman who was born in Nigeria before my family immigrated, who has written 60+ fanfic for BP and has an entire worldbuilding document.\n\nHere are my hot takes — and yes, one of them is that Michael B. Jordan was miscast as Killmonger. Bite me. Reasoning in the comments if anyone actually wants to engage in good faith.";

const OP_REASONING =
  "Thank you for reading. Here is my reasoning:\n\n1. MBJ is a very attractive man. This is not a bad thing, but I do not believe he really espouses the gravitas/terror Killmonger should have. A lot of women especially (and I'm in fanfiction spaces mostly) were super attracted to him and didn't take the violence he committed in the movie at all seriously. Killmonger in MCU canon is a mass murderer committed to conquering Wakanda by his own (admittedly revolutionary) means. That's terrifying.\n\n2. I am not implying Killmonger can't be charismatic or attractive to some. I'm just saying his character in its comic inception, and due to MCU's decision to make him a literal conqueror, means he would not be \u201ccute.\u201d It should be clear.\n\n3. MBJ could be a great Sam Wilson. (And is def hotter than our current one.) But not Killmonger.\n   \u2022 A better casting might be Daniel Kaluuya — an amazing actor; the performance that sold me on his range is the movie \u201cWidows.\u201d\n   \u2022 Another contender: Brian Tyree Henry. We see him in the series \u201cAtlanta,\u201d and he has such *black* energy. The few times he gets mad or aggressive in the show, it's genuinely *scary.*\n\n4. Finally, I have some military (Marines) background, and MBJ's performance didn't carry the rigidity or strength I think a former Navy SEAL (probably at Lt. Commander rank) should have.\n\n5. This is my opinion and I am available to chat further over DMs.";

// Sample posts, comments, and member data now live in the database (seeded by
// migration 0002) and are fetched via src/lib/api.ts.

// ----- Atoms -----
// plain: non-navigating chip for picker contexts (CreatePostModal, ModBar
// re-flair) where a wrapping span owns the click to toggle selection.
function Flair({ flairKey, plain = false }: any) {
  const f = POST_FLAIRS[flairKey];
  const navigate = useNavigate();
  if (!f) return null;
  const base = { background: f.bg, color: f.fg, borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 700 };
  if (plain) return <span style={base}>{f.label}</span>;
  return <span onClick={(e) => { e.stopPropagation(); navigate(`/t/${flairKey}`); }} title={`See all ${f.label} posts`}
    style={{ ...base, cursor: "pointer" }}>{f.label}</span>;
}

// Signed-in member's content prefs, provided by AppLayout (blur pref reaches MediaBlock without prop drilling).
const PrefsContext = createContext<{ blurMedia: boolean; spoilerFree: boolean; spoilerTags: string[]; mutedTags: string[] }>({ blurMedia: true, spoilerFree: false, spoilerTags: [], mutedTags: [] });

function Avatar({ seed, size = 36, t, url = null }: any) {
  if (url) return <img src={url} alt={`${seed}'s avatar`} style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0, objectFit: "cover", border: `1px solid ${t.border}` }} />;
  let h = 0; for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return <div style={{ width: size, height: size, borderRadius: "50%", flexShrink: 0,
    background: `linear-gradient(135deg, hsl(${h},45%,42%), hsl(${(h + 50) % 360},45%,30%))`, border: `1px solid ${t.border}` }} />;
}

function Vote({ votes, t, targetType, targetId }) {
  const [myVote, setMyVote] = useState(0);   // -1 / 0 / 1, this member's vote
  const [base, setBase] = useState(votes);   // server score excluding my vote

  // Load my existing vote on this target so the highlight + count are correct.
  useEffect(() => {
    let active = true;
    getMyVote(targetType, targetId).then((v) => {
      if (!active) return;
      setMyVote(v);
      setBase(votes - v);
    });
    return () => { active = false; };
  }, [targetType, targetId, votes]);

  const count = base + myVote;
  const cast = (val) => {
    const next = myVote === val ? 0 : val; // clicking your active vote toggles it off
    const prev = myVote;
    setMyVote(next); // optimistic
    castVote(targetType, targetId, next).catch((e) => { console.error("vote failed", e); setMyVote(prev); });
  };
  const btn = (active, color) => ({ background: "none", border: "none", cursor: "pointer", display: "flex", color: active ? color : t.muted, padding: 2 });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: t.pill, borderRadius: 999, padding: "4px 10px" }}>
      <button style={btn(myVote === 1, t.orange)} onClick={() => cast(1)} aria-label="Upvote"><ArrowUp size={18} /></button>
      <span style={{ fontSize: 13, fontWeight: 700, color: myVote === 1 ? t.orange : myVote === -1 ? "#7193ff" : t.text }}>{count}</span>
      <button style={btn(myVote === -1, "#7193ff")} onClick={() => cast(-1)} aria-label="Downvote"><ArrowDown size={18} /></button>
    </div>
  );
}

function ActionPill({ icon, label, t, onClick }: any) {
  return <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, background: t.pill, color: t.muted,
    border: "none", borderRadius: 999, padding: "6px 12px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{icon}{label}</button>;
}

// Saved/bookmark state for a post or comment: lazy-loads my state (same pattern
// as Vote), optimistic toggle with revert on failure.
function useSaved(targetType: "post" | "comment", targetId: string): [boolean, () => void] {
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    let active = true;
    getMySaved(targetType, targetId).then((v) => { if (active) setSaved(v); });
    return () => { active = false; };
  }, [targetType, targetId]);
  const toggle = () => {
    const next = !saved;
    setSaved(next); // optimistic
    toggleSaved(targetType, targetId, next).catch((e) => { console.error("save failed", e); setSaved(!next); });
  };
  return [saved, toggle];
}

function usePostFollow(postId: string): [boolean, () => void] {
  const [followed, setFollowed] = useState(false);
  useEffect(() => {
    let active = true;
    getMyPostFollow(postId).then((v) => { if (active) setFollowed(v); });
    return () => { active = false; };
  }, [postId]);
  const toggle = () => {
    const next = !followed;
    setFollowed(next); // optimistic
    togglePostFollow(postId, next).catch((e) => { console.error("post follow failed", e); setFollowed(!next); });
  };
  return [followed, toggle];
}

// Copy a shareable link to a post (now that posts have real URLs).
function copyPostLink(id: string) {
  const url = `${window.location.origin}/post/${id}`;
  if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
}

// In-app confirmation modal (replaces native window.confirm for destructive actions).
function ConfirmDialog({ t, title, message, confirmLabel = "Delete", onConfirm, onClose, busy }: any) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={busy ? undefined : onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 14, width: 380, maxWidth: "100%", padding: 20 }}>
        <h3 style={{ color: t.text, margin: "0 0 8px", fontSize: 16, fontWeight: 800 }}>{title}</h3>
        <p style={{ color: t.muted, fontSize: 14, lineHeight: 1.5, margin: "0 0 16px" }}>{message}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button onClick={onClose} disabled={busy} style={{ background: "transparent", color: t.text, border: `1px solid ${t.border}`, borderRadius: 999, padding: "8px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Cancel</button>
          <button onClick={onConfirm} disabled={busy} style={{ background: "#e0726b", color: "#1a0b0b", border: "none", borderRadius: 999, padding: "8px 18px", cursor: "pointer", fontWeight: 800, fontSize: 13, opacity: busy ? 0.6 : 1 }}>{busy ? "Deleting…" : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

// Themed member flairs (must match the slugs seeded in migration 0001).
const MEMBER_FLAIRS = [
  { slug: "dora-milaje", label: "Dora Milaje" },
  { slug: "wakandan-council", label: "Wakandan Council" },
  { slug: "jabari", label: "Jabari" },
  { slug: "outrider", label: "Outrider" },
  { slug: "wkabi-stan", label: "W'Kabi Stan" },
];

const isVideo = (u: string) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u);

// ----- Media (real uploads + NSFW suppression) -----
// Content warnings: body/media hide behind this box until clicked; the title
// and flairs stay visible so readers can decide (MILESTONES §3).
function ContentWarningGate({ warnings, t, children }: any) {
  const [open, setOpen] = useState(false);
  if (!warnings?.length || open) return children;
  return (
    <div onClick={(e) => e.stopPropagation()} style={{ border: `1px solid ${t.border}`, background: t.panel2, borderRadius: 12, padding: "14px 16px", margin: "4px 0 10px", display: "flex", alignItems: "center", gap: 12 }}>
      <TriangleAlert size={20} color={t.accent} />
      <div style={{ flex: 1 }}>
        <div style={{ color: t.text, fontSize: 13, fontWeight: 800 }}>Content warning</div>
        <div style={{ color: t.muted, fontSize: 13 }}>{warnings.join(", ")}</div>
      </div>
      <button onClick={() => setOpen(true)} style={{ ...relBtn(t), padding: "5px 14px", fontSize: 12 }}>Show post</button>
    </div>
  );
}

function MediaBlock({ post, t }: any) {
  // Descriptive alt for search/social indexing: "Art by goldjaguar_art: ..."
  const mediaKind = POST_FLAIRS[(post.flairs || [])[0]]?.label ?? "Post media";
  const [revealed, setRevealed] = useState(false);
  const { blurMedia } = useContext(PrefsContext);
  const nsfw = post.flairs?.includes("nsfw") && blurMedia; // pref off = never blur
  const urls = (post.media || []).filter((m: any) => typeof m === "string" && m.startsWith("http"));

  if (urls.length === 0) {
    // Seeded demo posts carry a non-URL placeholder; show the old gradient box.
    if (!post.image) return null;
    return <div style={{ height: 220, borderRadius: 12, marginTop: 8, background: "linear-gradient(135deg,#241f12,#0e0c08)", border: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: t.muted }}><ImageIcon size={28} /></div>;
  }
  if (nsfw && !revealed) {
    return (
      <div onClick={(e) => { e.stopPropagation(); setRevealed(true); }} style={{ height: 220, borderRadius: 12, marginTop: 8, background: t.panel2, border: `1px solid ${t.border}`, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, cursor: "pointer", color: t.muted }}>
        <Flag size={22} /><div style={{ fontSize: 13, fontWeight: 700 }}>NSFW — click to reveal</div>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 8, overflowX: "auto", marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
      {urls.map((u: string, i: number) => isVideo(u)
        ? <video key={i} src={u} controls muted aria-label={`${mediaKind} video by ${post.author}: ${post.title}`} style={{ maxHeight: 340, maxWidth: "100%", borderRadius: 12, border: `1px solid ${t.border}` }} />
        : <img key={i} src={u} alt={`${mediaKind} by ${post.author}: ${post.title}${urls.length > 1 ? ` (${i + 1} of ${urls.length})` : ""}`} style={{ maxHeight: 340, maxWidth: "100%", borderRadius: 12, border: `1px solid ${t.border}`, objectFit: "cover" }} />)}
    </div>
  );
}

// ----- Comment composer (reused for top-level + replies) -----
function CommentComposer({ t, postId, parentId, onAdded, placeholder, onCancel }: any) {
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    const body = val.trim();
    if (!body) return;
    setBusy(true);
    try { await createComment({ postId, body, parentId: parentId ?? null }); setVal(""); onAdded?.(); onCancel?.(); }
    catch (e) { console.error("comment failed", e); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ marginTop: 8 }}>
      <textarea value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder || "Add a comment…"} rows={3}
        style={{ width: "100%", background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", color: t.text, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", fontSize: 14 }} />
      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
        <span style={{ color: t.muted, fontSize: 11, marginRight: "auto" }}>{val.includes(">!") ? "Spoiler markup active" : "Tip: >!text!< hides a spoiler"}</span>
        {onCancel && <button onClick={onCancel} style={{ background: "transparent", color: t.muted, border: `1px solid ${t.border}`, borderRadius: 999, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Cancel</button>}
        <button onClick={submit} disabled={busy || !val.trim()} style={{ background: t.accent, color: t.accentText, border: "none", borderRadius: 999, padding: "6px 16px", cursor: "pointer", fontSize: 13, fontWeight: 800, opacity: busy || !val.trim() ? 0.6 : 1 }}>{busy ? "Posting…" : "Comment"}</button>
      </div>
    </div>
  );
}

// ----- Comments -----
// Reddit-style spoiler markup: >!hidden text!< renders blurred until clicked.
// Body text stays plain text (React escapes it) — this only wraps matched
// segments in a reveal-on-click span.
function Spoiler({ text, t }: any) {
  const [shown, setShown] = useState(false);
  return (
    <span onClick={(e) => { e.stopPropagation(); setShown(true); }} title={shown ? undefined : "Show spoiler"}
      style={shown ? { background: t.pill, borderRadius: 4, padding: "0 4px" }
        : { background: t.pill, color: "transparent", borderRadius: 4, padding: "0 4px", cursor: "pointer", textShadow: "none", userSelect: "none" }}>
      {text}
    </span>
  );
}

function renderSpoilers(body: string, t: any) {
  const parts = body.split(/>!(.+?)!</gs);
  if (parts.length === 1) return body;
  // split with a capture group alternates: [plain, spoiler, plain, spoiler, ...]
  return parts.map((seg, i) => (i % 2 === 1 ? <Spoiler key={i} text={seg} t={t} /> : seg));
}

// Collapse state survives comment-tree refetches (reply/edit reload remounts the
// tree); keyed by comment id, module scope = kept while the SPA session lives.
const collapsedComments = new Set<string>();
const countReplies = (c: any): number => (c.replies ?? []).reduce((n: number, r: any) => n + 1 + countReplies(r), 0);

function Comment({ c, t, depth = 0, postId, onAdded, myUsername, onAuthor }: any) {
  const [collapsed, setCollapsed] = useState(collapsedComments.has(c.id));
  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    if (next) collapsedComments.add(c.id); else collapsedComments.delete(c.id);
  };
  const hidden = countReplies(c);
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.body);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const mine = !!myUsername && c.author === myUsername;
  const [saved, toggleSave] = useSaved("comment", c.id);
  const hoverHandlers = useUsernameHoverCard(c.author);

  const saveEdit = async () => {
    const body = draft.trim();
    if (!body || body === c.body) { setEditing(false); return; }
    setBusy(true);
    try { await updateComment(c.id, body); setEditing(false); onAdded?.(); }
    catch (e) { console.error("comment edit failed", e); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await deleteComment(c.id); onAdded?.(); }
    catch (e) { console.error("comment delete failed", e); }
    finally { setBusy(false); setConfirming(false); }
  };

  const isTarget = typeof window !== "undefined" && window.location.hash === `#comment-${c.id}`;
  const [linkCopied, setLinkCopied] = useState(false);
  const copyCommentLink = () => {
    const url = `${window.location.origin}/post/${postId}#comment-${c.id}`;
    if (navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 1500);
  };
  return (
    <div id={`comment-${c.id}`} style={{ marginTop: 14, paddingLeft: depth ? 16 : 0, borderLeft: depth ? `2px solid ${t.border}` : "none", marginLeft: depth ? 6 : 0, ...(isTarget ? { outline: `2px solid ${t.accent}`, outlineOffset: 4, borderRadius: 8 } : null) }}>
      <div onClick={toggleCollapsed} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }} title={collapsed ? "Expand thread" : "Collapse thread"}>
        <button style={{ background: "none", border: "none", color: t.muted, cursor: "pointer", display: "flex" }} aria-label={collapsed ? "Expand thread" : "Collapse thread"}>
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        <Avatar seed={c.author} size={22} t={t} />
        {c.deleted ? (
          <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{c.author}</span>
        ) : (
          <span onClick={() => onAuthor?.(c.author)} {...hoverHandlers} style={{ fontSize: 13, fontWeight: 700, color: t.text, cursor: "pointer" }}>{c.author}</span>
        )}
        {c.flair && <span style={{ background: t.link, color: t.bg, fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 4 }}>{c.flair}</span>}
        <span style={{ fontSize: 12, color: t.muted }}>· {c.when}</span>
        {collapsed && <span style={{ fontSize: 12, color: t.muted, fontStyle: "italic" }}>{hidden > 0 ? `· ${hidden} ${hidden === 1 ? "reply" : "replies"} hidden` : "· collapsed"}</span>}
      </div>
      {!collapsed && (
        <div style={{ paddingLeft: 30 }}>
          {editing ? (
            <div style={{ marginTop: 8 }}>
              <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={3}
                style={{ width: "100%", background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", color: t.text, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", fontSize: 14 }} />
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
                <button onClick={() => { setDraft(c.body); setEditing(false); }} style={{ background: "transparent", color: t.muted, border: `1px solid ${t.border}`, borderRadius: 999, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Cancel</button>
                <button onClick={saveEdit} disabled={busy || !draft.trim()} style={{ background: t.accent, color: t.accentText, border: "none", borderRadius: 999, padding: "6px 16px", cursor: "pointer", fontSize: 13, fontWeight: 800, opacity: busy || !draft.trim() ? 0.6 : 1 }}>{busy ? "Saving…" : "Save"}</button>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 14, color: c.deleted ? t.muted : t.text, fontStyle: c.deleted ? "italic" : "normal", whiteSpace: "pre-wrap", margin: "6px 0", lineHeight: 1.55 }}>{c.deleted ? c.body : renderSpoilers(c.body, t)}</p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 16, color: t.muted, fontSize: 12, fontWeight: 600 }}>
            <Vote votes={c.votes} t={t} targetType="comment" targetId={c.id} />
            <span onClick={() => setReplying(!replying)} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}><MessageCircle size={14} /> Reply</span>
            <span onClick={toggleSave} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: saved ? t.accent : undefined }}><Bookmark size={14} fill={saved ? "currentColor" : "none"} /> {saved ? "Saved" : "Save"}</span>
            {mine && <span onClick={() => setEditing(!editing)} style={{ cursor: "pointer" }}>Edit</span>}
            {mine && <span onClick={() => setConfirming(true)} style={{ cursor: busy ? "default" : "pointer", color: "#e0726b", opacity: busy ? 0.6 : 1 }}>Delete</span>}
            <span style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}><Gift size={14} /> Award</span>
            <span onClick={copyCommentLink} title="Copy a direct link to this comment" style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", color: linkCopied ? t.accent : undefined }}><Share2 size={14} /> {linkCopied ? "Link copied!" : "Share"}</span>
          </div>
          {replying && <CommentComposer t={t} postId={postId} parentId={c.id} placeholder={`Reply to ${c.author}…`} onAdded={onAdded} onCancel={() => setReplying(false)} />}
          {c.replies?.map((r) => <Comment key={r.id} c={r} t={t} depth={depth + 1} postId={postId} onAdded={onAdded} myUsername={myUsername} onAuthor={onAuthor} />)}
        </div>
      )}
      {confirming && <ConfirmDialog t={t} title="Delete comment?" message="Your comment will show as “[deleted]”. Replies to it stay." onConfirm={remove} onClose={() => setConfirming(false)} busy={busy} />}
    </div>
  );
}

// ----- Post card -----
function PostCard({ post, t, onOpen, onAuthor, muted, showMeta, myUsername, onChanged }: any) {
  const [followed, toggleFollowed] = usePostFollow(post.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const mine = !!myUsername && post.author === myUsername;
  const [saved, toggleSave] = useSaved("post", post.id);
  const hoverHandlers = useUsernameHoverCard(post.author);
  const { spoilerFree, spoilerTags, mutedTags } = useContext(PrefsContext);
  const [revealed, setRevealed] = useState(false);
  // Spoiler-free mode: hide posts carrying any tag the member marked as a spoiler.
  const spoilerHit = spoilerFree ? (post.flairs || []).filter((f: string) => spoilerTags.includes(f)) : [];
  // Muted tags hide unconditionally (no mode toggle), same show-anyway escape.
  const muteHit = (post.flairs || []).filter((f: string) => mutedTags.includes(f));

  const saveEdit = async () => {
    const tt = title.trim();
    if (!tt) return;
    setBusy(true);
    try { await updatePost(post.id, { title: tt, body: body.trim() }); setEditing(false); onChanged?.(); }
    catch (e) { console.error("post edit failed", e); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await deletePost(post.id); onChanged?.(); }
    catch (e) { console.error("post delete failed", e); setBusy(false); setConfirming(false); }
  };

  if (muted) {
    return <div style={{ borderBottom: `1px solid ${t.border}`, padding: "14px 0", color: t.muted, fontSize: 13, fontStyle: "italic" }}>
      Post hidden — you muted{" "}
      <span onClick={() => onAuthor(post.author)} {...hoverHandlers} style={{ color: t.heading, cursor: "pointer", fontStyle: "normal", fontWeight: 700 }}>{post.author}</span>. Open their profile to unmute.
    </div>;
  }
  if (spoilerHit.length > 0 && !revealed) {
    return <div style={{ borderBottom: `1px solid ${t.border}`, padding: "14px 0", display: "flex", alignItems: "center", gap: 10, color: t.muted, fontSize: 13 }}>
      <EyeOff size={15} />
      <span style={{ fontStyle: "italic" }}>Hidden by spoiler-free mode — tagged {spoilerHit.map((f: string) => POST_FLAIRS[f]?.label ?? f).join(", ")}.</span>
      <button onClick={() => setRevealed(true)} style={{ ...relBtn(t), padding: "4px 12px", fontSize: 12, marginLeft: "auto" }}>Show anyway</button>
    </div>;
  }
  if (muteHit.length > 0 && !revealed) {
    return <div style={{ borderBottom: `1px solid ${t.border}`, padding: "14px 0", display: "flex", alignItems: "center", gap: 10, color: t.muted, fontSize: 13 }}>
      <VolumeX size={15} />
      <span style={{ fontStyle: "italic" }}>Hidden — you muted {muteHit.map((f: string) => POST_FLAIRS[f]?.label ?? f).join(", ")}.</span>
      <button onClick={() => setRevealed(true)} style={{ ...relBtn(t), padding: "4px 12px", fontSize: 12, marginLeft: "auto" }}>Show anyway</button>
    </div>;
  }
  return (
    <div style={{ borderBottom: `1px solid ${t.border}`, padding: "16px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }} onClick={() => onOpen(post)}>
        <Avatar seed={post.author} size={26} t={t} />
        <span onClick={(e) => { e.stopPropagation(); onAuthor(post.author); }} {...hoverHandlers} style={{ fontSize: 13, fontWeight: 700, color: t.heading }}>{post.author}</span>
        <span style={{ fontSize: 12, color: t.muted }}>· {post.when}</span>
        {post.pinned && <Pin size={13} color={t.accent} />}
        {mine && (
          <div style={{ marginLeft: "auto", position: "relative" }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setMenuOpen(!menuOpen)} aria-label="Post options" style={{ background: "none", border: "none", color: t.muted, cursor: "pointer", display: "flex", padding: 0 }}><MoreHorizontal size={16} /></button>
            {menuOpen && (
              <div style={{ position: "absolute", right: 0, top: 22, background: t.panel2, border: `1px solid ${t.border}`, borderRadius: 8, padding: 4, zIndex: 10, minWidth: 110 }}>
                <button onClick={() => { setEditing(true); setMenuOpen(false); }} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: t.text, cursor: "pointer", fontSize: 13, padding: "7px 10px", borderRadius: 6 }}>Edit</button>
                <button onClick={() => { setMenuOpen(false); setConfirming(true); }} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: "#e0726b", cursor: "pointer", fontSize: 13, padding: "7px 10px", borderRadius: 6 }}>Delete</button>
              </div>
            )}
          </div>
        )}
        {!mine && <MoreHorizontal size={16} color={t.muted} style={{ marginLeft: "auto" }} />}
      </div>
      {editing ? (
        <div style={{ marginBottom: 8 }}>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title"
            style={{ width: "100%", background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", color: t.text, marginBottom: 8, boxSizing: "border-box", fontSize: 16, fontWeight: 700 }} />
          <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Body text" rows={4}
            style={{ width: "100%", background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", color: t.text, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", fontSize: 14 }} />
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
            <button onClick={() => { setTitle(post.title); setBody(post.body); setEditing(false); }} style={{ background: "transparent", color: t.muted, border: `1px solid ${t.border}`, borderRadius: 999, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Cancel</button>
            <button onClick={saveEdit} disabled={busy || !title.trim()} style={{ background: t.accent, color: t.accentText, border: "none", borderRadius: 999, padding: "6px 16px", cursor: "pointer", fontSize: 13, fontWeight: 800, opacity: busy || !title.trim() ? 0.6 : 1 }}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </div>
      ) : (
      <div style={{ cursor: "pointer" }} onClick={() => onOpen(post)}>
        <h3 style={{ fontSize: 19, fontWeight: 700, color: t.text, margin: "0 0 8px" }}>{post.title}</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>{post.flairs?.map((f) => <Flair key={f} flairKey={f} />)}</div>
        <ContentWarningGate warnings={post.warnings} t={t}>
          <p style={{ fontSize: 14, color: t.muted, margin: "0 0 10px", lineHeight: 1.5 }}>{post.body}</p>
          {post.links?.map((l, i) => <div key={i} style={{ fontSize: 14, color: t.link, textDecoration: "underline", marginBottom: 4 }}>{i + 1}. {l}</div>)}
          <MediaBlock post={post} t={t} />
        </ContentWarningGate>
      </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
        <Vote votes={post.votes} t={t} targetType="post" targetId={post.id} />
        <ActionPill icon={<MessageCircle size={15} />} label={post.commentCount ?? post.comments?.length ?? 0} t={t} onClick={() => onOpen(post)} />
        <ActionPill icon={followed ? <BellOff size={15} /> : <Bell size={15} />} label={followed ? "Following" : "Follow"} t={t} onClick={toggleFollowed} />
        <ActionPill icon={<Bookmark size={15} fill={saved ? "currentColor" : "none"} />} label={saved ? "Saved" : "Save"} t={t} onClick={toggleSave} />
        <ActionPill icon={<Share2 size={15} />} label="Share" t={t} onClick={() => copyPostLink(post.id)} />
      </div>
      {showMeta && (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12, padding: "11px 14px", border: `1px solid ${t.border}`, borderRadius: 10, color: t.text, fontSize: 13, fontWeight: 600 }}>
            <Repeat2 size={16} color={t.muted} /> Repost to more communities
            <ChevronRight size={16} color={t.muted} style={{ marginLeft: "auto" }} />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 10, color: t.muted, fontSize: 13 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Eye size={15} /> {post.views || "—"} views</span>
            <span style={{ color: t.link, fontWeight: 700, cursor: "pointer" }}>See More Insights</span>
          </div>
        </>
      )}
      {confirming && <ConfirmDialog t={t} title="Delete post?" message="This can't be undone." onConfirm={remove} onClose={() => setConfirming(false)} busy={busy} />}
    </div>
  );
}

// ----- Expandable rule -----
function Rule({ rule, index, t, last }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: last ? "none" : `1px solid ${t.border}` }}>
      <div onClick={() => setOpen(!open)} style={{ display: "flex", gap: 12, padding: "10px 0", cursor: "pointer", alignItems: "center" }}>
        <span style={{ color: t.muted, fontSize: 13 }}>{index + 1}</span>
        <span style={{ color: t.text, fontSize: 13, flex: 1, fontWeight: 600 }}>{rule.title}</span>
        {open ? <ChevronUp size={15} color={t.muted} /> : <ChevronDown size={15} color={t.muted} />}
      </div>
      {open && <p style={{ color: t.muted, fontSize: 12.5, lineHeight: 1.5, margin: "0 0 12px", paddingLeft: 24 }}>{rule.desc}</p>}
    </div>
  );
}

// ----- Community sidebar -----
function CommunitySidebar({ t }) {
  const navigate = useNavigate();
  const [stats, setStats] = useState<{ members: number; contributions: number } | null>(null);
  const [pinned, setPinned] = useState<any[]>([]);
  useEffect(() => { fetchCommunityStats().then(setStats).catch((e) => console.error("stats load failed", e)); }, []);
  useEffect(() => { fetchPinned().then(setPinned).catch((e) => console.error("pinned load failed", e)); }, []);
  // Resolve a bookmark to its target path, or null when nothing matches yet.
  const bookmarkPath = (b: any): string | null => {
    if (b.to) return b.to;
    const hit = pinned.find((p) => b.pinnedMatch.test(p.title));
    return hit ? `/post/${hit.id}` : null;
  };
  return (
    <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 14, padding: 16 }}>
      <h4 style={{ color: t.heading, fontSize: 15, fontWeight: 800, margin: "0 0 8px" }}>{community.short}</h4>
      <p style={{ color: t.muted, fontSize: 13, lineHeight: 1.5, margin: "0 0 14px" }}>{community.blurb}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: t.muted, fontSize: 13, marginBottom: 6 }}><BookOpen size={15} /> Created {community.created}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: t.muted, fontSize: 13, marginBottom: 14 }}><Globe size={15} /> Public</div>
      <button style={{ width: "100%", background: t.panel2, color: t.text, border: `1px solid ${t.border}`, borderRadius: 999, padding: "8px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <BookOpen size={15} /> Community Guide
      </button>
      <div style={{ display: "flex", gap: 24, marginBottom: 18 }}>
        <div><div style={{ color: t.text, fontWeight: 800, fontSize: 16 }}>{stats ? stats.members.toLocaleString() : "—"}</div><div style={{ color: t.muted, fontSize: 12 }}>Wakandans</div></div>
        <div><div style={{ color: t.text, fontWeight: 800, fontSize: 16 }}>{stats ? stats.contributions.toLocaleString() : "—"}</div><div style={{ color: t.muted, fontSize: 12 }}>Contributions</div></div>
      </div>
      <div style={{ color: t.muted, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, marginBottom: 10 }}>COMMUNITY BOOKMARKS</div>
      {community.bookmarks.map((b) => {
        const to = bookmarkPath(b);
        return (
          <a key={b.label} href={to ?? undefined}
            onClick={(e) => { e.preventDefault(); if (to) navigate(to); }}
            style={{ display: "block", background: t.panel2, borderRadius: 999, padding: "9px 0", textAlign: "center", color: t.text, fontSize: 13, fontWeight: 700, marginBottom: 8, cursor: to ? "pointer" : "default", textDecoration: "none" }}>
            {b.label}
          </a>
        );
      })}
      <div style={{ color: t.heading, fontSize: 12, fontWeight: 800, letterSpacing: 0.5, margin: "16px 0 4px" }}>BLACK PANTHER FANWORKS RULES</div>
      {community.rules.map((r, i) => <Rule key={i} rule={r} index={i} t={t} last={i === community.rules.length - 1} />)}
    </div>
  );
}

// Common fandom content warnings offered as one-tap chips in the composer.
const CONTENT_WARNING_PRESETS = ["Violence", "Character death", "Grief / loss", "Self-harm", "Abuse", "Blood / gore"];

// ----- Create-post modal -----
const POST_TYPES = [
  { key: "text", icon: FileText, label: "Text Post", desc: "Stories, questions, long-form — rich text." },
  { key: "link", icon: Link2, label: "Link", desc: "Share an external URL with a title." },
  { key: "image", icon: ImageIcon, label: "Image / Gallery", desc: "1 photo or up to 20 in a swipeable set." },
  { key: "video", icon: Video, label: "Video", desc: "Upload a clip; autoplays muted in feed." },
  { key: "poll", icon: BarChart3, label: "Poll", desc: "Up to 4 answer choices to vote on." },
  { key: "ask", icon: HelpCircle, label: "Ask / Question", desc: "Request advice or query experts." },
  { key: "ama", icon: Megaphone, label: "AMA", desc: "Open Q&A session." },
  { key: "til", icon: Lightbulb, label: "TIL", desc: "Share a surprising fact." },
  { key: "debate", icon: MessageSquare, label: "Discussion / Debate", desc: "Long-form topic or perspective thread." },
  { key: "vent", icon: MessageCircle, label: "Vent / Advice", desc: "Personal posts seeking peer support." },
];

function CreatePostModal({ t, onClose, onCreated }: any) {
  const [sel, setSel] = useState("text");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [flairs, setFlairs] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [pollOpts, setPollOpts] = useState(["", "", "", ""]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [customWarning, setCustomWarning] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleFlair = (k: string) => setFlairs((prev) => prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]);
  const toggleWarning = (w: string) => setWarnings((prev) => prev.includes(w) ? prev.filter((x) => x !== w) : [...prev, w]);
  const addCustomWarning = () => {
    const w = customWarning.trim();
    if (!w || w.length > 40) return;
    if (!warnings.includes(w)) setWarnings((prev) => [...prev, w]);
    setCustomWarning("");
  };
  const isMedia = sel === "image" || sel === "video";
  const setPollOpt = (i: number, v: string) => setPollOpts((p) => p.map((x, j) => (j === i ? v : x)));

  const submit = async () => {
    if (!title.trim()) { setError("Give your post a title."); return; }
    const cleanPoll = pollOpts.map((o) => o.trim()).filter(Boolean);
    if (sel === "poll" && cleanPoll.length < 2) { setError("A poll needs at least 2 answer choices."); return; }
    setBusy(true); setError(null);
    try {
      let media: string[] = [];
      if (files.length) media = await uploadMedia(files);
      await createPost({ type: sel, title: title.trim(), body: body.trim(), flairSlugs: flairs, media, pollOptions: sel === "poll" ? cleanPoll : undefined, contentWarnings: warnings });
      onCreated?.();
      onClose();
    } catch (e: any) {
      setError((e && e.message) || "Couldn't create the post.");
    } finally { setBusy(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 16, width: 560, maxWidth: "100%", maxHeight: "85vh", overflow: "auto", padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ color: t.text, margin: 0, fontSize: 18, fontWeight: 800 }}>Create a post</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: t.muted, cursor: "pointer" }}><X size={20} /></button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18 }}>
          {POST_TYPES.map((p) => {
            const Icon = p.icon; const active = sel === p.key;
            return (
              <button key={p.key} onClick={() => setSel(p.key)} style={{ textAlign: "left", background: active ? t.panel2 : "transparent", border: `1px solid ${active ? t.accent : t.border}`, borderRadius: 10, padding: 12, cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, color: active ? t.accent : t.text, fontWeight: 700, fontSize: 13 }}><Icon size={16} /> {p.label}</div>
                <div style={{ color: t.muted, fontSize: 12, marginTop: 4 }}>{p.desc}</div>
              </button>
            );
          })}
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" style={{ width: "100%", background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", color: t.text, marginBottom: 10, boxSizing: "border-box" }} />
        <div style={{ color: t.muted, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Flairs (tap to toggle)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {Object.keys(POST_FLAIRS).map((k) => {
            const on = flairs.includes(k);
            return <span key={k} onClick={() => toggleFlair(k)} style={{ cursor: "pointer", outline: on ? `2px solid ${t.accent}` : "none", borderRadius: 5, opacity: on ? 1 : 0.55 }}><Flair flairKey={k} plain /></span>;
          })}
        </div>
        <div style={{ color: t.muted, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Content warnings (optional — readers click through to see the post)</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
          {CONTENT_WARNING_PRESETS.concat(warnings.filter((w) => !CONTENT_WARNING_PRESETS.includes(w))).map((w) => {
            const on = warnings.includes(w);
            return <button key={w} onClick={() => toggleWarning(w)} style={{ ...relBtn(t, on), padding: "3px 10px", fontSize: 12 }}>{w}</button>;
          })}
          <input value={customWarning} onChange={(e) => setCustomWarning(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomWarning(); } }}
            placeholder="Custom…" style={{ background: t.bg, color: t.text, border: `1px solid ${t.border}`, borderRadius: 999, padding: "3px 10px", fontSize: 12, outline: "none", width: 90 }} />
        </div>
        {isMedia && (
          <div style={{ marginBottom: 12 }}>
            <input type="file" accept={sel === "video" ? "video/*" : "image/*"} multiple={sel === "image"}
              onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 20))}
              style={{ color: t.text, fontSize: 13 }} />
            {files.length > 0 && <div style={{ color: t.muted, fontSize: 12, marginTop: 4 }}>{files.length} file{files.length > 1 ? "s" : ""} selected</div>}
          </div>
        )}
        {sel === "poll" && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ color: t.muted, fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Answer choices (2–4)</div>
            {pollOpts.map((o, i) => (
              <input key={i} value={o} onChange={(e) => setPollOpt(i, e.target.value)} placeholder={`Option ${i + 1}${i < 2 ? "" : " (optional)"}`}
                style={{ width: "100%", background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "8px 12px", color: t.text, marginBottom: 6, boxSizing: "border-box" }} />
            ))}
          </div>
        )}
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Body text" rows={4} style={{ width: "100%", background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", color: t.text, boxSizing: "border-box", resize: "vertical" }} />
        {error && <div style={{ color: "#e0726b", fontSize: 13, marginTop: 8 }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{ background: "transparent", color: t.text, border: `1px solid ${t.border}`, borderRadius: 999, padding: "8px 18px", cursor: "pointer", fontWeight: 700 }}>Cancel</button>
          <button onClick={submit} disabled={busy} style={{ background: t.accent, color: t.accentText, border: "none", borderRadius: 999, padding: "8px 22px", cursor: "pointer", fontWeight: 800, opacity: busy ? 0.6 : 1 }}>{busy ? "Posting…" : "Post"}</button>
        </div>
      </div>
    </div>
  );
}

// ----- Chat drawer -----
function ChatDrawer({ t, target, onClose }) {
  const [myId, setMyId] = useState<string | null>(null);
  const [view, setView] = useState(target ? "thread" : "list");
  const [conversations, setConversations] = useState<UiConversation[]>([]);
  const [active, setActive] = useState<{ id: string; username: string } | null>(null);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [val, setVal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { getMyProfileId().then(setMyId); }, []);

  const openThread = async (info) => {
    setError(null); setLoading(true); setView("thread"); setMessages([]);
    try {
      const convId = info.convId || await getOrCreateConversation(info.profileId);
      setActive({ id: convId, username: info.username });
      setMessages(await fetchMessages(convId));
    } catch (e: any) {
      setError((e && e.message) || "Couldn't open this conversation.");
      setActive(null);
    } finally { setLoading(false); }
  };

  // On open: jump into the target thread, or load the conversation list.
  useEffect(() => {
    if (target) openThread({ profileId: target.profileId, username: target.username });
    else fetchConversations().then(setConversations).catch((e) => console.error("conversations load failed", e));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live updates for the active conversation.
  useEffect(() => {
    if (!active?.id) return;
    return subscribeToMessages(active.id, myId, (m) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
    });
  }, [active?.id, myId]);

  // Autoscroll to the newest message.
  useEffect(() => { scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight); }, [messages]);

  const send = async () => {
    const body = val.trim();
    if (!body || !active?.id) return;
    setVal("");
    try {
      const msg = await sendMessage(active.id, body);
      setMessages((prev) => (prev.some((x) => x.id === msg.id) ? prev : [...prev, msg]));
    } catch (e: any) {
      setError((e && e.message) || "Message failed — you may be blocked.");
      setVal(body);
    }
  };

  return (
    <div style={{ position: "fixed", right: 16, bottom: 16, width: 320, height: 420, background: t.panel, border: `1px solid ${t.border}`, borderRadius: 14, display: "flex", flexDirection: "column", zIndex: 40, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 12, borderBottom: `1px solid ${t.border}` }}>
        {view === "thread" && !target ? (
          <button onClick={() => { setView("list"); setActive(null); setError(null); }} style={{ background: "none", border: "none", color: t.muted, cursor: "pointer", display: "flex" }}><ArrowLeft size={18} /></button>
        ) : null}
        {view === "thread" && active ? <Avatar seed={active.username} size={28} t={t} /> : <MessageSquare size={18} color={t.muted} />}
        <span style={{ color: t.text, fontWeight: 700, fontSize: 14 }}>{view === "thread" && active ? active.username : "Messages"}</span>
        <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: t.muted, cursor: "pointer" }}><X size={18} /></button>
      </div>

      {view === "list" ? (
        <div style={{ flex: 1, overflow: "auto" }}>
          {conversations.length === 0 ? (
            <div style={{ color: t.muted, fontSize: 13, padding: 16, textAlign: "center" }}>No conversations yet. Open someone's profile and tap Chat.</div>
          ) : (
            conversations.map((c) => (
              <button key={c.id} onClick={() => openThread({ convId: c.id, username: c.otherUsername, profileId: c.otherProfileId })} style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "none", border: "none", borderBottom: `1px solid ${t.border}`, cursor: "pointer", textAlign: "left" }}>
                <Avatar seed={c.otherUsername} size={30} t={t} />
                <span style={{ color: t.text, fontSize: 14, fontWeight: 600 }}>{c.otherUsername}</span>
              </button>
            ))
          )}
        </div>
      ) : (
        <>
          <div ref={scrollRef} style={{ flex: 1, overflow: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
            {loading && <div style={{ color: t.muted, fontSize: 13 }}>Loading…</div>}
            {error && <div style={{ color: "#e0726b", fontSize: 13 }}>{error}</div>}
            {!loading && !error && messages.length === 0 && <div style={{ color: t.muted, fontSize: 13 }}>No messages yet — say hi.</div>}
            {messages.map((m) => (
              <div key={m.id} style={{ alignSelf: m.fromMe ? "flex-end" : "flex-start", maxWidth: "78%", background: m.fromMe ? t.accent : t.panel2, color: m.fromMe ? t.accentText : t.text, padding: "8px 12px", borderRadius: 14, fontSize: 13 }}>{m.body}</div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, padding: 10, borderTop: `1px solid ${t.border}` }}>
            <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Message..." disabled={!active} style={{ flex: 1, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 999, padding: "8px 12px", color: t.text, opacity: active ? 1 : 0.5 }} />
            <button onClick={send} disabled={!active} style={{ background: t.accent, border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: active ? "pointer" : "not-allowed", color: t.accentText, opacity: active ? 1 : 0.5 }}><Send size={16} /></button>
          </div>
        </>
      )}
    </div>
  );
}

// ----- Pages -----
// Shared feed/post layout: two columns on desktop & tablet, single column
// (sidebar stacks below) on phone. Desktop returns the original values.
function contentGrid(bp: "phone" | "tablet" | "desktop"): React.CSSProperties {
  const cols = bp === "phone" ? "1fr" : bp === "tablet" ? "1fr 300px" : "1fr 320px";
  return { display: "grid", gridTemplateColumns: cols, gap: 24, maxWidth: 1100, margin: "0 auto", padding: "0 16px" };
}

// "Continue Reading" shelf: recently viewed posts from local reading history.
// Renders nothing when tracking is off or history is empty.
function ContinueReading({ t, bp }: any) {
  const navigate = useNavigate();
  const [entries, setEntries] = useState<HistoryEntry[]>(() => getHistory());
  const [off, setOff] = useState(() => isTrackingOff());
  if (off || entries.length === 0) return null;
  const smallBtn = { background: "none", border: "none", color: t.muted, fontSize: 12, cursor: "pointer", padding: 0 } as const;
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: t.heading, fontSize: 14, fontWeight: 700, padding: "8px 0" }}>
        <BookOpen size={15} /> Continue Reading
        <span style={{ flex: 1 }} />
        <button style={smallBtn} onClick={() => { clearHistory(); setEntries([]); }}>Clear</button>
        <span style={{ color: t.muted, fontSize: 12 }}>·</span>
        <button style={smallBtn} onClick={() => { setTrackingOff(true); setOff(true); }} title="Stop tracking viewed posts on this device">Turn off</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: bp === "phone" ? "1fr" : "1fr 1fr 1fr", gap: 12, marginBottom: 8 }}>
        {entries.slice(0, 6).map((h) => (
          <div key={h.id} onClick={() => navigate(`/post/${h.id}`)} style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 12, padding: 14, cursor: "pointer" }}>
            <div style={{ color: t.text, fontWeight: 700, fontSize: 13, marginBottom: 10, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{h.title}</div>
            <div style={{ color: t.muted, fontSize: 12 }}>{h.author} · viewed {timeAgo(h.at)} ago</div>
          </div>
        ))}
      </div>
    </>
  );
}

function LandingPage({ t, onOpen, onAuthor, mutedUsers, posts, pinned, loading, sort, onSort, following, myUsername, onChanged }: any) {
  const bp = useBreakpoint();
  return (
    <div style={contentGrid(bp)}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 0" }}>
          <img src="/bpf-home.png" alt={community.name}
            style={{ width: 72, height: 72, borderRadius: "50%", border: `2px solid ${t.accent}`, objectFit: "cover", flexShrink: 0, display: "block" }} />
          <h1 style={{ color: t.heading, fontSize: bp === "phone" ? 24 : 34, fontWeight: 800, margin: 0, letterSpacing: 0.3 }}>{community.name}</h1>
        </div>
        {pinned.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: t.heading, fontSize: 14, fontWeight: 700, padding: "8px 0" }}><Pin size={15} /> Community highlights</div>
            <div style={{ display: "grid", gridTemplateColumns: bp === "phone" ? "1fr" : "1fr 1fr", gap: 12, marginBottom: 8 }}>
              {pinned.map((p) => (
                <div key={p.id} onClick={() => onOpen(p)} style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 12, padding: 14, cursor: "pointer" }}>
                  <div style={{ color: t.text, fontWeight: 700, fontSize: 14, marginBottom: 24 }}>{p.title}</div>
                  <div style={{ color: t.muted, fontSize: 12 }}>{p.votes} votes · {p.comments} comments</div>
                </div>
              ))}
            </div>
          </>
        )}
        <ContinueReading t={t} bp={bp} />
        <div style={{ display: "flex", gap: 8, padding: "8px 0", flexWrap: "wrap" }}>
          {(["new", "hot", "top"] as const).map((k) => (
            <button key={k} onClick={() => onSort(k)} style={relBtn(t, !following && sort === k)}>
              {k[0].toUpperCase() + k.slice(1)}
            </button>
          ))}
          <button onClick={() => onSort("following")} style={relBtn(t, following)}><Bell size={14} /> Following</button>
        </div>
        {loading ? (
          <div style={{ color: t.muted, fontSize: 14, padding: "24px 0" }}>Loading posts…</div>
        ) : posts.length === 0 ? (
          <div style={{ color: t.muted, fontSize: 14, padding: "24px 0" }}>{following ? "No posts in tags you follow yet. Open a tag and hit Follow." : "No posts yet. Be the first to post!"}</div>
        ) : (
          posts.map((p) => <PostCard key={p.id} post={p} t={t} onOpen={onOpen} onAuthor={onAuthor} muted={mutedUsers.includes(p.author)} showMeta myUsername={myUsername} onChanged={onChanged} />)
        )}
      </div>
      <div><CommunitySidebar t={t} /></div>
    </div>
  );
}

function modBtn(t: any) {
  return { display: "flex", alignItems: "center", gap: 4, background: t.panel2, color: t.text, border: `1px solid ${t.border}`, borderRadius: 999, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700 };
}

// ----- Moderator action bar (posts) -----
function ModBar({ post, t, onChanged, onRemoved }: any) {
  const [reflair, setReflair] = useState(false);
  const [sel, setSel] = useState<string[]>(post.flairs || []);
  const [busy, setBusy] = useState(false);
  const run = async (fn: any) => { setBusy(true); try { await fn(); } catch (e) { console.error("mod action failed", e); } finally { setBusy(false); } };
  const toggle = (k: string) => setSel((p) => p.includes(k) ? p.filter((x) => x !== k) : [...p, k]);
  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 10, padding: 10, margin: "12px 0", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 4, color: t.heading, fontSize: 12, fontWeight: 800 }}><Shield size={13} /> MOD</span>
      <button onClick={() => run(async () => { await modSetPinned(post.id, !post.pinned); onChanged?.(); })} disabled={busy} style={modBtn(t)}><Pin size={13} /> {post.pinned ? "Unpin" : "Pin"}</button>
      <button onClick={() => setReflair(!reflair)} style={modBtn(t)}>Re-flair</button>
      <button onClick={() => { if (window.confirm("Remove this post?")) run(async () => { await modRemovePost(post.id); onRemoved?.(); }); }} disabled={busy} style={{ ...modBtn(t), color: "#e0726b" }}>Remove</button>
      {reflair && (
        <div style={{ flexBasis: "100%", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 6 }}>
          {Object.keys(POST_FLAIRS).map((k) => { const on = sel.includes(k); return <span key={k} onClick={() => toggle(k)} style={{ cursor: "pointer", outline: on ? `2px solid ${t.accent}` : "none", borderRadius: 5, opacity: on ? 1 : 0.5 }}><Flair flairKey={k} plain /></span>; })}
          <button onClick={() => run(async () => { await modSetPostFlairs(post.id, sel); setReflair(false); onChanged?.(); })} disabled={busy} style={{ ...modBtn(t), background: t.accent, color: t.accentText }}>Save flairs</button>
        </div>
      )}
    </div>
  );
}

// Poll results + voting. One vote per member; clicking another option changes it.
function PollBlock({ post, t }: any) {
  const options: string[] = post.pollOptions || [];
  const [counts, setCounts] = useState<number[]>(() => new Array(options.length).fill(0));
  const [total, setTotal] = useState(0);
  const [myVote, setMyVote] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  const load = () => fetchPollResults(post.id, options.length)
    .then((r) => { setCounts(r.counts); setTotal(r.total); setMyVote(r.myVote); setLoaded(true); })
    .catch((e) => { console.error("poll load failed", e); setLoaded(true); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [post.id]);

  const vote = (i: number) => {
    if (myVote === i) return;
    const prev = myVote;
    setMyVote(i); // optimistic: move the count
    setCounts((c) => { const n = [...c]; if (prev !== null && prev < n.length) n[prev]--; n[i]++; return n; });
    setTotal((tot) => (prev === null ? tot + 1 : tot));
    castPollVote(post.id, i).then(load).catch((e) => { console.error("poll vote failed", e); load(); });
  };

  if (options.length === 0) return null;
  return (
    <div style={{ margin: "12px 0", display: "flex", flexDirection: "column", gap: 8 }}>
      {options.map((opt, i) => {
        const pct = total > 0 ? Math.round((counts[i] / total) * 100) : 0;
        const mine = myVote === i;
        return (
          <button key={i} onClick={() => vote(i)} disabled={!loaded}
            style={{ position: "relative", overflow: "hidden", textAlign: "left", background: t.panel2, border: `1px solid ${mine ? t.accent : t.border}`, borderRadius: 10, padding: "10px 14px", cursor: "pointer", color: t.text }}>
            <div style={{ position: "absolute", inset: 0, width: `${pct}%`, background: mine ? t.accent : t.border, opacity: mine ? 0.35 : 0.25, transition: "width .3s" }} />
            <div style={{ position: "relative", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 14, fontWeight: mine ? 800 : 600 }}>
              <span>{mine ? "● " : ""}{opt}</span>
              <span style={{ color: t.muted, fontSize: 13 }}>{pct}% · {counts[i]}</span>
            </div>
          </button>
        );
      })}
      <div style={{ color: t.muted, fontSize: 12 }}>{total} vote{total === 1 ? "" : "s"}{myVote !== null ? " · tap another option to change your vote" : " · tap an option to vote"}</div>
    </div>
  );
}

const COMMENT_BATCH = 25;

// Top-level comments render in batches with a "load more" button. A
// #comment-<id> permalink expands collapsed ancestors, force-includes its
// batch, and scrolls the target into view.
function CommentList({ comments, t, postId, onAdded, myUsername, onAuthor }: any) {
  const targetId = window.location.hash.startsWith("#comment-") ? window.location.hash.slice("#comment-".length) : null;
  // Path from a top-level comment to the target (indices of ancestors), or null.
  const findPath = (c: any, id: string): any[] | null => {
    if (c.id === id) return [c];
    for (const r of c.replies ?? []) { const p = findPath(r, id); if (p) return [c, ...p]; }
    return null;
  };
  const targetTopIdx = useMemo(() => {
    if (!targetId) return -1;
    for (let i = 0; i < comments.length; i++) {
      const path = findPath(comments[i], targetId);
      if (path) { path.forEach((n) => collapsedComments.delete(n.id)); return i; }
    }
    return -1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments, targetId]);
  const [shown, setShown] = useState(Math.max(COMMENT_BATCH, targetTopIdx + 1));
  useEffect(() => { if (targetTopIdx + 1 > shown) setShown(targetTopIdx + 1); }, [targetTopIdx]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!targetId) return;
    // After the batch renders, bring the linked comment into view.
    const el = document.getElementById(`comment-${targetId}`);
    if (el) el.scrollIntoView({ block: "center" });
  }, [targetId, targetTopIdx, comments]);
  const visible = comments.slice(0, shown);
  const remaining = comments.length - visible.length;
  return (
    <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 12, paddingTop: 8 }}>
      {visible.map((c: any) => <Comment key={c.id} c={c} t={t} postId={postId} onAdded={onAdded} myUsername={myUsername} onAuthor={onAuthor} />)}
      {remaining > 0 && (
        <button onClick={() => setShown(shown + COMMENT_BATCH)} style={{ ...relBtn(t), marginTop: 14, width: "100%", padding: "9px 0" }}>
          Load {Math.min(remaining, COMMENT_BATCH)} more {remaining === 1 ? "comment" : "comments"} ({remaining} hidden)
        </button>
      )}
    </div>
  );
}

function PostPage({ post, t, onBack, onAuthor, isMod, onCommentAdded, onRemoved, myUsername }: any) {
  const bp = useBreakpoint();
  const [saved, toggleSave] = useSaved("post", post.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const mine = !!myUsername && post.author === myUsername;
  const hoverHandlers = useUsernameHoverCard(post.author);

  const saveEdit = async () => {
    const tt = title.trim();
    if (!tt) return;
    setBusy(true);
    try { await updatePost(post.id, { title: tt, body: body.trim() }); setEditing(false); onCommentAdded?.(); }
    catch (e) { console.error("post edit failed", e); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    setBusy(true);
    try { await deletePost(post.id); onRemoved?.(); }
    catch (e) { console.error("post delete failed", e); setBusy(false); setConfirming(false); }
  };

  return (
    <div style={contentGrid(bp)}>
      <div style={{ paddingTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button onClick={onBack} style={{ background: t.panel2, border: "none", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t.text }}><ArrowLeft size={18} /></button>
          <Avatar seed={community.name} size={26} t={t} />
          <span style={{ color: t.heading, fontWeight: 700, fontSize: 13 }}>{community.name}</span>
          <span style={{ color: t.muted, fontSize: 12 }}>· {post.when}</span>
          {mine && (
            <div style={{ marginLeft: "auto", position: "relative" }}>
              <button onClick={() => setMenuOpen(!menuOpen)} aria-label="Post options" style={{ background: "none", border: "none", color: t.muted, cursor: "pointer", display: "flex", padding: 0 }}><MoreHorizontal size={18} /></button>
              {menuOpen && (
                <div style={{ position: "absolute", right: 0, top: 24, background: t.panel2, border: `1px solid ${t.border}`, borderRadius: 8, padding: 4, zIndex: 10, minWidth: 110 }}>
                  <button onClick={() => { setEditing(true); setMenuOpen(false); }} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: t.text, cursor: "pointer", fontSize: 13, padding: "7px 10px", borderRadius: 6 }}>Edit</button>
                  <button onClick={() => { setMenuOpen(false); setConfirming(true); }} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: "#e0726b", cursor: "pointer", fontSize: 13, padding: "7px 10px", borderRadius: 6 }}>Delete</button>
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ color: t.muted, fontSize: 12, marginBottom: 6, cursor: "pointer" }} onClick={() => onAuthor(post.author)} {...hoverHandlers}>{post.author}</div>
        {editing ? (
          <div style={{ marginBottom: 14 }}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title"
              style={{ width: "100%", background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", color: t.text, marginBottom: 8, boxSizing: "border-box", fontSize: 20, fontWeight: 800 }} />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Body text" rows={6}
              style={{ width: "100%", background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", color: t.text, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", fontSize: 15 }} />
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
              <button onClick={() => { setTitle(post.title); setBody(post.body); setEditing(false); }} style={{ background: "transparent", color: t.muted, border: `1px solid ${t.border}`, borderRadius: 999, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Cancel</button>
              <button onClick={saveEdit} disabled={busy || !title.trim()} style={{ background: t.accent, color: t.accentText, border: "none", borderRadius: 999, padding: "6px 16px", cursor: "pointer", fontSize: 13, fontWeight: 800, opacity: busy || !title.trim() ? 0.6 : 1 }}>{busy ? "Saving…" : "Save"}</button>
            </div>
          </div>
        ) : (
        <>
        <h1 style={{ color: t.text, fontSize: 26, fontWeight: 800, margin: "0 0 12px" }}>{post.title}</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>{post.flairs?.map((f) => <Flair key={f} flairKey={f} />)}</div>
        <ContentWarningGate warnings={post.warnings} t={t}>
          {post.body && <p style={{ color: t.text, fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{post.body}</p>}
          {post.type === "poll" && <PollBlock post={post} t={t} />}
          {post.links?.map((l: string, i: number) => <div key={i} style={{ fontSize: 14, color: t.link, textDecoration: "underline", marginBottom: 4 }}>{i + 1}. {l}</div>)}
          <MediaBlock post={post} t={t} />
        </ContentWarningGate>
        </>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0" }}>
          <Vote votes={post.votes} t={t} targetType="post" targetId={post.id} />
          <ActionPill icon={<MessageCircle size={15} />} label={post.commentCount ?? post.comments?.length ?? 0} t={t} />
          <ActionPill icon={<Bookmark size={15} fill={saved ? "currentColor" : "none"} />} label={saved ? "Saved" : "Save"} t={t} onClick={toggleSave} />
          <ActionPill icon={<Share2 size={15} />} label="Share" t={t} onClick={() => copyPostLink(post.id)} />
        </div>
        <CollectionTagger t={t} postId={post.id} />
        {isMod && <ModBar post={post} t={t} onChanged={onCommentAdded} onRemoved={onRemoved} />}
        <CommentComposer t={t} postId={post.id} onAdded={onCommentAdded} placeholder="Join the conversation…" />
        <CommentList comments={post.comments ?? []} t={t} postId={post.id} onAdded={onCommentAdded} myUsername={myUsername} onAuthor={onAuthor} />
      </div>
      <div><CommunitySidebar t={t} /></div>
      {confirming && <ConfirmDialog t={t} title="Delete post?" message="This can't be undone." onConfirm={remove} onClose={() => setConfirming(false)} busy={busy} />}
    </div>
  );
}

// ----- Profile edit panel (own profile: identity, links, content prefs, muted members) -----
function ProfileEditPanel({ t, profile, onClose, onSaved, onHiddenChange }: any) {
  const [username, setUsername] = useState(profile.username);
  const [display, setDisplay] = useState(profile.display);
  const [banner, setBanner] = useState(profile.banner);
  const [ao3, setAo3] = useState(profile.ao3 || "");
  const [kofi, setKofi] = useState(profile.kofi || "");
  const [blur, setBlur] = useState(profile.blurMedia);
  const [spoilerFree, setSpoilerFree] = useState(!!profile.spoilerFree);
  const [spoilerTags, setSpoilerTags] = useState<string[]>(profile.spoilerTags || []);
  const toggleSpoilerTag = (k: string) => setSpoilerTags((p) => p.includes(k) ? p.filter((x) => x !== k) : [...p, k]);
  const [mutedTagsEdit, setMutedTagsEdit] = useState<string[]>(profile.mutedTags || []);
  const toggleMutedTag = (k: string) => setMutedTagsEdit((p) => p.includes(k) ? p.filter((x) => x !== k) : [...p, k]);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [mutes, setMutes] = useState<{ id: string; username: string; type: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => { fetchMyMutes().then(setMutes).catch((e) => console.error("mutes load failed", e)); }, []);

  const unmute = (m: any) => {
    setMutes((prev) => prev.filter((x) => !(x.id === m.id && x.type === m.type))); // optimistic
    setRelationship(m.id, m.type, false)
      .then(() => onHiddenChange?.())
      .catch((e) => { console.error("unmute failed", e); setMutes((prev) => [...prev, m]); });
  };

  const save = async () => {
    setErr("");
    if (!USERNAME_RE.test(username)) { setErr("Username must be 3-20 characters: letters, numbers, underscore."); return; }
    for (const u of [ao3, kofi]) if (u && !/^https:\/\//i.test(u)) { setErr("Links must start with https://"); return; }
    setBusy(true);
    try {
      const patch: any = {};
      if (username !== profile.username) patch.username = username;
      if (display !== profile.display) patch.display_name = display;
      if (banner !== profile.banner) patch.banner = banner;
      if ((ao3 || null) !== profile.ao3) patch.ao3_url = ao3 || null;
      if ((kofi || null) !== profile.kofi) patch.kofi_url = kofi || null;
      if (blur !== profile.blurMedia) patch.blur_media = blur;
      if (spoilerFree !== !!profile.spoilerFree) patch.spoiler_free = spoilerFree;
      if (JSON.stringify(spoilerTags) !== JSON.stringify(profile.spoilerTags || [])) patch.spoiler_tags = spoilerTags;
      if (JSON.stringify(mutedTagsEdit) !== JSON.stringify(profile.mutedTags || [])) patch.muted_tags = mutedTagsEdit;
      if (avatarFile) patch.avatar_url = await uploadAvatar(avatarFile);
      if (Object.keys(patch).length) await updateMyProfile(patch);
      onSaved(patch.username); // navigates if username changed, else reloads
    } catch (e: any) {
      setErr(/duplicate|unique/i.test(e?.message || "") ? "That username is taken." : e?.message || "Save failed.");
      setBusy(false);
    }
  };

  const field = { width: "100%", boxSizing: "border-box" as const, background: t.bg, color: t.text, border: `1px solid ${t.border}`, borderRadius: 8, padding: "8px 10px", fontSize: 14, outline: "none" };
  const label = { color: t.muted, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, margin: "12px 0 4px", display: "block" };
  return (
    <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h3 style={{ color: t.heading, margin: 0, fontSize: 15, fontWeight: 800 }}>Edit profile</h3>
        <button onClick={onClose} disabled={busy} style={{ background: "none", border: "none", color: t.muted, cursor: "pointer", padding: 2 }}><X size={16} /></button>
      </div>
      <label style={label}>USERNAME</label>
      <input style={field} value={username} onChange={(e) => setUsername(e.target.value)} />
      <label style={label}>DISPLAY NAME</label>
      <input style={field} value={display} onChange={(e) => setDisplay(e.target.value)} />
      <label style={label}>BIO</label>
      <textarea style={{ ...field, resize: "vertical", minHeight: 56 }} value={banner} onChange={(e) => setBanner(e.target.value)} />
      <label style={label}>AVATAR</label>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar seed={profile.username} url={avatarFile ? URL.createObjectURL(avatarFile) : profile.avatarUrl} size={44} t={t} />
        <input type="file" accept="image/*" onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)} style={{ color: t.muted, fontSize: 13 }} />
      </div>
      <label style={label}>AO3 LINK</label>
      <input style={field} placeholder="https://archiveofourown.org/users/…" value={ao3} onChange={(e) => setAo3(e.target.value)} />
      <label style={label}>KO-FI LINK</label>
      <input style={field} placeholder="https://ko-fi.com/…" value={kofi} onChange={(e) => setKofi(e.target.value)} />
      <label style={label}>CONTENT</label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, color: t.text, fontSize: 14, cursor: "pointer" }}>
        <input type="checkbox" checked={blur} onChange={(e) => setBlur(e.target.checked)} /> Blur NSFW / spoiler media
      </label>
      <label style={label}>SPOILER-FREE MODE</label>
      <label style={{ display: "flex", alignItems: "center", gap: 8, color: t.text, fontSize: 14, cursor: "pointer" }}>
        <input type="checkbox" checked={spoilerFree} onChange={(e) => setSpoilerFree(e.target.checked)} /> Hide posts with my spoiler tags
      </label>
      <div style={{ color: t.muted, fontSize: 12, margin: "8px 0 6px" }}>Tags to hide{spoilerFree ? "" : " (mode off)"}:</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, opacity: spoilerFree ? 1 : 0.5 }}>
        {Object.keys(POST_FLAIRS).map((k) => { const on = spoilerTags.includes(k); return <span key={k} onClick={() => toggleSpoilerTag(k)} style={{ cursor: "pointer", outline: on ? `2px solid ${t.accent}` : "none", borderRadius: 5, opacity: on ? 1 : 0.55 }}><Flair flairKey={k} plain /></span>; })}
      </div>
      <label style={label}>MUTED TAGS</label>
      <div style={{ color: t.muted, fontSize: 12, margin: "0 0 6px" }}>Posts with these tags never appear in your feeds (a "Show anyway" stays available):</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {Object.keys(POST_FLAIRS).map((k) => { const on = mutedTagsEdit.includes(k); return <span key={k} onClick={() => toggleMutedTag(k)} style={{ cursor: "pointer", outline: on ? `2px solid ${t.accent}` : "none", borderRadius: 5, opacity: on ? 1 : 0.55 }}><Flair flairKey={k} plain /></span>; })}
      </div>
      <label style={label}>MUTED / BLOCKED</label>
      {mutes.length === 0 ? (
        <div style={{ color: t.muted, fontSize: 13 }}>Nobody muted or blocked.</div>
      ) : (
        mutes.map((m) => (
          <div key={`${m.id}-${m.type}`} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0" }}>
            <span style={{ color: t.text, fontSize: 13 }}>{m.username} <span style={{ color: t.muted, fontSize: 11 }}>({m.type})</span></span>
            <button onClick={() => unmute(m)} style={{ ...relBtn(t), padding: "4px 10px", fontSize: 12 }}>Remove</button>
          </div>
        ))
      )}
      {err && <div style={{ color: "#e0726b", fontSize: 13, marginTop: 10 }}>{err}</div>}
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 14 }}>
        <button onClick={onClose} disabled={busy} style={{ background: "transparent", color: t.text, border: `1px solid ${t.border}`, borderRadius: 999, padding: "8px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>Cancel</button>
        <button onClick={save} disabled={busy} style={{ ...relBtn(t, true), opacity: busy ? 0.6 : 1 }}>{busy ? "Saving…" : "Save"}</button>
      </div>
    </div>
  );
}

// Public reading lists on a profile: chips linking to each /list/:id.
function MemberCollections({ t, username }: any) {
  const navigate = useNavigate();
  const [lists, setLists] = useState<UiCollection[]>([]);
  useEffect(() => {
    let active = true;
    fetchCollectionsByUser(username).then((ls) => { if (active) setLists(ls); }).catch((e) => console.error("collections load failed", e));
    return () => { active = false; };
  }, [username]);
  if (lists.length === 0) return null;
  return (
    <div style={{ margin: "4px 0 12px" }}>
      <div style={{ color: t.muted, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, marginBottom: 8 }}>READING LISTS</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {lists.map((l) => (
          <button key={l.id} onClick={() => navigate(`/list/${l.id}`)} style={{ ...relBtn(t), padding: "5px 12px", fontSize: 12 }}>
            {l.name} <span style={{ opacity: 0.7 }}>· {l.count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MemberPage({ t, profile, loading, isMe, isMod, onOpen, onChat, onRelationshipChange, onProfileChanged, onSavedProfile, myUsername }: any) {
  const [rel, setRel] = useState({ follow: false, mute: false, block: false });
  const [followerDelta, setFollowerDelta] = useState(0);
  const [editing, setEditing] = useState(false);

  // Load the real relationship state whenever we view a different profile.
  useEffect(() => {
    if (!profile?.id) return;
    let active = true;
    setFollowerDelta(0);
    getRelationshipState(profile.id).then((r) => { if (active) setRel(r); });
    return () => { active = false; };
  }, [profile?.id]);

  if (loading || !profile) {
    return <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 16px", color: t.muted, fontSize: 14 }}>{loading ? "Loading profile…" : "Profile not found."}</div>;
  }

  const toggle = (type) => {
    const key = type === "follow" ? "follow" : type === "mute" ? "mute" : "block";
    const next = !rel[key];
    setRel({ ...rel, [key]: next });            // optimistic
    if (type === "follow") setFollowerDelta((d) => d + (next ? 1 : -1));
    setRelationship(profile.id, type, next)
      .then(() => { if (type !== "follow") onRelationshipChange?.(); }) // refresh feed hides on mute/block
      .catch((e) => {                            // revert on failure
        console.error("relationship update failed", e);
        setRel((r) => ({ ...r, [key]: !next }));
        if (type === "follow") setFollowerDelta((d) => d - (next ? 1 : -1));
      });
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 24, maxWidth: 1180, margin: "0 auto", padding: "0 16px" }}>
      <div style={{ paddingTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
          <Avatar seed={profile.username} url={profile.avatarUrl} size={64} t={t} />
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ color: t.text, fontSize: 26, fontWeight: 800, margin: 0 }}>{profile.display}</h1>
              {profile.isMod && <Shield size={20} color="#ff4500" />}
              {profile.flair && <span style={{ background: "#6b3f1d", color: "#ffd9a8", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6 }}>{profile.flair}</span>}
            </div>
            <div style={{ color: t.muted, fontSize: 14 }}>{profile.username}</div>
          </div>
        </div>
        <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 12, padding: "14px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <Eye size={18} color={t.muted} /><span style={{ color: t.text, fontWeight: 700, fontSize: 14 }}>Showing all content</span>
        </div>
        {isMe ? (
          <div style={{ marginBottom: 12 }}>
            {editing ? (
              <ProfileEditPanel t={t} profile={profile} onClose={() => setEditing(false)}
                onSaved={(newUsername: string | undefined) => { setEditing(false); onSavedProfile?.(newUsername); }}
                onHiddenChange={onRelationshipChange} />
            ) : (
              <button onClick={() => setEditing(true)} style={relBtn(t)}><Pencil size={14} /> Edit profile</button>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
              <button onClick={() => toggle("follow")} style={relBtn(t, rel.follow)}>{rel.follow ? <UserMinus size={15} /> : <UserPlus size={15} />}{rel.follow ? "Following" : "Follow"}</button>
              <button onClick={() => onChat(profile)} disabled={rel.block} style={{ ...relBtn(t), opacity: rel.block ? 0.5 : 1, cursor: rel.block ? "not-allowed" : "pointer" }}><MessageSquare size={15} /> Chat</button>
              <button onClick={() => toggle("mute")} style={relBtn(t, rel.mute)}><VolumeX size={15} /> {rel.mute ? "Muted" : "Mute"}</button>
              <button onClick={() => toggle("block")} style={relBtn(t, rel.block)}><Flag size={15} /> {rel.block ? "Blocked" : "Block"}</button>
            </div>
            {(rel.mute || rel.block) && (
              <div style={{ color: t.muted, fontSize: 12, fontStyle: "italic", marginBottom: 12 }}>
                {rel.block ? "Blocked: this user can't message you and their content is hidden everywhere." : "Muted: you won't see this user's posts in the feed."}
              </div>
            )}
          </>
        )}
        {isMod && (
          <div style={{ border: `1px solid ${t.border}`, borderRadius: 10, padding: 10, marginBottom: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: t.heading, fontSize: 12, fontWeight: 800 }}><Shield size={13} /> MOD</span>
            <span style={{ color: t.muted, fontSize: 12 }}>Member flair:</span>
            <select defaultValue="" onChange={(e) => { modAssignMemberFlair(profile.id, e.target.value || null).then(() => onProfileChanged?.()).catch((err) => console.error("assign flair failed", err)); }}
              style={{ background: t.bg, color: t.text, border: `1px solid ${t.border}`, borderRadius: 8, padding: "5px 8px", fontSize: 13 }}>
              <option value="">— assign flair —</option>
              {MEMBER_FLAIRS.map((f) => <option key={f.slug} value={f.slug}>{f.label}</option>)}
            </select>
          </div>
        )}
        <MemberCollections t={t} username={profile.username} />
        <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 8 }}>
          {profile.posts.length === 0
            ? <div style={{ color: t.muted, fontSize: 13, padding: "20px 0" }}>No posts on this profile yet.</div>
            : profile.posts.map((p) => <PostCard key={p.id} post={p} t={t} onOpen={onOpen} onAuthor={() => {}} muted={false} showMeta={false} myUsername={myUsername} onChanged={onProfileChanged} />)}
        </div>
      </div>
      <div>
        <div style={{ height: 110, borderRadius: "14px 14px 0 0", background: "linear-gradient(135deg,#3a3a3a,#1a1a1a)" }} />
        <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderTop: "none", borderRadius: "0 0 14px 14px", padding: 16 }}>
          <div style={{ color: t.text, fontSize: 14, marginBottom: 14 }}>{profile.banner || profile.display}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <h3 style={{ color: t.text, margin: 0, fontSize: 18, fontWeight: 800 }}>{profile.display}</h3>{profile.isMod && <Shield size={16} color="#ff4500" />}
          </div>
          <button style={{ display: "flex", alignItems: "center", gap: 6, background: t.panel2, color: t.text, border: "none", borderRadius: 999, padding: "6px 14px", cursor: "pointer", fontWeight: 700, fontSize: 13, marginBottom: 14 }}><Share2 size={14} /> Share</button>
          {/* Creator links: validated https-only at save; re-checked here before rendering as hrefs. */}
          {[["AO3", profile.ao3], ["Ko-fi", profile.kofi]].filter(([, u]) => u && /^https:\/\//i.test(u)).map(([name, u]) => (
            <a key={name} href={u} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, color: t.accent, fontSize: 13, fontWeight: 700, textDecoration: "none", marginBottom: 8 }}>
              <ExternalLink size={13} /> {name}
            </a>
          ))}
          <div style={{ color: t.text, fontWeight: 800, fontSize: 16 }}>{profile.followers + followerDelta} followers</div>
          {profile.flair && <div style={{ color: t.muted, fontSize: 13, marginBottom: 14 }}>{profile.flair}</div>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14, marginTop: 14 }}>
            {[["Karma", profile.karma], ["Contributions", profile.contributions], ["Account age", profile.age], ["Gold earned", profile.gold]].map(([k, v]) => (
              <div key={k}><div style={{ color: t.text, fontWeight: 800, fontSize: 16 }}>{v}</div><div style={{ color: t.muted, fontSize: 12 }}>{k}</div></div>
            ))}
          </div>
          <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 14 }}>
            <div style={{ color: t.muted, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, marginBottom: 10 }}>ACHIEVEMENTS</div>
            <div style={{ color: t.text, fontSize: 13 }}>{profile.achievements}</div>
            <div style={{ color: t.muted, fontSize: 12, marginTop: 8 }}>{profile.unlocked} unlocked</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function relBtn(t, active = false) {
  return { display: "flex", alignItems: "center", gap: 6, background: active ? t.accent : t.panel2, color: active ? t.accentText : t.text, border: `1px solid ${active ? t.accent : t.border}`, borderRadius: 999, padding: "8px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13 };
}

// ----- App shell (layout for the routed pages) -----
function AppLayout() {
  const [showCreate, setShowCreate] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatTarget, setChatTarget] = useState<{ profileId: string; username: string } | null>(null);
  const [mutedUsers, setMutedUsers] = useState<string[]>([]); // usernames hidden from feed (muted/blocked)
  const [searchQ, setSearchQ] = useState("");
  const { user, signOut } = useAuth();

  const [unread, setUnread] = useState(0);
  const refreshUnread = () => { fetchUnreadCount().then(setUnread).catch(() => {}); };
  // Badge freshness: on load + a slow poll. Realtime subscription can replace this later.
  useEffect(() => {
    if (!user?.id) return;
    refreshUnread();
    const iv = setInterval(refreshUnread, 60_000);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const [feed, setFeed] = useState<UiPost[]>([]);
  const [pinned, setPinned] = useState<UiPinned[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [sort, setSort] = useState<FeedSort>("new");
  const [following, setFollowing] = useState(false);
  const [followedTags, setFollowedTags] = useState<string[]>([]);
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [myIsMod, setMyIsMod] = useState(false);
  const [blurMedia, setBlurMedia] = useState(true);
  const [spoilerFree, setSpoilerFree] = useState(false);
  const [spoilerTags, setSpoilerTags] = useState<string[]>([]);
  const [mutedTags, setMutedTags] = useState<string[]>([]);

  const navigate = useNavigate();
  const location = useLocation();
  const { mode, toggleTheme } = useTheme();
  const bp = useBreakpoint();
  const phone = bp === "phone";
  const t = (location.pathname.startsWith("/user") ? neutralPair : goldPair)[mode];

  // Resolve the current member's identity (username, mod flag, content prefs) for the shell.
  const refreshIdentity = () => fetchMyIdentity().then((id) => {
    if (id) { setMyUsername(id.username); setMyIsMod(id.isMod); setBlurMedia(id.blurMedia); setSpoilerFree(id.spoilerFree); setSpoilerTags(id.spoilerTags); setMutedTags(id.mutedTags); }
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (user?.id) refreshIdentity(); }, [user?.id]);

  // Load the feed + pinned highlights. `foll` true = only tags you follow.
  const loadFeed = async (s: FeedSort = sort, foll: boolean = following) => {
    try {
      const [f, p] = await Promise.all([foll ? fetchFollowedFeed() : fetchCommunityFeed(s), fetchPinned()]);
      setFeed(f); setPinned(p);
    } catch (e) { console.error("feed load failed", e); }
    finally { setFeedLoading(false); }
  };
  // Tabs: new/hot/top sort the community feed; "following" swaps to the followed feed.
  const changeSort = (s: FeedSort | "following") => {
    setFeedLoading(true);
    if (s === "following") { setFollowing(true); loadFeed(sort, true); }
    else { setFollowing(false); setSort(s); loadFeed(s, false); }
  };
  const refreshFollowedTags = () => fetchMyFollowedTags().then(setFollowedTags).catch((e) => console.error("followed tags load failed", e));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadFeed(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (user?.id) refreshFollowedTags(); }, [user?.id]);

  // The set of usernames hidden from the feed (people you've muted or blocked).
  const refreshHidden = () => {
    fetchHiddenUsernames().then(setMutedUsers).catch((e) => console.error("hidden load failed", e));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (user?.id) refreshHidden(); }, [user?.id]);

  const goPost = (post: any) => navigate(`/post/${post.id}`);
  const goUser = (username: any) => { const u = typeof username === "string" ? username : myUsername; if (u) navigate(`/user/${u}`); };
  const goHome = () => navigate("/");
  const openChatWith = (p: any) => { setChatTarget({ profileId: p.id, username: p.username }); setShowChat(true); };

  // Mute/unmute a tag account-wide: optimistic local flip, then persist.
  const toggleMuteTag = (slug: string) => {
    const next = mutedTags.includes(slug) ? mutedTags.filter((m) => m !== slug) : [...mutedTags, slug];
    setMutedTags(next);
    updateMyProfile({ muted_tags: next }).catch((e) => { console.error("mute tag failed", e); setMutedTags(mutedTags); });
  };

  // Shared with the routed pages via <Outlet context>.
  const ctx = { t, feed, pinned, feedLoading, sort, changeSort, following, followedTags, refreshFollowedTags, mutedUsers, myUsername, myIsMod, goPost, goUser, goHome, openChatWith, refreshHidden, refreshIdentity, refreshUnread, loadFeed, mutedTags, toggleMuteTag };

  return (
    <PrefsContext.Provider value={{ blurMedia, spoilerFree, spoilerTags, mutedTags }}>
    <div style={{ background: t.bg, minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif", color: t.text }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: `1px solid ${t.border}`, position: "sticky", top: 0, background: t.bg, zIndex: 30, flexWrap: phone ? "wrap" : "nowrap" }}>
        <button onClick={goHome} style={{ background: "none", border: "none", color: t.heading, fontWeight: 800, fontSize: phone ? 15 : 17, cursor: "pointer", padding: phone ? 0 : undefined }}>{community.name}</button>
        <div style={{ flex: phone ? "1 1 100%" : 1, display: "flex", alignItems: "center", gap: 8, background: t.panel, border: `1px solid ${t.border}`, borderRadius: 999, padding: "7px 14px", maxWidth: phone ? "100%" : 420, ...(phone ? { order: 3 } : null) }}>
          <Search size={16} color={t.muted} /><input placeholder="Search" value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && searchQ.trim()) navigate(`/search?q=${encodeURIComponent(searchQ.trim())}`); }}
            style={{ background: "none", border: "none", outline: "none", color: t.text, flex: 1, minWidth: 0 }} />

        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setShowCreate(true)} aria-label="Create Post" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: t.panel2, color: t.text, border: `1px solid ${t.border}`, borderRadius: 999, padding: phone ? 0 : "8px 16px", width: phone ? 44 : undefined, height: phone ? 44 : undefined, cursor: "pointer", fontWeight: 700, fontSize: 13 }}><Plus size={16} />{phone ? null : " Create Post"}</button>
          <button onClick={() => navigate("/inbox")} title="Notifications" aria-label="Notifications" style={{ position: "relative", background: t.panel2, border: `1px solid ${t.border}`, borderRadius: "50%", width: phone ? 44 : 38, height: phone ? 44 : 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t.text }}>
            <Bell size={18} />
            {unread > 0 && <span style={{ position: "absolute", top: -3, right: -3, background: "#e0726b", color: "#1a0b0b", fontSize: 10, fontWeight: 800, borderRadius: 999, minWidth: 16, height: 16, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>{unread > 9 ? "9+" : unread}</span>}
          </button>
          <button onClick={() => navigate("/saved")} title="Saved" aria-label="Saved items" style={{ background: t.panel2, border: `1px solid ${t.border}`, borderRadius: "50%", width: phone ? 44 : 38, height: phone ? 44 : 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t.text }}><Bookmark size={18} /></button>
          <button onClick={() => { setChatTarget(null); setShowChat(true); }} aria-label="Messages" style={{ background: t.panel2, border: `1px solid ${t.border}`, borderRadius: "50%", width: phone ? 44 : 38, height: phone ? 44 : 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t.text }}><MessageSquare size={18} /></button>
          <button onClick={toggleTheme} title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"} aria-label={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"} style={{ background: t.panel2, border: `1px solid ${t.border}`, borderRadius: "50%", width: phone ? 44 : 38, height: phone ? 44 : 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t.text }}>
            {mode === "dark" ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <button onClick={() => goUser(myUsername)} title={myUsername || user?.email || ""} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><Avatar seed={myUsername || user?.email || "me"} size={34} t={t} /></button>
          <button onClick={signOut} title="Sign out" aria-label="Sign out" style={{ background: t.panel2, border: `1px solid ${t.border}`, borderRadius: "50%", width: phone ? 44 : 38, height: phone ? 44 : 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t.text }}><LogOut size={18} /></button>
        </div>
      </div>

      <div style={{ padding: "16px 0 70px" }}>
        <Outlet context={ctx} />
      </div>

      {showCreate && <CreatePostModal t={t} onClose={() => setShowCreate(false)} onCreated={loadFeed} />}
      {showChat && <ChatDrawer t={t} target={chatTarget} onClose={() => setShowChat(false)} />}
      <UserHoverCardHost t={t} myUsername={myUsername} />
    </div>
    </PrefsContext.Provider>
  );
}

// ----- Routed pages (read URL params, load their own data) -----
function LandingRoute() {
  const c: any = useOutletContext();
  useEffect(() => { setPageMeta({ title: `${community.name} — Wakanda-first fan community`, description: clip(community.blurb), url: "/", type: "website" }); }, []);
  return <LandingPage t={c.t} posts={c.feed} pinned={c.pinned} loading={c.feedLoading} sort={c.sort} onSort={c.changeSort} following={c.following} mutedUsers={c.mutedUsers} onOpen={c.goPost} onAuthor={c.goUser} myUsername={c.myUsername} onChanged={c.loadFeed} />;
}

// Shared list layout for tag-filter and search-result pages.
function PostListPage({ t, title, sub, action, posts, loading, mutedUsers, onOpen, onAuthor, myUsername, emptyText }: any) {
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 16px" }}>
      <div style={{ padding: "20px 0 4px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div>
          <h1 style={{ color: t.heading, fontSize: 24, fontWeight: 800, margin: 0 }}>{title}</h1>
          {sub && <div style={{ color: t.muted, fontSize: 13, marginTop: 4 }}>{sub}</div>}
        </div>
        {action}
      </div>
      {loading ? (
        <div style={{ color: t.muted, fontSize: 14, padding: "24px 0" }}>Loading posts…</div>
      ) : posts.length === 0 ? (
        <div style={{ color: t.muted, fontSize: 14, padding: "24px 0" }}>{emptyText}</div>
      ) : (
        posts.map((p: UiPost) => <PostCard key={p.id} post={p} t={t} onOpen={onOpen} onAuthor={onAuthor} muted={mutedUsers.includes(p.author)} showMeta myUsername={myUsername} />)
      )}
    </div>
  );
}

function TagRoute() {
  const c: any = useOutletContext();
  const t = c.t;
  const { slug } = useParams();
  const [posts, setPosts] = useState<UiPost[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    window.scrollTo(0, 0); setLoading(true);
    fetchTagFeed(slug as string).then(setPosts).catch((e) => console.error("tag feed failed", e)).finally(() => setLoading(false));
  }, [slug]);
  const label = POST_FLAIRS[slug as string]?.label ?? slug;
  useEffect(() => { setPageMeta({ title: `${label} — ${community.name}`, description: `${label} posts on ${community.name}.`, url: `/t/${slug}`, type: "website" }); }, [slug, label]);
  const followed = c.followedTags?.includes(slug);
  const toggleFollow = () => {
    toggleTagFollow(slug as string, !followed).then(() => c.refreshFollowedTags?.()).catch((e) => console.error("follow toggle failed", e));
  };
  const muted = c.mutedTags?.includes(slug);
  const header = (
    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={toggleFollow} style={relBtn(t, followed)}>
        {followed ? <BellOff size={15} /> : <Bell size={15} />} {followed ? "Following" : "Follow"}
      </button>
      <button onClick={() => c.toggleMuteTag?.(slug)} title={muted ? "Show this tag in your feeds again" : "Hide posts with this tag from your feeds"} style={relBtn(t, muted)}>
        <VolumeX size={15} /> {muted ? "Muted" : "Mute"}
      </button>
    </div>
  );
  return <PostListPage t={t} title={label} sub={`Posts tagged ${label}`} action={header} posts={posts} loading={loading} mutedUsers={c.mutedUsers} onOpen={c.goPost} onAuthor={c.goUser} myUsername={c.myUsername} emptyText={`No ${label} posts yet.`} />;
}

function CollectionRoute() {
  const c: any = useOutletContext();
  const t = c.t;
  const { id } = useParams();
  const navigate = useNavigate();
  const [meta, setMeta] = useState<UiCollection | null>(null);
  const [posts, setPosts] = useState<UiPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [followed, setFollowed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const load = () => {
    setLoading(true);
    Promise.all([fetchCollection(id as string), fetchCollectionPosts(id as string), getMyCollectionFollow(id as string)])
      .then(([m, p, f]) => { setMeta(m); setPosts(p); setFollowed(f); })
      .catch((e) => console.error("collection load failed", e))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { window.scrollTo(0, 0); load(); }, [id]);
  useEffect(() => {
    if (meta) setPageMeta({ title: `${meta.name} — ${community.name}`, description: meta.description || `A reading list by ${meta.owner} on ${community.name}.`, url: `/list/${meta.id}`, type: "website" });
  }, [meta]);
  const mine = !!meta && meta.owner === c.myUsername;
  const toggleFollow = () => {
    const next = !followed;
    setFollowed(next); // optimistic
    toggleCollectionFollow(id as string, next).catch((e) => { console.error("list follow failed", e); setFollowed(!next); });
  };
  const remove = () => deleteCollection(id as string).then(() => navigate(`/user/${meta?.owner}`)).catch((e) => console.error("list delete failed", e));
  if (!loading && !meta) return <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 16px", color: t.muted, fontSize: 14 }}>Reading list not found.</div>;
  const action = meta && (
    <div style={{ display: "flex", gap: 8 }}>
      <button onClick={toggleFollow} style={relBtn(t, followed)}>
        {followed ? <BellOff size={15} /> : <Bell size={15} />} {followed ? "Following" : "Follow"}
      </button>
      {mine && <button onClick={() => setConfirming(true)} style={{ ...relBtn(t), color: "#e0726b" }}>Delete</button>}
    </div>
  );
  const followerCount = meta?.followers ?? 0;
  return (
    <>
      <PostListPage t={t} title={meta?.name ?? "Reading list"}
        sub={meta ? `by ${meta.owner} · ${meta.count} ${meta.count === 1 ? "post" : "posts"} · ${followerCount} ${followerCount === 1 ? "follower" : "followers"}${meta.description ? ` — ${meta.description}` : ""}` : null}
        action={action} posts={posts} loading={loading} mutedUsers={c.mutedUsers} onOpen={c.goPost} onAuthor={c.goUser} myUsername={c.myUsername}
        emptyText="Nothing in this list yet." />
      {confirming && <ConfirmDialog t={t} title="Delete this reading list?" message="Followers lose it; the posts themselves stay." onConfirm={remove} onClose={() => setConfirming(false)} busy={false} />}
    </>
  );
}

function SearchRoute() {
  const c: any = useOutletContext();
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";
  const [posts, setPosts] = useState<UiPost[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    window.scrollTo(0, 0); setLoading(true);
    searchPosts(q).then(setPosts).catch((e) => console.error("search failed", e)).finally(() => setLoading(false));
  }, [q]);
  useEffect(() => { setPageMeta({ title: `Search — ${community.name}`, description: community.blurb, url: "/search", type: "website" }); }, []);
  return <PostListPage t={c.t} title={`Results for “${q}”`} sub={posts.length && !loading ? `${posts.length} post${posts.length === 1 ? "" : "s"}` : null} posts={posts} loading={loading} mutedUsers={c.mutedUsers} onOpen={c.goPost} onAuthor={c.goUser} myUsername={c.myUsername} emptyText="Nothing found. Try different words." />;
}

function InboxRoute() {
  const c: any = useOutletContext();
  const t = c.t;
  const [items, setItems] = useState<UiNotification[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    window.scrollTo(0, 0);
    fetchNotifications()
      .then(setItems)
      .catch((e) => console.error("inbox load failed", e))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { setPageMeta({ title: `Inbox — ${community.name}`, description: community.blurb, url: "/inbox", type: "website" }); }, []);
  const markAll = () => {
    markAllNotificationsRead()
      .then(() => { setItems((prev) => prev.map((n) => ({ ...n, unread: false }))); c.refreshUnread?.(); })
      .catch((e) => console.error("mark read failed", e));
  };
  const line = (n: UiNotification) =>
    n.type === "reply" ? `replied to you on “${n.postTitle}”`
    : n.type === "mention" ? `mentioned you on “${n.postTitle}”`
    : n.type === "tagged_post" ? `posted “${n.postTitle}” in a tag you follow`
    : `your post “${n.postTitle}” is getting votes`;
  const hasUnread = items.some((n) => n.unread);
  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 16px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 0 10px" }}>
        <h1 style={{ color: t.heading, fontSize: 24, fontWeight: 800, margin: 0 }}>Inbox</h1>
        {hasUnread && <button onClick={markAll} style={relBtn(t)}>Mark all read</button>}
      </div>
      {loading ? (
        <div style={{ color: t.muted, fontSize: 14, padding: "24px 0" }}>Loading…</div>
      ) : items.length === 0 ? (
        <div style={{ color: t.muted, fontSize: 14, padding: "24px 0" }}>Nothing yet. Replies and @mentions land here.</div>
      ) : (
        items.map((n) => (
          <div key={n.id} onClick={() => { if (n.postId) c.goPost({ id: n.postId }); }}
            style={{ display: "flex", alignItems: "center", gap: 10, background: t.panel, border: `1px solid ${n.unread ? t.accent : t.border}`, borderRadius: 12, padding: "10px 14px", marginBottom: 8, cursor: n.postId ? "pointer" : "default" }}>
            <Avatar seed={n.actor} size={30} t={t} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <span style={{ color: t.text, fontSize: 14 }}><b>{n.actor}</b> {line(n)}</span>
              <div style={{ color: t.muted, fontSize: 12 }}>{n.when}</div>
            </div>
            {n.unread && <span style={{ width: 8, height: 8, borderRadius: "50%", background: t.accent, flexShrink: 0 }} />}
          </div>
        ))
      )}
    </div>
  );
}

// Per-item folder assignment: collapsed button, expands to folder checkboxes.
// Membership loads on first expand; toggles are optimistic.
function FolderTagger({ t, targetType, targetId, folders, onChanged }: any) {
  const [open, setOpen] = useState(false);
  const [inFolders, setInFolders] = useState<string[] | null>(null);
  const expand = () => {
    setOpen(!open);
    if (inFolders === null) fetchFolderMembership(targetType, targetId).then(setInFolders).catch((e) => console.error("membership load failed", e));
  };
  const toggle = (fid: string) => {
    const on = !(inFolders ?? []).includes(fid);
    setInFolders((prev) => (on ? [...(prev ?? []), fid] : (prev ?? []).filter((x) => x !== fid))); // optimistic
    toggleFolderItem(fid, targetType, targetId, on)
      .then(() => onChanged?.())
      .catch((e) => { console.error("folder toggle failed", e); setInFolders((prev) => (on ? (prev ?? []).filter((x) => x !== fid) : [...(prev ?? []), fid])); });
  };
  if (folders.length === 0) return null;
  return (
    <div style={{ margin: "4px 0 0" }} onClick={(e) => e.stopPropagation()}>
      <button onClick={expand} style={{ background: "none", border: "none", color: t.muted, cursor: "pointer", fontSize: 12, fontWeight: 700, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
        <Bookmark size={12} /> Folders {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
          {folders.map((f: any) => {
            const on = (inFolders ?? []).includes(f.id);
            return (
              <button key={f.id} onClick={() => toggle(f.id)} disabled={inFolders === null}
                style={{ ...relBtn(t, on), padding: "3px 10px", fontSize: 12, opacity: inFolders === null ? 0.5 : 1 }}>
                {f.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Per-post reading-list assignment (mirrors FolderTagger, plus inline create).
// Public lists, so it lives on the post page rather than the saved view.
function CollectionTagger({ t, postId }: any) {
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<UiCollection[] | null>(null);
  const [inLists, setInLists] = useState<string[]>([]);
  const [newName, setNewName] = useState("");
  const [err, setErr] = useState("");
  const expand = () => {
    setOpen(!open);
    if (lists === null) {
      Promise.all([fetchMyCollections(), fetchCollectionMembership(postId)])
        .then(([ls, m]) => { setLists(ls); setInLists(m); })
        .catch((e) => console.error("lists load failed", e));
    }
  };
  const toggle = (id: string) => {
    const on = !inLists.includes(id);
    setInLists((prev) => (on ? [...prev, id] : prev.filter((x) => x !== id))); // optimistic
    toggleCollectionItem(id, postId, on)
      .catch((e) => { console.error("list toggle failed", e); setInLists((prev) => (on ? prev.filter((x) => x !== id) : [...prev, id])); });
  };
  const create = () => {
    const name = newName.trim();
    if (!name) return;
    setErr("");
    createCollection(name)
      .then((id) => {
        setLists((prev) => [...(prev ?? []), { id, name, description: "", owner: "", count: 0, followers: 0 }]);
        setNewName("");
        toggle(id); // put the post straight into the new list
      })
      .catch((e) => setErr(/duplicate|unique/i.test(e?.message || "") ? "You already have a list with that name." : e?.message || "Create failed."));
  };
  return (
    <div style={{ margin: "4px 0 0" }} onClick={(e) => e.stopPropagation()}>
      <button onClick={expand} style={{ background: "none", border: "none", color: t.muted, cursor: "pointer", fontSize: 12, fontWeight: 700, padding: 0, display: "flex", alignItems: "center", gap: 4 }}>
        <BookOpen size={12} /> Reading lists {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {open && (
        <div style={{ marginTop: 6 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {(lists ?? []).map((l) => {
              const on = inLists.includes(l.id);
              return (
                <button key={l.id} onClick={() => toggle(l.id)} disabled={lists === null}
                  style={{ ...relBtn(t, on), padding: "3px 10px", fontSize: 12 }}>
                  {l.name}
                </button>
              );
            })}
            <input value={newName} onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") create(); }}
              placeholder="New list…"
              style={{ background: t.bg, color: t.text, border: `1px solid ${t.border}`, borderRadius: 999, padding: "3px 10px", fontSize: 12, outline: "none", width: 110 }} />
          </div>
          {err && <div style={{ color: "#e0726b", fontSize: 12, marginTop: 4 }}>{err}</div>}
        </div>
      )}
    </div>
  );
}

function SavedRoute() {
  const c: any = useOutletContext();
  const t = c.t;
  const [folders, setFolders] = useState<UiFolder[]>([]);
  const [active, setActive] = useState<string | null>(null); // folder id, null = all saved
  const [posts, setPosts] = useState<UiPost[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [err, setErr] = useState("");

  const refreshFolders = () => fetchMyFolders().then(setFolders).catch((e) => console.error("folders load failed", e));
  const loadItems = (folderId: string | null) => {
    setLoading(true);
    Promise.all([fetchSavedPosts(folderId ?? undefined), fetchSavedComments(folderId ?? undefined)])
      .then(([p, cm]) => { setPosts(p); setComments(cm); })
      .catch((e) => console.error("saved load failed", e))
      .finally(() => setLoading(false));
  };
  useEffect(() => { window.scrollTo(0, 0); refreshFolders(); }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadItems(active); }, [active]);
  useEffect(() => { setPageMeta({ title: `Saved — ${community.name}`, description: community.blurb, url: "/saved", type: "website" }); }, []);

  const addFolder = () => {
    setErr("");
    createFolder(newName)
      .then((f) => { setFolders((prev) => [...prev, f]); setNewName(""); })
      .catch((e) => setErr(/duplicate|unique/i.test(e?.message || "") ? "You already have a folder with that name." : e?.message || "Couldn't create folder."));
  };
  const removeActiveFolder = () => {
    if (!active) return;
    deleteFolder(active)
      .then(() => { setFolders((prev) => prev.filter((f) => f.id !== active)); setActive(null); setConfirmingDelete(false); })
      .catch((e) => { console.error("folder delete failed", e); setConfirmingDelete(false); });
  };
  const activeName = folders.find((f) => f.id === active)?.name;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 16px 24px" }}>
      <div style={{ padding: "20px 0 4px" }}>
        <h1 style={{ color: t.heading, fontSize: 24, fontWeight: 800, margin: 0 }}>Saved</h1>
        <div style={{ color: t.muted, fontSize: 13, marginTop: 4 }}>Your bookmarked posts and comments — only you can see this.</div>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", padding: "10px 0" }}>
        <button onClick={() => setActive(null)} style={relBtn(t, active === null)}>All saved</button>
        {folders.map((f) => (
          <button key={f.id} onClick={() => setActive(f.id)} style={relBtn(t, active === f.id)}>{f.name} · {f.count}</button>
        ))}
        <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newName.trim()) addFolder(); }}
          placeholder="New folder…" style={{ background: t.bg, border: `1px solid ${t.border}`, borderRadius: 999, padding: "7px 14px", color: t.text, fontSize: 13, outline: "none", width: 130 }} />
        {newName.trim() && <button onClick={addFolder} style={{ ...relBtn(t), padding: "6px 12px" }}><Plus size={14} /></button>}
        {active && <button onClick={() => setConfirmingDelete(true)} style={{ ...relBtn(t), padding: "6px 12px", color: "#e0726b", marginLeft: "auto" }}>Delete folder</button>}
      </div>
      {err && <div style={{ color: "#e0726b", fontSize: 13, marginBottom: 8 }}>{err}</div>}
      {loading ? (
        <div style={{ color: t.muted, fontSize: 14, padding: "24px 0" }}>Loading…</div>
      ) : posts.length === 0 && comments.length === 0 ? (
        <div style={{ color: t.muted, fontSize: 14, padding: "24px 0" }}>
          {active ? `Nothing in “${activeName}” yet — expand Folders on any saved item to add it.` : "No saved posts yet. Hit Save on any post."}
        </div>
      ) : (
        <>
          {posts.map((p) => (
            <div key={p.id}>
              <PostCard post={p} t={t} onOpen={c.goPost} onAuthor={c.goUser} muted={c.mutedUsers.includes(p.author)} showMeta myUsername={c.myUsername} />
              <FolderTagger t={t} targetType="post" targetId={p.id} folders={folders} onChanged={() => { refreshFolders(); if (active) loadItems(active); }} />
            </div>
          ))}
          {comments.length > 0 && (
            <>
              <div style={{ color: t.heading, fontSize: 15, fontWeight: 800, padding: "18px 0 6px" }}>Saved comments</div>
              {comments.map((cm) => (
                <div key={cm.id} style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 12, padding: 12, marginBottom: 10 }}>
                  <div onClick={() => c.goPost({ id: cm.postId })} style={{ cursor: "pointer" }}>
                    <div style={{ color: t.muted, fontSize: 12, marginBottom: 4 }}>{cm.author} · {cm.when} · on <span style={{ color: t.link }}>{cm.postTitle}</span></div>
                    <div style={{ color: t.text, fontSize: 14, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>{cm.body}</div>
                  </div>
                  <FolderTagger t={t} targetType="comment" targetId={cm.id} folders={folders} onChanged={() => { refreshFolders(); if (active) loadItems(active); }} />
                </div>
              ))}
            </>
          )}
        </>
      )}
      {confirmingDelete && (
        <ConfirmDialog t={t} title={`Delete “${activeName}”?`} message="The folder goes away; the saved items in it stay saved." confirmLabel="Delete"
          onConfirm={removeActiveFolder} onClose={() => setConfirmingDelete(false)} busy={false} />
      )}
    </div>
  );
}

function PostRoute() {
  const c: any = useOutletContext();
  const { id } = useParams();
  const [post, setPost] = useState<UiPost | null>(null);
  const load = async () => { try { setPost(await fetchPostWithComments(id as string)); } catch (e) { console.error("post load failed", e); } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { window.scrollTo(0, 0); setPost(null); setPageMeta({ title: community.name }); load(); }, [id]);
  useEffect(() => {
    if (!post) return;
    const cover = (post.media || []).find((m) => typeof m === "string" && m.startsWith("http"));
    setPageMeta({ title: `${post.title} — ${community.name}`, description: clip(post.body) || community.blurb, image: cover, url: `/post/${post.id}`, type: "article" });
    recordView({ id: post.id, title: post.title, author: post.author });
  }, [post]);
  if (!post) return <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 16px", color: c.t.muted, fontSize: 14 }}>Loading…</div>;
  return <PostPage post={post} t={c.t} onBack={c.goHome} onAuthor={c.goUser} isMod={c.myIsMod} onCommentAdded={load} onRemoved={() => { c.goHome(); c.loadFeed(); }} myUsername={c.myUsername} />;
}

function MemberRoute() {
  const c: any = useOutletContext();
  const { username } = useParams();
  const [profile, setProfile] = useState<UiProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const load = async () => { setLoading(true); try { setProfile(await fetchProfile(username as string)); } catch (e) { console.error("profile load failed", e); } finally { setLoading(false); } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { window.scrollTo(0, 0); setPageMeta({ title: community.name }); load(); }, [username]);
  useEffect(() => {
    if (!profile) return;
    setPageMeta({ title: `${profile.display} (@${profile.username}) — ${community.name}`, description: clip(profile.banner) || `${profile.display} on ${community.name}.`, url: `/user/${profile.username}`, type: "profile" });
  }, [profile]);
  const navigate = useNavigate();
  // After saving own profile: refresh shell identity (username/blur pref), then
  // route to the new username or reload in place.
  const onSavedProfile = (newUsername?: string) => {
    c.refreshIdentity();
    c.loadFeed(); // author names in the feed may carry a changed username
    if (newUsername) navigate(`/user/${newUsername}`, { replace: true });
    else load();
  };
  return <MemberPage t={c.t} profile={profile} loading={loading} isMe={!!profile && profile.username === c.myUsername} isMod={c.myIsMod} onOpen={c.goPost} onChat={c.openChatWith} onRelationshipChange={c.refreshHidden} onProfileChanged={load} onSavedProfile={onSavedProfile} myUsername={c.myUsername} />;
}

// ----- Auth gate + route table -----
function centeredStyle(t: Palette): React.CSSProperties {
  return { minHeight: "100vh", background: t.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "Inter, system-ui, sans-serif" };
}

function Splash() {
  const { mode } = useTheme();
  const t = goldPair[mode];
  return <div style={centeredStyle(t)}><div style={{ color: t.muted, fontSize: 14 }}>Loading…</div></div>;
}

function SetupNotice() {
  const { mode } = useTheme();
  const t = goldPair[mode];
  const code = { background: t.panel2, borderRadius: 4, padding: "1px 6px", fontSize: 13, color: t.heading } as const;
  return (
    <div style={centeredStyle(t)}>
      <div style={{ maxWidth: 460, background: t.panel, border: `1px solid ${t.border}`, borderRadius: 16, padding: 24, color: t.text }}>
        <h1 style={{ color: t.heading, fontSize: 20, margin: "0 0 12px" }}>Almost there</h1>
        <p style={{ color: t.muted, fontSize: 14, lineHeight: 1.6, margin: 0 }}>
          Add your Supabase anon key to <code style={code}>.env</code> as <code style={code}>VITE_SUPABASE_ANON_KEY</code>,
          then restart the dev server.
        </p>
      </div>
    </div>
  );
}

// The "/" branch: show login/splash when signed out, otherwise the app layout.
function AuthedLayout() {
  const { session, loading } = useAuth();
  if (loading) return <Splash />;
  if (!session) return <LoginScreen />;
  return <AppLayout />;
}

export default function AppRoutes() {
  if (!isSupabaseConfigured) return <SetupNotice />;
  return (
    <Routes>
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/" element={<AuthedLayout />}>
        <Route index element={<LandingRoute />} />
        <Route path="post/:id" element={<PostRoute />} />
        <Route path="user/:username" element={<MemberRoute />} />
        <Route path="t/:slug" element={<TagRoute />} />
        <Route path="list/:id" element={<CollectionRoute />} />
        <Route path="search" element={<SearchRoute />} />
        <Route path="saved" element={<SavedRoute />} />
        <Route path="inbox" element={<InboxRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
