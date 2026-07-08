import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client — bypasses RLS entirely. Only ever used from trusted,
 * offline scripts (scripts/*.ts) run by Noam directly, never from a web
 * route or anything reachable by a browser request.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set to run scripts/*.ts"
    );
  }
  return createClient(url, serviceKey);
}
