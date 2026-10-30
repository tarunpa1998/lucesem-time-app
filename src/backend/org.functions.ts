import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { ProjectRow, CustomerRow, TeamRow, UserRow, NotificationRow } from "./types";

const opt = (s: z.ZodString) =>
  s
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));
const optNum = z.coerce.number().nonnegative().optional().nullable();

/* ---------------- Projects ---------------- */

/** Projects the current user may log time to (admin: all). */
export const listMyProjects = createServerFn({ method: "GET" }).handler(async () => {
  const { sql } = await import("./db.server");
  const { requireUser } = await import("./auth.server");
  const u = await requireUser();
  return sql()<ProjectRow[]>`
    select p.id, p.name, p.order_number, p.color, p.approval_state, p.hourly_rate, p.time_budget_hours,
           p.monetary_budget, p.is_visible, p.created_by, c.name as customer_name, c.id as customer_id,
           coalesce((select round(sum(extract(epoch from (e.to_time - e.from_time))) / 3600.0, 2)
             from time_entries e where e.project_id = p.id and e.status <> 'rejected'), 0)::float8 as used_hours
    from projects p join customers c on c.id = p.customer_id
    where (${u.isAdmin} or (
      p.is_visible and c.is_visible and p.approval_state <> 'Rejected' and (
        p.created_by = ${u.id}
        or exists (select 1 from project_users pu where pu.project_id = p.id and pu.user_id = ${u.id})
        or exists (select 1 from project_teams pt join team_members tm on tm.team_id = pt.team_id
                   where pt.project_id = p.id and tm.user_id = ${u.id})
        or exists (select 1 from customer_teams ct join team_members tm on tm.team_id = ct.team_id
                   where ct.customer_id = c.id and tm.user_id = ${u.id})
      )))
    order by c.name, p.name`;
});

const projectSchema = z.object({
  id: z.string().uuid().optional(),
  customerId: z.string().uuid(),
  name: z.string().trim().min(2).max(150),
  orderNumber: opt(z.string().trim().max(60)),
  color: z.string().max(30).default("lucesem"),
  timeBudgetHours: optNum,
  monetaryBudget: optNum,
  hourlyRate: optNum,
  isVisible: z.boolean().default(true),
  teamIds: z.array(z.string().uuid()).default([]),
  userIds: z.array(z.string().uuid()).default([]),
});

/** Admins create/update anything; users may create projects that go to Pending_Admin_Review. */
export const saveProject = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => projectSchema.parse(d))
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireUser, audit } = await import("./auth.server");
    const u = await requireUser();
    if (data.id && !u.isAdmin) throw new Error("FORBIDDEN");
    const db = sql();
    const id = await db.begin(async (tx) => {
      let pid = data.id;
      if (pid) {
        await tx`update projects set customer_id=${data.customerId}, name=${data.name}, order_number=${data.orderNumber},
          color=${data.color}, time_budget_hours=${data.timeBudgetHours ?? null}, monetary_budget=${data.monetaryBudget ?? null},
          hourly_rate=${data.hourlyRate ?? null}, is_visible=${data.isVisible} where id=${pid}`;
      } else {
        const state = u.isAdmin ? "Approved" : "Pending_Admin_Review";
        const [r] =
          await tx`insert into projects (customer_id, name, order_number, color, time_budget_hours, monetary_budget, hourly_rate, is_visible, approval_state, created_by)
          values (${data.customerId}, ${data.name}, ${data.orderNumber}, ${data.color}, ${data.timeBudgetHours ?? null}, ${data.monetaryBudget ?? null},
          ${u.isAdmin ? (data.hourlyRate ?? null) : null}, true, ${state}, ${u.id}) returning id`;
        pid = r!["id"] as string;
        if (!u.isAdmin) {
          await tx`insert into notifications (user_id, kind, message, link)
            select ur.user_id, 'project.pending', ${`${u.displayName} created project "${data.name}"`}, '/admin/projects'
            from user_roles ur where ur.role = 'admin'`;
        }
      }
      if (u.isAdmin) {
        await tx`delete from project_teams where project_id=${pid!}`;
        await tx`delete from project_users where project_id=${pid!}`;
        for (const t of data.teamIds) await tx`insert into project_teams values (${pid!}, ${t})`;
        for (const x of data.userIds) await tx`insert into project_users values (${pid!}, ${x})`;
      }
      return pid!;
    });
    await audit(u.id, data.id ? "update" : "create", "project", id, { name: data.name });
    return { id };
  });

export const reviewProject = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), approve: z.boolean() }).parse(d),
  )
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireAdmin, audit } = await import("./auth.server");
    const a = await requireAdmin();
    const state = data.approve ? "Approved" : "Rejected";
    const [p] = await sql()<
      { name: string; created_by: string | null }[]
    >`update projects set approval_state=${state} where id=${data.id} returning name, created_by`;
    if (p?.created_by)
      await sql()`insert into notifications (user_id, kind, message) values (${p.created_by}, ${"project." + state.toLowerCase()}, ${`Project "${p.name}": ${state}`})`;
    await audit(a.id, state.toLowerCase(), "project", data.id);
    return { ok: true };
  });

