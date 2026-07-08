"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { currentWeekStart, isoDate } from "@/lib/date";
import { buildRotation, fairnessSplit } from "@/lib/rotation";
import type { AppUser, Chore, ChoreAssignment } from "@/lib/types";

export default function CleaningPage() {
  const supabase = createClient();
  const { appUser } = useAuth();
  const householdId = appUser?.household_id;

  const [chores, setChores] = useState<Chore[]>([]);
  const [assignments, setAssignments] = useState<ChoreAssignment[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [newChore, setNewChore] = useState("");
  const [newWeight, setNewWeight] = useState("1");
  const [shuffleSeed, setShuffleSeed] = useState(0);

  const weekStart = isoDate(currentWeekStart());

  const load = useCallback(async () => {
    if (!householdId) return;
    const [{ data: choreRows }, { data: userRows }, { data: assignRows }] =
      await Promise.all([
        supabase.from("chore").select("*").eq("household_id", householdId).eq("active", true),
        supabase.from("app_user").select("*").eq("household_id", householdId),
        supabase
          .from("chore_assignment")
          .select("*")
          .eq("week_start", weekStart),
      ]);
    setChores(choreRows ?? []);
    setUsers(userRows ?? []);
    setAssignments((assignRows ?? []).filter((a) => choreRows?.some((c) => c.id === a.chore_id)));
  }, [householdId, supabase, weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel("cleaning-assignments")
      .on("postgres_changes", { event: "*", schema: "public", table: "chore_assignment" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, supabase, load]);

  // Auto-generate this week's rotation the first time it's viewed.
  useEffect(() => {
    if (!householdId || chores.length === 0 || users.length < 2) return;
    if (assignments.length > 0) return;
    reshuffle();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdId, chores.length, users.length, assignments.length]);

  async function reshuffle() {
    if (users.length < 2) return;
    const userIds: [string, string] = [users[0].id, users[1].id];
    const assignment = buildRotation(chores, userIds, shuffleSeed + 1);
    setShuffleSeed((s) => s + 1);

    // Clear existing assignments for the week, then recreate.
    await supabase.from("chore_assignment").delete().eq("week_start", weekStart);
    const rows = chores.map((c) => ({
      chore_id: c.id,
      user_id: assignment[c.id],
      week_start: weekStart,
    }));
    if (rows.length > 0) await supabase.from("chore_assignment").insert(rows);
    load();
  }

  async function toggleDone(a: ChoreAssignment) {
    await supabase
      .from("chore_assignment")
      .update({ done_at: a.done_at ? null : new Date().toISOString() })
      .eq("id", a.id);
  }

  async function addChore(e: React.FormEvent) {
    e.preventDefault();
    if (!newChore.trim() || !householdId) return;
    await supabase.from("chore").insert({
      household_id: householdId,
      title: newChore.trim(),
      effort_weight: parseFloat(newWeight) || 1,
    });
    setNewChore("");
    setNewWeight("1");
    load();
  }

  function userName(id: string) {
    return users.find((u) => u.id === id)?.name ?? "—";
  }

  const currentAssignment: Record<string, string> = {};
  assignments.forEach((a) => (currentAssignment[a.chore_id] = a.user_id));
  const fairness =
    users.length >= 2
      ? fairnessSplit(chores, currentAssignment, [users[0].id, users[1].id])
      : {};
  const fairnessTotal = Object.values(fairness).reduce((a, b) => a + b, 0) || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Cleaning 🧹</h1>
        <button
          onClick={reshuffle}
          className="rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-accent-soft/60"
        >
          Reshuffle
        </button>
      </div>

      {users.length >= 2 && (
        <section className="card p-4">
          <p className="mb-2 text-sm font-medium">Fairness this week</p>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-accent-soft">
            <div
              className="h-full bg-accent"
              style={{ width: `${((fairness[users[0].id] ?? 0) / fairnessTotal) * 100}%` }}
            />
          </div>
          <div className="mt-1 flex justify-between text-xs text-ink-muted">
            <span>{users[0].name}: {(fairness[users[0].id] ?? 0).toFixed(1)}</span>
            <span>{users[1].name}: {(fairness[users[1].id] ?? 0).toFixed(1)}</span>
          </div>
        </section>
      )}

      <section className="card p-4">
        <p className="mb-3 text-sm font-medium">This week&apos;s rotation</p>
        <ul className="space-y-2">
          {chores.map((chore) => {
            const assignment = assignments.find((a) => a.chore_id === chore.id);
            return (
              <li key={chore.id} className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={!!assignment?.done_at}
                  onChange={() => assignment && toggleDone(assignment)}
                  className="h-4 w-4"
                />
                <span className={`flex-1 ${assignment?.done_at ? "text-ink-muted line-through" : ""}`}>
                  {chore.title}
                  <span className="ml-1 text-xs text-ink-muted">×{chore.effort_weight}</span>
                </span>
                <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs">
                  {assignment ? userName(assignment.user_id) : "unassigned"}
                </span>
              </li>
            );
          })}
          {chores.length === 0 && <li className="text-sm text-ink-muted">No chores defined yet.</li>}
        </ul>
      </section>

      <section className="card p-4">
        <p className="mb-3 text-sm font-medium">Chore definitions</p>
        <form onSubmit={addChore} className="flex gap-2">
          <input
            value={newChore}
            onChange={(e) => setNewChore(e.target.value)}
            placeholder="New chore…"
            className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm"
          />
          <input
            value={newWeight}
            onChange={(e) => setNewWeight(e.target.value)}
            type="number"
            step="0.1"
            min="0.1"
            className="w-20 rounded-lg border border-line bg-white px-3 py-2 text-sm"
            title="Effort weight"
          />
          <button className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">
            Add
          </button>
        </form>
      </section>
    </div>
  );
}
