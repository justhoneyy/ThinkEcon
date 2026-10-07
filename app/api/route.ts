import { pubGet, pubPost, media } from "../pub";
import { handle as admin } from "../adm";
import { invalidate } from "../redis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Every API call is /api?p=<route>, e.g. /api?p=posts, /api?p=admin/blog, /api?p=media/<id>
async function route(req: Request) {
  const path = (new URL(req.url).searchParams.get("p") || "").split("/").filter(Boolean);
  const ctx = { params: Promise.resolve({ path }) };
  if (path[0] === "admin") {
    const res = await admin(req, { params: Promise.resolve({ path: path.slice(1) }) });
    if (req.method !== "GET" && res.ok) await invalidate(); // any admin edit refreshes the cache
    return res;
  }
  if (path[0] === "media" && req.method === "GET") return media(path[1]);
  if (req.method === "GET") return pubGet(req, ctx);
  if (req.method === "POST") return pubPost(req, ctx);
  return new Response("Method not allowed", { status: 405 });
}
export const GET = route, POST = route, PUT = route, DELETE = route;
