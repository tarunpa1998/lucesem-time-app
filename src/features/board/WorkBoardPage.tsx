import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AppPageHeader,
  AppCard,
  AppGroup,
  AppStack,
  AppButton,
  AppBadge,
  AppText,
  AppTextInput,
  AppSelect,
  AppFolderTabs,
  AppTooltip,
  notify,
} from "@/components/core";
import {
  Plus,
  MagnifyingGlass,
  Kanban,
  CheckCircle,
  CircleDashed,
  ArrowsClockwise,
  User,
} from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n";
import { meQuery, myProjectsQuery, assignableUsersQuery, boardTasksQuery } from "@/lib/session";
import { updateBoardTaskStatus } from "@/backend/board.functions";
import type { BoardTaskRow, BoardTaskStatus, BoardTaskPriority } from "@/backend/types";
import { TaskCard } from "./TaskCard";
import { TaskFormModal } from "./TaskFormModal";
import { TaskDetailModal } from "./TaskDetailModal";

type TabView = "all" | BoardTaskStatus;

export function WorkBoardPage() {
  const { t } = useI18n();
  const queryClient = useQueryClient();

  const { data: me } = useQuery(meQuery);
  const { data: projects = [] } = useQuery(myProjectsQuery);
  const { data: assignableUsers = [] } = useQuery(assignableUsersQuery);

  // Filters
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabView>("all");

  // Drag and drop state
  const [draggedOverCol, setDraggedOverCol] = useState<BoardTaskStatus | null>(null);

  // Modals state
  const [createModalOpened, setCreateModalOpened] = useState(false);
  const [createInitialStatus, setCreateInitialStatus] = useState<BoardTaskStatus>("pending");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Tasks query
  const queryFilters = useMemo(
    () => ({
      projectId: selectedProjectId || undefined,
      assigneeId: selectedAssigneeId || undefined,
      search: searchQuery.trim() || undefined,
    }),
    [selectedProjectId, selectedAssigneeId, searchQuery],
  );

  const { data: tasks = [], isLoading: tasksLoading } = useQuery(boardTasksQuery(queryFilters));

  // Selected task detail
  const selectedTask = useMemo(
    () => tasks.find((t) => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId],
  );

  // Grouped tasks
  const pendingTasks = useMemo(() => tasks.filter((t) => t.status === "pending"), [tasks]);
  const inProgressTasks = useMemo(() => tasks.filter((t) => t.status === "in_progress"), [tasks]);
  const closedTasks = useMemo(() => tasks.filter((t) => t.status === "closed"), [tasks]);

  const handleOpenCreate = (status: BoardTaskStatus = "pending") => {
    setCreateInitialStatus(status);
    setCreateModalOpened(true);
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, colStatus: BoardTaskStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedOverCol !== colStatus) {
      setDraggedOverCol(colStatus);
    }
  };

  const handleDragLeave = (e: React.DragEvent, colStatus: BoardTaskStatus) => {
    // Only clear if leaving the drop container
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (draggedOverCol === colStatus) {
      setDraggedOverCol(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetStatus: BoardTaskStatus) => {
    e.preventDefault();
    setDraggedOverCol(null);
    const taskId = e.dataTransfer.getData("text/plain");
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.status === targetStatus) return;

    // Optimistic UI update
    queryClient.setQueryData(
      boardTasksQuery(queryFilters).queryKey,
      (old: BoardTaskRow[] | undefined) => {
        if (!old) return old;
        return old.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t));
      },
    );

    try {
      await updateBoardTaskStatus({
        data: { taskId, status: targetStatus },
      });
      notify.success(t("statusChanged"));
      await queryClient.invalidateQueries({ queryKey: ["board", "tasks"] });
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : "Failed to update task status");
      await queryClient.invalidateQueries({ queryKey: ["board", "tasks"] });
    }
  };

  const projectOptions = projects.map((p) => ({
    value: p.id,
    label: `${p.customer_name} · ${p.name}`,
  }));

  const userOptions = assignableUsers.map((u) => ({
    value: u.id,
    label: `${u.displayName}${u.jobTitle ? ` (${u.jobTitle})` : ""}`,
  }));

  const tabItems = [
    { value: "all", label: `${t("allSections")} (${tasks.length})` },
    { value: "pending", label: `${t("pending")} (${pendingTasks.length})` },
    { value: "in_progress", label: `${t("inProgress")} (${inProgressTasks.length})` },
    { value: "closed", label: `${t("closed")} (${closedTasks.length})` },
  ];

  const renderColumn = (
    colStatus: BoardTaskStatus,
    colTitle: string,
    colSubtext: string,
    dotColor: string,
    colTasks: BoardTaskRow[],
  ) => {
    const isDragTarget = draggedOverCol === colStatus;

    return (
      <div
        key={colStatus}
        onDragOver={(e) => handleDragOver(e, colStatus)}
        onDragLeave={(e) => handleDragLeave(e, colStatus)}
        onDrop={(e) => handleDrop(e, colStatus)}
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          minWidth: 310,
          background: isDragTarget ? "var(--app-bg-surface)" : "var(--app-bg-canvas)",
          border: isDragTarget
            ? "2px dashed var(--app-brand-primary)"
            : "1px solid var(--app-border-subtle)",
          borderRadius: "var(--app-radius-lg)",
          padding: 12,
          transition: "all 0.15s ease",
          boxShadow: isDragTarget ? "var(--app-shadow-floating)" : "none",
        }}
      >
        {/* Column Header */}
        <AppGroup justify="space-between" align="center" mb={6} wrap="nowrap">
          <AppGroup gap={8} align="center" wrap="nowrap">
            <span
              style={{
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: dotColor,
                display: "inline-block",
                boxShadow: `0 0 6px ${dotColor}88`,
              }}
            />
            <AppText fz="sm" fw={700} c="var(--app-text-primary)">
              {colTitle}
            </AppText>
            <AppBadge size="xs" variant="light" color="gray">
              {colTasks.length}
            </AppBadge>
          </AppGroup>

          <AppButton
            size="compact-xs"
            variant="subtle"
            color="gray"
            onClick={() => handleOpenCreate(colStatus)}
            leftSection={<Plus size={14} weight="bold" />}
          >
            {t("add")}
          </AppButton>
        </AppGroup>

        {/* Subtext description */}
        <AppText fz={11} c="var(--app-text-secondary)" mb={12}>
          {colSubtext}
        </AppText>

        {/* Column Task Cards */}
        <AppStack gap="sm" style={{ flex: 1, minHeight: 120 }}>
          {colTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => setSelectedTaskId(task.id)}
              onDragStart={handleDragStart}
            />
          ))}

          {colTasks.length === 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "36px 12px",
                border: "1px dashed var(--app-border-subtle)",
                borderRadius: "var(--app-radius-md)",
                background: "var(--app-bg-surface)",
                opacity: 0.7,
              }}
            >
              <AppText fz="xs" c="var(--app-text-secondary)">
                {t("noTasksInColumn")}
              </AppText>
              <AppText fz={10} c="var(--app-text-secondary)" mt={4}>
                {t("dragHint")}
              </AppText>
            </div>
          )}
        </AppStack>
      </div>
    );
  };

  return (
    <AppStack gap="lg">
      {/* Floating Sub-Header Card Standard */}
      <AppPageHeader
        title={t("workBoard")}
        subtitle={t("workBoardSubtitle")}
        icon={Kanban}
        actions={
          <AppButton
            onClick={() => handleOpenCreate("pending")}
            leftSection={<Plus size={16} weight="bold" />}
          >
            {t("newTask")}
          </AppButton>
        }
      />

      {/* Control Card: Tabs & Filters */}
      <AppCard p="md" radius="lg">
        <AppStack gap="md">
          {/* Tab Navigation Style */}
          <AppGroup justify="space-between" align="center" wrap="wrap">
            <AppFolderTabs
              value={activeTab}
              onChange={(v) => setActiveTab(v as TabView)}
              items={tabItems}
              compact
            />

            <AppGroup gap={8} wrap="nowrap">
              <AppBadge variant="light" color="lucesem" size="sm">
                {tasks.length} {t("entriesCount")}
              </AppBadge>
            </AppGroup>
          </AppGroup>

          {/* Search and Filters Bar */}
          <AppGroup gap="sm" wrap="wrap">
            <AppTextInput
              placeholder={t("searchTasks")}
              leftSection={<MagnifyingGlass size={16} />}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              style={{ flex: 1, minWidth: 220 }}
            />

            <AppSelect
              placeholder={t("filterByProject")}
              data={projectOptions}
              value={selectedProjectId}
              onChange={setSelectedProjectId}
              clearable
              searchable
              style={{ minWidth: 220 }}
            />

            <AppSelect
              placeholder={t("filterByAssignee")}
              data={userOptions}
              value={selectedAssigneeId}
              onChange={setSelectedAssigneeId}
              clearable
              searchable
              style={{ minWidth: 200 }}
            />
          </AppGroup>
        </AppStack>
      </AppCard>

      {/* Board Columns Display */}
      {activeTab === "all" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
            gap: 16,
            alignItems: "stretch",
          }}
        >
          {renderColumn(
            "pending",
            t("pending"),
            "This item hasn't been started",
            "#2ea043",
            pendingTasks,
          )}
          {renderColumn(
            "in_progress",
            t("inProgress"),
            "This is actively being worked on",
            "#d29922",
            inProgressTasks,
          )}
          {renderColumn("closed", t("closed"), "This has been completed", "#8250df", closedTasks)}
        </div>
      ) : activeTab === "pending" ? (
        <div style={{ maxWidth: 800, margin: "0 auto", width: "100%" }}>
          {renderColumn(
            "pending",
            t("pending"),
            "This item hasn't been started",
            "#2ea043",
            pendingTasks,
          )}
        </div>
      ) : activeTab === "in_progress" ? (
        <div style={{ maxWidth: 800, margin: "0 auto", width: "100%" }}>
          {renderColumn(
            "in_progress",
            t("inProgress"),
            "This is actively being worked on",
            "#d29922",
            inProgressTasks,
          )}
        </div>
      ) : (
        <div style={{ maxWidth: 800, margin: "0 auto", width: "100%" }}>
          {renderColumn("closed", t("closed"), "This has been completed", "#8250df", closedTasks)}
        </div>
      )}

      {/* Create Task Modal */}
      <TaskFormModal
        opened={createModalOpened}
        onClose={() => setCreateModalOpened(false)}
        initialStatus={createInitialStatus}
        projects={projects}
        users={assignableUsers}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ["board", "tasks"] });
        }}
      />

      {/* Detail & Chat Comments Modal */}
      <TaskDetailModal
        task={selectedTask}
        opened={Boolean(selectedTaskId)}
        onClose={() => setSelectedTaskId(null)}
        currentUserId={me?.id ?? ""}
        isAdmin={Boolean(me?.isAdmin)}
        projects={projects}
        users={assignableUsers}
        onTaskUpdated={() => {
          queryClient.invalidateQueries({ queryKey: ["board", "tasks"] });
        }}
        onTaskDeleted={() => {
          setSelectedTaskId(null);
          queryClient.invalidateQueries({ queryKey: ["board", "tasks"] });
        }}
      />
    </AppStack>
  );
}
