import { DAVClient } from "tsdav";

/**
 * Apple Calendar has no REST API — CalDAV at caldav.icloud.com is the only
 * integration point (confirmed against Apple's own developer docs). Two
 * consequences that shape this file:
 *  - Auth is a per-user iCloud "app-specific password" (from
 *    appleid.apple.com), not OAuth. The user pastes it into Settings once.
 *  - No webhooks/push — there is nothing to "subscribe" to. We only ever
 *    write (create/update) household events; we don't read the user's
 *    personal calendar at all, which keeps the scope (and the risk) small.
 */

export async function connectAppleCalendar(username: string, appSpecificPassword: string) {
  const client = new DAVClient({
    serverUrl: "https://caldav.icloud.com",
    credentials: { username, password: appSpecificPassword },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
  await client.login();
  const calendars = await client.fetchCalendars();
  const target = calendars.find((c) => c.components?.includes("VEVENT")) ?? calendars[0];
  if (!target) throw new Error("No writable calendar found on this iCloud account");
  return { principalUrl: client.account?.homeUrl ?? "", calendarUrl: target.url };
}

function clientFor(username: string, appSpecificPassword: string) {
  return new DAVClient({
    serverUrl: "https://caldav.icloud.com",
    credentials: { username, password: appSpecificPassword },
    authMethod: "Basic",
    defaultAccountType: "caldav",
  });
}

/**
 * Apple's CalDAV only supports full PUT (no partial PATCH) — so "update"
 * here means "re-upload the whole ICS object" using the same UID.
 */
export async function upsertAppleEvent(
  username: string,
  appSpecificPassword: string,
  calendarUrl: string,
  event: { uid: string; summary: string; description?: string; date: string; time?: string | null }
) {
  const client = clientFor(username, appSpecificPassword);
  await client.login();

  const dt = event.date.replace(/-/g, "");
  const startEnd = event.time
    ? [
        `DTSTART;TZID=Asia/Jerusalem:${dt}T${event.time.replace(":", "")}00`,
        `DTEND;TZID=Asia/Jerusalem:${dt}T${event.time.replace(":", "")}00`,
      ]
    : [`DTSTART;VALUE=DATE:${dt}`, `DTEND;VALUE=DATE:${dt}`];

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//House Hadadi//EN",
    "BEGIN:VEVENT",
    `UID:${event.uid}`,
    `SUMMARY:${event.summary}`,
    event.description ? `DESCRIPTION:${event.description}` : "",
    ...startEnd,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  await client.updateCalendarObject({
    calendarObject: {
      url: `${calendarUrl}${event.uid}.ics`,
      data: ics,
      etag: "", // tsdav will fetch the current etag; empty = create-or-blind-overwrite
    },
  });
}
