import {
  ChartBar,
  FileArrowDown,
  Clock,
  FileText,
  CurrencyEur,
  CheckCircle,
  Funnel,
  ArrowsDownUp,
  MagnifyingGlass,
  X,
  LockSimple,
  CalendarBlank,
  CalendarCheck,
  Lightning,
  CaretDown,
  Folder,
  User as UserIcon,
  Buildings,
} from "@phosphor-icons/react";
import { useMemo, useState } from "react";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  AppCard,
  AppGroup,
  AppStack,
  AppButton,
  AppText,
  AppGrid,
  AppSelect,
  AppTextInput,
  AppDateInput,
  AppSwitch,
  AppMono,
  AppBadge,
  AppChart,
  AppBarChart,
  AppDonutChart,
  AppProgress,
  AppDataTable,
  AppIconButton,
  AppTooltip,
  AppFolderTabs,
  AppBox,
  AppMenu,
  notify,
  TablePageSkeleton,
  AppPageHeader,
} from "@/components/core";
import { useI18n } from "@/lib/i18n";
import { meQuery, customersQuery, usersQuery, myProjectsQuery, myAccessQuery } from "@/lib/session";
import { reportData, markExported, type ReportRow } from "@/backend/workflow.functions";
import { AdminEntryModal } from "./AdminEntryModal";
import { TimeAllocationModal } from "@/features/time/TimeAllocationModal";
import { useTimeData } from "@/features/time/useTimeData";
import {
  canEditDate,
  isAbsenceMode,
  formatSlotDuration,
  formatHoursMinutes,
  type EntryMode,
} from "@/domain/rules";
import { viennaToday, isPeriodLocked } from "@/domain/locks";
import type { LocalEntry } from "@/lib/offline-db";
import { exportCsv, exportHtml, exportPdf, exportXlsx, type ExportTable } from "@/lib/exporters";

const PROJECT_COLORS = [
  "#009FE3", // Lucesem blue
  "#38BDF8", // Sky blue
  "#6366F1", // Indigo
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#10B981", // Emerald
  "#F59E0B", // Amber
  "#14B8A6", // Teal
  "#84CC16", // Lime
  "#F97316", // Orange
  "#A855F7", // Violet
  "#06B6D4", // Cyan
];

const getRange = (type: "thisMonth" | "lastMonth" | "thisWeek" | "today" | "allYear") => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = now.getFullYear();
  const m = now.getMonth();
  const t = viennaToday(now);

  if (type === "today") {
    return { from: t, to: t };
  }
  if (type === "thisMonth") {
    return { from: `${y}-${pad(m + 1)}-01`, to: t };
  }
  if (type === "lastMonth") {
    const lastMonthEnd = new Date(y, m, 0);
    const prevY = lastMonthEnd.getFullYear();
    const prevM = lastMonthEnd.getMonth() + 1;
    const lastDay = lastMonthEnd.getDate();
    return {
      from: `${prevY}-${pad(prevM)}-01`,
      to: `${prevY}-${pad(prevM)}-${pad(lastDay)}`,
    };
  }
  if (type === "thisWeek") {
    const dayOfWeek = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - dayOfWeek + 1);
    return {
      from: `${monday.getFullYear()}-${pad(monday.getMonth() + 1)}-${pad(monday.getDate())}`,
      to: t,
    };
  }
  if (type === "allYear") {
    return { from: `${y}-01-01`, to: t };
  }
  return { from: `${y}-${pad(m + 1)}-01`, to: t };
};

type SortField = "date" | "hours" | "project" | "customer" | "user" | "status";
type SortDirection = "asc" | "desc";

