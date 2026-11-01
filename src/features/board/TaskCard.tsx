import { useState } from "react";
import {
  AppCard,
  AppText,
  AppBadge,
  AppGroup,
  AppStack,
  AppMono,
  AppAvatar,
  AppTooltip,
} from "@/components/core";
import { ChatCircle, Clock } from "@phosphor-icons/react";
import type { BoardTaskRow, BoardTaskPriority } from "@/backend/types";
import { useI18n } from "@/lib/i18n";

interface TaskCardProps {
  task: BoardTaskRow;
  onClick: () => void;
  onDragStart: (e: React.DragEvent, taskId: string) => void;
}

export function TaskCard({ task, onClick, onDragStart }: TaskCardProps) {
  const { t } = useI18n();
  const [isDragging, setIsDragging] = useState(false);

  const getPriorityProps = (p: BoardTaskPriority) => {
    switch (p) {
      case "urgent":
        return { color: "red", label: `★★★★ ${t("priorityUrgent")}` };
      case "high":
        return { color: "orange", label: `★★★ ${t("priorityHigh")}` };
      case "medium":
        return { color: "blue", label: `★★ ${t("priorityMedium")}` };
      case "low":
      default:
        return { color: "gray", label: `★ ${t("priorityLow")}` };
    }
  };

  const priority = getPriorityProps(task.priority);

  return (
    <div
      draggable
      onDragStart={(e) => {
        setIsDragging(true);
        onDragStart(e, task.id);
      }}
      onDragEnd={() => setIsDragging(false)}
      style={{
        opacity: isDragging ? 0.4 : 1,
        transition: "opacity 0.15s ease, transform 0.15s ease",
        cursor: "grab",
      }}
    >
      <AppCard
        p="sm"
        radius="md"
        hoverable
        onClick={onClick}
        style={{
          border: "1px solid var(--app-border-subtle)",
          background: "var(--app-bg-surface)",
          boxShadow: "var(--app-shadow-card)",
          userSelect: "none",
        }}
      >
        <AppStack gap={8}>
          {/* Top meta row */}
          <AppGroup justify="space-between" align="center" wrap="nowrap">
            <AppGroup gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
              <AppMono size="xs" fw={700} c="var(--app-brand-primary)">
                #{task.task_number}
              </AppMono>
              <AppBadge
                size="xs"
                variant="light"
                color="gray"
                style={{
                  maxWidth: 150,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {task.project_name}
              </AppBadge>
            </AppGroup>

            <AppBadge size="xs" color={priority.color} variant="light">
              {priority.label}
            </AppBadge>
          </AppGroup>

          {/* Title */}
          <AppText
            fz="sm"
            fw={600}
            c="var(--app-text-primary)"
            style={{
              lineHeight: 1.35,
              wordBreak: "break-word",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {task.title}
          </AppText>

          {/* Description snippet if any */}
          {task.description && (
            <AppText
              fz="xs"
              c="var(--app-text-secondary)"
              style={{
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                lineHeight: 1.35,
              }}
            >
              {task.description}
            </AppText>
          )}

          {/* Bottom row: Assignee Stack & Comments */}
          <AppGroup justify="space-between" align="center" pt={4} wrap="nowrap">
            {/* Assignees Avatar Stack */}
            <AppGroup gap={0} wrap="nowrap" style={{ display: "flex", alignItems: "center" }}>
              {task.assignees && task.assignees.length > 0 ? (
                task.assignees.slice(0, 3).map((assignee, idx) => (
                  <AppTooltip
                    key={assignee.id}
                    label={`${assignee.displayName}${assignee.jobTitle ? ` (${assignee.jobTitle})` : ""}`}
                    withArrow
                  >
                    <div
                      style={{
                        marginLeft: idx > 0 ? -8 : 0,
                        zIndex: 10 - idx,
                        borderRadius: "50%",
                        border: "2px solid var(--app-bg-surface)",
                      }}
                    >
                      <AppAvatar
                        src={assignee.avatarUrl}
                        alt={assignee.displayName}
                        size={24}
                        radius="xl"
                        color="lucesem"
                        style={{ fontSize: 10, fontWeight: 700 }}
                      >
                        {assignee.displayName.slice(0, 2).toUpperCase()}
                      </AppAvatar>
                    </div>
                  </AppTooltip>
                ))
              ) : (
                <AppText fz={11} c="var(--app-text-secondary)">
                  —
                </AppText>
              )}
              {task.assignees && task.assignees.length > 3 && (
                <AppBadge
                  size="xs"
                  variant="outline"
                  color="gray"
                  style={{ marginLeft: -4, zIndex: 5, padding: "0 4px", height: 18 }}
                >
                  +{task.assignees.length - 3}
                </AppBadge>
              )}
            </AppGroup>

            {/* Meta indicators: Logged Hours & Comment count */}
            <AppGroup gap={8} wrap="nowrap" align="center">
              {task.logged_hours > 0 && (
                <AppTooltip label={`${t("loggedTime")}: ${task.logged_hours}h`} withArrow>
                  <AppGroup
                    gap={3}
                    wrap="nowrap"
                    align="center"
                    style={{
                      background:
                        "color-mix(in srgb, var(--app-brand-primary) 10%, var(--app-bg-surface))",
                      padding: "2px 6px",
                      borderRadius: "var(--app-radius-sm)",
                    }}
                  >
                    <Clock size={13} weight="bold" color="var(--app-brand-primary)" />
                    <AppMono size="xs" c="var(--app-brand-primary)" fw={700}>
                      {task.logged_hours}h
                    </AppMono>
                  </AppGroup>
                </AppTooltip>
              )}

              {task.comment_count > 0 && (
                <AppGroup gap={4} wrap="nowrap" align="center">
                  <ChatCircle size={14} weight="fill" color="var(--app-text-secondary)" />
                  <AppMono size="xs" c="var(--app-text-secondary)" fw={600}>
                    {task.comment_count}
                  </AppMono>
                </AppGroup>
              )}
            </AppGroup>
          </AppGroup>
        </AppStack>
      </AppCard>
    </div>
  );
}
