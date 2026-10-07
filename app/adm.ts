import { q, DEFAULT_ADMIN, DEFAULT_SETTINGS } from "./db";
import { getAdmin, json, slugify } from "./auth";

type Ctx = { params: Promise<{ path: string[] }> };
type T = "s" | "n" | "b" | "i" | "d"; // required string, nullable string, boolean, integer, nullable date

const RES: Record<string, { table: string; cols: Record<string, T>; slug?: boolean; order: string; select?: string; create?: boolean }> = {
  blog: { table: "blog_posts", slug: true, order: "created_at DESC", cols: { title: "s", summary: "s", body: "s", cover: "n", published: "b" } },
  podcasts: { table: "podcasts", order: "created_at DESC", cols: { title: "s", description: "s", video_url: "s", thumbnail_url: "n", published: "b" } },
  events: { table: "events", slug: true, order: "events.event_date DESC NULLS LAST, events.created_at DESC", select: "*, event_date::text AS event_date", cols: { title: "s", description: "s", body: "n", event_date: "d", location: "n", image_url: "n", application_url: "n", meeting_url: "n", published: "b" } },
  announcements: { table: "announcements", slug: true, order: "created_at DESC", cols: { title: "s", summary: "s", body: "s", cover: "n", published: "b" } },
  heads: { table: "heads", order: "sort_order, created_at", cols: { name: "s", role: "s", bio: "n", image_url: "n", linkedin: "n", instagram: "n", email: "n", featured: "b", sort_order: "i", published: "b" } },
  threads: { table: "discussion_threads", order: "created_at DESC", create: false, cols: { title: "s", body: "s" } },
  replies: { table: "discussion_replies", order: "created_at DESC", create: false, select: "r.*, (SELECT title FROM discussion_threads t WHERE t.id=r.thread_id) AS thread_title", cols: { body: "s" } },
  comments: { table: "comments", order: "created_at DESC", create: false, cols: { body: "s" } },
  messages: { table: "contact_messages", order: "created_at DESC", create: false, cols: { is_read: "b" } },
};
const UUID = /^[0-9a-f-]{36}$/i;

function coerce(t: T, v: unknown): unknown {
  if (t === "b") return v === true || v === "true";
  if (t === "i") return Math.trunc(Number(v)) || 0;
  const s = typeof v === "string" ? v.trim() : v == null ? "" : String(v);
  if (t === "n" || t === "d") return s === "" ? null : s;
  return s;
}

