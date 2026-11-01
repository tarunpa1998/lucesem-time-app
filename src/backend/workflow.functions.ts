import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/* ---------------- Late-entry unlock ---------------- */

export const requestUnlock = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ date: ymd, reason: z.string().trim().min(5).max(500) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireUser } = await import("./auth.server");
    const { notifyAdmins } = await import("./workflow.server");
    const u = await requireUser();
    const [open] = await sql()`select 1 from unlock_requests
      where user_id = ${u.id} and entry_date = ${data.date} and status = 'pending'`;
    if (!open) {
      await sql()`insert into unlock_requests (user_id, entry_date, reason)
        values (${u.id}, ${data.date}, ${data.reason})`;
      await notifyAdmins("unlock.requested", `${u.displayName}: unlock ${data.date}`, "/approvals");
    }
    return { ok: true };
  });

export const myUnlockedDates = createServerFn({ method: "GET" }).handler(async () => {
  const { requireUser } = await import("./auth.server");
  const { unlockedDatesFor, locksFor } = await import("./workflow.server");
  const u = await requireUser();
  const [unlocked, locks] = await Promise.all([unlockedDatesFor(u.id), locksFor(u.id)]);
  return { unlocked, locks };
});

/* ---------------- Approval queue (admin) ---------------- */

export interface PendingEntry {
  id: string;
  user_name: string;
  project_name: string;
  customer_name: string;
  entry_date: string;
  from_time: string;
  to_time: string;
  work_notes: string;
}
export interface UnlockRow {
  id: string;
  user_name: string;
  entry_date: string;
  reason: string;
  created_at: string;
}

export const approvalQueue = createServerFn({ method: "GET" }).handler(async () => {
  const { sql } = await import("./db.server");
  const { requireAdmin } = await import("./auth.server");
  await requireAdmin();
  const entries = await sql()<PendingEntry[]>`
    select e.id, u.display_name user_name,
      coalesce(p.name, case 
        when e.entry_mode = 'Vacation_Urlaub' then 'Urlaub'
        when e.entry_mode = 'SickLeave_Krankenstand' then 'Krankenstand'
        when e.entry_mode = 'Compensatory_Zeitausgleich' then 'Zeitausgleich'
        else e.entry_mode end) project_name,
      coalesce(c.name, '—') customer_name,
      to_char(e.entry_date,'YYYY-MM-DD') entry_date, to_char(e.from_time,'HH24:MI') from_time,
      to_char(e.to_time,'HH24:MI') to_time, e.work_notes
    from time_entries e join app_users u on u.id = e.user_id
    left join projects p on p.id = e.project_id left join customers c on c.id = p.customer_id
    where e.status = 'pending' order by e.entry_date, u.display_name limit 500`;
  const unlocks = await sql()<UnlockRow[]>`
    select r.id, u.display_name user_name, to_char(r.entry_date,'YYYY-MM-DD') entry_date, r.reason,
      to_char(r.created_at,'YYYY-MM-DD HH24:MI') created_at
    from unlock_requests r join app_users u on u.id = r.user_id
    where r.status = 'pending' order by r.created_at`;
  return { entries: [...entries], unlocks: [...unlocks] };
});

export const decideEntries = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(500), approve: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireAdmin, audit } = await import("./auth.server");
    const { notify } = await import("./workflow.server");
    const a = await requireAdmin();
    const status = data.approve ? "approved" : "rejected";
    const rows = await sql()<{ user_id: string }[]>`
      update time_entries set status = ${status}, decided_by = ${a.id}, updated_at = now()
      where id in ${sql()(data.ids)} and status = 'pending' returning user_id`;
    const perUser = new Map<string, number>();
    for (const r of rows) perUser.set(r.user_id, (perUser.get(r.user_id) ?? 0) + 1);
    for (const [uid, n] of perUser)
      await notify(uid, `entry.${status}`, `${n} time entr${n > 1 ? "ies" : "y"} ${status}`, "/");
    await audit(a.id, `entries.${status}`, "time_entries", null, { ids: data.ids });
    return { count: rows.length };
  });

