import React, { useState, useEffect, useMemo, useRef, useContext, createContext } from "react";
import {
  Plus, Bell, BellOff, MoreHorizontal, ArrowUp, ArrowDown, MessageCircle,
  Share2, Search, ChevronDown, ChevronUp, ChevronRight, Pin, Shield, BookOpen, TriangleAlert,
  Globe, ArrowLeft, Send, X, Image as ImageIcon, Link2, BarChart3, Video,
  FileText, HelpCircle, Megaphone, Lightbulb, MessageSquare, UserPlus, Archive,
  UserMinus, VolumeX, Flag, Gift, Star, Eye, EyeOff, Repeat2, LogOut, Sun, Moon, Pencil, ExternalLink, Bookmark, Check, Trash2, Users,
} from "lucide-react";
import { Routes, Route, Navigate, Link, Outlet, useNavigate, useLocation, useParams, useOutletContext, useSearchParams } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { LoginScreen } from "./auth/LoginScreen";
import { ResetPasswordPage } from "./auth/ResetPasswordPage";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { fetchCommunityFeed, fetchCommunityStats, fetchMyMembership, setMembership, setMyMemberFlair, fetchPinned, fetchPostWithComments, fetchProfile, getMyVote, castVote, getRelationshipState, setRelationship, fetchHiddenUsernames, getMyProfileId, fetchMyIdentity, createPost, createComment, uploadMedia, updatePost, deletePost, updateComment, deleteComment, updateMyProfile, uploadAvatar, validateAvatarFile, fetchMyMutes, USERNAME_RE, fetchTagFeed, searchPosts, getMySaved, toggleSaved, fetchSavedPosts, fetchSavedComments, castPollVote, fetchPollResults, fetchNotifications, fetchUnreadCount, markAllNotificationsRead, fetchMyFollowedTags, toggleTagFollow, fetchFollowedFeed, getMyPostFollow, togglePostFollow, setProfilePin, setPostArchived, fetchMyArchivedPosts, fetchMyFolders, createFolder, deleteFolder, fetchFolderMembership, toggleFolderItem, fetchCollectionsByUser, fetchCollection, fetchCollectionPosts, createCollection, deleteCollection, fetchMyCollections, fetchCollectionMembership, toggleCollectionItem, getMyCollectionFollow, toggleCollectionFollow, fetchMyPostInsights, listCommissionListings, createCommissionListing, updateCommissionListing, deleteCommissionListing, listCommissionRequests, createCommissionRequest, updateCommissionRequest, deleteCommissionRequest, fetchSidebarBookmarks, listCircles, fetchCircle, createCircle, joinCircle, leaveCircle, fetchCircleFeed } from "./lib/api";
import type { FeedSort, UiNotification, UiFolder, UiCollection, PostInsights } from "./lib/api";
import type { UiPost, UiPinned, UiProfile, UiCommissionListing, UiCommissionRequest, UiBookmark, UiCircle } from "./lib/types";
import { recordView, getHistory, clearHistory, isTrackingOff, setTrackingOff } from "./lib/readingHistory";
import { timeAgo } from "./lib/time";
import type { HistoryEntry } from "./lib/readingHistory";
import { getOrCreateConversation, fetchConversations, fetchMessages, sendMessage, subscribeToMessages } from "./lib/chat";
import type { UiMessage, UiConversation } from "./lib/chat";
import { modSetPinned, modRemovePost, modSetPostFlairs, modAssignMemberFlair, modUpsertSidebarBookmark, modDeleteSidebarBookmark, modReorderSidebarBookmarks } from "./lib/mod";
import { setPageMeta, clip } from "./lib/seo";
import { useUsernameHoverCard, UserHoverCardHost } from "./UserHoverCard";
import { goldPair, neutralPair, PROFILE_THEMES, applyProfileTheme, profileHeaderGradient } from "./lib/palettes";
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
    "A Wakanda-first community made for fanfiction, art, music, cosplay, and discussion rooted in the Black Panther MCU films and comics canon. This is for you! Source your artwork, flair your posts, and engage in good faith. Wakanda Forever.",
  created: "Jun 27, 2026",
  // Bookmarks link to a route (`to`) or to a pinned post matched by title
  // (`pinnedMatch`) so we never hardcode post ids.
  bookmarks: [
    { label: "Wiki", pinnedMatch: /lore megathread/i },
    { label: "Fanfic Archive", to: "/t/fanfiction" },
    { label: "Weekly Self-Promo Thread", pinnedMatch: /self-promo/i },
    { label: "Circles", to: "/circles" },
    { label: "Commission Board", to: "/commissions" },
    // Cross-link back to the source fiction (MILESTONES §12). External, opens in a new tab.
    { label: "Read the fiction on tjadaka.com", href: "https://tjadaka.com", external: true },
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
  if (!f) return null;
  const base = { background: f.bg, color: f.fg, borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 700 };
  if (plain) return <span style={base}>{f.label}</span>;
  // Real link (SEO §11 #6): crawlers reach /t/:slug from every flair chip.
  return <Link to={`/t/${flairKey}`} onClick={(e) => e.stopPropagation()} title={`See all ${f.label} posts`}
    style={{ ...base, cursor: "pointer", textDecoration: "none", display: "inline-block" }}>{f.label}</Link>;
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

// Creator insights modal (MILESTONES §7, v1): engagement counts for the
// author's own post, from existing data only — votes and comments. Opens from
// the "See More Insights" link, which PostCard renders only for the author;
// fetchMyPostInsights re-checks authorship data-side and returns null otherwise.
function PostInsightsDialog({ t, post, onClose }: any) {
  const [insights, setInsights] = useState<PostInsights | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    fetchMyPostInsights(post.id)
      .then((data) => { if (alive) setInsights(data); })
      .catch((e) => console.error("post insights failed", e))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [post.id]);

  const tile = (label: string, value: number, icon: React.ReactNode) => (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: t.muted, fontSize: 12, fontWeight: 700 }}>{icon} {label}</div>
      <div style={{ color: t.text, fontSize: 22, fontWeight: 800, marginTop: 4 }}>{value}</div>
    </div>
  );

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 14, width: 400, maxWidth: "100%", padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <BarChart3 size={16} color={t.accent} />
          <h3 style={{ color: t.text, margin: 0, fontSize: 16, fontWeight: 800, flex: 1 }}>Post insights</h3>
          <button onClick={onClose} aria-label="Close insights" style={{ background: "none", border: "none", color: t.muted, cursor: "pointer", display: "flex", padding: 0 }}><X size={16} /></button>
        </div>
        <p style={{ color: t.muted, fontSize: 13, margin: "0 0 14px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{post.title}</p>
        {loading ? (
          <div style={{ color: t.muted, fontSize: 13, padding: "18px 0" }}>Loading insights…</div>
        ) : !insights ? (
          <div style={{ color: t.muted, fontSize: 13, padding: "18px 0" }}>Couldn't load insights — they're only available for your own posts.</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {tile("Score", insights.score, <BarChart3 size={13} />)}
            {tile("Comments", insights.commentCount, <MessageCircle size={13} />)}
            {tile("Upvotes", insights.upvotes, <ArrowUp size={13} />)}
            {tile("Downvotes", insights.downvotes, <ArrowDown size={13} />)}
          </div>
        )}
        <p style={{ color: t.muted, fontSize: 12, lineHeight: 1.5, margin: "14px 0 0" }}>Only you can see this. Views and save counts aren't tracked yet.</p>
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

// `eager` marks likely-LCP media (first feed card, post-detail hero): loads
// immediately at high priority. Everything else lazy-loads (CWV, SEO §11 #5).
function MediaBlock({ post, t, eager }: any) {
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
    // ponytail: minHeight reserves space so late-loading media doesn't shift the
    // feed (CLS); exact per-image dims would need width/height stored at upload.
    <div style={{ display: "flex", gap: 8, overflowX: "auto", marginTop: 8, minHeight: 200 }} onClick={(e) => e.stopPropagation()}>
      {urls.map((u: string, i: number) => isVideo(u)
        ? <video key={i} src={u} controls muted preload={eager ? "metadata" : "none"} aria-label={`${mediaKind} video by ${post.author}: ${post.title}`} style={{ maxHeight: 340, maxWidth: "100%", borderRadius: 12, border: `1px solid ${t.border}` }} />
        : <img key={i} src={u} loading={eager && i === 0 ? "eager" : "lazy"} decoding="async" fetchPriority={eager && i === 0 ? "high" : undefined} alt={`${mediaKind} by ${post.author}: ${post.title}${urls.length > 1 ? ` (${i + 1} of ${urls.length})` : ""}`} style={{ maxHeight: 340, maxWidth: "100%", borderRadius: 12, border: `1px solid ${t.border}`, objectFit: "cover" }} />)}
    </div>
  );
}

// ----- Comment composer (reused for top-level + replies) -----
function CommentComposer({ t, postId, parentId, onAdded, placeholder, onCancel }: any) {
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
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
      <FmtToolbar taRef={taRef} value={val} onChange={setVal} t={t} />
      <textarea ref={taRef} value={val} onChange={(e) => setVal(e.target.value)} placeholder={placeholder || "Add a comment…"} rows={3}
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

// Inline fanart embeds (client-side only — no metadata fetching, no backend).
// We only turn a URL into an <img> when it's an https link to a KNOWN reputable
// image/fanart host AND ends in an image extension. Allowlist-first avoids
// tracking-pixel / content-safety risks from rendering arbitrary URLs as images.
// Anything not matched stays a normal clickable link.
const IMAGE_HOST_ALLOWLIST = new Set([
  "i.imgur.com", "imgur.com",
  "cdn.discordapp.com", "media.discordapp.net",
  "i.redd.it", "preview.redd.it",
  "pbs.twimg.com",
  "raw.githubusercontent.com", "user-images.githubusercontent.com",
]);
// Suffix matches for hosts that shard across many subdomains.
const IMAGE_HOST_SUFFIXES = [
  ".media.tumblr.com",   // Tumblr media (e.g. 64.media.tumblr.com)
  ".artstation.com",     // ArtStation CDNs (cdna./cdnb.)
  ".wixmp.com",          // DeviantArt-served images
];
const IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|avif)$/i;

function isAllowlistedImageUrl(raw: string): boolean {
  let u: URL;
  try { u = new URL(raw); } catch { return false; }
  if (u.protocol !== "https:") return false;
  const host = u.hostname.toLowerCase();
  const okHost = IMAGE_HOST_ALLOWLIST.has(host) || IMAGE_HOST_SUFFIXES.some((s) => host.endsWith(s));
  return okHost && IMAGE_EXT_RE.test(u.pathname);
}

// Fanwork-platform link chips (client-side only — no metadata fetching, no
// backend). A link to a known fanwork platform renders as a recognizable chip
// (platform icon + name + whatever is cleanly parseable from the URL itself,
// like a username or work id). Deliberately NOT a fake "preview card": with no
// fetching we have no title/summary, so we stay honest — it's a nicer link.
// URLs that don't cleanly match stay plain links via CommentLink.
type PlatformHit = { label: string; icon: string; detail?: string };

// Path segments that are platform pages, not usernames — never show as @user.
const DEVIANTART_RESERVED = new Set(["tag", "search", "join", "about", "topic", "shop", "forum", "daily-deviations", "core-membership"]);
const TUMBLR_RESERVED = new Set(["search", "tagged", "explore", "settings", "dashboard", "login", "register", "blog", "communities"]);
const ARTSTATION_RESERVED = new Set(["artwork", "search", "jobs", "learning", "marketplace", "prints", "blogs", "channels"]);

function detectFanworkPlatform(raw: string): PlatformHit | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const segs = u.pathname.split("/").filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch { return s; } });

  if (host === "archiveofourown.org") {
    let detail;
    if (segs[0] === "works" && /^\d+$/.test(segs[1] ?? "")) detail = `Work #${segs[1]}`;
    else if (segs[0] === "series" && /^\d+$/.test(segs[1] ?? "")) detail = `Series #${segs[1]}`;
    else if (segs[0] === "collections" && segs[1]) detail = `Collection: ${segs[1]}`;
    else if (segs[0] === "users" && segs[1]) detail = `@${segs[1]}`;
    return { label: "AO3", icon: "📖", detail };
  }
  if (host === "deviantart.com" || host.endsWith(".deviantart.com")) {
    let detail;
    const sub = host.endsWith(".deviantart.com") ? host.slice(0, -".deviantart.com".length) : "";
    if (sub && sub !== "www") detail = `@${sub}`; // legacy username.deviantart.com
    else if (segs[1] === "art" && segs[0]) detail = `@${segs[0]}`;
    else if (segs.length === 1 && !DEVIANTART_RESERVED.has(segs[0])) detail = `@${segs[0]}`;
    return { label: "DeviantArt", icon: "🎨", detail };
  }
  if (host === "tumblr.com" || host.endsWith(".tumblr.com")) {
    let detail;
    const sub = host.endsWith(".tumblr.com") ? host.slice(0, -".tumblr.com".length) : "";
    // Skip CDN/multi-level subdomains (64.media.tumblr.com) — not blog names.
    if (sub && sub !== "www" && sub !== "media" && sub !== "assets" && sub !== "static" && !sub.includes(".")) detail = `@${sub}`; // blogname.tumblr.com
    else if (segs[0] === "blog" && segs[1] === "view" && segs[2]) detail = `@${segs[2]}`;
    else if (segs[0] && !TUMBLR_RESERVED.has(segs[0])) detail = `@${segs[0]}`; // tumblr.com/blogname/...
    return { label: "Tumblr", icon: "🌀", detail };
  }
  if (host === "artstation.com") {
    let detail;
    if (segs[0] === "artwork" && segs[1]) detail = "Artwork";
    else if (segs.length === 1 && !ARTSTATION_RESERVED.has(segs[0])) detail = `@${segs[0]}`;
    return { label: "ArtStation", icon: "🖼️", detail };
  }
  if (host === "pixiv.net") {
    const p = /^[a-z]{2}$/.test(segs[0] ?? "") ? segs.slice(1) : segs; // strip locale prefix (/en/...)
    let detail;
    if (p[0] === "artworks" && /^\d+$/.test(p[1] ?? "")) detail = `Illustration #${p[1]}`;
    else if (p[0] === "users" && /^\d+$/.test(p[1] ?? "")) detail = `User #${p[1]}`;
    return { label: "Pixiv", icon: "🖌️", detail };
  }
  if (host === "wattpad.com") {
    let detail;
    const storyId = segs[0] === "story" ? segs[1]?.match(/^(\d+)/)?.[1] : undefined;
    if (storyId) detail = `Story #${storyId}`;
    else if (segs[0] === "user" && segs[1]) detail = `@${segs[1]}`;
    return { label: "Wattpad", icon: "📙", detail };
  }
  return null;
}

