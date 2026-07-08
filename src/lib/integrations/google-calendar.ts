import { google } from "googleapis";

/**
 * Google Calendar sync (PRD 14 "calendar integration", pulled forward from
 * Phase 3). Needs its own OAuth client — separate from any Google account
 * you use elsewhere — set up once in Google Cloud Console. See README
 * "Calendar integration" for the exact steps.
 *
 * Scope used: calendar.events (create/update household-owned events only;
 * we never read or modify events we didn't create).
 */

export function getGoogleOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

export function getGoogleAuthUrl(state: string) {
  const client = getGoogleOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline", // required to get a refresh_token
    prompt: "consent", // force refresh_token on repeat connects
    scope: ["https://www.googleapis.com/auth/calendar.events"],
    state,
  });
}

export async function exchangeGoogleCode(code: string) {
  const client = getGoogleOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens; // tokens.refresh_token — store this in calendar_connection.secret
}

function clientFromRefreshToken(refreshToken: string) {
  const client = getGoogleOAuthClient();
  client.setCredentials({ refresh_token: refreshToken });
  return client;
}

// The household runs on Israel time — hardcoded for now (see README "Calendar
// integration" if the household ever needs this configurable).
export const HOUSEHOLD_TIMEZONE = "Asia/Jerusalem";

/**
 * Upsert a single household item (task, chore day, meal plan day) as a
 * Google Calendar event on the assignee's own calendar. Pass `time` (HH:mm)
 * for a timed event ("walk Nala tomorrow at 8"); omit it for an all-day
 * event. Pass the existing event id to update in place; omit it to create.
 * Returns the event id to store back on the row.
 */
export async function upsertCalendarEvent(
  refreshToken: string,
  calendarId: string,
  event: {
    id?: string | null;
    summary: string;
    description?: string;
    date: string; // yyyy-mm-dd
    time?: string | null; // HH:mm — omit for an all-day event
  }
) {
  const auth = clientFromRefreshToken(refreshToken);
  const calendar = google.calendar({ version: "v3", auth });

  const body = event.time
    ? {
        summary: event.summary,
        description: event.description,
        start: { dateTime: `${event.date}T${event.time}:00`, timeZone: HOUSEHOLD_TIMEZONE },
        end: { dateTime: `${event.date}T${addMinutes(event.time, 30)}:00`, timeZone: HOUSEHOLD_TIMEZONE },
      }
    : {
        summary: event.summary,
        description: event.description,
        start: { date: event.date },
        end: { date: event.date },
      };

  if (event.id) {
    const res = await calendar.events.update({ calendarId, eventId: event.id, requestBody: body });
    return res.data.id!;
  }
  const res = await calendar.events.insert({ calendarId, requestBody: body });
  return res.data.id!;
}

/** HH:mm + minutes, wrapping within the same day (good enough for 30-min reminders). */
function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = (h * 60 + m + minutes) % (24 * 60);
  const hh = Math.floor(total / 60)
    .toString()
    .padStart(2, "0");
  const mm = (total % 60).toString().padStart(2, "0");
  return `${hh}:${mm}`;
}

export async function deleteCalendarEvent(refreshToken: string, calendarId: string, eventId: string) {
  const auth = clientFromRefreshToken(refreshToken);
  const calendar = google.calendar({ version: "v3", auth });
  await calendar.events.delete({ calendarId, eventId }).catch(() => {
    // already gone — fine
  });
}
