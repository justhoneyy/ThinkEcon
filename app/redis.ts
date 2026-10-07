// Optional cache. Supports Upstash REST (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN, also KV_REST_API_URL/TOKEN)
// and classic Redis (REDIS_URL via ioredis). With neither set, everything works uncached.
const TTL = Number(process.env.REDIS_TTL || 300);
const REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

type Cmd = (string | number)[];
type Backend = { run: (cmd: Cmd) => Promise<unknown> } | null;
const g = globalThis as unknown as { __cache?: Backend };

const within = <T,>(p: Promise<T>, ms = 1200) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("cache timeout")), ms))]);

function backend(): Backend {
  if (g.__cache !== undefined) return g.__cache;
  if (REST_URL && REST_TOKEN) {
    g.__cache = { run: async (cmd) => {
      const r = await fetch(REST_URL, { method: "POST", headers: { Authorization: `Bearer ${REST_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(cmd), cache: "no-store" });
      const d = (await r.json()) as { result?: unknown; error?: string };
      if (!r.ok || d.error) throw new Error(d.error || `HTTP ${r.status}`);
      return d.result;
    } };
  } else if (process.env.REDIS_URL) {
    const url = process.env.REDIS_URL;
    let client: import("ioredis").default | null = null;
    g.__cache = { run: async (cmd) => {
      if (!client) {
        const { default: Redis } = await import("ioredis");
        client = new Redis(url, { maxRetriesPerRequest: 1, connectTimeout: 2000, tls: url.startsWith("rediss://") ? {} : undefined });
        client.on("error", () => {});
      }
      return client.call(String(cmd[0]), ...cmd.slice(1).map(String));
    } };
  } else g.__cache = null;
  return g.__cache;
}

const call = (b: NonNullable<Backend>, cmd: Cmd) => within(b.run(cmd));

export async function cached(key: string, produce: () => Promise<Response>): Promise<Response> {
  const b = backend();
  if (!b) return produce();
  let k = "";
  try {
    const v = (await call(b, ["GET", "te:v"])) || "0";
    k = `te:${v}:${key}`;
    const hit = await call(b, ["GET", k]);
    if (typeof hit === "string" && hit) return new Response(hit, { headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Cache": "HIT" } });
  } catch (e) { console.error("[cache] read failed, serving uncached:", (e as Error).message); return produce(); }
  const res = await produce();
  if (res.status === 200 && k) { try { await call(b, ["SET", k, await res.clone().text(), "EX", TTL]); } catch (e) { console.error("[cache] write failed:", (e as Error).message); } }
  return res;
}

export async function invalidate() {
  const b = backend();
  if (b) try { await call(b, ["INCR", "te:v"]); } catch (e) { console.error("[cache] invalidate failed:", (e as Error).message); }
}

export async function redisStatus(): Promise<string> {
  const b = backend();
  if (!b) return "off (set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)";
  try { await call(b, ["PING"]); return REST_URL ? "ok (upstash)" : "ok"; }
  catch (e) { return `error: ${(e as Error).message.slice(0, 80)}`; }
}
