import React, { useState, useEffect, useRef } from "react";
import {
  Plus, Bell, BellOff, MoreHorizontal, ArrowUp, ArrowDown, MessageCircle,
  Share2, Search, ChevronDown, ChevronUp, ChevronRight, Pin, Shield, BookOpen,
  Globe, ArrowLeft, Send, X, Image as ImageIcon, Link2, BarChart3, Video,
  FileText, HelpCircle, Megaphone, Lightbulb, MessageSquare, UserPlus,
  UserMinus, VolumeX, Flag, Gift, Star, Eye, Repeat2, LogOut,
} from "lucide-react";
import { Routes, Route, Navigate, Outlet, useNavigate, useLocation, useParams, useOutletContext } from "react-router-dom";
import { useAuth } from "./auth/AuthProvider";
import { LoginScreen } from "./auth/LoginScreen";
import { ResetPasswordPage } from "./auth/ResetPasswordPage";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { fetchCommunityFeed, fetchCommunityStats, fetchPinned, fetchPostWithComments, fetchProfile, getMyVote, castVote, getRelationshipState, setRelationship, fetchHiddenUsernames, getMyProfileId, fetchMyIdentity, createPost, createComment, uploadMedia, updatePost, deletePost, updateComment, deleteComment } from "./lib/api";
import type { UiPost, UiPinned, UiProfile } from "./lib/types";
import { getOrCreateConversation, fetchConversations, fetchMessages, sendMessage, subscribeToMessages } from "./lib/chat";
import type { UiMessage, UiConversation } from "./lib/chat";
import { modSetPinned, modRemovePost, modSetPostFlairs, modAssignMemberFlair } from "./lib/mod";
import { setPageMeta, clip } from "./lib/seo";

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

// ----- Palettes -----
// Community + post pages: black & golden-jaguar.
const gold = {
  bg: "#0B0B0F", panel: "#15141a", panel2: "#1F1E26", border: "#2e2b22",
  text: "#ECE8DF", muted: "#9b9488", heading: "#C8A24A", link: "#57D7E3",
  pill: "#221f18", pillText: "#cdbf9c", orange: "#FF4500", accent: "#C8A24A",
  accentText: "#15110a",
};
// Member page: neutral Reddit-dark (unchanged).
const neutral = {
  bg: "#0b0b0c", panel: "#161617", panel2: "#1d1d1f", border: "#2b2b2d",
  text: "#d7dadc", muted: "#838488", heading: "#d7dadc", link: "#7cb3ff",
  pill: "#272729", pillText: "#b8b9bb", orange: "#ff4500", accent: "#ff4500",
  accentText: "#ffffff",
};