async function uniqueSlug(table: string, base: string) {
  let slug = base;
  for (let i = 0; i < 5; i++) {
    if (!(await q(`SELECT 1 FROM ${table} WHERE slug=$1`, [slug])).length) return slug;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return slug;
}

async function parseDocument(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Choose a Markdown or PDF file." }, 400);
  if (file.size > 12 * 1024 * 1024) return json({ error: "Files must be 12 MB or smaller." }, 413);
  const ext = file.name.toLowerCase().split(".").pop();
  try {
    let body = ""; let pages: number | null = null;
    if (ext === "md" || ext === "markdown") body = (await file.text()).trim();
    else if (ext === "pdf") {
      const { extractText } = await import("unpdf");
      const r = await extractText(new Uint8Array(await file.arrayBuffer()), { mergePages: true });
      body = r.text.replace(/\u0000/g, "").replace(/-\n(?=\p{Ll})/gu, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      pages = r.totalPages;
    } else return json({ error: "Only .md, .markdown, and .pdf files are supported." }, 415);
    if (!body) return json({ error: "No readable text was found in this file." }, 422);
    if (body.length > 250_000) return json({ error: "The article is too long (max 250,000 characters)." }, 413);
    return json({ body, fileName: file.name, pages });
  } catch { return json({ error: "This document could not be converted. Scanned PDFs need OCR first." }, 422); }
}

async function upload(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return json({ error: "Choose an image." }, 400);
  if (!/^image\/(jpeg|png|webp|gif|avif)$/.test(file.type)) return json({ error: "Use a JPG, PNG, WebP, GIF or AVIF image." }, 415);
  if (file.size > 4 * 1024 * 1024) return json({ error: "Images must be 4 MB or smaller." }, 413);
  const r = await q<{ id: string }>("INSERT INTO media(name,mime,data) VALUES ($1,$2,$3) RETURNING id", [file.name.slice(0, 120), file.type, Buffer.from(await file.arrayBuffer())]);
  return json({ url: `/api?p=media/${r[0].id}` });
}

export async function handle(request: Request, ctx: Ctx) {
  const admin = await getAdmin();
  if (!admin) return json({ error: "Unauthorized" }, 401);
  const [name, id] = (await ctx.params).path;
  const method = request.method;
  try {
    if (name === "me" && method === "GET") return json({ email: admin.email, name: admin.name, defaultAdmin: DEFAULT_ADMIN });
    if (name === "parse-document" && method === "POST") return parseDocument(request);
    if (name === "upload" && method === "POST") return upload(request);

    if (name === "stats" && method === "GET") {
      const tables = { blog: "blog_posts", podcasts: "podcasts", events: "events", announcements: "announcements", heads: "heads", threads: "discussion_threads", replies: "discussion_replies", comments: "comments", messages: "contact_messages" };
      const out: Record<string, number> = {};
      for (const [k, t] of Object.entries(tables)) out[k] = Number((await q<{ c: string }>(`SELECT count(*) c FROM ${t}`))[0].c);
      out.unread = Number((await q<{ c: string }>("SELECT count(*) c FROM contact_messages WHERE NOT is_read"))[0].c);
      return json(out);
    }

    if (name === "settings") {
      if (method === "GET") {
        const rows = await q<{ key: string; value: unknown }>("SELECT key,value FROM settings WHERE key<>'seeded'");
        return json({ ...DEFAULT_SETTINGS, ...Object.fromEntries(rows.map((r) => [r.key, r.value])) });
      }
      if (method === "PUT" && id && id in DEFAULT_SETTINGS) {
        const { value } = await request.json();
        await q("INSERT INTO settings(key,value) VALUES ($1,$2) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value", [id, JSON.stringify(value)]);
        return json({ ok: true });
      }
      return json({ error: "Bad request" }, 400);
    }

    if (name === "admins") {
      if (method === "GET") return json(await q("SELECT email,added_by,created_at FROM admins ORDER BY created_at"));
      const data = method === "POST" ? await request.json() : {};
      if (method === "POST") {
        const email = String(data.email || "").trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Enter a valid email address." }, 400);
        await q("INSERT INTO admins(email,added_by) VALUES ($1,$2) ON CONFLICT DO NOTHING", [email, admin.email]);
        return json({ ok: true });
      }
      if (method === "DELETE" && id) {
        const email = decodeURIComponent(id).toLowerCase();
        if (email === DEFAULT_ADMIN) return json({ error: "The default admin cannot be removed." }, 400);
        if (email === admin.email) return json({ error: "You cannot remove yourself." }, 400);
        await q("DELETE FROM admins WHERE email=$1", [email]);
        return json({ ok: true });
      }
      return json({ error: "Bad request" }, 400);
    }

    const r = RES[name];
    if (!r) return json({ error: "Not found" }, 404);
    if (method === "GET") {
      const alias = r.select?.includes("r.*") ? " r" : "";
      return json(await q(`SELECT ${r.select || "*"} FROM ${r.table}${alias} ORDER BY ${r.order}`));
    }
    if (method === "DELETE") {
      if (!id || !UUID.test(id)) return json({ error: "Bad id" }, 400);
      await q(`DELETE FROM ${r.table} WHERE id=$1`, [id]);
      return json({ ok: true });
    }
    const data = await request.json();
    const entries = Object.entries(r.cols).filter(([k]) => k in data);
    if (method === "POST" && r.create !== false) {
      const row: Record<string, unknown> = {};
      for (const [k, t] of Object.entries(r.cols)) row[k] = k in data ? coerce(t, data[k]) : t === "b" ? (k === "published") : t === "i" ? 0 : t === "s" ? "" : null;
      const required = r.cols.title ? "title" : "name" in r.cols ? "name" : "video_url";
      if (!row[required]) return json({ error: "Please fill in the required fields." }, 400);
      if (r.slug) row.slug = await uniqueSlug(r.table, slugify(String(row.title)));
      const keys = Object.keys(row);
      const created = await q(`INSERT INTO ${r.table} (${keys.join(",")}) VALUES (${keys.map((_, i) => `$${i + 1}`).join(",")}) RETURNING *`, keys.map((k) => row[k]));
      return json(created[0]);
    }
    if (method === "PUT") {
      if (!id || !UUID.test(id)) return json({ error: "Bad id" }, 400);
      if (!entries.length) return json({ error: "Nothing to update" }, 400);
      const sets = entries.map(([k], i) => `${k}=$${i + 2}`);
      if (r.table === "blog_posts") sets.push("updated_at=now()");
      await q(`UPDATE ${r.table} SET ${sets.join(",")} WHERE id=$1`, [id, ...entries.map(([k, t]) => coerce(t, data[k]))]);
      return json({ ok: true });
    }
  } catch (e) {
    console.error(e);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
  return json({ error: "Method not allowed" }, 405);
}


