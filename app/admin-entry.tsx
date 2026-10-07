"use client";

import { lazy, Suspense } from "react";
import { SignInButton, SignOutButton, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

const AdminApp = lazy(() => import("./admin")); // admin code is only downloaded after the server confirms you are an admin
const CLERK = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const gridStyle = { minHeight: "100vh", display: "grid", placeItems: "center", padding: "2rem", background: "#0c4727", color: "#fff", textAlign: "center" as const, fontFamily: "Arial,Helvetica,sans-serif" };
const btn = { border: 0, borderRadius: 6, padding: "0.9rem 1.4rem", background: "#b8efae", color: "#102418", fontWeight: 700, cursor: "pointer", fontSize: "1rem" };
function Gate({ title, text, children }: { title: string; text?: string; children?: React.ReactNode }) {
  return <main style={gridStyle}><div style={{ maxWidth: 460 }}><p style={{ letterSpacing: ".14em", textTransform: "uppercase", fontSize: ".75rem", color: "#b8efae" }}>ThinkEconomics admin</p><h1 style={{ fontFamily: "Times New Roman,serif", fontSize: "2.6rem", margin: ".5rem 0" }}>{title}</h1>{text && <p style={{ color: "#d2e3d1", lineHeight: 1.6 }}>{text}</p>}<div style={{ marginTop: "1.5rem" }}>{children}</div></div></main>;
}

function Inner() {
  const { isLoaded, isSignedIn, user } = useUser();
  const [state, setState] = useState<"checking" | "ok" | "denied">("checking");
  useEffect(() => {
    if (!isSignedIn) return;
    let off = false;
    fetch("/api?p=admin/me", { cache: "no-store" }).then((r) => !off && setState(r.ok ? "ok" : "denied")).catch(() => !off && setState("denied"));
    return () => { off = true; };
  }, [isSignedIn]);
  if (!isLoaded) return <Gate title="Loading…" />;
  if (!isSignedIn) return <Gate title="Admin sign in" text="Sign in with the Google account that has admin access."><SignInButton mode="modal" forceRedirectUrl="/admin" fallbackRedirectUrl="/admin"><button style={btn}>Continue with Google</button></SignInButton></Gate>;
  if (state === "checking") return <Gate title="Checking access…" />;
  if (state === "denied") return <Gate title="No access" text={`${user?.primaryEmailAddress?.emailAddress || "This account"} is not an admin. Ask an existing admin to add your email.`}><SignOutButton redirectUrl="/admin"><button style={btn}>Sign out</button></SignOutButton></Gate>;
  return <Suspense fallback={<Gate title="Loading admin…" />}><AdminApp /></Suspense>;
}

export function AdminEntry() {
  if (!CLERK) return <Gate title="Clerk is not configured" text="Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY, then redeploy." />;
  return <Inner />;
}
