import {
  Box,
  Group,
  SimpleGrid,
  Text,
  UnstyledButton,
  ActionIcon,
  Select,
  Button,
  Stack,
} from "@mantine/core";
import { CaretLeft, CaretRight, ArrowCounterClockwise } from "@phosphor-icons/react";
import { ymd } from "@/domain/holidays";
import { useI18n } from "@/lib/i18n";

export interface CalendarDayInfo {
  hours?: number | undefined;
  label?: string | undefined;
  muted?: boolean | undefined;
  disabled?: boolean | undefined;
  tone?: "holiday" | "locked" | "pending" | undefined;
}

interface Props {
  month: Date;
  onMonthChange: (d: Date) => void;
  onSelect: (date: string) => void;
  dayInfo: (date: string) => CalendarDayInfo;
  weekdayLabels: string[];
  monthLabel: string;
  today: string;
  selectedDate?: string | null | undefined;
}

/** Month grid with month/year selects, direct date picker, quick today jump, and equal-sized cells. */
export function AppCalendar({
  month,
  onMonthChange,
  onSelect,
  dayInfo,
  weekdayLabels,
  today,
  selectedDate,
}: Props) {
  const { lang, t } = useI18n();

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 12 }, (_, i) => {
    const y = currentYear - 6 + i;
    return { value: String(y), label: String(y) };
  });

  const monthOptions = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(2026, i, 1);
    const name = d.toLocaleDateString(lang === "de" ? "de-AT" : "en-US", { month: "long" });
    return { value: String(i), label: name.charAt(0).toUpperCase() + name.slice(1) };
  });

  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const cells = Array.from(
    { length: 42 },
    (_, i) => new Date(first.getFullYear(), first.getMonth(), i - offset + 1),
  );
  const toneColor = {
    holiday: "var(--app-warning)",
    locked: "var(--app-locked)",
    pending: "var(--app-warning)",
  };

  const jumpToToday = () => {
    const now = new Date();
    onMonthChange(new Date(now.getFullYear(), now.getMonth(), 1));
    onSelect(today);
  };

  return (
    <Box>
      {/* Top Controls: Month Select, Year Select, Navigation & Today Jump */}
      <Stack gap="xs" mb="sm">
        <Group justify="space-between" align="center" wrap="wrap" gap="xs">
          <Group gap="xs" align="center" style={{ flex: 1, minWidth: 220 }}>
            <Select
              size="xs"
              value={String(month.getMonth())}
              onChange={(val) => {
                if (val !== null) {
                  onMonthChange(new Date(month.getFullYear(), Number(val), 1));
                }
              }}
              data={monthOptions}
              allowDeselect={false}
              aria-label={t("selectMonth")}
              style={{ flex: 1, minWidth: 120, maxWidth: 160 }}
              comboboxProps={{ shadow: "lg", withinPortal: true, zIndex: 1000 }}
              styles={{
                input: {
                  fontWeight: 600,
                  background: "var(--app-bg-surface)",
                  borderColor: "var(--app-border-subtle)",
                  color: "var(--app-text-primary)",
                },
                dropdown: {
                  background: "var(--app-bg-surface)",
                  borderColor: "var(--app-border-subtle)",
                  boxShadow: "var(--app-shadow-elevated)",
                },
              }}
            />
            <Select
              size="xs"
              value={String(month.getFullYear())}
              onChange={(val) => {
                if (val !== null) {
                  onMonthChange(new Date(Number(val), month.getMonth(), 1));
                }
              }}
              data={yearOptions}
              allowDeselect={false}
              aria-label={t("selectYear")}
              style={{ width: 85 }}
              comboboxProps={{ shadow: "lg", withinPortal: true, zIndex: 1000 }}
              styles={{
                input: {
                  fontWeight: 600,
                  background: "var(--app-bg-surface)",
                  borderColor: "var(--app-border-subtle)",
                  color: "var(--app-text-primary)",
                },
                dropdown: {
                  background: "var(--app-bg-surface)",
                  borderColor: "var(--app-border-subtle)",
                  boxShadow: "var(--app-shadow-elevated)",
                },
              }}
            />
          </Group>

          <Group gap={6} align="center">
            <Button
              size="xs"
              variant="light"
              color="lucesem"
              onClick={jumpToToday}
              leftSection={<ArrowCounterClockwise size={12} weight="bold" />}
              style={{ height: 30, fontSize: 12 }}
            >
              {t("goToToday")}
            </Button>
            <ActionIcon
              variant="default"
              size="sm"
              onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
              aria-label="Previous month"
              style={{ height: 30, width: 30 }}
            >
              <CaretLeft weight="duotone" size={16} />
            </ActionIcon>
            <ActionIcon
              variant="default"
              size="sm"
              onClick={() => onMonthChange(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
              aria-label="Next month"
              style={{ height: 30, width: 30 }}
            >
              <CaretRight weight="duotone" size={16} />
            </ActionIcon>
          </Group>
        </Group>
      </Stack>

      {/* Weekdays */}
      <SimpleGrid cols={7} spacing={4} mb={4}>
        {weekdayLabels.map((w) => (
          <Text key={w} ta="center" fz="xs" fw={600} c="var(--app-text-secondary)">
            {w}
          </Text>
        ))}
      </SimpleGrid>

      {/* Days Grid */}
      <SimpleGrid cols={7} spacing={4}>
        {cells.map((d) => {
          const key = ymd(d);
          const inMonth = d.getMonth() === month.getMonth();
          const info = dayInfo(key);
          const isToday = key === today;
          const isSelected = key === selectedDate;
          return (
            <UnstyledButton
              key={key}
              className="app-calendar-day"
              disabled={info.disabled}
              data-disabled={info.disabled || undefined}
              onClick={() => !info.disabled && onSelect(key)}
              style={{
                cursor: info.disabled ? "not-allowed" : "pointer",
                aspectRatio: "1 / 1",
                minHeight: 44,
                borderRadius: "var(--app-radius-sm)",
                border: isSelected
                  ? "2px solid var(--app-brand-primary)"
                  : `1px solid ${isToday ? "var(--app-brand-primary)" : "var(--app-border-subtle)"}`,
                background: isSelected
                  ? "var(--app-hover-surface)"
                  : info.muted || !inMonth
                    ? "var(--app-bg-canvas)"
                    : "var(--app-bg-surface)",
                boxShadow: isSelected ? "0 0 0 1px var(--app-brand-primary)" : undefined,
                opacity: info.disabled ? 0.35 : inMonth ? 1 : 0.45,
                padding: 4,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                overflow: "hidden",
                transition: "border-color 150ms ease, background 150ms ease",
              }}
            >
              <Group justify="space-between" align="center" gap={2}>
                <Text
                  fz="xs"
                  fw={isSelected || isToday ? 700 : 500}
                  c={isSelected || isToday ? "var(--app-brand-primary)" : "var(--app-text-primary)"}
                >
                  {d.getDate()}
                </Text>
                {isToday && (
                  <Box
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: "var(--app-brand-primary)",
                    }}
                  />
                )}
              </Group>
              {info.hours ? (
                <Text fz={10} ff="var(--app-font-mono)" fw={600} c="var(--app-brand-primary)">
                  {info.hours.toFixed(1)}
                </Text>
              ) : info.tone ? (
                <Box
                  style={{ height: 4, borderRadius: 2, background: toneColor[info.tone] }}
                  title={info.label}
                />
              ) : null}
            </UnstyledButton>
          );
        })}
      </SimpleGrid>
    </Box>
  );
}
