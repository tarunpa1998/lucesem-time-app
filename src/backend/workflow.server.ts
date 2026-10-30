import { sql } from "./db.server";
import type { PeriodLock } from "@/domain/locks";

export async function locksFor(userId: string): Promise<PeriodLock[]> {
  const rows = await sql()<{ user_id: string | null; f: string; t: string }[]>`
    select user_id, to_char(from_date,'YYYY-MM-DD') f, to_char(to_date,'YYYY-MM-DD') t
    from period_locks where user_id is null or user_id = ${userId}`;
  return rows.map((r) => ({ userId: r.user_id, fromDate: r.f, toDate: r.t }));
}

export async function unlockedDatesFor(userId: string): Promise<string[]> {
  const rows = await sql()<{ d: string }[]>`
    select to_char(entry_date,'YYYY-MM-DD') d from unlock_requests
    where user_id = ${userId} and status = 'approved' and decided_at > now() - interval '14 days'`;
  return rows.map((r) => r.d);
}

export async function notify(userId: string, kind: string, message: string, link?: string) {
  await sql()`insert into notifications (user_id, kind, message, link)
    values (${userId}, ${kind}, ${message}, ${link ?? null})`;
}

export async function notifyAdmins(kind: string, message: string, link?: string) {
  await sql()`insert into notifications (user_id, kind, message, link)
    select user_id, ${kind}, ${message}, ${link ?? null} from user_roles where role = 'admin'`;
}

export interface BudgetUsageRow {
  id: string;
  name: string;
  customer_name: string;
  time_budget_hours: number | null;
  monetary_budget: number | null;
  used_hours: number;
  used_money: number;
  budget_alert_level: number;
}

/** Usage for projects with at least one budget set (optionally only some ids). */
export async function projectBudgetUsage(ids: string[] | null): Promise<BudgetUsageRow[]> {
  const rows = await sql()<Record<string, unknown>[]>`
    select p.id, p.name, c.name customer_name, p.time_budget_hours::float8 time_budget_hours,
      p.monetary_budget::float8 monetary_budget, p.budget_alert_level,
      coalesce(sum(extract(epoch from (e.to_time - e.from_time)) / 3600.0), 0)::float8 used_hours,
      coalesce(sum(extract(epoch from (e.to_time - e.from_time)) / 3600.0) * coalesce(p.hourly_rate, 0), 0)::float8 used_money
    from projects p join customers c on c.id = p.customer_id
    left join time_entries e on e.project_id = p.id and e.status <> 'rejected'
    where (coalesce(p.time_budget_hours, 0) > 0 or coalesce(p.monetary_budget, 0) > 0)
      and (${ids === null} or p.id = any(${ids ?? []}::uuid[]))
    group by p.id, c.name order by p.name`;
  return rows as unknown as BudgetUsageRow[];
}

/** Notify admins once when a project crosses 80 % or 100 % of its budget. */
export async function checkBudgets(projectIds: string[]) {
  if (!projectIds.length) return;
  const { budgetLevel } = await import("@/domain/budget");
  for (const p of await projectBudgetUsage([...new Set(projectIds)])) {
    const level = budgetLevel({
      timeBudgetHours: p.time_budget_hours,
      monetaryBudget: p.monetary_budget,
      usedHours: p.used_hours,
      usedMoney: p.used_money,
    });
    if (level > p.budget_alert_level) {
      await notifyAdmins(
        level === 2 ? "budget.over" : "budget.warn",
        `${p.name}: ${level === 2 ? "over budget" : "80 % of budget used"}`,
        "/admin/projects",
      );
    }
    if (level !== p.budget_alert_level)
      await sql()`update projects set budget_alert_level = ${level} where id = ${p.id}`;
  }
}