// Soundtrack/music-platform link chips — same client-side chip pattern as the
// fanwork platforms above (no metadata fetching, no backend). Deliberately a
// chip and NOT an iframe player embed: embeds load third-party pages (and
// their trackers) into every viewer's browser on render, and Bandcamp's embed
// isn't even derivable from the URL without fetching. The detail is only what
// the URL itself says (type + slug), so we never claim a title we don't know.
const SOUNDCLOUD_RESERVED = new Set(["discover", "search", "stream", "upload", "charts", "feed", "you", "library", "messages", "notifications", "settings", "pages", "tags", "popular", "jobs", "imprint", "terms-of-use"]);
const BANDCAMP_RESERVED_SUBS = new Set(["www", "daily", "blog", "get", "help", "bandcamp"]);
const deslug = (s: string) => s.replace(/-/g, " ");

function detectMusicPlatform(raw: string): PlatformHit | null {
  let u: URL;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== "https:") return null;
  const host = u.hostname.toLowerCase().replace(/^www\./, "");
  const segs = u.pathname.split("/").filter(Boolean).map((s) => { try { return decodeURIComponent(s); } catch { return s; } });

  if (host === "open.spotify.com") {
    const p = /^intl-/.test(segs[0] ?? "") ? segs.slice(1) : segs; // strip locale prefix (/intl-de/...)
    let detail;
    // Spotify ids are opaque base62 — the type is all the URL honestly tells us.
    if (p[0] === "track" && p[1]) detail = "Track";
    else if (p[0] === "album" && p[1]) detail = "Album";
    else if (p[0] === "playlist" && p[1]) detail = "Playlist";
    else if (p[0] === "artist" && p[1]) detail = "Artist";
    return { label: "Spotify", icon: "🎧", detail };
  }
  if (host === "music.apple.com") {
    const p = /^[a-z]{2}$/.test(segs[0] ?? "") ? segs.slice(1) : segs; // strip storefront (/us/...)
    let detail;
    if (p[0] === "album" && p[1]) detail = u.searchParams.has("i") ? `Song · ${deslug(p[1])}` : `Album · ${deslug(p[1])}`;
    else if (p[0] === "song" && p[1]) detail = `Song · ${deslug(p[1])}`;
    else if (p[0] === "playlist" && p[1]) detail = `Playlist · ${deslug(p[1])}`;
    else if (p[0] === "artist" && p[1]) detail = `Artist · ${deslug(p[1])}`;
    return { label: "Apple Music", icon: "🎵", detail };
  }
  if (host === "music.youtube.com") {
    let detail;
    if (segs[0] === "watch" && u.searchParams.get("v")) detail = "Track";
    else if (segs[0] === "playlist" && u.searchParams.get("list")) detail = "Playlist";
    return { label: "YouTube Music", icon: "🎶", detail };
  }
  if (host === "soundcloud.com" || host === "on.soundcloud.com") {
    let detail;
    // on.soundcloud.com short links are opaque; soundcloud.com/{artist}/{track}.
    if (host === "soundcloud.com" && segs[0] && !SOUNDCLOUD_RESERVED.has(segs[0])) {
      if (segs[1] === "sets") detail = segs[2] ? `Playlist · ${deslug(segs[2])}` : `@${segs[0]}`;
      else if (segs[1]) detail = `@${segs[0]} · ${deslug(segs[1])}`;
      else detail = `@${segs[0]}`;
    }
    return { label: "SoundCloud", icon: "☁️", detail };
  }
  if (host === "bandcamp.com" || host.endsWith(".bandcamp.com")) {
    const sub = host.endsWith(".bandcamp.com") ? host.slice(0, -".bandcamp.com".length) : "";
    // Only single-level artist subdomains name an artist (mirrors the Tumblr guard).
    const artist = sub && !BANDCAMP_RESERVED_SUBS.has(sub) && !sub.includes(".") ? sub : "";
    let detail;
    if (artist && segs[0] === "track" && segs[1]) detail = `@${artist} · ${deslug(segs[1])}`;
    else if (artist && segs[0] === "album" && segs[1]) detail = `Album · ${deslug(segs[1])}`;
    else if (artist) detail = `@${artist}`;
    return { label: "Bandcamp", icon: "💿", detail };
  }
  return null;
}

// Known-platform URL rendered as a compact chip: icon + platform + parsed
// detail. Full URL kept in the title tooltip; stopPropagation so clicking a
// chip inside a comment doesn't toggle thread collapse.
function PlatformChip({ href, hit, t }: { href: string; hit: PlatformHit; t: any }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow" title={href}
      onClick={(e) => e.stopPropagation()}
      style={{ display: "inline-flex", alignItems: "center", gap: 6, maxWidth: "100%", padding: "1px 10px",
        border: `1px solid ${t.border}`, borderRadius: 999, background: t.pill, color: t.text,
        fontSize: 13, fontWeight: 700, textDecoration: "none", verticalAlign: "middle", lineHeight: 1.7 }}>
      <span aria-hidden="true">{hit.icon}</span>
      <span style={{ color: t.accent }}>{hit.label}</span>
      {hit.detail && <span style={{ color: t.muted, fontWeight: 500, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hit.detail}</span>}
      <span aria-hidden="true" style={{ color: t.muted, fontSize: 11 }}>↗</span>
    </a>
  );
}

// A comment URL rendered as a plain, safe, clickable link.
function CommentLink({ href, t }: { href: string; t: any }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer nofollow"
      style={{ color: t.accent, textDecoration: "underline", wordBreak: "break-word" }}>{href}</a>
  );
}

// Allowlisted image URL rendered inline. Lazy-loaded, capped so it can't blow
// out the layout; if it fails to load it degrades to the plain link.
function InlineImage({ src, t }: { src: string; t: any }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <CommentLink href={src} t={t} />;
  return (
    <img src={src} alt="Shared image" loading="lazy" onError={() => setFailed(true)}
      style={{ display: "block", maxWidth: "100%", maxHeight: 360, borderRadius: 12, border: `1px solid ${t.border}`, margin: "6px 0", objectFit: "contain" }} />
  );
}

// Turn a plain-text run into nodes: allowlisted image URLs -> inline images,
// known fanwork- or music-platform URLs -> platform chips, other bare https URLs ->
// clickable links, everything else stays text. Used for the plain segments
// inside the rich-text renderer below so embeds work anywhere body text appears.
function linkify(text: string, t: any, kp: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const parts = text.split(/(https:\/\/[^\s<]+)/g);
  parts.forEach((part, i) => {
    if (i % 2 === 0) { if (part) out.push(part); return; }
    // Don't swallow trailing sentence punctuation into the URL.
    const trail = part.match(/[.,;:!?)\]}'"]+$/)?.[0] ?? "";
    const url = trail ? part.slice(0, part.length - trail.length) : part;
    const isImage = isAllowlistedImageUrl(url);
    const platform = isImage ? null : detectFanworkPlatform(url) ?? detectMusicPlatform(url); // images stay the InlineImage path; fanwork chips first, then music
    out.push(isImage
      ? <InlineImage key={`${kp}-lk${i}`} src={url} t={t} />
      : platform
        ? <PlatformChip key={`${kp}-lk${i}`} href={url} hit={platform} t={t} />
        : <CommentLink key={`${kp}-lk${i}`} href={url} t={t} />);
    if (trail) out.push(trail);
  });
  return out;
}

// Single client-side renderer for post & comment bodies. Extends the original
// spoiler-only parser into a small, dependency-free markdown subset that matches
// exactly what the formatting toolbar emits. Everything is built as React
// elements (auto-escaped) — never dangerouslySetInnerHTML — so no sanitizer is
// needed and stored bodies stay plain text in the same `body` column.
const CODE_FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

function codeInlineStyle(t: any): React.CSSProperties {
  return { background: t.pill, color: t.text, borderRadius: 4, padding: "1px 5px", fontFamily: CODE_FONT, fontSize: "0.9em" };
}

