import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Album/artist cover art is hot-linked from Jamendo — whitelist the host so
    // next/image will load it. (Audio is served from R2, not via next/image;
    // the profile avatar is a data URL rendered with `unoptimized`.)
    remotePatterns: [
      { protocol: "https", hostname: "usercontent.jamendo.com" },
      // Audiobook cover art (archive.org thumbnail service) — hot-linked.
      { protocol: "https", hostname: "archive.org" },
    ],
  },
};

export default nextConfig;
