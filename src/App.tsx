import React, { useState, useEffect } from "react";
import {
  Plus, Bell, BellOff, MoreHorizontal, ArrowUp, ArrowDown, MessageCircle,
  Share2, Search, ChevronDown, ChevronUp, ChevronRight, Pin, Shield, BookOpen,
  Globe, ArrowLeft, Send, X, Image as ImageIcon, Link2, BarChart3, Video,
  FileText, HelpCircle, Megaphone, Lightbulb, MessageSquare, UserPlus,
  UserMinus, VolumeX, Flag, Gift, Star, Eye, Repeat2, Rocket, LogOut,
} from "lucide-react";
import { useAuth } from "./auth/AuthProvider";
import { supabase } from "./lib/supabase";
import { fetchCommunityFeed, fetchPinned, fetchPostWithComments, fetchProfile, getMyVote, castVote } from "./lib/api";

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
  created: "Feb 16, 2018",
  visitors: "45K",
  contributions: "1.2K",
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

function ActionPill({ icon, label, t, onClick }) {
  return <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, background: t.pill, color: t.muted,
    border: "none", borderRadius: 999, padding: "6px 12px", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>{icon}{label}</button>;
}

// ----- Comments -----
function Comment({ c, t, depth = 0 }) {
  const [collapsed, setCollapsed] = useState(false);
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
          <p style={{ fontSize: 14, color: t.text, whiteSpace: "pre-wrap", margin: "6px 0", lineHeight: 1.55 }}>{c.body}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 16, color: t.muted, fontSize: 12, fontWeight: 600 }}>
            <Vote votes={c.votes} t={t} targetType="comment" targetId={c.id} />
            <span style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}><MessageCircle size={14} /> Reply</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}><Gift size={14} /> Award</span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}><Share2 size={14} /> Share</span>
          </div>
          {c.replies?.map((r) => <Comment key={r.id} c={r} t={t} depth={depth + 1} />)}
        </div>
      )}
    </div>
  );
}

