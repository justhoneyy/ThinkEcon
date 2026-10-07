"use client";

import Link from "next/link";
import { AdminEntry } from "./admin-entry";
import { createContext, FormEvent, ReactNode, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { ArrowLeft, ArrowUpRight, AtSign, CircleUserRound, Clock3, Link2, Mail, Menu, UsersRound, X } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FilmBand, ScrollBar, Stats } from "./fx";

/* ───────────── types & helpers ───────────── */
type Post = { slug: string; title: string; summary: string; body: string; cover: string | null; created_at: string };
type EventItem = { slug: string; title: string; description: string; body: string | null; event_date: string | null; location: string | null; image_url: string | null; application_url: string | null; meeting_url: string | null };
type Podcast = { id?: string; title: string; description: string; video_url: string };
type Announcement = { slug: string; title: string; summary: string; body: string; cover: string | null };
type Head = { id: string; name: string; role: string; bio?: string | null; image_url: string | null; linkedin?: string | null; instagram?: string | null; email?: string | null };
type Thread = { id: string; title: string; body: string; author_name: string; created_at: string };
type Reply = { id: string; body: string; author_name: string };
type Settings = {
  hero: { kicker: string; title: string; text: string; cta: string };
  ribbon: string; about: string;
  departments: { title: string; href: string; image: string; caption: string }[];
  contact: { title: string; text: string };
  footer: { text: string; instagram: string; linkedin: string; copyright: string };
};

const CLERK = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);
const unsplash = (id: string, w = 1400) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=85`;
export function mediaUrl(v: string | null | undefined, fallback: string) {
  if (!v) return unsplash(fallback);
  if (v.startsWith("local:")) return `/discussion/${v.slice(6)}-web.jpg`;
  return v.startsWith("http") || v.startsWith("/") ? v : unsplash(v);
}
const embed = (url: string) => { const m = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/); return m ? `https://www.youtube.com/embed/${m[1]}` : url; };
const readingMinutes = (b: string) => Math.max(1, Math.ceil(b.trim().split(/\s+/).filter(Boolean).length / 220));
const postDate = (v: string) => v ? new Intl.DateTimeFormat("en", { day: "numeric", month: "long", year: "numeric" }).format(new Date(v)) : "";

function useApi<T>(url: string | null) {
  const [state, set] = useState<{ data: T | null; error: boolean; url: string | null }>({ data: null, error: false, url: null });
  useEffect(() => {
    if (!url) return;
    let off = false;
    fetch(url, { cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject())).then((d) => !off && set({ data: d, error: false, url })).catch(() => !off && set({ data: null, error: true, url }));
    return () => { off = true; };
  }, [url]);
  const fresh = state.url === url;
  return { data: fresh ? (state.data as T | null) : null, error: fresh && state.error };
}


/* current URL path, kept in sync with Next's client navigation (works with the catch-all rewrite) */
const listeners = new Set<() => void>(); let patched = false;
function subscribePath(cb: () => void) {
  if (!patched) {
    patched = true;
    for (const m of ["pushState", "replaceState"] as const) { const o = history[m]; history[m] = function (this: History, ...a: Parameters<History["pushState"]>) { const r = o.apply(this, a); listeners.forEach((l) => l()); return r; }; }
    window.addEventListener("popstate", () => listeners.forEach((l) => l()));
  }
  listeners.add(cb); return () => { listeners.delete(cb); };
}
const usePath = () => useSyncExternalStore(subscribePath, () => window.location.pathname, () => "/");

const SettingsCtx = createContext<Settings | null>(null);
const useSettings = () => useContext(SettingsCtx);
const NotFound = () => <main className="article-page"><article><h1>Not found.</h1><p className="article-summary"><Link href="/">Go back home</Link></p></article></main>;

/* ───────────── shell ───────────── */
const links = [["About", "/#about"], ["Journal", "/blog"], ["Podcasts", "/podcasts"], ["Events", "/events"], ["Discussion", "/discussion"], ["Heads", "/contributors"], ["Contact", "/contact"]];

function AuthControls() {
  if (!CLERK) return null;
  return <Authed />;
}
function Authed() {
  const { isSignedIn, isLoaded } = useUser();
  const { data } = useApi<{ admin: boolean }>(isSignedIn ? "/api?p=me" : null);
  if (!isLoaded) return null;
  if (isSignedIn) return <div className="auth-controls">{data?.admin && <a href="/admin">Admin</a>}<UserButton /></div>;
  return <SignInButton mode="modal"><button className="sign-in auth-anon" aria-label="Sign in"><CircleUserRound size={25} /></button></SignInButton>;
}

