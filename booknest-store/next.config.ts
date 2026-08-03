import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  turbopack: {
    root: path.join(__dirname),
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "covers.openlibrary.org" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.openlibrary.org" },
    ],
  },
  // Allow browser → BookNest-AI during local integration (CORS is also set on API)
  async rewrites() {
    const ai = process.env.NEXT_PUBLIC_BOOKNEST_AI_URL || "http://127.0.0.1:8000";
    return [
      // Optional proxy if you later set API base to /bn-ai
      { source: "/bn-ai/:path*", destination: `${ai.replace(/\/$/, "")}/:path*` },
    ];
  },
};

export default nextConfig;
