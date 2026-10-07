import { currentUser } from "@clerk/nextjs/server";
import { DEFAULT_ADMIN, q } from "./db";

export async function getUser() {
  const u = await currentUser();
  const e = u?.primaryEmailAddress;
  if (!u || !e) return null;
  return { id: u.id, name: u.fullName || u.firstName || "ThinkEconomics member", email: e.emailAddress.toLowerCase(), verified: e.verification?.status === "verified" };
}

export async function isAdminEmail(email: string) {
  if (email === DEFAULT_ADMIN) return true;
  return (await q("SELECT 1 FROM admins WHERE email=$1", [email])).length > 0;
}

export async function getAdmin() {
  const u = await getUser();
  if (!u || !u.verified) return null;
  return (await isAdminEmail(u.email)) ? u : null;
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export function slugify(text: string) {
  return text.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 80) || "item";
}