/** Reveal-on-scroll for headings; re-scans because content now loads after mount. */
function useScrollReveal(off: boolean) {
  useEffect(() => {
    if (off) return;
    const sel = "h1, h2, h3, .article-summary, .publication-card, .person-card";
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-visible"); io.unobserve(e.target); } }), { threshold: 0.18 });
    let raf = 0;
    const scan = () => { raf = 0; document.querySelectorAll(sel).forEach((n) => { if (!n.classList.contains("scroll-reveal")) { n.classList.add("scroll-reveal"); io.observe(n); } }); };
    const mo = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(scan); });
    mo.observe(document.body, { childList: true, subtree: true });
    scan();
    return () => { mo.disconnect(); io.disconnect(); };
  }, [off]);
}

export function Shell({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const { data: settings, error: settingsError } = useApi<Settings>("/api?p=settings");
  useEffect(() => setReady(true), []);
  const bare = usePath().startsWith("/admin");
  useScrollReveal(bare);
  if (!ready) return null; // the server sends an empty page; everything renders in the browser
  if (bare) return <>{children}</>;
  const f = settings?.footer;
  return <SettingsCtx.Provider value={settings}>
    <header className="topbar"><Link className="identity" href="/">ThinkEconomics</Link><nav className="desktop-nav">{links.map(([l, h]) => <Link key={h} href={h}>{l}</Link>)}</nav><button className="menu-toggle" onClick={() => setOpen(!open)} aria-label="Open navigation" aria-expanded={open}>{open ? <X size={24} /> : <Menu size={24} />}</button><AuthControls /></header>
    <aside className={`menu-drawer ${open ? "is-open" : ""}`}><div>{links.map(([l, h], i) => <Link key={h} href={h} onClick={() => setOpen(false)} style={{ "--i": i } as React.CSSProperties}>{l}</Link>)}</div><AuthControls /></aside>
    {settingsError && <p style={{ margin: "2rem auto", padding: "1rem", maxWidth: 560, textAlign: "center", background: "#fae4df", color: "#7c2118", borderRadius: 8 }}>The site could not load its content. Open /api?p=health to see whether the database or Redis is failing.</p>}
    {children}
    <footer className="footer"><div><strong>ThinkEconomics</strong></div><p>{f?.text}</p><nav aria-label="Social links">{f?.instagram && <a href={f.instagram} aria-label="Instagram"><AtSign size={18} /><span>Instagram</span></a>}{f?.linkedin && <a href={f.linkedin} aria-label="LinkedIn"><Link2 size={18} /><span>LinkedIn</span></a>}<Link href="/contributors"><UsersRound size={18} /><span>Heads</span></Link></nav><span>{f?.copyright}</span></footer>
  </SettingsCtx.Provider>;
}

/* ───────────── article renderer ───────────── */
function InteractiveSupply() {
  const [demand, setDemand] = useState(56); const [supply, setSupply] = useState(48); const gap = demand - supply;
  return <section className="interactive-model"><div><p>Interactive model</p><h2>When demand moves faster than supply.</h2><span>Move the sliders to see the pressure on price.</span></div><div className="model-controls"><label>Demand <input type="range" min="20" max="90" value={demand} onChange={(e) => setDemand(Number(e.target.value))} /></label><label>Supply <input type="range" min="20" max="90" value={supply} onChange={(e) => setSupply(Number(e.target.value))} /></label><div className={`model-result ${gap > 0 ? "up" : "down"}`}>{gap === 0 ? "Price pressure is balanced" : gap > 0 ? "Price pressure rises" : "Price pressure eases"}</div></div></section>;
}
function InteractiveGrowth() {
  const [investment, setInvestment] = useState(55); const [skills, setSkills] = useState(62);
  const score = Math.round((investment * 0.45 + skills * 0.55) * 10) / 10;
  const points = Array.from({ length: 10 }, (_, i) => `${i * 11},${94 - (i / 9) * score}`).join(" ");
  return <section className="interactive-model"><div><p>Interactive graph</p><h2>Build the conditions for research.</h2><span>Change the inputs to see a simple capacity index move.</span></div><div className="model-controls"><svg className="model-chart" viewBox="0 0 100 100" role="img" aria-label="Capacity index line graph"><path d="M0 94H100M0 50H100M0 6H100" /><polyline points={points} /></svg><label>Investment <input type="range" min="20" max="90" value={investment} onChange={(e) => setInvestment(Number(e.target.value))} /></label><label>Skills support <input type="range" min="20" max="90" value={skills} onChange={(e) => setSkills(Number(e.target.value))} /></label><div className="model-result up">Capacity index: {score}</div></div></section>;
}

export function ArticleContent({ body }: { body: string }) {
  return <div className="article-body">{body.split(/\n\s*\n/).map((block, i) => {
    const key = `${i}-${block.slice(0, 12)}`;
    const img = (src: string) => <div key={key} className="article-image" role="img" aria-label="Article illustration" style={{ backgroundImage: `url(${src})` }} />;
    if (block.startsWith("image:")) return img(mediaUrl(block.slice(6).trim(), ""));
    if (block.startsWith("localimage:")) return img(`/discussion/${block.slice(11).trim()}-web.jpg`);
    if (block === "interactive:supply") return <InteractiveSupply key={key} />;
    if (block === "interactive:growth") return <InteractiveGrowth key={key} />;
    return <ReactMarkdown key={key} remarkPlugins={[remarkGfm]} skipHtml>{block}</ReactMarkdown>;
  })}</div>;
}

/* ───────────── home ───────────── */
function DepartmentScroller({ items }: { items: Settings["departments"] }) {
  const [active, setActive] = useState(0);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const mid = window.innerHeight / 2; let next = 0; let nearest = Infinity;
      document.querySelectorAll<HTMLElement>(".department-card").forEach((c, i) => { const r = c.getBoundingClientRect(); const d = Math.abs(r.top + r.height / 2 - mid); if (d < nearest) { nearest = d; next = i; } });
      setActive((c) => (c === next ? c : next));
    };
    const onScroll = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener("scroll", onScroll, { passive: true }); window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (frame) cancelAnimationFrame(frame); };
  }, [items]);
  const cur = items[Math.min(active, items.length - 1)];
  if (!cur) return null;
  return <section className="department-scroll">
    <div className="department-morph-layer"><div className="department-morph" aria-live="polite"><div key={cur.title} className="department-morph-copy"><h2>{cur.title}</h2><span>{cur.caption}</span></div></div></div>
    <div className="department-scroll-items">{items.map((d, i) => <Link href={d.href} key={d.title + i} data-department-index={i} className="department-card" aria-label={`Explore ${d.title}`}><div className="department-scroll-image" style={{ backgroundImage: `url(${mediaUrl(d.image, "")})` }} /></Link>)}</div>
  </section>;
}

