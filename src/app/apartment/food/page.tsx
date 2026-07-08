"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { currentWeekStart, isoDate, DAY_LABELS } from "@/lib/date";
import type { AppUser, GroceryItem, MealPlanDay, Recipe } from "@/lib/types";

export default function FoodPage() {
  const supabase = createClient();
  const { appUser } = useAuth();

  const [planId, setPlanId] = useState<string | null>(null);
  const [days, setDays] = useState<MealPlanDay[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [groceries, setGroceries] = useState<GroceryItem[]>([]);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [newItem, setNewItem] = useState("");
  const [newRecipe, setNewRecipe] = useState("");

  const householdId = appUser?.household_id;

  const loadAll = useCallback(async () => {
    if (!householdId) return;
    const weekStart = isoDate(currentWeekStart());

    let { data: plan } = await supabase
      .from("meal_plan")
      .select("*")
      .eq("household_id", householdId)
      .eq("week_start", weekStart)
      .maybeSingle();

    if (!plan) {
      const { data: created } = await supabase
        .from("meal_plan")
        .insert({ household_id: householdId, week_start: weekStart })
        .select()
        .single();
      plan = created;
    }
    setPlanId(plan?.id ?? null);

    if (plan) {
      const { data: dayRows } = await supabase
        .from("meal_plan_day")
        .select("*")
        .eq("plan_id", plan.id);
      setDays(dayRows ?? []);
    }

    const [{ data: recipeRows }, { data: groceryRows }, { data: userRows }] =
      await Promise.all([
        supabase.from("recipe").select("*").eq("household_id", householdId).order("rating", { ascending: false }),
        supabase.from("grocery_item").select("*").eq("household_id", householdId).order("created_at", { ascending: false }),
        supabase.from("app_user").select("*").eq("household_id", householdId),
      ]);
    setRecipes(recipeRows ?? []);
    setGroceries(groceryRows ?? []);
    setUsers(userRows ?? []);
  }, [householdId, supabase]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Realtime: both partners see grocery changes instantly.
  useEffect(() => {
    if (!householdId) return;
    const channel = supabase
      .channel("food-groceries")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "grocery_item", filter: `household_id=eq.${householdId}` },
        () => loadAll()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [householdId, supabase, loadAll]);

  function userName(id: string | null) {
    return users.find((u) => u.id === id)?.name ?? "—";
  }

  async function setDay(dayIndex: number, value: { recipeId: string | null; freeText: string | null }) {
    if (!planId) return;
    const existing = days.find((d) => d.day_index === dayIndex);
    if (existing) {
      await supabase
        .from("meal_plan_day")
        .update({ recipe_id: value.recipeId, free_text: value.freeText })
        .eq("id", existing.id);
    } else {
      await supabase.from("meal_plan_day").insert({
        plan_id: planId,
        day_index: dayIndex,
        recipe_id: value.recipeId,
        free_text: value.freeText,
      });
    }
    loadAll();
  }

  async function addGrocery(e: React.FormEvent) {
    e.preventDefault();
    if (!newItem.trim() || !householdId || !appUser) return;
    await supabase.from("grocery_item").insert({
      household_id: householdId,
      title: newItem.trim(),
      added_by_user_id: appUser.id,
      source: "app",
    });
    setNewItem("");
  }

  async function toggleGrocery(item: GroceryItem) {
    await supabase.from("grocery_item").update({ done: !item.done }).eq("id", item.id);
  }

  async function removeGrocery(id: string) {
    await supabase.from("grocery_item").delete().eq("id", id);
  }

  async function addRecipe(e: React.FormEvent) {
    e.preventDefault();
    if (!newRecipe.trim() || !householdId) return;
    await supabase.from("recipe").insert({ household_id: householdId, title: newRecipe.trim() });
    setNewRecipe("");
    loadAll();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Food 🍲</h1>

      <section className="card p-4">
        <p className="mb-3 text-sm font-medium">This week&apos;s meal plan</p>
        <div className="space-y-2">
          {DAY_LABELS.map((label, i) => {
            const day = days.find((d) => d.day_index === i);
            const recipe = recipes.find((r) => r.id === day?.recipe_id);
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="w-10 text-xs text-ink-muted">{label}</span>
                <select
                  className="flex-1 rounded-lg border border-line bg-white px-2 py-1.5 text-sm"
                  value={day?.recipe_id ?? ""}
                  onChange={(e) => {
                    const recipeId = e.target.value || null;
                    setDay(i, { recipeId, freeText: recipeId ? null : day?.free_text ?? null });
                  }}
                >
                  <option value="">
                    {day?.free_text || "Not planned"}
                  </option>
                  {recipes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title}
                    </option>
                  ))}
                </select>
                {recipe === undefined && (
                  <input
                    className="w-28 rounded-lg border border-line bg-white px-2 py-1.5 text-sm"
                    placeholder="or type…"
                    defaultValue={day?.free_text ?? ""}
                    onBlur={(e) => setDay(i, { recipeId: null, freeText: e.target.value || null })}
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>

      <section className="card p-4">
        <p className="mb-3 text-sm font-medium">Grocery list</p>
        <form onSubmit={addGrocery} className="mb-3 flex gap-2">
          <input
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            placeholder="Add an item…"
            className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm"
          />
          <button className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">
            Add
          </button>
        </form>
        <ul className="space-y-1">
          {groceries.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={item.done}
                onChange={() => toggleGrocery(item)}
                className="h-4 w-4"
              />
              <span className={`flex-1 ${item.done ? "text-ink-muted line-through" : ""}`}>
                {item.title}
              </span>
              <span className="text-xs text-ink-muted">
                {item.added_by_agent ? `🤖 ${item.added_by_agent}` : userName(item.added_by_user_id)}
              </span>
              <button onClick={() => removeGrocery(item.id)} className="text-ink-muted hover:text-danger">
                ✕
              </button>
            </li>
          ))}
          {groceries.length === 0 && <li className="text-sm text-ink-muted">List is empty.</li>}
        </ul>
      </section>

      <section className="card p-4">
        <p className="mb-3 text-sm font-medium">Recipe box</p>
        <form onSubmit={addRecipe} className="mb-3 flex gap-2">
          <input
            value={newRecipe}
            onChange={(e) => setNewRecipe(e.target.value)}
            placeholder="Save a recipe name…"
            className="flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm"
          />
          <button className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">
            Save
          </button>
        </form>
        <ul className="grid grid-cols-2 gap-2 text-sm">
          {recipes.map((r) => (
            <li key={r.id} className="rounded-lg border border-line px-3 py-2">
              {r.title} {r.rating ? "⭐".repeat(r.rating) : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
