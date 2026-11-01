import { useEffect, useState } from "react";
import {
  AppModal,
  AppStack,
  AppGroup,
  AppButton,
  AppSelect,
  AppTextInput,
  AppDateInput,
  AppTextarea,
  AppTimePicker,
  AppGrid,
  AppAlert,
  AppBadge,
  AppText,
  notify,
} from "@/components/core";
import { useI18n } from "@/lib/i18n";
import { isAbsenceMode, type EntryMode } from "@/domain/rules";
import type { ProjectRow } from "@/lib/session";
import { adminSaveEntry, adminDeleteEntry, type ReportRow } from "@/backend/workflow.functions";

/** Admin-only: edit or delete any user's entry, including locked/exported ones. */
export function AdminEntryModal({
  row,
  projects,
  onClose,
  onSaved,
}: {
  row: ReportRow | null;
  projects: ProjectRow[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [f, setF] = useState<ReportRow | null>(row);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setF(row);
    setError(null);
  }, [row]);
  if (!f) return null;

  const isAbsence = isAbsenceMode(f.entry_mode as EntryMode);

  const save = async () => {
    try {
      await adminSaveEntry({
        data: {
          id: f.id,
          entryDate: f.entry_date,
          fromTime: f.from_time,
          toTime: f.to_time,
          projectId: isAbsence ? null : f.project_id,
          workNotes: f.work_notes,
          status: f.status as "pending" | "approved" | "rejected",
        },
      });
      notify.show({ color: "lucesem", message: "@entryUpdated" });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    }
  };
  const remove = async () => {
    if (!window.confirm(t("deleteConfirm"))) return;
    await adminDeleteEntry({ data: { id: f.id } });
    notify.show({ color: "lucesem", message: "@entryDeleted" });
    onSaved();
    onClose();
  };

  return (
    <AppModal opened={!!row} onClose={onClose} title={`${t("edit")} · ${f.user_name}`}>
      <AppStack>
        {error && <AppAlert color="red">{error}</AppAlert>}
        <AppDateInput
          label={t("date")}
          placeholder="DD.MM.YYYY"
          value={f.entry_date}
          onChange={(val) => setF({ ...f, entry_date: val })}
        />
        {isAbsence ? (
          <AppStack gap={4}>
            <AppText fz="xs" fw={500} c="var(--app-text-secondary)">
              {t("mode")}
            </AppText>
            <AppBadge color="blue" size="md">
              {t(f.entry_mode as EntryMode)}
            </AppBadge>
          </AppStack>
        ) : (
          <AppSelect
            label={t("project")}
            placeholder={t("selectProject")}
            value={f.project_id}
            allowDeselect={false}
            onChange={(v) => v && setF({ ...f, project_id: v })}
            data={projects.map((p) => ({ value: p.id, label: `${p.name} — ${p.customer_name}` }))}
          />
        )}
        <AppGrid cols={{ base: 2 }}>
          <AppTimePicker
            label={t("from")}
            value={f.from_time}
            onChange={(v) => setF({ ...f, from_time: v })}
          />
          <AppTimePicker
            label={t("to")}
            value={f.to_time}
            onChange={(v) => setF({ ...f, to_time: v })}
            error={f.to_time <= f.from_time ? t("err.toBeforeFrom") : undefined}
          />
        </AppGrid>
        <AppSelect
          label={t("status")}
          placeholder={t("selectStatus")}
          value={f.status}
          allowDeselect={false}
          onChange={(v) => v && setF({ ...f, status: v })}
          data={[
            { value: "approved", label: t("approved") },
            { value: "pending", label: t("pendingApproval") },
            { value: "rejected", label: t("reject") },
          ]}
        />
        <AppTextarea
          label={t("notes")}
          placeholder={t("whatWorking")}
          value={f.work_notes}
          onChange={(e) => setF({ ...f, work_notes: e.currentTarget.value })}
        />
        <AppGroup justify="space-between">
          <AppButton color="red" variant="light" onClick={remove}>
            {t("remove")}
          </AppButton>
          <AppGroup gap="xs">
            <AppButton variant="default" onClick={onClose}>
              {t("cancel")}
            </AppButton>
            <AppButton disabled={f.to_time <= f.from_time} onClick={save}>
              {t("save")}
            </AppButton>
          </AppGroup>
        </AppGroup>
      </AppStack>
    </AppModal>
  );
}
