import { describe, expect, it } from "vitest";
import { entryWriteVerdict, isPeriodLocked } from "./locks";

const base = {
  today: "2026-10-29",
  userId: "u1",
  isAdmin: false,
  unlockedDates: [] as string[],
  locks: [],
  exported: false,
};

describe("entry write rules", () => {
  it("users may write within 3 days", () => {
    expect(entryWriteVerdict({ ...base, date: "2026-10-26" })).toBe("ok");
  });
  it("users are blocked 4 days back", () => {
    expect(entryWriteVerdict({ ...base, date: "2026-10-25" })).toBe("retro");
  });
  it("allows advance vacation requests for future dates", () => {
    expect(
      entryWriteVerdict({
        ...base,
        date: "2026-11-10",
        isAbsence: true,
      }),
    ).toBe("ok");
  });
  it("approved unlock opens an older date", () => {
    expect(entryWriteVerdict({ ...base, date: "2026-10-01", unlockedDates: ["2026-10-01"] })).toBe(
      "ok",
    );
  });
  it("admins may write older dates", () => {
    expect(entryWriteVerdict({ ...base, isAdmin: true, date: "2026-01-01" })).toBe("ok");
  });
  it("period lock blocks users", () => {
    const locks = [{ userId: null, fromDate: "2026-10-01", toDate: "2026-10-31" }];
    expect(entryWriteVerdict({ ...base, locks, date: "2026-10-29" })).toBe("locked");
  });
  it("admins may edit inside a locked period", () => {
    const locks = [{ userId: null, fromDate: "2026-10-01", toDate: "2026-10-31" }];
    expect(entryWriteVerdict({ ...base, isAdmin: true, locks, date: "2026-10-29" })).toBe("ok");
  });
  it("exported entries cannot be changed by users", () => {
    expect(entryWriteVerdict({ ...base, exported: true, date: "2026-10-29" })).toBe("exported");
  });
  it("admins may edit exported entries", () => {
    expect(entryWriteVerdict({ ...base, isAdmin: true, exported: true, date: "2026-10-29" })).toBe(
      "ok",
    );
  });
  it("user-specific lock only affects that user", () => {
    const locks = [{ userId: "u2", fromDate: "2026-10-01", toDate: "2026-10-31" }];
    expect(isPeriodLocked("2026-10-10", "u1", locks)).toBe(false);
    expect(isPeriodLocked("2026-10-10", "u2", locks)).toBe(true);
  });
});
