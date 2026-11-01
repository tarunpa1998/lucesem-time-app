import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AppModal,
  AppStack,
  AppGroup,
  AppText,
  AppHeading,
  AppBadge,
  AppMono,
  AppAvatar,
  AppCard,
  AppTextarea,
  AppButton,
  AppSelect,
  AppMultiSelect,
  AppDivider,
  AppBox,
  AppTooltip,
  notify,
  openAppConfirmModal,
} from "@/components/core";
import {
  ChatCircle,
  PaperPlaneTilt,
  Trash,
  Clock,
  UserCheck,
  CheckCircle,
  CircleDashed,
  ArrowsClockwise,
} from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n";
import {
  listTaskComments,
  addBoardTaskComment,
  updateBoardTaskStatus,
  updateBoardTask,
  deleteBoardTask,
} from "@/backend/board.functions";
import type {
  BoardTaskRow,
  BoardTaskStatus,
  BoardTaskPriority,
  BoardTaskAssignee,
  ProjectRow,
} from "@/backend/types";

interface TaskDetailModalProps {
  task: BoardTaskRow | null;
  opened: boolean;
  onClose: () => void;
  currentUserId: string;
  isAdmin: boolean;
  projects: ProjectRow[];
  users: BoardTaskAssignee[];
  onTaskUpdated: () => void;
  onTaskDeleted: () => void;
}