// ----- Community -----
const community = {
  name: "Black Panther Fanworks",
  short: "Black Panther Fanworks",
  blurb:
    "A Wakanda-first community for fanfiction, art, music, cosplay, and discussion rooted in the Black Panther MCU films and comics canon. Source your artwork, flair your posts, and engage in good faith. Wakanda Forever.",
  created: "Jun 27, 2026",
  bookmarks: ["Wiki", "Fanfic Archive", "Weekly Self-Promo Thread"],
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
function Flair({ flairKey }) {
  const f = POST_FLAIRS[flairKey];
  if (!f) return null;
  return <span style={{ background: f.bg, color: f.fg, borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 700 }}>{f.label}</span>;
}

function Avatar({ seed, size = 36, t }) {
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
function MediaBlock({ post, t }: any) {
  const [revealed, setRevealed] = useState(false);
  const nsfw = post.flairs?.includes("nsfw");
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
        ? <video key={i} src={u} controls muted style={{ maxHeight: 340, maxWidth: "100%", borderRadius: 12, border: `1px solid ${t.border}` }} />
        : <img key={i} src={u} alt="" style={{ maxHeight: 340, maxWidth: "100%", borderRadius: 12, border: `1px solid ${t.border}`, objectFit: "cover" }} />)}
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
      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 6 }}>
        {onCancel && <button onClick={onCancel} style={{ background: "transparent", color: t.muted, border: `1px solid ${t.border}`, borderRadius: 999, padding: "6px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Cancel</button>}
        <button onClick={submit} disabled={busy || !val.trim()} style={{ background: t.accent, color: t.accentText, border: "none", borderRadius: 999, padding: "6px 16px", cursor: "pointer", fontSize: 13, fontWeight: 800, opacity: busy || !val.trim() ? 0.6 : 1 }}>{busy ? "Posting…" : "Comment"}</button>
      </div>
    </div>
  );
}

// ----- Comments -----
function Comment({ c, t, depth = 0, postId, onAdded, myUsername }: any) {
  const [collapsed, setCollapsed] = useState(false);
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(c.body);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const mine = !!myUsername && c.author === myUsername;

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

  return (
    <div style={{ marginTop: 14, paddingLeft: depth ? 16 : 0, borderLeft: depth ? `2px solid ${t.border}` : "none", marginLeft: depth ? 6 : 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => setCollapsed(!collapsed)} style={{ background: "none", border: "none", color: t.muted, cursor: "pointer", display: "flex" }}>
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </button>
        <Avatar seed={c.author} size={22} t={t} />
        <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{c.author}</span>
        {c.flair && <span style={{ background: t.link, color: t.bg, fontSize: 10, fontWeight: 800, padding: "1px 6px", borderRadius: 4 }}>{c.flair}</span>}
        <span style={{ fontSize: 12, color: t.muted }}>· {c.when}</span>
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
            <p style={{ fontSize: 14, color: c.deleted ? t.muted : t.text, fontStyle: c.deleted ? "italic" : "normal", whiteSpace: "pre-wrap", margin: "6px 0", lineHeight: 1.55 }}>{c.body}</p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 16, color: t.muted, fontSize: 12, fontWeight: 600 }}>
            <Vote votes={c.votes} t={t} targetType="comment" targetId={c.id} />
            <span onClick={() => setReplying(!replying)} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}><MessageCircle size={14} /> Reply</span>
            {mine && <span onClick={() => setEditing(!editing)} style={{ cursor: "pointer" }}>Edit</span>}
            {mine && <span onClick={() => setConfirming(true)} style={{ cursor: busy ? "default" : "pointer", color: "#e0726b", opacity: busy ? 0.6 : 1 }}>Delete</span>}
            <span style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}><Gift size={14} /> Award</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}><Share2 size={14} /> Share</span>
          </div>
          {replying && <CommentComposer t={t} postId={postId} parentId={c.id} placeholder={`Reply to ${c.author}…`} onAdded={onAdded} onCancel={() => setReplying(false)} />}
          {c.replies?.map((r) => <Comment key={r.id} c={r} t={t} depth={depth + 1} postId={postId} onAdded={onAdded} myUsername={myUsername} />)}
        </div>
      )}
      {confirming && <ConfirmDialog t={t} title="Delete comment?" message="Your comment will show as “[deleted]”. Replies to it stay." onConfirm={remove} onClose={() => setConfirming(false)} busy={busy} />}
    </div>
  );
}

