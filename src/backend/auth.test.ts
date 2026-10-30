import { describe, expect, it, vi } from "vitest";
vi.mock("@tanstack/react-start/server", () => ({
  getCookie: vi.fn(),
  setCookie: vi.fn(),
  deleteCookie: vi.fn(),
}));
import { hashPassword, verifyPassword } from "./auth.server";

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