// Inline spans: **bold**, *italic*, `code`, [text](url) and >!spoiler!<.
// Bold is matched before italic; code and links are captured whole so their
// inner text is not re-parsed as markdown. Plain runs between tokens are passed
// through linkify() so bare fanart URLs embed inline.
function renderInlineRich(text: string, t: any, kp: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*(?:[^*]|\*(?!\*))+\*\*)|(\*[^*\n]+\*)|(`[^`\n]+`)|(>!.+?!<)|(\[[^\]]+\]\((?:https?:\/\/|mailto:|\/)[^)\s]+\))/g;
  let last = 0, i = 0, m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) out.push(...linkify(text.slice(last, m.index), t, `${kp}-p${last}`));
    const tok = m[0];
    if (m[1]) out.push(<strong key={`${kp}-${i}`}>{renderInlineRich(tok.slice(2, -2), t, `${kp}-${i}b`)}</strong>);
    else if (m[2]) out.push(<em key={`${kp}-${i}`}>{renderInlineRich(tok.slice(1, -1), t, `${kp}-${i}i`)}</em>);
    else if (m[3]) out.push(<code key={`${kp}-${i}`} style={codeInlineStyle(t)}>{tok.slice(1, -1)}</code>);
    else if (m[4]) out.push(<Spoiler key={`${kp}-${i}`} text={tok.slice(2, -2)} t={t} />);
    else { const mm = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(tok)!; out.push(<a key={`${kp}-${i}`} href={mm[2]} target="_blank" rel="noopener noreferrer" style={{ color: t.link, textDecoration: "underline" }}>{mm[1]}</a>); }
    last = re.lastIndex; i++;
  }
  if (last < text.length) out.push(...linkify(text.slice(last), t, `${kp}-pend`));
  return out;
}

// Inline text that may span several soft lines — newlines render as <br/> to
// preserve the old pre-wrap feel (a single newline is a visible line break).
function renderInlineLines(text: string, t: any, kp: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  text.split("\n").forEach((ln, j) => {
    if (j > 0) out.push(<br key={`${kp}-br${j}`} />);
    out.push(...renderInlineRich(ln, t, `${kp}-${j}`));
  });
  return out;
}

const isBlockStart = (l: string) => /^```/.test(l.trim()) || /^#{1,3}\s+/.test(l) || /^>(?!!)\s?/.test(l) || /^\s*[-*]\s+/.test(l) || /^\s*\d+\.\s+/.test(l);

