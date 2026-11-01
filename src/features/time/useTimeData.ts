import { useCallback, useEffect, useState } from "react";
import { notify } from "@/components/core";
import { db, uid, type ActiveTimer, type LocalEntry } from "@/lib/offline-db";
import { ymd } from "@/domain/holidays";
import { elapsedSeconds, isAbsenceMode, type EntryMode } from "@/domain/rules";
import { listMyEntries, syncEntries, reportTimer, deleteMyEntry } from "@/backend/time.functions";

const hhmm = (d: Date) =>
  d.toLocaleTimeString("de-AT", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "Europe/Vienna",
  });

export interface TimeCtx {
  userId: string;
  isPendingProject: (id: string) => boolean;
  requiresApproval: boolean;
  isAdmin?: boolean;
}

export function useTimeData(ctx: TimeCtx) {
  const [entries, setEntries] = useState<LocalEntry[]>([]);
  const [timer, setTimer] = useState<ActiveTimer | null>(null);
  const [outbox, setOutbox] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [ready, setReady] = useState(false);

  const reload = useCallback(async () => {
    const d = db();
    // Local cache belongs to one account: wipe it when a different user signs in.
    const OWNER = "lucesem_owner";
    if (ctx.userId && localStorage.getItem(OWNER) !== ctx.userId) {
      await d.entries.clear();
      await d.syncOutbox.filter((i) => i.userId !== ctx.userId).delete();
      localStorage.setItem(OWNER, ctx.userId);
    }
    setEntries(await d.entries.orderBy("entryDate").reverse().toArray());
    setTimer((await d.activeTimers.where("userId").equals(ctx.userId).first()) ?? null);
    setOutbox(await d.syncOutbox.filter((i) => i.userId === ctx.userId).count());
  }, [ctx.userId]);

  /** Push queued entries to the server, then mirror the server's list locally. */
  const sync = useCallback(async () => {
    if (!navigator.onLine) return;
    const d = db();
    try {
      const items = await d.syncOutbox.filter((i) => i.userId === ctx.userId).toArray();
      const deletes = items.filter((i) => i.kind === "entry.delete");
      const upserts = items.filter((i) => i.kind !== "timer.start" && i.kind !== "entry.delete");
      if (deletes.length) {
        for (const item of deletes) {
          const p = item.payload as { id: string };
          try {
            await deleteMyEntry({ data: { id: p.id } });
          } catch {
            // Retried on next sync if server fails
          }
        }
      }
      if (upserts.length) {
        const payload = upserts.map((i) => {
          const e = i.payload as LocalEntry;
          return {
            id: e.id,
            entryDate: e.entryDate,
            fromTime: e.fromTime,
            toTime: e.toTime,
            projectId: e.projectId,
            workNotes: e.workNotes ?? "",
            entryMode: e.entryMode,
            activityId: e.activityId ?? null,
          };
        });
        const res = await syncEntries({ data: { entries: payload } });
        if (res.rejected.length)
          notify.show({
            color: "red",
            message: `${res.rejected.length} ✗ (${[...new Set(res.rejected.map((r) => r.reason))].join(", ")})`,
          });
      }
      // Timer-start markers are local-only; everything sent is done.
      await d.syncOutbox.bulkDelete(items.map((i) => i.id!));
      const server = await listMyEntries();
      await d.transaction("rw", d.entries, async () => {
        await d.entries.clear();
        await d.entries.bulkPut(server as LocalEntry[]);
      });
    } catch {
      // Stay queued; retried on next online event / interval.
    }
    reload();
  }, [reload, ctx.userId]);

  useEffect(() => {
    reload()
      .then(() => setReady(true))
      .then(sync);
    const i = setInterval(() => setNow(Date.now()), 1000);
    const s = setInterval(sync, 60_000);
    window.addEventListener("online", sync);
    const onVis = () => document.visibilityState === "visible" && sync();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(i);
      clearInterval(s);
      window.removeEventListener("online", sync);
    };
  }, [reload, sync]);

  const statusFor = (projectId?: string | null, entryMode?: EntryMode): LocalEntry["status"] => {
    if (entryMode && isAbsenceMode(entryMode)) {
      return ctx.isAdmin ? "approved" : "pending";
    }
    if (!projectId) return "approved";
    return ctx.requiresApproval || ctx.isPendingProject(projectId) ? "pending" : "approved";
  };

  const startTimer = async (projectId: string, workNotes: string) => {
    const t: ActiveTimer = {
      clientTimerId: uid(),
      userId: ctx.userId,
      projectId,
      startTimeUtc: Date.now(),
      workNotes,
    };
    await db().activeTimers.put(t);
    await db().syncOutbox.add({
      kind: "timer.start",
      payload: t,
      userId: ctx.userId,
      createdAt: Date.now(),
    });
    reportTimer({ data: { running: true, projectId, startedAt: t.startTimeUtc, workNotes } }).catch(
      () => {},
    );
    reload();
  };

  const stopTimer = async (workNotes: string) => {
    if (!timer) return;
    const start = new Date(timer.startTimeUtc);
    const end = new Date();
    const entry: LocalEntry = {
      id: uid(),
      entryDate: ymd(start),
      fromTime: hhmm(start),
      toTime: hhmm(end) === hhmm(start) ? hhmm(new Date(end.getTime() + 60_000)) : hhmm(end),
      projectId: timer.projectId,
      workNotes: workNotes || timer.workNotes,
      entryMode: "CustomHours",
      status: statusFor(timer.projectId, "CustomHours"),
      createdAt: Date.now(),
    };
    await db().entries.put(entry);
    await db().activeTimers.delete(timer.clientTimerId);
    reportTimer({ data: { running: false } }).catch(() => {});
    await db().syncOutbox.add({
      kind: "timer.stop",
      payload: entry,
      userId: ctx.userId,
      createdAt: Date.now(),
    });
    // Online: save to the database right away. Offline: stays queued until reconnect.
    await sync();
  };

  const saveEntry = async (
    e: Omit<LocalEntry, "id" | "createdAt" | "status"> & { id?: string },
  ) => {
    const entry: LocalEntry = {
      ...e,
      id: e.id ?? uid(),
      createdAt: Date.now(),
      status: statusFor(e.projectId, e.entryMode),
    };
    await db().entries.put(entry);
    await db().syncOutbox.add({
      kind: "entry.upsert",
      payload: entry,
      userId: ctx.userId,
      createdAt: Date.now(),
    });
    notify.show({ color: "lucesem", message: e.id ? "@entryUpdated" : "@entrySaved" });
    // Online: save to the database right away. Offline: stays queued until reconnect.
    await sync();
  };

  const deleteEntry = async (id: string) => {
    await db().entries.delete(id);
    await db().syncOutbox.add({
      kind: "entry.delete",
      payload: { id },
      userId: ctx.userId,
      createdAt: Date.now(),
    });
    notify.show({ color: "lucesem", message: "@entryDeleted" });
    await sync();
  };

  const updateTimerNotes = useCallback(
    async (workNotes: string) => {
      const d = db();
      const current = timer ?? (await d.activeTimers.where("userId").equals(ctx.userId).first());
      if (!current) return;
      const updated: ActiveTimer = { ...current, workNotes };
      await d.activeTimers.put(updated);
      setTimer(updated);
      reportTimer({
        data: {
          running: true,
          projectId: current.projectId,
          startedAt: current.startTimeUtc,
          workNotes,
        },
      }).catch(() => {});
    },
    [timer, ctx.userId],
  );

  const elapsed = timer ? elapsedSeconds(timer.startTimeUtc, now) : 0;
  return {
    ready,
    entries,
    timer,
    elapsed,
    outbox,
    startTimer,
    stopTimer,
    updateTimerNotes,
    saveEntry,
    deleteEntry,
    now,
  };
}

export const entryHours = (e: Pick<LocalEntry, "fromTime" | "toTime">) => {
  const [fh, fm] = e.fromTime.split(":").map(Number) as [number, number];
  const [th, tm] = e.toTime.split(":").map(Number) as [number, number];
  return Math.max(0, (th * 60 + tm - fh * 60 - fm) / 60);
};