export const getProjectAssignments = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireAdmin } = await import("./auth.server");
    await requireAdmin();
    const teams = await sql()<
      { team_id: string }[]
    >`select team_id from project_teams where project_id=${data.id}`;
    const users = await sql()<
      { user_id: string }[]
    >`select user_id from project_users where project_id=${data.id}`;
    return {
      teamIds: teams.map((t) => t.team_id as string),
      userIds: users.map((u) => u.user_id as string),
    };
  });

/* ---------------- Customers ---------------- */

export const listCustomers = createServerFn({ method: "GET" }).handler(async () => {
  const { sql } = await import("./db.server");
  const { requireUser } = await import("./auth.server");
  const u = await requireUser();
  if (u.isAdmin)
    return sql()<
      CustomerRow[]
    >`select c.*, coalesce(array_agg(ct.team_id) filter (where ct.team_id is not null), '{}') as team_ids
      from customers c left join customer_teams ct on ct.customer_id = c.id group by c.id order by c.name`;
  // Users need customer names to create their own projects.
  return sql()<
    CustomerRow[]
  >`select id, name, color, is_visible, '{}'::uuid[] as team_ids from customers where is_visible order by name`;
});

const customerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2).max(150),
  companyNumber: opt(z.string().trim().max(50)),
  vatId: opt(z.string().trim().max(30)),
  street: opt(z.string().trim().max(150)),
  postalCode: opt(z.string().trim().max(20)),
  city: opt(z.string().trim().max(100)),
  country: z.string().trim().length(2).default("AT"),
  contactPerson: opt(z.string().trim().max(100)),
  email: opt(z.string().trim().email().max(255)),
  phone: opt(z.string().trim().max(40)),
  mobile: opt(z.string().trim().max(40)),
  fax: opt(z.string().trim().max(40)),
  website: opt(z.string().trim().max(255)),
  currency: z.string().trim().length(3).default("EUR"),
  timezone: z.string().default("Europe/Vienna"),
  color: z.string().max(30).default("lucesem"),
  internalComment: opt(z.string().max(2000)),
  timeBudgetHours: optNum,
  monetaryBudget: optNum,
  budgetType: z.enum(["Total", "Monthly"]).default("Total"),
  isVisible: z.boolean().default(true),
  teamIds: z.array(z.string().uuid()).default([]),
});

export const saveCustomer = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => customerSchema.parse(d))
  .handler(async ({ data: d }) => {
    const { sql } = await import("./db.server");
    const { requireAdmin, audit } = await import("./auth.server");
    const a = await requireAdmin();
    const row = {
      name: d.name,
      company_number: d.companyNumber,
      vat_id: d.vatId,
      street: d.street,
      postal_code: d.postalCode,
      city: d.city,
      country: d.country,
      contact_person: d.contactPerson,
      email: d.email,
      phone: d.phone,
      mobile: d.mobile,
      fax: d.fax,
      website: d.website,
      currency: d.currency,
      timezone: d.timezone,
      color: d.color,
      internal_comment: d.internalComment,
      time_budget_hours: d.timeBudgetHours ?? null,
      monetary_budget: d.monetaryBudget ?? null,
      budget_type: d.budgetType,
      is_visible: d.isVisible,
    };
    const id = await sql().begin(async (tx) => {
      let cid = d.id;
      if (cid) await tx`update customers set ${tx(row)} where id=${cid}`;
      else cid = (await tx`insert into customers ${tx(row)} returning id`)[0]!["id"] as string;
      await tx`delete from customer_teams where customer_id=${cid}`;
      for (const t of d.teamIds) await tx`insert into customer_teams values (${cid}, ${t})`;
      return cid;
    });
    await audit(a.id, d.id ? "update" : "create", "customer", id, { name: d.name });
    return { id };
  });

/* ---------------- Teams ---------------- */

export const listTeams = createServerFn({ method: "GET" }).handler(async () => {
  const { sql } = await import("./db.server");
  const { requireUser } = await import("./auth.server");
  await requireUser();
  return sql()<TeamRow[]>`select t.id, t.name, t.color,
      coalesce(json_agg(json_build_object('userId', tm.user_id, 'isLead', tm.is_lead)) filter (where tm.user_id is not null), '[]') as members
    from teams t left join team_members tm on tm.team_id = t.id group by t.id order by t.name`;
});

