import { getCookie, setCookie, deleteCookie } from "@tanstack/react-start/server";
import { sql } from "./db.server";

const COOKIE = "lucesem_session";
const SESSION_DAYS = 14;
const ITER = 100_000;

const b64 = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function derive(password: string, salt: Uint8Array, iter: number) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations: iter },
    key,
    256,
  );
}

/** PBKDF2-SHA256 (WebCrypto, works on Node and edge runtimes). */
export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITER}$${b64(salt)}$${b64(await derive(password, salt, ITER))}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [alg, iter, salt, hash] = stored.split("$");
  if (alg !== "pbkdf2" || !iter || !salt || !hash) return false;
  const got = new Uint8Array(await derive(password, unb64(salt), Number(iter)));
  const want = unb64(hash);
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i]! ^ want[i]!;
  return diff === 0;
}

export type Role = "admin" | "team_lead" | "user";
export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  roles: Role[];
  isAdmin: boolean;
  weeklyTargetHours: number;
  workDays: number[];
  vacationDaysPerYear: number;
  includeCarinthia: boolean;
  requiresTimesheetApproval: boolean;
  language: "de" | "en";
  avatarUrl?: string | null;
  jobTitle?: string | null;
  phone?: string | null;
}

export async function createSession(userId: string) {
  const id = b64(crypto.getRandomValues(new Uint8Array(32))).replace(/[+/=]/g, "");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await sql()`insert into sessions (id, user_id, expires_at) values (${id}, ${userId}, ${expires})`;
  // SameSite=None + Partitioned so the session also works inside the embedded preview frame.
  setCookie(COOKIE, id, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    partitioned: true,
    path: "/",
    expires,
  });
}

export async function destroySession() {
  const id = getCookie(COOKIE);
  if (id) await sql()`delete from sessions where id = ${id}`;
  deleteCookie(COOKIE, { path: "/", secure: true, sameSite: "none", partitioned: true });
}

export async function currentUser(): Promise<SessionUser | null> {
  const id = getCookie(COOKIE);
  if (!id) return null;
  let rows;
  try {
    rows = await sql()<
      {
        id: string;
        email: string;
        display_name: string;
        weekly_target_hours: string;
        work_days: number[];
        vacation_days_per_year: number;
        include_carinthia: boolean;
        requires_timesheet_approval: boolean;
        language: "de" | "en";
        avatar_url: string | null;
        job_title: string | null;
        phone: string | null;
        roles: Role[];
      }[]
    >`
      select u.id, u.email, u.display_name, u.weekly_target_hours, u.work_days, u.vacation_days_per_year,
             u.include_carinthia, u.requires_timesheet_approval, u.language,
             u.avatar_url, u.job_title, u.phone,
             coalesce(array_agg(r.role) filter (where r.role is not null), '{}') as roles
      from sessions s join app_users u on u.id = s.user_id
      left join user_roles r on r.user_id = u.id
      where s.id = ${id} and s.expires_at > now() and u.is_active
      group by u.id`;
  } catch (err) {
    console.warn("[currentUser] Failed to load session user from DB:", (err as Error).message);
    return null;
  }
  const r = rows[0];
  if (!r) return null;
  const roles = r.roles as Role[];
  return {
    id: r.id,
    email: r.email,
    displayName: r.display_name,
    roles,
    isAdmin: roles.includes("admin"),
    weeklyTargetHours: Number(r.weekly_target_hours),
    workDays: r.work_days,
    vacationDaysPerYear: r.vacation_days_per_year,
    includeCarinthia: r.include_carinthia,
    requiresTimesheetApproval: r.requires_timesheet_approval,
    language: r.language === "en" ? "en" : "de",
    avatarUrl: r.avatar_url ?? null,
    jobTitle: r.job_title ?? null,
    phone: r.phone ?? null,
  };
}

export async function requireUser() {
  const u = await currentUser();
  if (!u) throw new Error("UNAUTHORIZED");
  return u;
}

export async function requireAdmin() {
  const u = await requireUser();
  if (!u.isAdmin) throw new Error("FORBIDDEN");
  return u;
}

export async function audit(
  actorId: string,
  action: string,
  entity: string,
  entityId: string | null,
  details?: unknown,
) {
  await sql()`insert into audit_log (actor_id, action, entity, entity_id, details)
    values (${actorId}, ${action}, ${entity}, ${entityId}, ${details ? sql().json(details as never) : null})`;
}
