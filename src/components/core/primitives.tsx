/**
 * lucesem® core wrapper layer. The ONLY place allowed to import @mantine/*.
 * Every visual value comes from --app-* variables defined in src/theme/tokens.ts.
 */
import {
  Button,
  Badge,
  Paper,
  Select,
  CloseButton,
  MultiSelect,
  Tabs,
  Drawer,
  Textarea,
  TextInput,
  SegmentedControl,
  Group,
  Stack,
  SimpleGrid,
  Text,
  Title,
  Progress,
  ActionIcon,
  Tooltip,
  Switch,
  NumberInput,
  PasswordInput,
  Chip,
  Menu,
  Indicator,
  Popover,
  Avatar,
  Alert,
  Center,
  Loader,
  Divider,
  Box,
  ScrollArea,
  type SwitchProps,
  type NumberInputProps,
  type PasswordInputProps,
  type ButtonProps,
  type BadgeProps,
  type PaperProps,
  type SelectProps,
  type MultiSelectProps,
  type DrawerProps,
  type TextareaProps,
  type TextInputProps,
  type SegmentedControlProps,
  type TabsProps,
} from "@mantine/core";
import { DateInput, TimePicker, type DateInputProps } from "@mantine/dates";
import { useState, useMemo, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { ymd } from "@/domain/holidays";

const inputStyles = {
  input: {
    background: "var(--app-bg-surface)",
    borderColor: "var(--app-border-subtle)",
    color: "var(--app-text-primary)",
  },
  label: { color: "var(--app-text-primary)", fontWeight: 600, marginBottom: 4 },
  dropdown: {
    background: "var(--app-bg-surface)",
    borderColor: "var(--app-border-subtle)",
    boxShadow: "var(--app-shadow-elevated)",
    color: "var(--app-text-primary)",
  },
};

export function AppButton(props: ButtonProps & ComponentPropsWithoutRef<"button">) {
  return <Button radius="md" fw={600} {...props} />;
}

export function AppBadge(props: BadgeProps & { children?: ReactNode }) {
  return <Badge radius="sm" variant="light" tt="none" fw={600} {...props} />;
}

export function AppCard({
  children,
  style,
  floating = false,
  hoverable = false,
  ...rest
}: PaperProps & {
  children?: ReactNode;
  onClick?: () => void;
  id?: string;
  floating?: boolean;
  hoverable?: boolean;
}) {
  return (
    <Paper
      p="md"
      style={{
        background: floating
          ? "var(--app-bg-glass, var(--app-bg-surface))"
          : "var(--app-bg-surface)",
        backdropFilter: floating ? "blur(14px)" : undefined,
        WebkitBackdropFilter: floating ? "blur(14px)" : undefined,
        border: `1px solid ${
          floating
            ? "var(--app-border-glass, var(--app-border-subtle))"
            : "var(--app-border-subtle)"
        }`,
        borderRadius: "var(--app-radius-lg)",
        boxShadow: floating ? "var(--app-shadow-floating)" : "var(--app-shadow-card)",
        backgroundImage: "var(--app-card-highlight)",
        transition:
          "box-shadow 200ms cubic-bezier(0.16, 1, 0.3, 1), transform 200ms cubic-bezier(0.16, 1, 0.3, 1), border-color 200ms ease",
        height: "100%",
        position: "relative",
        ...(hoverable ? { cursor: "pointer" } : {}),
        ...(style as object),
      }}
      {...rest}
    >
      {children}
    </Paper>
  );
}

/** X button shown in the field while a dropdown is open, so it can be closed explicitly. */
function useCloseableDropdown() {
  const [open, setOpen] = useState(false);
  const closeBtn = open ? (
    <CloseButton
      size="sm"
      aria-label="Close"
      onMouseDown={(e) => {
        e.preventDefault();
        setOpen(false);
      }}
    />
  ) : undefined;
  return {
    dropdownOpened: open,
    onDropdownOpen: () => setOpen(true),
    onDropdownClose: () => setOpen(false),
    closeBtn,
  };
}
export const AppSelect = (p: SelectProps) => {
  const d = useCloseableDropdown();
  const placeholder = p.placeholder ?? (typeof p.label === "string" ? `${p.label}...` : undefined);
  return (
    <Select
      searchable
      styles={inputStyles}
      comboboxProps={{ shadow: "lg" }}
      placeholder={placeholder}
      {...p}
      dropdownOpened={d.dropdownOpened}
      onDropdownOpen={d.onDropdownOpen}
      onDropdownClose={d.onDropdownClose}
      {...(d.closeBtn
        ? { rightSection: d.closeBtn, rightSectionPointerEvents: "all" as const }
        : {})}
    />
  );
};
export const AppMultiSelect = (p: MultiSelectProps) => {
  const d = useCloseableDropdown();
  const placeholder = p.placeholder ?? (typeof p.label === "string" ? `${p.label}...` : undefined);
  return (
    <MultiSelect
      searchable
      styles={inputStyles}
      placeholder={placeholder}
      {...p}
      dropdownOpened={d.dropdownOpened}
      onDropdownOpen={d.onDropdownOpen}
      onDropdownClose={d.onDropdownClose}
      {...(d.closeBtn
        ? { rightSection: d.closeBtn, rightSectionPointerEvents: "all" as const }
        : {})}
    />
  );
};
export const AppTextarea = ({ minRows = 3, maxRows = 4, styles, ...p }: TextareaProps) => {
  const mergedStyles = {
    ...inputStyles,
    input: {
      ...inputStyles.input,
      overflowY: "auto" as const,
      resize: "none" as const,
      scrollbarWidth: "none" as const,
      msOverflowStyle: "none" as const,
    },
    ...(typeof styles === "object" ? styles : {}),
  };
  return <Textarea autosize minRows={minRows} maxRows={maxRows} styles={mergedStyles} {...p} />;
};
export const AppTextInput = (p: TextInputProps) => <TextInput styles={inputStyles} {...p} />;

export function parseYmd(val: string | Date | null | undefined): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val !== "string") return null;
  const parts = val.split("-");
  const p0 = parts[0];
  const p1 = parts[1];
  const p2 = parts[2];
  if (parts.length === 3 && p0 && p1 && p2) {
    const y = parseInt(p0, 10);
    const m = parseInt(p1, 10) - 1;
    const d = parseInt(p2, 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      const date = new Date(y, m, d);
      return isNaN(date.getTime()) ? null : date;
    }
  }
  const date = new Date(val);
  return isNaN(date.getTime()) ? null : date;
}

