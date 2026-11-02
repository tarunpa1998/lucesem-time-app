import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  SquaresFour,
  Play,
  Stop,
  CloudSlash,
  PencilSimple,
  FolderSimple,
  Kanban,
  ArrowUpRight,
  Plus,
  ClipboardText,
} from "@phosphor-icons/react";
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
  AppTooltip,
  formatDuration,
} from "@/components/core";
import { useI18n } from "@/lib/i18n";
import { austrianHolidays, ymd } from "@/domain/holidays";
import {
  canEditDate,
  periodRange,
  targetForRange,
  isAbsenceMode,
  formatHumanDuration,
} from "@/domain/rules";
import { viennaToday, isPeriodLocked } from "@/domain/locks";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { meQuery, myProjectsQuery, myAccessQuery } from "@/lib/session";
import { useTimeData, entryHours } from "@/features/time/useTimeData";
import { TimeAllocationModal } from "@/features/time/TimeAllocationModal";
import { listOpenTasksForProject } from "@/backend/board.functions";
import type { OpenTaskRow } from "@/backend/types";
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
  const [taskId, setTaskId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [period, setPeriod] = useState<Period>("week");

  const DRAFT_NOTES_KEY = "lucesem_draft_notes";

  const activeProjectId = data.timer?.projectId ?? projectId;

  const { data: openTasks = [], isLoading: loadingTasks } = useQuery<OpenTaskRow[]>({
    queryKey: ["open-tasks", activeProjectId],
    queryFn: () =>
      activeProjectId
        ? listOpenTasksForProject({ data: { projectId: activeProjectId } })
        : Promise.resolve([]),
    enabled: !!activeProjectId,
  });

  // Synchronize work notes, project, and task from active timer on load or refresh
  useEffect(() => {
    if (data.timer) {
      setNotes(data.timer.workNotes ?? "");
      setProjectId(data.timer.projectId ?? null);
      setTaskId(data.timer.taskId ?? null);
    } else {
      const draft = sessionStorage.getItem(DRAFT_NOTES_KEY);
      if (draft) setNotes(draft);
    }
  }, [data.timer]);

  const handleNotesChange = (val: string) => {
    setNotes(val);
    if (data.timer) {
      data.updateTimerNotes(val);
    } else {
      sessionStorage.setItem(DRAFT_NOTES_KEY, val);
    }
  };

  const handleProjectChange = (val: string | null) => {
    setProjectId(val);
    setTaskId(null);
  };

  const handleTaskChange = (val: string | null) => {
    setTaskId(val);
    const chosen = openTasks.find((t) => t.id === val);
    if (data.timer) {
      data.updateTimerTask(
        chosen ? { id: chosen.id, title: chosen.title, number: chosen.task_number } : null,
      );
    } else if (chosen && (!notes || notes.trim() === "")) {
      // Auto-populate notes with task identifier if user hasn't typed anything yet
      setNotes(`[#${chosen.task_number}] ${chosen.title}`);
    }
  };

  const handleStartTimer = () => {
    if (!activeProjectId) return;
    const chosen = openTasks.find((t) => t.id === taskId);
    data.startTimer(
      activeProjectId,
      notes,
      chosen ? { id: chosen.id, title: chosen.title, number: chosen.task_number } : null,
    );
    try {
      sessionStorage.removeItem(DRAFT_NOTES_KEY);
    } catch {
      // Ignore
    }
  };

  const handleStopTimer = () => {
    data.stopTimer(notes);
    setNotes("");
    setTaskId(null);
    try {
      sessionStorage.removeItem(DRAFT_NOTES_KEY);
    } catch {
      // Ignore
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

  const recentEntries = useMemo(() => {
    if (!today) return [];
    const [y, m, d] = today.split("-").map(Number) as [number, number, number];
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() - 7);
    const sevenDaysAgo = ymd(dt);

    // Filter entries from at least the last 7 days (rolling window)
    const inWindow = data.entries.filter((e) => e.entryDate >= sevenDaysAgo);

    // If fewer than 8 entries in last 7 days, backfill with recent entries up to 25
    const pool =
      inWindow.length >= 8
        ? inWindow
        : [...data.entries]
            .sort(
              (a, b) =>
                b.entryDate.localeCompare(a.entryDate) || b.fromTime.localeCompare(a.fromTime),
            )
            .slice(0, 25);

    // Always sort descending: latest date first, latest time first
    return [...pool].sort((a, b) => {
      const cmpDate = b.entryDate.localeCompare(a.entryDate);
      if (cmpDate !== 0) return cmpDate;
      return b.fromTime.localeCompare(a.fromTime);
    });
  }, [data.entries, today]);

  const vacationUsed = data.entries.filter((e) => e.entryMode === "Vacation_Urlaub").length;
  const project = (id: string) => projects.find((p) => p.id === id);
  const weekdayLabels =
    lang === "de"
      ? ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
      : ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

  // Floating "log time" button opens the hours window for today.
  useEffect(() => {
    if (!data.ready || !today) return;
    if (sessionStorage.getItem(LOG_TIME_FLAG)) {
      sessionStorage.removeItem(LOG_TIME_FLAG);
      setSelected(today);
      setEditing(null);
      setReadOnlyEntry(false);
    }
    const h = () => {
      setSelected(today);
      setEditing(null);
      setReadOnlyEntry(false);
    };
    window.addEventListener(LOG_TIME_EVENT, h);
    return () => window.removeEventListener(LOG_TIME_EVENT, h);
  }, [data.ready, today]);

  const isRowEditable = (r: LocalEntry) => {
    if (me?.isAdmin) return true;
    if (r.exported) return false;
    const isAbsence = isAbsenceMode(r.entryMode);
    if (isAbsence) return true;
    const isUnlocked = Boolean(access?.unlocked?.includes(r.entryDate));
    const isLocked = isPeriodLocked(r.entryDate, me?.id ?? "", access?.locks ?? []);
    if (isLocked) return false;
    return Boolean(
      today &&
      canEditDate(r.entryDate, today, {
        isAdmin: false,
        unlocked: isUnlocked,
        isAbsence,
      }),
    );
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

        {/* Live chronometer & Work timer section */}
        <div id="timer" className="app-timer-card" data-running={!!data.timer}>
          <div style={{ padding: "20px 24px" }}>
            <AppGrid cols={{ base: 1, md: 2 }}>
              {/* Left Column: Interactive Chronometer Pod */}
              <div
                className="app-timer-display-pod"
                data-running={!!data.timer}
                role="button"
                tabIndex={0}
                aria-label={t("allocate")}
                onClick={() => {
                  if (today) {
                    setSelected(today);
                    setEditing(null);
                    setReadOnlyEntry(false);
                  }
                }}
                onKeyDown={(e) => {
                  if ((e.key === "Enter" || e.key === " ") && today) {
                    setSelected(today);
                    setEditing(null);
                    setReadOnlyEntry(false);
                  }
                }}
              >
                {/* Status header row */}
                <AppGroup justify="space-between" align="center">
                  <AppGroup gap={8} align="center">
                    {data.timer && (
                      <>
                        <span className="app-timer-pulse-dot" />
                        <AppBadge
                          color="green"
                          variant="light"
                          size="sm"
                          style={{ fontWeight: 600, letterSpacing: "0.04em" }}
                        >
                          {online ? t("liveTracking") : t("offlineRunning")}
                        </AppBadge>
                      </>
                    )}
                  </AppGroup>
                  {today && (
                    <AppText fz="xs" c="var(--app-text-secondary)" fw={500}>
                      {fmtDate(today)}
                    </AppText>
                  )}
                </AppGroup>

                {/* Big monospace digits */}
                <div style={{ padding: "12px 0" }}>
                  <div className="app-timer-digits" data-running={!!data.timer}>
                    {formatDuration(data.elapsed)}
                  </div>
                </div>

                {/* Metadata and footer */}
                <div>
                  {data.timer ? (
                    <AppStack gap={4}>
                      <AppGroup gap={6} align="center" wrap="nowrap">
                        <FolderSimple weight="duotone" size={15} color="var(--app-brand-primary)" />
                        <AppText fz="xs" fw={600} truncate c="var(--app-text-primary)">
                          {project(data.timer.projectId)?.name ?? t("project")}
                        </AppText>
                      </AppGroup>
                      {(data.timer.taskTitle || data.timer.taskId) && (
                        <AppGroup gap={6} align="center" wrap="nowrap">
                          <Kanban weight="duotone" size={15} color="var(--app-brand-primary)" />
                          <AppBadge color="blue" variant="outline" size="xs">
                            {data.timer.taskNumber ? `#${data.timer.taskNumber} ` : ""}
                            {data.timer.taskTitle ?? t("linkedTask")}
                          </AppBadge>
                        </AppGroup>
                      )}
                      <AppText fz="11px" c="var(--app-text-secondary)" mt={2}>
                        {t("clickToOpenDay")} →
                      </AppText>
                    </AppStack>
                  ) : (
                    <AppGroup justify="space-between" align="center">
                      <AppText fz="xs" c="var(--app-text-secondary)">
                        {t("clickToOpenDay")}
                      </AppText>
                      <ArrowUpRight size={14} color="var(--app-text-secondary)" />
                    </AppGroup>
                  )}
                </div>
              </div>

              {/* Right Column: Work Session Controls */}
              <div className="app-timer-form-pod">
                <AppStack gap="xs">
                  {/* Project & Task selection in responsive grid */}
                  <AppGrid cols={{ base: 1, sm: 2 }}>
                    <AppSelect
                      label={t("project")}
                      placeholder={t("selectProject")}
                      value={activeProjectId}
                      disabled={!!data.timer}
                      searchable
                      onChange={handleProjectChange}
                      data={projects.map((p) => ({
                        value: p.id,
                        label: `${p.name} — ${p.customer_name}`,
                      }))}
                      leftSection={<FolderSimple weight="duotone" size={15} />}
                    />
                    <AppSelect
                      label={t("taskIssue")}
                      placeholder={
                        !activeProjectId
                          ? t("selectProject")
                          : loadingTasks
                            ? `${t("selectTask")}...`
                            : openTasks.length === 0
                              ? t("noOpenTasks")
                              : t("selectTaskPlaceholder")
                      }
                      value={taskId}
                      clearable
                      searchable
                      disabled={!activeProjectId || openTasks.length === 0}
                      onChange={handleTaskChange}
                      data={openTasks.map((tsk) => ({
                        value: tsk.id,
                        label: `#${tsk.task_number} · ${tsk.title} (${tsk.status === "in_progress" ? t("inProgress") : t("pending")})`,
                      }))}
                      leftSection={<Kanban weight="duotone" size={15} />}
                    />
                  </AppGrid>

                  {/* Work notes input */}
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
                    leftSection={<ClipboardText weight="duotone" size={15} />}
                  />
                </AppStack>

                {/* Actions Bar */}
                <div style={{ marginTop: 12 }}>
                  <AppGrid cols={{ base: 1, sm: 2 }}>
                    {data.timer ? (
                      <AppButton
                        key="stop-work-btn"
                        fullWidth
                        size="md"
                        color="red"
                        loading={data.stopping}
                        disabled={data.stopping}
                        leftSection={<Stop weight="duotone" size={18} />}
                        onClick={handleStopTimer}
                      >
                        {t("stopWork")}
                      </AppButton>
                    ) : (
                      <AppButton
                        key="start-work-btn"
                        fullWidth
                        size="md"
                        leftSection={<Play weight="duotone" size={18} />}
                        disabled={!activeProjectId || data.starting}
                        loading={data.starting}
                        onClick={handleStartTimer}
                      >
                        {t("startWork")}
                      </AppButton>
                    )}
                    <AppButton
                      fullWidth
                      size="md"
                      variant="default"
                      leftSection={<Plus weight="bold" size={16} />}
                      onClick={() => {
                        if (today) {
                          setSelected(today);
                          setEditing(null);
                          setReadOnlyEntry(false);
                        }
                      }}
                    >
                      {t("logTime")}
                    </AppButton>
                  </AppGrid>
                </div>
              </div>
            </AppGrid>
          </div>
        </div>

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
                  <StatCard label={t("target")} value={fmtHours(s.target, { full: true })} />
                  <StatCard
                    label={t("worked")}
                    value={fmtHours(s.worked, { full: true })}
                    progress={s.target ? (s.worked / s.target) * 100 : 0}
                  />
                  <StatCard label={t("remaining")} value={fmtHours(remaining, { full: true })} />
                  <StatCard
                    label={t("flextime")}
                    value={`${delta >= 0 ? "+" : "−"}${fmtHours(Math.abs(delta), { full: true })}`}
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
                  const isUnlocked = Boolean(access?.unlocked?.includes(d));
                  const isLocked =
                    !me?.isAdmin && isPeriodLocked(d, me?.id ?? "", access?.locks ?? []);
                  const isDayEditable =
                    !isLocked &&
                    canEditDate(d, today, {
                      isAdmin: !me?.isAdmin,
                      unlocked: isUnlocked,
                    });
                  setReadOnlyEntry(!isDayEditable);
                  const dayEntries = data.entries.filter((e) => e.entryDate === d);
                  if (!isDayEditable && dayEntries.length > 0 && dayEntries[0]) {
                    setEditing(dayEntries[0]);
                  } else {
                    setEditing(null);
                  }
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
              <div className="recent-entries-desktop">
                <AppDataTable<LocalEntry>
                  rows={recentEntries}
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
                      key: "h",
                      label: t("hoursColumn"),
                      render: (r) => {
                        const h = entryHours(r);
                        const timeRange = `${r.fromTime}–${r.toTime}`;
                        const formattedH = fmtHours(h);
                        const mins = Math.round(h * 60);
                        const humanDuration = formatHumanDuration(mins, lang);
                        return (
                          <AppTooltip
                            label={
                              <div style={{ lineHeight: 1.4, fontSize: 12 }}>
                                <div style={{ fontWeight: 600 }}>
                                  {timeRange} ({humanDuration})
                                </div>
                                <div style={{ opacity: 0.85 }}>{formattedH}</div>
                              </div>
                            }
                            withArrow
                            position="top-start"
                          >
                            <div
                              style={{
                                cursor: "default",
                                display: "inline-flex",
                                alignItems: "baseline",
                                gap: 6,
                              }}
                            >
                              <AppMono size="sm" fw={600}>
                                {formattedH}
                              </AppMono>
                              <AppText fz="xs" c="var(--app-text-secondary)" fw={500}>
                                ({humanDuration})
                              </AppText>
                            </div>
                          </AppTooltip>
                        );
                      },
                    },
                    {
                      key: "p",
                      label: t("project"),
                      width: 260,
                      render: (r) => {
                        const proj = r.projectId ? project(r.projectId) : null;
                        const projName = proj
                          ? proj.name
                          : r.projectId
                            ? lang === "de"
                              ? "Projekt"
                              : "Project"
                            : t(r.entryMode);
                        const customerName = proj?.customer_name ?? null;
                        const taskText = r.taskTitle
                          ? `#${r.taskNumber ?? "—"} · ${r.taskTitle}`
                          : null;

                        return (
                          <AppTooltip
                            label={
                              <div style={{ maxWidth: 300, whiteSpace: "normal", lineHeight: 1.4 }}>
                                <div style={{ fontWeight: 600, fontSize: 13 }}>{projName}</div>
                                {customerName && (
                                  <div style={{ fontSize: 11, opacity: 0.85, marginTop: 2 }}>
                                    {customerName}
                                  </div>
                                )}
                                {taskText && (
                                  <div
                                    style={{
                                      fontSize: 12,
                                      marginTop: 4,
                                      color: "var(--app-brand-primary, #38bdf8)",
                                      fontWeight: 500,
                                    }}
                                  >
                                    {taskText}
                                  </div>
                                )}
                                {r.workNotes && (
                                  <div
                                    style={{
                                      fontSize: 11,
                                      marginTop: 4,
                                      fontStyle: "italic",
                                      opacity: 0.9,
                                    }}
                                  >
                                    {r.workNotes}
                                  </div>
                                )}
                              </div>
                            }
                            multiline
                            withArrow
                            position="top-start"
                          >
                            <div
                              style={{
                                maxWidth: 260,
                                whiteSpace: "normal",
                                wordBreak: "break-word",
                                cursor: "default",
                              }}
                            >
                              <AppStack gap={2}>
                                <AppText
                                  size="sm"
                                  fw={500}
                                  style={{
                                    display: "-webkit-box",
                                    WebkitLineClamp: 2,
                                    WebkitBoxOrient: "vertical",
                                    overflow: "hidden",
                                    lineHeight: 1.3,
                                  }}
                                >
                                  {projName}
                                </AppText>
                                {r.taskTitle ? (
                                  <AppGroup gap={4} wrap="nowrap" align="flex-start">
                                    <AppBadge
                                      size="xs"
                                      variant="outline"
                                      color="blue"
                                      style={{ flexShrink: 0, marginTop: 1 }}
                                    >
                                      #{r.taskNumber ?? "—"}
                                    </AppBadge>
                                    <AppText
                                      size="xs"
                                      c="dimmed"
                                      style={{
                                        display: "-webkit-box",
                                        WebkitLineClamp: 1,
                                        WebkitBoxOrient: "vertical",
                                        overflow: "hidden",
                                        lineHeight: 1.25,
                                      }}
                                    >
                                      {r.taskTitle}
                                    </AppText>
                                  </AppGroup>
                                ) : null}
                              </AppStack>
                            </div>
                          </AppTooltip>
                        );
                      },
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
              </div>

              <div className="recent-entries-mobile">
                {recentEntries.length === 0 ? (
                  <AppText c="var(--app-text-secondary)" size="sm" py="xl" ta="center">
                    {t("noEntries")}
                  </AppText>
                ) : (
                  <div className="recent-entries-mobile-list">
                    {recentEntries.map((r) => {
                      const h = entryHours(r);
                      const timeRange = r.fromTime && r.toTime ? `${r.fromTime}–${r.toTime}` : null;
                      const formattedH = fmtHours(h);
                      const proj = r.projectId ? project(r.projectId) : null;
                      const projName = proj
                        ? proj.name
                        : r.projectId
                          ? lang === "de"
                            ? "Projekt"
                            : "Project"
                          : t(r.entryMode);
                      const customerName = proj?.customer_name ?? null;
                      const editable = isRowEditable(r);

                      return (
                        <div
                          key={r.id}
                          className="recent-entry-mobile-item"
                          onClick={() => {
                            setReadOnlyEntry(!editable);
                            setEditing(r);
                          }}
                        >
                          <div className="recent-entry-mobile-header">
                            <div className="recent-entry-mobile-proj-wrap">
                              <AppText size="sm" fw={600} className="recent-entry-mobile-proj-name">
                                {projName}
                              </AppText>
                              {customerName && (
                                <AppText
                                  size="xs"
                                  c="dimmed"
                                  className="recent-entry-mobile-customer"
                                >
                                  {customerName}
                                </AppText>
                              )}
                            </div>
                            <div className="recent-entry-mobile-hours-wrap">
                              <AppMono size="sm" fw={700} className="recent-entry-mobile-hours">
                                {formattedH}
                              </AppMono>
                              {timeRange && (
                                <AppMono
                                  size="xs"
                                  c="dimmed"
                                  className="recent-entry-mobile-timerange"
                                >
                                  {timeRange} ({formatHumanDuration(Math.round(h * 60), lang)})
                                </AppMono>
                              )}
                            </div>
                          </div>

                          {(r.taskTitle || r.workNotes) && (
                            <div className="recent-entry-mobile-body">
                              {r.taskTitle && (
                                <div className="recent-entry-mobile-task">
                                  <AppBadge
                                    size="xs"
                                    variant="outline"
                                    color="blue"
                                    style={{ flexShrink: 0, marginTop: 1 }}
                                  >
                                    #{r.taskNumber ?? "—"}
                                  </AppBadge>
                                  <AppText
                                    size="xs"
                                    c="var(--app-text-secondary)"
                                    className="recent-entry-mobile-task-title"
                                  >
                                    {r.taskTitle}
                                  </AppText>
                                </div>
                              )}
                              {r.workNotes && (
                                <AppText
                                  size="xs"
                                  c="dimmed"
                                  fs="italic"
                                  className="recent-entry-mobile-notes"
                                >
                                  {r.workNotes}
                                </AppText>
                              )}
                            </div>
                          )}

                          <div className="recent-entry-mobile-footer">
                            <div className="recent-entry-mobile-date">
                              <AppMono size="xs" c="dimmed" fw={500}>
                                {fmtDate(r.entryDate)}
                              </AppMono>
                            </div>
                            <div className="recent-entry-mobile-actions">
                              <AppBadge
                                size="xs"
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

                              {editable ? (
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
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
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
