import { q } from "./db";
import { getUser, isAdminEmail, json } from "./auth";
import { cached, invalidate, redisStatus } from "./redis";

type Ctx = { params: Promise<{ path: string[] }> };

const POST_COLS = "slug,title,summary,body,cover,created_at";
const EVENT_COLS = "slug,title,description,body,event_date::text AS event_date,location,image_url,application_url,meeting_url";

const CACHEABLE = new Set(["settings", "home", "latest", "posts", "podcasts", "events", "announcements", "heads", "threads", "comments"]);
export async function pubGet(req: Request, ctx: Ctx) {
  const path = (await ctx.params).path;
  if (path[0] === "health") {
    let database = "ok";
    try { await q("SELECT 1"); } catch (e) { const x = e as { code?: string; message?: string }; database = `error: ${x.code || x.message?.slice(0, 80) || "unknown"}`; }
    const redis = await redisStatus();
    return json({ ok: database === "ok", database, redis }, database === "ok" ? 200 : 500);
  }
  if (!CACHEABLE.has(path[0])) return pubGetRaw(req, ctx);
  return cached(path.join("/"), () => pubGetRaw(req, ctx));
}

type LatestItem = { kind: "post" | "podcast" | "event" | "discussion"; title: string; href: string; image: string | null; video_url?: string; created_at: string };
async function latestItems(): Promise<LatestItem[]> {
  const [p, pc, e, a] = await Promise.all([
    q<{ slug: string; title: string; cover: string | null; created_at: string }>("SELECT slug,title,cover,created_at FROM blog_posts WHERE published"),
    q<{ title: string; video_url: string; thumbnail_url: string | null; created_at: string }>("SELECT title,video_url,thumbnail_url,created_at FROM podcasts WHERE published"),
    q<{ slug: string; title: string; image_url: string | null; created_at: string }>("SELECT slug,title,image_url,created_at FROM events WHERE published"),
    q<{ slug: string; title: string; cover: string | null; created_at: string }>("SELECT slug,title,cover,created_at FROM announcements WHERE published"),
  ]);
  return [
    ...p.map((x): LatestItem => ({ kind: "post", title: x.title, href: `/blog/${x.slug}`, image: x.cover, created_at: x.created_at })),
    ...pc.map((x): LatestItem => ({ kind: "podcast", title: x.title, href: "/podcasts", image: x.thumbnail_url, video_url: x.video_url, created_at: x.created_at })),
    ...e.map((x): LatestItem => ({ kind: "event", title: x.title, href: `/events/${x.slug}`, image: x.image_url, created_at: x.created_at })),
    ...a.map((x): LatestItem => ({ kind: "discussion", title: x.title, href: `/announcements/${x.slug}`, image: x.cover, created_at: x.created_at })),
  ].sort((m, n) => +new Date(n.created_at) - +new Date(m.created_at));
}