// ----- Post card -----
function PostCard({ post, t, onOpen, onAuthor, muted, showMeta, myUsername, onChanged }: any) {
  const [followed, setFollowed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const mine = !!myUsername && post.author === myUsername;

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
      <span onClick={() => onAuthor(post.author)} style={{ color: t.heading, cursor: "pointer", fontStyle: "normal", fontWeight: 700 }}>{post.author}</span>. Open their profile to unmute.
    </div>;
  }
  return (
    <div style={{ borderBottom: `1px solid ${t.border}`, padding: "16px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }} onClick={() => onOpen(post)}>
        <Avatar seed={post.author} size={26} t={t} />
        <span onClick={(e) => { e.stopPropagation(); onAuthor(post.author); }} style={{ fontSize: 13, fontWeight: 700, color: t.heading }}>{post.author}</span>
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
        <p style={{ fontSize: 14, color: t.muted, margin: "0 0 10px", lineHeight: 1.5 }}>{post.body}</p>
        {post.links?.map((l, i) => <div key={i} style={{ fontSize: 14, color: t.link, textDecoration: "underline", marginBottom: 4 }}>{i + 1}. {l}</div>)}
        <MediaBlock post={post} t={t} />
      </div>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
        <Vote votes={post.votes} t={t} targetType="post" targetId={post.id} />
        <ActionPill icon={<MessageCircle size={15} />} label={post.commentCount ?? post.comments?.length ?? 0} t={t} onClick={() => onOpen(post)} />
        <ActionPill icon={followed ? <BellOff size={15} /> : <Bell size={15} />} label={followed ? "Following" : "Follow"} t={t} onClick={() => setFollowed(!followed)} />
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
  const [stats, setStats] = useState<{ members: number; contributions: number } | null>(null);
  useEffect(() => { fetchCommunityStats().then(setStats).catch((e) => console.error("stats load failed", e)); }, []);
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
      {community.bookmarks.map((b) => <div key={b} style={{ background: t.panel2, borderRadius: 999, padding: "9px 0", textAlign: "center", color: t.text, fontSize: 13, fontWeight: 700, marginBottom: 8, cursor: "pointer" }}>{b}</div>)}
      <div style={{ color: t.heading, fontSize: 12, fontWeight: 800, letterSpacing: 0.5, margin: "16px 0 4px" }}>BLACK PANTHER FANWORKS RULES</div>
      {community.rules.map((r, i) => <Rule key={i} rule={r} index={i} t={t} last={i === community.rules.length - 1} />)}
    </div>
  );
}

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleFlair = (k: string) => setFlairs((prev) => prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]);
  const isMedia = sel === "image" || sel === "video";

  const submit = async () => {
    if (!title.trim()) { setError("Give your post a title."); return; }
    setBusy(true); setError(null);
    try {
      let media: string[] = [];
      if (files.length) media = await uploadMedia(files);
      await createPost({ type: sel, title: title.trim(), body: body.trim(), flairSlugs: flairs, media });
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
            return <span key={k} onClick={() => toggleFlair(k)} style={{ cursor: "pointer", outline: on ? `2px solid ${t.accent}` : "none", borderRadius: 5, opacity: on ? 1 : 0.55 }}><Flair flairKey={k} /></span>;
          })}
        </div>
        {isMedia && (
          <div style={{ marginBottom: 12 }}>
            <input type="file" accept={sel === "video" ? "video/*" : "image/*"} multiple={sel === "image"}
              onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 20))}
              style={{ color: t.text, fontSize: 13 }} />
            {files.length > 0 && <div style={{ color: t.muted, fontSize: 12, marginTop: 4 }}>{files.length} file{files.length > 1 ? "s" : ""} selected</div>}
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
function LandingPage({ t, onOpen, onAuthor, mutedUsers, posts, pinned, loading, myUsername, onChanged }: any) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, maxWidth: 1100, margin: "0 auto", padding: "0 16px" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 0" }}>
          <img src="/bpf-home.png" alt={community.name}
            style={{ width: 72, height: 72, borderRadius: "50%", border: `2px solid ${t.accent}`, objectFit: "cover", flexShrink: 0, display: "block" }} />
          <h1 style={{ color: t.heading, fontSize: 34, fontWeight: 800, margin: 0, letterSpacing: 0.3 }}>{community.name}</h1>
        </div>
        {pinned.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 8, color: t.heading, fontSize: 14, fontWeight: 700, padding: "8px 0" }}><Pin size={15} /> Community highlights</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 8 }}>
              {pinned.map((p) => (
                <div key={p.id} onClick={() => onOpen(p)} style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 12, padding: 14, cursor: "pointer" }}>
                  <div style={{ color: t.text, fontWeight: 700, fontSize: 14, marginBottom: 24 }}>{p.title}</div>
                  <div style={{ color: t.muted, fontSize: 12 }}>{p.votes} votes · {p.comments} comments</div>
                </div>
              ))}
            </div>
          </>
        )}
        {loading ? (
          <div style={{ color: t.muted, fontSize: 14, padding: "24px 0" }}>Loading posts…</div>
        ) : posts.length === 0 ? (
          <div style={{ color: t.muted, fontSize: 14, padding: "24px 0" }}>No posts yet. Be the first to post!</div>
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
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const run = async (fn: any) => { setBusy(true); try { await fn(); } catch (e) { console.error("mod action failed", e); } finally { setBusy(false); } };
  const toggle = (k: string) => setSel((p) => p.includes(k) ? p.filter((x) => x !== k) : [...p, k]);
  return (
    <div style={{ border: `1px solid ${t.border}`, borderRadius: 10, padding: 10, margin: "12px 0", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 4, color: t.heading, fontSize: 12, fontWeight: 800 }}><Shield size={13} /> MOD</span>
      <button onClick={() => run(async () => { await modSetPinned(post.id, !post.pinned); onChanged?.(); })} disabled={busy} style={modBtn(t)}><Pin size={13} /> {post.pinned ? "Unpin" : "Pin"}</button>
      <button onClick={() => setReflair(!reflair)} style={modBtn(t)}>Re-flair</button>
      <button onClick={() => setConfirmingRemove(true)} disabled={busy} style={{ ...modBtn(t), color: "#e0726b" }}>Remove</button>
      {confirmingRemove && (
        <ConfirmDialog t={t} title="Remove post?" message="This removes the post from the community as a moderator action." confirmLabel="Remove" busy={busy}
          onClose={() => setConfirmingRemove(false)}
          onConfirm={() => run(async () => { await modRemovePost(post.id); setConfirmingRemove(false); onRemoved?.(); })} />
      )}
      {reflair && (
        <div style={{ flexBasis: "100%", display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 6 }}>
          {Object.keys(POST_FLAIRS).map((k) => { const on = sel.includes(k); return <span key={k} onClick={() => toggle(k)} style={{ cursor: "pointer", outline: on ? `2px solid ${t.accent}` : "none", borderRadius: 5, opacity: on ? 1 : 0.5 }}><Flair flairKey={k} /></span>; })}
          <button onClick={() => run(async () => { await modSetPostFlairs(post.id, sel); setReflair(false); onChanged?.(); })} disabled={busy} style={{ ...modBtn(t), background: t.accent, color: t.accentText }}>Save flairs</button>
        </div>
      )}
    </div>
  );
}

function PostPage({ post, t, onBack, onAuthor, isMod, onCommentAdded, onRemoved, myUsername }: any) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [body, setBody] = useState(post.body);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const mine = !!myUsername && post.author === myUsername;

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
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, maxWidth: 1100, margin: "0 auto", padding: "0 16px" }}>
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
        <div style={{ color: t.muted, fontSize: 12, marginBottom: 6, cursor: "pointer" }} onClick={() => onAuthor(post.author)}>{post.author}</div>
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
        {post.body && <p style={{ color: t.text, fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{post.body}</p>}
        {post.links?.map((l: string, i: number) => <div key={i} style={{ fontSize: 14, color: t.link, textDecoration: "underline", marginBottom: 4 }}>{i + 1}. {l}</div>)}
        <MediaBlock post={post} t={t} />
        </>
        )}
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0" }}>
          <Vote votes={post.votes} t={t} targetType="post" targetId={post.id} />
          <ActionPill icon={<MessageCircle size={15} />} label={post.commentCount ?? post.comments?.length ?? 0} t={t} />
          <ActionPill icon={<Share2 size={15} />} label="Share" t={t} onClick={() => copyPostLink(post.id)} />
        </div>
        {isMod && <ModBar post={post} t={t} onChanged={onCommentAdded} onRemoved={onRemoved} />}
        <CommentComposer t={t} postId={post.id} onAdded={onCommentAdded} placeholder="Join the conversation…" />
        <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 12, paddingTop: 8 }}>{(post.comments ?? []).map((c: any) => <Comment key={c.id} c={c} t={t} postId={post.id} onAdded={onCommentAdded} myUsername={myUsername} />)}</div>
      </div>
      <div><CommunitySidebar t={t} /></div>
      {confirming && <ConfirmDialog t={t} title="Delete post?" message="This can't be undone." onConfirm={remove} onClose={() => setConfirming(false)} busy={busy} />}
    </div>
  );
}

