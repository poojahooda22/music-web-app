import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Album/artist cover art is hot-linked from Jamendo — whitelist the host so
    // next/image will load it. (Audio is served from R2, not via next/image;
    // the profile avatar is a data URL rendered with `unoptimized`.)
    remotePatterns: [{ protocol: "https", hostname: "usercontent.jamendo.com" }],
  },
};

export default nextConfig;
