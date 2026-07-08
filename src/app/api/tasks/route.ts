import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { syncTaskToPersonalCalendars } from "@/lib/integrations/calendar-sync";
import type { Task } from "@/lib/types";

// POST — create a task, then best-effort sync it onto the assignee's
// connected calendar(s). Runs server-side because the calendar secrets
// (Google refresh token / Apple app-specific password) must never reach
// the browser. The dashboard's Tasks page calls this instead of inserting
// directly; Bayti (Phase 2, Telegram) will call the same route.
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { data: appUser } = await supabase.from("app_user").select("household_id").eq("id", user.id).single();
  if (!appUser) return NextResponse.json({ error: "Not part of a household" }, { status: 403 });

  const body = await req.json();
  const { title, assigneeUserId, dueDate, dueTime, source } = body as {
    title: string;
    assigneeUserId?: string | null;
    dueDate?: string | null;
    dueTime?: string | null;
    source?: "app" | "telegram";
  };

  if (!title?.trim()) return NextResponse.json({ error: "Missing title" }, { status: 400 });

  const { data: task, error } = await supabase
    .from("task")
    .insert({
      household_id: appUser.household_id,
      title: title.trim(),
      assignee_user_id: assigneeUserId || null,
      due_date: dueDate || null,
      due_time: dueTime || null,
      source: source ?? "app",
    })
    .select()
    .single<Task>();

  if (error || !task) {
    return NextResponse.json({ error: error?.message ?? "Failed to create task" }, { status: 500 });
  }

  const calendarIds = await syncTaskToPersonalCalendars(supabase, task);
  if (
    calendarIds.google_calendar_event_id !== task.google_calendar_event_id ||
    calendarIds.apple_calendar_event_uid !== task.apple_calendar_event_uid
  ) {
    await supabase.from("task").update(calendarIds).eq("id", task.id);
  }

  return NextResponse.json({ task: { ...task, ...calendarIds } });
}