function MemberPage({ t, profile, loading, isMe, isMod, onOpen, onChat, onRelationshipChange, onProfileChanged, myUsername }: any) {
  const [rel, setRel] = useState({ follow: false, mute: false, block: false });
  const [followerDelta, setFollowerDelta] = useState(0);

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
          <Avatar seed={profile.username} size={64} t={t} />
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
          <div style={{ color: t.muted, fontSize: 13, fontStyle: "italic", marginBottom: 12 }}>This is your profile.</div>
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
  const { user, signOut } = useAuth();

  const [feed, setFeed] = useState<UiPost[]>([]);
  const [pinned, setPinned] = useState<UiPinned[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [myIsMod, setMyIsMod] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const t = location.pathname.startsWith("/user") ? neutral : gold;

  // Resolve the current member's identity (username, mod flag) for the shell.
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    fetchMyIdentity().then((id) => { if (active && id) { setMyUsername(id.username); setMyIsMod(id.isMod); } });
    return () => { active = false; };
  }, [user?.id]);

  // Load the community feed + pinned highlights (callable, so new posts refresh it).
  const loadFeed = async () => {
    try {
      const [f, p] = await Promise.all([fetchCommunityFeed(), fetchPinned()]);
      setFeed(f); setPinned(p);
    } catch (e) { console.error("feed load failed", e); }
    finally { setFeedLoading(false); }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadFeed(); }, []);

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

  // Shared with the routed pages via <Outlet context>.
  const ctx = { t, feed, pinned, feedLoading, mutedUsers, myUsername, myIsMod, goPost, goUser, goHome, openChatWith, refreshHidden, loadFeed };

  return (
    <div style={{ background: t.bg, minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif", color: t.text }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: `1px solid ${t.border}`, position: "sticky", top: 0, background: t.bg, zIndex: 30 }}>
        <button onClick={goHome} style={{ background: "none", border: "none", color: t.heading, fontWeight: 800, fontSize: 17, cursor: "pointer" }}>{community.name}</button>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: t.panel, border: `1px solid ${t.border}`, borderRadius: 999, padding: "7px 14px", maxWidth: 420 }}>
          <Search size={16} color={t.muted} /><input placeholder="Search" style={{ background: "none", border: "none", outline: "none", color: t.text, flex: 1 }} />
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setShowCreate(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: t.panel2, color: t.text, border: `1px solid ${t.border}`, borderRadius: 999, padding: "8px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}><Plus size={16} /> Create Post</button>
          <button onClick={() => { setChatTarget(null); setShowChat(true); }} style={{ background: t.panel2, border: `1px solid ${t.border}`, borderRadius: "50%", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t.text }}><MessageSquare size={18} /></button>
          <button onClick={() => goUser(myUsername)} title={myUsername || user?.email || ""} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><Avatar seed={myUsername || user?.email || "me"} size={34} t={t} /></button>
          <button onClick={signOut} title="Sign out" style={{ background: t.panel2, border: `1px solid ${t.border}`, borderRadius: "50%", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t.text }}><LogOut size={18} /></button>
        </div>
      </div>

      <div style={{ padding: "16px 0 70px" }}>
        <Outlet context={ctx} />
      </div>

      {showCreate && <CreatePostModal t={t} onClose={() => setShowCreate(false)} onCreated={loadFeed} />}
      {showChat && <ChatDrawer t={t} target={chatTarget} onClose={() => setShowChat(false)} />}
    </div>
  );
}

