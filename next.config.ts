// next.config.ts
import type { NextConfig } from "next";

const deploymentId =
  process.env.NEXT_DEPLOYMENT_ID ??
  process.env.CF_PAGES_COMMIT_SHA ??
  process.env.SOURCE_VERSION ??
  process.env.GIT_SHA ??
  process.env.NEXT_PUBLIC_DEPLOYMENT_ID;

const contractVersion =
  process.env.CONTRACT_VERSION ??
  process.env.NEXT_PUBLIC_CONTRACT_VERSION;

const nextConfig: NextConfig = {
  allowedDevOrigins: ["client-portal.test", "localhost", "127.0.0.1"],
  output: "standalone",
  env: {
    ...(deploymentId ? { NEXT_PUBLIC_DEPLOYMENT_ID: deploymentId } : {}),
    ...(contractVersion
      ? { NEXT_PUBLIC_CONTRACT_VERSION: contractVersion }
      : {}),
  },
  ...(deploymentId ? { deploymentId } : {}),
};

export default nextConfig;