export function TaskDetailModal({
  task,
  opened,
  onClose,
  currentUserId,
  isAdmin,
  projects,
  users,
  onTaskUpdated,
  onTaskDeleted,
}: TaskDetailModalProps) {
  const { t, fmtDate } = useI18n();
  const [commentText, setCommentText] = useState("");
  const [submittingComment, setSubmittingComment] = useState(false);
  const [updatingMeta, setUpdatingMeta] = useState(false);

  const {
    data: comments = [],
    refetch: refetchComments,
    isLoading: commentsLoading,
  } = useQuery({
    queryKey: ["board-task-comments", task?.id],
    queryFn: () => (task ? listTaskComments({ data: { taskId: task.id } }) : Promise.resolve([])),
    enabled: Boolean(task?.id && opened),
    refetchInterval: 8_000,
  });

  if (!task) return null;

  const canDelete = isAdmin || task.created_by === currentUserId;

  const handleStatusChange = async (newStatus: BoardTaskStatus) => {
    if (newStatus === task.status) return;
    setUpdatingMeta(true);
    try {
      await updateBoardTaskStatus({
        data: { taskId: task.id, status: newStatus },
      });
      notify.success(t("statusChanged"));
      onTaskUpdated();
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdatingMeta(false);
    }
  };

  const handlePriorityChange = async (newPriority: BoardTaskPriority) => {
    if (newPriority === task.priority) return;
    setUpdatingMeta(true);
    try {
      await updateBoardTask({
        data: { taskId: task.id, priority: newPriority },
      });
      notify.success(t("taskUpdatedSuccess"));
      onTaskUpdated();
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : "Failed to update priority");
    } finally {
      setUpdatingMeta(false);
    }
  };

  const handleAssigneesChange = async (newAssigneeIds: string[]) => {
    setUpdatingMeta(true);
    try {
      await updateBoardTask({
        data: { taskId: task.id, assigneeIds: newAssigneeIds },
      });
      notify.success(t("taskUpdatedSuccess"));
      onTaskUpdated();
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : "Failed to update assignees");
    } finally {
      setUpdatingMeta(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setSubmittingComment(true);
    try {
      await addBoardTaskComment({
        data: {
          taskId: task.id,
          comment: commentText.trim(),
        },
      });
      setCommentText("");
      await refetchComments();
      onTaskUpdated();
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setSubmittingComment(false);
    }
  };

  const handleDelete = () => {
    openAppConfirmModal({
      title: t("deleteTask"),
      message: t("deleteTaskConfirm"),
      confirmLabel: t("deleteTask"),
      confirmColor: "red",
      onConfirm: async () => {
        try {
          await deleteBoardTask({ data: { taskId: task.id } });
          notify.success(t("taskDeletedSuccess"));
          onTaskDeleted();
          onClose();
        } catch (err: unknown) {
          notify.error(err instanceof Error ? err.message : "Failed to delete task");
        }
      },
    });
  };

  const getStatusBadge = (st: BoardTaskStatus) => {
    switch (st) {
      case "in_progress":
        return (
          <AppBadge color="orange" size="sm" withDot>
            {t("inProgress")}
          </AppBadge>
        );
      case "closed":
        return (
          <AppBadge color="violet" size="sm" withDot>
            {t("closed")}
          </AppBadge>
        );
      case "pending":
      default:
        return (
          <AppBadge color="green" size="sm" withDot>
            {t("pending")}
          </AppBadge>
        );
    }
  };

  const getPriorityBadge = (p: BoardTaskPriority) => {
    switch (p) {
      case "urgent":
        return <AppBadge color="red" size="sm">{`★★★★ ${t("priorityUrgent")}`}</AppBadge>;
      case "high":
        return <AppBadge color="orange" size="sm">{`★★★ ${t("priorityHigh")}`}</AppBadge>;
      case "medium":
        return <AppBadge color="blue" size="sm">{`★★ ${t("priorityMedium")}`}</AppBadge>;
      case "low":
      default:
        return <AppBadge color="gray" size="sm">{`★ ${t("priorityLow")}`}</AppBadge>;
    }
  };

  const userOptions = users.map((u) => ({
    value: u.id,
    label: `${u.displayName}${u.jobTitle ? ` (${u.jobTitle})` : ""}`,
  }));

  const statusOptions = [
    { value: "pending", label: t("pending") },
    { value: "in_progress", label: t("inProgress") },
    { value: "closed", label: t("closed") },
  ];

  const priorityOptions = [
    { value: "low", label: `★ ${t("priorityLow")}` },
    { value: "medium", label: `★★ ${t("priorityMedium")}` },
    { value: "high", label: `★★★ ${t("priorityHigh")}` },
    { value: "urgent", label: `★★★★ ${t("priorityUrgent")}` },
  ];

  const formatCommentTime = (isoString: string) => {
    try {
      const date = new Date(isoString);
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    } catch {
      return isoString;
    }
  };

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      size="85%"
      title={
        <AppGroup gap={10} align="center" wrap="nowrap">
          <AppMono size="lg" fw={800} c="var(--app-brand-primary)">
            #{task.task_number}
          </AppMono>
          <AppText fz="md" fw={700} c="var(--app-text-primary)" truncate style={{ maxWidth: 500 }}>
            {task.title}
          </AppText>
        </AppGroup>
      }
    >
      <AppStack gap="md">
        {/* Header Badges & Info */}
        <AppGroup justify="space-between" align="center" wrap="wrap">
          <AppGroup gap={8} wrap="wrap">
            {getStatusBadge(task.status)}
            <AppBadge variant="light" color="gray" size="sm">
              {task.customer_name} · {task.project_name}
            </AppBadge>
            {getPriorityBadge(task.priority)}
          </AppGroup>

          <AppText fz="xs" c="var(--app-text-secondary)">
            {t("taskCreatedBy")}{" "}
            <AppText component="span" fw={600} c="var(--app-text-primary)">
              {task.creator_name}
            </AppText>{" "}
            · {formatCommentTime(task.created_at)}
          </AppText>
        </AppGroup>

        <AppDivider />

        {/* 2-Column Layout: Left (Main & Chat) / Right (Meta Sidebar) */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 280px",
            gap: 20,
            alignItems: "start",
          }}
          className="task-detail-grid"
        >
          {/* Left Column: Description & Chat Comments Timeline */}
          <AppStack gap="lg" style={{ minWidth: 0 }}>
            {/* Description Bubble */}
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <AppAvatar
                src={task.creator_avatar_url}
                size={38}
                radius="xl"
                color="lucesem"
                style={{ flexShrink: 0, fontWeight: 700 }}
              >
                {task.creator_name.slice(0, 2).toUpperCase()}
              </AppAvatar>

              <AppCard
                p="md"
                radius="md"
                style={{
                  flex: 1,
                  background: "var(--app-bg-surface)",
                  border: "1px solid var(--app-border-subtle)",
                }}
              >
                <AppGroup justify="space-between" align="center" mb={8} wrap="nowrap">
                  <AppGroup gap={6} align="center">
                    <AppText fz="sm" fw={700} c="var(--app-text-primary)">
                      {task.creator_name}
                    </AppText>
                    <AppBadge size="xs" variant="outline" color="gray">
                      Author
                    </AppBadge>
                  </AppGroup>
                  <AppText fz="xs" c="var(--app-text-secondary)">
                    {formatCommentTime(task.created_at)}
                  </AppText>
                </AppGroup>

                <AppText
                  fz="sm"
                  c="var(--app-text-primary)"
                  style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}
                >
                  {task.description || (
                    <span style={{ fontStyle: "italic", opacity: 0.6 }}>
                      {t("taskDescriptionPlaceholder")}
                    </span>
                  )}
                </AppText>
              </AppCard>
            </div>

            {/* Comments Stream (GitHub Issue Chat Style) */}
            <AppStack gap="sm">
              <AppGroup justify="space-between" align="center">
                <AppGroup gap={6} align="center">
                  <ChatCircle size={18} weight="bold" color="var(--app-brand-primary)" />
                  <AppText fz="sm" fw={700} c="var(--app-text-primary)">
                    {t("activityStream")} ({comments.length})
                  </AppText>
                </AppGroup>
              </AppGroup>

              {comments.length === 0 && !commentsLoading && (
                <AppCard
                  p="md"
                  radius="md"
                  style={{
                    background: "var(--app-bg-canvas)",
                    border: "1px dashed var(--app-border-subtle)",
                    textAlign: "center",
                  }}
                >
                  <AppText fz="xs" c="var(--app-text-secondary)">
                    {t("noCommentsYet")}
                  </AppText>
                </AppCard>
              )}

              {comments.map((cmt) => (
                <div key={cmt.id} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <AppAvatar
                    src={cmt.avatar_url}
                    size={36}
                    radius="xl"
                    color="lucesem"
                    style={{ flexShrink: 0, fontWeight: 700 }}
                  >
                    {cmt.user_name.slice(0, 2).toUpperCase()}
                  </AppAvatar>

                  <AppCard
                    p="sm"
                    radius="md"
                    style={{
                      flex: 1,
                      background: "var(--app-bg-surface)",
                      border: "1px solid var(--app-border-subtle)",
                      boxShadow: "var(--app-shadow-card)",
                    }}
                  >
                    <AppGroup justify="space-between" align="center" mb={6} wrap="nowrap">
                      <AppGroup gap={6} align="center">
                        <AppText fz="xs" fw={700} c="var(--app-text-primary)">
                          {cmt.user_name}
                        </AppText>
                        {cmt.job_title && (
                          <AppBadge size="xs" variant="subtle" color="gray">
                            {cmt.job_title}
                          </AppBadge>
                        )}
                        {cmt.user_id === task.created_by && (
                          <AppBadge size="xs" variant="outline" color="blue">
                            Author
                          </AppBadge>
                        )}
                      </AppGroup>
                      <AppText fz="xs" c="var(--app-text-secondary)">
                        {formatCommentTime(cmt.created_at)}
                      </AppText>
                    </AppGroup>

                    <AppText
                      fz="sm"
                      c="var(--app-text-primary)"
                      style={{ whiteSpace: "pre-wrap", lineHeight: 1.45 }}
                    >
                      {cmt.comment}
                    </AppText>
                  </AppCard>
                </div>
              ))}
            </AppStack>

            {/* Add Comment Input Form */}
            <form onSubmit={handleAddComment}>
              <AppCard
                p="md"
                radius="md"
                style={{
                  background: "var(--app-bg-surface)",
                  border: "1px solid var(--app-border-subtle)",
                }}
              >
                <AppStack gap="sm">
                  <AppText fz="xs" fw={700} c="var(--app-text-secondary)">
                    {t("addComment")}
                  </AppText>
                  <AppTextarea
                    placeholder={t("commentPlaceholder")}
                    value={commentText}
                    onChange={(e) => setCommentText(e.currentTarget.value)}
                    minRows={2}
                    maxRows={5}
                  />
                  <AppGroup justify="flex-end">
                    <AppButton
                      type="submit"
                      size="sm"
                      loading={submittingComment}
                      disabled={!commentText.trim()}
                      leftSection={<PaperPlaneTilt size={16} weight="bold" />}
                    >
                      {t("sendComment")}
                    </AppButton>
                  </AppGroup>
                </AppStack>
              </AppCard>
            </form>
          </AppStack>

          {/* Right Column: Meta Sidebar */}
          <AppStack gap="md" style={{ minWidth: 0 }}>
            {/* Status Selector */}
            <AppCard
              p="sm"
              radius="md"
              style={{
                background: "var(--app-bg-surface)",
                border: "1px solid var(--app-border-subtle)",
              }}
            >
              <AppStack gap={6}>
                <AppText fz="xs" fw={700} c="var(--app-text-secondary)">
                  {t("statusSort")}
                </AppText>
                <AppSelect
                  data={statusOptions}
                  value={task.status}
                  onChange={(v) => v && handleStatusChange(v as BoardTaskStatus)}
                  disabled={updatingMeta}
                />
              </AppStack>
            </AppCard>

            {/* Priority Selector */}
            <AppCard
              p="sm"
              radius="md"
              style={{
                background: "var(--app-bg-surface)",
                border: "1px solid var(--app-border-subtle)",
              }}
            >
              <AppStack gap={6}>
                <AppText fz="xs" fw={700} c="var(--app-text-secondary)">
                  {t("priority")}
                </AppText>
                <AppSelect
                  data={priorityOptions}
                  value={task.priority}
                  onChange={(v) => v && handlePriorityChange(v as BoardTaskPriority)}
                  disabled={updatingMeta}
                />
              </AppStack>
            </AppCard>

            {/* Assignees Selector & Team Collaborators */}
            <AppCard
              p="sm"
              radius="md"
              style={{
                background: "var(--app-bg-surface)",
                border: "1px solid var(--app-border-subtle)",
              }}
            >
              <AppStack gap={8}>
                <AppText fz="xs" fw={700} c="var(--app-text-secondary)">
                  {t("assignees")}
                </AppText>
                <AppMultiSelect
                  data={userOptions}
                  value={task.assignee_ids}
                  onChange={handleAssigneesChange}
                  placeholder={t("selectAssignees")}
                  disabled={updatingMeta}
                  searchable
                  clearable
                />

                {/* Display avatars & names */}
                <AppStack gap={6} pt={4}>
                  {task.assignees.map((a) => (
                    <AppGroup key={a.id} gap={8} wrap="nowrap" align="center">
                      <AppAvatar
                        src={a.avatarUrl}
                        size={24}
                        radius="xl"
                        color="lucesem"
                        style={{ fontSize: 10, fontWeight: 700 }}
                      >
                        {a.displayName.slice(0, 2).toUpperCase()}
                      </AppAvatar>
                      <AppStack gap={0} style={{ minWidth: 0, flex: 1 }}>
                        <AppText fz="xs" fw={600} truncate c="var(--app-text-primary)">
                          {a.displayName}
                        </AppText>
                        {a.jobTitle && (
                          <AppText fz={10} c="var(--app-text-secondary)" truncate>
                            {a.jobTitle}
                          </AppText>
                        )}
                      </AppStack>
                    </AppGroup>
                  ))}
                  {task.assignees.length === 0 && (
                    <AppText fz="xs" c="var(--app-text-secondary)" style={{ fontStyle: "italic" }}>
                      No one assigned
                    </AppText>
                  )}
                </AppStack>
              </AppStack>
            </AppCard>

            {/* Delete button (only for admin or author) */}
            {canDelete && (
              <AppButton
                variant="light"
                color="red"
                size="sm"
                fullWidth
                onClick={handleDelete}
                leftSection={<Trash size={16} />}
              >
                {t("deleteTask")}
              </AppButton>
            )}
          </AppStack>
        </div>
      </AppStack>
    </AppModal>
  );
}
