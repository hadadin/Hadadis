"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/types";

// Single shared browser client — used by all client components for
// CRUD + realtime subscriptions.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
