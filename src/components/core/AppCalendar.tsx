import {
  ActionIcon,
  Badge,
  Box,
  Button,
  Group,
  Menu,
  ScrollArea,
  SimpleGrid,
  Text,
  UnstyledButton,
} from "@mantine/core";
import {
  CaretLeft,
  CaretRight,
  CaretDown,
  ArrowCounterClockwise,
  Clock,
} from "@phosphor-icons/react";
import { ymd } from "@/domain/holidays";
import { useI18n } from "@/lib/i18n";

export interface CalendarDayInfo {
  hours?: number | undefined;
  label?: string | undefined;
  muted?: boolean | undefined;
  disabled?: boolean | undefined;
  tone?: "holiday" | "locked" | "pending" | "vacation" | "sick" | "comp" | undefined;
  absenceMode?: string | undefined;
}

interface Props {
  month: Date;
  onMonthChange: (d: Date) => void;
  onSelect: (date: string) => void;
  dayInfo: (date: string) => CalendarDayInfo;
  weekdayLabels: string[];
  today: string;
  selectedDate?: string | null | undefined;
}

const toneColor = {
  holiday: "var(--app-warning)",
  locked: "var(--app-locked)",
  pending: "var(--app-warning)",
  vacation: "var(--app-brand-primary)",
  sick: "var(--app-danger)",
  comp: "var(--app-brand-secondary, #a855f7)",
} as const;

/**
 * Modern month grid for the dashboard:
 * - Clean pill dropdowns for month & year with active item highlighting
 * - Symmetrical navigation cluster (prev, today, next)
 * - Rock-solid cell baseline: day numbers and indicator slots never jump vertically
 * - Modern monospace micro-chip for logged hours
 * - High-contrast selected state and refined today indicator
 * - Executive status footer with icon, label, and hours badge
 */
