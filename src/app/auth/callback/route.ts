import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// GET /auth/callback?code=...
//
// Supabase's magic-link emails use the PKCE flow: the link points here with
// a `code` param, which must be exchanged server-side for a session (this
// sets the sb-*-auth-token cookies). Without this route, the code param is
// never consumed and the browser just lands on the plain sign-in page with
// no session — which is exactly the bug this route fixes.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = req.nextUrl.searchParams.get("next") ?? "/overview";

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, req.url));
    }
    return NextResponse.redirect(
      new URL(`/?auth_error=${encodeURIComponent(error.message)}`, req.url)
    );
  }

  return NextResponse.redirect(new URL("/?auth_error=missing_code", req.url));
}
