"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { BudgetBar } from "@/components/ui/BudgetBar";
import { formatILS, ilsToAgorot } from "@/lib/currency";
import { isoDate } from "@/lib/date";
import type { AppUser, Category, Transaction } from "@/lib/types";

export default function FinancePage() {
  const supabase = createClient();
  const { appUser } = useAuth();
  const householdId = appUser?.household_id;

  const [categories, setCategories] = useState<Category[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);

  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [direction, setDirection] = useState<"expense" | "income">("expense");
  const [categoryId, setCategoryId] = useState<string>("");

  const monthStart = isoDate(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const load = useCallback(async () => {
    if (!householdId) return;
    const [{ data: cats }, { data: txns }, { data: userRows }] = await Promise.all([
      supabase.from("category").select("*").eq("household_id", householdId).order("sort_order"),
      supabase
        .from("transaction")
        .select("*")
        .eq("household_id", householdId)
        .gte("occurred_at", monthStart)
        .order("occurred_at", { ascending: false }),
      supabase.from("app_user").select("*").eq("household_id", householdId),
    ]);
    setCategories(cats ?? []);
    setTransactions(txns ?? []);
    setUsers(userRows ?? []);
    if (cats && cats.length > 0 && !categoryId) setCategoryId(cats[0].id);
  }, [householdId, supabase, monthStart, categoryId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel("finance-transactions")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transaction", filter: `household_id=eq.${householdId}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, supabase, load]);

  async function logTransaction(e: React.FormEvent) {
    e.preventDefault();
    const value = parseFloat(amount);
    if (!value || !description.trim() || !householdId || !appUser) return;
    await supabase.from("transaction").insert({
      household_id: householdId,
      amount_agorot: ilsToAgorot(value),
      direction,
      description: description.trim(),
      category_id: direction === "expense" ? categoryId || null : null,
      payer_user_id: appUser.id,
      occurred_at: isoDate(new Date()),
    });
    setAmount("");
    setDescription("");
  }

  function userName(id: string | null) {
    return users.find((u) => u.id === id)?.name ?? "—";
  }

  const spendByCategory: Record<string, number> = {};
  let totalSpent = 0;
  let totalIncome = 0;
  transactions.forEach((t) => {
    if (t.direction === "expense") {
      totalSpent += t.amount_agorot;
      if (t.category_id) spendByCategory[t.category_id] = (spendByCategory[t.category_id] ?? 0) + t.amount_agorot;
    } else {
      totalIncome += t.amount_agorot;
    }
  });

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Finance ₪</h1>

      <section className="card grid grid-cols-3 gap-2 p-4 text-center">
        <div>
          <p className="text-xs text-ink-muted">Income</p>
          <p className="text-lg font-medium">{formatILS(totalIncome)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">Spent</p>
          <p className="text-lg font-medium">{formatILS(totalSpent)}</p>
        </div>
        <div>
          <p className="text-xs text-ink-muted">Net</p>
          <p className="text-lg font-medium">{formatILS(totalIncome - totalSpent)}</p>
        </div>
      </section>

      <section className="card space-y-4 p-4">
        <p className="text-sm font-medium">Budget by category</p>
        {categories.map((c) => (
          <BudgetBar
            key={c.id}
            label={c.name}
            spentAgorot={spendByCategory[c.id] ?? 0}
            capAgorot={c.monthly_cap_agorot}
          />
        ))}
      </section>

      <section className="card p-4">
        <p className="mb-3 text-sm font-medium">Quick log</p>
        <form onSubmit={logTransaction} className="space-y-2">
          <div className="flex gap-2">
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as "expense" | "income")}
              className="rounded-lg border border-line bg-white px-2 py-2 text-sm"
            >
              <option value="expense">Expense</option>
              <option value="income">Income</option>
            </select>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              step="0.01"
              placeholder="Amount (₪)"
              className="w-32 rounded-lg border border-line bg-white px-3 py-2 text-sm"
            />
            {direction === "expense" && (
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="flex-1 rounded-lg border border-line bg-white px-2 py-2 text-sm"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What was it?"
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
          />
          <button className="w-full rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">
            Log
          </button>
        </form>
      </section>

      <section className="card p-4">
        <p className="mb-3 text-sm font-medium">This month&apos;s transactions</p>
        <ul className="space-y-1 text-sm">
          {transactions.map((t) => (
            <li key={t.id} className="flex items-center justify-between">
              <span>
                {t.description}{" "}
                <span className="text-xs text-ink-muted">
                  · {categories.find((c) => c.id === t.category_id)?.name ?? "—"} · {userName(t.payer_user_id)}
                </span>
              </span>
              <span className={t.direction === "income" ? "text-ok" : ""}>
                {t.direction === "income" ? "+" : "-"}
                {formatILS(t.amount_agorot)}
              </span>
            </li>
          ))}
          {transactions.length === 0 && <li className="text-ink-muted">No transactions logged yet.</li>}
        </ul>
      </section>
    </div>
  );
}
