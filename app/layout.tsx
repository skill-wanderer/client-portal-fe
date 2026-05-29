import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { LoopbackOriginGuard } from "@/components/loopback-origin-guard";
import { RuntimeResilienceGuard } from "@/components/runtime-resilience-guard";
import { AuthProvider } from "@/contexts/AuthContext";
import {
  assertPublicRuntimeEnv,
  resolvePublicRuntimeEnv,
  resolveRequestRuntimeUrl,
  validatePublicRuntimeEnv,
} from "@/lib/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Client Portal",
  description: "Skill Wanderer Client Portal",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  const runtimeEnv = resolvePublicRuntimeEnv(process.env, {
    requestUrl: resolveRequestRuntimeUrl(requestHeaders),
  });

  assertPublicRuntimeEnv(runtimeEnv, validatePublicRuntimeEnv(runtimeEnv));

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LoopbackOriginGuard />
        <RuntimeResilienceGuard />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
