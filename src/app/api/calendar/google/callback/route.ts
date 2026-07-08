import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode } from "@/lib/integrations/google-calendar";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// GET /api/calendar/google/callback?code=...&state=<userId>
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const userId = req.nextUrl.searchParams.get("state");
  if (!code || !userId) {
    return NextResponse.json({ error: "Missing code or state" }, { status: 400 });
  }

  const tokens = await exchangeGoogleCode(code);
  if (!tokens.refresh_token) {
    // Google only returns a refresh_token on first consent; if this user
    // reconnects, they must revoke access at myaccount.google.com/permissions
    // first (see README "Calendar integration" troubleshooting).
    return NextResponse.redirect(
      new URL("/settings?calendar_error=no_refresh_token", req.url)
    );
  }

  const supabase = await createServerSupabaseClient();
  await supabase.from("calendar_connection").upsert(
    {
      user_id: userId,
      provider: "google",
      secret: tokens.refresh_token,
      calendar_id: "primary",
    },
    { onConflict: "user_id,provider" }
  );

  return NextResponse.redirect(new URL("/settings?calendar_connected=google", req.url));
}
