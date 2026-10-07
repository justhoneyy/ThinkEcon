"use client";

import { ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { SignOutButton } from "@clerk/nextjs";
import { Menu as MenuIcon, X as CloseIcon } from "lucide-react";
import { ArticleContent } from "./site";
import "./admin.css";

/* ───────────── api ───────────── */
async function api<T = unknown>(path: string, method = "GET", body?: unknown): Promise<T> {
  const r = await fetch(`/api?p=admin/${path}`, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((d as { error?: string }).error || "Request failed");
  return d as T;
}
type Row = Record<string, string | number | boolean | null>;
type FieldType = "text" | "textarea" | "markdown" | "date" | "url" | "image" | "bool" | "number";
type Field = { k: string; label: string; type?: FieldType; req?: boolean; hint?: string };

function useNotice() {
  const [n, set] = useState<{ t: string; err?: boolean } | null>(null);
  useEffect(() => { if (!n) return; const t = setTimeout(() => set(null), 4000); return () => clearTimeout(t); }, [n]);
  return [n, (t: string, err = false) => set({ t, err })] as const;
}
const Note = ({ n }: { n: { t: string; err?: boolean } | null }) => (n ? <div className={`adm-note ${n.err ? "err" : ""}`}>{n.t}</div> : null);

/* ───────────── field inputs ───────────── */
function ImageInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLInputElement>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState("");
  const pick = async (f?: File) => {
    if (!f) return; setBusy(true); setErr("");
    try { const fd = new FormData(); fd.append("file", f); const r = await fetch("/api?p=admin/upload", { method: "POST", body: fd }); const d = await r.json(); if (!r.ok) throw new Error(d.error); onChange(d.url); } catch (e) { setErr((e as Error).message); }
    setBusy(false); if (ref.current) ref.current.value = "";
  };
  const src = value ? (value.startsWith("http") || value.startsWith("/") ? value : value.startsWith("local:") ? `/discussion/${value.slice(6)}-web.jpg` : `https://images.unsplash.com/${value}?w=200&q=60`) : "";
  return <div><div className="adm-img">{src && /* eslint-disable-next-line @next/next/no-img-element */ <img src={src} alt="" />}<input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Paste an image URL, an Unsplash photo id, or upload" /><input ref={ref} type="file" accept="image/*" hidden onChange={(e) => pick(e.target.files?.[0])} /><button type="button" className="adm-btn ghost sm" disabled={busy} onClick={() => ref.current?.click()}>{busy ? "Uploading…" : "Upload"}</button>{value && <button type="button" className="adm-btn ghost sm" onClick={() => onChange("")}>Clear</button>}</div>{err && <small style={{ color: "#c0392b" }}>{err}</small>}</div>;
}

function MarkdownInput({ value, onChange, onTitle }: { value: string; onChange: (v: string) => void; onTitle?: (t: string) => void }) {
  const file = useRef<HTMLInputElement>(null); const [preview, setPreview] = useState(false); const [msg, setMsg] = useState(""); const imgRef = useRef<HTMLInputElement>(null);
  const importDoc = async (f?: File) => {
    if (!f) return; setMsg("Converting…");
    const fd = new FormData(); fd.append("file", f);
    const r = await fetch("/api?p=admin/parse-document", { method: "POST", body: fd }); const d = await r.json();
    if (!r.ok) setMsg(d.error || "Could not import."); else { onChange(d.body); onTitle?.(String(d.fileName).replace(/\.(md|markdown|pdf)$/i, "").replace(/[-_]+/g, " ")); setMsg(d.pages ? `Converted ${d.pages} PDF pages.` : "Markdown imported."); }
    if (file.current) file.current.value = "";
  };
  const addImage = async (f?: File) => {
    if (!f) return; const fd = new FormData(); fd.append("file", f);
    const r = await fetch("/api?p=admin/upload", { method: "POST", body: fd }); const d = await r.json();
    if (r.ok) onChange(`${value.trim()}\n\nimage:${d.url}\n\n`); else setMsg(d.error || "Upload failed.");
    if (imgRef.current) imgRef.current.value = "";
  };
  return <div style={{ display: "grid", gap: ".5rem" }}>
    <div className="adm-actions"><button type="button" className="adm-btn ghost sm" onClick={() => setPreview(!preview)}>{preview ? "Edit" : "Preview"}</button><input ref={file} type="file" accept=".md,.markdown,.pdf" hidden onChange={(e) => importDoc(e.target.files?.[0])} /><button type="button" className="adm-btn ghost sm" onClick={() => file.current?.click()}>Import .md / .pdf</button><input ref={imgRef} type="file" accept="image/*" hidden onChange={(e) => addImage(e.target.files?.[0])} /><button type="button" className="adm-btn ghost sm" onClick={() => imgRef.current?.click()}>Insert image</button><button type="button" className="adm-btn ghost sm" onClick={() => onChange(`${value.trim()}\n\ninteractive:supply\n\n`)}>+ Supply model</button><button type="button" className="adm-btn ghost sm" onClick={() => onChange(`${value.trim()}\n\ninteractive:growth\n\n`)}>+ Growth graph</button>{msg && <small>{msg}</small>}</div>
    {preview ? <div className="adm-preview"><ArticleContent body={value || "_Nothing to preview yet._"} /></div> : <textarea className="tall" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Write in Markdown. Use ## for headings. image:URL and interactive:supply on their own line." />}
  </div>;
}

function FormFields({ fields, data, set }: { fields: Field[]; data: Row; set: (k: string, v: string | boolean | number) => void }) {
  return <>{fields.map((f) => {
    const v = data[f.k]; const str = v == null ? "" : String(v); const t = f.type || "text";
    if (t === "bool") return <label className="chk" key={f.k}><input type="checkbox" checked={Boolean(v)} onChange={(e) => set(f.k, e.target.checked)} />{f.label}{f.hint && <span className="h"> — {f.hint}</span>}</label>;
    return <label key={f.k}>{f.label}{f.req && " *"}{f.hint && <span className="h">{f.hint}</span>}
      {t === "image" ? <ImageInput value={str} onChange={(x) => set(f.k, x)} />
        : t === "markdown" ? <MarkdownInput value={str} onChange={(x) => set(f.k, x)} onTitle={f.k === "body" && "title" in data ? (x) => { if (!data.title) set("title", x); } : undefined} />
        : t === "textarea" ? <textarea value={str} onChange={(e) => set(f.k, e.target.value)} />
        : <input type={t === "number" ? "number" : t === "date" ? "date" : t === "url" ? "url" : "text"} value={str} onChange={(e) => set(f.k, t === "number" ? Number(e.target.value) : e.target.value)} />}
    </label>;
  })}</>;
}

/* ───────────── generic manager ───────────── */
function Manager({ res, title, fields, titleKey, subKey, create = true, extra }: { res: string; title: string; fields: Field[]; titleKey: string; subKey?: string; create?: boolean; extra?: (r: Row) => string }) {
  const [rows, setRows] = useState<Row[] | null>(null); const [edit, setEdit] = useState<Row | null>(null); const [isNew, setIsNew] = useState(false);
  const [busy, setBusy] = useState(false); const [n, notify] = useNotice();
  const load = useCallback(() => api<Row[]>(res).then(setRows).catch((e) => notify(e.message, true)), [res]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setEdit(null); setRows(null); void load(); }, [load]);
  const blank = (): Row => Object.fromEntries(fields.map((f) => [f.k, f.type === "bool" ? f.k === "published" : f.type === "number" ? 0 : ""]));
  const save = async () => {
    if (!edit) return; setBusy(true);
    try { if (isNew) await api(res, "POST", edit); else await api(`${res}/${edit.id}`, "PUT", edit); notify("Saved."); setEdit(null); await load(); } catch (e) { notify((e as Error).message, true); }
    setBusy(false);
  };
  const del = async (r: Row) => { if (!confirm(`Delete "${r[titleKey] ?? "this item"}"? This cannot be undone.`)) return; try { await api(`${res}/${r.id}`, "DELETE"); notify("Deleted."); await load(); } catch (e) { notify((e as Error).message, true); } };
  const flip = async (r: Row) => { try { await api(`${res}/${r.id}`, "PUT", { published: !r.published }); await load(); } catch (e) { notify((e as Error).message, true); } };
  return <section><div className="adm-head"><h1>{title}</h1>{create && !edit && <button className="adm-btn" onClick={() => { setIsNew(true); setEdit(blank()); }}>+ New</button>}</div><Note n={n} />
    {edit ? <div className="adm-form"><FormFields fields={fields} data={edit} set={(k, v) => setEdit({ ...edit, [k]: v })} /><div className="adm-actions"><button className="adm-btn" disabled={busy} onClick={save}>{busy ? "Saving…" : isNew ? "Create" : "Save changes"}</button><button className="adm-btn ghost" onClick={() => setEdit(null)}>Cancel</button></div></div>
      : !rows ? <p>Loading…</p> : !rows.length ? <p>Nothing here yet.</p> : <div className="adm-list">{rows.map((r) => <div className="adm-row" key={String(r.id)}><div><strong>{String(r[titleKey] ?? "")}</strong><small>{extra ? extra(r) : subKey ? String(r[subKey] ?? "") : ""}</small></div>{"published" in r && <span className={`adm-pill ${r.published ? "" : "off"}`}>{r.published ? "Live" : "Hidden"}</span>}{"published" in r && <button className="adm-btn ghost sm" onClick={() => flip(r)}>{r.published ? "Hide" : "Publish"}</button>}<button className="adm-btn ghost sm" onClick={() => { setIsNew(false); setEdit({ ...r }); }}>Edit</button><button className="adm-btn danger sm" onClick={() => del(r)}>Delete</button></div>)}</div>}
  </section>;
}

/* ───────────── site content (about, hero, contact, footer, departments) ───────────── */
type Dept = { title: string; href: string; image: string; caption: string };
function SettingSection({ id, title, fields, flat }: { id: string; title: string; fields: Field[]; flat?: boolean }) {
  const [val, setVal] = useState<Row | null>(null); const [n, notify] = useNotice();
  useEffect(() => { api<Record<string, unknown>>("settings").then((s) => setVal(flat ? { value: s[id] as string } : (s[id] as Row))); }, [id, flat]);
  if (!val) return null;
  const save = async () => { try { await api(`settings/${id}`, "PUT", { value: flat ? val.value : val }); notify(`${title} saved.`); } catch (e) { notify((e as Error).message, true); } };
  return <div className="adm-sec"><h2>{title}</h2><Note n={n} /><div className="adm-form"><FormFields fields={fields} data={val} set={(k, v) => setVal({ ...val, [k]: v })} /><div><button className="adm-btn" onClick={save}>Save {title}</button></div></div></div>;
}
function Departments() {
  const [items, setItems] = useState<Dept[] | null>(null); const [n, notify] = useNotice();
  useEffect(() => { api<{ departments: Dept[] }>("settings").then((s) => setItems(s.departments)); }, []);
  if (!items) return null;
  const upd = (i: number, k: keyof Dept, v: string) => setItems(items.map((d, j) => (j === i ? { ...d, [k]: v } : d)));
  const move = (i: number, d: number) => { const a = [...items]; const j = i + d; if (j < 0 || j >= a.length) return; [a[i], a[j]] = [a[j], a[i]]; setItems(a); };
  const save = async () => { try { await api("settings/departments", "PUT", { value: items }); notify("Departments saved."); } catch (e) { notify((e as Error).message, true); } };
  return <div className="adm-sec"><h2>Home page departments (scrolling section)</h2><Note n={n} />
    {items.map((d, i) => <div className="adm-form" key={i}><div className="adm-two"><label>Title<input type="text" value={d.title} onChange={(e) => upd(i, "title", e.target.value)} /></label><label>Link (e.g. /blog)<input type="text" value={d.href} onChange={(e) => upd(i, "href", e.target.value)} /></label></div><label>Caption<input type="text" value={d.caption} onChange={(e) => upd(i, "caption", e.target.value)} /></label><label>Image<ImageInput value={d.image} onChange={(v) => upd(i, "image", v)} /></label><div className="adm-actions"><button className="adm-btn ghost sm" onClick={() => move(i, -1)}>↑ Up</button><button className="adm-btn ghost sm" onClick={() => move(i, 1)}>↓ Down</button><button className="adm-btn danger sm" onClick={() => setItems(items.filter((_, j) => j !== i))}>Remove</button></div></div>)}
    <div className="adm-actions"><button className="adm-btn ghost" onClick={() => setItems([...items, { title: "New", href: "/", image: "", caption: "" }])}>+ Add department</button><button className="adm-btn" onClick={save}>Save departments</button></div></div>;
}
function SiteContent() {
  return <section><div className="adm-head"><h1>Site content</h1></div>
    <SettingSection id="hero" title="Home hero" fields={[{ k: "kicker", label: "Small heading" }, { k: "title", label: "Big title", type: "textarea", hint: "Press Enter for a new line" }, { k: "text", label: "Intro text", type: "textarea" }, { k: "cta", label: "Button text" }]} />
    <SettingSection id="ribbon" flat title="Scrolling ribbon" fields={[{ k: "value", label: "Ribbon text" }]} />
    <SettingSection id="about" flat title="About statement" fields={[{ k: "value", label: "About text (shown under the ribbon, linked from the 'About' menu item)", type: "textarea" }]} />
    <Departments />
    <SettingSection id="contact" title="Contact page" fields={[{ k: "title", label: "Heading" }, { k: "text", label: "Text", type: "textarea" }]} />
    <SettingSection id="footer" title="Footer & social links" fields={[{ k: "text", label: "Footer text" }, { k: "instagram", label: "Instagram URL", type: "url" }, { k: "linkedin", label: "LinkedIn URL", type: "url" }, { k: "copyright", label: "Copyright line" }]} />
  </section>;
}

/* ───────────── messages & admins ───────────── */
function Messages() {
  const [rows, setRows] = useState<Row[] | null>(null); const [n, notify] = useNotice();
  const load = useCallback(() => api<Row[]>("messages").then(setRows), []);
  useEffect(() => { void load(); }, [load]);
  const toggle = async (r: Row) => { await api(`messages/${r.id}`, "PUT", { is_read: !r.is_read }); await load(); };
  const del = async (r: Row) => { if (!confirm("Delete this message?")) return; await api(`messages/${r.id}`, "DELETE"); notify("Deleted."); await load(); };
  return <section><div className="adm-head"><h1>Contact messages</h1></div><Note n={n} />{!rows ? <p>Loading…</p> : !rows.length ? <p>No messages yet.</p> : <div className="adm-list">{rows.map((r) => <div className={`adm-row ${r.is_read ? "" : "unread"}`} key={String(r.id)}><div style={{ whiteSpace: "normal" }}><strong style={{ whiteSpace: "normal" }}>{String(r.author_name)} · <a href={`mailto:${r.email}`}>{String(r.email)}</a></strong><p style={{ margin: ".3rem 0", whiteSpace: "pre-wrap" }}>{String(r.message)}</p><small>{new Date(String(r.created_at)).toLocaleString()}</small></div><button className="adm-btn ghost sm" onClick={() => toggle(r)}>{r.is_read ? "Mark unread" : "Mark read"}</button><button className="adm-btn danger sm" onClick={() => del(r)}>Delete</button></div>)}</div>}</section>;
}

function Admins({ me, def }: { me: string; def: string }) {
  const [rows, setRows] = useState<Row[] | null>(null); const [email, setEmail] = useState(""); const [n, notify] = useNotice();
  const load = useCallback(() => api<Row[]>("admins").then(setRows), []);
  useEffect(() => { void load(); }, [load]);
  const add = async () => { try { await api("admins", "POST", { email }); setEmail(""); notify("Admin added. They can now sign in with Google at /admin."); await load(); } catch (e) { notify((e as Error).message, true); } };
  const del = async (r: Row) => { if (!confirm(`Remove ${r.email} as admin?`)) return; try { await api(`admins/${encodeURIComponent(String(r.email))}`, "DELETE"); notify("Removed."); await load(); } catch (e) { notify((e as Error).message, true); } };
  return <section><div className="adm-head"><h1>Admins</h1></div><Note n={n} />
    <div className="adm-form"><label>Add an admin by Google email<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@gmail.com" /></label><div><button className="adm-btn" onClick={add} disabled={!email}>Add admin</button></div></div>
    <div className="adm-list">{rows?.map((r) => <div className="adm-row" key={String(r.email)}><div><strong>{String(r.email)}{r.email === def ? " (default admin)" : ""}{r.email === me ? " (you)" : ""}</strong><small>Added by {String(r.added_by || "—")}</small></div>{r.email !== def && r.email !== me && <button className="adm-btn danger sm" onClick={() => del(r)}>Remove</button>}</div>)}</div></section>;
}

/* ───────────── field definitions ───────────── */
const F = {
  blog: [{ k: "title", label: "Title", req: true }, { k: "summary", label: "Summary", type: "textarea" }, { k: "cover", label: "Cover image", type: "image" }, { k: "body", label: "Article", type: "markdown" }, { k: "published", label: "Published", type: "bool" }] as Field[],
  podcasts: [{ k: "title", label: "Title", req: true }, { k: "description", label: "Description", type: "textarea" }, { k: "video_url", label: "YouTube / video URL", type: "url", req: true }, { k: "thumbnail_url", label: "Thumbnail", type: "image" }, { k: "published", label: "Published", type: "bool" }] as Field[],
  events: [{ k: "title", label: "Title", req: true }, { k: "description", label: "Short description", type: "textarea" }, { k: "event_date", label: "Date", type: "date" }, { k: "location", label: "Location" }, { k: "image_url", label: "Image", type: "image" }, { k: "body", label: "Full details", type: "markdown" }, { k: "application_url", label: "Apply link", type: "url" }, { k: "meeting_url", label: "Meeting link", type: "url" }, { k: "published", label: "Published", type: "bool" }] as Field[],
  announcements: [{ k: "title", label: "Title", req: true }, { k: "summary", label: "Summary", type: "textarea" }, { k: "cover", label: "Cover image", type: "image" }, { k: "body", label: "Content", type: "markdown" }, { k: "published", label: "Published", type: "bool" }] as Field[],
  heads: [{ k: "name", label: "Name", req: true }, { k: "role", label: "Role / department" }, { k: "image_url", label: "Photo", type: "image" }, { k: "featured", label: "Show on home page", type: "bool", hint: "with bio and links" }, { k: "bio", label: "Bio (home page only)", type: "textarea" }, { k: "linkedin", label: "LinkedIn URL", type: "url" }, { k: "instagram", label: "Instagram URL", type: "url" }, { k: "email", label: "Email" }, { k: "sort_order", label: "Order (smaller shows first)", type: "number" }, { k: "published", label: "Visible", type: "bool" }] as Field[],
  threads: [{ k: "title", label: "Title" }, { k: "body", label: "Text", type: "textarea" }] as Field[],
  replies: [{ k: "body", label: "Reply text", type: "textarea" }] as Field[],
  comments: [{ k: "body", label: "Comment text", type: "textarea" }] as Field[],
};

/* ───────────── app ───────────── */
type Tab = "overview" | "blog" | "podcasts" | "events" | "announcements" | "community" | "heads" | "site" | "messages" | "admins";
const TABS: [Tab, string][] = [["overview", "Overview"], ["blog", "Journal"], ["podcasts", "Podcasts"], ["events", "Events"], ["announcements", "Discussion"], ["community", "Community posts"], ["heads", "Heads"], ["site", "Home, About & Contact"], ["messages", "Messages"], ["admins", "Admins"]];

export default function AdminApp() {
  const [tab, setTab] = useState<Tab>("overview"); const [sub, setSub] = useState<"threads" | "replies" | "comments">("threads");
  const [menu, setMenu] = useState(false);
  const [me, setMe] = useState<{ email: string; defaultAdmin: string } | null>(null); const [stats, setStats] = useState<Record<string, number>>({});
  useEffect(() => { api<{ email: string; defaultAdmin: string }>("me").then(setMe); }, []);
  useEffect(() => { api<Record<string, number>>("stats").then(setStats).catch(() => {}); }, [tab]);
  if (!me) return null;
  let body: ReactNode;
  switch (tab) {
    case "blog": body = <Manager res="blog" title="Journal" fields={F.blog} titleKey="title" subKey="summary" />; break;
    case "podcasts": body = <Manager res="podcasts" title="Podcasts" fields={F.podcasts} titleKey="title" subKey="video_url" />; break;
    case "events": body = <Manager res="events" title="Events" fields={F.events} titleKey="title" extra={(r) => [r.event_date, r.location].filter(Boolean).join(" · ")} />; break;
    case "announcements": body = <Manager res="announcements" title="Discussion page" fields={F.announcements} titleKey="title" subKey="summary" />; break;
    case "heads": body = <Manager res="heads" title="Heads" fields={F.heads} titleKey="name" extra={(r) => `${r.role || ""}${r.featured ? " · on home page" : ""}`} />; break;
    case "community": body = <><div className="adm-sub">{(["threads", "replies", "comments"] as const).map((s) => <button key={s} className={sub === s ? "on" : ""} onClick={() => setSub(s)}>{s}</button>)}</div>
      {sub === "threads" && <Manager key="t" res="threads" title="Discussion threads" fields={F.threads} titleKey="title" subKey="author_name" create={false} />}
      {sub === "replies" && <Manager key="r" res="replies" title="Replies" fields={F.replies} titleKey="body" extra={(r) => `${r.author_name} on “${r.thread_title}”`} create={false} />}
      {sub === "comments" && <Manager key="c" res="comments" title="Journal comments" fields={F.comments} titleKey="body" extra={(r) => `${r.author_name} on ${r.post_slug}`} create={false} />}</>; break;
    case "site": body = <SiteContent />; break;
    case "messages": body = <Messages />; break;
    case "admins": body = <Admins me={me.email} def={me.defaultAdmin} />; break;
    default: body = <section><div className="adm-head"><h1>Overview</h1></div><div className="adm-cards">{([["blog", "Journal posts", "blog"], ["podcasts", "Podcasts", "podcasts"], ["events", "Events", "events"], ["announcements", "Discussion posts", "announcements"], ["heads", "Heads", "heads"], ["unread", "Unread messages", "messages"], ["comments", "Comments", "community"]] as [string, string, Tab][]).map(([k, label, t]) => <button key={k} className="adm-card" onClick={() => setTab(t)}><b>{stats[k] ?? "–"}</b><span>{label}</span></button>)}</div><p style={{ marginTop: "1.5rem" }}><a href="/" target="_blank">View live site ↗</a></p></section>;
  }
  const pick = (id: Tab) => { setTab(id); setMenu(false); window.scrollTo({ top: 0 }); };
  const cur = TABS.find(([id]) => id === tab)?.[1] || "Overview";
  return <div className="adm"><aside className={`adm-side ${menu ? "open" : ""}`}><div className="adm-top"><div className="adm-brand"><small>Admin</small>ThinkEconomics</div><span className="adm-cur">{cur}</span><button className="adm-burger" aria-label={menu ? "Close menu" : "Open menu"} aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? <CloseIcon size={22} /> : <MenuIcon size={22} />}</button></div><nav className="adm-tabs">{TABS.map(([id, label]) => <button key={id} className={tab === id ? "on" : ""} onClick={() => pick(id as Tab)}>{label}{id === "messages" && stats.unread ? <span className="adm-badge">{stats.unread}</span> : null}</button>)}</nav><div className="adm-me">{me.email}<br /><SignOutButton redirectUrl="/admin"><button style={{ padding: ".3rem 0", color: "#fff", textDecoration: "underline" }}>Sign out</button></SignOutButton></div></aside>{menu && <div className="adm-scrim" onClick={() => setMenu(false)} />}<div className="adm-main">{body}</div></div>;
}