export function toYmdString(val: unknown): string {
  if (!val) return "";
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
    const d = parseYmd(trimmed);
    return d ? ymd(d) : "";
  }
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? "" : ymd(val);
  }
  return "";
}

export function toDateObj(val: unknown): Date | null {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  if (typeof val === "string") return parseYmd(val);
  return null;
}

export interface AppDateInputProps extends Omit<
  DateInputProps,
  "value" | "onChange" | "minDate" | "maxDate"
> {
  value?: string | Date | null | undefined;
  onChange?: ((val: string) => void) | undefined;
  minDate?: string | Date | null | undefined;
  maxDate?: string | Date | null | undefined;
}

export const AppDateInput = ({
  value,
  onChange,
  minDate,
  maxDate,
  styles,
  popoverProps,
  valueFormat = "DD.MM.YYYY",
  placeholder = "DD.MM.YYYY",
  clearable = true,
  dateParser,
  ...rest
}: AppDateInputProps) => {
  // Normalize value to a stable string ("YYYY-MM-DD" or null).
  // Passing a string primitive prevents DateInput's internal useEffect([controlled, value])
  // from re-triggering on every render (which a new Date instance would do), allowing users
  // to freely browse previous/next months without the calendar resetting back to the current month.
  const stringValue = useMemo(() => {
    if (!value) return null;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
      if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return trimmed.slice(0, 10);
      const d = parseYmd(trimmed);
      return d ? ymd(d) : null;
    }
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : ymd(value);
    }
    return null;
  }, [value]);

  const defaultDateParser = (input: string) => {
    if (!input) return null;
    const trimmed = input.trim();
    const dmy = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
    const dmy1 = dmy?.[1];
    const dmy2 = dmy?.[2];
    const dmy3 = dmy?.[3];
    if (dmy && dmy1 && dmy2 && dmy3) {
      const d = parseInt(dmy1, 10);
      const m = parseInt(dmy2, 10);
      const y = parseInt(dmy3, 10);
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
    const ymdMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
    const ymd1 = ymdMatch?.[1];
    const ymd2 = ymdMatch?.[2];
    const ymd3 = ymdMatch?.[3];
    if (ymdMatch && ymd1 && ymd2 && ymd3) {
      return `${ymd1}-${String(parseInt(ymd2, 10)).padStart(2, "0")}-${String(parseInt(ymd3, 10)).padStart(2, "0")}`;
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : ymd(d);
  };

  const handleChange = (incoming: unknown) => {
    if (!onChange) return;
    onChange(toYmdString(incoming));
  };

  const minDateObj = toDateObj(minDate);
  const maxDateObj = toDateObj(maxDate);

  return (
    <DateInput
      valueFormat={valueFormat}
      placeholder={placeholder}
      value={stringValue}
      onChange={handleChange as (val: unknown) => void}
      clearable={clearable}
      dateParser={dateParser ?? defaultDateParser}
      {...(minDateObj ? { minDate: minDateObj } : {})}
      {...(maxDateObj ? { maxDate: maxDateObj } : {})}
      popoverProps={{
        shadow: "lg",
        withinPortal: true,
        zIndex: 1000,
        styles: {
          dropdown: inputStyles.dropdown,
        },
        ...popoverProps,
      }}
      styles={{
        input: inputStyles.input,
        calendarHeaderControl: {
          color: "var(--app-text-primary)",
        },
        calendarHeaderLevel: {
          color: "var(--app-text-primary)",
          fontWeight: 600,
        },
        weekday: {
          color: "var(--app-text-secondary)",
          fontWeight: 600,
        },
        day: {
          borderRadius: "var(--app-radius-sm)",
        },
        ...(styles as object),
      }}
      {...rest}
    />
  );
};

/** 24h European HH:mm */
export function AppTimePicker(p: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string | undefined;
  max?: string | undefined;
  min?: string | undefined;
}) {
  return (
    <TimePicker
      label={p.label}
      format="24h"
      withDropdown
      clearable
      {...(p.max ? { max: p.max } : {})}
      {...(p.min ? { min: p.min } : {})}
      value={p.value}
      error={p.error}
      onChange={(v) => p.onChange(v ? v.slice(0, 5) : "")}
      popoverProps={{ withinPortal: true, zIndex: 1000 }}
      styles={{
        ...inputStyles,
        input: { ...inputStyles.input, fontFamily: "var(--app-font-mono)" },
      }}
    />
  );
}

