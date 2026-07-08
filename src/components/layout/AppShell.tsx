"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { Sidebar } from "./Sidebar";
import { BottomTabs } from "./BottomTabs";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 overflow-y-auto pb-20 md:pb-0">
          <div className="mx-auto max-w-3xl p-4 md:p-8">{children}</div>
        </main>
        <BottomTabs />
      </div>
    </AuthProvider>
  );
}
