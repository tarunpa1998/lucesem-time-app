import { useState, useEffect } from "react";
import {
  AppModal,
  AppStack,
  AppGroup,
  AppTextInput,
  AppTextarea,
  AppSelect,
  AppMultiSelect,
  AppButton,
  notify,
} from "@/components/core";
import { useI18n } from "@/lib/i18n";
import { createBoardTask } from "@/backend/board.functions";
import type {
  BoardTaskStatus,
  BoardTaskPriority,
  BoardTaskAssignee,
  ProjectRow,
} from "@/backend/types";

interface TaskFormModalProps {
  opened: boolean;
  onClose: () => void;
  initialStatus?: BoardTaskStatus;
  projects: ProjectRow[];
  users: BoardTaskAssignee[];
  onSuccess: () => void;
}

export function TaskFormModal({
  opened,
  onClose,
  initialStatus = "pending",
  projects,
  users,
  onSuccess,
}: TaskFormModalProps) {
  const { t } = useI18n();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [priority, setPriority] = useState<BoardTaskPriority>("medium");
  const [status, setStatus] = useState<BoardTaskStatus>(initialStatus);
  const [assigneeIds, setAssigneeIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (opened) {
      setTitle("");
      setDescription("");
      setStatus(initialStatus);
      setPriority("medium");
      setAssigneeIds([]);
      setProjectId((prev) => prev ?? projects[0]?.id ?? null);
    }
  }, [opened, initialStatus, projects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      notify.error(t("taskTitle"));
      return;
    }
    if (!projectId) {
      notify.error(t("selectProject"));
      return;
    }

    setSubmitting(true);
    try {
      await createBoardTask({
        data: {
          title: title.trim(),
          description: description.trim(),
          projectId,
          priority,
          status,
          assigneeIds,
        },
      });
      notify.success(t("taskCreatedSuccess"));
      onSuccess();
      onClose();
    } catch (err: unknown) {
      notify.error(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSubmitting(false);
    }
  };

  const projectOptions = projects.map((p) => ({
    value: p.id,
    label: `${p.customer_name} · ${p.name}`,
  }));

  const userOptions = users.map((u) => ({
    value: u.id,
    label: `${u.displayName}${u.jobTitle ? ` (${u.jobTitle})` : ""}`,
  }));

  const priorityOptions = [
    { value: "low", label: `★ ${t("priorityLow")}` },
    { value: "medium", label: `★★ ${t("priorityMedium")}` },
    { value: "high", label: `★★★ ${t("priorityHigh")}` },
    { value: "urgent", label: `★★★★ ${t("priorityUrgent")}` },
  ];

  const statusOptions = [
    { value: "pending", label: t("pending") },
    { value: "in_progress", label: t("inProgress") },
    { value: "closed", label: t("closed") },
  ];

  return (
    <AppModal opened={opened} onClose={onClose} title={t("newTask")} size="lg">
      <form onSubmit={handleSubmit}>
        <AppStack gap="md">
          <AppTextInput
            label={t("taskTitle")}
            placeholder={t("taskTitlePlaceholder")}
            value={title}
            onChange={(e) => setTitle(e.currentTarget.value)}
            required
            autoFocus
          />

          <AppTextarea
            label={t("taskDescription")}
            placeholder={t("taskDescriptionPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.currentTarget.value)}
            minRows={3}
            maxRows={6}
          />

          <AppSelect
            label={t("projects")}
            placeholder={t("selectProject")}
            data={projectOptions}
            value={projectId}
            onChange={setProjectId}
            required
            searchable
          />

          <AppGroup grow>
            <AppSelect
              label={t("priority")}
              data={priorityOptions}
              value={priority}
              onChange={(v) => setPriority((v as BoardTaskPriority) || "medium")}
            />

            <AppSelect
              label={t("statusSort")}
              data={statusOptions}
              value={status}
              onChange={(v) => setStatus((v as BoardTaskStatus) || "pending")}
            />
          </AppGroup>

          <AppMultiSelect
            label={t("assignees")}
            placeholder={t("selectAssignees")}
            data={userOptions}
            value={assigneeIds}
            onChange={setAssigneeIds}
            searchable
            clearable
          />

          <AppGroup justify="flex-end" pt="sm">
            <AppButton variant="subtle" color="gray" onClick={onClose} disabled={submitting}>
              {t("cancel")}
            </AppButton>
            <AppButton type="submit" loading={submitting}>
              {t("createTask")}
            </AppButton>
          </AppGroup>
        </AppStack>
      </form>
    </AppModal>
  );
}
