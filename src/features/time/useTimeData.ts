import { useCallback, useEffect, useState } from "react";
import { notify } from "@/components/core";
import { db, uid, type ActiveTimer, type LocalEntry } from "@/lib/offline-db";
import { ymd } from "@/domain/holidays";
import {
  deriveSlotFromElapsed,
  elapsedSeconds,
  isAbsenceMode,
  type EntryMode,
} from "@/domain/rules";
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
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
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

    // Clean up any stale or duplicate active timers and keep only the single latest timer
    const userTimers = await d.activeTimers.where("userId").equals(ctx.userId).toArray();
    if (userTimers.length > 1) {
      userTimers.sort((a, b) => b.startTimeUtc - a.startTimeUtc);
      const latest = userTimers[0];
      const obsoleteIds = userTimers.slice(1).map((x) => x.clientTimerId);
      await d.activeTimers.bulkDelete(obsoleteIds);
      setTimer(latest ?? null);
    } else {
      setTimer(userTimers[0] ?? null);
    }

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
            taskId: e.taskId ?? null,
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
      // Deduplicate server entries by slot before local storage
      const seen = new Set<string>();
      const deduped: LocalEntry[] = [];
      for (const item of server as LocalEntry[]) {
        const key = `${item.entryDate}_${item.fromTime}_${item.toTime}`;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(item);
        }
      }
      await d.transaction("rw", d.entries, async () => {
        await d.entries.clear();
        await d.entries.bulkPut(deduped);
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

  const startTimer = async (
    projectId: string,
    workNotes: string,
    task?: { id: string; title: string; number?: number | null } | null,
  ) => {
    if (starting) return;
    setStarting(true);
    try {
      const d = db();
      // Purge any stale active timers for this user to guarantee a clean start
      await d.activeTimers.where("userId").equals(ctx.userId).delete();

      const t: ActiveTimer = {
        clientTimerId: uid(),
        userId: ctx.userId,
        projectId,
        startTimeUtc: Date.now(),
        workNotes,
        taskId: task?.id ?? null,
        taskTitle: task?.title ?? null,
        taskNumber: task?.number ?? null,
      };
      await d.activeTimers.put(t);
      setTimer(t);
      setNow(Date.now());
      await d.syncOutbox.add({
        kind: "timer.start",
        payload: t,
        userId: ctx.userId,
        createdAt: Date.now(),
      });
      reportTimer({
        data: { running: true, projectId, startedAt: t.startTimeUtc, workNotes },
      }).catch(() => {});
      reload();
    } finally {
      setStarting(false);
    }
  };

  const stopTimer = async (workNotes: string) => {
    if (!timer || stopping) return;
    setStopping(true);
    const currentTimer = timer;
    // Clear active timer immediately to prevent repeated button clicks
    setTimer(null);
    try {
      const start = new Date(currentTimer.startTimeUtc);
      const end = new Date();
      const entryDate = ymd(start);
      const elapsedMs = Math.max(0, end.getTime() - currentTimer.startTimeUtc);
      const { fromTime, toTime } = deriveSlotFromElapsed(hhmm(start), elapsedMs);

      // Check if this slot already exists in Dexie to avoid duplicating
      const existingSlot = await db()
        .entries.where("entryDate")
        .equals(entryDate)
        .filter((e) => e.fromTime === fromTime && e.toTime === toTime)
        .first();

      const entryId = existingSlot?.id ?? uid();
      const entry: LocalEntry = {
        id: entryId,
        entryDate,
        fromTime,
        toTime,
        projectId: currentTimer.projectId,
        taskId: currentTimer.taskId ?? null,
        taskTitle: currentTimer.taskTitle ?? null,
        taskNumber: currentTimer.taskNumber ?? null,
        workNotes: workNotes || currentTimer.workNotes,
        entryMode: "CustomHours",
        status: statusFor(currentTimer.projectId, "CustomHours"),
        createdAt: Date.now(),
      };

      await db().entries.put(entry);
      // Clean up all active timers for this user
      await db().activeTimers.where("userId").equals(ctx.userId).delete();
      reportTimer({ data: { running: false } }).catch(() => {});
      await db().syncOutbox.add({
        kind: "timer.stop",
        payload: entry,
        userId: ctx.userId,
        createdAt: Date.now(),
      });
      // Online: save to the database right away. Offline: stays queued until reconnect.
      await sync();
    } finally {
      setStopping(false);
    }
  };

  const saveEntry = async (
    e: Omit<LocalEntry, "id" | "createdAt" | "status"> & { id?: string },
  ) => {
    // If id is not specified, check if an existing entry shares the exact same slot
    let targetId = e.id;
    if (!targetId) {
      const sameSlot = await db()
        .entries.where("entryDate")
        .equals(e.entryDate)
        .filter((x) => x.fromTime === e.fromTime && x.toTime === e.toTime)
        .first();
      if (sameSlot) {
        targetId = sameSlot.id;
      }
    }

    const entry: LocalEntry = {
      ...e,
      id: targetId ?? uid(),
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

  const saveEntries = async (
    items: Array<Omit<LocalEntry, "id" | "createdAt" | "status"> & { id?: string }>,
  ) => {
    if (items.length === 0) return;
    const entries: LocalEntry[] = items.map((e) => ({
      ...e,
      id: e.id ?? uid(),
      createdAt: Date.now(),
      status: statusFor(e.projectId, e.entryMode),
    }));
    await db().entries.bulkPut(entries);
    for (const entry of entries) {
      await db().syncOutbox.add({
        kind: "entry.upsert",
        payload: entry,
        userId: ctx.userId,
        createdAt: Date.now(),
      });
    }
    notify.show({
      color: "lucesem",
      message: entries.length > 1 ? `@${entries.length} entries saved` : "@entrySaved",
    });
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

  const updateTimerTask = useCallback(
    async (task?: { id: string; title: string; number?: number | null } | null) => {
      const d = db();
      const current = timer ?? (await d.activeTimers.where("userId").equals(ctx.userId).first());
      if (!current) return;
      const updated: ActiveTimer = {
        ...current,
        taskId: task?.id ?? null,
        taskTitle: task?.title ?? null,
        taskNumber: task?.number ?? null,
      };
      await d.activeTimers.put(updated);
      setTimer(updated);
    },
    [timer, ctx.userId],
  );

  const elapsed = timer ? elapsedSeconds(timer.startTimeUtc, now) : 0;
  return {
    ready,
    entries,
    timer,
    starting,
    stopping,
    elapsed,
    outbox,
    startTimer,
    stopTimer,
    updateTimerNotes,
    updateTimerTask,
    saveEntry,
    saveEntries,
    deleteEntry,
    now,
  };
}

export const entryHours = (e: Pick<LocalEntry, "fromTime" | "toTime">) => {
  const [fh, fm] = e.fromTime.split(":").map(Number) as [number, number];
  const [th, tm] = e.toTime.split(":").map(Number) as [number, number];
  return Math.max(0, (th * 60 + tm - fh * 60 - fm) / 60);
};