function LeadershipContacts({ heads }: { heads: Head[] }) {
  return <section className="leadership-contacts"><div className="section-title"><h2>Heads.</h2><Link href="/contributors">View all heads</Link></div><div className="leadership-grid">{heads.map((h) => <article key={h.id}><div className="leader-photo" style={{ backgroundImage: `url(${h.image_url || ""})` }} /><div><p>{h.role}</p><h3>{h.name}</h3><span>{h.bio}</span><nav>{h.linkedin && <a href={h.linkedin} aria-label={`${h.name} on LinkedIn`}><Link2 size={18} /></a>}{h.instagram && <a href={h.instagram} aria-label={`${h.name} on Instagram`}><AtSign size={18} /></a>}{h.email && <a href={`mailto:${h.email}`} aria-label={`Email ${h.name}`}><Mail size={18} /></a>}</nav></div></article>)}</div></section>;
}

function Home() {
  const s = useSettings();
  const { data } = useApi<{ post: Post | null; podcast: Podcast | null; event: EventItem | null; heads: Head[] }>("/api?p=home");
  if (!s || !data) return null;
  const { post, podcast, event, heads } = data;
  const lines = s.hero.title.split("\n");
  return <main>
    <ScrollBar />
    <section className="hero"><div className="hero-media" /><div className="hero-shade" />
      <div className="hero-copy-lockup"><p className="hero-kicker">{s.hero.kicker}</p><h1>{lines.map((l, i) => <span key={i}>{l}{i < lines.length - 1 && <br />}</span>)}</h1></div>
      <div className="hero-bottom"><p>{s.hero.text}</p><Link href="/contact" className="cta">{s.hero.cta}</Link></div></section>
    <section className="ribbon"><div>{Array(3).fill(`${s.ribbon} `).join(" ")}</div></section>
    <section className="statement" id="about"><h2>{s.about}</h2></section>
    <Stats heads={heads.length ? 18 : 0} posts={data.post ? 12 : 0} />
    <DepartmentScroller items={s.departments} />
    <FilmBand />
    <section className="latest"><h2>Latest.</h2><div>
      {post && <Link href={`/blog/${post.slug}`}><div style={{ backgroundImage: `url(${mediaUrl(post.cover, "photo-1456324504439-367cee3b3c32")})` }} /><h3>{post.title}</h3></Link>}
      {podcast && <article className="latest-podcast-card"><iframe src={embed(podcast.video_url)} title={podcast.title} allowFullScreen /><Link href="/podcasts"><h3>{podcast.title}</h3></Link></article>}
      {event && <Link href={`/events/${event.slug}`}><div style={{ backgroundImage: `url(${mediaUrl(event.image_url, "photo-1497366754035-f200968a6e72")})` }} /><h3>{event.title}</h3></Link>}
    </div></section>
    {heads.length > 0 && <LeadershipContacts heads={heads} />}
  </main>;
}