// ----- Post card -----
function PostCard({ post, t, onOpen, onAuthor, muted, showMeta }) {
  const [followed, setFollowed] = useState(false);
  if (muted) {
    return <div style={{ borderBottom: `1px solid ${t.border}`, padding: "14px 0", color: t.muted, fontSize: 13, fontStyle: "italic" }}>
      Post hidden — you muted {post.author}.
    </div>;
  }
  return (
    <div style={{ borderBottom: `1px solid ${t.border}`, padding: "16px 0" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, cursor: "pointer" }} onClick={() => onOpen(post)}>
        <Avatar seed={post.author} size={26} t={t} />
        <span onClick={(e) => { e.stopPropagation(); onAuthor(post.author); }} style={{ fontSize: 13, fontWeight: 700, color: t.heading }}>{post.author}</span>
        <span style={{ fontSize: 12, color: t.muted }}>· {post.when}</span>
        {post.pinned && <Pin size={13} color={t.accent} />}
        <MoreHorizontal size={16} color={t.muted} style={{ marginLeft: "auto" }} />
      </div>
      <div style={{ cursor: "pointer" }} onClick={() => onOpen(post)}>
        <h3 style={{ fontSize: 19, fontWeight: 700, color: t.text, margin: "0 0 8px" }}>{post.title}</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }}>{post.flairs?.map((f) => <Flair key={f} flairKey={f} />)}</div>
        <p style={{ fontSize: 14, color: t.muted, margin: "0 0 10px", lineHeight: 1.5 }}>{post.body}</p>
        {post.links?.map((l, i) => <div key={i} style={{ fontSize: 14, color: t.link, textDecoration: "underline", marginBottom: 4 }}>{i + 1}. {l}</div>)}
        {post.image && (
          <div style={{ height: 220, borderRadius: 12, marginTop: 8, background: "linear-gradient(135deg,#241f12,#0e0c08)", border: `1px solid ${t.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: t.muted }}>
            <ImageIcon size={28} />
          </div>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
        <Vote votes={post.votes} t={t} targetType="post" targetId={post.id} />
        <ActionPill icon={<MessageCircle size={15} />} label={post.commentCount ?? post.comments?.length ?? 0} t={t} onClick={() => onOpen(post)} />
        <ActionPill icon={followed ? <BellOff size={15} /> : <Bell size={15} />} label={followed ? "Following" : "Follow"} t={t} onClick={() => setFollowed(!followed)} />
        <ActionPill icon={<Share2 size={15} />} label="Share" t={t} />
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
            <span style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", marginLeft: "auto" }}><Rocket size={15} /> Promote</span>
          </div>
        </>
      )}
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
        <div><div style={{ color: t.text, fontWeight: 800, fontSize: 16 }}>{community.visitors}</div><div style={{ color: t.muted, fontSize: 12 }}>Weekly visitors</div></div>
        <div><div style={{ color: t.text, fontWeight: 800, fontSize: 16 }}>{community.contributions}</div><div style={{ color: t.muted, fontSize: 12 }}>Weekly contributions</div></div>
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

function CreatePostModal({ t, onClose }) {
  const [sel, setSel] = useState("text");
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
        <input placeholder="Title" style={{ width: "100%", background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", color: t.text, marginBottom: 10, boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>{Object.keys(POST_FLAIRS).map((k) => <Flair key={k} flairKey={k} />)}</div>
        <textarea placeholder="Body text (rich text in the real build)" rows={4} style={{ width: "100%", background: t.bg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "10px 12px", color: t.text, boxSizing: "border-box", resize: "vertical" }} />
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 16 }}>
          <button onClick={onClose} style={{ background: "transparent", color: t.text, border: `1px solid ${t.border}`, borderRadius: 999, padding: "8px 18px", cursor: "pointer", fontWeight: 700 }}>Cancel</button>
          <button onClick={onClose} style={{ background: t.accent, color: t.accentText, border: "none", borderRadius: 999, padding: "8px 22px", cursor: "pointer", fontWeight: 800 }}>Post</button>
        </div>
      </div>
    </div>
  );
}

// ----- Chat drawer -----
function ChatDrawer({ t, onClose }) {
  const [msgs, setMsgs] = useState([
    { from: "them", text: "your MBJ take was brave lol. mostly agree tho" },
    { from: "me", text: "ty! the fanfic crowd was NOT ready 😂" },
  ]);
  const [val, setVal] = useState("");
  const send = () => { if (!val.trim()) return; setMsgs([...msgs, { from: "me", text: val }]); setVal(""); };
  return (
    <div style={{ position: "fixed", right: 16, bottom: 16, width: 320, height: 420, background: t.panel, border: `1px solid ${t.border}`, borderRadius: 14, display: "flex", flexDirection: "column", zIndex: 40, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 12, borderBottom: `1px solid ${t.border}` }}>
        <Avatar seed="goldenjaguar88" size={28} t={t} />
        <span style={{ color: t.text, fontWeight: 700, fontSize: 14 }}>goldenjaguar88</span>
        <button onClick={onClose} style={{ marginLeft: "auto", background: "none", border: "none", color: t.muted, cursor: "pointer" }}><X size={18} /></button>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{ alignSelf: m.from === "me" ? "flex-end" : "flex-start", maxWidth: "78%", background: m.from === "me" ? t.accent : t.panel2, color: m.from === "me" ? t.accentText : t.text, padding: "8px 12px", borderRadius: 14, fontSize: 13 }}>{m.text}</div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, padding: 10, borderTop: `1px solid ${t.border}` }}>
        <input value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="Message..." style={{ flex: 1, background: t.bg, border: `1px solid ${t.border}`, borderRadius: 999, padding: "8px 12px", color: t.text }} />
        <button onClick={send} style={{ background: t.accent, border: "none", borderRadius: "50%", width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t.accentText }}><Send size={16} /></button>
      </div>
    </div>
  );
}

// ----- Pages -----
function LandingPage({ t, onOpen, onAuthor, mutedUsers, posts, pinned, loading }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, maxWidth: 1100, margin: "0 auto", padding: "0 16px" }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "20px 0" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "radial-gradient(circle at 35% 30%, #2a2a2e, #050505)", border: `2px solid ${t.accent}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>🐾</div>
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
          posts.map((p) => <PostCard key={p.id} post={p} t={t} onOpen={onOpen} onAuthor={onAuthor} muted={mutedUsers.includes(p.author)} showMeta />)
        )}
      </div>
      <div><CommunitySidebar t={t} /></div>
    </div>
  );
}

