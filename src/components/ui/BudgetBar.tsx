import { budgetState, formatILS } from "@/lib/currency";

export function BudgetBar({
  label,
  spentAgorot,
  capAgorot,
}: {
  label: string;
  spentAgorot: number;
  capAgorot: number;
}) {
  const state = budgetState(spentAgorot, capAgorot);
  const pct = capAgorot > 0 ? Math.min(100, (spentAgorot / capAgorot) * 100) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium">{label}</span>
        <span className="text-ink-muted">
          {formatILS(spentAgorot)} / {formatILS(capAgorot)}
        </span>
      </div>
      <div className="budget-bar-track mt-1 h-2 w-full">
        <div
          className="budget-bar-fill h-full transition-all"
          data-state={state}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