/* ───────────── journal ───────────── */
function Journal() {
  const { data: posts } = useApi<Post[]>("/api?p=posts");
  if (!posts) return null;
  const [featured, ...more] = posts;
  return <main className="journal-page">
    <header className="journal-hero"><p className="eyebrow">The ThinkEconomics journal</p><h1>Ideas with<br />room to breathe.</h1><p>Student research, sharp explainers, and considered arguments about the systems shaping everyday life.</p></header>
    {featured ? <>
      <Link className="journal-feature" href={`/blog/${featured.slug}`}><div className="journal-feature-image" style={{ backgroundImage: `url(${mediaUrl(featured.cover, "photo-1456324504439-367cee3b3c32")})` }} /><div className="journal-feature-copy"><span>Latest essay</span><h2>{featured.title}</h2><p>{featured.summary}</p><div className="journal-meta"><time>{postDate(featured.created_at)}</time><span><Clock3 size={15} /> {readingMinutes(featured.body)} min read</span></div><strong>Read the essay <ArrowUpRight size={18} /></strong></div></Link>
      {more.length > 0 && <section className="journal-archive"><div className="journal-section-heading"><p className="eyebrow">More from the journal</p><span>{more.length} {more.length === 1 ? "essay" : "essays"}</span></div><div className="journal-grid">{more.map((p, i) => <Link href={`/blog/${p.slug}`} key={p.slug}><div className="journal-card-image" style={{ backgroundImage: `url(${mediaUrl(p.cover, i % 2 ? "photo-1521737604893-d14cc237f11d" : "photo-1523240795612-9a054b0db644")})` }} /><div className="journal-card-copy"><div className="journal-meta"><time>{postDate(p.created_at)}</time><span>{readingMinutes(p.body)} min</span></div><h2>{p.title}</h2><p>{p.summary}</p><strong>Read article <ArrowUpRight size={17} /></strong></div></Link>)}</div></section>}
    </> : <section className="journal-empty"><span>01</span><h2>The first idea is being written.</h2><p>New essays will appear here as soon as they are published.</p></section>}
  </main>;
}

