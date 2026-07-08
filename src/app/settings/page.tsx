"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import type { BankConnection, CalendarConnection } from "@/lib/types";

export default function SettingsPage() {
  const supabase = createClient();
  const { appUser } = useAuth();
  const params = useSearchParams();

  const [calendarConnections, setCalendarConnections] = useState<CalendarConnection[]>([]);
  const [bankConnections, setBankConnections] = useState<BankConnection[]>([]);
  const [icloudEmail, setIcloudEmail] = useState("");
  const [icloudPassword, setIcloudPassword] = useState("");
  const [appleStatus, setAppleStatus] = useState<string | null>(null);
  const [appleSaving, setAppleSaving] = useState(false);

  const load = useCallback(async () => {
    if (!appUser) return;
    const [{ data: cals }, { data: banks }] = await Promise.all([
      supabase.from("calendar_connection").select("*").eq("user_id", appUser.id),
      supabase.from("bank_connection").select("*").eq("household_id", appUser.household_id),
    ]);
    setCalendarConnections(cals ?? []);
    setBankConnections(banks ?? []);
  }, [appUser, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const googleConnected = calendarConnections.some((c) => c.provider === "google");
  const appleConnected = calendarConnections.some((c) => c.provider === "apple");

  async function connectApple(e: React.FormEvent) {
    e.preventDefault();
    if (!appUser) return;
    setAppleSaving(true);
    setAppleStatus(null);
    const res = await fetch("/api/calendar/apple/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: appUser.id,
        username: icloudEmail,
        appSpecificPassword: icloudPassword,
      }),
    });
    const body = await res.json();
    if (res.ok) {
      setAppleStatus("Connected ✅");
      setIcloudPassword("");
      load();
    } else {
      setAppleStatus(`Failed: ${body.error}`);
    }
    setAppleSaving(false);
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Settings ⚙️</h1>

      {params.get("calendar_connected") && (
        <p className="rounded-lg bg-ok/10 p-3 text-sm text-ok">
          {params.get("calendar_connected")} calendar connected ✅
        </p>
      )}
      {params.get("calendar_error") && (
        <p className="rounded-lg bg-danger/10 p-3 text-sm text-danger">
          Couldn&apos;t connect: {params.get("calendar_error")}
        </p>
      )}

      <section className="card space-y-4 p-4">
        <p className="text-sm font-medium">Calendar sync</p>
        <p className="text-xs text-ink-muted">
          Pushes your tasks (and later, chores/meal plan days) as all-day events on your own
          calendar. Read-only into House Hadadi — we never read your personal events.
        </p>

        <div className="flex items-center justify-between rounded-lg border border-line p-3">
          <span className="text-sm">Google Calendar</span>
          {googleConnected ? (
            <span className="text-sm text-ok">Connected ✅</span>
          ) : (
            <a
              href={`/api/calendar/google/connect?userId=${appUser?.id ?? ""}`}
              className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white"
            >
              Connect
            </a>
          )}
        </div>

        <div className="rounded-lg border border-line p-3">
          <div className="flex items-center justify-between">
            <span className="text-sm">Apple Calendar (iCloud)</span>
            {appleConnected && <span className="text-sm text-ok">Connected ✅</span>}
          </div>
          {!appleConnected && (
            <form onSubmit={connectApple} className="mt-2 space-y-2">
              <p className="text-xs text-ink-muted">
                Generate an app-specific password at{" "}
                <a href="https://appleid.apple.com" target="_blank" rel="noreferrer" className="underline">
                  appleid.apple.com
                </a>{" "}
                — never use your real Apple ID password here.
              </p>
              <input
                value={icloudEmail}
                onChange={(e) => setIcloudEmail(e.target.value)}
                placeholder="iCloud email"
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
              />
              <input
                value={icloudPassword}
                onChange={(e) => setIcloudPassword(e.target.value)}
                type="password"
                placeholder="app-specific password"
                className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
              />
              <button
                disabled={appleSaving}
                className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {appleSaving ? "Connecting…" : "Connect Apple Calendar"}
              </button>
              {appleStatus && <p className="text-xs">{appleStatus}</p>}
            </form>
          )}
        </div>
      </section>

      <section className="card space-y-3 p-4">
        <p className="text-sm font-medium">Bank & credit card accounts</p>
        <p className="text-xs text-ink-muted">
          Managed from the command line, not here — credentials shouldn&apos;t travel through a
          browser session or chat. Run <code>npm run bank:add</code> on your own machine, then{" "}
          <code>npm run bank:sync</code> to pull transactions. See README &ldquo;Banking
          integration&rdquo;.
        </p>
        <ul className="space-y-1">
          {bankConnections.map((b) => (
            <li key={b.id} className="flex items-center justify-between rounded-lg border border-line p-3 text-sm">
              <span>{b.display_name}</span>
              <span className={b.status === "active" ? "text-ok" : "text-danger"}>
                {b.status}
                {b.last_synced_at ? ` · synced ${new Date(b.last_synced_at).toLocaleDateString()}` : ""}
              </span>
            </li>
          ))}
          {bankConnections.length === 0 && (
            <li className="text-sm text-ink-muted">No accounts connected yet.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
