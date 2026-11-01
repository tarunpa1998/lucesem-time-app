import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type {
  BoardTaskRow,
  BoardTaskCommentRow,
  BoardTaskAssignee,
  BoardTaskStatus,
  BoardTaskPriority,
  OpenTaskRow,
  TaskTimeEntryRow,
} from "./types";

const opt = (s: z.ZodString) =>
  s
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

/* ---------------- Active Members for Assignment ---------------- */

export const listAssignableUsers = createServerFn({ method: "GET" }).handler(async () => {
  const { sql } = await import("./db.server");
  const { requireUser } = await import("./auth.server");
  await requireUser();
  const rows = await sql()<
    { id: string; display_name: string; avatar_url: string | null; job_title: string | null }[]
  >`
    select id, display_name, avatar_url, job_title
    from app_users
    where is_active = true
    order by display_name asc
  `;
  return rows.map((r) => ({
    id: r.id,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
    jobTitle: r.job_title,
  })) as BoardTaskAssignee[];
});

/* ---------------- Board Tasks ---------------- */

const listTasksSchema = z
  .object({
    projectId: z.string().uuid().optional(),
    status: z.enum(["pending", "in_progress", "closed"]).optional(),
    assigneeId: z.string().uuid().optional(),
    search: z.string().trim().optional(),
  })
  .optional();

interface DbBoardTaskRow {
  id: string;
  task_number: number;
  project_id: string;
  project_name: string;
  customer_name: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  created_by: string;
  creator_name: string;
  creator_avatar_url: string | null;
  assignee_ids: string[] | null;
  assignees: unknown;
  comment_count: number | null;
  logged_hours: number | null;
  github_issue_number: number | null;
  github_url: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export const listBoardTasks = createServerFn({ method: "GET" })
  .validator((d: unknown) => listTasksSchema.parse(d))
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireUser } = await import("./auth.server");
    const u = await requireUser();

    const projectId = data?.projectId ?? null;
    const status = data?.status ?? null;
    const assigneeId = data?.assigneeId ?? null;
    const search = data?.search ? `%${data.search.toLowerCase()}%` : null;

    const rows = await sql()<DbBoardTaskRow[]>`
      select 
        t.id,
        t.task_number,
        t.project_id,
        p.name as project_name,
        c.name as customer_name,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.created_by,
        creator.display_name as creator_name,
        creator.avatar_url as creator_avatar_url,
        t.assignee_ids,
        coalesce(
          (
            select json_agg(
              json_build_object(
                'id', au.id,
                'displayName', au.display_name,
                'avatarUrl', au.avatar_url,
                'jobTitle', au.job_title
              )
            )
            from app_users au
            where au.id = any(t.assignee_ids)
          ),
          '[]'::json
        ) as assignees,
        coalesce(
          (select count(*)::int from board_task_comments cmt where cmt.task_id = t.id),
          0
        ) as comment_count,
        coalesce(
          (
            select round(sum(
              extract(epoch from (te.to_time::time - te.from_time::time)) / 3600.0
            )::numeric, 2)
            from time_entries te
            where te.task_id = t.id
              and te.status <> 'rejected'
          ),
          0.00
        )::float as logged_hours,
        t.github_issue_number,
        t.github_url,
        t.created_at,
        t.updated_at
      from board_tasks t
      join projects p on p.id = t.project_id
      join customers c on c.id = p.customer_id
      join app_users creator on creator.id = t.created_by
      where (
        ${u.isAdmin}
        or t.created_by = ${u.id}
        or ${u.id} = any(t.assignee_ids)
        or (
          p.is_visible and c.is_visible and p.approval_state <> 'Rejected' and (
            p.created_by = ${u.id}
            or exists (select 1 from project_users pu where pu.project_id = p.id and pu.user_id = ${u.id})
            or exists (select 1 from project_teams pt join team_members tm on tm.team_id = pt.team_id where pt.project_id = p.id and tm.user_id = ${u.id})
            or exists (select 1 from customer_teams ct join team_members tm on tm.team_id = ct.team_id where ct.customer_id = c.id and tm.user_id = ${u.id})
          )
        )
      )
      and (${projectId}::uuid is null or t.project_id = ${projectId}::uuid)
      and (${status}::text is null or t.status = ${status}::text)
      and (${assigneeId}::uuid is null or ${assigneeId}::uuid = any(t.assignee_ids))
      and (${search}::text is null or lower(t.title) like ${search} or lower(t.description) like ${search})
      order by t.updated_at desc
    `;

    return rows.map((r) => ({
      id: r.id,
      task_number: Number(r.task_number),
      project_id: r.project_id,
      project_name: r.project_name,
      customer_name: r.customer_name,
      title: r.title,
      description: r.description ?? "",
      status: r.status as BoardTaskStatus,
      priority: r.priority as BoardTaskPriority,
      created_by: r.created_by,
      creator_name: r.creator_name,
      creator_avatar_url: r.creator_avatar_url,
      assignee_ids: (r.assignee_ids || []) as string[],
      assignees: (typeof r.assignees === "string"
        ? JSON.parse(r.assignees)
        : r.assignees) as BoardTaskAssignee[],
      comment_count: Number(r.comment_count || 0),
      logged_hours: Number(r.logged_hours || 0),
      github_issue_number: r.github_issue_number ? Number(r.github_issue_number) : null,
      github_url: r.github_url ?? null,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
      updated_at: r.updated_at instanceof Date ? r.updated_at.toISOString() : String(r.updated_at),
    })) as BoardTaskRow[];
  });

const createTaskSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().trim().min(1).max(255),
  description: z.string().default(""),
  status: z.enum(["pending", "in_progress", "closed"]).default("pending"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  assigneeIds: z.array(z.string().uuid()).default([]),
});

export const createBoardTask = createServerFn({ method: "POST" })
  .validator((d: unknown) => createTaskSchema.parse(d))
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireUser, audit } = await import("./auth.server");
    const u = await requireUser();

    // Verify user can access this project
    const db = sql();
    const [project] = await db`
      select p.id
      from projects p join customers c on c.id = p.customer_id
      where p.id = ${data.projectId}
      and (${u.isAdmin} or (
        p.is_visible and c.is_visible and p.approval_state <> 'Rejected' and (
          p.created_by = ${u.id}
          or exists (select 1 from project_users pu where pu.project_id = p.id and pu.user_id = ${u.id})
          or exists (select 1 from project_teams pt join team_members tm on tm.team_id = pt.team_id where pt.project_id = p.id and tm.user_id = ${u.id})
          or exists (select 1 from customer_teams ct join team_members tm on tm.team_id = ct.team_id where ct.customer_id = c.id and tm.user_id = ${u.id})
        )
      ))
    `;
    if (!project) {
      throw new Error("PROJECT_NOT_ACCESSIBLE");
    }

    const [created] = await db<{ id: string; task_number: number }[]>`
      insert into board_tasks (
        project_id,
        title,
        description,
        status,
        priority,
        created_by,
        assignee_ids
      ) values (
        ${data.projectId},
        ${data.title},
        ${data.description},
        ${data.status},
        ${data.priority},
        ${u.id},
        ${data.assigneeIds}
      )
      returning id, task_number
    `;
    if (!created) throw new Error("CREATE_FAILED");

    await audit(u.id, "create", "board_task", created.id, {
      title: data.title,
      task_number: created.task_number,
      project_id: data.projectId,
    });

    return { id: created.id, task_number: created.task_number };
  });

const updateTaskStatusSchema = z.object({
  taskId: z.string().uuid(),
  status: z.enum(["pending", "in_progress", "closed"]),
});

export const updateBoardTaskStatus = createServerFn({ method: "POST" })
  .validator((d: unknown) => updateTaskStatusSchema.parse(d))
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireUser, audit } = await import("./auth.server");
    const u = await requireUser();

    const db = sql();
    const [task] = await db<{ id: string; status: string }[]>`
      select t.id, t.status
      from board_tasks t
      join projects p on p.id = t.project_id
      join customers c on c.id = p.customer_id
      where t.id = ${data.taskId}
      and (
        ${u.isAdmin}
        or t.created_by = ${u.id}
        or ${u.id} = any(t.assignee_ids)
        or (
          p.is_visible and c.is_visible and p.approval_state <> 'Rejected' and (
            p.created_by = ${u.id}
            or exists (select 1 from project_users pu where pu.project_id = p.id and pu.user_id = ${u.id})
            or exists (select 1 from project_teams pt join team_members tm on tm.team_id = pt.team_id where pt.project_id = p.id and tm.user_id = ${u.id})
            or exists (select 1 from customer_teams ct join team_members tm on tm.team_id = ct.team_id where ct.customer_id = c.id and tm.user_id = ${u.id})
          )
        )
      )
    `;

    if (!task) {
      throw new Error("TASK_NOT_FOUND_OR_FORBIDDEN");
    }

    const prevStatus = task.status;
    await db`
      update board_tasks
      set status = ${data.status}, updated_at = now()
      where id = ${data.taskId}
    `;

    await audit(u.id, "update_status", "board_task", data.taskId, {
      from: prevStatus,
      to: data.status,
    });

    return { ok: true, status: data.status };
  });

