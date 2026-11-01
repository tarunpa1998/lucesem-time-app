import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { SquaresFour, Play, Stop, CloudSlash, PencilSimple } from "@phosphor-icons/react";
import {
  AppShellLayout,
  DashboardSkeleton,
  AppPageHeader,
  LOG_TIME_EVENT,
  LOG_TIME_FLAG,
  AppCard,
  AppGrid,
  AppHeading,
  AppMono,
  AppText,
  AppGroup,
  AppStack,
  AppButton,
  AppBadge,
  AppSelect,
  AppTextInput,
  AppCalendar,
  AppDataTable,
  AppProgress,
  AppSegmented,
  AppFolderTabs,
  formatDuration,
} from "@/components/core";
import { useI18n } from "@/lib/i18n";
import { austrianHolidays, ymd } from "@/domain/holidays";
import { canEditDate, periodRange, targetForRange, isAbsenceMode } from "@/domain/rules";
import { viennaToday, isPeriodLocked } from "@/domain/locks";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { meQuery, myProjectsQuery, myAccessQuery } from "@/lib/session";
import { useTimeData, entryHours } from "@/features/time/useTimeData";
import { TimeAllocationModal } from "@/features/time/TimeAllocationModal";
import type { LocalEntry } from "@/lib/offline-db";

type Period = "day" | "week" | "month" | "year";