export const AppSegmented = (p: SegmentedControlProps) => (
  <SegmentedControl
    radius="md"
    styles={{ root: { background: "var(--app-bg-elevated)" } }}
    {...p}
  />
);

export const AppTabs = (p: TabsProps) => <Tabs color="lucesem" {...p} />;
AppTabs.List = Tabs.List;
AppTabs.Tab = Tabs.Tab;
AppTabs.Panel = Tabs.Panel;

export interface AppFolderTabItem {
  value: string;
  label: ReactNode;
  icon?: ReactNode;
  isAdd?: boolean;
}

export function AppFolderTabs({
  value,
  onChange,
  items,
  compact = false,
  className,
  style,
}: {
  value: string;
  onChange: (val: string) => void;
  items: AppFolderTabItem[];
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`app-folder-tabs-list ${compact ? "is-compact" : ""} ${className ?? ""}`}
      style={style}
      role="tablist"
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            data-active={active}
            className={`app-folder-tab ${compact ? "is-compact" : ""} ${item.isAdd ? "is-add" : ""} ${active ? "is-active" : ""}`}
            onClick={() => onChange(item.value)}
          >
            {item.icon}
            <span>{item.label}</span>
            {active && <span className="app-tab-active-indicator" />}
          </button>
        );
      })}
    </div>
  );
}

export const AppDrawer = (p: DrawerProps) => (
  <Drawer
    styles={{
      content: { background: "var(--app-bg-surface)" },
      header: { background: "var(--app-bg-surface)" },
    }}
    {...p}
  />
);

export function AppHeading({
  children,
  order = 2,
  style,
  className,
}: {
  children: ReactNode;
  order?: 1 | 2 | 3 | 4;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <Title
      order={order}
      {...(className ? { className } : {})}
      style={{
        fontFamily: "var(--app-font-heading)",
        letterSpacing: "var(--app-heading-tracking)",
        color: "var(--app-text-primary)",
        ...style,
      }}
    >
      {children}
    </Title>
  );
}

export function AppMono({
  children,
  size = "md",
  fw = 600,
  c,
  className,
}: {
  children: ReactNode;
  size?: string;
  fw?: number | string | undefined;
  c?: string | undefined;
  className?: string | undefined;
}) {
  return (
    <Text
      component="span"
      ff="var(--app-font-mono)"
      fz={size}
      fw={fw}
      c={c ?? "var(--app-text-primary)"}
      {...(className !== undefined ? { className } : {})}
    >
      {children}
    </Text>
  );
}

export function AppGrid({
  children,
  cols = { base: 1, sm: 2, lg: 4 },
}: {
  children: ReactNode;
  cols?: Record<string, number>;
}) {
  return (
    <SimpleGrid cols={cols} spacing="var(--app-grid-gap)" verticalSpacing="var(--app-grid-gap)">
      {children}
    </SimpleGrid>
  );
}

export const AppText = Text;
export const AppGroup = Group;
export const AppStack = Stack;
export const AppProgress = Progress;
export const AppIconButton = ActionIcon;
export const AppTooltip = Tooltip;
export { notify } from "./notify";

export const AppSwitch = (p: SwitchProps) => <Switch color="lucesem" {...p} />;
export const AppNumberInput = (p: NumberInputProps) => (
  <NumberInput decimalSeparator="," thousandSeparator="." styles={inputStyles} {...p} />
);
export const AppPasswordInput = (p: PasswordInputProps) => (
  <PasswordInput styles={inputStyles} {...p} />
);
export const AppChip = Chip;
export const AppMenu = Menu;
export const AppIndicator = Indicator;
export const AppPopover = Popover;
export const AppAvatar = Avatar;
export const AppAlert = Alert;
export const AppCenter = Center;
export const AppLoader = Loader;
export const AppDivider = Divider;
export const AppBox = Box;
export const AppScrollArea = ScrollArea;
