import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.CREATORLENS_DEV === "1" ? ".next-dev" : ".next",
};
export default nextConfig;
