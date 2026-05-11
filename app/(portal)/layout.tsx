"use client";

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Navigation } from "@/components/navigation";

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ProtectedRoute>
      <div className="flex min-h-full flex-1 flex-col">
        <Navigation />
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </ProtectedRoute>
  );
}
