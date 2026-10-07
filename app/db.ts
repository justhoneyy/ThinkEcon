import { Pool } from "pg";

export const DEFAULT_ADMIN = (process.env.DEFAULT_ADMIN_EMAIL || "abhinav.hadaa@gmail.com").toLowerCase();

const g = globalThis as unknown as { __pool?: Pool; __ready?: Promise<void> };

function pool() {
  if (!g.__pool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    const local = /localhost|127\.0\.0\.1/.test(url);
    const ssl = process.env.DATABASE_SSL === "false" || local ? false : { rejectUnauthorized: false };
    g.__pool = new Pool({ connectionString: url, ssl, max: Number(process.env.DATABASE_POOL_MAX || 5), idleTimeoutMillis: 20_000, connectionTimeoutMillis: 10_000 });
  }
  return g.__pool;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS admins (email text PRIMARY KEY, added_by text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS settings (key text PRIMARY KEY, value jsonb NOT NULL);
CREATE TABLE IF NOT EXISTS media (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, mime text NOT NULL, data bytea NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS blog_posts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE NOT NULL, title text NOT NULL, summary text NOT NULL DEFAULT '', body text NOT NULL DEFAULT '', cover text, published boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS podcasts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, description text NOT NULL DEFAULT '', video_url text NOT NULL, thumbnail_url text, published boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS events (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE NOT NULL, title text NOT NULL, description text NOT NULL DEFAULT '', body text, event_date date, location text, image_url text, application_url text, meeting_url text, published boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS announcements (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slug text UNIQUE NOT NULL, title text NOT NULL, summary text NOT NULL DEFAULT '', body text NOT NULL DEFAULT '', cover text, published boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS heads (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, role text NOT NULL DEFAULT '', bio text, image_url text, linkedin text, instagram text, email text, featured boolean NOT NULL DEFAULT false, sort_order int NOT NULL DEFAULT 0, published boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS discussion_threads (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, body text NOT NULL, author_name text NOT NULL, author_email text, clerk_user_id text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS discussion_replies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid NOT NULL REFERENCES discussion_threads(id) ON DELETE CASCADE, body text NOT NULL, author_name text NOT NULL, author_email text, clerk_user_id text, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS comments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), post_slug text NOT NULL, author_id text, author_name text NOT NULL, body text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS contact_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), author_id text, author_name text, email text, message text NOT NULL, is_read boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS comments_slug_idx ON comments(post_slug);
CREATE INDEX IF NOT EXISTS replies_thread_idx ON discussion_replies(thread_id);
`;

const L = (n: string) => `https://i.postimg.cc/${n}`;
const HEADS: [string, string, string, string, boolean][] = [
  ["Vaidehi", "President", L("L5qYXLJX/IMG-20260626-WA0014.jpg"), "Founded ThinkEconomics to connect student research with public policy and real-world questions.", true],
  ["Swarnika", "Vice President", L("pd2mjgmZ/IMG-20260626-WA0015.jpg"), "Leads cross-functional collaboration and helps strengthen research across the community.", true],
  ["Hiyanjani", "Secretary General", "/heads/hiyanjani-web.jpg", "", false],
  ["Tanishqa", "Editorial", L("SRc5xZmp/IMG-20260702-WA0004.jpg"), "", false],
  ["Abhinav", "Tech & Operations", L("zvmHPpzc/lv-0-20260624171114.jpg"), "", false],
  ["Srishti", "Tech & Operations", L("bN1QQrXM/Screenshot-20260626-183348-Insta-Gold-2.jpg"), "", false],
  ["Yogita", "Social Media", L("DZLRKYcd/IMG-20260626-WA0005.jpg"), "", false],
  ["Kashvi", "Social Media", L("nzFqHXKp/IMG-20260626-WA0008.jpg"), "", false],
  ["Rida", "Design", "/heads/rida-web.jpg", "", false],
  ["Aastha", "Design", L("Cx557jF7/IMG-20260626-WA0004.jpg"), "", false],
  ["Nikita", "Editorial", "/heads/nikita-web.jpg", "", false],
  ["Aarsi", "Podcast", L("SxQ4fqG0/IMG-20260626-WA0007.jpg"), "", false],
  ["Nishka", "Outreach", L("fTR5FyqM/IMG-20260626-WA0009.jpg"), "", false],
  ["Chetana", "Outreach", L("wTvFXGmM/IMG-20260626-WA0010.jpg"), "", false],
  ["Touseeb", "Discussion", "/heads/touseeb-web.jpg", "", false],
  ["Vaibhav", "Discussion", L("rFsCjbzk/IMG-20260626-WA0012.jpg"), "", false],
  ["Prapti", "Research Projects", "/heads/prapti-web.jpg", "", false],
  ["Yashvi", "Research Projects", L("PJfZCJjy/IMG-20260702-WA0005.jpg"), "", false],
];
const LEAD_LINKS: Record<string, [string, string, string]> = {
  Vaidehi: ["https://www.linkedin.com/in/think-economics-a534a741a/?isSelfProfile=true", "https://www.instagram.com/think_economics_", "thinkecon@gmail.com"],
  Swarnika: ["https://www.linkedin.com/in/swarnika-hada-951974415", "https://www.instagram.com/kyuna.mi/", "swarnikahadaa@gmail.com"],
};

export const DEFAULT_SETTINGS = {
  hero: { kicker: "Student-led economics", title: "Young minds.\nPublic ideas.", text: "ThinkEconomics is where students research, publish, discuss, and build a sharper view of the world.", cta: "Join ThinkEconomics" },
  ribbon: "Research • Editorial • Podcasts • Public Policy • Design • Outreach •",
  about: "Economics is not only theory. It is how people make choices, build systems, and shape everyday life.",
  departments: [
    { title: "Editorial", href: "/blog", image: "photo-1455390582262-044cdead277a", caption: "Newsletters, magazines, articles, and blogs." },
    { title: "Podcasts", href: "/podcasts", image: "photo-1590602847861-f357a9332bbc", caption: "Conversations worth hearing." },
    { title: "Discussion", href: "/discussion", image: "photo-1528605248644-14dd04022da1", caption: "Debates and ideas that deserve time." },
  ],
  contact: { title: "Bring a good question.", text: "Want to collaborate, contribute, or invite ThinkEconomics into a conversation? Reach out." },
  footer: { text: "Research, editorial work, podcasts, and public conversations.", instagram: "https://www.instagram.com/think_economics_", linkedin: "https://www.linkedin.com/in/think-economics-a534a741a/?isSelfProfile=true", copyright: "© 2026 ThinkEconomics" },
};

async function init() {
  const c = await pool().connect();
  try {
    await c.query("SELECT pg_advisory_lock(727001)"); // several serverless instances may boot at once
    await c.query(SCHEMA);
    await c.query("INSERT INTO admins(email, added_by) VALUES ($1,'system') ON CONFLICT DO NOTHING", [DEFAULT_ADMIN]);
    if ((await c.query("SELECT 1 FROM settings WHERE key='seeded'")).rowCount) return;
    for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) await c.query("INSERT INTO settings(key,value) VALUES ($1,$2) ON CONFLICT DO NOTHING", [k, JSON.stringify(v)]);
    let i = 0;
    for (const [name, role, img, bio, featured] of HEADS) {
      const l = LEAD_LINKS[name] || [null, null, null];
      await c.query("INSERT INTO heads(name,role,bio,image_url,linkedin,instagram,email,featured,sort_order) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)", [name, role, bio, img, l[0], l[1], l[2], featured, i++]);
    }
    await c.query(
      "INSERT INTO announcements(slug,title,summary,body,cover) VALUES ($1,$2,$3,$4,$5) ON CONFLICT DO NOTHING",
      ["debate-competition-results", "Debate competition results", "Highlights from the ThinkEconomics debate competition.", "Edit this announcement from the admin panel (Discussion tab).\n\nlocalimage:debate-1\n\nlocalimage:debate-2\n\nlocalimage:debate-3", "local:debate-1"],
    );
    await c.query("INSERT INTO settings(key,value) VALUES ('seeded','true')");
  } finally {
    await c.query("SELECT pg_advisory_unlock(727001)").catch(() => {});
    c.release();
  }
}

export async function db() {
  if (!g.__ready) g.__ready = init().catch((e) => { g.__ready = undefined; throw e; });
  await g.__ready;
  return pool();
}

export async function q<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const p = await db();
  return (await p.query(text, params)).rows as T[];
}