export const decideUnlock = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), approve: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireAdmin, audit } = await import("./auth.server");
    const { notify } = await import("./workflow.server");
    const a = await requireAdmin();
    const status = data.approve ? "approved" : "rejected";
    const [r] = await sql()<{ user_id: string; d: string }[]>`
      update unlock_requests set status = ${status}, decided_by = ${a.id}, decided_at = now()
      where id = ${data.id} and status = 'pending'
      returning user_id, to_char(entry_date,'YYYY-MM-DD') d`;
    if (r) {
      await notify(r.user_id, `unlock.${status}`, `Unlock for ${r.d}: ${status}`, "/");
      await audit(a.id, `unlock.${status}`, "unlock_requests", data.id);
    }
    return { ok: !!r };
  });

/* ---------------- Period locks (admin) ---------------- */

export interface LockRow {
  id: string;
  user_id: string | null;
  user_name: string | null;
  from_date: string;
  to_date: string;
  note: string;
}

export const listLocks = createServerFn({ method: "GET" }).handler(async () => {
  const { sql } = await import("./db.server");
  const { requireAdmin } = await import("./auth.server");
  await requireAdmin();
  return [
    ...(await sql()<LockRow[]>`
    select l.id, l.user_id, u.display_name user_name, to_char(l.from_date,'YYYY-MM-DD') from_date,
      to_char(l.to_date,'YYYY-MM-DD') to_date, l.note
    from period_locks l left join app_users u on u.id = l.user_id order by l.from_date desc`),
  ];
});

export const addLock = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        userId: z.string().uuid().nullable(),
        fromDate: ymd,
        toDate: ymd,
        note: z.string().max(200).default(""),
      })
      .refine((v) => v.toDate >= v.fromDate)
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireAdmin, audit } = await import("./auth.server");
    const a = await requireAdmin();
    const [r] = await sql()<{ id: string }[]>`
      insert into period_locks (user_id, from_date, to_date, note, created_by)
      values (${data.userId}, ${data.fromDate}, ${data.toDate}, ${data.note}, ${a.id}) returning id`;
    await audit(a.id, "lock.add", "period_locks", r!.id, data);
    return { ok: true };
  });

export const removeLock = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireAdmin, audit } = await import("./auth.server");
    const a = await requireAdmin();
    await sql()`delete from period_locks where id = ${data.id}`;
    await audit(a.id, "lock.remove", "period_locks", data.id);
    return { ok: true };
  });

/* ---------------- Live board + audit (admin) ---------------- */

export interface LiveRow {
  user_id: string;
  user_name: string;
  project_name: string | null;
  started_at: string;
  work_notes: string;
}

export const liveBoard = createServerFn({ method: "GET" }).handler(async () => {
  const { sql } = await import("./db.server");
  const { requireAdmin } = await import("./auth.server");
  await requireAdmin();
  return [
    ...(await sql()<LiveRow[]>`
    select t.user_id, u.display_name user_name, p.name project_name,
      to_char(t.started_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') started_at, t.work_notes
    from active_timers t join app_users u on u.id = t.user_id
    left join projects p on p.id = t.project_id order by t.started_at`),
  ];
});

export interface AuditRow {
  id: string;
  actor: string | null;
  action: string;
  entity: string;
  created_at: string;
}

export const auditLog = createServerFn({ method: "GET" }).handler(async () => {
  const { sql } = await import("./db.server");
  const { requireAdmin } = await import("./auth.server");
  await requireAdmin();
  return [
    ...(await sql()<AuditRow[]>`
    select a.id::text, u.display_name actor, a.action, a.entity,
      to_char(a.created_at at time zone 'Europe/Vienna','YYYY-MM-DD HH24:MI') created_at
    from audit_log a left join app_users u on u.id = a.actor_id order by a.id desc limit 100`),
  ];
});

/* ---------------- Reports / export data ---------------- */

