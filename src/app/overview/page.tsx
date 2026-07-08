"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { BudgetBar } from "@/components/ui/BudgetBar";
import { currentWeekStart, isoDate, todayDayIndex } from "@/lib/date";
import type { Category, GroceryItem, Task } from "@/lib/types";

export default function OverviewPage() {
  const supabase = createClient();
  const { appUser } = useAuth();

  const [dinner, setDinner] = useState<string | null | undefined>(undefined);
  const [openGroceries, setOpenGroceries] = useState<GroceryItem[]>([]);
  const [choresLeft, setChoresLeft] = useState(0);
  const [choresTotal, setChoresTotal] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [spendByCategory, setSpendByCategory] = useState<Record<string, number>>({});
  const [openTasks, setOpenTasks] = useState<Task[]>([]);

  useEffect(() => {
    if (!appUser) return;
    const householdId = appUser.household_id;
    const weekStart = isoDate(currentWeekStart());

    (async () => {
      // Tonight's dinner
      const { data: plan } = await supabase
        .from("meal_plan")
        .select("id")
        .eq("household_id", householdId)
        .eq("week_start", weekStart)
        .maybeSingle();

      if (plan) {
        const { data: day } = await supabase
          .from("meal_plan_day")
          .select("free_text, recipe:recipe_id(title)")
          .eq("plan_id", plan.id)
          .eq("day_index", todayDayIndex())
          .maybeSingle();
        setDinner(
          (day?.recipe as unknown as { title: string } | null)?.title ??
            day?.free_text ??
            null
        );
      } else {
        setDinner(null);
      }

      // Groceries
      const { data: groceries } = await supabase
        .from("grocery_item")
        .select("*")
        .eq("household_id", householdId)
        .eq("done", false);
      setOpenGroceries(groceries ?? []);

      // Chores this week
      const { data: chores } = await supabase
        .from("chore")
        .select("id")
        .eq("household_id", householdId)
        .eq("active", true);
      const { data: assignments } = await supabase
        .from("chore_assignment")
        .select("done_at")
        .eq("week_start", weekStart);
      setChoresTotal(chores?.length ?? 0);
      setChoresLeft((assignments ?? []).filter((a) => !a.done_at).length);

      // Budget month-to-date
      const monthStart = new Date();
      monthStart.setDate(1);
      const { data: cats } = await supabase
        .from("category")
        .select("*")
        .eq("household_id", householdId)
        .order("sort_order");
      setCategories(cats ?? []);

      const { data: txns } = await supabase
        .from("transaction")
        .select("amount_agorot, category_id, direction")
        .eq("household_id", householdId)
        .eq("direction", "expense")
        .gte("occurred_at", isoDate(monthStart));

      const spend: Record<string, number> = {};
      (txns ?? []).forEach((t) => {
        if (!t.category_id) return;
        spend[t.category_id] = (spend[t.category_id] ?? 0) + t.amount_agorot;
      });
      setSpendByCategory(spend);

      // Tasks
      const { data: tasks } = await supabase
        .from("task")
        .select("*")
        .eq("household_id", householdId)
        .is("done_at", null)
        .order("due_date", { ascending: true, nullsFirst: false })
        .limit(5);
      setOpenTasks(tasks ?? []);
    })();
  }, [appUser, supabase]);

  const totalSpent = Object.values(spendByCategory).reduce((a, b) => a + b, 0);
  const totalCap = categories.reduce((a, c) => a + c.monthly_cap_agorot, 0);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">
        {greeting()}, {appUser?.name ?? ""} 👋
      </h1>

      <Link href="/apartment/food" className="card block p-4">
        <p className="text-xs uppercase tracking-wide text-ink-muted">Tonight&apos;s dinner</p>
        <p className="mt-1 text-lg">
          {dinner === undefined ? "…" : dinner ?? "Not planned yet"}
        </p>
      </Link>

      <div className="grid grid-cols-2 gap-4">
        <Link href="/apartment/food" className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Groceries</p>
          <p className="mt-1 text-lg">{openGroceries.length} open</p>
        </Link>
        <Link href="/apartment/cleaning" className="card p-4">
          <p className="text-xs uppercase tracking-wide text-ink-muted">Chores left</p>
          <p className="mt-1 text-lg">
            {choresLeft} / {choresTotal} this week
          </p>
        </Link>
      </div>

      <Link href="/finance" className="card block p-4">
        <p className="text-xs uppercase tracking-wide text-ink-muted">
          Budget — month to date
        </p>
        <div className="mt-2">
          <BudgetBar label="All categories" spentAgorot={totalSpent} capAgorot={totalCap} />
        </div>
      </Link>

      <Link href="/tasks" className="card block p-4">
        <p className="text-xs uppercase tracking-wide text-ink-muted">Open tasks</p>
        <ul className="mt-2 space-y-1 text-sm">
          {openTasks.length === 0 && <li className="text-ink-muted">Nothing open 🎉</li>}
          {openTasks.map((t) => (
            <li key={t.id} className="flex justify-between">
              <span>{t.title}</span>
              {t.due_date && <span className="text-ink-muted">{t.due_date}</span>}
            </li>
          ))}
        </ul>
      </Link>
    </div>
  );
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}
