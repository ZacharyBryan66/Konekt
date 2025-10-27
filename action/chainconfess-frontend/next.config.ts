import type { NextConfig } from "next";

const basePath = process.env.BASE_PATH || ""; // e.g. "/Konekt" for project pages

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Enable static export for GitHub Pages
  output: "export",
  images: {
    unoptimized: true,
  },
  basePath,
  assetPrefix: basePath || undefined,
};

export default nextConfig;