export interface ReportRow {
  id: string;
  user_id: string;
  user_name: string;
  customer_id: string | null;
  customer_name: string;
  project_id: string | null;
  project_name: string;
  hourly_rate: number | null;
  entry_date: string;
  from_time: string;
  to_time: string;
  hours: number;
  entry_mode: string;
  work_notes: string;
  status: string;
  exported: boolean;
}

const reportFilter = z.object({
  from: ymd,
  to: ymd,
  userId: z.string().uuid().nullable().optional(),
  customerId: z.string().uuid().nullable().optional(),
  projectId: z.string().uuid().nullable().optional(),
});

/** Users see only their own rows; admins can filter by anyone. */
export const reportData = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => reportFilter.parse(d))
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireUser } = await import("./auth.server");
    const u = await requireUser();
    const userId = u.isAdmin ? (data.userId ?? null) : u.id;
    const rows = await sql()<
      (Omit<ReportRow, "hours" | "hourly_rate"> & {
        hours: string;
        hourly_rate: string | null;
      })[]
    >`
      select e.id, e.user_id, us.display_name user_name, c.id customer_id, coalesce(c.name, '—') customer_name,
        p.id project_id,
        coalesce(p.name, case 
          when e.entry_mode = 'Vacation_Urlaub' then 'Urlaub'
          when e.entry_mode = 'SickLeave_Krankenstand' then 'Krankenstand'
          when e.entry_mode = 'Compensatory_Zeitausgleich' then 'Zeitausgleich'
          else e.entry_mode end) project_name,
        p.hourly_rate,
        to_char(e.entry_date,'YYYY-MM-DD') entry_date, to_char(e.from_time,'HH24:MI') from_time,
        to_char(e.to_time,'HH24:MI') to_time,
        round(extract(epoch from (e.to_time - e.from_time)) / 3600.0, 2) hours,
        e.entry_mode, e.work_notes, e.status, e.exported_at is not null exported
      from time_entries e join app_users us on us.id = e.user_id
      left join projects p on p.id = e.project_id left join customers c on c.id = p.customer_id
      where e.entry_date between ${data.from} and ${data.to}
        and (${userId}::uuid is null or e.user_id = ${userId})
        and (${data.customerId ?? null}::uuid is null or c.id = ${data.customerId ?? null})
        and (${data.projectId ?? null}::uuid is null or p.id = ${data.projectId ?? null})
      order by e.entry_date desc, e.from_time desc limit 5000`;
    return rows.map((r): ReportRow => ({
      ...r,
      hours: Number(r.hours),
      hourly_rate: r.hourly_rate === null ? null : Number(r.hourly_rate),
    }));
  });

/** Locks exported entries so they can no longer be edited (admin). */
export const markExported = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(5000) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireAdmin, audit } = await import("./auth.server");
    const a = await requireAdmin();
    const r = await sql()`update time_entries set exported_at = now()
      where id in ${sql()(data.ids)} and exported_at is null`;
    await audit(a.id, "entries.export_lock", "time_entries", null, { count: r.count });
    return { count: r.count };
  });

/* ---------------- Customer portal ---------------- */

export interface PortalRow {
  customer_id: string;
  customer_name: string;
  token: string | null;
  enabled: boolean | null;
}

export const listPortals = createServerFn({ method: "GET" }).handler(async () => {
  const { sql } = await import("./db.server");
  const { requireAdmin } = await import("./auth.server");
  await requireAdmin();
  return [
    ...(await sql()<PortalRow[]>`
    select c.id customer_id, c.name customer_name, cp.token, cp.enabled
    from customers c left join customer_portals cp on cp.customer_id = c.id order by c.name`),
  ];
});