// ----- Routed pages (read URL params, load their own data) -----
function LandingRoute() {
  const c: any = useOutletContext();
  useEffect(() => { setPageMeta({ title: `${community.name} — Wakanda-first fan community`, description: clip(community.blurb), url: "/", type: "website" }); }, []);
  return <LandingPage t={c.t} posts={c.feed} pinned={c.pinned} loading={c.feedLoading} mutedUsers={c.mutedUsers} onOpen={c.goPost} onAuthor={c.goUser} myUsername={c.myUsername} onChanged={c.loadFeed} />;
}

function PostRoute() {
  const c: any = useOutletContext();
  const { id } = useParams();
  const [post, setPost] = useState<UiPost | null>(null);
  const load = async () => { try { setPost(await fetchPostWithComments(id as string)); } catch (e) { console.error("post load failed", e); } };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { window.scrollTo(0, 0); setPost(null); load(); }, [id]);
  useEffect(() => {
    if (!post) return;
    const cover = (post.media || []).find((m) => typeof m === "string" && m.startsWith("http"));
    setPageMeta({ title: `${post.title} — ${community.name}`, description: clip(post.body) || community.blurb, image: cover, url: `/post/${post.id}`, type: "article" });
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
  useEffect(() => { window.scrollTo(0, 0); load(); }, [username]);
  useEffect(() => {
    if (!profile) return;
    setPageMeta({ title: `${profile.display} (@${profile.username}) — ${community.name}`, description: clip(profile.banner) || `${profile.display} on ${community.name}.`, url: `/user/${profile.username}`, type: "profile" });
  }, [profile]);
  return <MemberPage t={c.t} profile={profile} loading={loading} isMe={!!profile && profile.username === c.myUsername} isMod={c.myIsMod} onOpen={c.goPost} onChat={c.openChatWith} onRelationshipChange={c.refreshHidden} onProfileChanged={load} myUsername={c.myUsername} />;
}

// ----- Auth gate + route table -----
const centered: React.CSSProperties = { minHeight: "100vh", background: "#0B0B0F", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, fontFamily: "Inter, system-ui, sans-serif" };

function Splash() {
  return <div style={centered}><div style={{ color: "#9b9488", fontSize: 14 }}>Loading…</div></div>;
}

function SetupNotice() {
  const code = { background: "#1F1E26", borderRadius: 4, padding: "1px 6px", fontSize: 13, color: "#C8A24A" } as const;
  return (
    <div style={centered}>
      <div style={{ maxWidth: 460, background: "#15141a", border: "1px solid #2e2b22", borderRadius: 16, padding: 24, color: "#ECE8DF" }}>
        <h1 style={{ color: "#C8A24A", fontSize: 20, margin: "0 0 12px" }}>Almost there</h1>
        <p style={{ color: "#9b9488", fontSize: 14, lineHeight: 1.6, margin: 0 }}>
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