async function pubGetRaw(_: Request, ctx: Ctx) {
  const [a, b] = (await ctx.params).path;
  try {
    switch (a) {
      case "health": await q("SELECT 1"); return json({ ok: true });
      case "settings": {
        const rows = await q<{ key: string; value: unknown }>("SELECT key,value FROM settings WHERE key<>'seeded'");
        return json(Object.fromEntries(rows.map((r) => [r.key, r.value])));
      }
      case "latest": return json(await latestItems());
      case "home": {
        const [posts, podcasts, events, heads, cnt] = await Promise.all([
          q(`SELECT ${POST_COLS} FROM blog_posts WHERE published ORDER BY created_at DESC LIMIT 1`),
          q("SELECT title,description,video_url,thumbnail_url FROM podcasts WHERE published ORDER BY created_at DESC LIMIT 1"),
          q(`SELECT ${EVENT_COLS} FROM events WHERE published ORDER BY event_date ASC NULLS LAST, created_at DESC LIMIT 1`),
          q("SELECT id,name,role,bio,image_url,linkedin,instagram,email FROM heads WHERE published AND featured ORDER BY sort_order,created_at"),
          q<Record<string, string>>("SELECT (SELECT count(*) FROM heads WHERE published) AS heads,(SELECT count(*) FROM blog_posts WHERE published) AS posts,(SELECT count(*) FROM podcasts WHERE published) AS podcasts,(SELECT count(*) FROM events WHERE published) AS events"),
        ]);
        return json({ counts: Object.fromEntries(Object.entries(cnt[0] || {}).map(([k, v]) => [k, Number(v)])), post: posts[0] || null, podcast: podcasts[0] || null, event: events[0] || null, heads, latest: (await latestItems()).slice(0, 2) });
      }
      case "posts":
        if (b) { const r = await q(`SELECT ${POST_COLS} FROM blog_posts WHERE published AND slug=$1`, [b]); return r[0] ? json(r[0]) : json({ error: "Not found" }, 404); }
        return json(await q(`SELECT ${POST_COLS} FROM blog_posts WHERE published ORDER BY created_at DESC`));
      case "podcasts": return json(await q("SELECT id,title,description,video_url,thumbnail_url FROM podcasts WHERE published ORDER BY created_at DESC"));
      case "events":
        if (b) { const r = await q(`SELECT ${EVENT_COLS} FROM events WHERE published AND slug=$1`, [b]); return r[0] ? json(r[0]) : json({ error: "Not found" }, 404); }
        return json(await q(`SELECT ${EVENT_COLS} FROM events WHERE published ORDER BY event_date ASC NULLS LAST, created_at DESC`));
      case "announcements":
        if (b) { const r = await q("SELECT slug,title,summary,body,cover FROM announcements WHERE published AND slug=$1", [b]); return r[0] ? json(r[0]) : json({ error: "Not found" }, 404); }
        return json(await q("SELECT slug,title,summary,body,cover FROM announcements WHERE published ORDER BY created_at DESC"));
      case "heads": return json(await q("SELECT id,name,role,image_url FROM heads WHERE published ORDER BY sort_order,created_at"));
      case "threads": {
        if (!b) return json(await q("SELECT id,title,body,author_name,created_at FROM discussion_threads ORDER BY created_at DESC"));
        if (!/^[0-9a-f-]{36}$/i.test(b)) return json({ error: "Not found" }, 404);
        const t = await q("SELECT id,title,body,author_name,created_at FROM discussion_threads WHERE id=$1", [b]);
        if (!t[0]) return json({ error: "Not found" }, 404);
        return json({ thread: t[0], replies: await q("SELECT id,thread_id,body,author_name,created_at FROM discussion_replies WHERE thread_id=$1 ORDER BY created_at", [b]) });
      }
      case "comments": return json(await q("SELECT id,author_name,body FROM comments WHERE post_slug=$1 ORDER BY created_at DESC", [b || ""]));
      case "me": {
        const u = await getUser();
        return json({ signedIn: Boolean(u), admin: Boolean(u?.verified && await isAdminEmail(u.email)) });
      }
    }
  } catch (e) { console.error("[api]", a, e); return json({ error: "Server error" }, 500); }
  return json({ error: "Not found" }, 404);
}

export async function pubPost(request: Request, ctx: Ctx) {
  const res = await pubPostRaw(request, ctx);
  if (res.ok) await invalidate();
  return res;
}

async function pubPostRaw(request: Request, ctx: Ctx) {
  const [a] = (await ctx.params).path;
  const user = await getUser();
  if (!user) return json({ error: "Sign in to continue." }, 401);
  let d: Record<string, unknown>;
  try { d = await request.json(); } catch { return json({ error: "Bad request" }, 400); }
  const s = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
  try {
    if (a === "discussion") {
      const body = s(d.body, 5000);
      if (!body) return json({ error: "Write something first." }, 400);
      if (d.threadId) {
        const id = s(d.threadId, 40);
        if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "Bad thread" }, 400);
        const r = await q("INSERT INTO discussion_replies(thread_id,body,author_name,author_email,clerk_user_id) VALUES ($1,$2,$3,$4,$5) RETURNING id,thread_id,body,author_name,created_at", [id, body, user.name, user.email, user.id]);
        return json(r[0]);
      }
      const title = s(d.title, 160);
      if (!title) return json({ error: "Add a title." }, 400);
      const r = await q("INSERT INTO discussion_threads(title,body,author_name,author_email,clerk_user_id) VALUES ($1,$2,$3,$4,$5) RETURNING id,title,body,author_name,created_at", [title, body, user.name, user.email, user.id]);
      return json(r[0]);
    }
    if (a === "comments") {
      const body = s(d.body, 3000), slug = s(d.postSlug, 120);
      if (!body || !slug) return json({ error: "Write something first." }, 400);
      const r = await q("INSERT INTO comments(post_slug,author_id,author_name,body) VALUES ($1,$2,$3,$4) RETURNING id,author_name,body", [slug, user.id, user.name, body]);
      return json(r[0]);
    }
    if (a === "contact") {
      const message = s(d.message, 5000);
      if (!message) return json({ error: "Write a message first." }, 400);
      await q("INSERT INTO contact_messages(author_id,author_name,email,message) VALUES ($1,$2,$3,$4)", [user.id, user.name, user.email, message]);
      return json({ ok: true });
    }
  } catch { return json({ error: "Server error" }, 500); }
  return json({ error: "Not found" }, 404);
}

export async function media(id: string) {
  if (!/^[0-9a-f-]{36}$/i.test(id || "")) return new Response("Not found", { status: 404 });
  const r = await q<{ mime: string; data: Buffer }>("SELECT mime,data FROM media WHERE id=$1", [id]);
  if (!r[0]) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(r[0].data), { headers: { "Content-Type": r[0].mime, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" } });
}