function renderRichText(body: string, t: any): React.ReactNode {
  if (!body) return null;
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: React.ReactNode[] = [];
  let i = 0, k = 0;
  while (i < lines.length) {
    const line = lines[i];
    // fenced code block ``` ... ```
    if (/^```/.test(line.trim())) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) { buf.push(lines[i]); i++; }
      i++; // consume closing fence (if present)
      blocks.push(<pre key={k++} style={{ background: t.pill, borderRadius: 8, padding: "10px 12px", overflowX: "auto", margin: "0 0 10px", fontFamily: CODE_FONT, fontSize: 13, lineHeight: 1.5, color: t.text }}>{buf.join("\n")}</pre>);
      continue;
    }
    // headings # / ## / ###
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) {
      const size = h[1].length === 1 ? 22 : h[1].length === 2 ? 19 : 16;
      blocks.push(<div key={k++} style={{ fontWeight: 800, fontSize: size, color: t.text, margin: "12px 0 8px", lineHeight: 1.3 }}>{renderInlineRich(h[2], t, `h${k}`)}</div>);
      i++; continue;
    }
    // blockquote (> ...), excluding the >! spoiler marker
    if (/^>(?!!)\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>(?!!)\s?/.test(lines[i])) { buf.push(lines[i].replace(/^>(?!!)\s?/, "")); i++; }
      blocks.push(<blockquote key={k++} style={{ borderLeft: `3px solid ${t.border}`, margin: "0 0 10px", padding: "2px 0 2px 12px", color: t.muted }}>{renderInlineLines(buf.join("\n"), t, `q${k}`)}</blockquote>);
      continue;
    }
    // unordered list (- or *)
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*[-*]\s+/, "")); i++; }
      blocks.push(<ul key={k++} style={{ margin: "0 0 10px", paddingLeft: 22, lineHeight: 1.6 }}>{items.map((it, j) => <li key={j}>{renderInlineRich(it, t, `ul${k}-${j}`)}</li>)}</ul>);
      continue;
    }
    // ordered list (1. 2. ...)
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(lines[i].replace(/^\s*\d+\.\s+/, "")); i++; }
      blocks.push(<ol key={k++} style={{ margin: "0 0 10px", paddingLeft: 24, lineHeight: 1.6 }}>{items.map((it, j) => <li key={j}>{renderInlineRich(it, t, `ol${k}-${j}`)}</li>)}</ol>);
      continue;
    }
    // blank line — paragraph separator
    if (line.trim() === "") { i++; continue; }
    // paragraph — gather until a blank line or the next block starter
    const buf: string[] = [];
    while (i < lines.length && lines[i].trim() !== "" && !isBlockStart(lines[i])) { buf.push(lines[i]); i++; }
    blocks.push(<p key={k++} style={{ margin: "0 0 10px", lineHeight: 1.6 }}>{renderInlineLines(buf.join("\n"), t, `p${k}`)}</p>);
  }
  return <>{blocks}</>;
}

// Formatting toolbar: wraps/inserts the exact markdown syntax renderRichText
// parses. Operates on the shared textarea through a ref — no new state, no
// storage change; the output is just the markdown text the renderer understands.
function FmtToolbar({ taRef, value, onChange, t }: any) {
  const wrap = (before: string, after: string, placeholder: string) => {
    const ta = taRef.current; if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = value.slice(s, e) || placeholder;
    onChange(value.slice(0, s) + before + sel + after + value.slice(e));
    const start = s + before.length;
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(start, start + sel.length); });
  };
  const linePrefix = (prefix: string) => {
    const ta = taRef.current; if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const from = value.lastIndexOf("\n", s - 1) + 1;
    const nl = value.indexOf("\n", e);
    const to = nl === -1 ? value.length : nl;
    const prefixed = value.slice(from, to).split("\n").map((l: string) => prefix + l).join("\n");
    onChange(value.slice(0, from) + prefixed + value.slice(to));
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(from, from + prefixed.length); });
  };
  const link = () => {
    const ta = taRef.current; if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = value.slice(s, e) || "text";
    const insert = `[${sel}](url)`;
    onChange(value.slice(0, s) + insert + value.slice(e));
    const urlStart = s + insert.length - 4; // select the "url" placeholder
    requestAnimationFrame(() => { ta.focus(); ta.setSelectionRange(urlStart, urlStart + 3); });
  };
  const btn = (label: React.ReactNode, title: string, onClick: () => void) => (
    <button type="button" title={title} aria-label={title} onMouseDown={(ev) => ev.preventDefault()} onClick={onClick}
      style={{ background: t.pill, color: t.pillText, border: `1px solid ${t.border}`, borderRadius: 6, minWidth: 28, height: 28, padding: "0 8px", cursor: "pointer", fontSize: 13, lineHeight: 1, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 4 }}>{label}</button>
  );
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
      {btn(<b>B</b>, "Bold", () => wrap("**", "**", "bold text"))}
      {btn(<i>I</i>, "Italic", () => wrap("*", "*", "italic text"))}
      {btn("H", "Heading", () => linePrefix("## "))}
      {btn(<Link2 size={14} />, "Link", link)}
      {btn(<span>&bull;</span>, "Bulleted list", () => linePrefix("- "))}
      {btn(<span>&ldquo;</span>, "Quote", () => linePrefix("> "))}
      {btn(<span style={{ fontFamily: CODE_FONT }}>{"</>"}</span>, "Inline code", () => wrap("`", "`", "code"))}
    </div>
  );
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
            <div style={{ fontSize: 14, color: c.deleted ? t.muted : t.text, fontStyle: c.deleted ? "italic" : "normal", margin: "6px 0", lineHeight: 1.55 }}>{c.deleted ? c.body : renderRichText(c.body, t)}</div>
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
function PostCard({ post, t, onOpen, onAuthor, muted, showMeta, myUsername, onChanged, canPin, eager }: any) {
  const [followed, toggleFollowed] = usePostFollow(post.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [insightsOpen, setInsightsOpen] = useState(false);
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
      <Link to={`/user/${post.author}`} {...hoverHandlers} style={{ color: t.heading, cursor: "pointer", fontStyle: "normal", fontWeight: 700, textDecoration: "none" }}>{post.author}</Link>. Open their profile to unmute.
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
        <Link to={`/user/${post.author}`} onClick={(e) => e.stopPropagation()} {...hoverHandlers} style={{ fontSize: 13, fontWeight: 700, color: t.heading, textDecoration: "none" }}>{post.author}</Link>
        <span style={{ fontSize: 12, color: t.muted }}>· {post.when}</span>
        {(post.pinned || post.profilePinned) && <Pin size={13} color={t.accent} />}
        {post.archived && (
          <span style={{ display: "flex", alignItems: "center", gap: 4, color: t.muted, fontSize: 11, fontWeight: 700, border: `1px solid ${t.border}`, borderRadius: 999, padding: "1px 8px" }}>
            <Archive size={11} /> Archived
          </span>
        )}
        {mine && (
          <div style={{ marginLeft: "auto", position: "relative" }} onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setMenuOpen(!menuOpen)} aria-label="Post options" style={{ background: "none", border: "none", color: t.muted, cursor: "pointer", display: "flex", padding: 0 }}><MoreHorizontal size={16} /></button>
            {menuOpen && (
              <div style={{ position: "absolute", right: 0, top: 22, background: t.panel2, border: `1px solid ${t.border}`, borderRadius: 8, padding: 4, zIndex: 10, minWidth: 110 }}>
                {canPin && (
                  <button onClick={() => { setMenuOpen(false); setProfilePin(post.id, !post.profilePinned).then(() => onChanged?.()).catch((e) => console.error("profile pin failed", e)); }}
                    style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: t.text, cursor: "pointer", fontSize: 13, padding: "7px 10px", borderRadius: 6 }}>
                    {post.profilePinned ? "Unpin from profile" : "Pin to profile"}
                  </button>
                )}
                <button onClick={() => { setMenuOpen(false); setPostArchived(post.id, !post.archived).then(() => onChanged?.()).catch((e) => console.error("post archive failed", e)); }}
                  style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: t.text, cursor: "pointer", fontSize: 13, padding: "7px 10px", borderRadius: 6 }}>
                  {post.archived ? "Unarchive" : "Archive"}
                </button>
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
        <h3 style={{ fontSize: 19, fontWeight: 700, margin: "0 0 8px" }}>
          <Link to={`/post/${post.id}`} onClick={(e) => e.stopPropagation()} style={{ color: t.text, textDecoration: "none" }}>{post.title}</Link>
        </h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>{post.flairs?.map((f) => <Flair key={f} flairKey={f} />)}</div>
        <ContentWarningGate warnings={post.warnings} t={t}>
          <p style={{ fontSize: 14, color: t.muted, margin: "0 0 10px", lineHeight: 1.5 }}>{post.body}</p>
          {post.links?.map((l, i) => <div key={i} style={{ fontSize: 14, color: t.link, textDecoration: "underline", marginBottom: 4 }}>{i + 1}. {l}</div>)}
          <MediaBlock post={post} t={t} eager={eager} />
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
            {mine && <span onClick={() => setInsightsOpen(true)} style={{ color: t.link, fontWeight: 700, cursor: "pointer" }}>See More Insights</span>}
          </div>
        </>
      )}
      {confirming && <ConfirmDialog t={t} title="Delete post?" message="This can't be undone." onConfirm={remove} onClose={() => setConfirming(false)} busy={busy} />}
      {insightsOpen && <PostInsightsDialog t={t} post={post} onClose={() => setInsightsOpen(false)} />}
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

// Pre-fetch fallback so the sidebar never flashes empty and still renders if
// the DB read fails. Derived from the original hardcoded `community.bookmarks`
// (also the source of the 0029 seed), converted to the UiBookmark shape.
// External cross-links (e.g. tjadaka.com) are excluded — they aren't part of the
// DB-backed, mod-editable set and are rendered statically alongside the list.
const FALLBACK_BOOKMARKS: UiBookmark[] = community.bookmarks
  .filter((b: any) => !b.external)
  .map((b: any, i: number) => ({
    id: `fallback-${i}`,
    label: b.label,
    route: b.to ?? null,
    pinnedMatch: b.pinnedMatch ? b.pinnedMatch.source : null,
    position: i,
  }));

// Editable fields shared by the add + edit bookmark rows (mod-only).
function BookmarkFields({ t, label, setLabel, kind, setKind, value, setValue }: any) {
  const inputStyle = { width: "100%", background: t.bg, color: t.text, border: `1px solid ${t.border}`, borderRadius: 8, padding: "6px 8px", fontSize: 12.5, boxSizing: "border-box" as const };
  return (
    <>
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Label" style={{ ...inputStyle, marginBottom: 6 }} />
      <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
        <select value={kind} onChange={(e) => setKind(e.target.value)} style={{ ...inputStyle, width: "auto", flex: "0 0 auto" }}>
          <option value="route">Route</option>
          <option value="match">Pinned match</option>
        </select>
        <input value={value} onChange={(e) => setValue(e.target.value)}
          placeholder={kind === "route" ? "/t/fanfiction" : "self-promo"} style={{ ...inputStyle, flex: 1 }} />
      </div>
    </>
  );
}

// One existing bookmark in edit mode: rename/retarget, reorder, delete.
function BookmarkEditRow({ t, bm, index, count, onMove, onDelete, onChanged }: any) {
  const initialKind: "route" | "match" = bm.route != null ? "route" : "match";
  const initialValue = bm.route ?? bm.pinnedMatch ?? "";
  const [label, setLabel] = useState(bm.label);
  const [kind, setKind] = useState<"route" | "match">(initialKind);
  const [value, setValue] = useState(initialValue);
  const [busy, setBusy] = useState(false);
  const dirty = label !== bm.label || kind !== initialKind || value !== initialValue;

  const save = async () => {
    if (!label.trim() || !value.trim()) { alert("Label and target are required."); return; }
    setBusy(true);
    try {
      await modUpsertSidebarBookmark(bm.id, label.trim(), kind === "route" ? value.trim() : null, kind === "match" ? value.trim() : null);
      await onChanged();
    } catch (e) { console.error("save bookmark failed", e); alert("Could not save bookmark."); }
    finally { setBusy(false); }
  };

  const iconBtn = (disabled: boolean) => ({ background: t.panel2, color: t.text, border: `1px solid ${t.border}`, borderRadius: 8, padding: "5px 7px", cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1, display: "flex", alignItems: "center" });
  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 10, padding: 8, marginBottom: 8 }}>
      <BookmarkFields t={t} label={label} setLabel={setLabel} kind={kind} setKind={setKind} value={value} setValue={setValue} />
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <button onClick={() => onMove(index, -1)} disabled={index === 0} title="Move up" style={iconBtn(index === 0)}><ArrowUp size={14} /></button>
        <button onClick={() => onMove(index, 1)} disabled={index === count - 1} title="Move down" style={iconBtn(index === count - 1)}><ArrowDown size={14} /></button>
        <button onClick={() => onDelete(bm.id)} title="Delete" style={{ ...iconBtn(false), color: "#e06a6a" }}><Trash2 size={14} /></button>
        <div style={{ flex: 1 }} />
        <button onClick={save} disabled={!dirty || busy}
          style={{ background: dirty && !busy ? t.accent : t.panel2, color: dirty && !busy ? t.bg : t.muted, border: `1px solid ${dirty && !busy ? t.accent : t.border}`, borderRadius: 8, padding: "5px 12px", fontSize: 12, fontWeight: 700, cursor: dirty && !busy ? "pointer" : "default" }}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}

// The "add a bookmark" form shown at the bottom of the editor.
function BookmarkAddRow({ t, onChanged }: any) {
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<"route" | "match">("route");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (!label.trim() || !value.trim()) { alert("Label and target are required."); return; }
    setBusy(true);
    try {
      await modUpsertSidebarBookmark(null, label.trim(), kind === "route" ? value.trim() : null, kind === "match" ? value.trim() : null);
      setLabel(""); setValue(""); setKind("route");
      await onChanged();
    } catch (e) { console.error("add bookmark failed", e); alert("Could not add bookmark."); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ border: `1px dashed ${t.border}`, borderRadius: 10, padding: 8 }}>
      <BookmarkFields t={t} label={label} setLabel={setLabel} kind={kind} setKind={setKind} value={value} setValue={setValue} />
      <button onClick={add} disabled={busy}
        style={{ width: "100%", background: t.panel2, color: t.text, border: `1px solid ${t.border}`, borderRadius: 8, padding: "6px 0", fontSize: 12, fontWeight: 700, cursor: busy ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        <Plus size={14} /> {busy ? "Adding…" : "Add bookmark"}
      </button>
    </div>
  );
}

// ----- Community sidebar -----
function CommunitySidebar({ t, isMod }: any) {
  const navigate = useNavigate();
  const [stats, setStats] = useState<{ members: number; contributions: number } | null>(null);
  const [pinned, setPinned] = useState<any[]>([]);
  const [joined, setJoined] = useState<boolean | null>(null); // null until loaded
  const [joinBusy, setJoinBusy] = useState(false);
  const [bookmarks, setBookmarks] = useState<UiBookmark[]>(FALLBACK_BOOKMARKS);
  const [bookmarksFromDb, setBookmarksFromDb] = useState(false);
  const [editingBookmarks, setEditingBookmarks] = useState(false);
  const loadBookmarks = () => fetchSidebarBookmarks().then((b) => { setBookmarks(b); setBookmarksFromDb(true); });
  useEffect(() => { fetchCommunityStats().then(setStats).catch((e) => console.error("stats load failed", e)); }, []);
  useEffect(() => { fetchPinned().then(setPinned).catch((e) => console.error("pinned load failed", e)); }, []);
  useEffect(() => { fetchMyMembership().then(setJoined).catch((e) => console.error("membership load failed", e)); }, []);
  useEffect(() => { loadBookmarks().catch((e) => console.error("bookmarks load failed", e)); }, []);
  // Reorder two bookmarks and persist the new order (optimistic, rolls back).
  const moveBookmark = async (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= bookmarks.length) return;
    const next = [...bookmarks];
    [next[index], next[j]] = [next[j], next[index]];
    const prev = bookmarks;
    setBookmarks(next);
    try { await modReorderSidebarBookmarks(next.map((b) => b.id)); await loadBookmarks(); }
    catch (e) { console.error("reorder failed", e); setBookmarks(prev); alert("Could not reorder bookmarks."); }
  };
  const deleteBookmark = async (id: string) => {
    try { await modDeleteSidebarBookmark(id); await loadBookmarks(); }
    catch (e) { console.error("delete bookmark failed", e); alert("Could not delete bookmark."); }
  };
  // Optimistically flip membership + the Wakandans count, rolling back on failure.
  const toggleJoin = () => {
    if (joined === null || joinBusy) return;
    const next = !joined;
    setJoinBusy(true);
    setJoined(next);
    setStats((s) => s && { ...s, members: s.members + (next ? 1 : -1) });
    setMembership(next).catch((e) => {
      console.error("join toggle failed", e);
      setJoined(!next);
      setStats((s) => s && { ...s, members: s.members + (next ? -1 : 1) });
    }).finally(() => setJoinBusy(false));
  };
  // Resolve a bookmark to its target path, or null when nothing matches yet.
  const bookmarkPath = (b: UiBookmark): string | null => {
    if (b.route) return b.route;
    if (!b.pinnedMatch) return null;
    let re: RegExp;
    try { re = new RegExp(b.pinnedMatch, "i"); } catch { return null; }
    const hit = pinned.find((p) => re.test(p.title));
    return hit ? `/post/${hit.id}` : null;
  };
  return (
    <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 14, padding: 16 }}>
      <h4 style={{ color: t.heading, fontSize: 15, fontWeight: 800, margin: "0 0 8px" }}>{community.short}</h4>
      <p style={{ color: t.muted, fontSize: 13, lineHeight: 1.5, margin: "0 0 14px" }}>{community.blurb}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: t.muted, fontSize: 13, marginBottom: 6 }}><BookOpen size={15} /> Created {community.created}</div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: t.muted, fontSize: 13, marginBottom: 14 }}><Globe size={15} /> Public</div>
      <button onClick={toggleJoin} disabled={joined === null || joinBusy}
        style={{ width: "100%", background: joined ? t.panel2 : t.accent, color: joined ? t.text : t.bg, border: `1px solid ${joined ? t.border : t.accent}`, borderRadius: 999, padding: "8px 0", fontSize: 13, fontWeight: 700, cursor: joined === null || joinBusy ? "default" : "pointer", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, opacity: joined === null ? 0.6 : 1 }}>
        {joined ? <><UserMinus size={15} /> Leave</> : <><UserPlus size={15} /> Join</>}
      </button>
      <button style={{ width: "100%", background: t.panel2, color: t.text, border: `1px solid ${t.border}`, borderRadius: 999, padding: "8px 0", fontSize: 13, fontWeight: 700, cursor: "pointer", marginBottom: 16, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
        <BookOpen size={15} /> Community Guide
      </button>
      <div style={{ display: "flex", gap: 24, marginBottom: 18 }}>
        <div><div style={{ color: t.text, fontWeight: 800, fontSize: 16 }}>{stats ? stats.members.toLocaleString() : "—"}</div><div style={{ color: t.muted, fontSize: 12 }}>Wakandans</div></div>
        <div><div style={{ color: t.text, fontWeight: 800, fontSize: 16 }}>{stats ? stats.contributions.toLocaleString() : "—"}</div><div style={{ color: t.muted, fontSize: 12 }}>Contributions</div></div>
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ color: t.muted, fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>COMMUNITY BOOKMARKS</div>
        {isMod && bookmarksFromDb && (
          <button onClick={() => setEditingBookmarks((v) => !v)} title={editingBookmarks ? "Done editing" : "Edit bookmarks"}
            style={{ background: "transparent", color: t.muted, border: "none", cursor: "pointer", display: "flex", alignItems: "center", padding: 2 }}>
            {editingBookmarks ? <Check size={15} /> : <Pencil size={14} />}
          </button>
        )}
      </div>
      {editingBookmarks ? (
        <div style={{ marginBottom: 8 }}>
          {bookmarks.map((b, i) => (
            <BookmarkEditRow key={b.id} t={t} bm={b} index={i} count={bookmarks.length}
              onMove={moveBookmark} onDelete={deleteBookmark} onChanged={loadBookmarks} />
          ))}
          <BookmarkAddRow t={t} onChanged={loadBookmarks} />
        </div>
      ) : (
        bookmarks.map((b) => {
          const to = bookmarkPath(b);
          return (
            <a key={b.id} href={to ?? undefined}
              onClick={(e) => { e.preventDefault(); if (to) navigate(to); }}
              style={{ display: "block", background: t.panel2, borderRadius: 999, padding: "9px 0", textAlign: "center", color: t.text, fontSize: 13, fontWeight: 700, marginBottom: 8, cursor: to ? "pointer" : "default", textDecoration: "none" }}>
              {b.label}
            </a>
          );
        })
      )}
      {/* External cross-link to the source fiction (MILESTONES §12). The mod-editable
          DB bookmarks only model internal routes / pinned posts, so this external link
          is rendered statically and always opens in a new tab. */}
      <a href="https://tjadaka.com" target="_blank" rel="noopener noreferrer"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: t.panel2, borderRadius: 999, padding: "9px 0", color: t.text, fontSize: 13, fontWeight: 700, marginBottom: 8, cursor: "pointer", textDecoration: "none" }}>
        Read the fiction on tjadaka.com <ExternalLink size={13} />
      </a>
      {/* Tag index (SEO §11 #6): every tag page linked from the sidebar so none is orphaned. */}
      <div style={{ color: t.muted, fontSize: 12, fontWeight: 700, letterSpacing: 0.5, margin: "16px 0 10px" }}>BROWSE TAGS</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {Object.keys(POST_FLAIRS).map((k) => <Flair key={k} flairKey={k} />)}
      </div>
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

function CreatePostModal({ t, onClose, onCreated, initialCircleId }: any) {
  const [sel, setSel] = useState("text");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [circleId, setCircleId] = useState<string>(initialCircleId ?? "");
  const [circles, setCircles] = useState<UiCircle[]>([]);
  const [flairs, setFlairs] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [pollOpts, setPollOpts] = useState(["", "", "", ""]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [customWarning, setCustomWarning] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

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

  // Circles Phase 1: every circle is public and open to posting, so the
  // "Post to" picker lists them all (joined ones first).
  useEffect(() => {
    listCircles()
      .then((all) => setCircles([...all].sort((a, b) => Number(b.joined) - Number(a.joined) || b.members - a.members)))
      .catch((e) => console.error("circles load failed", e));
  }, []);

  const submit = async () => {
    if (!title.trim()) { setError("Give your post a title."); return; }
    const cleanPoll = pollOpts.map((o) => o.trim()).filter(Boolean);
    if (sel === "poll" && cleanPoll.length < 2) { setError("A poll needs at least 2 answer choices."); return; }
    setBusy(true); setError(null);
    try {
      let media: string[] = [];
      if (files.length) media = await uploadMedia(files);
      await createPost({ type: sel, title: title.trim(), body: body.trim(), flairSlugs: flairs, media, pollOptions: sel === "poll" ? cleanPoll : undefined, contentWarnings: warnings, circleId: circleId || null });
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

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <label style={{ color: t.muted, fontSize: 12, fontWeight: 700 }}>Post to</label>
          <select value={circleId} onChange={(e) => setCircleId(e.target.value)}
            style={{ background: t.bg, color: t.text, border: `1px solid ${t.border}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, maxWidth: 260 }}>
            <option value="">General feed</option>
            {circles.map((ci) => <option key={ci.id} value={ci.id}>c/{ci.slug} — {ci.name}</option>)}
          </select>
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
        <FmtToolbar taRef={bodyRef} value={body} onChange={setBody} t={t} />
        <textarea ref={bodyRef} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Body text" rows={4} style={{ width: "100%", background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", color: t.text, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit", fontSize: 14 }} />
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

function LandingPage({ t, onOpen, onAuthor, mutedUsers, posts, pager, pinned, loading, sort, onSort, following, myUsername, onChanged, isMod }: any) {
  const bp = useBreakpoint();
  return (
    <div style={contentGrid(bp)}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 0" }}>
          <img src="/bpf-home.png" alt={community.name} fetchPriority="high"
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
          posts.map((p, i) => <PostCard key={p.id} post={p} t={t} onOpen={onOpen} onAuthor={onAuthor} muted={mutedUsers.includes(p.author)} showMeta myUsername={myUsername} onChanged={onChanged} eager={i === 0} />)
        )}
        {!loading && pager}
      </div>
      <div><CommunitySidebar t={t} isMod={isMod} /></div>
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

function PostPage({ post, t, onBack, onAuthor, isMod, onCommentAdded, onRemoved, myUsername, onCircle }: any) {
  const bp = useBreakpoint();
  const [saved, toggleSave] = useSaved("post", post.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [reading, setReading] = useState(false); // distraction-reduced view, in-memory only
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
    <div style={reading ? { maxWidth: 760, margin: "0 auto", padding: "0 16px" } : contentGrid(bp)}>
      <div style={{ paddingTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button onClick={onBack} style={{ background: t.panel2, border: "none", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t.text }}><ArrowLeft size={18} /></button>
          <Avatar seed={post.circle ? post.circle.name : community.name} size={26} t={t} />
          {post.circle ? (
            <span onClick={() => onCircle?.(post.circle.slug)} title={post.circle.name} style={{ color: t.heading, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>c/{post.circle.slug}</span>
          ) : (
            <span style={{ color: t.heading, fontWeight: 700, fontSize: 13 }}>{community.name}</span>
          )}
          <span style={{ color: t.muted, fontSize: 12 }}>· {post.when}</span>
          {mine && (
            <div style={{ marginLeft: "auto", position: "relative" }}>
              <button onClick={() => setMenuOpen(!menuOpen)} aria-label="Post options" style={{ background: "none", border: "none", color: t.muted, cursor: "pointer", display: "flex", padding: 0 }}><MoreHorizontal size={18} /></button>
              {menuOpen && (
                <div style={{ position: "absolute", right: 0, top: 24, background: t.panel2, border: `1px solid ${t.border}`, borderRadius: 8, padding: 4, zIndex: 10, minWidth: 110 }}>
                  <button onClick={() => { setMenuOpen(false); setPostArchived(post.id, !post.archived).then(() => onCommentAdded?.()).catch((e) => console.error("post archive failed", e)); }}
                    style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: t.text, cursor: "pointer", fontSize: 13, padding: "7px 10px", borderRadius: 6 }}>
                    {post.archived ? "Unarchive" : "Archive"}
                  </button>
                  <button onClick={() => { setEditing(true); setMenuOpen(false); }} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: t.text, cursor: "pointer", fontSize: 13, padding: "7px 10px", borderRadius: 6 }}>Edit</button>
                  <button onClick={() => { setMenuOpen(false); setConfirming(true); }} style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", color: "#e0726b", cursor: "pointer", fontSize: 13, padding: "7px 10px", borderRadius: 6 }}>Delete</button>
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ fontSize: 12, marginBottom: 6 }}>
          <Link to={`/user/${post.author}`} {...hoverHandlers} style={{ color: t.muted, cursor: "pointer", textDecoration: "none" }}>{post.author}</Link>
        </div>
        {post.archived && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, border: `1px solid ${t.border}`, borderRadius: 10, padding: "9px 12px", marginBottom: 12, color: t.muted, fontSize: 13 }}>
            <Archive size={15} />
            <span>This post is archived — hidden from feeds, tag pages, and search, but anyone with the link can view it.</span>
          </div>
        )}
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
          {post.body && <div style={reading
            ? { color: t.text, fontSize: 18, lineHeight: 1.85, maxWidth: 680, margin: "0 auto", fontFamily: "Georgia, 'Times New Roman', serif" }
            : { color: t.text, fontSize: 15 }}>{renderRichText(post.body, t)}</div>}
          {post.type === "poll" && <PollBlock post={post} t={t} />}
          {post.links?.map((l: string, i: number) => <div key={i} style={{ fontSize: 14, color: t.link, textDecoration: "underline", marginBottom: 4 }}>{i + 1}. {l}</div>)}
          <MediaBlock post={post} t={t} eager />
        </ContentWarningGate>
        </>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0" }}>
          <Vote votes={post.votes} t={t} targetType="post" targetId={post.id} />
          <ActionPill icon={<MessageCircle size={15} />} label={post.commentCount ?? post.comments?.length ?? 0} t={t} />
          <ActionPill icon={<Bookmark size={15} fill={saved ? "currentColor" : "none"} />} label={saved ? "Saved" : "Save"} t={t} onClick={toggleSave} />
          <ActionPill icon={<Share2 size={15} />} label="Share" t={t} onClick={() => copyPostLink(post.id)} />
          <ActionPill icon={<BookOpen size={15} />} label={reading ? "Exit reading" : "Reading mode"} t={t} onClick={() => setReading((r) => !r)} />
        </div>
        <CollectionTagger t={t} postId={post.id} />
        {isMod && <ModBar post={post} t={t} onChanged={onCommentAdded} onRemoved={onRemoved} />}
        <CommentComposer t={t} postId={post.id} onAdded={onCommentAdded} placeholder="Join the conversation…" />
        <CommentList comments={post.comments ?? []} t={t} postId={post.id} onAdded={onCommentAdded} myUsername={myUsername} onAuthor={onAuthor} />
      </div>
      {!reading && <div><CommunitySidebar t={t} isMod={isMod} /></div>}
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
  const [ao3Works, setAo3Works] = useState<string[]>(profile.ao3Works || []);
  const setWork = (i: number, v: string) => setAo3Works((p) => p.map((x, j) => (j === i ? v : x)));
  const addWork = () => setAo3Works((p) => [...p, ""]);
  const removeWork = (i: number) => setAo3Works((p) => p.filter((_, j) => j !== i));
  const [kofi, setKofi] = useState(profile.kofi || "");
  const [flairSlug, setFlairSlug] = useState<string | null>(profile.flairSlug ?? null);
  const [profileTheme, setProfileTheme] = useState<string | null>(profile.profileTheme ?? null);
  const { mode } = useTheme(); // for theme-swatch colors in the picker
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
    for (const u of [ao3, kofi, ...ao3Works]) if (u.trim() && !/^https:\/\//i.test(u.trim())) { setErr("Links must start with https://"); return; }
    setBusy(true);
    try {
      const patch: any = {};
      if (username !== profile.username) patch.username = username;
      if (display !== profile.display) patch.display_name = display;
      if (banner !== profile.banner) patch.banner = banner;
      if ((ao3 || null) !== profile.ao3) patch.ao3_url = ao3 || null;
      if ((kofi || null) !== profile.kofi) patch.kofi_url = kofi || null;
      const cleanWorks = ao3Works.map((w) => w.trim()).filter(Boolean);
      if (JSON.stringify(cleanWorks) !== JSON.stringify(profile.ao3Works || [])) patch.ao3_works = cleanWorks;
      if (blur !== profile.blurMedia) patch.blur_media = blur;
      if (spoilerFree !== !!profile.spoilerFree) patch.spoiler_free = spoilerFree;
      if (JSON.stringify(spoilerTags) !== JSON.stringify(profile.spoilerTags || [])) patch.spoiler_tags = spoilerTags;
      if (JSON.stringify(mutedTagsEdit) !== JSON.stringify(profile.mutedTags || [])) patch.muted_tags = mutedTagsEdit;
      if ((profileTheme ?? null) !== (profile.profileTheme ?? null)) patch.profile_theme = profileTheme;
      if (avatarFile) patch.avatar_url = await uploadAvatar(avatarFile, profile.avatarUrl);
      if (Object.keys(patch).length) await updateMyProfile(patch);
      // Member flair goes through its own RPC (scope-guarded), not updateMyProfile.
      if ((flairSlug ?? null) !== (profile.flairSlug ?? null)) await setMyMemberFlair(flairSlug);
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
      {(() => {
        // 30-day cooldown hint; the change_username RPC enforces the rule server-side.
        if (!profile.usernameChangedAt) return null;
        const until = new Date(new Date(profile.usernameChangedAt).getTime() + 30 * 86400_000);
        if (until <= new Date()) return null;
        return <div style={{ color: t.muted, fontSize: 12, marginTop: 4 }}>Username changed recently — changeable again on {until.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}.</div>;
      })()}
      <label style={label}>DISPLAY NAME</label>
      <input style={field} value={display} onChange={(e) => setDisplay(e.target.value)} />
      <label style={label}>BIO</label>
      <textarea style={{ ...field, resize: "vertical", minHeight: 56 }} value={banner} onChange={(e) => setBanner(e.target.value)} />
      <label style={label}>AVATAR</label>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Avatar seed={profile.username} url={avatarFile ? URL.createObjectURL(avatarFile) : profile.avatarUrl} size={44} t={t} />
        <input type="file" accept="image/*" onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          const bad = f && validateAvatarFile(f);
          if (bad) { setErr(bad); setAvatarFile(null); e.target.value = ""; return; }
          setErr("");
          setAvatarFile(f);
        }} style={{ color: t.muted, fontSize: 13 }} />
      </div>
      <label style={label}>AO3 LINK</label>
      <input style={field} placeholder="https://archiveofourown.org/users/…" value={ao3} onChange={(e) => setAo3(e.target.value)} />
      <label style={label}>AO3 FEATURED WORKS</label>
      {ao3Works.map((w, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input style={{ ...field, flex: 1 }} placeholder="https://archiveofourown.org/works/…" value={w} onChange={(e) => setWork(i, e.target.value)} />
          <button type="button" onClick={() => removeWork(i)} title="Remove" style={{ background: "none", border: `1px solid ${t.border}`, color: t.muted, borderRadius: 8, padding: "0 10px", cursor: "pointer" }}><X size={14} /></button>
        </div>
      ))}
      <button type="button" onClick={addWork} style={{ background: "none", border: "none", color: t.link, cursor: "pointer", fontSize: 13, fontWeight: 700, padding: 0 }}>+ Add work</button>
      <label style={label}>KO-FI LINK</label>
      <input style={field} placeholder="https://ko-fi.com/…" value={kofi} onChange={(e) => setKofi(e.target.value)} />
      <label style={label}>MEMBER FLAIR</label>
      <select style={{ ...field, cursor: "pointer" }} value={flairSlug ?? ""} onChange={(e) => setFlairSlug(e.target.value || null)}>
        <option value="">— no flair —</option>
        {MEMBER_FLAIRS.map((f) => <option key={f.slug} value={f.slug}>{f.label}</option>)}
      </select>
      <label style={label}>PROFILE THEME</label>
      <div style={{ color: t.muted, fontSize: 12, margin: "0 0 6px" }}>Accent colors for your profile page, in both light and dark mode:</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {[[null, "Classic", neutralPair[mode].accent] as const, ...Object.entries(PROFILE_THEMES).map(([slug, p]) => [slug, p.label, p[mode].accent] as const)].map(([slug, lbl, swatch]) => {
          const on = (profileTheme ?? null) === slug;
          return (
            <button key={lbl} onClick={() => setProfileTheme(slug)}
              style={{ display: "flex", alignItems: "center", gap: 6, background: t.bg, color: t.text, border: `1px solid ${t.border}`, outline: on ? `2px solid ${t.accent}` : "none", borderRadius: 999, padding: "5px 12px", cursor: "pointer", fontSize: 12, fontWeight: 700, opacity: on ? 1 : 0.7 }}>
              <span style={{ width: 12, height: 12, borderRadius: "50%", background: swatch, display: "inline-block" }} />
              {lbl}
            </button>
          );
        })}
      </div>
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

function MemberPage({ t: baseT, profile, loading, isMe, isMod, onOpen, onChat, onRelationshipChange, onProfileChanged, onSavedProfile, myUsername }: any) {
  // Profile theme: layer the owner's preset accents onto the visitor's own
  // light/dark base palette. Scoped to this page — the shell stays neutral.
  const { mode } = useTheme();
  const t = applyProfileTheme(baseT, profile?.profileTheme, mode);
  const [rel, setRel] = useState({ follow: false, mute: false, block: false });
  const [followerDelta, setFollowerDelta] = useState(0);
  const [editing, setEditing] = useState(false);
  // Owner-only "Archived" tab (MILESTONES §4): archived posts are excluded from
  // the public posts list, so the owner browses/unarchives them here.
  const [tab, setTab] = useState<"posts" | "archived">("posts");
  const [archived, setArchived] = useState<UiPost[]>([]);
  const loadArchived = () => fetchMyArchivedPosts().then(setArchived).catch((e) => console.error("archived load failed", e));
  useEffect(() => { setTab("posts"); }, [profile?.id]);
  useEffect(() => { if (isMe && tab === "archived") loadArchived(); }, [isMe, tab, profile?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
        {isMe && (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={() => setTab("posts")} style={relBtn(t, tab === "posts")}>Posts</button>
            <button onClick={() => setTab("archived")} style={relBtn(t, tab === "archived")}><Archive size={14} /> Archived</button>
          </div>
        )}
        <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 8 }}>
          {tab === "archived" ? (
            archived.length === 0
              ? <div style={{ color: t.muted, fontSize: 13, padding: "20px 0" }}>No archived posts. Archive one from its “⋯” menu to tuck it away from feeds and search.</div>
              : archived.map((p) => <PostCard key={p.id} post={p} t={t} onOpen={onOpen} onAuthor={() => {}} muted={false} showMeta={false} myUsername={myUsername} onChanged={() => { loadArchived(); onProfileChanged?.(); }} canPin={false} />)
          ) : (
            profile.posts.length === 0
              ? <div style={{ color: t.muted, fontSize: 13, padding: "20px 0" }}>No posts on this profile yet.</div>
              : profile.posts.map((p) => <PostCard key={p.id} post={p} t={t} onOpen={onOpen} onAuthor={() => {}} muted={false} showMeta={false} myUsername={myUsername} onChanged={onProfileChanged} canPin={isMe} />)
          )}
        </div>
      </div>
      <div>
        <div style={{ height: 110, borderRadius: "14px 14px 0 0", background: profileHeaderGradient(profile.profileTheme, mode) ?? "linear-gradient(135deg,#3a3a3a,#1a1a1a)" }} />
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
          {(profile.ao3Works || []).filter((u: string) => /^https:\/\//i.test(u)).length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ color: t.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, margin: "6px 0 4px" }}>FEATURED WORKS</div>
              {(profile.ao3Works || []).filter((u: string) => /^https:\/\//i.test(u)).map((u: string, i: number) => (
                <a key={i} href={u} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 6, color: t.accent, fontSize: 13, textDecoration: "none", marginBottom: 5 }}>
                  <ExternalLink size={12} /> {u.replace(/^https:\/\/(www\.)?archiveofourown\.org\//i, "AO3: ").replace(/^https:\/\//i, "").slice(0, 48)}
                </a>
              ))}
            </div>
          )}
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
// Header account switcher (MILESTONES §10): lists roster accounts, switches
// between them, and opens the login screen to add another.
function AccountsMenu({ t, phone }: any) {
  const { session, accounts, switchAccount, startAddAccount } = useAuth();
  const [open, setOpen] = useState(false);
  const activeId = session?.user?.id;
  const pick = async (userId: string) => {
    setOpen(false);
    if (userId === activeId) return;
    const { error } = await switchAccount(userId);
    // Stored token was rotated/expired and dropped — prompt a fresh sign-in.
    if (error) startAddAccount();
  };
  return (
    <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setOpen((o) => !o)} title="Accounts" aria-label="Accounts"
        style={{ background: t.panel2, border: `1px solid ${t.border}`, borderRadius: "50%", width: phone ? 44 : 38, height: phone ? 44 : 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t.text }}>
        <UserPlus size={18} />
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: 44, background: t.panel, border: `1px solid ${t.border}`, borderRadius: 10, padding: 6, zIndex: 40, minWidth: 220, boxShadow: "0 8px 24px rgba(0,0,0,.35)" }}>
          <div style={{ color: t.muted, fontSize: 11, fontWeight: 700, letterSpacing: 0.5, padding: "6px 10px" }}>ACCOUNTS</div>
          {accounts.map((a) => {
            const active = a.userId === activeId;
            return (
              <button key={a.userId} onClick={() => pick(a.userId)}
                style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", background: "none", border: "none", color: t.text, cursor: "pointer", fontSize: 13, padding: "8px 10px", borderRadius: 6 }}>
                <Avatar seed={a.email} size={22} t={t} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.email}</span>
                {active && <Check size={15} color={t.accent} />}
              </button>
            );
          })}
          <div style={{ height: 1, background: t.border, margin: "4px 0" }} />
          <button onClick={() => { setOpen(false); startAddAccount(); }}
            style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", textAlign: "left", background: "none", border: "none", color: t.text, cursor: "pointer", fontSize: 13, padding: "8px 10px", borderRadius: 6 }}>
            <UserPlus size={15} /> Add account
          </button>
        </div>
      )}
    </div>
  );
}

