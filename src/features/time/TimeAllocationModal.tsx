import { useEffect, useState } from "react";
import {
  AppModal,
  AppSelect,
  AppTextarea,
  AppTimePicker,
  AppButton,
  AppGroup,
  AppStack,
  AppGrid,
  AppText,
  AppBadge,
} from "@/components/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { myAccessQuery, activitiesQuery } from "@/lib/session";
import { requestUnlock } from "@/backend/workflow.functions";
import { isPeriodLocked } from "@/domain/locks";
import { notify } from "@/components/core";
import {
  ENTRY_MODES,
  validateEntry,
  canEditDate,
  type EntryMode,
  type ValidationError,
} from "@/domain/rules";
import type { ProjectRow } from "@/lib/session";
import type { LocalEntry } from "@/lib/offline-db";

const nowHHMM = () => {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const PRESETS: Partial<Record<EntryMode, [string, string]>> = {
  RegularWork: ["08:00", "17:00"],
  HalfDay: ["08:00", "12:00"],
  Vacation_Urlaub: ["08:00", "16:00"],
  SickLeave_Krankenstand: ["08:00", "16:00"],
  Compensatory_Zeitausgleich: ["08:00", "16:00"],
};

interface Props {
  date: string | null;
  /** When set, the modal edits this existing entry instead of creating a new one. */
  entry?: LocalEntry | null;
  today: string;
  existing: LocalEntry[];
  projects: ProjectRow[];
  isAdmin: boolean;
  userId: string;
  onClose: () => void;
  onSave: (e: Omit<LocalEntry, "id" | "createdAt" | "status"> & { id?: string }) => Promise<void>;
}

export function TimeAllocationModal({
  date,
  entry,
  today,
  existing,
  projects,
  isAdmin,
  userId,
  onClose,
  onSave,
}: Props) {
  const qc = useQueryClient();
  const { data: access } = useQuery(myAccessQuery);
  const [reason, setReason] = useState("");
  const { data: activities = [] } = useQuery(activitiesQuery);
  const [activityId, setActivityId] = useState<string | null>(null);
  const { t, fmtDate } = useI18n();
  const [mode, setMode] = useState<EntryMode>("CustomHours");
  const [from, setFrom] = useState("08:00");
  const [to, setTo] = useState("12:00");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<ValidationError[]>([]);

  useEffect(() => {
    setErrors([]);
    setNotes("");
    setReason("");
    if (entry) {
      setMode(entry.entryMode);
      setFrom(entry.fromTime);
      setTo(entry.toTime);
      setProjectId(entry.projectId);
      setNotes(entry.workNotes);
      setActivityId(entry.activityId ?? null);
      return;
    }
    setMode("CustomHours");
    setFrom(nowHHMM());
    setTo("");
  }, [date, entry]);

  if (!date) return null;
  const maxTime = date === today ? nowHHMM() : undefined;
  const unlocked = !!access?.unlocked.includes(date);
  const periodLocked = !isAdmin && isPeriodLocked(date, userId, access?.locks ?? []);
  const editable =
    date <= today && !periodLocked && canEditDate(date, today, { isAdmin, unlocked });
  const sendUnlock = async () => {
    await requestUnlock({ data: { date, reason } });
    notify.show({ color: "lucesem", message: t("requestSent") });
    qc.invalidateQueries({ queryKey: ["my-access"] });
    onClose();
  };
  const pending =
    projects.find((p) => p.id === projectId)?.approval_state === "Pending_Admin_Review";

  const pickMode = (m: EntryMode) => {
    setMode(m);
    const p = PRESETS[m];
    if (p && !(date === today && p[1] > nowHHMM())) {
      setFrom(p[0]);
      setTo(p[1]);
    }
  };

  const submit = async () => {
    const draft = {
      ...(entry ? { id: entry.id } : {}),
      entryDate: date,
      fromTime: from,
      toTime: to,
      projectId: projectId ?? "",
      workNotes: notes,
      entryMode: mode,
      activityId,
    };
    const errs = validateEntry(draft, existing, today, { isAdmin, unlocked, nowTime: nowHHMM() });
    setErrors(errs);
    if (errs.length) return;
    await onSave(draft);
    onClose();
  };

  const err = (k: ValidationError) => (errors.includes(k) ? t(`err.${k}` as const) : undefined);

  return (
    <AppModal opened={!!date} onClose={onClose} title={`${t("allocate")} · ${fmtDate(date)}`}>
      {!editable ? (
        <AppStack>
          <AppText c="var(--app-text-secondary)">
            {periodLocked ? t("periodLocked") : t("retroLocked")}
          </AppText>
          {!periodLocked && (
            <>
              <AppTextarea
                label={t("reason")}
                placeholder={t("reasonPlaceholder")}
                value={reason}
                onChange={(e) => setReason(e.currentTarget.value)}
              />
              <AppButton variant="light" disabled={reason.trim().length < 5} onClick={sendUnlock}>
                {t("requestUnlock")}
              </AppButton>
            </>
          )}
        </AppStack>
      ) : (
        <AppStack>
          <AppSelect
            label={t("mode")}
            placeholder={t("selectMode")}
            value={mode}
            onChange={(v) => v && pickMode(v as EntryMode)}
            data={ENTRY_MODES.map((m) => ({ value: m, label: t(m) }))}
            allowDeselect={false}
          />
          <AppSelect
            label={t("project")}
            placeholder={t("selectProject")}
            value={projectId}
            onChange={setProjectId}
            error={err("project")}
            data={projects.map((p) => ({ value: p.id, label: `${p.name} — ${p.customer_name}` }))}
          />
          <AppSelect
            label={t("activity")}
            placeholder={t("selectActivity")}
            clearable
            value={activityId}
            onChange={setActivityId}
            data={activities
              .filter((a) => a.is_active && (!a.project_id || a.project_id === projectId))
              .map((a) => ({ value: a.id, label: a.name }))}
          />
          {pending && <AppBadge color="orange">{t("pendingApproval")}</AppBadge>}
          <AppGrid cols={{ base: 2 }}>
            <AppTimePicker
              label={t("from")}
              value={from}
              onChange={setFrom}
              max={maxTime}
              error={err("time") ?? (maxTime && from > maxTime ? t("err.future") : undefined)}
            />
            <AppTimePicker
              label={t("to")}
              value={to}
              onChange={setTo}
              min={from || undefined}
              max={maxTime}
              error={
                (to && from && to <= from ? t("err.toBeforeFrom") : undefined) ??
                (to && maxTime && to > maxTime ? t("err.future") : undefined) ??
                err("toBeforeFrom") ??
                err("overlap") ??
                err("future")
              }
            />
          </AppGrid>
          <AppTextarea
            label={t("notes")}
            placeholder={t("whatWorking")}
            required
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
            error={err("notes")}
          />
          <AppGroup justify="flex-end">
            <AppButton variant="default" onClick={onClose}>
              {t("cancel")}
            </AppButton>
            <AppButton onClick={submit}>{t("save")}</AppButton>
          </AppGroup>
        </AppStack>
      )}
    </AppModal>
  );
}
