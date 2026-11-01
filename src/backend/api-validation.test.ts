/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock server cookie and request environment
let currentCookie: string | undefined = undefined;

vi.mock("@tanstack/react-start/server", () => ({
  getCookie: vi.fn(() => currentCookie),
  setCookie: vi.fn(),
  deleteCookie: vi.fn(),
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validatorFn: any = null;
    const builder = {
      validator: (v: any) => {
        validatorFn = v;
        return builder;
      },
      handler: (h: any) => {
        return async (opts?: any) => {
          let data = opts?.data;
          if (validatorFn) {
            data = validatorFn(data);
          }
          return h({ data });
        };
      },
    };
    return builder;
  },
}));

// Mock database to simulate realistic queries
const mockSql = vi.fn(() => []);
// Make mockSql callable and chainable like postgres.js template tag
const createMockSql = () => {
  const fn: any = (...args: any[]) => {
    return Promise.resolve([]);
  };
  fn.begin = async (cb: any) => cb(fn);
  fn.json = (val: any) => val;
  return fn;
};

vi.mock("./db.server", () => ({
  sql: () => createMockSql(),
}));

vi.mock("./workflow.server", () => ({
  locksFor: vi.fn(async () => []),
  unlockedDatesFor: vi.fn(async () => []),
  notifyAdmins: vi.fn(async () => {}),
  notify: vi.fn(async () => {}),
  checkBudgets: vi.fn(async () => {}),
  projectBudgetUsage: vi.fn(async () => []),
}));

import {
  listOpenTasksForProject,
  listTaskTimeEntries,
  listBoardTasks,
  createBoardTask,
  updateBoardTaskStatus,
  updateBoardTask,
  deleteBoardTask,
  listTaskComments,
  addBoardTaskComment,
  listAssignableUsers,
} from "./board.functions";

import { syncEntries, reportTimer, deleteMyEntry, listMyEntries } from "./time.functions";

import {
  saveProject,
  reviewProject,
  saveCustomer,
  saveTeam,
  saveUser,
  bulkSetVacation,
  addMyNotification,
  listMyProjects,
  listCustomers,
  listTeams,
  listUsers,
} from "./org.functions";

import {
  requestUnlock,
  decideEntries,
  decideUnlock,
  addLock,
  removeLock,
  reportData,
  markExported,
  savePortal,
  portalData,
  adminSaveEntry,
  adminDeleteEntry,
  approvalQueue,
  myUnlockedDates,
  listLocks,
  liveBoard,
  auditLog,
  listPortals,
} from "./workflow.functions";

import {
  saveActivity,
  changePassword,
  absenceOverview,
  decideAbsence,
  listActivities,
  budgetUsage,
} from "./extra.functions";

import { login, setMyLanguage, logout, getMe } from "./auth.functions";

const VALID_UUID = "11111111-1111-4111-a111-111111111111";
const ANOTHER_UUID = "22222222-2222-4222-a222-222222222222";

