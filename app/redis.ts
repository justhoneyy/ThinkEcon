import Redis from "ioredis";

// Optional cache: set REDIS_URL (e.g. redis://default:pass@host:6379). Without it everything still works, just uncached.
const g = globalThis as unknown as { __redis?: Redis | null };
const TTL = Number(process.env.REDIS_TTL || 300);

function client() {
  if (g.__redis !== undefined) return g.__redis;
  const url = process.env.REDIS_URL;
  if (!url) return (g.__redis = null);
  const r = new Redis(url, { maxRetriesPerRequest: 1, connectTimeout: 2000, enableOfflineQueue: false, lazyConnect: false, tls: url.startsWith("rediss://") ? {} : undefined });
  r.on("error", () => {}); // never crash the site because the cache is down
  return (g.__redis = r);
}

/** Version number baked into every key; bumping it invalidates the whole cache at once. */
async function version(r: Redis) { return (await r.get("te:v")) || "0"; }

const within = <T,>(p: Promise<T>, ms = 800) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("redis timeout")), ms))]);

export async function cached(key: string, produce: () => Promise<Response>): Promise<Response> {
  let r: Redis | null = null;
  try { r = client(); } catch (e) { console.error("[redis] init failed:", (e as Error).message); }
  if (!r) return produce();
  let k = "";
  try {
    k = `te:${await within(version(r))}:${key}`;
    const hit = await within(r.get(k));
    if (hit) return new Response(hit, { headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Cache": "HIT" } });
  } catch (e) { console.error("[redis] read failed, serving uncached:", (e as Error).message); return produce(); }
  const res = await produce();
  if (res.status === 200 && k) { try { await within(r.set(k, await res.clone().text(), "EX", TTL)); } catch {} }
  return res;
}

export async function invalidate() {
  const r = client();
  if (r) try { await within(r.incr("te:v")); } catch {}
}
