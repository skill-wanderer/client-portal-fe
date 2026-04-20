// next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["client-portal.test:3000"],
};

export default nextConfig;