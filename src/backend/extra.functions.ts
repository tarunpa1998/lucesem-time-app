import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/* ---------------- Activities (Kimai task types) ---------------- */

export interface ActivityRow {
  id: string;
  project_id: string | null;
  project_name: string | null;
  name: string;
  is_active: boolean;
}

/** Signed-in users get active activities; admins get all (for management). */
export const listActivities = createServerFn({ method: "GET" }).handler(async () => {
  const { sql } = await import("./db.server");
  const { requireUser } = await import("./auth.server");
  const u = await requireUser();
  return [
    ...(await sql()<ActivityRow[]>`
    select a.id, a.project_id, p.name project_name, a.name, a.is_active
    from activities a left join projects p on p.id = a.project_id
    where ${u.isAdmin} or a.is_active order by p.name nulls first, a.name`),
  ];
});

export const saveActivity = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        projectId: z.string().uuid().nullable(),
        name: z.string().trim().min(2).max(100),
        isActive: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireAdmin, audit } = await import("./auth.server");
    const a = await requireAdmin();
    if (data.id)
      await sql()`update activities set project_id=${data.projectId}, name=${data.name},
        is_active=${data.isActive} where id=${data.id}`;
    else
      await sql()`insert into activities (project_id, name, is_active)
        values (${data.projectId}, ${data.name}, ${data.isActive})`;
    await audit(a.id, "activity.save", "activities", data.id ?? null, data);
    return { ok: true };
  });

/* ---------------- Passwords ---------------- */

/** Change own password; requires the current one. Ends all other sessions. */
export const changePassword = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z.object({ current: z.string().min(1).max(200), next: z.string().min(10).max(200) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireUser, verifyPassword, hashPassword, audit } = await import("./auth.server");
    const { getCookie } = await import("@tanstack/react-start/server");
    const u = await requireUser();
    const [row] = await sql()<{ password_hash: string }[]>`
      select password_hash from app_users where id = ${u.id}`;
    if (!row || !(await verifyPassword(data.current, row.password_hash)))
      return { ok: false as const, error: "WRONG_PASSWORD" };
    await sql()`update app_users set password_hash = ${await hashPassword(data.next)} where id = ${u.id}`;
    await sql()`delete from sessions where user_id = ${u.id} and id <> ${getCookie("lucesem_session") ?? ""}`;
    await audit(u.id, "password.change", "app_users", u.id);
    return { ok: true as const };
  });

/* ---------------- Absences (vacation / sick leave) ---------------- */

export interface AbsenceRow {
  user_id: string;
  user_name: string;
  allowance: number;
  vacation_days: number;
  vacation_pending: number;
  sick_days: number;
  comp_days: number;
}
export interface AbsenceEntry {
  id: string;
  user_id: string;
  user_name: string;
  entry_date: string;
  entry_mode: string;
  status: string;
}

/** Yearly absence overview: own row for users, everyone for admins. */
export const absenceOverview = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ year: z.number().int().min(2000).max(2100) }).parse(d))
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireUser } = await import("./auth.server");
    const u = await requireUser();
    const from = `${data.year}-01-01`;
    const to = `${data.year}-12-31`;
    const summary = await sql()<AbsenceRow[]>`
      select us.id user_id, us.display_name user_name, us.vacation_days_per_year::int allowance,
        count(distinct e.entry_date) filter (where e.entry_mode='Vacation_Urlaub' and e.status='approved')::int vacation_days,
        count(distinct e.entry_date) filter (where e.entry_mode='Vacation_Urlaub' and e.status='pending')::int vacation_pending,
        count(distinct e.entry_date) filter (where e.entry_mode='SickLeave_Krankenstand' and e.status<>'rejected')::int sick_days,
        count(distinct e.entry_date) filter (where e.entry_mode='Compensatory_Zeitausgleich' and e.status<>'rejected')::int comp_days
      from app_users us left join time_entries e on e.user_id = us.id and e.entry_date between ${from} and ${to}
      where us.is_active and (${u.isAdmin} or us.id = ${u.id})
      group by us.id order by us.display_name`;
    const entries = await sql()<AbsenceEntry[]>`
      select distinct on (e.user_id, e.entry_date, e.entry_mode) e.id, e.user_id, us.display_name user_name,
        to_char(e.entry_date,'YYYY-MM-DD') entry_date, e.entry_mode, e.status
      from time_entries e join app_users us on us.id = e.user_id
      where e.entry_mode in ('Vacation_Urlaub','SickLeave_Krankenstand','Compensatory_Zeitausgleich')
        and e.entry_date between ${from} and ${to} and (${u.isAdmin} or e.user_id = ${u.id})
      order by e.user_id, e.entry_date desc, e.entry_mode`;
    return { summary: [...summary], entries: [...entries] };
  });

/** Admin: approve/reject all entries of one absence day for a user. */
export const decideAbsence = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.string().uuid(), approve: z.boolean() }).parse(d))
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireAdmin, audit } = await import("./auth.server");
    const { notify } = await import("./workflow.server");
    const a = await requireAdmin();
    const status = data.approve ? "approved" : "rejected";
    const [ref] = await sql()<{ user_id: string; d: string; entry_mode: string }[]>`
      select user_id, to_char(entry_date,'YYYY-MM-DD') d, entry_mode from time_entries where id = ${data.id}`;
    if (!ref) throw new Error("NOT_FOUND");
    await sql()`update time_entries set status=${status}, decided_by=${a.id}, updated_at=now()
      where user_id=${ref.user_id} and entry_date=${ref.d} and entry_mode=${ref.entry_mode}`;
    await notify(
      ref.user_id,
      `absence.${status}`,
      `${ref.entry_mode.split("_")[0]} ${ref.d}: ${status}`,
      "/absences",
    );
    await audit(a.id, `absence.${status}`, "time_entries", data.id);
    return { ok: true };
  });

/* ---------------- Budget warnings ---------------- */

export interface BudgetWarning {
  id: string;
  name: string;
  customer_name: string;
  time_budget_hours: number | null;
  monetary_budget: number | null;
  used_hours: number;
  used_money: number;
}

/** Admin: projects that have a budget, with usage (warning level computed client-side). */
export const budgetUsage = createServerFn({ method: "GET" }).handler(async () => {
  const { requireAdmin } = await import("./auth.server");
  const { projectBudgetUsage } = await import("./workflow.server");
  await requireAdmin();
  return projectBudgetUsage(null);
});