const updateTaskSchema = z.object({
  taskId: z.string().uuid(),
  title: z.string().trim().min(1).max(255).optional(),
  description: z.string().optional(),
  status: z.enum(["pending", "in_progress", "closed"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  projectId: z.string().uuid().optional(),
  assigneeIds: z.array(z.string().uuid()).optional(),
});

export const updateBoardTask = createServerFn({ method: "POST" })
  .validator((d: unknown) => updateTaskSchema.parse(d))
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireUser, audit } = await import("./auth.server");
    const u = await requireUser();

    const db = sql();
    const [task] = await db`
      select t.id, t.project_id, t.created_by, t.assignee_ids
      from board_tasks t
      join projects p on p.id = t.project_id
      join customers c on c.id = p.customer_id
      where t.id = ${data.taskId}
      and (
        ${u.isAdmin}
        or t.created_by = ${u.id}
        or ${u.id} = any(t.assignee_ids)
        or (
          p.is_visible and c.is_visible and p.approval_state <> 'Rejected' and (
            p.created_by = ${u.id}
            or exists (select 1 from project_users pu where pu.project_id = p.id and pu.user_id = ${u.id})
            or exists (select 1 from project_teams pt join team_members tm on tm.team_id = pt.team_id where pt.project_id = p.id and tm.user_id = ${u.id})
            or exists (select 1 from customer_teams ct join team_members tm on tm.team_id = ct.team_id where ct.customer_id = c.id and tm.user_id = ${u.id})
          )
        )
      )
    `;

    if (!task) {
      throw new Error("TASK_NOT_FOUND_OR_FORBIDDEN");
    }

    await db`
      update board_tasks
      set
        title = coalesce(${data.title ?? null}, title),
        description = coalesce(${data.description ?? null}, description),
        status = coalesce(${data.status ?? null}, status),
        priority = coalesce(${data.priority ?? null}, priority),
        project_id = coalesce(${data.projectId ?? null}::uuid, project_id),
        assignee_ids = coalesce(${data.assigneeIds ?? null}::uuid[], assignee_ids),
        updated_at = now()
      where id = ${data.taskId}
    `;

    await audit(u.id, "update", "board_task", data.taskId, data);
    return { ok: true };
  });

export const deleteBoardTask = createServerFn({ method: "POST" })
  .validator((d: unknown) => z.object({ taskId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireUser, audit } = await import("./auth.server");
    const u = await requireUser();

    const db = sql();
    const [task] = await db<{ id: string; created_by: string; title: string }[]>`
      select id, created_by, title from board_tasks where id = ${data.taskId}
    `;
    if (!task) throw new Error("TASK_NOT_FOUND");
    if (!u.isAdmin && task.created_by !== u.id) {
      throw new Error("FORBIDDEN");
    }

    await db`delete from board_tasks where id = ${data.taskId}`;
    await audit(u.id, "delete", "board_task", data.taskId, { title: task.title });
    return { ok: true };
  });

/* ---------------- Comments (Chat Timeline) ---------------- */

export const listTaskComments = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ taskId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireUser } = await import("./auth.server");
    const u = await requireUser();

    const db = sql();
    // Verify user can view the parent task
    const [task] = await db`
      select t.id
      from board_tasks t
      join projects p on p.id = t.project_id
      join customers c on c.id = p.customer_id
      where t.id = ${data.taskId}
      and (
        ${u.isAdmin}
        or t.created_by = ${u.id}
        or ${u.id} = any(t.assignee_ids)
        or (
          p.is_visible and c.is_visible and p.approval_state <> 'Rejected' and (
            p.created_by = ${u.id}
            or exists (select 1 from project_users pu where pu.project_id = p.id and pu.user_id = ${u.id})
            or exists (select 1 from project_teams pt join team_members tm on tm.team_id = pt.team_id where pt.project_id = p.id and tm.user_id = ${u.id})
            or exists (select 1 from customer_teams ct join team_members tm on tm.team_id = ct.team_id where ct.customer_id = c.id and tm.user_id = ${u.id})
          )
        )
      )
    `;

    if (!task) throw new Error("TASK_NOT_FOUND_OR_FORBIDDEN");

    interface DbCommentRow {
      id: string;
      task_id: string;
      user_id: string;
      comment: string;
      created_at: Date | string;
      user_name: string;
      avatar_url: string | null;
      job_title: string | null;
    }

    const rows = await db<DbCommentRow[]>`
      select 
        c.id,
        c.task_id,
        c.user_id,
        c.comment,
        c.created_at,
        u.display_name as user_name,
        u.avatar_url,
        u.job_title
      from board_task_comments c
      join app_users u on u.id = c.user_id
      where c.task_id = ${data.taskId}
      order by c.created_at asc
    `;

    return rows.map((r) => ({
      id: r.id,
      task_id: r.task_id,
      user_id: r.user_id,
      user_name: r.user_name,
      avatar_url: r.avatar_url ?? null,
      job_title: r.job_title ?? null,
      comment: r.comment,
      created_at: r.created_at instanceof Date ? r.created_at.toISOString() : String(r.created_at),
    })) as BoardTaskCommentRow[];
  });