function AppLayout() {
  const [showCreate, setShowCreate] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [createCircleId, setCreateCircleId] = useState<string | null>(null);
  const [createDone, setCreateDone] = useState<(() => void) | null>(null);
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

  // Open the create-post modal, optionally preset to a circle; onDone runs
  // after a successful post (e.g. the circle page reloading its feed).
  const openCreate = (circleId?: string, onDone?: () => void) => {
    setCreateCircleId(circleId ?? null);
    setCreateDone(() => onDone ?? null);
    setShowCreate(true);
  };
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
  const ctx = { t, feed, pinned, feedLoading, sort, changeSort, following, followedTags, refreshFollowedTags, mutedUsers, myUsername, myIsMod, goPost, goUser, goHome, openChatWith, refreshHidden, refreshIdentity, refreshUnread, loadFeed, mutedTags, toggleMuteTag, openCreate };

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
          <button onClick={() => openCreate()} aria-label="Create Post" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: t.panel2, color: t.text, border: `1px solid ${t.border}`, borderRadius: 999, padding: phone ? 0 : "8px 16px", width: phone ? 44 : undefined, height: phone ? 44 : undefined, cursor: "pointer", fontWeight: 700, fontSize: 13 }}><Plus size={16} />{phone ? null : " Create Post"}</button>
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
          <AccountsMenu t={t} phone={phone} />
          <button onClick={signOut} title="Sign out" aria-label="Sign out" style={{ background: t.panel2, border: `1px solid ${t.border}`, borderRadius: "50%", width: phone ? 44 : 38, height: phone ? 44 : 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t.text }}><LogOut size={18} /></button>
        </div>
      </div>

      <div style={{ padding: "16px 0 70px" }}>
        <Outlet context={ctx} />
      </div>

      {showCreate && <CreatePostModal t={t} initialCircleId={createCircleId} onClose={() => { setShowCreate(false); setCreateCircleId(null); setCreateDone(null); }} onCreated={() => { loadFeed(); createDone?.(); }} />}
      {showChat && <ChatDrawer t={t} target={chatTarget} onClose={() => setShowChat(false)} />}
      <UserHoverCardHost t={t} myUsername={myUsername} />
    </div>
    </PrefsContext.Provider>
  );
}

