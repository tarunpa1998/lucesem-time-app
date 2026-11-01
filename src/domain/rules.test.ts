import { describe, expect, it } from "vitest";
import { austrianHolidays, easterSunday, ymd } from "./holidays";
import { canEditDate, dailyTarget, elapsedSeconds, targetForRange, validateEntry } from "./rules";

const c = { weeklyTargetHours: 20, workDays: [1, 2, 3, 4, 5] };

describe("3-day retroactive window", () => {
  it("allows today minus 3", () => expect(canEditDate("2026-10-26", "2026-10-29")).toBe(true));
  it("blocks today minus 4 for users", () =>
    expect(canEditDate("2026-10-25", "2026-10-29")).toBe(false));
  it("admins bypass", () =>
    expect(canEditDate("2026-01-01", "2026-10-29", { isAdmin: true })).toBe(true));
});

describe("entry validation", () => {
  const base = {
    entryDate: "2026-10-29",
    fromTime: "08:00",
    toTime: "12:00",
    projectId: "p",
    workNotes: "Server setup",
    entryMode: "RegularWork" as const,
  };
  it("rejects overlap", () =>
    expect(
      validateEntry(
        base,
        [{ entryDate: "2026-10-29", fromTime: "11:00", toTime: "13:00" }],
        "2026-10-29",
      ),
    ).toContain("overlap"));
  it("rejects notes under 5 chars", () =>
    expect(validateEntry({ ...base, workNotes: "abc" }, [], "2026-10-29")).toContain("notes"));
  it("rejects missing projectId for regular work", () =>
    expect(validateEntry({ ...base, projectId: "" }, [], "2026-10-29")).toContain("project"));
  it("allows vacation without projectId", () =>
    expect(
      validateEntry(
        {
          entryDate: "2026-10-29",
          fromTime: "08:00",
          toTime: "16:00",
          workNotes: "Urlaub",
          entryMode: "Vacation_Urlaub",
        },
        [],
        "2026-10-29",
      ),
    ).not.toContain("project"));
  it("allows sick leave without projectId", () =>
    expect(
      validateEntry(
        {
          entryDate: "2026-10-29",
          fromTime: "08:00",
          toTime: "16:00",
          workNotes: "Krankenstand",
          entryMode: "SickLeave_Krankenstand",
        },
        [],
        "2026-10-29",
      ),
    ).not.toContain("project"));
});

describe("target distribution", () => {
  it("20h over Mon-Fri = 4h/day", () => expect(dailyTarget("2026-10-28", c)).toBe(4));
  it("Nationalfeiertag is 0", () => expect(dailyTarget("2026-10-26", c)).toBe(0));
  it("weekend is 0", () => expect(dailyTarget("2026-10-31", c)).toBe(0));
  it("week with holiday = 16h", () =>
    expect(targetForRange("2026-10-26", "2026-11-01", c)).toBe(16));
});

describe("Austrian holidays", () => {
  it("Easter 2026 is 5 April", () => expect(ymd(easterSunday(2026))).toBe("2026-04-05"));
  it("13 national holidays", () => expect(austrianHolidays(2026)).toHaveLength(13));
  it("Carinthia adds 10 Oct", () =>
    expect(austrianHolidays(2026, true).some((h) => h.date === "2026-10-10")).toBe(true));
  it("Fronleichnam 2026 is 4 June", () =>
    expect(austrianHolidays(2026).find((h) => h.de === "Fronleichnam")?.date).toBe("2026-06-04"));
});

it("elapsed time is deterministic", () => expect(elapsedSeconds(1000, 61_500)).toBe(60));