export const addBoardTaskComment = createServerFn({ method: "POST" })
  .validator((d: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        comment: z.string().trim().min(1).max(5000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireUser, audit } = await import("./auth.server");
    const u = await requireUser();

    const db = sql();
    // Verify access
    const [task] = await db<{ id: string; title: string }[]>`
      select t.id, t.title
      from board_tasks t
      join projects p on p.id = t.project_id
      join customers c on c.id = p.customer_id
      where t.id = ${data.taskId}
      and (
        ${u.isAdmin}
        or t.created_by = ${u.id}
        or ${u.id} = any(t.assignee_ids)
        or (
          p.is_visible and c.is_visible and p.approval_state <> 'Rejected' and (
            p.created_by = ${u.id}
            or exists (select 1 from project_users pu where pu.project_id = p.id and pu.user_id = ${u.id})
            or exists (select 1 from project_teams pt join team_members tm on tm.team_id = pt.team_id where pt.project_id = p.id and tm.user_id = ${u.id})
            or exists (select 1 from customer_teams ct join team_members tm on tm.team_id = ct.team_id where ct.customer_id = c.id and tm.user_id = ${u.id})
          )
        )
      )
    `;

    if (!task) throw new Error("TASK_NOT_FOUND_OR_FORBIDDEN");

    const [comment] = await db<{ id: string; created_at: Date | string }[]>`
      insert into board_task_comments (task_id, user_id, comment)
      values (${data.taskId}, ${u.id}, ${data.comment})
      returning id, created_at
    `;
    if (!comment) throw new Error("COMMENT_FAILED");

    const [userRow] = await db<
      { display_name: string; avatar_url: string | null; job_title: string | null }[]
    >`
      select display_name, avatar_url, job_title from app_users where id = ${u.id}
    `;

    // Touch parent task updated_at
    await db`update board_tasks set updated_at = now() where id = ${data.taskId}`;

    await audit(u.id, "comment", "board_task", data.taskId, {
      comment_id: comment.id,
      task_title: task.title,
    });

    return {
      id: comment.id,
      task_id: data.taskId,
      user_id: u.id,
      user_name: userRow?.display_name ?? u.displayName,
      avatar_url: userRow?.avatar_url ?? null,
      job_title: userRow?.job_title ?? null,
      comment: data.comment,
      created_at:
        comment.created_at instanceof Date
          ? comment.created_at.toISOString()
          : String(comment.created_at),
    } as BoardTaskCommentRow;
  });

/* ---------------- Open Tasks for Time Allocation Modal ---------------- */

export const listOpenTasksForProject = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ projectId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireUser } = await import("./auth.server");
    await requireUser();

    const db = sql();
    const rows = await db<
      {
        id: string;
        task_number: number;
        title: string;
        status: string;
        priority: string;
      }[]
    >`
      select id, task_number, title, status, priority
      from board_tasks
      where project_id = ${data.projectId}
        and status in ('pending', 'in_progress')
      order by priority = 'urgent' desc, priority = 'high' desc, created_at desc
      limit 100
    `;
    return rows.map((r) => ({
      id: r.id,
      task_number: r.task_number,
      title: r.title,
      status: r.status,
      priority: r.priority,
    })) as OpenTaskRow[];
  });

/* ---------------- Task Time Entries (Logged Work Breakdown) ---------------- */

export const listTaskTimeEntries = createServerFn({ method: "GET" })
  .validator((d: unknown) => z.object({ taskId: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { sql } = await import("./db.server");
    const { requireUser } = await import("./auth.server");
    await requireUser();

    const db = sql();
    const rows = await db<
      {
        id: string;
        user_name: string;
        entry_date: string;
        from_time: string;
        to_time: string;
        hours: number;
        work_notes: string;
      }[]
    >`
      select 
        te.id,
        u.display_name as user_name,
        to_char(te.entry_date, 'YYYY-MM-DD') as entry_date,
        to_char(te.from_time, 'HH24:MI') as from_time,
        to_char(te.to_time, 'HH24:MI') as to_time,
        round(extract(epoch from (te.to_time::time - te.from_time::time)) / 3600.0, 2)::float as hours,
        te.work_notes
      from time_entries te
      join app_users u on u.id = te.user_id
      where te.task_id = ${data.taskId}
        and te.status <> 'rejected'
      order by te.entry_date desc, te.from_time desc
      limit 50
    `;
    return rows.map((r) => ({
      id: r.id,
      user_name: r.user_name,
      entry_date: r.entry_date,
      from_time: r.from_time,
      to_time: r.to_time,
      hours: Number(r.hours) || 0,
      work_notes: r.work_notes ?? "",
    })) as TaskTimeEntryRow[];
  });
