// next.config.ts
import type { NextConfig } from "next";

const deploymentId =
  process.env.NEXT_DEPLOYMENT_ID ??
  process.env.CF_PAGES_COMMIT_SHA ??
  process.env.SOURCE_VERSION ??
  process.env.GIT_SHA;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["client-portal.test", "localhost", "127.0.0.1"],
  output: "standalone",
  ...(deploymentId ? { deploymentId } : {}),
};

export default nextConfig;