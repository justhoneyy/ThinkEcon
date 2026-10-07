import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Shell } from "./site";
import "./site.css";

export const metadata: Metadata = { title: "ThinkEconomics", description: "A student-led community for economics, policy, business, and current affairs." };
export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function Layout({ children }: { children: React.ReactNode }) {
  const content = <Shell>{children}</Shell>;
  return <html lang="en"><body>{process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? <ClerkProvider>{content}</ClerkProvider> : content}</body></html>;
}
