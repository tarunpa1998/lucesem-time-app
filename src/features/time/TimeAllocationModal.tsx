import { useEffect, useState } from "react";
import {
  AppModal,
  AppSelect,
  AppTextarea,
  AppTimePicker,
  AppDateInput,
  AppButton,
  AppGroup,
  AppStack,
  AppGrid,
  AppText,
  AppBadge,
  AppTextInput,
  AppTabs,
  AppFolderTabs,
  AppConfirmModal,
} from "@/components/core";
import { Trash, CalendarBlank, Clock, Plus } from "@phosphor-icons/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useI18n } from "@/lib/i18n";
import { myAccessQuery, activitiesQuery } from "@/lib/session";
import { requestUnlock } from "@/backend/workflow.functions";
import { isPeriodLocked } from "@/domain/locks";
import { notify } from "@/components/core";
import { ymd } from "@/domain/holidays";
import {
  ENTRY_MODES,
  isAbsenceMode,
  validateEntry,
  canEditDate,
  toMinutes,
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

function getWorkingDaysInRange(fromStr: string, toStr: string): string[] {
  if (!fromStr || !toStr || fromStr > toStr) return [];
  const days: string[] = [];
  const [y1, m1, d1] = fromStr.split("-").map(Number);
  const [y2, m2, d2] = toStr.split("-").map(Number);
  if (!y1 || !m1 || !d1 || !y2 || !m2 || !d2) return [];
  const curr = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  while (curr <= end) {
    days.push(ymd(curr));
    curr.setDate(curr.getDate() + 1);
  }
  return days;
}

interface Props {
  date: string | null;
  /** When set, the modal edits this existing entry instead of creating a new one. */
  entry?: LocalEntry | null;
  today: string;
  existing: LocalEntry[];
  projects: ProjectRow[];
  isAdmin: boolean;
  userId: string;
  readOnly?: boolean;
  onClose: () => void;
  onSave: (e: Omit<LocalEntry, "id" | "createdAt" | "status"> & { id?: string }) => Promise<void>;
  onSaveMultiple?: (
    entries: Array<Omit<LocalEntry, "id" | "createdAt" | "status"> & { id?: string }>,
  ) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

export function TimeAllocationModal({
  date,
  entry,
  today,
  existing,
  projects,
  isAdmin,
  userId,
  readOnly = false,
  onClose,
  onSave,
  onSaveMultiple,
  onDelete,
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
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  const [startDate, setStartDate] = useState(date ?? today);
  const [endDate, setEndDate] = useState(date ?? today);

  const dayEntries = date ? existing.filter((e) => e.entryDate === date) : [];
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);

  const isAbsence = isAbsenceMode(mode);

  const activeEntry =
    selectedEntryId && selectedEntryId !== "new"
      ? (dayEntries.find((e) => e.id === selectedEntryId) ?? entry ?? null)
      : null;

  const dayAbsence = dayEntries.find((e) => isAbsenceMode(e.entryMode));
  const isDayBookedAsAbsence = !!dayAbsence;
  const isEditingExistingAbsence = activeEntry && isAbsenceMode(activeEntry.entryMode);
  const isConflictBlocked = isDayBookedAsAbsence && !isEditingExistingAbsence && !isAbsence;

  const rangeWorkDays = isAbsence ? getWorkingDaysInRange(startDate, endDate) : [];

  useEffect(() => {
    setErrors([]);
    setNotes("");
    setReason("");
    setConfirmDelete(false);
    const initialDate = entry?.entryDate ?? date ?? today;
    setStartDate(initialDate);
    setEndDate(initialDate);

    if (entry) {
      setSelectedEntryId(entry.id);
      setMode(entry.entryMode);
      setFrom(entry.fromTime);
      setTo(entry.toTime);
      setProjectId(entry.projectId ?? null);
      setNotes(entry.workNotes);
      setActivityId(entry.activityId ?? null);
      return;
    }
    const forDay = date ? existing.filter((e) => e.entryDate === date) : [];
    const first = forDay[0];
    if (first) {
      setSelectedEntryId(first.id);
      setMode(first.entryMode);
      setFrom(first.fromTime);
      setTo(first.toTime);
      setProjectId(first.projectId ?? null);
      setNotes(first.workNotes);
      setActivityId(first.activityId ?? null);
      return;
    }
    setSelectedEntryId(null);
    setMode("CustomHours");
    setFrom(nowHHMM());
    setTo("");
    setProjectId(null);
    setActivityId(null);
  }, [date, entry, existing, today]);

  if (!date) return null;
  const isFuture = date > today;
  const maxTime = date === today && !isAbsence ? nowHHMM() : undefined;
  const unlocked = !!access?.unlocked.includes(date);
  const periodLocked = !isAdmin && isPeriodLocked(date, userId, access?.locks ?? []);
  // Existing leaves can always be edited or rescheduled regardless of approval state
  const canEdit =
    isEditingExistingAbsence ||
    ((activeEntry ? true : !isFuture) &&
      (canEditDate(date, today, { isAdmin, unlocked, isAbsence }) || (isAbsence && date >= today)));
  const editable = !periodLocked && canEdit;

  const sendUnlock = async () => {
    await requestUnlock({ data: { date, reason } });
    notify.show({ color: "lucesem", message: t("requestSent") });
    qc.invalidateQueries({ queryKey: ["my-access"] });
    onClose();
  };
  const pending =
    projectId &&
    projects.find((p) => p.id === projectId)?.approval_state === "Pending_Admin_Review";

  const handleSelectEntry = (id: string) => {
    setSelectedEntryId(id);
    setErrors([]);
    if (id === "new") {
      setMode("CustomHours");
      setFrom(nowHHMM());
      setTo("");
      setProjectId(null);
      setActivityId(null);
      setNotes("");
      const initialDate = date ?? today;
      setStartDate(initialDate);
      setEndDate(initialDate);
    } else {
      const target = dayEntries.find((e) => e.id === id);
      if (target) {
        setMode(target.entryMode);
        setFrom(target.fromTime);
        setTo(target.toTime);
        setProjectId(target.projectId ?? null);
        setNotes(target.workNotes);
        setActivityId(target.activityId ?? null);
        setStartDate(target.entryDate);
        setEndDate(target.entryDate);
      }
    }
  };

  const pickMode = (m: EntryMode) => {
    setMode(m);
    const p = PRESETS[m];
    if (isAbsenceMode(m)) {
      setFrom("08:00");
      setTo("16:00");
      setProjectId(null);
      setActivityId(null);
      if (!notes || notes.trim() === "") {
        setNotes(t(m));
      }
    } else if (p) {
      if (!(date === today && p[1] > nowHHMM())) {
        setFrom(p[0]);
        setTo(p[1]);
      }
    }
  };

  const getNotesPlaceholder = () => {
    if (mode === "Vacation_Urlaub") return t("vacationPlaceholder");
    if (mode === "SickLeave_Krankenstand") return t("sickPlaceholder");
    if (mode === "Compensatory_Zeitausgleich") return t("compPlaceholder");
    return t("whatWorking");
  };

  const handleDelete = () => {
    if (!activeEntry?.id || !onDelete) return;
    setConfirmDelete(true);
  };

  const handleDeleteConfirm = async () => {
    if (!activeEntry?.id || !onDelete) return;
    try {
      setDeleting(true);
      await onDelete(activeEntry.id);
      setConfirmDelete(false);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const submit = async () => {
    if (isConflictBlocked) {
      setErrors(["dayHasAbsence"]);
      return;
    }

    try {
      setSaving(true);
      if (isAbsence && startDate && endDate) {
        const workingDays = getWorkingDaysInRange(startDate, endDate);
        if (workingDays.length === 0) {
          setErrors(["date"]);
          return;
        }
        if (workingDays.length === 1) {
          const draft = {
            ...(activeEntry ? { id: activeEntry.id } : {}),
            entryDate: workingDays[0]!,
            fromTime: "08:00",
            toTime: "16:00",
            projectId: null,
            workNotes: notes.trim() || t(mode),
            entryMode: mode,
            activityId: null,
          };
          const errs = validateEntry(draft, existing, today, {
            isAdmin: true,
            unlocked: true,
            nowTime: nowHHMM(),
          });
          if (errs.length) {
            setErrors(errs);
            return;
          }
          await onSave(draft);
          onClose();
          return;
        } else {
          const drafts = workingDays.map((d, idx) => ({
            ...(activeEntry && idx === 0 ? { id: activeEntry.id } : {}),
            entryDate: d,
            fromTime: "08:00",
            toTime: "16:00",
            projectId: null,
            workNotes: notes.trim() || t(mode),
            entryMode: mode,
            activityId: null,
          }));
          for (const draft of drafts) {
            const errs = validateEntry(draft, existing, today, {
              isAdmin: true,
              unlocked: true,
              nowTime: nowHHMM(),
            });
            if (errs.length) {
              setErrors(errs);
              return;
            }
          }
          if (onSaveMultiple) {
            await onSaveMultiple(drafts);
          } else {
            for (const draft of drafts) {
              await onSave(draft);
            }
          }
          onClose();
          return;
        }
      }

      const targetDate = isAbsence ? startDate : date;
      const targetFrom = isAbsence ? "08:00" : from;
      const targetTo = isAbsence ? "16:00" : to;

      const draft = {
        ...(activeEntry ? { id: activeEntry.id } : {}),
        entryDate: targetDate,
        fromTime: targetFrom,
        toTime: targetTo,
        projectId: isAbsence ? null : (projectId ?? ""),
        workNotes: notes.trim() || (isAbsence ? t(mode) : ""),
        entryMode: mode,
        activityId: isAbsence ? null : activityId,
      };
      const errs = validateEntry(draft, existing, today, { isAdmin, unlocked, nowTime: nowHHMM() });
      setErrors(errs);
      if (errs.length) return;
      await onSave(draft);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const err = (k: ValidationError) => (errors.includes(k) ? t(`err.${k}` as const) : undefined);

  const isReadOnly = Boolean(
    readOnly || (!isAdmin && !editable) || (activeEntry && !isAdmin && activeEntry.exported),
  );

  const matchedProject = projects.find((p) => p.id === projectId);
  const matchedActivity = activities.find((a) => a.id === activityId);
  const entryHours =
    from && to ? (Math.max(0, toMinutes(to) - toMinutes(from)) / 60).toFixed(2) : "0.00";

  return (
    <AppModal
      opened={!!date}
      onClose={onClose}
      title={
        isReadOnly && activeEntry
          ? `${t("entryDetails")} · ${fmtDate(date)}`
          : `${activeEntry ? t("edit") : t("allocate")} · ${fmtDate(date)}`
      }
    >
      {!editable && !activeEntry ? (
        <AppStack>
          <AppText c="var(--app-text-secondary)">
            {periodLocked ? t("periodLocked") : isFuture ? t("futureLocked") : t("retroLocked")}
          </AppText>
          {!periodLocked && !isFuture && (
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
      ) : isReadOnly && activeEntry ? (
        <AppStack gap="md">
          {dayEntries.length > 1 && (
            <AppFolderTabs
              value={selectedEntryId ?? activeEntry.id}
              onChange={handleSelectEntry}
              style={{ marginBottom: 0 }}
              items={dayEntries.map((e) => ({
                value: e.id,
                label: isAbsenceMode(e.entryMode) ? t(e.entryMode) : `${e.fromTime}–${e.toTime}`,
                icon: isAbsenceMode(e.entryMode) ? (
                  <CalendarBlank size={14} weight="duotone" />
                ) : (
                  <Clock size={14} weight="duotone" />
                ),
              }))}
            />
          )}

          {/* Details in Read-only view */}
          {isAbsence ? (
            <AppGrid cols={{ base: 1, sm: 2 }}>
              <AppDateInput label={t("fromDate")} value={startDate} disabled />
              <AppDateInput label={t("toDate")} value={endDate} disabled />
            </AppGrid>
          ) : (
            <>
              <AppGrid cols={{ base: 1, sm: 2 }}>
                <AppDateInput label={t("date")} value={date} disabled />
                <AppTextInput
                  label={t("time")}
                  value={`${from}–${to} (${entryHours} ${t("hours")})`}
                  disabled
                />
              </AppGrid>

              <AppGrid cols={{ base: 1, sm: 2 }}>
                <AppTextInput
                  label={t("project")}
                  value={
                    matchedProject
                      ? `${matchedProject.name} — ${matchedProject.customer_name}`
                      : "—"
                  }
                  disabled
                />
                {activityId && (
                  <AppTextInput
                    label={t("activity")}
                    value={matchedActivity?.name ?? "—"}
                    disabled
                  />
                )}
              </AppGrid>
            </>
          )}

          <AppTextarea
            label={isAbsence ? t("absenceReason") : t("notes")}
            value={notes || "—"}
            disabled
            minRows={2}
          />

          {/* Unlock Request option for locked entries / 3 days old entries */}
          {!isAdmin && !unlocked && (
            <AppStack gap="xs" mt="sm">
              <AppText c="var(--app-text-secondary)" fz="sm">
                {periodLocked ? t("periodLocked") : isFuture ? t("futureLocked") : t("retroLocked")}
              </AppText>
              {!periodLocked && !isFuture && (
                <>
                  <AppTextarea
                    label={t("reason")}
                    placeholder={t("reasonPlaceholder")}
                    value={reason}
                    onChange={(e) => setReason(e.currentTarget.value)}
                  />
                  <AppButton
                    variant="light"
                    disabled={reason.trim().length < 5}
                    onClick={sendUnlock}
                  >
                    {t("requestUnlock")}
                  </AppButton>
                </>
              )}
            </AppStack>
          )}

          <AppGroup justify="flex-end" mt="xs">
            <AppButton variant="default" onClick={onClose}>
              {t("close")}
            </AppButton>
          </AppGroup>
        </AppStack>
      ) : (
        <AppStack gap="md">
          {dayEntries.length > 0 && (
            <AppFolderTabs
              value={selectedEntryId ?? "new"}
              onChange={handleSelectEntry}
              style={{ marginBottom: 0 }}
              items={[
                ...dayEntries.map((e) => ({
                  value: e.id,
                  label: isAbsenceMode(e.entryMode) ? t(e.entryMode) : `${e.fromTime}–${e.toTime}`,
                  icon: isAbsenceMode(e.entryMode) ? (
                    <CalendarBlank size={14} weight="duotone" />
                  ) : (
                    <Clock size={14} weight="duotone" />
                  ),
                })),
                ...(!dayAbsence
                  ? [
                      {
                        value: "new",
                        label: t("newItem"),
                        icon: <Plus size={14} weight="bold" />,
                        isAdd: true,
                      },
                    ]
                  : []),
              ]}
            />
          )}

          {isConflictBlocked && (
            <AppGroup
              gap="xs"
              p="xs"
              style={{
                background: "color-mix(in srgb, var(--app-danger) 10%, var(--app-bg-surface))",
                borderRadius: "var(--app-radius-md)",
                border: "1px solid color-mix(in srgb, var(--app-danger) 25%, transparent)",
              }}
            >
              <AppBadge color="red" size="sm">
                {t(dayAbsence.entryMode)}
              </AppBadge>
              <AppText fz="xs" c="var(--app-text-secondary)" style={{ flex: 1 }}>
                {t("dayBookedAsAbsence")} {t("noOtherEntriesAllowed")}
              </AppText>
            </AppGroup>
          )}

          <AppSelect
            label={t("mode")}
            placeholder={t("selectMode")}
            value={mode}
            onChange={(v) => v && pickMode(v as EntryMode)}
            data={(isFuture ? ENTRY_MODES.filter(isAbsenceMode) : ENTRY_MODES).map((m) => ({
              value: m,
              label: t(m),
            }))}
            allowDeselect={false}
          />

          {isAbsence ? (
            <AppGroup
              gap="xs"
              p="xs"
              style={{
                background:
                  "color-mix(in srgb, var(--app-brand-primary) 8%, var(--app-bg-surface))",
                borderRadius: "var(--app-radius-md)",
                border: "1px solid color-mix(in srgb, var(--app-brand-primary) 20%, transparent)",
              }}
            >
              <AppBadge color="blue" size="sm">
                {t(mode)}
              </AppBadge>
              <AppText fz="xs" c="var(--app-text-secondary)" style={{ flex: 1 }}>
                {t("absenceNotice")}
              </AppText>
            </AppGroup>
          ) : (
            <>
              <AppSelect
                label={t("project")}
                placeholder={t("selectProject")}
                required
                value={projectId}
                onChange={setProjectId}
                error={err("project")}
                data={projects.map((p) => ({
                  value: p.id,
                  label: `${p.name} — ${p.customer_name}`,
                }))}
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
            </>
          )}

          {isAbsence ? (
            <>
              <AppGrid cols={{ base: 1, sm: 2 }}>
                <AppDateInput
                  label={t("fromDate")}
                  placeholder={t("selectDate")}
                  value={startDate}
                  onChange={(v) => {
                    setStartDate(v);
                    if (!endDate || (v && v > endDate)) setEndDate(v);
                  }}
                  required
                />
                <AppDateInput
                  label={t("toDate")}
                  placeholder={t("selectDate")}
                  value={endDate}
                  onChange={(v) => setEndDate(v)}
                  minDate={startDate || undefined}
                  required
                />
              </AppGrid>

              <AppGroup
                justify="space-between"
                align="center"
                px="sm"
                py={10}
                style={{
                  background:
                    "color-mix(in srgb, var(--app-brand-primary) 8%, var(--app-bg-surface))",
                  borderRadius: "var(--app-radius-md)",
                  border: "1px solid color-mix(in srgb, var(--app-brand-primary) 18%, transparent)",
                }}
              >
                <AppGroup gap={8} align="center">
                  <CalendarBlank size={16} weight="duotone" color="var(--app-brand-primary)" />
                  <AppText fz="xs" fw={600} c="var(--app-brand-primary)">
                    {rangeWorkDays.length <= 1
                      ? `1 ${t("workDayCount")} (08:00–16:00 · 8 ${t("hours")})`
                      : `${rangeWorkDays.length} ${t("workDaysCount")} (08:00–16:00 · ${rangeWorkDays.length * 8} ${t("hours")})`}
                  </AppText>
                </AppGroup>
                <AppBadge size="sm" color="blue" variant="light">
                  {t(mode)}
                </AppBadge>
              </AppGroup>
            </>
          ) : (
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
          )}

          <AppTextarea
            label={isAbsence ? t("absenceReason") : t("notes")}
            placeholder={getNotesPlaceholder()}
            required
            value={notes}
            onChange={(e) => setNotes(e.currentTarget.value)}
            error={err("notes")}
          />

          {errors.includes("dayHasAbsence") && (
            <AppText fz="xs" c="red" fw={500}>
              {t("err.dayHasAbsence")}
            </AppText>
          )}
          {errors.includes("dayHasWork") && (
            <AppText fz="xs" c="red" fw={500}>
              {t("err.dayHasWork")}
            </AppText>
          )}

          <AppGroup justify="space-between" mt="xs">
            {editable && activeEntry?.id && onDelete ? (
              <AppButton
                color="red"
                variant="light"
                leftSection={<Trash size={16} />}
                onClick={handleDelete}
                loading={deleting}
                disabled={saving || deleting}
              >
                {t("delete")}
              </AppButton>
            ) : (
              <div />
            )}
            <AppGroup gap="xs">
              <AppButton variant="default" onClick={onClose} disabled={saving || deleting}>
                {t("cancel")}
              </AppButton>
              <AppButton
                onClick={submit}
                disabled={isConflictBlocked || saving || deleting}
                loading={saving}
              >
                {t("save")}
              </AppButton>
            </AppGroup>
          </AppGroup>
        </AppStack>
      )}

      <AppConfirmModal
        opened={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDeleteConfirm}
        loading={deleting}
      />
    </AppModal>
  );
}