// ----- Routed pages (read URL params, load their own data) -----

// Crawlable pagination for feed/tag lists (SEO §11 #4): "page 2" is a real URL
// (?page=2) with canonical + rel prev/next, instead of scroll-only content.
const FEED_PAGE_SIZE = 25;

/** 1-based page number from ?page= (absent/garbage → 1). */
function usePageParam(): number {
  const [params] = useSearchParams();
  const n = parseInt(params.get("page") ?? "1", 10);
  return Number.isFinite(n) && n > 1 ? n : 1;
}

function pageUrl(basePath: string, n: number): string {
  return n <= 1 ? basePath : `${basePath}?page=${n}`;
}

// ponytail: client-side slicing over the existing full fetch; move to server-side
// .range() in api.ts when feeds outgrow a single query.
function paginate(items: UiPost[], requested: number, basePath: string) {
  const pages = Math.max(1, Math.ceil(items.length / FEED_PAGE_SIZE));
  const page = Math.min(requested, pages); // out-of-range → last page, canonical follows
  return {
    items: items.slice((page - 1) * FEED_PAGE_SIZE, page * FEED_PAGE_SIZE),
    page,
    url: pageUrl(basePath, page),
    prev: page > 1 ? pageUrl(basePath, page - 1) : null,
    next: page < pages ? pageUrl(basePath, page + 1) : null,
  };
}

/** Prev/next as real links so crawlers can reach every page. */
function Pager({ t, page, prev, next }: any) {
  if (!prev && !next) return null;
  const link = { ...relBtn(t, false), textDecoration: "none" };
  return (
    <nav aria-label="Pages" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, padding: "16px 0" }}>
      {prev && <Link to={prev} style={link}>← Previous</Link>}
      <span style={{ color: t.muted, fontSize: 13 }}>Page {page}</span>
      {next && <Link to={next} style={link}>Next →</Link>}
    </nav>
  );
}

