import { q, DEFAULT_SETTINGS } from "./db";
import { cached } from "./redis";

export type Meta = typeof DEFAULT_SETTINGS.meta;

/** Search/social settings edited in Admin → Site content. Cached in Redis; falls back to defaults if the DB is unreachable. */
export async function getMeta(): Promise<Meta> {
  try {
    const res = await cached("meta", async () => {
      const r = await q<{ value: Partial<Meta> }>("SELECT value FROM settings WHERE key='meta'");
      return Response.json({ ...DEFAULT_SETTINGS.meta, ...(r[0]?.value || {}) });
    });
    const saved = (await res.json()) as Partial<Meta>;
    const out = { ...DEFAULT_SETTINGS.meta };
    for (const k of Object.keys(out) as (keyof Meta)[]) if (saved[k]) out[k] = saved[k] as string;
    return out;
  } catch { return DEFAULT_SETTINGS.meta; }
}

export function siteUrl() {
  const u = process.env.NEXT_PUBLIC_SITE_URL || process.env.RENDER_EXTERNAL_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`) || (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) || "http://localhost:3000";
  return new URL(u.startsWith("http") ? u : `https://${u}`);
}

/** Image field accepts a full URL, a /path (uploads too), or an Unsplash photo id. */
export const imageUrl = (v: string) => (!v ? "" : v.startsWith("http") || v.startsWith("/") ? v : `https://images.unsplash.com/${v}?auto=format&fit=crop&w=1200&q=80`);