export function ReportsPage() {
  const { t, fmtDate, fmtHours, lang } = useI18n();
  const { data: me } = useSuspenseQuery(meQuery);
  const isAdmin = !!me?.isAdmin;

  // Date range state
  const initialMonth = getRange("thisMonth");
  const [from, setFrom] = useState(initialMonth.from);
  const [to, setTo] = useState(initialMonth.to);
  const [activeRange, setActiveRange] = useState<string>("thisMonth");

  // Filter state
  const [userId, setUserId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Sort state (defaults to newest first as requested)
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Chart view toggle
  const [chartView, setChartView] = useState<"project" | "daily">("project");

  // Other state
  const [lockAfter, setLockAfter] = useState(false);
  const [editing, setEditing] = useState<ReportRow | null>(null);
  const [ownEditing, setOwnEditing] = useState<LocalEntry | null>(null);
  const [ownReadOnly, setOwnReadOnly] = useState(false);

  const { data: users = [] } = useQuery({ ...usersQuery, enabled: isAdmin });
  const { data: customers = [] } = useQuery({ ...customersQuery, enabled: isAdmin });
  const { data: projects = [] } = useQuery(myProjectsQuery);
  const { data: access } = useQuery(myAccessQuery);

  const timeData = useTimeData({
    userId: me?.id ?? "anon",
    requiresApproval: !!me?.requiresTimesheetApproval,
    isPendingProject: (id) =>
      projects.find((p) => p.id === id)?.approval_state === "Pending_Admin_Review",
  });

  const today = viennaToday();
  const canUserEdit = (r: ReportRow) => {
    if (isAdmin) return true;
    if (r.exported) return false;
    if (r.user_id !== me?.id) return false;
    const isAbsence = isAbsenceMode(r.entry_mode as EntryMode);
    if (isAbsence) return true;
    const isUnlocked = !!access?.unlocked?.includes(r.entry_date);
    const isLocked = isPeriodLocked(r.entry_date, me?.id ?? "", access?.locks ?? []);
    if (isLocked) return false;
    return canEditDate(r.entry_date, today, {
      isAdmin: false,
      unlocked: isUnlocked,
      isAbsence,
    });
  };

  const toLocal = (r: ReportRow): LocalEntry => ({
    id: r.id,
    entryDate: r.entry_date,
    fromTime: r.from_time,
    toTime: r.to_time,
    projectId: r.project_id,
    workNotes: r.work_notes ?? "",
    entryMode: r.entry_mode as LocalEntry["entryMode"],
    status: r.status as LocalEntry["status"],
    createdAt: Date.now(),
    activityId: timeData.entries.find((e) => e.id === r.id)?.activityId ?? null,
    exported: r.exported,
  });

  const filter = { from, to, userId, customerId, projectId };
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to;

  const report = useQuery({
    queryKey: ["report", filter],
    queryFn: () => reportData({ data: filter }),
    enabled: valid,
  });

  const rows: ReportRow[] = useMemo(() => report.data ?? [], [report.data]);

  // Filtered and Sorted entries
  const sortedRows = useMemo(() => {
    let list = [...rows];

    // Status filter
    if (statusFilter && statusFilter !== "all") {
      list = list.filter((r) => r.status === statusFilter);
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (r) =>
          (r.work_notes?.toLowerCase().includes(q) ?? false) ||
          r.project_name.toLowerCase().includes(q) ||
          r.customer_name.toLowerCase().includes(q) ||
          (r.user_name && r.user_name.toLowerCase().includes(q)),
      );
    }

    // Sort entries
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") {
        const cmpDate = a.entry_date.localeCompare(b.entry_date);
        cmp = cmpDate !== 0 ? cmpDate : a.from_time.localeCompare(b.from_time);
      } else if (sortField === "hours") {
        cmp = a.hours - b.hours;
      } else if (sortField === "project") {
        cmp = a.project_name.localeCompare(b.project_name);
      } else if (sortField === "customer") {
        cmp = a.customer_name.localeCompare(b.customer_name);
      } else if (sortField === "user") {
        cmp = a.user_name.localeCompare(b.user_name);
      } else if (sortField === "status") {
        cmp = a.status.localeCompare(b.status);
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return list;
  }, [rows, statusFilter, searchQuery, sortField, sortDirection]);

  // Analytics & totals calculations
  const totals = useMemo(() => {
    const hours = sortedRows.reduce((s, r) => s + r.hours, 0);
    const amount = sortedRows.reduce((s, r) => s + r.hours * (r.hourly_rate ?? 0), 0);
    const approvedCount = sortedRows.filter((r) => r.status === "approved").length;
    const approvalRate = sortedRows.length > 0 ? (approvedCount / sortedRows.length) * 100 : 0;

    // By Project Breakdown
    const projectMap = new Map<
      string,
      { projectName: string; customerName: string; hours: number }
    >();
    for (const r of sortedRows) {
      const key = r.project_id || r.project_name;
      const current = projectMap.get(key);
      if (current) {
        current.hours += r.hours;
      } else {
        projectMap.set(key, {
          projectName: r.project_name,
          customerName: r.customer_name,
          hours: r.hours,
        });
      }
    }

    const projectBreakdown = [...projectMap.values()]
      .sort((a, b) => b.hours - a.hours)
      .map((item, idx) => {
        const roundedHours = Math.round(item.hours * 100) / 100;
        const percentage = hours > 0 ? (item.hours / hours) * 100 : 0;
        const color = PROJECT_COLORS[idx % PROJECT_COLORS.length]!;
        return {
          name: item.projectName,
          customerName: item.customerName,
          value: roundedHours,
          hours: roundedHours,
          percentage,
          color,
        };
      });

    // Daily Trend & Calendar Continuity
    const byDay = new Map<string, number>();
    for (const r of sortedRows) {
      byDay.set(r.entry_date, (byDay.get(r.entry_date) ?? 0) + r.hours);
    }

    let dailyDates: string[] = [];
    if (/^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to) {
      const [sy, sm, sd] = from.split("-").map(Number);
      const [ey, em, ed] = to.split("-").map(Number);
      const startDate = new Date(sy!, sm! - 1, sd!);
      const endDate = new Date(ey!, em! - 1, ed!);
      const dayDiff =
        Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

      if (dayDiff >= 1 && dayDiff <= 31) {
        // Continuous calendar days for short ranges (today, week, month, custom <= 31 days)
        const cur = new Date(startDate);
        while (cur <= endDate) {
          const cy = cur.getFullYear();
          const cm = String(cur.getMonth() + 1).padStart(2, "0");
          const cd = String(cur.getDate()).padStart(2, "0");
          dailyDates.push(`${cy}-${cm}-${cd}`);
          cur.setDate(cur.getDate() + 1);
        }
      } else {
        // Large ranges: take active days with logged hours (up to 30 most recent)
        dailyDates = [...byDay.keys()].sort((a, b) => a.localeCompare(b)).slice(-30);
      }
    } else {
      dailyDates = [...byDay.keys()].sort((a, b) => a.localeCompare(b)).slice(-14);
    }

    const isShortRange = dailyDates.length <= 7;
    const daily = dailyDates.map((dateStr) => {
      const [y, m, d] = dateStr.split("-").map(Number);
      const dt = new Date(y!, m! - 1, d!);
      const dayNum = String(d).padStart(2, "0");
      const monthNum = String(m).padStart(2, "0");
      let label = "";
      if (isShortRange) {
        const weekday = dt.toLocaleDateString(lang === "de" ? "de-AT" : "en-US", {
          weekday: "short",
        });
        label = lang === "de" ? `${weekday} ${dayNum}.` : `${weekday} ${dayNum}`;
      } else {
        label = lang === "de" ? `${dayNum}.${monthNum}.` : `${monthNum}/${dayNum}`;
      }

      const h = byDay.get(dateStr) ?? 0;
      return {
        dateStr,
        label,
        hours: Math.round(h * 100) / 100,
      };
    });

    const activeDays = daily.filter((d) => d.hours > 0);
    const workedDays = activeDays.length;
    const totalDays = daily.length;
    const avgDailyHours = workedDays > 0 ? hours / workedDays : 0;
    const peakDay = daily.reduce<(typeof daily)[0] | null>(
      (max, d) => (d.hours > (max?.hours ?? 0) ? d : max),
      null,
    );

    return {
      hours,
      amount,
      approvalRate,
      projectBreakdown,
      daily,
      workedDays,
      totalDays,
      avgDailyHours,
      peakDay,
    };
  }, [sortedRows, from, to, lang]);

  const money = (n: number) =>
    n.toLocaleString(lang === "de" ? "de-AT" : "en-US", { style: "currency", currency: "EUR" });

  const handleQuickRange = (
    rangeKey: "thisMonth" | "lastMonth" | "thisWeek" | "today" | "allYear",
  ) => {
    const r = getRange(rangeKey);
    setFrom(r.from);
    setTo(r.to);
    setActiveRange(rangeKey);
  };

  const handleSortColumn = (key: string) => {
    if (key === sortField) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(key as SortField);
      setSortDirection("desc");
    }
  };

  const hasActiveFilters = Boolean(
    userId || customerId || projectId || statusFilter !== "all" || searchQuery.trim(),
  );

  const resetFilters = () => {
    setUserId(null);
    setCustomerId(null);
    setProjectId(null);
    setStatusFilter("all");
    setSearchQuery("");
  };

  const doExport = async (kind: "pdf" | "xlsx" | "csv" | "html") => {
    const table: ExportTable = {
      title: t("reportsTitle"),
      subtitle: `${fmtDate(from)} – ${fmtDate(to)}`,
      headers: [
        t("date"),
        t("user"),
        t("customer"),
        t("project"),
        t("from"),
        t("to"),
        t("hours"),
        t("notes"),
      ],
      rows: sortedRows.map((r) => [
        fmtDate(r.entry_date),
        r.user_name,
        r.customer_name,
        r.project_name,
        r.from_time,
        r.to_time,
        r.hours.toFixed(2),
        r.work_notes,
      ]),
      totals: ["", "", "", "", "", t("totalHours"), totals.hours.toFixed(2), ""],
    };
    const file = `lucesem-report-${from}_${to}`;
    if (kind === "pdf") await exportPdf(table, file);
    if (kind === "xlsx") await exportXlsx(table, file);
    if (kind === "csv") exportCsv(table, file);
    if (kind === "html") exportHtml(table, file);

    if (isAdmin && lockAfter) {
      const ids = sortedRows.filter((r) => !r.exported).map((r) => r.id);
      if (ids.length) {
        const r = await markExported({ data: { ids } });
        notify.show({ color: "lucesem", message: `${r.count} · ${t("exportedLocked")}` });
        report.refetch();
      }
    }
  };

  if (report.isLoading && !report.data) return <TablePageSkeleton />;

  return (
    <AppStack gap="var(--app-grid-gap)" maw={1280} mx="auto">
      {/* Sticky Floating Subheader */}
      <AppPageHeader
        icon={ChartBar}
        title={t("reportsTitle")}
        subtitle={t("sub_reports")}
        badge={
          rows.length > 0 ? (
            <AppBadge variant="light" color="lucesem">
              {sortedRows.length} {t("entriesCount")}
            </AppBadge>
          ) : undefined
        }
        actions={
          <>
            <AppGroup gap="xs" wrap="nowrap" visibleFrom="sm">
              {(["pdf", "xlsx", "csv", "html"] as const).map((k) => (
                <AppButton
                  key={k}
                  size="xs"
                  variant="light"
                  leftSection={<FileArrowDown weight="duotone" size={14} />}
                  disabled={!sortedRows.length}
                  onClick={() => doExport(k)}
                >
                  {k.toUpperCase()}
                </AppButton>
              ))}
            </AppGroup>

            <AppBox hiddenFrom="sm">
              <AppMenu position="bottom-end" shadow="md" width={160}>
                <AppMenu.Target>
                  <AppButton
                    size="xs"
                    variant="light"
                    leftSection={<FileArrowDown weight="duotone" size={14} />}
                    rightSection={<CaretDown size={12} />}
                    disabled={!sortedRows.length}
                  >
                    {t("exportReport")}
                  </AppButton>
                </AppMenu.Target>
                <AppMenu.Dropdown>
                  <AppMenu.Item
                    leftSection={<FileArrowDown size={14} />}
                    onClick={() => doExport("pdf")}
                  >
                    PDF (.pdf)
                  </AppMenu.Item>
                  <AppMenu.Item
                    leftSection={<FileArrowDown size={14} />}
                    onClick={() => doExport("xlsx")}
                  >
                    Excel (.xlsx)
                  </AppMenu.Item>
                  <AppMenu.Item
                    leftSection={<FileArrowDown size={14} />}
                    onClick={() => doExport("csv")}
                  >
                    CSV (.csv)
                  </AppMenu.Item>
                  <AppMenu.Item
                    leftSection={<FileArrowDown size={14} />}
                    onClick={() => doExport("html")}
                  >
                    HTML (.html)
                  </AppMenu.Item>
                </AppMenu.Dropdown>
              </AppMenu>
            </AppBox>
          </>
        }
      />

      {/* Quick Date Range Filters - Outside of Card, centered on desktop, cleanly wrapped on mobile */}
      <div className="reports-quick-ranges-bar">
        <AppFolderTabs
          compact
          value={activeRange ?? ""}
          onChange={(v) =>
            handleQuickRange(v as "thisMonth" | "lastMonth" | "thisWeek" | "today" | "allYear")
          }
          items={[
            { value: "thisMonth", label: t("thisMonth") },
            { value: "lastMonth", label: t("lastMonth") },
            { value: "thisWeek", label: t("thisWeek") },
            { value: "today", label: t("today") },
            { value: "allYear", label: t("allYear") },
          ]}
        />
        {hasActiveFilters && (
          <AppButton
            size="compact-xs"
            variant="subtle"
            color="red"
            leftSection={<X size={12} />}
            className="reports-clear-filters-btn"
            onClick={resetFilters}
          >
            {t("clearFilters")}
          </AppButton>
        )}
      </div>

      {/* Top Filter Section */}
      <AppCard>
        <AppStack gap="sm">
          {/* Primary Filter Inputs - 2 columns on mobile, 3 columns on tablet/laptop, 5 on wide admin */}
          <AppGrid cols={{ base: 2, sm: 2, md: isAdmin ? 3 : 3, lg: isAdmin ? 5 : 3 }}>
            <AppDateInput
              label={t("fromDate")}
              placeholder="DD.MM.YYYY"
              value={from}
              onChange={(val) => {
                setFrom(val);
                setActiveRange("");
              }}
              clearable={false}
              leftSection={<CalendarBlank size={16} />}
            />
            <AppDateInput
              label={t("toDate")}
              placeholder="DD.MM.YYYY"
              value={to}
              onChange={(val) => {
                setTo(val);
                setActiveRange("");
              }}
              clearable={false}
              leftSection={<CalendarBlank size={16} />}
            />
            {isAdmin && (
              <AppSelect
                label={t("user")}
                placeholder={t("allUsers")}
                clearable
                leftSection={<UserIcon size={16} />}
                value={userId}
                onChange={setUserId}
                data={users.map((u) => ({ value: u.id, label: u.display_name }))}
              />
            )}
            {isAdmin && (
              <AppSelect
                label={t("customer")}
                placeholder={t("allCustomers")}
                clearable
                leftSection={<Buildings size={16} />}
                value={customerId}
                onChange={(c) => {
                  setCustomerId(c);
                  setProjectId(null);
                }}
                data={customers.map((c) => ({ value: c.id, label: c.name }))}
              />
            )}
            <AppSelect
              label={t("project")}
              placeholder={t("allProjects")}
              clearable
              leftSection={<Folder size={16} />}
              value={projectId}
              onChange={setProjectId}
              data={projects
                .filter((p) => !customerId || p.customer_id === customerId)
                .map((p) => ({ value: p.id, label: p.name }))}
            />
          </AppGrid>

          {/* Secondary Search & Status Filter Bar */}
          <AppGrid cols={{ base: 1, sm: 2, md: 3 }}>
            <AppTextInput
              placeholder={t("searchFilter")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.currentTarget.value)}
              leftSection={<MagnifyingGlass size={16} />}
              rightSection={
                searchQuery ? (
                  <AppIconButton
                    size="xs"
                    variant="subtle"
                    onClick={() => setSearchQuery("")}
                    aria-label="Clear search"
                  >
                    <X size={12} />
                  </AppIconButton>
                ) : undefined
              }
            />
            <AppSelect
              placeholder={t("allStatuses")}
              value={statusFilter}
              onChange={(v) => setStatusFilter(v ?? "all")}
              leftSection={<Funnel size={16} />}
              data={[
                { value: "all", label: t("allStatuses") },
                { value: "approved", label: t("approved") },
                { value: "pending", label: t("pendingApproval") },
                { value: "rejected", label: t("reject") },
              ]}
            />
            <AppGroup align="center" justify="flex-end">
              {isAdmin && (
                <AppSwitch
                  label={t("lockAfterExport")}
                  checked={lockAfter}
                  onChange={(e) => setLockAfter(e.currentTarget.checked)}
                />
              )}
            </AppGroup>
          </AppGrid>
        </AppStack>
      </AppCard>

      {/* KPI Stats Cards - 2x2 grid on mobile for compact, executive readability */}
      <AppGrid cols={{ base: 2, sm: 2, lg: 4 }}>
        <AppCard p={{ base: 12, sm: "md" }}>
          <AppGroup justify="space-between" align="flex-start" mb={4} wrap="nowrap">
            <AppText
              fz={{ base: 10, sm: "xs" }}
              fw={700}
              c="var(--app-text-secondary)"
              tt="uppercase"
              truncate
            >
              {t("totalHours")}
            </AppText>
            <Clock
              size={18}
              weight="duotone"
              color="var(--app-brand-primary)"
              style={{ flexShrink: 0 }}
            />
          </AppGroup>
          <AppTooltip
            label={
              <div style={{ lineHeight: 1.4, fontSize: 12 }}>
                <div style={{ fontWeight: 600 }}>{formatHoursMinutes(totals.hours)}</div>
                <div style={{ opacity: 0.85 }}>{fmtHours(totals.hours)}</div>
              </div>
            }
            withArrow
          >
            <div style={{ cursor: "default", display: "inline-block" }}>
              <AppMono size="20px">{formatHoursMinutes(totals.hours)}</AppMono>
            </div>
          </AppTooltip>
        </AppCard>

        <AppCard p={{ base: 12, sm: "md" }}>
          <AppGroup justify="space-between" align="flex-start" mb={4} wrap="nowrap">
            <AppText
              fz={{ base: 10, sm: "xs" }}
              fw={700}
              c="var(--app-text-secondary)"
              tt="uppercase"
              truncate
            >
              {t("entriesCount")}
            </AppText>
            <FileText
              size={18}
              weight="duotone"
              color="var(--app-brand-primary)"
              style={{ flexShrink: 0 }}
            />
          </AppGroup>
          <AppMono size="20px">{sortedRows.length}</AppMono>
        </AppCard>

        <AppCard p={{ base: 12, sm: "md" }}>
          <AppGroup justify="space-between" align="flex-start" mb={4} wrap="nowrap">
            <AppText
              fz={{ base: 10, sm: "xs" }}
              fw={700}
              c="var(--app-text-secondary)"
              tt="uppercase"
              truncate
            >
              {t("billable")}
            </AppText>
            <CurrencyEur
              size={18}
              weight="duotone"
              color="var(--app-success)"
              style={{ flexShrink: 0 }}
            />
          </AppGroup>
          <AppMono size="20px">{money(totals.amount)}</AppMono>
        </AppCard>

        <AppCard p={{ base: 12, sm: "md" }}>
          <AppGroup justify="space-between" align="flex-start" mb={4} wrap="nowrap">
            <AppText
              fz={{ base: 10, sm: "xs" }}
              fw={700}
              c="var(--app-text-secondary)"
              tt="uppercase"
              truncate
            >
              {t("approvedHours")}
            </AppText>
            <CheckCircle
              size={18}
              weight="duotone"
              color="var(--app-brand-primary)"
              style={{ flexShrink: 0 }}
            />
          </AppGroup>
          <AppGroup gap={4} align="baseline" wrap="nowrap">
            <AppMono size="20px">{totals.approvalRate.toFixed(0)}%</AppMono>
            <AppText fz={11} c="var(--app-text-secondary)" truncate>
              ({sortedRows.filter((r) => r.status === "approved").length}/{sortedRows.length})
            </AppText>
          </AppGroup>
        </AppCard>
      </AppGrid>

      {/* Modern Analytics & Chart Section */}
      {(totals.projectBreakdown.length > 0 || totals.daily.length > 0) && (
        <AppCard>
          <div className="app-folder-tabs-row">
            <div className="app-section-heading">
              <ChartBar size={20} weight="duotone" color="var(--app-brand-primary)" />
              <AppText fw={700} fz="sm">
                {chartView === "project" ? t("byProject") : t("dailyTrend")}
              </AppText>
            </div>
            <AppFolderTabs
              compact
              value={chartView}
              onChange={(v) => setChartView(v as "project" | "daily")}
              items={[
                { value: "project", label: t("byProject") },
                { value: "daily", label: t("dailyTrend") },
              ]}
            />
          </div>
          {chartView === "project" ? (
            totals.projectBreakdown.length === 0 ? (
              <AppText c="var(--app-text-secondary)" ta="center" py="xl">
                {t("noEntries")}
              </AppText>
            ) : (
              <AppGrid cols={{ base: 1, md: 2 }}>
                {/* Donut Chart with Center Total Stat */}
                <AppStack align="center" justify="center" py="xs">
                  <AppDonutChart
                    data={totals.projectBreakdown.map((p) => ({
                      name: p.name,
                      value: p.value,
                      color: p.color,
                    }))}
                    size={210}
                    thickness={26}
                    paddingAngle={3}
                    valueFormatter={(v) => formatHoursMinutes(v)}
                    chartLabel={formatHoursMinutes(totals.hours)}
                  />
                </AppStack>

                {/* Ranked Project List Breakdown */}
                <AppStack gap="xs" style={{ maxHeight: 250, overflowY: "auto", paddingRight: 6 }}>
                  {totals.projectBreakdown.map((p) => (
                    <AppStack
                      key={p.name}
                      gap={4}
                      p="xs"
                      style={{
                        background: "var(--app-bg-surface)",
                        borderRadius: "var(--app-radius-sm)",
                        border: "1px solid var(--app-border-subtle)",
                      }}
                    >
                      <AppGroup justify="space-between" align="center" wrap="nowrap">
                        <AppGroup gap={8} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                          <AppBox
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              background: p.color,
                              flexShrink: 0,
                            }}
                          />
                          <AppText fz="xs" fw={600} truncate c="var(--app-text-primary)">
                            {p.name}
                          </AppText>
                          {p.customerName && (
                            <AppText
                              fz="11px"
                              c="var(--app-text-secondary)"
                              truncate
                              visibleFrom="xs"
                            >
                              · {p.customerName}
                            </AppText>
                          )}
                        </AppGroup>
                        <AppGroup gap={8} wrap="nowrap" style={{ flexShrink: 0 }}>
                          <AppTooltip
                            label={
                              <div style={{ lineHeight: 1.4, fontSize: 12 }}>
                                <div style={{ fontWeight: 600 }}>{formatHoursMinutes(p.hours)}</div>
                                <div style={{ opacity: 0.85 }}>{fmtHours(p.hours)}</div>
                              </div>
                            }
                            withArrow
                          >
                            <div style={{ cursor: "default", display: "inline-block" }}>
                              <AppMono size="12px" fw={700} c="var(--app-text-primary)">
                                {formatHoursMinutes(p.hours)}
                              </AppMono>
                            </div>
                          </AppTooltip>
                          <AppBadge size="xs" variant="light" color="gray" style={{ minWidth: 42 }}>
                            {p.percentage.toFixed(0)}%
                          </AppBadge>
                        </AppGroup>
                      </AppGroup>
                      <AppProgress value={p.percentage} color={p.color} size={4} radius="xl" />
                    </AppStack>
                  ))}
                </AppStack>
              </AppGrid>
            )
          ) : totals.daily.length === 0 ? (
            <AppText c="var(--app-text-secondary)" ta="center" py="xl">
              {t("noEntries")}
            </AppText>
          ) : (
            <AppStack gap="md" mt="md">
              {/* Daily Trend KPI Summary Row & Style Switcher */}
              <AppGroup justify="space-between" align="center" wrap="wrap" gap="sm">
                <AppGroup gap="xs" wrap="wrap">
                  {/* Worked Days Badge */}
                  <AppBox
                    style={{
                      background: "var(--app-bg-surface)",
                      border: "1px solid var(--app-border-subtle)",
                      borderRadius: "var(--app-radius-md)",
                      padding: "6px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <CalendarCheck size={18} weight="duotone" color="var(--app-brand-primary)" />
                    <AppStack gap={0}>
                      <AppText fz={10} fw={600} c="var(--app-text-secondary)" tt="uppercase">
                        {t("workedDays")}
                      </AppText>
                      <AppGroup gap={4} align="baseline">
                        <AppMono size="15px" fw={700}>
                          {totals.workedDays}
                        </AppMono>
                        {totals.totalDays > totals.workedDays && (
                          <AppText fz={11} c="var(--app-text-secondary)">
                            / {totals.totalDays}
                          </AppText>
                        )}
                      </AppGroup>
                    </AppStack>
                  </AppBox>

                  {/* Daily Average Badge */}
                  <AppBox
                    style={{
                      background: "var(--app-bg-surface)",
                      border: "1px solid var(--app-border-subtle)",
                      borderRadius: "var(--app-radius-md)",
                      padding: "6px 14px",
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Clock size={18} weight="duotone" color="var(--app-brand-primary)" />
                    <AppStack gap={0}>
                      <AppText fz={10} fw={600} c="var(--app-text-secondary)" tt="uppercase">
                        {t("dailyAverage")}
                      </AppText>
                      <AppMono size="15px" fw={700}>
                        {totals.avgDailyHours > 0 ? formatHoursMinutes(totals.avgDailyHours) : "—"}
                      </AppMono>
                    </AppStack>
                  </AppBox>

                  {/* Peak Day Badge */}
                  {totals.peakDay && totals.peakDay.hours > 0 && (
                    <AppBox
                      style={{
                        background: "var(--app-bg-surface)",
                        border: "1px solid var(--app-border-subtle)",
                        borderRadius: "var(--app-radius-md)",
                        padding: "6px 14px",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <Lightning size={18} weight="duotone" color="#f59e0b" />
                      <AppStack gap={0}>
                        <AppText fz={10} fw={600} c="var(--app-text-secondary)" tt="uppercase">
                          {t("peakDay")}
                        </AppText>
                        <AppGroup gap={4} align="baseline">
                          <AppMono size="15px" fw={700} c="#f59e0b">
                            {formatHoursMinutes(totals.peakDay.hours)}
                          </AppMono>
                          <AppText fz={11} c="var(--app-text-secondary)">
                            ({totals.peakDay.label})
                          </AppText>
                        </AppGroup>
                      </AppStack>
                    </AppBox>
                  )}
                </AppGroup>
              </AppGroup>

              {/* Chart Visualization (Rounded Bar Chart Default) */}
              <AppBox pt="xs">
                <AppBarChart
                  h={250}
                  data={totals.daily}
                  dataKey="label"
                  series={[{ name: "hours", color: "#009FE3", label: t("hours") }]}
                  maxBarWidth={28}
                  barProps={{ radius: [6, 6, 0, 0] }}
                  gridAxis="x"
                  tickLine="none"
                  withXAxis={false}
                  withYAxis
                  yAxisProps={{
                    stroke: "transparent",
                    width: 44,
                    tickFormatter: (v: number) => `${v} h`,
                  }}
                  referenceLines={
                    totals.avgDailyHours > 0
                      ? [
                          {
                            y: totals.avgDailyHours,
                            color: "#009FE3",
                            strokeDasharray: "4 4",
                            label: `${t("avgLineLabel")}: ${formatHoursMinutes(totals.avgDailyHours)}`,
                          },
                        ]
                      : []
                  }
                  valueFormatter={(v) => formatHoursMinutes(v)}
                />

                {/* Clean From-To Date Range Timeline Bar (replaces overcrowded axis ticks) */}
                <AppGroup
                  justify="space-between"
                  align="center"
                  pt="xs"
                  px="xs"
                  style={{
                    borderTop: "1px solid var(--app-border-subtle)",
                    marginTop: 8,
                  }}
                >
                  <AppGroup gap={6} align="center">
                    <CalendarBlank size={14} weight="duotone" color="var(--app-brand-primary)" />
                    <AppText fz="xs" fw={500} c="var(--app-text-secondary)">
                      {t("from")}:{" "}
                      <AppMono fw={700} c="var(--app-text-primary)">
                        {fmtDate(from)}
                      </AppMono>
                    </AppText>
                  </AppGroup>

                  <AppBadge size="xs" variant="light" color="gray" radius="sm">
                    {totals.daily.length} {t("days")} · {totals.workedDays} {t("workedDays")}
                  </AppBadge>

                  <AppGroup gap={6} align="center">
                    <CalendarBlank size={14} weight="duotone" color="var(--app-brand-primary)" />
                    <AppText fz="xs" fw={500} c="var(--app-text-secondary)">
                      {t("to")}:{" "}
                      <AppMono fw={700} c="var(--app-text-primary)">
                        {fmtDate(to)}
                      </AppMono>
                    </AppText>
                  </AppGroup>
                </AppGroup>
              </AppBox>
            </AppStack>
          )}
        </AppCard>
      )}

      {/* Entries Table Section with Sorting Toolbar (matches screenshot + sort options) */}
      <AppCard>
        <AppGroup justify="space-between" align="center" mb="sm" wrap="wrap" gap="xs">
          {/* Export Action Buttons - Visible on desktop */}
          <AppGroup gap="xs" visibleFrom="sm">
            {(["pdf", "xlsx", "csv", "html"] as const).map((k) => (
              <AppButton
                key={k}
                size="xs"
                variant="light"
                leftSection={<FileArrowDown weight="duotone" size={14} />}
                disabled={!sortedRows.length}
                onClick={() => doExport(k)}
              >
                {k.toUpperCase()}
              </AppButton>
            ))}
          </AppGroup>

          {/* Quick Sort Dropdown and Direction Toggle */}
          <AppGroup
            gap="xs"
            align="center"
            style={{
              flex: 1,
              minWidth: 0,
              justifyContent: "flex-end",
            }}
          >
            <AppText fz="xs" fw={600} c="var(--app-text-secondary)" visibleFrom="xs">
              {t("sortBy")}:
            </AppText>
            <AppSelect
              size="xs"
              style={{ flex: 1, maxWidth: 200 }}
              placeholder={t("sortBy")}
              value={sortField}
              onChange={(v) => v && setSortField(v as SortField)}
              data={[
                { value: "date", label: `${t("date")}` },
                { value: "hours", label: `${t("hours")}` },
                { value: "project", label: `${t("project")}` },
                ...(isAdmin ? [{ value: "user", label: `${t("user")}` }] : []),
                { value: "status", label: `${t("status")}` },
              ]}
            />
            <AppTooltip
              label={sortDirection === "asc" ? t("hoursAsc") : t("hoursDesc")}
              position="top"
            >
              <AppIconButton
                size="sm"
                variant="default"
                onClick={() => setSortDirection((d) => (d === "asc" ? "desc" : "asc"))}
                aria-label="Toggle sort direction"
              >
                <ArrowsDownUp size={16} weight="duotone" />
              </AppIconButton>
            </AppTooltip>
          </AppGroup>
        </AppGroup>

        <AppDataTable<ReportRow>
          rows={sortedRows}
          rowKey={(r) => r.id}
          sortState={{ key: sortField, direction: sortDirection }}
          onSort={handleSortColumn}
          empty={report.isLoading ? "…" : t("noEntries")}
          scrollable
          minWidth={780}
          maxHeight={520}
          stickyHeader
          onRowClick={(r) => {
            if (isAdmin) {
              setEditing(r);
            } else if (canUserEdit(r)) {
              setOwnEditing(toLocal(r));
              setOwnReadOnly(false);
            } else {
              setOwnEditing(toLocal(r));
              setOwnReadOnly(true);
            }
          }}
          columns={[
            {
              key: "date",
              label: t("date"),
              sortable: true,
              render: (r) => (
                <AppText fz="sm" fw={600}>
                  {fmtDate(r.entry_date)}
                </AppText>
              ),
            },
            ...(isAdmin
              ? [
                  {
                    key: "user",
                    label: t("user"),
                    sortable: true,
                    render: (r: ReportRow) => (
                      <AppText fz="sm" c="var(--app-text-primary)">
                        {r.user_name}
                      </AppText>
                    ),
                  },
                ]
              : []),
            {
              key: "project",
              label: t("project"),
              sortable: true,
              render: (r) => (
                <AppStack gap={2}>
                  <AppText fz="sm" fw={600} c="var(--app-text-primary)">
                    {r.project_name}
                  </AppText>
                  <AppText fz="xs" c="var(--app-text-secondary)">
                    {r.customer_name}
                  </AppText>
                </AppStack>
              ),
            },
            {
              key: "time",
              label: t("time"),
              sortable: false,
              render: (r) => (
                <AppMono size="13px">
                  {r.from_time}–{r.to_time}
                </AppMono>
              ),
            },
            {
              key: "hours",
              label: t("hoursColumn"),
              sortable: true,
              render: (r) => {
                const durationHM =
                  r.from_time && r.to_time
                    ? formatSlotDuration(r.from_time, r.to_time)
                    : formatHoursMinutes(r.hours);
                return (
                  <AppTooltip
                    label={
                      <div style={{ lineHeight: 1.4, fontSize: 12 }}>
                        <div style={{ fontWeight: 600 }}>{durationHM}</div>
                        <div style={{ opacity: 0.85 }}>{fmtHours(r.hours)}</div>
                      </div>
                    }
                    withArrow
                    position="top-start"
                  >
                    <div style={{ cursor: "default", display: "inline-block" }}>
                      <AppMono size="13px" fw={700}>
                        {durationHM}
                      </AppMono>
                    </div>
                  </AppTooltip>
                );
              },
            },
            {
              key: "status",
              label: t("status"),
              sortable: true,
              render: (r) => (
                <AppGroup gap={6} wrap="nowrap">
                  <AppBadge
                    color={
                      r.status === "approved" ? "green" : r.status === "rejected" ? "red" : "orange"
                    }
                    variant="light"
                  >
                    {r.status === "approved"
                      ? t("approved")
                      : r.status === "rejected"
                        ? t("reject")
                        : t("pendingApproval")}
                  </AppBadge>
                  {r.exported && (
                    <AppTooltip label={t("exportedLocked")}>
                      <AppBadge color="gray" variant="light" leftSection={<LockSimple size={10} />}>
                        🔒
                      </AppBadge>
                    </AppTooltip>
                  )}
                </AppGroup>
              ),
            },
            ...(isAdmin
              ? [
                  {
                    key: "actions",
                    label: "",
                    render: (r: ReportRow) => (
                      <AppButton
                        size="compact-xs"
                        variant="default"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditing(r);
                        }}
                      >
                        {t("edit")}
                      </AppButton>
                    ),
                  },
                ]
              : [
                  {
                    key: "actions",
                    label: "",
                    render: (r: ReportRow) =>
                      canUserEdit(r) ? (
                        <AppButton
                          size="compact-xs"
                          variant="default"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOwnEditing(toLocal(r));
                            setOwnReadOnly(false);
                          }}
                        >
                          {t("edit")}
                        </AppButton>
                      ) : (
                        <AppButton
                          size="compact-xs"
                          variant="subtle"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOwnEditing(toLocal(r));
                            setOwnReadOnly(true);
                          }}
                          aria-label={t("entryDetails")}
                        >
                          🔒
                        </AppButton>
                      ),
                  },
                ]),
          ]}
        />
      </AppCard>

      {!isAdmin && (
        <TimeAllocationModal
          date={ownEditing?.entryDate ?? null}
          entry={ownEditing}
          today={today}
          existing={timeData.entries}
          projects={projects}
          isAdmin={false}
          userId={me?.id ?? ""}
          readOnly={ownReadOnly}
          onClose={() => setOwnEditing(null)}
          onSave={async (e) => {
            await timeData.saveEntry(e);
            setOwnEditing(null);
            report.refetch();
          }}
          onSaveMultiple={async (entries) => {
            await timeData.saveEntries(entries);
            setOwnEditing(null);
            report.refetch();
          }}
          onDelete={async (id) => {
            await timeData.deleteEntry(id);
            setOwnEditing(null);
            report.refetch();
          }}
        />
      )}
      {isAdmin && (
        <AdminEntryModal
          row={editing}
          projects={projects}
          onClose={() => setEditing(null)}
          onSaved={() => report.refetch()}
        />
      )}
    </AppStack>
  );
}
