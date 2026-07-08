import type { SupabaseClient } from "@supabase/supabase-js";
import { upsertCalendarEvent } from "./google-calendar";
import { upsertAppleEvent } from "./apple-calendar";
import type { Task } from "@/lib/types";

/**
 * Pushes a task onto whichever personal calendar(s) its assignee has
 * connected (PRD ask: "if someone adds ... walk Nala tomorrow at 8 - Noam,
 * it will show in the dashboard and also in the personal calendar").
 * No-ops silently if the assignee hasn't connected anything, or the task
 * has no due date — a calendar event needs a date to attach to.
 *
 * Best-effort: a calendar failure never blocks the task itself from being
 * created (dashboard never depends on calendar/agent availability, per
 * PRD 16.3).
 */
export async function syncTaskToPersonalCalendars(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>,
  task: Task
): Promise<Pick<Task, "google_calendar_event_id" | "apple_calendar_event_uid">> {
  const result = {
    google_calendar_event_id: task.google_calendar_event_id,
    apple_calendar_event_uid: task.apple_calendar_event_uid,
  };

  if (!task.assignee_user_id || !task.due_date) return result;

  const { data: connections } = await supabase
    .from("calendar_connection")
    .select("*")
    .eq("user_id", task.assignee_user_id);

  for (const conn of connections ?? []) {
    try {
      if (conn.provider === "google" && conn.secret) {
        const eventId = await upsertCalendarEvent(conn.secret, conn.calendar_id ?? "primary", {
          id: task.google_calendar_event_id,
          summary: task.title,
          description: "via House Hadadi",
          date: task.due_date,
          time: task.due_time?.slice(0, 5),
        });
        result.google_calendar_event_id = eventId;
      }
      if (conn.provider === "apple" && conn.secret && conn.caldav_username && conn.calendar_id) {
        const uid = task.apple_calendar_event_uid ?? `house-hadadi-task-${task.id}`;
        await upsertAppleEvent(conn.caldav_username, conn.secret, conn.calendar_id, {
          uid,
          summary: task.title,
          description: "via House Hadadi",
          date: task.due_date,
          time: task.due_time?.slice(0, 5),
        });
        result.apple_calendar_event_uid = uid;
      }
    } catch (err) {
      // Log and move on — see comment above on why this never blocks the task.
      console.error(`Calendar sync failed (${conn.provider}) for task ${task.id}:`, err);
    }
  }

  return result;
}
