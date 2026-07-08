import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/integrations/google-calendar";

// GET /api/calendar/google/connect?userId=... — kicks off the OAuth flow.
// `state` carries the app_user id so the callback knows whose connection this is.
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });
  return NextResponse.redirect(getGoogleAuthUrl(userId));
}