export function AppCalendar({
  month,
  onMonthChange,
  onSelect,
  dayInfo,
  weekdayLabels,
  today,
  selectedDate,
}: Props) {
  const { lang, t, fmtDate, fmtHours } = useI18n();
  const locale = lang === "de" ? "de-AT" : "en-US";

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 12 }, (_, i) => {
    const y = currentYear - 6 + i;
    return { value: String(y), label: String(y) };
  });
  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const name = new Date(currentYear, i, 1).toLocaleDateString(locale, { month: "long" });
    return { value: String(i), label: name.charAt(0).toUpperCase() + name.slice(1) };
  });

  // Only render the weeks the month actually occupies (5 or 6 rows).
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Array.from(
    { length: Math.ceil((offset + daysInMonth) / 7) * 7 },
    (_, i) => new Date(first.getFullYear(), first.getMonth(), i - offset + 1),
  );

  // Month summary: total logged hours and whether any holiday / vacation marker shows.
  let monthTotal = 0;
  let hasHoliday = false;
  let hasVacation = false;
  for (const d of cells) {
    if (d.getMonth() !== month.getMonth()) continue;
    const info = dayInfo(ymd(d));
    monthTotal += info.hours ?? 0;
    if (info.tone === "holiday") hasHoliday = true;
    if (info.absenceMode === "Vacation_Urlaub") hasVacation = true;
  }

  const jumpToToday = () => {
    const now = new Date();
    onMonthChange(new Date(now.getFullYear(), now.getMonth(), 1));
    onSelect(today);
  };

  const compactHours = (h: number) =>
    h.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const activeMonthName = monthOptions[month.getMonth()]?.label ?? "";

  return (
    <Box>
      {/* Header: sleek month/year pill dropdowns + joined navigation cluster */}
      <Group justify="space-between" align="center" gap="xs" mb="md" wrap="nowrap">
        <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
          {/* Month Dropdown */}
          <Menu
            shadow="md"
            width={160}
            position="bottom-start"
            radius="md"
            withinPortal
            zIndex={1000}
          >
            <Menu.Target>
              <UnstyledButton className="app-cal-header-pill" aria-label={t("selectMonth")}>
                <Text fw={700} fz="sm" c="var(--app-text-primary)">
                  {activeMonthName}
                </Text>
                <CaretDown size={12} weight="bold" style={{ color: "var(--app-text-secondary)" }} />
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown className="app-cal-dropdown">
              <ScrollArea.Autosize mah={260}>
                {monthOptions.map((opt) => {
                  const isCurrent = Number(opt.value) === month.getMonth();
                  return (
                    <Menu.Item
                      key={opt.value}
                      onClick={() =>
                        onMonthChange(new Date(month.getFullYear(), Number(opt.value), 1))
                      }
                      className="app-cal-menu-item"
                      data-active={isCurrent || undefined}
                    >
                      {opt.label}
                    </Menu.Item>
                  );
                })}
              </ScrollArea.Autosize>
            </Menu.Dropdown>
          </Menu>

          {/* Year Dropdown */}
          <Menu
            shadow="md"
            width={110}
            position="bottom-start"
            radius="md"
            withinPortal
            zIndex={1000}
          >
            <Menu.Target>
              <UnstyledButton className="app-cal-header-pill" aria-label={t("selectYear")}>
                <Text fw={700} fz="sm" c="var(--app-text-primary)">
                  {month.getFullYear()}
                </Text>
                <CaretDown size={12} weight="bold" style={{ color: "var(--app-text-secondary)" }} />
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown className="app-cal-dropdown">
              <ScrollArea.Autosize mah={260}>
                {yearOptions.map((opt) => {
                  const isCurrent = Number(opt.value) === month.getFullYear();
                  return (
                    <Menu.Item
                      key={opt.value}
                      onClick={() =>
                        onMonthChange(new Date(Number(opt.value), month.getMonth(), 1))
                      }
                      className="app-cal-menu-item"
                      data-active={isCurrent || undefined}
                    >
                      {opt.label}
                    </Menu.Item>
                  );
                })}
              </ScrollArea.Autosize>
            </Menu.Dropdown>
          </Menu>
        </Group>

        {/* Navigation Cluster: Prev, Today, Next */}
        <Box className="app-cal-nav">
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            aria-label={t("prevMonth")}
            className="app-cal-nav-btn"
          >
            <CaretLeft weight="bold" size={14} />
          </ActionIcon>
          <Button
            size="compact-xs"
            variant="subtle"
            color="lucesem"
            onClick={jumpToToday}
            leftSection={<ArrowCounterClockwise size={11} weight="bold" />}
            className="app-cal-today-btn"
          >
            {t("goToToday")}
          </Button>
          <ActionIcon
            variant="subtle"
            color="gray"
            size="sm"
            onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            aria-label={t("nextMonth")}
            className="app-cal-nav-btn"
          >
            <CaretRight weight="bold" size={14} />
          </ActionIcon>
        </Box>
      </Group>

      {/* Weekdays */}
      <SimpleGrid cols={7} spacing={6} mb={8}>
        {weekdayLabels.map((w, idx) => {
          const isWeekend = idx >= 5;
          return (
            <Text
              key={w}
              className="app-cal-weekday"
              data-weekend={isWeekend || undefined}
              ta="center"
            >
              {w}
            </Text>
          );
        })}
      </SimpleGrid>

      {/* Days grid: uniform height & rock-solid baseline */}
      <SimpleGrid cols={7} spacing={6} verticalSpacing={6}>
        {cells.map((d) => {
          const key = ymd(d);
          const inMonth = d.getMonth() === month.getMonth();
          const info = dayInfo(key);
          const isToday = key === today;
          const isSelected = key === selectedDate;
          const dayNum = d.getDate();

          return (
            <UnstyledButton
              key={key}
              className="app-calendar-day"
              data-selected={isSelected || undefined}
              data-today={isToday || undefined}
              data-outside={!inMonth || undefined}
              data-muted={(info.muted && !info.disabled && inMonth) || undefined}
              data-disabled={info.disabled || undefined}
              disabled={info.disabled}
              aria-pressed={isSelected}
              aria-current={isToday ? "date" : undefined}
              aria-label={`${fmtDate(key)}${info.hours ? ` — ${fmtHours(info.hours)}` : ""}${info.label ? ` (${info.label})` : ""}`}
              onClick={() => !info.disabled && onSelect(key)}
            >
              <span className="app-cal-num">{dayNum}</span>
              <span className="app-cal-slot">
                {info.absenceMode ? (
                  <span className="app-cal-absence" data-mode={info.absenceMode} title={info.label}>
                    {info.absenceMode === "Vacation_Urlaub"
                      ? lang === "de"
                        ? "Urlaub"
                        : "Vacation"
                      : info.absenceMode === "SickLeave_Krankenstand"
                        ? lang === "de"
                          ? "Krank"
                          : "Sick"
                        : lang === "de"
                          ? "ZA"
                          : "Comp"}
                  </span>
                ) : info.hours ? (
                  <span className="app-cal-hours">
                    {info.tone && (
                      <span
                        className="app-cal-mini-dot"
                        style={{ backgroundColor: toneColor[info.tone] }}
                      />
                    )}
                    <span className="app-cal-hours-text">{compactHours(info.hours)}</span>
                  </span>
                ) : info.tone ? (
                  <span
                    title={info.label}
                    className="app-cal-dot"
                    style={{ backgroundColor: toneColor[info.tone] }}
                  />
                ) : null}
              </span>
            </UnstyledButton>
          );
        })}
      </SimpleGrid>

      {/* Footer: month summary + holiday / vacation legend */}
      <Box className="app-cal-footer">
        <Group gap={8} wrap="nowrap" align="center">
          <Clock size={15} weight="duotone" style={{ color: "var(--app-brand-primary)" }} />
          <Text fz="xs" fw={500} c="var(--app-text-secondary)">
            {t("calLoggedThisMonth")}
          </Text>
          <Badge
            variant="light"
            color="lucesem"
            size="sm"
            radius="sm"
            styles={{
              root: {
                fontFamily: "var(--app-font-mono)",
                fontWeight: 700,
                letterSpacing: "-0.01em",
                height: 22,
                paddingInline: 8,
              },
            }}
          >
            {fmtHours(monthTotal)}
          </Badge>
        </Group>
        <Group gap={12} wrap="nowrap" align="center">
          {hasHoliday && (
            <Group gap={6} wrap="nowrap" align="center">
              <Box className="app-cal-legend-dot" style={{ backgroundColor: toneColor.holiday }} />
              <Text fz="xs" fw={500} c="var(--app-text-secondary)">
                {t("holiday")}
              </Text>
            </Group>
          )}
          {hasVacation && (
            <Group gap={6} wrap="nowrap" align="center">
              <Box className="app-cal-legend-dot" style={{ backgroundColor: "#06b6d4" }} />
              <Text fz="xs" fw={500} c="var(--app-text-secondary)">
                {t("Vacation_Urlaub")}
              </Text>
            </Group>
          )}
        </Group>
      </Box>
    </Box>
  );
}
