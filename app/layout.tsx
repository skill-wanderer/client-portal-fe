import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LoopbackOriginGuard } from "@/components/loopback-origin-guard";
import { RuntimeResilienceGuard } from "@/components/runtime-resilience-guard";
import { AuthProvider } from "@/contexts/AuthContext";
import { assertPublicRuntimeEnv } from "@/lib/env";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

assertPublicRuntimeEnv();

export const metadata: Metadata = {
  title: "Client Portal",
  description: "Skill Wanderer Client Portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
