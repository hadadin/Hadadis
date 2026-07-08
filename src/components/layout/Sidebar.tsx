"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav";
import { useAuth } from "@/components/auth/AuthProvider";

export function Sidebar() {
  const pathname = usePathname();
  const { appUser, signOut } = useAuth();

  return (
    <aside className="hidden w-56 shrink-0 flex-col border-r border-line bg-paper-card p-4 md:flex">
      <div className="mb-6 px-2">
        <p className="text-lg font-semibold">House Hadadi 🏡</p>
        {appUser && <p className="text-xs text-ink-muted">Hi, {appUser.name}</p>}
      </div>
      <nav className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors ${
                active
                  ? "bg-accent-soft font-medium text-ink"
                  : "text-ink-muted hover:bg-accent-soft/60"
              }`}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <button
        onClick={() => signOut()}
        className="mt-4 rounded-lg px-3 py-2 text-left text-xs text-ink-muted hover:bg-accent-soft/60"
      >
        Sign out
      </button>
    </aside>
  );
}
