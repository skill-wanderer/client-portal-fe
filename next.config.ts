// next.config.ts
import type { NextConfig } from "next";

const deploymentId =
  process.env.NEXT_PUBLIC_DEPLOYMENT_ID ??
  process.env.NEXT_DEPLOYMENT_ID ??
  process.env.CF_PAGES_COMMIT_SHA ??
  process.env.SOURCE_VERSION ??
  process.env.GIT_SHA;

const contractVersion =
  process.env.NEXT_PUBLIC_CONTRACT_VERSION ??
  process.env.CONTRACT_VERSION ??
  "2026-05-21";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["client-portal.test", "localhost", "127.0.0.1"],
  output: "standalone",
  env: {
    NEXT_PUBLIC_DEPLOYMENT_ID: deploymentId ?? "local-dev",
    NEXT_PUBLIC_CONTRACT_VERSION: contractVersion,
  },
  ...(deploymentId ? { deploymentId } : {}),
};

export default nextConfig;
import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