export const savePortal = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        customerId: z.string().uuid(),
        password: z.string().min(8).max(200).optional(),
        enabled: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireAdmin, audit, hashPassword } = await import("./auth.server");
    const a = await requireAdmin();
    const [existing] =
      await sql()`select 1 from customer_portals where customer_id = ${data.customerId}`;
    if (!existing && !data.password) throw new Error("PASSWORD_REQUIRED");
    if (data.password) {
      const hash = await hashPassword(data.password);
      const token = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(18))))
        .replace(/[+/=]/g, "")
        .slice(0, 24);
      await sql()`insert into customer_portals (customer_id, token, password_hash, enabled)
        values (${data.customerId}, ${token}, ${hash}, ${data.enabled})
        on conflict (customer_id) do update set password_hash = excluded.password_hash,
          enabled = excluded.enabled, updated_at = now()`;
    } else {
      await sql()`update customer_portals set enabled = ${data.enabled}, updated_at = now()
        where customer_id = ${data.customerId}`;
    }
    await audit(a.id, "portal.save", "customers", data.customerId, { enabled: data.enabled });
    return { ok: true };
  });

export interface PortalView {
  customerName: string;
  rows: {
    entry_date: string;
    project_name: string;
    user_name: string;
    hours: number;
    work_notes: string;
  }[];
}

/**
 * Public: password-protected read-only view of a customer's approved hours.
 * Re-verifies the password on every call; returns only approved entries.
 */
export const portalData = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().min(10).max(64),
        password: z.string().min(1).max(200),
        from: ymd,
        to: ymd,
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<PortalView | null> => {
    const { sql } = await import("./db.server");
    const { verifyPassword } = await import("./auth.server");
    const [p] = await sql()<{ customer_id: string; password_hash: string; name: string }[]>`
      select cp.customer_id, cp.password_hash, c.name from customer_portals cp
      join customers c on c.id = cp.customer_id where cp.token = ${data.token} and cp.enabled`;
    if (!p || !(await verifyPassword(data.password, p.password_hash))) return null;
    const rows = await sql()<
      {
        entry_date: string;
        project_name: string;
        user_name: string;
        hours: string;
        work_notes: string;
      }[]
    >`
      select to_char(e.entry_date,'YYYY-MM-DD') entry_date, pr.name project_name, u.display_name user_name,
        round(extract(epoch from (e.to_time - e.from_time)) / 3600.0, 2) hours, e.work_notes
      from time_entries e join projects pr on pr.id = e.project_id join app_users u on u.id = e.user_id
      where pr.customer_id = ${p.customer_id} and e.status = 'approved'
        and e.entry_date between ${data.from} and ${data.to}
      order by e.entry_date, pr.name`;
    return { customerName: p.name, rows: rows.map((r) => ({ ...r, hours: Number(r.hours) })) };
  });

/* ---------------- Admin edit of any user's entry ---------------- */

/** Admins may change or delete any entry, including locked or exported ones. Audited. */
export const adminSaveEntry = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        entryDate: ymd,
        fromTime: z.string().regex(/^\d{2}:\d{2}$/),
        toTime: z.string().regex(/^\d{2}:\d{2}$/),
        projectId: z.string().uuid().nullable().optional(),
        workNotes: z.string().max(2000),
        status: z.enum(["pending", "approved", "rejected"]),
      })
      .refine((v) => v.toTime > v.fromTime, { message: "TO_BEFORE_FROM" })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireAdmin, audit } = await import("./auth.server");
    const { notify } = await import("./workflow.server");
    const a = await requireAdmin();
    const [r] = await sql()<{ user_id: string }[]>`
      update time_entries set entry_date = ${data.entryDate}, from_time = ${data.fromTime},
        to_time = ${data.toTime}, project_id = ${data.projectId ?? null}, work_notes = ${data.workNotes},
        status = ${data.status}, decided_by = ${a.id}, updated_at = now()
      where id = ${data.id} returning user_id`;
    if (!r) throw new Error("NOT_FOUND");
    if (r.user_id !== a.id)
      await notify(
        r.user_id,
        "entry.edited",
        `An admin edited your entry on ${data.entryDate}`,
        "/",
      );
    await audit(a.id, "entry.admin_edit", "time_entries", data.id, data);
    return { ok: true };
  });

export const adminDeleteEntry = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireAdmin, audit } = await import("./auth.server");
    const a = await requireAdmin();
    await sql()`delete from time_entries where id = ${data.id}`;
    await audit(a.id, "entry.admin_delete", "time_entries", data.id);
    return { ok: true };
  });
