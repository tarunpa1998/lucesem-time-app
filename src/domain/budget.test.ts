import { describe, expect, it } from "vitest";
import { budgetLevel, budgetRatio, countAbsenceDays } from "./budget";

describe("project budgets", () => {
  it("projects without any budget never warn", () => {
    expect(
      budgetRatio({ timeBudgetHours: null, monetaryBudget: null, usedHours: 500, usedMoney: 9e9 }),
    ).toBeNull();
    expect(
      budgetLevel({ timeBudgetHours: null, monetaryBudget: null, usedHours: 500, usedMoney: 0 }),
    ).toBe(0);
  });
  it("warns at 80 % of hours budget", () => {
    expect(
      budgetLevel({ timeBudgetHours: 100, monetaryBudget: null, usedHours: 80, usedMoney: 0 }),
    ).toBe(1);
    expect(
      budgetLevel({ timeBudgetHours: 100, monetaryBudget: null, usedHours: 79, usedMoney: 0 }),
    ).toBe(0);
  });
  it("over budget at 100 % of money budget", () => {
    expect(
      budgetLevel({ timeBudgetHours: null, monetaryBudget: 1000, usedHours: 0, usedMoney: 1000 }),
    ).toBe(2);
  });
  it("uses the tighter of both budgets", () => {
    expect(
      budgetLevel({ timeBudgetHours: 100, monetaryBudget: 1000, usedHours: 10, usedMoney: 1200 }),
    ).toBe(2);
  });
});

describe("absence days", () => {
  it("counts distinct dates", () => {
    const e = [
      { entryDate: "2026-07-01", entryMode: "Vacation_Urlaub" },
      { entryDate: "2026-07-01", entryMode: "Vacation_Urlaub" },
      { entryDate: "2026-07-02", entryMode: "Vacation_Urlaub" },
      { entryDate: "2026-07-03", entryMode: "SickLeave_Krankenstand" },
    ];
    expect(countAbsenceDays(e, "Vacation_Urlaub")).toBe(2);
    expect(countAbsenceDays(e, "SickLeave_Krankenstand")).toBe(1);
  });
});
