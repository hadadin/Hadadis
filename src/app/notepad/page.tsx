"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import type { AppUser, Link as LinkRow } from "@/lib/types";

const PLATFORM_COLORS: Record<string, string> = {
  instagram: "#E1306C",
  youtube: "#FF0000",
  tiktok: "#111111",
  generic: "#c1673a",
};

export default function NotepadPage() {
  const supabase = createClient();
  const { appUser } = useAuth();
  const householdId = appUser?.household_id;

  const [links, setLinks] = useState<LinkRow[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!householdId) return;
    const [{ data: linkRows }, { data: userRows }] = await Promise.all([
      supabase
        .from("link")
        .select("*")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false }),
      supabase.from("app_user").select("*").eq("household_id", householdId),
    ]);
    setLinks(linkRows ?? []);
    setUsers(userRows ?? []);
  }, [householdId, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel("notepad-links")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "link", filter: `household_id=eq.${householdId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, supabase, load]);

  async function addLink(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim() || !householdId || !appUser) return;
    setSaving(true);
    let preview: { title?: string; thumbnail_url?: string | null; platform?: string } = {};
    try {
      const res = await fetch("/api/notepad/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      preview = await res.json();
    } catch {
      // preview fetch failed entirely — still save the link with just the URL (fallback card)
    }
    await supabase.from("link").insert({
      household_id: householdId,
      url,
      title: preview.title ?? null,
      thumbnail_url: preview.thumbnail_url ?? null,
      platform: preview.platform ?? "generic",
      note: note.trim() || null,
      saved_by_user_id: appUser.id,
    });
    setUrl("");
    setNote("");
    setSaving(false);
  }

  async function removeLink(id: string) {
    await supabase.from("link").delete().eq("id", id);
  }

  function userName(id: string | null) {
    return users.find((u) => u.id === id)?.name ?? "—";
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Notepad 🔗</h1>

      <section className="card p-4">
        <form onSubmit={addLink} className="space-y-2">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste a link…"
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
            required
            type="url"
          />
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional note"
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
          />
          <button
            disabled={saving}
            className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      </section>

      <div className="grid grid-cols-2 gap-3">
        {links.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="card relative block overflow-hidden p-3"
          >
            {link.thumbnail_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={link.thumbnail_url}
                alt=""
                className="mb-2 h-24 w-full rounded-lg object-cover"
              />
            ) : (
              <div
                className="mb-2 flex h-24 w-full items-center justify-center rounded-lg text-2xl text-white"
                style={{ background: PLATFORM_COLORS[link.platform ?? "generic"] }}
              >
                🔗
              </div>
            )}
            <p className="line-clamp-2 text-sm font-medium">{link.title ?? link.url}</p>
            {link.note && <p className="mt-1 text-xs text-ink-muted">{link.note}</p>}
            <p className="mt-1 text-xs text-ink-muted">saved by {userName(link.saved_by_user_id)}</p>
            <button
              onClick={(e) => {
                e.preventDefault();
                removeLink(link.id);
              }}
              className="absolute right-2 top-2 rounded-full bg-white/80 px-1.5 text-xs text-ink-muted"
            >
              ✕
            </button>
          </a>
        ))}
        {links.length === 0 && (
          <p className="col-span-2 text-sm text-ink-muted">No links saved yet.</p>
        )}
      </div>
    </div>
  );
}
