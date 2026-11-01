import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const entrySchema = z.object({
  id: z.string().uuid(),
  entryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fromTime: z.string().regex(/^\d{2}:\d{2}$/),
  toTime: z.string().regex(/^\d{2}:\d{2}$/),
  projectId: z.string().uuid().nullable().optional(),
  workNotes: z.string().max(2000).default(""),
  entryMode: z.string().max(40).default("CustomHours"),
  activityId: z.string().uuid().nullable().optional(),
  taskId: z.string().uuid().nullable().optional(),
});

export interface ServerEntry {
  id: string;
  entryDate: string;
  fromTime: string;
  toTime: string;
  projectId: string | null;
  workNotes: string;
  entryMode: string;
  status: "pending" | "approved";
  createdAt: number;
  activityId: string | null;
  taskId: string | null;
  taskTitle: string | null;
  taskNumber: number | null;
}

/** The signed-in user's own time entries (last 400 days). */
export const listMyEntries = createServerFn({ method: "GET" }).handler(async () => {
  const { sql } = await import("./db.server");
  const { requireUser } = await import("./auth.server");
  const u = await requireUser();
  const rows = await sql()<
    {
      id: string;
      d: string;
      f: string;
      t: string;
      project_id: string;
      work_notes: string;
      entry_mode: string;
      status: string;
      created_at: Date;
      activity_id: string | null;
      task_id: string | null;
      task_title: string | null;
      task_number: number | null;
    }[]
  >`select te.id, to_char(te.entry_date,'YYYY-MM-DD') d, to_char(te.from_time,'HH24:MI') f, to_char(te.to_time,'HH24:MI') t,
       te.project_id, te.work_notes, te.entry_mode, te.status, te.created_at, te.activity_id,
       te.task_id, bt.title as task_title, bt.task_number as task_number
     from time_entries te
     left join board_tasks bt on bt.id = te.task_id
     where te.user_id = ${u.id} and te.entry_date > current_date - 400
     order by te.entry_date desc, te.from_time desc`;
  return rows.map((r): ServerEntry => ({
    id: r.id,
    entryDate: r.d,
    fromTime: r.f,
    toTime: r.t,
    projectId: r.project_id,
    workNotes: r.work_notes,
    entryMode: r.entry_mode,
    status: r.status === "approved" ? "approved" : "pending",
    createdAt: new Date(r.created_at).getTime(),
    activityId: r.activity_id,
    taskId: r.task_id,
    taskTitle: r.task_title,
    taskNumber: r.task_number ? Number(r.task_number) : null,
  }));
});

/** Batch upsert from the offline outbox. Only the owner may write; project access is checked. */
export const syncEntries = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ entries: z.array(entrySchema).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireUser } = await import("./auth.server");
    const { locksFor, unlockedDatesFor, notifyAdmins } = await import("./workflow.server");
    const { entryWriteVerdict, viennaToday } = await import("@/domain/locks");
    const u = await requireUser();
    const [locks, unlockedDates] = await Promise.all([locksFor(u.id), unlockedDatesFor(u.id)]);
    const today = viennaToday();
    const saved: string[] = [];
    const rejected: { id: string; reason: string }[] = [];
    let pendingCount = 0;
    for (const e of data.entries) {
      if (e.toTime <= e.fromTime) {
        rejected.push({ id: e.id, reason: "time" });
        continue;
      }
      const [prev] = await sql()<{ exported_at: Date | null; user_id: string }[]>`
        select exported_at, user_id from time_entries where id = ${e.id}`;
      if (prev && prev.user_id !== u.id) {
        rejected.push({ id: e.id, reason: "forbidden" });
        continue;
      }
      const isAbsence = [
        "Vacation_Urlaub",
        "SickLeave_Krankenstand",
        "Compensatory_Zeitausgleich",
      ].includes(e.entryMode);
      const verdict = entryWriteVerdict({
        date: e.entryDate,
        today,
        userId: u.id,
        isAdmin: u.isAdmin,
        unlockedDates,
        locks,
        exported: !!prev?.exported_at,
        isAbsence,
      });
      if (verdict !== "ok") {
        rejected.push({ id: e.id, reason: verdict });
        continue;
      }

      let p: { approval_state: string } | undefined = undefined;
      if (e.projectId) {
        const [found] = await sql()<{ approval_state: string }[]>`
          select p.approval_state from projects p join customers c on c.id = p.customer_id
          where p.id = ${e.projectId} and (${u.isAdmin} or (p.approval_state <> 'Rejected' and (
            p.created_by = ${u.id}
            or exists (select 1 from project_users pu where pu.project_id = p.id and pu.user_id = ${u.id})
            or exists (select 1 from project_teams pt join team_members tm on tm.team_id = pt.team_id
                       where pt.project_id = p.id and tm.user_id = ${u.id})
            or exists (select 1 from customer_teams ct join team_members tm on tm.team_id = ct.team_id
                       where ct.customer_id = c.id and tm.user_id = ${u.id}))))`;
        p = found;
        if (!p) {
          rejected.push({ id: e.id, reason: "project" });
          continue;
        }
      } else if (!isAbsence) {
        rejected.push({ id: e.id, reason: "project" });
        continue;
      }

      // Vacation, sick leave, and comp time always need admin approval (admins approve their own).
      const status =
        (!u.isAdmin && isAbsence) ||
        u.requiresTimesheetApproval ||
        (p && p.approval_state !== "Approved")
          ? "pending"
          : "approved";
      // Check if an entry for this user and time slot already exists under another ID
      const [existingSlot] = await sql()<{ id: string }[]>`
        select id from time_entries
        where user_id = ${u.id}
          and entry_date = ${e.entryDate}
          and from_time = ${e.fromTime}
          and to_time = ${e.toTime}
          and id <> ${e.id}
      `;
      if (existingSlot) {
        // An entry already exists for this exact time slot: update it instead of creating a duplicate
        await sql()`
          update time_entries set
            project_id = ${e.projectId ?? null},
            work_notes = ${e.workNotes},
            entry_mode = ${e.entryMode},
            activity_id = ${e.activityId ?? null},
            task_id = ${e.taskId ?? null},
            updated_at = now()
          where id = ${existingSlot.id}
        `;
        saved.push(e.id);
        continue;
      }

      const r = await sql()`
        insert into time_entries (id, user_id, project_id, entry_date, from_time, to_time, work_notes, entry_mode, status, activity_id, task_id)
        values (${e.id}, ${u.id}, ${e.projectId ?? null}, ${e.entryDate}, ${e.fromTime}, ${e.toTime}, ${e.workNotes}, ${e.entryMode}, ${status}, ${e.activityId ?? null}, ${e.taskId ?? null})
        on conflict (id) do update set project_id = excluded.project_id, entry_date = excluded.entry_date,
          from_time = excluded.from_time, to_time = excluded.to_time, work_notes = excluded.work_notes,
          entry_mode = excluded.entry_mode, status = excluded.status, activity_id = excluded.activity_id,
          task_id = excluded.task_id, updated_at = now()
        where time_entries.user_id = ${u.id}`;
      if (r.count) {
        saved.push(e.id);
        if (status === "pending") pendingCount++;
      } else rejected.push({ id: e.id, reason: "forbidden" });
    }
    const { checkBudgets } = await import("./workflow.server");
    const projectIdsWithEntries = data.entries
      .filter((e) => e.projectId && saved.includes(e.id))
      .map((e) => e.projectId as string);
    await checkBudgets(projectIdsWithEntries);
    if (pendingCount)
      await notifyAdmins(
        "entry.pending",
        `${u.displayName}: ${pendingCount} entr${pendingCount > 1 ? "ies" : "y"} awaiting approval`,
        "/approvals",
      );
    return { saved, rejected };
  });

