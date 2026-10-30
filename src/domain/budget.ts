/** Budget usage of a project. Budgets are optional; null budget = no warning. */
export interface BudgetInput {
  timeBudgetHours: number | null;
  monetaryBudget: number | null;
  usedHours: number;
  usedMoney: number;
}

export const WARN_AT = 0.8;

/** Highest usage ratio across the budgets that are set, or null if none set. */
export function budgetRatio(b: BudgetInput): number | null {
  const r: number[] = [];
  if (b.timeBudgetHours && b.timeBudgetHours > 0) r.push(b.usedHours / b.timeBudgetHours);
  if (b.monetaryBudget && b.monetaryBudget > 0) r.push(b.usedMoney / b.monetaryBudget);
  return r.length ? Math.max(...r) : null;
}

/** 0 = fine / no budget, 1 = ≥80 %, 2 = ≥100 % (over budget). */
export function budgetLevel(b: BudgetInput): 0 | 1 | 2 {
  const r = budgetRatio(b);
  if (r === null) return 0;
  if (r >= 1) return 2;
  if (r >= WARN_AT) return 1;
  return 0;
}

/** Absence days: distinct dates per entry mode (a split day still counts once). */
export function countAbsenceDays(
  entries: { entryDate: string; entryMode: string }[],
  mode: string,
) {
  return new Set(entries.filter((e) => e.entryMode === mode).map((e) => e.entryDate)).size;
}
