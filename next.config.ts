import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  productionBrowserSourceMaps: false, // no .map files -> browsers cannot reconstruct your source
  poweredByHeader: false,
  serverExternalPackages: ["pg"],
  images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com", pathname: "/photo-**" }] },
};

export default nextConfig;
