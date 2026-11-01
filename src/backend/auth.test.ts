import { describe, expect, it, vi, beforeEach } from "vitest";

let currentCookie: string | undefined = undefined;

vi.mock("@tanstack/react-start/server", () => ({
  getCookie: vi.fn(() => currentCookie),
  setCookie: vi.fn(),
  deleteCookie: vi.fn(),
}));

vi.mock("./db.server", () => ({
  sql: () => () => [],
}));

import { hashPassword, verifyPassword, currentUser, invalidateSessionCache } from "./auth.server";

describe("password hashing", () => {
  it("verifies the right password", async () => {
    const h = await hashPassword("correct horse battery");
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
  });
  it("rejects a wrong password", async () => {
    const h = await hashPassword("correct horse battery");
    expect(await verifyPassword("wrong password!!", h)).toBe(false);
  });
});

describe("in-memory signed session token verification", () => {
  beforeEach(() => {
    currentCookie = undefined;
    invalidateSessionCache();
  });

  it("returns null when no cookie is present", async () => {
    currentCookie = undefined;
    const user = await currentUser();
    expect(user).toBeNull();
  });

  it("verifies and extracts user from a cryptographically signed cookie in-memory", async () => {
    const sampleUser = {
      id: "u-1234",
      email: "test@lucesem.com",
      displayName: "Test User",
      roles: ["admin" as const],
      isAdmin: true,
      weeklyTargetHours: 38.5,
      workDays: [1, 2, 3, 4, 5],
      vacationDaysPerYear: 25,
      includeCarinthia: false,
      requiresTimesheetApproval: false,
      language: "de" as const,
      avatarUrl: null,
      jobTitle: "Engineer",
      phone: null,
    };

    const sid = "sess-abc";
    const payload = JSON.stringify({
      sid,
      u: sampleUser,
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

    currentCookie = `${sid}.${b64Payload}.${sigB64}`;

    // First call: verifies HMAC signature (0 DB lookups)
    const u1 = await currentUser();
    expect(u1).not.toBeNull();
    expect(u1?.id).toBe("u-1234");
    expect(u1?.isAdmin).toBe(true);
    expect(u1?.email).toBe("test@lucesem.com");

    // Second call: served instantly from memory cache
    const u2 = await currentUser();
    expect(u2).toEqual(u1);
  });

  it("rejects an expired signed token", async () => {
    const sid = "sess-expired";
    const payload = JSON.stringify({
      sid,
      u: { id: "u-old" },
      exp: Date.now() - 10_000, // already expired
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

    currentCookie = `${sid}.${b64Payload}.${sigB64}`;
    const user = await currentUser();
    expect(user).toBeNull();
  });
});