describe("API Validation & Parameter Error Handling", () => {
  /* ========================================================================
   * 1. Board Functions
   * ======================================================================== */
  describe("Board APIs - Parameter Variations & Validation", () => {
    it("listOpenTasksForProject: rejects invalid or missing projectId", async () => {
      // Missing parameter
      await expect(listOpenTasksForProject({ data: {} as any })).rejects.toThrow();
      // Malformed UUID
      await expect(
        listOpenTasksForProject({ data: { projectId: "not-a-uuid" } }),
      ).rejects.toThrow();
      // Empty string
      await expect(listOpenTasksForProject({ data: { projectId: "" } })).rejects.toThrow();
    });

    it("listTaskTimeEntries: rejects invalid or missing taskId", async () => {
      // Missing parameter
      await expect(listTaskTimeEntries({ data: {} as any })).rejects.toThrow();
      // Malformed UUID
      await expect(listTaskTimeEntries({ data: { taskId: "12345" } })).rejects.toThrow();
      // Non-UUID string
      await expect(listTaskTimeEntries({ data: { taskId: "abc-xyz" } })).rejects.toThrow();
    });

    it("listBoardTasks: accepts valid filter variations and rejects invalid status/UUID", async () => {
      // Invalid status enum
      await expect(listBoardTasks({ data: { status: "unknown_status" as any } })).rejects.toThrow();
      // Invalid projectId UUID
      await expect(listBoardTasks({ data: { projectId: "not-uuid" } })).rejects.toThrow();
      // Invalid assigneeId UUID
      await expect(listBoardTasks({ data: { assigneeId: "not-uuid" } })).rejects.toThrow();
    });

    it("createBoardTask: rejects missing title, short title, invalid status/priority", async () => {
      // Missing title
      await expect(
        createBoardTask({ data: { projectId: VALID_UUID, title: "" } }),
      ).rejects.toThrow();
      // Title too short (< 2 chars)
      await expect(
        createBoardTask({ data: { projectId: VALID_UUID, title: "x" } }),
      ).rejects.toThrow();
      // Invalid priority
      await expect(
        createBoardTask({
          data: { projectId: VALID_UUID, title: "Valid Title", priority: "critical" as any },
        }),
      ).rejects.toThrow();
      // Invalid status
      await expect(
        createBoardTask({
          data: { projectId: VALID_UUID, title: "Valid Title", status: "completed" as any },
        }),
      ).rejects.toThrow();
      // Malformed assignee UUID
      await expect(
        createBoardTask({
          data: { projectId: VALID_UUID, title: "Valid Title", assigneeIds: ["bad-uuid"] },
        }),
      ).rejects.toThrow();
    });

    it("updateBoardTaskStatus: rejects invalid status or bad taskId", async () => {
      await expect(
        updateBoardTaskStatus({ data: { taskId: "bad", status: "in_progress" } }),
      ).rejects.toThrow();
      await expect(
        updateBoardTaskStatus({ data: { taskId: VALID_UUID, status: "finished" as any } }),
      ).rejects.toThrow();
    });

    it("updateBoardTask: rejects invalid priority or short title", async () => {
      await expect(updateBoardTask({ data: { taskId: VALID_UUID, title: "a" } })).rejects.toThrow();
      await expect(
        updateBoardTask({ data: { taskId: VALID_UUID, priority: "extreme" as any } }),
      ).rejects.toThrow();
    });

    it("deleteBoardTask & listTaskComments: reject malformed taskId", async () => {
      await expect(deleteBoardTask({ data: { taskId: "invalid" } })).rejects.toThrow();
      await expect(listTaskComments({ data: { taskId: "invalid" } })).rejects.toThrow();
    });

    it("addBoardTaskComment: rejects empty comments and bad taskId", async () => {
      // Empty / whitespace comment
      await expect(
        addBoardTaskComment({ data: { taskId: VALID_UUID, comment: "   " } }),
      ).rejects.toThrow();
      // Missing comment
      await expect(
        addBoardTaskComment({ data: { taskId: VALID_UUID, comment: "" } }),
      ).rejects.toThrow();
      // Malformed taskId
      await expect(
        addBoardTaskComment({ data: { taskId: "bad-uuid", comment: "Hello" } }),
      ).rejects.toThrow();
    });
  });

  /* ========================================================================
   * 2. Time Functions
   * ======================================================================== */
  describe("Time APIs - Parameter Variations & Validation", () => {
    it("syncEntries: rejects malformed entries, bad time formats, and invalid dates", async () => {
      // Invalid entryDate format (not YYYY-MM-DD)
      await expect(
        syncEntries({
          data: {
            entries: [
              {
                id: VALID_UUID,
                entryDate: "15.10.2026",
                fromTime: "08:00",
                toTime: "12:00",
                workNotes: "Test",
                entryMode: "CustomHours",
              },
            ],
          },
        }),
      ).rejects.toThrow();

      // Invalid fromTime format
      await expect(
        syncEntries({
          data: {
            entries: [
              {
                id: VALID_UUID,
                entryDate: "2026-10-15",
                fromTime: "8:00",
                toTime: "12:00",
                workNotes: "Test",
                entryMode: "CustomHours",
              },
            ],
          },
        }),
      ).rejects.toThrow();

      // Invalid UUID for entry id
      await expect(
        syncEntries({
          data: {
            entries: [
              {
                id: "not-a-uuid",
                entryDate: "2026-10-15",
                fromTime: "08:00",
                toTime: "12:00",
                workNotes: "Test",
                entryMode: "CustomHours",
              },
            ],
          },
        }),
      ).rejects.toThrow();

      // Invalid taskId UUID
      await expect(
        syncEntries({
          data: {
            entries: [
              {
                id: VALID_UUID,
                entryDate: "2026-10-15",
                fromTime: "08:00",
                toTime: "12:00",
                workNotes: "Test",
                entryMode: "CustomHours",
                taskId: "bad-task-uuid",
              },
            ],
          },
        }),
      ).rejects.toThrow();

      // Exceeding maximum batch limit of 200
      const largeBatch = Array.from({ length: 201 }, () => ({
        id: VALID_UUID,
        entryDate: "2026-10-15",
        fromTime: "08:00",
        toTime: "12:00",
        workNotes: "Note",
        entryMode: "CustomHours",
      }));
      await expect(syncEntries({ data: { entries: largeBatch } })).rejects.toThrow();
    });

    it("deleteMyEntry: rejects malformed UUID", async () => {
      await expect(deleteMyEntry({ data: { id: "bad-id" } })).rejects.toThrow();
    });

    it("reportTimer: rejects invalid types", async () => {
      await expect(reportTimer({ data: { running: "yes" as any } })).rejects.toThrow();
      await expect(
        reportTimer({ data: { running: true, projectId: "not-uuid" } }),
      ).rejects.toThrow();
    });
  });

  /* ========================================================================
   * 3. Organization APIs
   * ======================================================================== */
  describe("Organization APIs - Parameter Variations & Validation", () => {
    it("saveProject: rejects invalid customerId, short name, negative budget", async () => {
      // Invalid customerId
      await expect(
        saveProject({ data: { customerId: "bad-uuid", name: "Project X" } }),
      ).rejects.toThrow();
      // Name too short
      await expect(saveProject({ data: { customerId: VALID_UUID, name: "X" } })).rejects.toThrow();
      // Negative budget hours
      await expect(
        saveProject({ data: { customerId: VALID_UUID, name: "Project X", timeBudgetHours: -5 } }),
      ).rejects.toThrow();
      // Malformed team UUID
      await expect(
        saveProject({
          data: { customerId: VALID_UUID, name: "Project X", teamIds: ["not-a-uuid"] },
        }),
      ).rejects.toThrow();
    });

    it("reviewProject: rejects missing decision or bad id", async () => {
      await expect(reviewProject({ data: { id: "bad", approve: true } })).rejects.toThrow();
      await expect(reviewProject({ data: { id: VALID_UUID } as any })).rejects.toThrow();
    });

    it("saveCustomer: rejects short or missing name", async () => {
      await expect(saveCustomer({ data: { name: "A" } })).rejects.toThrow();
      await expect(saveCustomer({ data: {} as any })).rejects.toThrow();
    });

    it("saveTeam: rejects short name and malformed member UUIDs", async () => {
      await expect(saveTeam({ data: { name: "T" } })).rejects.toThrow();
      await expect(
        saveTeam({ data: { name: "Team Beta", memberIds: ["not-a-uuid"] } }),
      ).rejects.toThrow();
    });

    it("saveUser: rejects invalid email, short password, negative hours", async () => {
      // Invalid email
      await expect(
        saveUser({ data: { email: "not-an-email", displayName: "Test User" } }),
      ).rejects.toThrow();
      // Name too short
      await expect(
        saveUser({ data: { email: "test@lucesem.com", displayName: "T" } }),
      ).rejects.toThrow();
      // Password too short (< 10 chars)
      await expect(
        saveUser({
          data: { email: "test@lucesem.com", displayName: "Test User", newPassword: "short" },
        }),
      ).rejects.toThrow();
      // Negative target hours
      await expect(
        saveUser({
          data: { email: "test@lucesem.com", displayName: "Test User", weeklyTargetHours: -10 },
        }),
      ).rejects.toThrow();
    });

    it("bulkSetVacation: rejects non-positive or non-integer days", async () => {
      await expect(bulkSetVacation({ data: { days: 0 } })).rejects.toThrow();
      await expect(bulkSetVacation({ data: { days: -10 } })).rejects.toThrow();
      await expect(bulkSetVacation({ data: { days: 25.5 } })).rejects.toThrow();
    });

    it("addMyNotification: rejects empty title, message, or type", async () => {
      await expect(
        addMyNotification({ data: { type: "info", title: "", message: "Message" } }),
      ).rejects.toThrow();
      await expect(
        addMyNotification({ data: { type: "", title: "Title", message: "Message" } }),
      ).rejects.toThrow();
      await expect(
        addMyNotification({ data: { type: "info", title: "Title", message: "" } }),
      ).rejects.toThrow();
    });
  });

  /* ========================================================================
   * 4. Workflow APIs
   * ======================================================================== */
  describe("Workflow APIs - Parameter Variations & Validation", () => {
    it("requestUnlock: rejects reason shorter than 5 chars or bad date", async () => {
      await expect(
        requestUnlock({ data: { date: "2026-10-15", reason: "late" } }),
      ).rejects.toThrow();
      await expect(
        requestUnlock({ data: { date: "15/10/2026", reason: "Valid reason text" } }),
      ).rejects.toThrow();
    });

    it("decideEntries: rejects empty ids list or invalid UUIDs", async () => {
      await expect(decideEntries({ data: { ids: [], approve: true } })).rejects.toThrow();
      await expect(
        decideEntries({ data: { ids: ["not-a-uuid"], approve: true } }),
      ).rejects.toThrow();
    });

    it("decideUnlock & removeLock: reject malformed UUID", async () => {
      await expect(decideUnlock({ data: { id: "bad-uuid", approve: true } })).rejects.toThrow();
      await expect(removeLock({ data: { id: "bad-uuid" } })).rejects.toThrow();
    });

    it("addLock: rejects malformed dates or inverted date ranges (from > to)", async () => {
      await expect(
        addLock({ data: { userId: null, fromDate: "2026/10/01", toDate: "2026-10-31" } }),
      ).rejects.toThrow();
      await expect(
        addLock({ data: { userId: null, fromDate: "2026-10-31", toDate: "2026-10-01" } }),
      ).rejects.toThrow();
    });

    it("reportData: rejects bad date formats and invalid filter UUIDs", async () => {
      await expect(reportData({ data: { from: "bad-date", to: "2026-10-31" } })).rejects.toThrow();
      await expect(
        reportData({ data: { from: "2026-10-01", to: "2026-10-31", projectId: "not-uuid" } }),
      ).rejects.toThrow();
      await expect(
        reportData({ data: { from: "2026-10-01", to: "2026-10-31", customerId: "not-uuid" } }),
      ).rejects.toThrow();
    });

    it("markExported: rejects empty ids list or invalid UUIDs", async () => {
      await expect(markExported({ data: { ids: [] } })).rejects.toThrow();
      await expect(markExported({ data: { ids: ["not-a-uuid"] } })).rejects.toThrow();
    });

    it("savePortal: rejects password shorter than 8 chars or bad customerId", async () => {
      await expect(
        savePortal({ data: { customerId: VALID_UUID, password: "short" } }),
      ).rejects.toThrow();
      await expect(savePortal({ data: { customerId: "bad-uuid" } })).rejects.toThrow();
    });

    it("portalData: rejects token shorter than 16 chars or empty password", async () => {
      await expect(
        portalData({ data: { token: "short-token", password: "password123" } }),
      ).rejects.toThrow();
      await expect(
        portalData({ data: { token: "1234567890123456", password: "" } }),
      ).rejects.toThrow();
    });

    it("adminSaveEntry: rejects inverted time slots (toTime <= fromTime)", async () => {
      // fromTime >= toTime must be rejected by refinement
      await expect(
        adminSaveEntry({
          data: {
            id: VALID_UUID,
            entryDate: "2026-10-15",
            fromTime: "12:00",
            toTime: "08:00",
            workNotes: "Testing backwards time",
            status: "approved",
          },
        }),
      ).rejects.toThrow();

      // fromTime == toTime must be rejected
      await expect(
        adminSaveEntry({
          data: {
            id: VALID_UUID,
            entryDate: "2026-10-15",
            fromTime: "10:00",
            toTime: "10:00",
            workNotes: "Testing zero duration",
            status: "approved",
          },
        }),
      ).rejects.toThrow();
    });

    it("adminDeleteEntry: rejects malformed UUID", async () => {
      await expect(adminDeleteEntry({ data: { id: "not-a-uuid" } })).rejects.toThrow();
    });
  });

  /* ========================================================================
   * 5. Extra & Auth APIs
   * ======================================================================== */
  describe("Extra & Auth APIs - Parameter Variations & Validation", () => {
    it("saveActivity: rejects short name and bad projectId", async () => {
      await expect(saveActivity({ data: { name: "A" } })).rejects.toThrow();
      await expect(
        saveActivity({ data: { name: "Activity", projectId: "bad" } }),
      ).rejects.toThrow();
    });

    it("changePassword: rejects newPassword shorter than 10 characters", async () => {
      await expect(
        changePassword({ data: { currentPassword: "validCurrent", newPassword: "short" } }),
      ).rejects.toThrow();
      await expect(
        changePassword({ data: { currentPassword: "", newPassword: "validNewPassword123" } }),
      ).rejects.toThrow();
    });

    it("absenceOverview: rejects years outside 2000-2100 or non-integers", async () => {
      await expect(absenceOverview({ data: { year: 1999 } })).rejects.toThrow();
      await expect(absenceOverview({ data: { year: 2101 } })).rejects.toThrow();
      await expect(absenceOverview({ data: { year: 2026.5 } })).rejects.toThrow();
    });

    it("decideAbsence: rejects malformed absence id", async () => {
      await expect(decideAbsence({ data: { id: "bad-uuid", approve: true } })).rejects.toThrow();
    });

    it("login: rejects malformed email address and empty password", async () => {
      await expect(
        login({ data: { email: "not-an-email", password: "somepassword" } }),
      ).rejects.toThrow();
      await expect(login({ data: { email: "user@lucesem.com", password: "" } })).rejects.toThrow();
    });

    it("setMyLanguage: rejects unsupported language codes", async () => {
      await expect(setMyLanguage({ data: { language: "es" as any } })).rejects.toThrow();
      await expect(setMyLanguage({ data: { language: "fr" as any } })).rejects.toThrow();
    });
  });

  /* ========================================================================
   * 6. Authorization Guard Tests (Unauthenticated & Role Isolation)
   * ======================================================================== */
  describe("Security & Guard Enforcement (Unauthenticated Access Rejection)", () => {
    beforeEach(() => {
      currentCookie = undefined;
    });

    it("rejects unauthenticated calls on user-level APIs with UNAUTHORIZED", async () => {
      await expect(listMyEntries()).rejects.toThrow("UNAUTHORIZED");
      await expect(listMyProjects()).rejects.toThrow("UNAUTHORIZED");
      await expect(listBoardTasks({ data: {} })).rejects.toThrow("UNAUTHORIZED");
      await expect(listAssignableUsers()).rejects.toThrow("UNAUTHORIZED");
      await expect(myUnlockedDates()).rejects.toThrow("UNAUTHORIZED");
      await expect(
        requestUnlock({ data: { date: "2026-10-15", reason: "Valid reason text" } }),
      ).rejects.toThrow("UNAUTHORIZED");
    });

    it("rejects unauthenticated calls on admin-level APIs with UNAUTHORIZED", async () => {
      await expect(approvalQueue()).rejects.toThrow("UNAUTHORIZED");
      await expect(listUsers()).rejects.toThrow("UNAUTHORIZED");
      await expect(listTeams()).rejects.toThrow("UNAUTHORIZED");
      await expect(listCustomers()).rejects.toThrow("UNAUTHORIZED");
      await expect(listLocks()).rejects.toThrow("UNAUTHORIZED");
      await expect(liveBoard()).rejects.toThrow("UNAUTHORIZED");
      await expect(auditLog()).rejects.toThrow("UNAUTHORIZED");
      await expect(listPortals()).rejects.toThrow("UNAUTHORIZED");
      await expect(budgetUsage()).rejects.toThrow("UNAUTHORIZED");
    });
  });

  /* ========================================================================
   * 7. Role-Based Access Control (RBAC Employee vs Admin Enforcement)
   * ======================================================================== */
  describe("Role-Based Access Control (RBAC Employee vs Admin Enforcement)", () => {
    async function createSignedSessionCookie(user: any) {
      const sid = "sess-" + Math.random().toString(36).slice(2);
      const payload = JSON.stringify({
        sid,
        u: user,
        exp: Date.now() + 100_000,
      });
      const b64Payload = Buffer.from(payload, "utf8").toString("base64url");
      const secretSeed =
        process.env["SESSION_SECRET"] ||
        process.env["DATABASE_URL"] ||
        "lucesem-session-signing-secret-2026";
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secretSeed),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const sig = await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(`${sid}.${b64Payload}`),
      );
      const sigB64 = Buffer.from(sig).toString("base64url");
      return `${sid}.${b64Payload}.${sigB64}`;
    }

    beforeEach(async () => {
      const employeeUser = {
        id: "u-emp-1",
        email: "emp@lucesem.com",
        displayName: "Employee User",
        roles: ["employee" as const],
        isAdmin: false,
        weeklyTargetHours: 38.5,
        workDays: [1, 2, 3, 4, 5],
        vacationDaysPerYear: 25,
        includeCarinthia: false,
        requiresTimesheetApproval: false,
        language: "de" as const,
        avatarUrl: null,
        jobTitle: "Developer",
        phone: null,
      };
      currentCookie = await createSignedSessionCookie(employeeUser);
    });

    it("rejects non-admin users from admin workflow APIs with FORBIDDEN", async () => {
      await expect(approvalQueue()).rejects.toThrow("FORBIDDEN");
      await expect(listLocks()).rejects.toThrow("FORBIDDEN");
      await expect(
        addLock({
          data: {
            userId: null,
            fromDate: "2026-10-01",
            toDate: "2026-10-31",
            note: "Testing",
          },
        }),
      ).rejects.toThrow("FORBIDDEN");
      await expect(removeLock({ data: { id: VALID_UUID } })).rejects.toThrow("FORBIDDEN");
      await expect(liveBoard()).rejects.toThrow("FORBIDDEN");
      await expect(auditLog()).rejects.toThrow("FORBIDDEN");
      await expect(listPortals()).rejects.toThrow("FORBIDDEN");
      await expect(savePortal({ data: { customerId: VALID_UUID, enabled: true } })).rejects.toThrow(
        "FORBIDDEN",
      );
      await expect(markExported({ data: { ids: [VALID_UUID] } })).rejects.toThrow("FORBIDDEN");
      await expect(decideEntries({ data: { ids: [VALID_UUID], approve: true } })).rejects.toThrow(
        "FORBIDDEN",
      );
      await expect(decideUnlock({ data: { id: VALID_UUID, approve: true } })).rejects.toThrow(
        "FORBIDDEN",
      );
      await expect(adminDeleteEntry({ data: { id: VALID_UUID } })).rejects.toThrow("FORBIDDEN");
    });

    it("rejects non-admin users from admin org & extra APIs with FORBIDDEN", async () => {
      await expect(listUsers()).rejects.toThrow("FORBIDDEN");
      await expect(
        saveUser({
          data: {
            email: "new@lucesem.com",
            displayName: "New User",
            role: "user",
            weeklyTargetHours: 38.5,
            workDays: [1, 2, 3, 4, 5],
            vacationDaysPerYear: 25,
            includeCarinthia: false,
            requiresTimesheetApproval: false,
          },
        }),
      ).rejects.toThrow("FORBIDDEN");
      await expect(saveTeam({ data: { name: "New Team" } })).rejects.toThrow("FORBIDDEN");
      await expect(saveCustomer({ data: { name: "New Customer" } })).rejects.toThrow("FORBIDDEN");
      await expect(reviewProject({ data: { id: VALID_UUID, approve: true } })).rejects.toThrow(
        "FORBIDDEN",
      );
      await expect(bulkSetVacation({ data: { days: 25 } })).rejects.toThrow("FORBIDDEN");
      await expect(budgetUsage()).rejects.toThrow("FORBIDDEN");
      await expect(decideAbsence({ data: { id: VALID_UUID, approve: true } })).rejects.toThrow(
        "FORBIDDEN",
      );
    });
  });

  /* ========================================================================
   * 8. Handler Execution & Parameter Variations with Authenticated Session
   * ======================================================================== */
  describe("Handler Execution & Parameter Variations (Live Mock Handlers)", () => {
    async function createSignedSessionCookie(user: any) {
      const sid = "sess-" + Math.random().toString(36).slice(2);
      const payload = JSON.stringify({
        sid,
        u: user,
        exp: Date.now() + 100_000,
      });
      const b64Payload = Buffer.from(payload, "utf8").toString("base64url");
      const secretSeed =
        process.env["SESSION_SECRET"] ||
        process.env["DATABASE_URL"] ||
        "lucesem-session-signing-secret-2026";
      const key = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(secretSeed),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const sig = await crypto.subtle.sign(
        "HMAC",
        key,
        new TextEncoder().encode(`${sid}.${b64Payload}`),
      );
      const sigB64 = Buffer.from(sig).toString("base64url");
      return `${sid}.${b64Payload}.${sigB64}`;
    }

    beforeEach(async () => {
      const adminUser = {
        id: "u-admin-1",
        email: "admin@lucesem.com",
        displayName: "Admin User",
        roles: ["admin" as const],
        isAdmin: true,
        weeklyTargetHours: 38.5,
        workDays: [1, 2, 3, 4, 5],
        vacationDaysPerYear: 25,
        includeCarinthia: false,
        requiresTimesheetApproval: false,
        language: "de" as const,
        avatarUrl: null,
        jobTitle: "CTO",
        phone: null,
      };
      currentCookie = await createSignedSessionCookie(adminUser);
    });

    it("listBoardTasks: executes without errors across varied filter parameter combinations", async () => {
      // 1. No filters
      const resAll = await listBoardTasks({ data: {} });
      expect(Array.isArray(resAll)).toBe(true);

      // 2. Filter by status
      const resPending = await listBoardTasks({ data: { status: "pending" } });
      expect(Array.isArray(resPending)).toBe(true);

      const resInProgress = await listBoardTasks({ data: { status: "in_progress" } });
      expect(Array.isArray(resInProgress)).toBe(true);

      const resClosed = await listBoardTasks({ data: { status: "closed" } });
      expect(Array.isArray(resClosed)).toBe(true);

      // 3. Filter by project
      const resProj = await listBoardTasks({ data: { projectId: VALID_UUID } });
      expect(Array.isArray(resProj)).toBe(true);

      // 4. Filter by assignee
      const resAssignee = await listBoardTasks({ data: { assigneeId: VALID_UUID } });
      expect(Array.isArray(resAssignee)).toBe(true);

      // 5. Filter by search query
      const resSearch = await listBoardTasks({ data: { search: "Navigation Issue" } });
      expect(Array.isArray(resSearch)).toBe(true);

      // 6. Combined filters
      const resCombined = await listBoardTasks({
        data: {
          projectId: VALID_UUID,
          status: "in_progress",
          assigneeId: VALID_UUID,
          search: "navbar",
        },
      });
      expect(Array.isArray(resCombined)).toBe(true);
    });

    it("listOpenTasksForProject & listTaskTimeEntries: return arrays for valid IDs", async () => {
      const openTasks = await listOpenTasksForProject({ data: { projectId: VALID_UUID } });
      expect(Array.isArray(openTasks)).toBe(true);

      const timeEntries = await listTaskTimeEntries({ data: { taskId: VALID_UUID } });
      expect(Array.isArray(timeEntries)).toBe(true);
    });

    it("syncEntries: handles inverted time slot without crashing and returns rejection list", async () => {
      const res = await syncEntries({
        data: {
          entries: [
            {
              id: VALID_UUID,
              entryDate: "2026-10-15",
              fromTime: "12:00",
              toTime: "08:00", // Inverted time slot
              workNotes: "Inverted",
              entryMode: "CustomHours",
            },
          ],
        },
      });
      expect(res.rejected).toHaveLength(1);
      expect(res.rejected[0]?.reason).toBe("time");
    });

    it("reportData: executes cleanly with varied date ranges and project/customer filters", async () => {
      const resDateOnly = await reportData({
        data: { from: "2026-10-01", to: "2026-10-31" },
      });
      expect(Array.isArray(resDateOnly)).toBe(true);

      const resFiltered = await reportData({
        data: {
          from: "2026-10-01",
          to: "2026-10-31",
          userId: VALID_UUID,
          customerId: ANOTHER_UUID,
          projectId: VALID_UUID,
        },
      });
      expect(Array.isArray(resFiltered)).toBe(true);
    });

    it("absenceOverview: executes cleanly for various years", async () => {
      const res2025 = await absenceOverview({ data: { year: 2025 } });
      expect(res2025).toHaveProperty("summary");
      expect(res2025).toHaveProperty("entries");

      const res2026 = await absenceOverview({ data: { year: 2026 } });
      expect(res2026).toHaveProperty("summary");
      expect(res2026).toHaveProperty("entries");
    });

    it("setMyLanguage: handles valid language parameters", async () => {
      const deRes = await setMyLanguage({ data: { language: "de" } });
      expect(deRes).toEqual({ ok: true });

      const enRes = await setMyLanguage({ data: { language: "en" } });
      expect(enRes).toEqual({ ok: true });
    });
  });
});
