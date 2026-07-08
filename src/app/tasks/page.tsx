"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { isoDate } from "@/lib/date";
import type { AppUser, Task } from "@/lib/types";

export default function TasksPage() {
  const supabase = createClient();
  const { appUser } = useAuth();
  const householdId = appUser?.household_id;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!householdId) return;
    const [{ data: taskRows }, { data: userRows }] = await Promise.all([
      supabase
        .from("task")
        .select("*")
        .eq("household_id", householdId)
        .order("done_at", { ascending: true, nullsFirst: true })
        .order("due_date", { ascending: true, nullsFirst: false }),
      supabase.from("app_user").select("*").eq("household_id", householdId),
    ]);
    setTasks(taskRows ?? []);
    setUsers(userRows ?? []);
    if (userRows && userRows.length > 0 && !assignee) setAssignee(appUser?.id ?? userRows[0].id);
  }, [householdId, supabase, appUser, assignee]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel("tasks")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task", filter: `household_id=eq.${householdId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, supabase, load]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !householdId) return;
    setSubmitting(true);
    // Goes through /api/tasks (not a direct insert) so a due date+time
    // gets pushed onto the assignee's connected calendar server-side —
    // see lib/integrations/calendar-sync.ts.
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        assigneeUserId: assignee || null,
        dueDate: dueDate || null,
        dueTime: dueTime || null,
      }),
    });
    setTitle("");
    setDueDate("");
    setDueTime("");
    setSubmitting(false);
    load();
  }

  async function toggleDone(t: Task) {
    await supabase
      .from("task")
      .update({ done_at: t.done_at ? null : new Date().toISOString() })
      .eq("id", t.id);
  }

  function userName(id: string | null) {
    return users.find((u) => u.id === id)?.name ?? "Unassigned";
  }

  const openCount = tasks.filter((t) => !t.done_at).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Tasks ✅</h1>
        <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs">{openCount} open</span>
      </div>

      <section className="card p-4">
        <form onSubmit={addTask} className="space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What needs doing?"
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="flex-1 rounded-lg border border-line bg-white px-2 py-2 text-sm"
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="rounded-lg border border-line bg-white px-2 py-2 text-sm"
            />
            <input
              type="time"
              value={dueTime}
              onChange={(e) => setDueTime(e.target.value)}
              disabled={!dueDate}
              title={dueDate ? "Optional time — syncs to calendar as a timed event" : "Pick a date first"}
              className="rounded-lg border border-line bg-white px-2 py-2 text-sm disabled:opacity-40"
            />
          </div>
          <button
            disabled={submitting}
            className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {submitting ? "Adding…" : "Add task"}
          </button>
        </form>
      </section>

      <section className="card p-4">
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li key={t.id} className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={!!t.done_at}
                onChange={() => toggleDone(t)}
                className="h-4 w-4"
              />
              <span className={`flex-1 ${t.done_at ? "text-ink-muted line-through" : ""}`}>
                {t.title}
              </span>
              {t.due_date && (
                <span
                  className={`text-xs ${
                    !t.done_at && t.due_date < isoDate(new Date()) ? "text-danger" : "text-ink-muted"
                  }`}
                >
                  {t.due_date}
                  {t.due_time && ` ${t.due_time.slice(0, 5)}`}
                  {(t.google_calendar_event_id || t.apple_calendar_event_uid) && " 📅"}
                </span>
              )}
              <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs">
                {userName(t.assignee_user_id)}
              </span>
            </li>
          ))}
          {tasks.length === 0 && <li className="text-sm text-ink-muted">Nothing here yet.</li>}
        </ul>
      </section>
    </div>
  );
}
