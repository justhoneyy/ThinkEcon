import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false, // no .map files -> browsers cannot reconstruct your source
  poweredByHeader: false,
  serverExternalPackages: ["pg", "ioredis"],
  images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com", pathname: "/photo-**" }] },
  // One page (app/page.tsx) serves every URL (/blog, /events/x, /admin ...). Real files (_next, /public, /api) win first.
  async rewrites() {
    return { beforeFiles: [], afterFiles: [], fallback: [{ source: "/:path*", destination: "/" }] };
  },
};

export default nextConfig;