function LandingRoute() {
  const c: any = useOutletContext();
  const requested = usePageParam();
  const pg = paginate(c.feed, requested, "/");
  useEffect(() => {
    const suffix = pg.page > 1 ? ` (Page ${pg.page})` : "";
    setPageMeta({ title: `${community.name} — Wakanda-first fan community${suffix}`, description: clip(community.blurb), url: pg.url, type: "website", prev: pg.prev, next: pg.next });
  }, [pg.url, pg.prev, pg.next]);
  useEffect(() => { window.scrollTo(0, 0); }, [pg.page]);
  return <LandingPage t={c.t} posts={pg.items} pager={<Pager t={c.t} page={pg.page} prev={pg.prev} next={pg.next} />} pinned={c.pinned} loading={c.feedLoading} sort={c.sort} onSort={c.changeSort} following={c.following} mutedUsers={c.mutedUsers} onOpen={c.goPost} onAuthor={c.goUser} myUsername={c.myUsername} onChanged={c.loadFeed} isMod={c.myIsMod} />;
}

// Shared list layout for tag-filter and search-result pages.
function PostListPage({ t, title, sub, action, posts, pager, loading, mutedUsers, onOpen, onAuthor, myUsername, emptyText }: any) {
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
        posts.map((p: UiPost, i: number) => <PostCard key={p.id} post={p} t={t} onOpen={onOpen} onAuthor={onAuthor} muted={mutedUsers.includes(p.author)} showMeta myUsername={myUsername} eager={i === 0} />)
      )}
      {!loading && pager}
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
  const requested = usePageParam();
  const pg = paginate(posts, requested, `/t/${slug}`);
  useEffect(() => {
    const suffix = pg.page > 1 ? ` (Page ${pg.page})` : "";
    setPageMeta({ title: `${label} — ${community.name}${suffix}`, description: `${label} posts on ${community.name}.`, url: pg.url, type: "website", prev: pg.prev, next: pg.next });
  }, [slug, label, pg.url, pg.prev, pg.next]);
  useEffect(() => { window.scrollTo(0, 0); }, [pg.page]);
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
  return <PostListPage t={t} title={label} sub={`Posts tagged ${label}`} action={header} posts={pg.items} pager={<Pager t={t} page={pg.page} prev={pg.prev} next={pg.next} />} loading={loading} mutedUsers={c.mutedUsers} onOpen={c.goPost} onAuthor={c.goUser} myUsername={c.myUsername} emptyText={`No ${label} posts yet.`} />;
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
  const navigate = useNavigate();
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
  return <PostPage post={post} t={c.t} onBack={c.goHome} onAuthor={c.goUser} isMod={c.myIsMod} onCommentAdded={load} onRemoved={() => { c.goHome(); c.loadFeed(); }} myUsername={c.myUsername} onCircle={(slug: string) => navigate(`/c/${slug}`)} />;
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

// ----- Circles (MILESTONES §9 Phase 1: public sub-communities) -----
// slug preview from a typed name: "Shuri Fan Art!" -> "shuri-fan-art"
function slugifyCircle(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

function CreateCircleModal({ t, onClose, onCreated }: any) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finalSlug = slugTouched ? slug : slugifyCircle(name);

  const submit = async () => {
    if (!name.trim()) { setError("Give your circle a name."); return; }
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(finalSlug)) { setError("Slug must be 1-40 chars: lowercase letters, numbers, dashes."); return; }
    setBusy(true); setError(null);
    try {
      await createCircle({ slug: finalSlug, name: name.trim(), description: description.trim() });
      onCreated?.(finalSlug);
      onClose();
    } catch (e: any) {
      const msg = (e && e.message) || "Couldn't create the circle.";
      setError(/duplicate|unique/i.test(msg) ? `c/${finalSlug} is taken — pick another slug.` : msg);
    } finally { setBusy(false); }
  };

  const fieldStyle: React.CSSProperties = { width: "100%", background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", color: t.text, marginBottom: 10, boxSizing: "border-box" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 16, width: 440, maxWidth: "100%", padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ color: t.text, margin: 0, fontSize: 18, fontWeight: 800 }}>Create a circle</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: t.muted, cursor: "pointer" }}><X size={20} /></button>
        </div>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name (e.g. Shuri Fan Art)" maxLength={60} style={fieldStyle} />
        <input value={finalSlug} onChange={(e) => { setSlugTouched(true); setSlug(slugifyCircle(e.target.value) || e.target.value.toLowerCase()); }} placeholder="slug" maxLength={40} style={{ ...fieldStyle, fontFamily: "monospace", fontSize: 13 }} />
        <div style={{ color: t.muted, fontSize: 12, marginTop: -4, marginBottom: 10 }}>Lives at c/{finalSlug || "…"}</div>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this circle about? (optional)" rows={3} maxLength={500}
          style={{ ...fieldStyle, resize: "vertical", fontFamily: "inherit", fontSize: 14 }} />
        {error && <div style={{ color: t.error, fontSize: 13, marginTop: 4 }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{ background: "transparent", color: t.text, border: `1px solid ${t.border}`, borderRadius: 999, padding: "8px 18px", cursor: "pointer", fontWeight: 700 }}>Cancel</button>
          <button onClick={submit} disabled={busy} style={{ background: t.accent, color: t.accentText, border: "none", borderRadius: 999, padding: "8px 22px", cursor: "pointer", fontWeight: 800, opacity: busy ? 0.6 : 1 }}>{busy ? "Creating…" : "Create"}</button>
        </div>
      </div>
    </div>
  );
}

// ----- Commission board (MILESTONES §9) -----
// Two independent lists — artists advertising open slots, and members posting
// requests. No in-app messaging/matching: contact happens via the listing's
// link or DMs, same as the rest of the prototype.
function CommissionFormModal({ t, kind, onClose, onCreated }: any) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceInfo, setPriceInfo] = useState("");
  const [contactUrl, setContactUrl] = useState("");
  const [slotsTotal, setSlotsTotal] = useState(1);
  const [budget, setBudget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) { setError("Give it a title."); return; }
    if (kind === "listing" && contactUrl.trim() && !/^https:\/\//i.test(contactUrl.trim())) { setError("Links must start with https://"); return; }
    setBusy(true); setError(null);
    try {
      if (kind === "listing") {
        await createCommissionListing({ title: title.trim(), description: description.trim(), priceInfo: priceInfo.trim(), contactUrl: contactUrl.trim(), slotsTotal });
      } else {
        await createCommissionRequest({ title: title.trim(), description: description.trim(), budget: budget.trim() });
      }
      onCreated?.();
      onClose();
    } catch (e: any) {
      setError((e && e.message) || "Couldn't post that.");
    } finally { setBusy(false); }
  };

  const fieldStyle: React.CSSProperties = { width: "100%", background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", color: t.text, marginBottom: 10, boxSizing: "border-box" };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 16, width: 480, maxWidth: "100%", maxHeight: "85vh", overflow: "auto", padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ color: t.text, margin: 0, fontSize: 18, fontWeight: 800 }}>{kind === "listing" ? "New commission listing" : "New commission request"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", color: t.muted, cursor: "pointer" }}><X size={20} /></button>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" maxLength={80} style={fieldStyle} />
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description (optional)" rows={4} maxLength={2000}
          style={{ ...fieldStyle, resize: "vertical", fontFamily: "inherit", fontSize: 14 }} />
        {kind === "listing" ? (
          <>
            <input value={priceInfo} onChange={(e) => setPriceInfo(e.target.value)} placeholder="Price info (e.g. busts from $25)" maxLength={200} style={fieldStyle} />
            <input value={contactUrl} onChange={(e) => setContactUrl(e.target.value)} placeholder="Commission info link (Ko-fi, form, optional)" maxLength={300} style={fieldStyle} />
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <label style={{ color: t.muted, fontSize: 12, fontWeight: 700 }}>Slots open</label>
              <input type="number" min={1} max={50} value={slotsTotal}
                onChange={(e) => setSlotsTotal(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
                style={{ width: 70, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 8, padding: "6px 10px", color: t.text, boxSizing: "border-box" }} />
            </div>
          </>
        ) : (
          <input value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="Budget (optional, e.g. $50-100)" maxLength={100} style={fieldStyle} />
        )}
        {error && <div style={{ color: t.error, fontSize: 13, marginTop: 4 }}>{error}</div>}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{ background: "transparent", color: t.text, border: `1px solid ${t.border}`, borderRadius: 999, padding: "8px 18px", cursor: "pointer", fontWeight: 700 }}>Cancel</button>
          <button onClick={submit} disabled={busy} style={{ background: t.accent, color: t.accentText, border: "none", borderRadius: 999, padding: "8px 22px", cursor: "pointer", fontWeight: 800, opacity: busy ? 0.6 : 1 }}>{busy ? "Posting…" : "Post"}</button>
        </div>
      </div>
    </div>
  );
}

function CircleJoinButton({ t, circle, onChanged }: any) {
  const [busy, setBusy] = useState(false);
  const toggle = () => {
    setBusy(true);
    (circle.joined ? leaveCircle(circle.id) : joinCircle(circle.id))
      .then(onChanged)
      .catch((e) => console.error("circle join toggle failed", e))
      .finally(() => setBusy(false));
  };
  return (
    <button onClick={toggle} disabled={busy} style={relBtn(t, circle.joined)}>
      {circle.joined ? <UserMinus size={15} /> : <UserPlus size={15} />} {circle.joined ? "Joined" : "Join"}
    </button>
  );
}

function CirclesRoute() {
  const c: any = useOutletContext();
  const t = c.t;
  const navigate = useNavigate();
  const [circles, setCircles] = useState<UiCircle[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = () => {
    listCircles().then(setCircles).catch((e) => console.error("circles load failed", e)).finally(() => setLoading(false));
  };
  useEffect(() => { window.scrollTo(0, 0); load(); }, []);
  useEffect(() => { setPageMeta({ title: `Circles — ${community.name}`, description: `Sub-communities on ${community.name}.`, url: "/circles", type: "website" }); }, []);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 16px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, padding: "20px 0 12px" }}>
        <div>
          <h1 style={{ color: t.heading, fontSize: 24, fontWeight: 800, margin: 0 }}>Circles</h1>
          <div style={{ color: t.muted, fontSize: 13, marginTop: 4 }}>Smaller spaces inside {community.name} — join the ones that fit.</div>
        </div>
        <button onClick={() => setShowCreate(true)} style={{ ...relBtn(t), background: t.accent, color: t.accentText, border: "none" }}><Plus size={14} /> Create a circle</button>
      </div>
      {loading ? (
        <div style={{ color: t.muted, fontSize: 14, padding: "24px 0" }}>Loading…</div>
      ) : circles.length === 0 ? (
        <div style={{ color: t.muted, fontSize: 14, padding: "24px 0" }}>No circles yet — create the first one.</div>
      ) : (
        circles.map((ci) => (
          <div key={ci.id} style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, marginBottom: 12, display: "flex", alignItems: "flex-start", gap: 12 }}>
            <Avatar seed={ci.name} size={40} t={t} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span onClick={() => navigate(`/c/${ci.slug}`)} style={{ color: t.text, fontSize: 16, fontWeight: 800, cursor: "pointer" }}>{ci.name}</span>
                <span style={{ color: t.muted, fontSize: 12 }}>c/{ci.slug}</span>
                <span style={{ color: t.muted, fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}><Users size={12} /> {ci.members}</span>
              </div>
              {ci.description && <div style={{ color: t.muted, fontSize: 13, marginTop: 4, lineHeight: 1.5 }}>{ci.description}</div>}
            </div>
            <CircleJoinButton t={t} circle={ci} onChanged={load} />
          </div>
        ))
      )}
      {showCreate && <CreateCircleModal t={t} onClose={() => setShowCreate(false)} onCreated={(slug: string) => navigate(`/c/${slug}`)} />}
    </div>
  );
}

function CommissionStatusPill({ status, t }: any) {
  const map: Record<string, { bg: string; fg: string; label: string }> = {
    open: { bg: "rgba(63,145,66,.15)", fg: "#3f9142", label: "Open" },
    waitlist: { bg: "rgba(201,154,46,.16)", fg: "#c99a2e", label: "Waitlist" },
    closed: { bg: "rgba(130,130,130,.18)", fg: t.muted, label: "Closed" },
    fulfilled: { bg: "rgba(63,145,66,.15)", fg: "#3f9142", label: "Fulfilled" },
  };
  const s = map[status] ?? map.closed;
  return <span style={{ background: s.bg, color: s.fg, borderRadius: 999, padding: "2px 10px", fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.3 }}>{s.label}</span>;
}