export const saveTeam = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid().optional(),
        name: z.string().trim().min(2).max(100),
        color: z.string().max(30).default("lucesem"),
        memberIds: z.array(z.string().uuid()).default([]),
        leadIds: z.array(z.string().uuid()).default([]),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireAdmin, audit } = await import("./auth.server");
    const a = await requireAdmin();
    const id = await sql().begin(async (tx) => {
      let tid = data.id;
      if (tid) await tx`update teams set name=${data.name}, color=${data.color} where id=${tid}`;
      else
        tid = (
          await tx`insert into teams (name, color) values (${data.name}, ${data.color}) returning id`
        )[0]!["id"] as string;
      await tx`delete from team_members where team_id=${tid}`;
      const all = new Set([...data.memberIds, ...data.leadIds]);
      for (const uid of all)
        await tx`insert into team_members values (${tid}, ${uid}, ${data.leadIds.includes(uid)})`;
      return tid;
    });
    await audit(a.id, data.id ? "update" : "create", "team", id, { name: data.name });
    return { id };
  });

/* ---------------- Users ---------------- */

export const listUsers = createServerFn({ method: "GET" }).handler(async () => {
  const { sql } = await import("./db.server");
  const { requireAdmin } = await import("./auth.server");
  await requireAdmin();
  return sql()<
    UserRow[]
  >`select u.id, u.email, u.display_name, u.weekly_target_hours, u.work_days, u.vacation_days_per_year,
      u.include_carinthia, u.requires_timesheet_approval, u.is_active,
      coalesce(array_agg(r.role) filter (where r.role is not null), '{}') as roles
    from app_users u left join user_roles r on r.user_id = u.id group by u.id order by u.display_name`;
});

const userSchema = z.object({
  id: z.string().uuid().optional(),
  email: z.string().trim().toLowerCase().email().max(255),
  displayName: z.string().trim().min(2).max(100),
  password: z.string().min(10).max(200).optional().or(z.literal("")),
  role: z.enum(["admin", "team_lead", "user"]),
  weeklyTargetHours: z.coerce.number().min(0).max(80),
  workDays: z.array(z.number().int().min(0).max(6)).min(1),
  vacationDaysPerYear: z.coerce.number().int().min(0).max(60),
  includeCarinthia: z.boolean(),
  requiresTimesheetApproval: z.boolean(),
  isActive: z.boolean().default(true),
});

export const saveUser = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => userSchema.parse(d))
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireAdmin, hashPassword, audit } = await import("./auth.server");
    const a = await requireAdmin();
    if (!data.id && !data.password) throw new Error("PASSWORD_REQUIRED");
    const hash = data.password ? await hashPassword(data.password) : null;
    const id = await sql().begin(async (tx) => {
      let uid = data.id;
      const row = {
        email: data.email,
        display_name: data.displayName,
        weekly_target_hours: data.weeklyTargetHours,
        work_days: data.workDays,
        vacation_days_per_year: data.vacationDaysPerYear,
        include_carinthia: data.includeCarinthia,
        requires_timesheet_approval: data.requiresTimesheetApproval,
        is_active: data.isActive,
      };
      if (uid) {
        await tx`update app_users set ${tx(row)} where id=${uid}`;
        if (hash) {
          await tx`update app_users set password_hash=${hash} where id=${uid}`;
          // Password reset by admin signs the user out everywhere.
          if (uid !== a.id) await tx`delete from sessions where user_id=${uid}`;
        }
      } else {
        uid = (
          await tx`insert into app_users ${tx({ ...row, password_hash: hash! })} returning id`
        )[0]!["id"] as string;
      }
      if (uid === a.id && data.role !== "admin") throw new Error("CANNOT_DEMOTE_SELF");
      await tx`delete from user_roles where user_id=${uid}`;
      await tx`insert into user_roles values (${uid}, ${data.role})`;
      return uid;
    });
    await audit(a.id, data.id ? "update" : "create", "user", id, { email: data.email });
    return { id };
  });

/** Bulk-assign annual vacation allowance to every user. */
export const bulkSetVacation = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ days: z.coerce.number().int().min(0).max(60) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireAdmin, audit } = await import("./auth.server");
    const a = await requireAdmin();
    await sql()`update app_users set vacation_days_per_year=${data.days}`;
    await audit(a.id, "bulk_vacation", "user", null, data);
    return { ok: true };
  });

/* ---------------- Notifications ---------------- */

export const listNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const { sql } = await import("./db.server");
  const { requireUser } = await import("./auth.server");
  const u = await requireUser();
  return sql()<
    NotificationRow[]
  >`select id, kind, message, link, read_at, created_at from notifications where user_id=${u.id} order by created_at desc limit 30`;
});

export const markNotificationsRead = createServerFn({ method: "POST" }).handler(async () => {
  const { sql } = await import("./db.server");
  const { requireUser } = await import("./auth.server");
  const u = await requireUser();
  await sql()`update notifications set read_at=now() where user_id=${u.id} and read_at is null`;
  return { ok: true };
});

/** Stores a pop-up message the user just saw, so it also shows under the bell. Read-on-arrival. */
export const addMyNotification = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ kind: z.enum(["success", "error"]), message: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireUser } = await import("./auth.server");
    const u = await requireUser();
    await sql()`insert into notifications (user_id, kind, message, read_at)
      values (${u.id}, ${"toast." + data.kind}, ${data.message}, now())`;
    return { ok: true };
  });