function Comments({ slug }: { slug: string }) {
  if (!CLERK) return <section className="comments"><h2>Join the discussion.</h2></section>;
  return <AuthComments slug={slug} />;
}
function AuthComments({ slug }: { slug: string }) {
  const { isSignedIn } = useUser();
  const { data: me } = useApi<{ admin: boolean }>(isSignedIn ? "/api?p=me" : null);
  const { data } = useApi<{ id: string; author_name: string; body: string }[]>(`/api?p=comments/${encodeURIComponent(slug)}`);
  const [added, setAdded] = useState<{ id: string; author_name: string; body: string }[]>([]);
  const [gone, setGone] = useState<string[]>([]);
  const [text, setText] = useState(""); const [sending, setSending] = useState(false);
  const list = [...added, ...(data || [])].filter((c) => !gone.includes(c.id));
  const post = async () => {
    if (!text.trim()) return; setSending(true);
    const r = await fetch("/api?p=comments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postSlug: slug, body: text }) });
    if (r.ok) { const c = await r.json(); setAdded((a) => [c, ...a]); setText(""); }
    setSending(false);
  };
  const remove = async (id: string) => { const r = await fetch(`/api?p=admin/comments/${id}`, { method: "DELETE" }); if (r.ok) setGone((g) => [...g, id]); };
  return <section className="comments"><h2>Join the discussion.</h2>{isSignedIn ? <div className="comment-form"><textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Add a thought" /><button onClick={post} disabled={sending}>{sending ? "Posting" : "Post comment"}</button></div> : <SignInButton mode="modal"><button className="sign-in">Sign in to comment</button></SignInButton>}<div className="comment-list">{list.map((c) => <article key={c.id}><div className="comment-meta"><strong>{c.author_name}</strong>{me?.admin && <button onClick={() => remove(c.id)}>Delete</button>}</div><p>{c.body}</p></article>)}</div></section>;
}

function Article({ slug }: { slug: string }) {
  const { data: post, error } = useApi<Post>(`/api?p=posts/${encodeURIComponent(slug)}`);
  if (error) return <NotFound />;
  if (!post) return null;
  return <main className="journal-article-page"><article>
    <header className="article-masthead"><Link href="/blog"><ArrowLeft size={17} /> Back to journal</Link><p className="eyebrow">ThinkEconomics journal</p><h1>{post.title}</h1><p className="article-summary">{post.summary}</p><div className="article-byline"><span>ThinkEconomics Editorial</span><time>{postDate(post.created_at)}</time><span><Clock3 size={15} /> {readingMinutes(post.body)} min read</span></div></header>
    <div className="article-cover" role="img" aria-label="Article cover" style={{ backgroundImage: `url(${mediaUrl(post.cover, "photo-1456324504439-367cee3b3c32")})` }} />
    <ArticleContent body={post.body} />
  </article><Comments slug={post.slug} /></main>;
}

/* ───────────── podcasts / events / discussion / heads ───────────── */
function Podcasts() {
  const { data } = useApi<Podcast[]>("/api?p=podcasts");
  if (!data) return null;
  return <main className="podcasts-page"><h1>Podcasts.</h1><div className="podcast-grid">{data.map((e) => <article key={e.id}><iframe src={embed(e.video_url)} title={e.title} allowFullScreen /><h2>{e.title}</h2><p>{e.description}</p></article>)}{!data.length && <p>New episodes will appear here.</p>}</div></main>;
}

function Events() {
  const { data } = useApi<EventItem[]>("/api?p=events");
  if (!data) return null;
  return <main className="events-page"><h1>Events.</h1><div className="events-list">{data.map((e) => <Link href={`/events/${e.slug}`} className="event-card" key={e.slug}><div className="event-image" style={{ backgroundImage: `url(${mediaUrl(e.image_url, "photo-1522202176988-66273c2fd55f")})` }} /><h2>{e.title}</h2></Link>)}{!data.length && <p>No events have been announced.</p>}</div></main>;
}

function EventDetail({ slug }: { slug: string }) {
  const { data: e, error } = useApi<EventItem>(`/api?p=events/${encodeURIComponent(slug)}`);
  if (error) return <NotFound />;
  if (!e) return null;
  return <main className="article-page event-detail"><article><h1>{e.title}</h1>{e.event_date && <p className="event-date">{new Date(`${e.event_date}T00:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}{e.location ? ` · ${e.location}` : ""}</p>}<div className="article-cover" style={{ backgroundImage: `url(${mediaUrl(e.image_url, "photo-1522202176988-66273c2fd55f")})` }} /><ArticleContent body={e.body || e.description} />{(e.application_url || e.meeting_url) && <div className="event-links">{e.application_url && <a href={e.application_url}>Apply</a>}{e.meeting_url && <a href={e.meeting_url}>Meeting link</a>}</div>}</article></main>;
}

function Discussion() {
  const { data } = useApi<Announcement[]>("/api?p=announcements");
  if (!data) return null;
  return <main className="podcasts-page discussion-page"><h1>Discussion.</h1>{data.length ? data.map((d) => <section className="discussion-feature" key={d.slug}><Link href={`/announcements/${d.slug}`}><div style={{ backgroundImage: `url(${mediaUrl(d.cover, "photo-1528605248644-14dd04022da1")})` }} /><h2>{d.title}</h2><p>{d.summary}</p></Link></section>) : <p>Discussion updates will appear here.</p>}</main>;
}

function AnnouncementDetail({ slug }: { slug: string }) {
  const { data: a, error } = useApi<Announcement>(`/api?p=announcements/${encodeURIComponent(slug)}`);
  if (error) return <NotFound />;
  if (!a) return null;
  return <main className="article-page"><article><h1>{a.title}</h1><p className="article-summary">{a.summary}</p><div className="article-cover" style={{ backgroundImage: `url(${mediaUrl(a.cover, "photo-1491309055486-24ae51108062")})` }} /><ArticleContent body={a.body} /></article></main>;
}

function ReplyBox({ id, onAdd }: { id: string; onAdd: (r: Reply) => void }) {
  const { isSignedIn } = useUser(); const [body, setBody] = useState(""); const [err, setErr] = useState("");
  const submit = async (ev: FormEvent) => {
    ev.preventDefault();
    const r = await fetch("/api?p=discussion", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId: id, body }) });
    const c = await r.json(); if (!r.ok) return setErr(c.error || "Could not publish your reply.");
    onAdd(c); setBody(""); setErr("");
  };
  return isSignedIn ? <form className="forum-compose" onSubmit={submit}><textarea required value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add to the discussion" /><button>Reply</button>{err && <p>{err}</p>}</form> : <section className="forum-signin"><p>Sign in to reply.</p><SignInButton mode="modal"><button>Sign in</button></SignInButton></section>;
}

function ThreadPage({ id }: { id: string }) {
  const { data, error } = useApi<{ thread: Thread; replies: Reply[] }>(`/api?p=threads/${encodeURIComponent(id)}`);
  const [extra, setExtra] = useState<Reply[]>([]);
  if (error) return <NotFound />;
  if (!data) return null;
  return <main className="forum-page"><section className="page-hero"><small>{data.thread.author_name}</small><h1>{data.thread.title}</h1><p>{data.thread.body}</p></section>
    <section className="reply-list"><h2>Replies</h2>{[...data.replies, ...extra].map((r) => <article key={r.id}><small>{r.author_name}</small><p>{r.body}</p></article>)}{CLERK && <ReplyBox id={id} onAdd={(r) => setExtra((x) => [...x, r])} />}</section></main>;
}

function Heads() {
  const { data } = useApi<Head[]>("/api?p=heads");
  if (!data) return null;
  return <main className="contributors-page"><h1>Heads.</h1><div>{data.map((h) => <article key={h.id}><div className="contributor-photo" style={{ backgroundImage: `url(${h.image_url || ""})` }} /><div><h2>{h.name}</h2><p>{h.role}</p></div></article>)}</div></main>;
}

/* ───────────── contact ───────────── */
function ContactGate() {
  const s = useSettings();
  const { isLoaded, isSignedIn, user } = useUser();
  const [message, setMessage] = useState(""); const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  if (!isLoaded || !s) return null;
  const submit = async () => {
    if (!message.trim()) return; setStatus("sending");
    const r = await fetch("/api?p=contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message }) });
    if (r.ok) { setMessage(""); setStatus("sent"); } else setStatus("error");
  };
  return <main className={`contact-page ${isSignedIn ? "" : "contact-auth-required"}`}><section><h1>{s.contact.title}</h1><p>{s.contact.text}</p></section>{isSignedIn ? <form onSubmit={(e) => { e.preventDefault(); void submit(); }}><label>Name<input value={user?.fullName || ""} readOnly /></label><label>Email<input type="email" value={user?.primaryEmailAddress?.emailAddress || ""} readOnly /></label><label>Message<textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="What would you like to talk about?" rows={5} /></label><button disabled={status === "sending"}>{status === "sending" ? "Sending" : "Send message"}</button>{status === "sent" && <p>Message sent.</p>}{status === "error" && <p>Could not send your message.</p>}</form> : <section className="contact-login"><p>Sign in to contact ThinkEconomics.</p><SignInButton mode="modal"><button className="contact-signin-link">Sign in</button></SignInButton></section>}</main>;
}
function Contact() {
  const s = useSettings();
  if (!CLERK) return s ? <main className="contact-page"><section><h1>{s.contact.title}</h1></section></main> : null;
  return <ContactGate />;
}

/* ───────────── router (one catch-all page serves every URL) ───────────── */
export function Router() {
  const [a, b] = usePath().split("/").filter(Boolean).map(decodeURIComponent);
  switch (a) {
    case undefined: return <Home />;
    case "blog": return b ? <Article key={b} slug={b} /> : <Journal />;
    case "podcasts": return <Podcasts />;
    case "events": return b ? <EventDetail key={b} slug={b} /> : <Events />;
    case "discussion": return b ? <ThreadPage key={b} id={b} /> : <Discussion />;
    case "announcements": return b ? <AnnouncementDetail key={b} slug={b} /> : <NotFound />;
    case "contributors": return <Heads />;
    case "contact": return <Contact />;
    case "admin": return <AdminEntry />;
    default: return <NotFound />;
  }
}
