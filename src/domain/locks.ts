import { canEditDate } from "./rules";

export interface PeriodLock {
  userId: string | null;
  fromDate: string;
  toDate: string;
}

/** True when a period lock (for everyone or this user) covers the date. */
export const isPeriodLocked = (date: string, userId: string, locks: PeriodLock[]) =>
  locks.some(
    (l) => (l.userId === null || l.userId === userId) && date >= l.fromDate && date <= l.toDate,
  );

/**
 * Server-side write rule for one entry date.
 * Admins may always write (locks and exports do not bind them).
 * Users are blocked by exports and period locks, and need the 3-day window or an approved unlock.
 */
export function entryWriteVerdict(o: {
  date: string;
  today: string;
  userId: string;
  isAdmin: boolean;
  unlockedDates: string[];
  locks: PeriodLock[];
  exported: boolean;
}): "ok" | "locked" | "exported" | "retro" {
  if (o.isAdmin) return "ok";
  if (o.exported) return "exported";
  if (isPeriodLocked(o.date, o.userId, o.locks)) return "locked";
  if (
    !canEditDate(o.date, o.today, {
      isAdmin: o.isAdmin,
      unlocked: o.unlockedDates.includes(o.date),
    })
  )
    return "retro";
  return "ok";
}

/** Today's date in Vienna as YYYY-MM-DD (server and client agree). */
export const viennaToday = (now = new Date()) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Vienna" }).format(now);