function PostPage({ post, t, onBack, onAuthor }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, maxWidth: 1100, margin: "0 auto", padding: "0 16px" }}>
      <div style={{ paddingTop: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <button onClick={onBack} style={{ background: t.panel2, border: "none", borderRadius: "50%", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t.text }}><ArrowLeft size={18} /></button>
          <Avatar seed={community.name} size={26} t={t} />
          <span style={{ color: t.heading, fontWeight: 700, fontSize: 13 }}>{community.name}</span>
          <span style={{ color: t.muted, fontSize: 12 }}>· {post.when}</span>
        </div>
        <div style={{ color: t.muted, fontSize: 12, marginBottom: 6, cursor: "pointer" }} onClick={() => onAuthor(post.author)}>{post.author}</div>
        <h1 style={{ color: t.text, fontSize: 26, fontWeight: 800, margin: "0 0 12px" }}>{post.title}</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>{post.flairs?.map((f) => <Flair key={f} flairKey={f} />)}</div>
        <p style={{ color: t.text, fontSize: 15, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>{post.body}</p>
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "16px 0" }}>
          <Vote votes={post.votes} t={t} targetType="post" targetId={post.id} />
          <ActionPill icon={<MessageCircle size={15} />} label={post.commentCount ?? post.comments?.length ?? 0} t={t} />
          <ActionPill icon={<Share2 size={15} />} label="Share" t={t} />
        </div>
        <div style={{ background: t.panel, border: `1px solid ${t.border}`, borderRadius: 999, padding: "12px 16px", color: t.muted, fontSize: 14, marginBottom: 8 }}>Join the conversation</div>
        <div style={{ borderTop: `1px solid ${t.border}`, paddingTop: 8 }}>{(post.comments ?? []).map((c) => <Comment key={c.id} c={c} t={t} />)}</div>
      </div>
      <div><CommunitySidebar t={t} /></div>
    </div>
  );
}

