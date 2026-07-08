import { NextRequest, NextResponse } from "next/server";
import { connectAppleCalendar } from "@/lib/integrations/apple-calendar";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// POST { userId, username, appSpecificPassword }
// Verifies the CalDAV login works, then stores it. Unlike bank credentials,
// this is fine to submit from the web app directly — it's your own deployed
// instance in your own browser, not a third party.
export async function POST(req: NextRequest) {
  const { userId, username, appSpecificPassword } = await req.json();
  if (!userId || !username || !appSpecificPassword) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  try {
    const { principalUrl, calendarUrl } = await connectAppleCalendar(username, appSpecificPassword);

    const supabase = await createServerSupabaseClient();
    await supabase.from("calendar_connection").upsert(
      {
        user_id: userId,
        provider: "apple",
        secret: appSpecificPassword,
        caldav_username: username,
        caldav_principal_url: principalUrl,
        calendar_id: calendarUrl,
      },
      { onConflict: "user_id,provider" }
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not connect to iCloud";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
