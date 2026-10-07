import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Shell } from "./site";
import { getMeta, imageUrl, siteUrl } from "./meta";
import "./site.css";
import "./fx.css";
import { Fraunces, Inter } from "next/font/google";
const serif = Fraunces({ subsets: ["latin"], variable: "--serif", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--sans", display: "swap" });

export const dynamic = "force-dynamic"; // so edits to the preview settings in /admin show up without a rebuild
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0c4727" };

export async function generateMetadata(): Promise<Metadata> {
  const m = await getMeta();
  const image = imageUrl(m.ogImage); const icon = imageUrl(m.logo);
  return {
    metadataBase: siteUrl(),
    title: { default: m.title, template: `%s | ${m.siteName}` },
    description: m.description,
    applicationName: m.siteName,
    icons: icon ? { icon, apple: icon, shortcut: icon } : undefined,
    openGraph: { type: "website", siteName: m.siteName, title: m.title, description: m.description, images: image ? [{ url: image, width: 1200, height: 630, alt: m.siteName }] : undefined },
    twitter: { card: "summary_large_image", title: m.title, description: m.description, images: image ? [image] : undefined },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const content = <Shell>{children}</Shell>;
  return <html lang="en"><body className={`${serif.variable} ${sans.variable}`}>{process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ? <ClerkProvider>{content}</ClerkProvider> : content}</body></html>;
}
