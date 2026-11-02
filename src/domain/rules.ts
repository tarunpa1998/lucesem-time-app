import { austrianHolidays, ymd } from "./holidays";

export type EntryMode =
  | "RegularWork"
  | "HalfDay"
  | "CustomHours"
  | "Vacation_Urlaub"
  | "SickLeave_Krankenstand"
  | "Compensatory_Zeitausgleich";

export const ENTRY_MODES: EntryMode[] = [
  "RegularWork",
  "HalfDay",
  "CustomHours",
  "Vacation_Urlaub",
  "SickLeave_Krankenstand",
  "Compensatory_Zeitausgleich",
];

export const RETRO_WINDOW_DAYS = 3;
export const MIN_NOTES_LENGTH = 5;

const parse = (s: string) => {
  const [y, m, d] = s.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d));
};
export const daysBetween = (from: string, to: string) =>
  Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000);

/** Standard users may log Today .. Today-3. Admins and unlocked dates are unrestricted.
 * Absences (Vacation, Sick Leave, Comp Time) can also be booked for advance/future dates. */
export function canEditDate(
  entryDate: string,
  today: string,
  opts: {
    isAdmin?: boolean | undefined;
    unlocked?: boolean | undefined;
    isAbsence?: boolean | undefined;
  } = {},
) {
  if (opts.isAdmin || opts.unlocked) return true;
  if (opts.isAbsence && entryDate >= today) return true;
  const diff = daysBetween(entryDate, today);
  return diff >= 0 && diff <= RETRO_WINDOW_DAYS;
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
};

export interface Interval {
  id?: string;
  entryDate: string;
  fromTime: string;
  toTime: string;
  entryMode?: EntryMode | string;
}
export function overlaps(a: Interval, b: Interval) {
  if (a.entryDate !== b.entryDate) return false;
  return toMinutes(a.fromTime) < toMinutes(b.toTime) && toMinutes(b.fromTime) < toMinutes(a.toTime);
}

export const ABSENCE_MODES: EntryMode[] = [
  "Vacation_Urlaub",
  "SickLeave_Krankenstand",
  "Compensatory_Zeitausgleich",
];

export const isAbsenceMode = (mode: EntryMode) => ABSENCE_MODES.includes(mode);

export interface EntryDraft extends Interval {
  projectId?: string | null;
  workNotes: string;
  entryMode: EntryMode;
  activityId?: string | null;
  taskId?: string | null;
}
export type ValidationError =
  | "date"
  | "time"
  | "toBeforeFrom"
  | "project"
  | "notes"
  | "overlap"
  | "retro"
  | "future"
  | "dayHasAbsence"
  | "dayHasWork";

export function validateEntry(
  e: EntryDraft,
  existing: Interval[],
  today: string,
  opts: { isAdmin?: boolean; unlocked?: boolean; nowTime?: string } = {},
): ValidationError[] {
  const errs: ValidationError[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.entryDate)) errs.push("date");
  if (!/^\d{2}:\d{2}$/.test(e.fromTime) || !/^\d{2}:\d{2}$/.test(e.toTime)) errs.push("time");
  else if (toMinutes(e.toTime) <= toMinutes(e.fromTime)) errs.push("toBeforeFrom");
  // Projects are strictly required for work modes, but omitted for absences (Vacation, Sick Leave, ZA)
  if (!isAbsenceMode(e.entryMode) && !e.projectId) errs.push("project");
  // Work notes: minimum 5 characters for work; minimum 3 characters for absences if provided
  const minNotes = isAbsenceMode(e.entryMode) ? 3 : MIN_NOTES_LENGTH;
  if (e.workNotes.trim().length < minNotes) errs.push("notes");
  if (
    !errs.includes("time") &&
    !errs.includes("toBeforeFrom") &&
    existing.some((x) => !(e.id && x.id === e.id) && overlaps(e, x))
  )
    errs.push("overlap");

  // Conflict check: Days booked as absence cannot have other entries
  const dayEntries = existing.filter(
    (x) => !(e.id && x.id === e.id) && x.entryDate === e.entryDate,
  );
  if (isAbsenceMode(e.entryMode)) {
    if (dayEntries.length > 0) {
      errs.push("dayHasWork");
    }
  } else {
    const hasAbsence = dayEntries.some(
      (x) => x.entryMode && isAbsenceMode(x.entryMode as EntryMode),
    );
    if (hasAbsence) {
      errs.push("dayHasAbsence");
    }
  }

  if (!canEditDate(e.entryDate, today, { ...opts, isAbsence: isAbsenceMode(e.entryMode) })) {
    errs.push("retro");
  }
  if (
    !isAbsenceMode(e.entryMode) &&
    (isFutureSlot(e.entryDate, e.fromTime, today, opts.nowTime) ||
      isFutureSlot(e.entryDate, e.toTime, today, opts.nowTime))
  ) {
    errs.push("future");
  }
  return errs;
}

/** True when the date is after today, or today with a time later than now (HH:MM). */
export function isFutureSlot(date: string, time: string, today: string, nowTime?: string) {
  if (date > today) return true;
  if (date === today && nowTime && /^\d{2}:\d{2}$/.test(time))
    return toMinutes(time) > toMinutes(nowTime);
  return false;
}

/** 0=Sun..6=Sat */
export interface Contract {
  weeklyTargetHours: number;
  workDays: number[];
  includeCarinthia?: boolean;
}

export function dailyTarget(date: string, c: Contract): number {
  const d = parse(date);
  if (!c.workDays.includes(d.getDay()) || c.workDays.length === 0) return 0;
  const hol = austrianHolidays(d.getFullYear(), c.includeCarinthia);
  if (hol.some((h) => h.date === date)) return 0;
  return c.weeklyTargetHours / c.workDays.length;
}

export function targetForRange(from: string, to: string, c: Contract) {
  let sum = 0;
  for (
    let d = parse(from);
    d <= parse(to);
    d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
  )
    sum += dailyTarget(ymd(d), c);
  return sum;
}

export function periodRange(
  kind: "day" | "week" | "month" | "year",
  today: string,
): [string, string] {
  const d = parse(today);
  if (kind === "day") return [today, today];
  if (kind === "week") {
    const dow = (d.getDay() + 6) % 7; // Monday start
    const s = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
    return [ymd(s), ymd(new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6))];
  }
  if (kind === "month")
    return [
      ymd(new Date(d.getFullYear(), d.getMonth(), 1)),
      ymd(new Date(d.getFullYear(), d.getMonth() + 1, 0)),
    ];
  return [`${d.getFullYear()}-01-01`, `${d.getFullYear()}-12-31`];
}

/** Deterministic elapsed time: never an incrementing counter. */
export const elapsedSeconds = (startUtcMs: number, nowUtcMs: number) =>
  Math.max(0, Math.floor((nowUtcMs - startUtcMs) / 1000));
