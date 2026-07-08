import type { Chore } from "@/lib/types";

/**
 * Deterministic weighted round-robin — no LLM needed for Phase 1.
 * Greedily assigns each chore (heaviest first) to whichever of the two
 * users currently has the lower cumulative effort_weight, so the split
 * stays balanced regardless of chore count. `shuffleSeed` lets
 * "Reshuffle" produce a different (but still balanced) assignment.
 */
export function buildRotation(
  chores: Chore[],
  userIds: [string, string],
  shuffleSeed = 0
): Record<string, string> {
  const sorted = [...chores].sort((a, b) => b.effort_weight - a.effort_weight);
  const totals: Record<string, number> = { [userIds[0]]: 0, [userIds[1]]: 0 };
  const assignment: Record<string, string> = {};

  // Alternate which partner "wins" ties so reshuffling actually changes something.
  const [first, second] = shuffleSeed % 2 === 0 ? userIds : [userIds[1], userIds[0]];

  sorted.forEach((chore) => {
    const winner = totals[first] <= totals[second] ? first : second;
    assignment[chore.id] = winner;
    totals[winner] += chore.effort_weight;
  });

  return assignment;
}

export function fairnessSplit(
  chores: Chore[],
  assignment: Record<string, string>,
  userIds: [string, string]
): Record<string, number> {
  const totals: Record<string, number> = { [userIds[0]]: 0, [userIds[1]]: 0 };
  chores.forEach((c) => {
    const uid = assignment[c.id];
    if (uid) totals[uid] = (totals[uid] ?? 0) + c.effort_weight;
  });
  return totals;
}
