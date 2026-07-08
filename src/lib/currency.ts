/** All money is stored in agorot (1 ILS = 100 agorot) to avoid float rounding. */
export function agorotToILS(agorot: number): number {
  return agorot / 100;
}

export function ilsToAgorot(ils: number): number {
  return Math.round(ils * 100);
}

const formatter = new Intl.NumberFormat("he-IL", {
  style: "currency",
  currency: "ILS",
  maximumFractionDigits: 0,
});

export function formatILS(agorot: number): string {
  return formatter.format(agorotToILS(agorot));
}

export type BudgetState = "ok" | "warning" | "danger";

export function budgetState(spentAgorot: number, capAgorot: number): BudgetState {
  if (capAgorot <= 0) return "ok";
  const pct = spentAgorot / capAgorot;
  if (pct >= 0.9) return "danger";
  if (pct >= 0.75) return "warning";
  return "ok";
}
