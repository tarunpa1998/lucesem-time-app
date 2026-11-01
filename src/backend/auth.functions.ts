import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(200),
});
const setupSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(10).max(200),
  displayName: z.string().trim().min(2).max(100),
});

export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { currentUser } = await import("./auth.server");
    return await currentUser();
  } catch (err) {
    console.warn("[getMe] Failed to get currentUser:", (err as Error).message);
    return null;
  }
});

export const needsSetup = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { sql } = await import("./db.server");
    const [r] = await sql()<{ n: number }[]>`select count(*)::int as n from app_users`;
    return r ? r.n === 0 : false;
  } catch (err) {
    console.warn(
      "[needsSetup] Failed to query app_users (DB unreachable or not yet migrated):",
      (err as Error).message,
    );
    return false;
  }
});

/** Creates the first admin. Only works while the user table is empty. */
export const setupFirstAdmin = createServerFn({ method: "POST" })
  .validator((d: unknown) => setupSchema.parse(d))
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { hashPassword, createSession } = await import("./auth.server");
    const hash = await hashPassword(data.password);
    const id = await sql().begin(async (tx) => {
      await tx`lock table app_users in exclusive mode`;
      const [c] = await tx<{ n: number }[]>`select count(*)::int as n from app_users`;
      if (c!.n > 0) throw new Error("SETUP_DONE");
      const [u] = await tx<
        { id: string }[]
      >`insert into app_users (email, password_hash, display_name) values (${data.email}, ${hash}, ${data.displayName}) returning id`;
      await tx`insert into user_roles (user_id, role) values (${u!.id}, 'admin')`;
      return u!.id as string;
    });
    await createSession(id);
    return { ok: true };
  });

export const login = createServerFn({ method: "POST" })
  .validator((d: unknown) => loginSchema.parse(d))
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { verifyPassword, createSession } = await import("./auth.server");
    const [u] = await sql()<
      { id: string; password_hash: string }[]
    >`select id, password_hash from app_users where email = ${data.email} and is_active`;
    if (!u || !(await verifyPassword(data.password, u.password_hash)))
      return { ok: false as const };
    await createSession(u.id);
    return { ok: true as const };
  });

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const { destroySession } = await import("./auth.server");
  await destroySession();
  return { ok: true };
});

/** Saves the signed-in user's preferred UI language. */
export const setMyLanguage = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ language: z.enum(["de", "en"]) }).parse(d))
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireUser, invalidateSessionCache } = await import("./auth.server");
    const u = await requireUser();
    await sql()`update app_users set language = ${data.language} where id = ${u.id}`;
    invalidateSessionCache(u.id);
    return { ok: true };
  });

const profileSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  phone: z
    .string()
    .trim()
    .max(50)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  jobTitle: z
    .string()
    .trim()
    .max(100)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  avatarUrl: z
    .string()
    .max(3_000_000)
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
});

/** Updates the signed-in user's profile info (avatar, display name, job title, phone). */
export const updateMyProfile = createServerFn({ method: "POST" })
  .validator((d: unknown) => profileSchema.parse(d))
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireUser, audit, invalidateSessionCache } = await import("./auth.server");
    const u = await requireUser();
    await sql()`
      update app_users
      set display_name = ${data.displayName},
          phone = ${data.phone},
          job_title = ${data.jobTitle},
          avatar_url = ${data.avatarUrl}
      where id = ${u.id}
    `;
    invalidateSessionCache(u.id);
    await audit(u.id, "update_profile", "user", u.id, {
      displayName: data.displayName,
      phone: data.phone,
      jobTitle: data.jobTitle,
      hasAvatar: Boolean(data.avatarUrl),
    });
    return { ok: true };
  });
