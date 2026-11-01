import { queryOptions } from "@tanstack/react-query";
import { getMe } from "@/backend/auth.functions";
import {
  listMyProjects,
  listCustomers,
  listTeams,
  listUsers,
  listNotifications,
} from "@/backend/org.functions";

export const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: () => getMe(),
  staleTime: 60_000,
});
export const myProjectsQuery = queryOptions({
  queryKey: ["projects", "mine"],
  queryFn: () => listMyProjects(),
});
export const customersQuery = queryOptions({
  queryKey: ["customers"],
  queryFn: () => listCustomers(),
});
export const teamsQuery = queryOptions({ queryKey: ["teams"], queryFn: () => listTeams() });
export const usersQuery = queryOptions({ queryKey: ["users"], queryFn: () => listUsers() });
export const notificationsQuery = queryOptions({
  queryKey: ["notifications"],
  queryFn: () => listNotifications(),
  refetchInterval: 30_000,
});

export type Me = NonNullable<Awaited<ReturnType<typeof getMe>>>;
export type { ProjectRow } from "@/backend/types";

import {
  approvalQueue,
  listLocks,
  liveBoard,
  auditLog,
  listPortals,
  myUnlockedDates,
} from "@/backend/workflow.functions";
export const approvalQueueQuery = queryOptions({
  queryKey: ["approvals"],
  queryFn: () => approvalQueue(),
  refetchInterval: 30_000,
});
export const locksQuery = queryOptions({ queryKey: ["locks"], queryFn: () => listLocks() });
export const liveQuery = queryOptions({
  queryKey: ["live"],
  queryFn: () => liveBoard(),
  refetchInterval: 15_000,
});
export const auditQuery = queryOptions({ queryKey: ["audit"], queryFn: () => auditLog() });
export const portalsQuery = queryOptions({ queryKey: ["portals"], queryFn: () => listPortals() });
export const myAccessQuery = queryOptions({
  queryKey: ["my-access"],
  queryFn: () => myUnlockedDates(),
});

import { listBoardTasks, listAssignableUsers } from "@/backend/board.functions";
export const assignableUsersQuery = queryOptions({
  queryKey: ["board", "assignable-users"],
  queryFn: () => listAssignableUsers(),
  staleTime: 60_000,
});
export type BoardTaskFilters = {
  projectId?: string | undefined;
  status?: "pending" | "in_progress" | "closed" | undefined;
  assigneeId?: string | undefined;
  search?: string | undefined;
};

export const boardTasksQuery = (filters?: BoardTaskFilters) =>
  queryOptions({
    queryKey: ["board", "tasks", filters ?? {}],
    queryFn: () => listBoardTasks({ data: filters }),
  });

import { listActivities, budgetUsage } from "@/backend/extra.functions";
export const activitiesQuery = queryOptions({
  queryKey: ["activities"],
  queryFn: () => listActivities(),
});
export const budgetQuery = queryOptions({ queryKey: ["budgets"], queryFn: () => budgetUsage() });