function CommissionListingCard({ listing, t, mine, isMod, onChanged, goUser }: any) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const setStatus = (status: string) => {
    setBusy(true);
    updateCommissionListing(listing.id, { status: status as any }).then(onChanged).catch((e) => console.error("listing update failed", e)).finally(() => setBusy(false));
  };
  const bumpSlots = (delta: number) => {
    const next = Math.max(0, Math.min(listing.slotsTotal, listing.slotsFilled + delta));
    if (next === listing.slotsFilled) return;
    setBusy(true);
    updateCommissionListing(listing.id, { slotsFilled: next }).then(onChanged).catch((e) => console.error("listing update failed", e)).finally(() => setBusy(false));
  };
  const remove = () => {
    setBusy(true);
    deleteCommissionListing(listing.id).then(onChanged).catch((e) => { console.error("listing delete failed", e); setBusy(false); });
  };

  return (
    <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        <span onClick={() => goUser(listing.artist)} style={{ color: t.heading, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>{listing.artistDisplay}</span>
        <CommissionStatusPill status={listing.status} t={t} />
        <span style={{ color: t.muted, fontSize: 12, marginLeft: "auto" }}>{timeAgo(listing.createdAt)}</span>
      </div>
      <div style={{ color: t.text, fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{listing.title}</div>
      <div style={{ color: t.muted, fontSize: 13, marginBottom: 6 }}>{listing.slotsFilled} of {listing.slotsTotal} slots filled</div>
      {listing.description && <div style={{ color: t.text, fontSize: 14, lineHeight: 1.5, marginBottom: 8, whiteSpace: "pre-wrap" }}>{listing.description}</div>}
      {listing.priceInfo && <div style={{ color: t.muted, fontSize: 13, marginBottom: 6 }}>{listing.priceInfo}</div>}
      {listing.contactUrl && /^https:\/\//i.test(listing.contactUrl) && (
        <a href={listing.contactUrl} target="_blank" rel="noopener noreferrer" style={{ color: t.link, fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 4, textDecoration: "none" }}>
          Commission info <ExternalLink size={13} />
        </a>
      )}
      {(mine || isMod) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border}`, flexWrap: "wrap" }}>
          {mine && (
            <>
              <select value={listing.status} disabled={busy} onChange={(e) => setStatus(e.target.value)}
                style={{ background: t.bg, color: t.text, border: `1px solid ${t.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
                <option value="open">Open</option>
                <option value="waitlist">Waitlist</option>
                <option value="closed">Closed</option>
              </select>
              <button onClick={() => bumpSlots(-1)} disabled={busy || listing.slotsFilled <= 0} style={{ ...relBtn(t), padding: "5px 10px", fontSize: 12 }} title="One fewer slot filled"><ArrowDown size={13} /></button>
              <button onClick={() => bumpSlots(1)} disabled={busy || listing.slotsFilled >= listing.slotsTotal} style={{ ...relBtn(t), padding: "5px 10px", fontSize: 12 }} title="One more slot filled"><ArrowUp size={13} /></button>
            </>
          )}
          <button onClick={() => setConfirming(true)} disabled={busy} style={{ ...relBtn(t), padding: "5px 12px", fontSize: 12, color: t.error, marginLeft: mine ? 0 : "auto" }}>{mine ? "Delete" : "Remove"}</button>
        </div>
      )}
      {confirming && <ConfirmDialog t={t} title={mine ? "Delete this listing?" : "Remove this listing?"} message="This can't be undone." onConfirm={remove} onClose={() => setConfirming(false)} busy={busy} />}
    </div>
  );
}

function CircleRoute() {
  const c: any = useOutletContext();
  const t = c.t;
  const { slug } = useParams();
  const [circle, setCircle] = useState<UiCircle | null>(null);
  const [posts, setPosts] = useState<UiPost[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    fetchCircle(slug as string)
      .then(async (ci) => {
        setCircle(ci);
        setPosts(ci ? await fetchCircleFeed(ci.id) : []);
      })
      .catch((e) => console.error("circle load failed", e))
      .finally(() => setLoading(false));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { window.scrollTo(0, 0); setCircle(null); load(); }, [slug]);
  useEffect(() => {
    if (circle) setPageMeta({ title: `${circle.name} — ${community.name}`, description: circle.description || `The ${circle.name} circle on ${community.name}.`, url: `/c/${circle.slug}`, type: "website" });
  }, [circle]);

  if (!loading && !circle) return <div style={{ maxWidth: 760, margin: "0 auto", padding: "40px 16px", color: t.muted, fontSize: 14 }}>This circle doesn't exist.</div>;

  const action = circle && (
    <div style={{ display: "flex", gap: 8 }}>
      <CircleJoinButton t={t} circle={circle} onChanged={load} />
      <button onClick={() => c.openCreate(circle.id, load)} style={{ ...relBtn(t), background: t.accent, color: t.accentText, border: "none" }}><Plus size={14} /> New post</button>
    </div>
  );
  return <PostListPage t={t} title={circle?.name ?? "…"} sub={circle ? `c/${circle.slug} · ${circle.members} member${circle.members === 1 ? "" : "s"}${circle.description ? ` — ${circle.description}` : ""}` : null}
    action={action} posts={posts} loading={loading} mutedUsers={c.mutedUsers} onOpen={c.goPost} onAuthor={c.goUser} myUsername={c.myUsername} emptyText="No posts in this circle yet — start it off." />;
}

function CommissionRequestCard({ request, t, mine, isMod, onChanged, goUser }: any) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const setStatus = (status: string) => {
    setBusy(true);
    updateCommissionRequest(request.id, { status: status as any }).then(onChanged).catch((e) => console.error("request update failed", e)).finally(() => setBusy(false));
  };
  const remove = () => {
    setBusy(true);
    deleteCommissionRequest(request.id).then(onChanged).catch((e) => { console.error("request delete failed", e); setBusy(false); });
  };

  return (
    <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        <span onClick={() => goUser(request.requester)} style={{ color: t.heading, cursor: "pointer", fontWeight: 700, fontSize: 13 }}>{request.requesterDisplay}</span>
        <CommissionStatusPill status={request.status} t={t} />
        <span style={{ color: t.muted, fontSize: 12, marginLeft: "auto" }}>{timeAgo(request.createdAt)}</span>
      </div>
      <div style={{ color: t.text, fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{request.title}</div>
      {request.budget && <div style={{ color: t.muted, fontSize: 13, marginBottom: 6 }}>Budget: {request.budget}</div>}
      {request.description && <div style={{ color: t.text, fontSize: 14, lineHeight: 1.5, marginBottom: 8, whiteSpace: "pre-wrap" }}>{request.description}</div>}
      {(mine || isMod) && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12, paddingTop: 12, borderTop: `1px solid ${t.border}`, flexWrap: "wrap" }}>
          {mine && (
            <select value={request.status} disabled={busy} onChange={(e) => setStatus(e.target.value)}
              style={{ background: t.bg, color: t.text, border: `1px solid ${t.border}`, borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
              <option value="open">Open</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="closed">Closed</option>
            </select>
          )}
          <button onClick={() => setConfirming(true)} disabled={busy} style={{ ...relBtn(t), padding: "5px 12px", fontSize: 12, color: t.error, marginLeft: mine ? 0 : "auto" }}>{mine ? "Delete" : "Remove"}</button>
        </div>
      )}
      {confirming && <ConfirmDialog t={t} title={mine ? "Delete this request?" : "Remove this request?"} message="This can't be undone." onConfirm={remove} onClose={() => setConfirming(false)} busy={busy} />}
    </div>
  );
}

function CommissionsPage({ t, myUsername, myIsMod, goUser }: any) {
  const [tab, setTab] = useState<"listings" | "requests">("listings");
  const [listings, setListings] = useState<UiCommissionListing[]>([]);
  const [requests, setRequests] = useState<UiCommissionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    setLoading(true);
    Promise.all([listCommissionListings(), listCommissionRequests()])
      .then(([l, r]) => { setListings(l); setRequests(r); })
      .catch((e) => console.error("commission board load failed", e))
      .finally(() => setLoading(false));
  };
  useEffect(() => { window.scrollTo(0, 0); load(); }, []);

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "0 16px 24px" }}>
      <div style={{ padding: "20px 0 4px" }}>
        <h1 style={{ color: t.heading, fontSize: 24, fontWeight: 800, margin: 0 }}>Commission Board</h1>
        <div style={{ color: t.muted, fontSize: 13, marginTop: 4 }}>Artists advertise open slots; members post what they're looking for.</div>
      </div>
      <div style={{ border: `1px solid ${t.border}`, background: t.panel2, borderRadius: 12, padding: "12px 16px", margin: "12px 0", color: t.muted, fontSize: 13, lineHeight: 1.6 }}>
        <div style={{ color: t.text, fontWeight: 800, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}><Shield size={14} /> Community guidelines</div>
        Agree on price and scope up front · Payment is handled off-site between you · No harassment over turnaround times · Mods may remove listings or requests that break the rules.
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0", flexWrap: "wrap" }}>
        <button onClick={() => setTab("listings")} style={relBtn(t, tab === "listings")}>Artists open</button>
        <button onClick={() => setTab("requests")} style={relBtn(t, tab === "requests")}>Requests</button>
        {myUsername && (
          <button onClick={() => setShowForm(true)} style={{ ...relBtn(t), marginLeft: "auto", background: t.accent, color: t.accentText, border: "none" }}>
            <Plus size={14} /> {tab === "listings" ? "New listing" : "New request"}
          </button>
        )}
      </div>
      {loading ? (
        <div style={{ color: t.muted, fontSize: 14, padding: "24px 0" }}>Loading…</div>
      ) : tab === "listings" ? (
        listings.length === 0 ? (
          <div style={{ color: t.muted, fontSize: 14, padding: "24px 0" }}>No open commissions yet — be the first artist to post your slots.</div>
        ) : listings.map((l) => <CommissionListingCard key={l.id} listing={l} t={t} mine={l.artist === myUsername} isMod={myIsMod} onChanged={load} goUser={goUser} />)
      ) : requests.length === 0 ? (
        <div style={{ color: t.muted, fontSize: 14, padding: "24px 0" }}>No commission requests yet — post what you're looking for.</div>
      ) : (
        requests.map((r) => <CommissionRequestCard key={r.id} request={r} t={t} mine={r.requester === myUsername} isMod={myIsMod} onChanged={load} goUser={goUser} />)
      )}
      {showForm && <CommissionFormModal t={t} kind={tab === "listings" ? "listing" : "request"} onClose={() => setShowForm(false)} onCreated={load} />}
    </div>
  );
}

function CommissionsRoute() {
  const c: any = useOutletContext();
  useEffect(() => {
    setPageMeta({ title: `Commission Board — ${community.name}`, description: "Artists advertise open commission slots; members post what they're looking for.", url: "/commissions", type: "website" });
  }, []);
  return <CommissionsPage t={c.t} myUsername={c.myUsername} myIsMod={c.myIsMod} goUser={c.goUser} />;
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
  const { session, loading, addingAccount } = useAuth();
  if (loading) return <Splash />;
  // addingAccount keeps a session alive but re-shows the login screen so a
  // second account can sign in (its session replaces the client's, and the
  // previous one is already saved in the roster).
  if (!session || addingAccount) return <LoginScreen />;
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
        <Route path="circles" element={<CirclesRoute />} />
        <Route path="c/:slug" element={<CircleRoute />} />
        <Route path="commissions" element={<CommissionsRoute />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