/** Mirrors the running timer on the server so admins see the live board. */
export const reportTimer = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        running: z.boolean(),
        projectId: z.string().uuid().nullable().optional(),
        startedAt: z.number().optional(),
        workNotes: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireUser } = await import("./auth.server");
    const u = await requireUser();
    if (!data.running) {
      await sql()`delete from active_timers where user_id = ${u.id}`;
      return { ok: true };
    }
    const started = new Date(data.startedAt ?? Date.now());
    await sql()`insert into active_timers (user_id, project_id, started_at, work_notes)
      values (${u.id}, ${data.projectId ?? null}, ${started}, ${data.workNotes ?? ""})
      on conflict (user_id) do update set project_id = excluded.project_id,
        started_at = excluded.started_at, work_notes = excluded.work_notes`;
    return { ok: true };
  });

/** Deletes an unlocked, unexported entry belonging to the signed-in user (or admin). */
export const deleteMyEntry = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireUser, audit } = await import("./auth.server");
    const { locksFor, unlockedDatesFor, checkBudgets } = await import("./workflow.server");
    const { entryWriteVerdict, viennaToday } = await import("@/domain/locks");
    const u = await requireUser();

    const [entry] = await sql()<
      {
        id: string;
        user_id: string;
        entry_date: string;
        entry_mode: string;
        exported_at: Date | null;
        project_id: string | null;
      }[]
    >`select id, user_id, to_char(entry_date, 'YYYY-MM-DD') as entry_date, entry_mode, exported_at, project_id
      from time_entries where id = ${data.id}`;

    if (!entry) {
      return { ok: false, error: "not_found" };
    }
    if (entry.user_id !== u.id && !u.isAdmin) {
      return { ok: false, error: "forbidden" };
    }

    const today = viennaToday();
    const [locks, unlockedDates] = await Promise.all([locksFor(u.id), unlockedDatesFor(u.id)]);
    const isAbsence = [
      "Vacation_Urlaub",
      "SickLeave_Krankenstand",
      "Compensatory_Zeitausgleich",
    ].includes(entry.entry_mode);

    const verdict = entryWriteVerdict({
      date: entry.entry_date,
      today,
      userId: u.id,
      isAdmin: u.isAdmin,
      unlockedDates,
      locks,
      exported: !!entry.exported_at,
      isAbsence,
    });

    if (verdict !== "ok") {
      return { ok: false, error: verdict };
    }

    await sql()`delete from time_entries where id = ${data.id} and user_id = ${entry.user_id}`;

    if (entry.project_id) {
      await checkBudgets([entry.project_id]);
    }

    await audit(u.id, "entry.delete", "time_entries", data.id, { entryDate: entry.entry_date });

    return { ok: true };
  });