export function Dashboard() {
  const { t, lang, fmtDate, fmtHours } = useI18n();
  const { data: me } = useSuspenseQuery(meQuery);
  const { data: projects } = useSuspenseQuery(myProjectsQuery);
  const { data: access } = useQuery(myAccessQuery);
  const contract = {
    weeklyTargetHours: me?.weeklyTargetHours ?? 0,
    workDays: me?.workDays ?? [1, 2, 3, 4, 5],
    includeCarinthia: me?.includeCarinthia ?? false,
    vacationDays: me?.vacationDaysPerYear ?? 0,
  };
  const data = useTimeData({
    userId: me?.id ?? "anon",
    requiresApproval: !!me?.requiresTimesheetApproval,
    isAdmin: !!me?.isAdmin,
    isPendingProject: (id) =>
      projects.find((p) => p.id === id)?.approval_state === "Pending_Admin_Review",
  });
  const [today, setToday] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [month, setMonth] = useState(() => new Date());
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<LocalEntry | null>(null);
  const [readOnlyEntry, setReadOnlyEntry] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [period, setPeriod] = useState<Period>("week");

  const DRAFT_NOTES_KEY = "lucesem_draft_notes";

  // Synchronize work notes from active timer on load or refresh
  useEffect(() => {
    if (data.timer) {
      setNotes(data.timer.workNotes ?? "");
    } else {
      const draft = sessionStorage.getItem(DRAFT_NOTES_KEY);
      if (draft) setNotes(draft);
    }
  }, [data.timer?.clientTimerId]);

  const handleNotesChange = (val: string) => {
    setNotes(val);
    if (data.timer) {
      data.updateTimerNotes(val);
    } else {
      sessionStorage.setItem(DRAFT_NOTES_KEY, val);
    }
  };

  useEffect(() => {
    setToday(viennaToday());
    setOnline(navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  const hoursByDate = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of data.entries) {
      if (e.status === "rejected") continue;
      if (["Vacation_Urlaub", "SickLeave_Krankenstand"].includes(e.entryMode)) continue;
      m.set(e.entryDate, (m.get(e.entryDate) ?? 0) + entryHours(e));
    }
    return m;
  }, [data.entries]);

  const holidays = useMemo(() => {
    const y = month.getFullYear();
    return new Map(
      austrianHolidays(y, contract.includeCarinthia).map((h) => [
        h.date,
        lang === "de" ? h.de : h.en,
      ]),
    );
  }, [month, lang]);

  const stats = useMemo(() => {
    if (!today) return null;
    const out = {} as Record<Period, { target: number; worked: number; toDate: number }>;
    for (const p of ["day", "week", "month", "year"] as Period[]) {
      const [from, to] = periodRange(p, today);
      const target = targetForRange(from, to, contract);
      let worked = 0;
      hoursByDate.forEach((h, d) => {
        if (d >= from && d <= to) worked += h;
      });
      out[p] = { target, worked, toDate: targetForRange(from, to < today ? to : today, contract) };
    }
    return out;
  }, [today, hoursByDate]);

  const weekEntries = useMemo(() => {
    if (!today) return [];
    const [from, to] = periodRange("week", today);
    return data.entries.filter((e) => e.entryDate >= from && e.entryDate <= to);
  }, [data.entries, today]);

  const vacationUsed = data.entries.filter((e) => e.entryMode === "Vacation_Urlaub").length;
  const project = (id: string) => projects.find((p) => p.id === id);
  const weekdayLabels =
    lang === "de"
      ? ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
      : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  const timerButton = data.timer ? (
    <AppButton
      mt="sm"
      fullWidth
      size="md"
      color="red"
      leftSection={<Stop weight="duotone" size={16} />}
      onClick={() => {
        data.stopTimer(notes);
        setNotes("");
        try {
          sessionStorage.removeItem(DRAFT_NOTES_KEY);
        } catch {
          // Ignore
        }
      }}
    >
      {t("stopWork")} · {formatDuration(data.elapsed)}
    </AppButton>
  ) : (
    <AppButton
      mt="sm"
      fullWidth
      size="md"
      leftSection={<Play weight="duotone" size={16} />}
      disabled={!projectId}
      onClick={() => {
        if (projectId) {
          data.startTimer(projectId, notes);
          try {
            sessionStorage.removeItem(DRAFT_NOTES_KEY);
          } catch {
            // Ignore
          }
        }
      }}
    >
      {t("startWork")}
    </AppButton>
  );

  // Floating "log time" button opens the hours window for today.
  useEffect(() => {
    if (!data.ready || !today) return;
    if (sessionStorage.getItem(LOG_TIME_FLAG)) {
      sessionStorage.removeItem(LOG_TIME_FLAG);
      setSelected(today);
    }
    const h = () => setSelected(today);
    window.addEventListener(LOG_TIME_EVENT, h);
    return () => window.removeEventListener(LOG_TIME_EVENT, h);
  }, [data.ready, today]);

  const isRowEditable = (r: LocalEntry) => {
    if (me?.isAdmin) return true;
    if (r.exported) return false;
    if (isAbsenceMode(r.entryMode)) return true;
    const isUnlocked = !!access?.unlocked?.includes(r.entryDate);
    const isLocked = isPeriodLocked(r.entryDate, me?.id ?? "", access?.locks ?? []);
    if (isLocked) return false;
    return !!today && canEditDate(r.entryDate, today, { isAdmin: false, unlocked: isUnlocked });
  };

  if (!data.ready || !today)
    return (
      <AppShellLayout>
        <DashboardSkeleton />
      </AppShellLayout>
    );

  return (
    <AppShellLayout>
      <AppStack gap="var(--app-grid-gap)" maw={1280} mx="auto">
        <AppPageHeader
          icon={SquaresFour}
          title={t("dashboard")}
          subtitle={`${today ? fmtDate(today) : ""} · ${me?.displayName ?? ""} · ${t("sub_dashboard")}`}
          actions={
            data.outbox > 0 ? (
              <AppBadge color="orange" leftSection={<CloudSlash weight="duotone" size={12} />}>
                {data.outbox} {t("queued")}
              </AppBadge>
            ) : undefined
          }
        />

        {/* Live timer */}
        <AppCard id="timer">
          <AppGrid cols={{ base: 1, md: 2 }}>
            <AppStack
              gap={4}
              justify="center"
              role="button"
              tabIndex={0}
              aria-label={t("allocate")}
              style={{ cursor: "pointer" }}
              onClick={() => today && setSelected(today)}
              onKeyDown={(e) => {
                if ((e.key === "Enter" || e.key === " ") && today) setSelected(today);
              }}
            >
              <AppText fz="xs" fw={600} c="var(--app-text-secondary)" tt="uppercase">
                {data.timer ? (online ? t("running") : t("offlineRunning")) : t("startWork")}
              </AppText>
              <AppMono size="40px" c={data.timer ? "var(--app-brand-primary)" : undefined}>
                {formatDuration(data.elapsed)}
              </AppMono>
              {data.timer && (
                <AppText fz="sm" c="var(--app-text-secondary)">
                  {project(data.timer.projectId)?.name}
                </AppText>
              )}
            </AppStack>
            <AppStack gap="xs">
              <AppSelect
                label={t("project")}
                placeholder={t("selectProject")}
                value={data.timer?.projectId ?? projectId}
                disabled={!!data.timer}
                onChange={setProjectId}
                data={projects.map((p) => ({
                  value: p.id,
                  label: `${p.name} — ${p.customer_name}`,
                }))}
              />
              <AppTextInput
                label={t("notes")}
                placeholder={t("whatWorking")}
                value={notes}
                onChange={(e) => handleNotesChange(e.currentTarget.value)}
                onBlur={() => {
                  if (data.timer) {
                    data.updateTimerNotes(notes);
                  }
                }}
              />
              {timerButton}
            </AppStack>
          </AppGrid>
        </AppCard>

        {/* Target vs worked */}
        <div className="app-folder-tabs-row">
          <div className="app-section-heading">
            <AppHeading order={4}>
              {t("target")} / {t("worked")}
            </AppHeading>
          </div>
          <AppFolderTabs
            compact
            value={period}
            onChange={(v) => setPeriod(v as Period)}
            items={(["day", "week", "month", "year"] as Period[]).map((p) => ({
              value: p,
              label: t(p),
            }))}
          />
        </div>
        <AppGrid cols={{ base: 2, lg: 4 }}>
          {stats &&
            (() => {
              const s = stats[period];
              const remaining = Math.max(0, s.target - s.worked);
              const delta = s.worked - s.toDate;
              return (
                <>
                  <StatCard label={t("target")} value={fmtHours(s.target)} />
                  <StatCard
                    label={t("worked")}
                    value={fmtHours(s.worked)}
                    progress={s.target ? (s.worked / s.target) * 100 : 0}
                  />
                  <StatCard label={t("remaining")} value={fmtHours(remaining)} />
                  <StatCard
                    label={t("flextime")}
                    value={`${delta >= 0 ? "+" : "−"}${fmtHours(Math.abs(delta))}`}
                    tone={delta >= 0 ? "var(--app-success)" : "var(--app-danger)"}
                    sub={`${t("vacationLeft")}: ${contract.vacationDays - vacationUsed} ${t("days")}`}
                  />
                </>
              );
            })()}
        </AppGrid>

        <AppGrid cols={{ base: 1, lg: 2 }}>
          <AppCard id="calendar">
            {today && (
              <AppCalendar
                month={month}
                onMonthChange={setMonth}
                selectedDate={selected}
                onSelect={(d) => {
                  if (d > today) {
                    const foundLeave = data.entries.find(
                      (e) =>
                        e.entryDate === d && e.status !== "rejected" && isAbsenceMode(e.entryMode),
                    );
                    if (!foundLeave) return;
                    setSelected(d);
                    setEditing(foundLeave);
                    setReadOnlyEntry(false);
                    return;
                  }
                  setSelected(d);
                  const found = data.entries.find((e) => e.entryDate === d);
                  setEditing(found ?? null);
                  const isDayEditable = found
                    ? isRowEditable(found)
                    : canEditDate(d, today, {
                        isAdmin: !!me?.isAdmin,
                        unlocked: !!access?.unlocked?.includes(d),
                      }) && !isPeriodLocked(d, me?.id ?? "", access?.locks ?? []);
                  setReadOnlyEntry(!isDayEditable);
                }}
                today={today}
                weekdayLabels={weekdayLabels}
                dayInfo={(d) => {
                  const dayAbsence = data.entries.find(
                    (e) =>
                      e.entryDate === d && e.status !== "rejected" && isAbsenceMode(e.entryMode),
                  );
                  if (dayAbsence) {
                    const m = dayAbsence.entryMode;
                    const tone =
                      m === "Vacation_Urlaub"
                        ? "vacation"
                        : m === "SickLeave_Krankenstand"
                          ? "sick"
                          : "comp";
                    return {
                      tone,
                      label: t(m),
                      absenceMode: m,
                    };
                  }
                  if (d > today) {
                    return { disabled: true, muted: true };
                  }
                  const h = hoursByDate.get(d);
                  if (h) return { hours: h };
                  if (holidays.has(d))
                    return { tone: "holiday", label: holidays.get(d), muted: true };
                  if (!canEditDate(d, today, { isAdmin: !!me?.isAdmin }) && d < today)
                    return { muted: true };
                  return {};
                }}
              />
            )}
          </AppCard>
          <AppCard>
            <div className="app-folder-tabs-row">
              <div className="app-section-heading">
                <AppHeading order={4}>{t("recent")}</AppHeading>
              </div>
              <Link to="/reports" style={{ color: "var(--app-brand-primary)", fontSize: 14 }}>
                {lang === "de" ? "Alle meine Zeiten →" : "All my hours →"}
              </Link>
            </div>
            <AppStack mt="sm">
              <AppDataTable<LocalEntry>
                rows={weekEntries}
                rowKey={(r) => r.id}
                empty={t("noEntries")}
                scrollable
                maxHeight={420}
                stickyHeader
                onRowClick={(r) => {
                  const editable = isRowEditable(r);
                  setReadOnlyEntry(!editable);
                  setEditing(r);
                }}
                columns={[
                  { key: "d", label: t("date"), render: (r) => fmtDate(r.entryDate) },
                  {
                    key: "t",
                    label: `${t("from")}–${t("to")}`,
                    render: (r) => (
                      <AppMono size="sm">
                        {r.fromTime}–{r.toTime}
                      </AppMono>
                    ),
                  },
                  {
                    key: "p",
                    label: t("project"),
                    render: (r) => (r.projectId ? project(r.projectId)?.name : t(r.entryMode)),
                  },
                  {
                    key: "s",
                    label: t("status"),
                    render: (r) => (
                      <AppBadge
                        color={
                          r.status === "pending"
                            ? "orange"
                            : r.status === "rejected"
                              ? "red"
                              : "green"
                        }
                      >
                        {r.status === "pending"
                          ? t("pendingApproval")
                          : r.status === "rejected"
                            ? t("reject")
                            : t("approved")}
                      </AppBadge>
                    ),
                  },
                  {
                    key: "e",
                    label: "",
                    render: (r) =>
                      isRowEditable(r) ? (
                        <AppButton
                          size="compact-xs"
                          variant="subtle"
                          leftSection={<PencilSimple weight="duotone" size={12} />}
                          onClick={(e) => {
                            e.stopPropagation();
                            setReadOnlyEntry(false);
                            setEditing(r);
                          }}
                        >
                          {lang === "de" ? "Bearbeiten" : "Edit"}
                        </AppButton>
                      ) : (
                        <AppButton
                          size="compact-xs"
                          variant="subtle"
                          onClick={(e) => {
                            e.stopPropagation();
                            setReadOnlyEntry(true);
                            setEditing(r);
                          }}
                          aria-label={t("entryDetails")}
                        >
                          🔒
                        </AppButton>
                      ),
                  },
                ]}
              />
            </AppStack>
          </AppCard>
        </AppGrid>
      </AppStack>

      {today && (
        <TimeAllocationModal
          date={editing?.entryDate ?? selected}
          entry={editing}
          today={today}
          existing={data.entries}
          projects={projects}
          isAdmin={!!me?.isAdmin}
          userId={me?.id ?? ""}
          readOnly={readOnlyEntry}
          onClose={() => {
            setSelected(null);
            setEditing(null);
            setReadOnlyEntry(false);
          }}
          onSave={data.saveEntry}
          onSaveMultiple={data.saveEntries}
          onDelete={data.deleteEntry}
        />
      )}
    </AppShellLayout>
  );
}

function StatCard({
  label,
  value,
  sub,
  progress,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  progress?: number;
  tone?: string;
}) {
  return (
    <AppCard>
      <AppText fz="xs" fw={600} c="var(--app-text-secondary)" tt="uppercase">
        {label}
      </AppText>
      <AppMono size="22px" c={tone}>
        {value}
      </AppMono>
      {progress !== undefined && (
        <AppProgress mt="xs" value={Math.min(100, progress)} size="sm" radius="xl" />
      )}
      {sub && (
        <AppText fz="xs" mt={4} c="var(--app-text-secondary)">
          {sub}
        </AppText>
      )}
    </AppCard>
  );
}