function MemberPage({ t, profile, loading, onOpen, onChat }) {
  const [rel, setRel] = useState({ following: false, muted: false, blocked: false });
  if (loading || !profile) {
    return <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 16px", color: t.muted, fontSize: 14 }}>{loading ? "Loading profile…" : "Profile not found."}</div>;
  }
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
        <div style={{ display: "flex", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
          <button onClick={() => setRel({ ...rel, following: !rel.following })} style={relBtn(t, rel.following)}>{rel.following ? <UserMinus size={15} /> : <UserPlus size={15} />}{rel.following ? "Following" : "Follow"}</button>
          <button onClick={onChat} style={relBtn(t)}><MessageSquare size={15} /> Chat</button>
          <button onClick={() => setRel({ ...rel, muted: !rel.muted })} style={relBtn(t, rel.muted)}><VolumeX size={15} /> {rel.muted ? "Muted" : "Mute"}</button>
          <button onClick={() => setRel({ ...rel, blocked: !rel.blocked })} style={relBtn(t, rel.blocked)}><Flag size={15} /> {rel.blocked ? "Blocked" : "Block"}</button>
        </div>
        {(rel.muted || rel.blocked) && (
          <div style={{ color: t.muted, fontSize: 12, fontStyle: "italic", marginBottom: 12 }}>
            {rel.blocked ? "Blocked: this user can't message you and their content is hidden everywhere." : "Muted: you won't see this user's posts in the feed."}
          </div>
        )}
        <div style={{ borderTop: `1px solid ${t.border}`, marginTop: 8 }}>
          {profile.posts.length === 0
            ? <div style={{ color: t.muted, fontSize: 13, padding: "20px 0" }}>No posts on this profile yet.</div>
            : profile.posts.map((p) => <PostCard key={p.id} post={p} t={t} onOpen={onOpen} onAuthor={() => {}} muted={false} showMeta={false} />)}
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
          <div style={{ color: t.text, fontWeight: 800, fontSize: 16 }}>{profile.followers} followers</div>
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

function relBtn(t, active) {
  return { display: "flex", alignItems: "center", gap: 6, background: active ? t.accent : t.panel2, color: active ? t.accentText : t.text, border: `1px solid ${active ? t.accent : t.border}`, borderRadius: 999, padding: "8px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13 };
}

// ----- App shell -----
export default function App() {
  const [view, setView] = useState("landing");
  const [activePost, setActivePost] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [joined, setJoined] = useState(true);
  const [mutedUsers] = useState([]);
  const { user, signOut } = useAuth();

  const [feed, setFeed] = useState([]);
  const [pinned, setPinned] = useState([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [myUsername, setMyUsername] = useState(null);

  const t = view === "member" ? neutral : gold;

  // Resolve the current member's username (for the header avatar + own profile).
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    supabase.from("profiles").select("username").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (active && data) setMyUsername(data.username); });
    return () => { active = false; };
  }, [user?.id]);

  // Load the community feed + pinned highlights once.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [f, p] = await Promise.all([fetchCommunityFeed(), fetchPinned()]);
        if (active) { setFeed(f); setPinned(p); }
      } catch (e) { console.error("feed load failed", e); }
      finally { if (active) setFeedLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  const openPost = async (post) => {
    setView("post"); window.scrollTo(0, 0);
    setActivePost({ comments: [], flairs: [], ...post }); // instant render from feed data
    try {
      const full = await fetchPostWithComments(post.id);
      setActivePost(full);
    } catch (e) { console.error("post load failed", e); }
  };

  const openAuthor = async (username) => {
    const uname = typeof username === "string" ? username : myUsername;
    if (!uname) return;
    setView("member"); window.scrollTo(0, 0);
    setProfile(null); setProfileLoading(true);
    try { setProfile(await fetchProfile(uname)); }
    catch (e) { console.error("profile load failed", e); }
    finally { setProfileLoading(false); }
  };

  return (
    <div style={{ background: t.bg, minHeight: "100vh", fontFamily: "Inter, system-ui, sans-serif", color: t.text }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderBottom: `1px solid ${t.border}`, position: "sticky", top: 0, background: t.bg, zIndex: 30 }}>
        <button onClick={() => setView("landing")} style={{ background: "none", border: "none", color: t.heading, fontWeight: 800, fontSize: 17, cursor: "pointer" }}>{community.name}</button>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: t.panel, border: `1px solid ${t.border}`, borderRadius: 999, padding: "7px 14px", maxWidth: 420 }}>
          <Search size={16} color={t.muted} /><input placeholder="Search" style={{ background: "none", border: "none", outline: "none", color: t.text, flex: 1 }} />
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <button onClick={() => setShowCreate(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: t.panel2, color: t.text, border: `1px solid ${t.border}`, borderRadius: 999, padding: "8px 16px", cursor: "pointer", fontWeight: 700, fontSize: 13 }}><Plus size={16} /> Create Post</button>
          <button onClick={() => setShowChat(true)} style={{ background: t.panel2, border: `1px solid ${t.border}`, borderRadius: "50%", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t.text }}><MessageSquare size={18} /></button>
          <button onClick={() => setJoined(!joined)} style={{ background: joined ? "transparent" : t.accent, color: joined ? t.text : t.accentText, border: `1px solid ${joined ? t.border : t.accent}`, borderRadius: 999, padding: "8px 18px", cursor: "pointer", fontWeight: 800, fontSize: 13 }}>{joined ? "Joined" : "Join"}</button>
          <button onClick={() => openAuthor(myUsername)} title={myUsername || user?.email || ""} style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}><Avatar seed={myUsername || user?.email || "me"} size={34} t={t} /></button>
          <button onClick={signOut} title="Sign out" style={{ background: t.panel2, border: `1px solid ${t.border}`, borderRadius: "50%", width: 38, height: 38, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: t.text }}><LogOut size={18} /></button>
        </div>
      </div>

      <div style={{ padding: "16px 0 70px" }}>
        {view === "landing" && <LandingPage t={t} posts={feed} pinned={pinned} loading={feedLoading} onOpen={openPost} onAuthor={openAuthor} mutedUsers={mutedUsers} />}
        {view === "post" && activePost && <PostPage post={activePost} t={t} onBack={() => setView("landing")} onAuthor={openAuthor} />}
        {view === "member" && <MemberPage t={t} profile={profile} loading={profileLoading} onOpen={openPost} onChat={() => setShowChat(true)} />}
      </div>

      {showCreate && <CreatePostModal t={t} onClose={() => setShowCreate(false)} />}
      {showChat && <ChatDrawer t={t} onClose={() => setShowChat(false)} />}
    </div>
  );
}
