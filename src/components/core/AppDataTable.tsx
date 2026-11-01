import { Table, Stack, Paper, Group, Text, UnstyledButton } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { CaretUp, CaretDown, CaretUpDown } from "@phosphor-icons/react";
import type { ReactNode } from "react";
import { CENTRAL_DESIGN_TOKENS } from "@/theme/tokens";

export interface Column<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  width?: number | string;
}

export interface SortState {
  key: string;
  direction: "asc" | "desc";
}

/** Table on desktop, equal-width stacked cards on mobile with optional column sorting. */
export function AppDataTable<T>({
  rows,
  columns,
  rowKey,
  empty,
  sortState,
  onSort,
  minWidth = 600,
  maxHeight,
  scrollable = false,
  stickyHeader = false,
  onRowClick,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (r: T) => string;
  empty: string;
  sortState?: SortState | null;
  onSort?: (key: string) => void;
  minWidth?: number | string;
  maxHeight?: number | string;
  scrollable?: boolean;
  stickyHeader?: boolean;
  onRowClick?: (row: T) => void;
}) {
  const mobile = useMediaQuery(`(max-width: ${CENTRAL_DESIGN_TOKENS.breakpointMobile}px)`);

  if (!rows.length) {
    return (
      <Text c="var(--app-text-secondary)" fz="sm" py="xl" ta="center">
        {empty}
      </Text>
    );
  }

  if (mobile && !scrollable) {
    return (
      <Stack gap="xs">
        {rows.map((r) => (
          <Paper
            key={rowKey(r)}
            p="sm"
            onClick={() => onRowClick?.(r)}
            style={{
              background: "var(--app-bg-elevated)",
              border: "1px solid var(--app-border-subtle)",
              borderRadius: "var(--app-radius-md)",
              boxShadow: "var(--app-shadow-card)",
              cursor: onRowClick ? "pointer" : undefined,
            }}
          >
            {columns.map((c) => (
              <Group key={c.key} justify="space-between" gap="xs" wrap="nowrap" py={3}>
                <Text fz="xs" c="var(--app-text-secondary)" fw={600}>
                  {c.label}
                </Text>
                <Text
                  fz="sm"
                  c="var(--app-text-primary)"
                  ta="right"
                  component="div"
                  style={{ minWidth: 0 }}
                >
                  {c.render(r)}
                </Text>
              </Group>
            ))}
          </Paper>
        ))}
      </Stack>
    );
  }

  const effectiveMaxHeight = maxHeight ?? (scrollable ? 520 : undefined);
  const isSticky = Boolean(stickyHeader || scrollable || maxHeight);

  return (
    <Table.ScrollContainer
      minWidth={minWidth}
      style={{
        maxHeight: effectiveMaxHeight,
        overflowY: effectiveMaxHeight ? "auto" : undefined,
        overflowX: "auto",
        scrollbarWidth: "thin",
      }}
    >
      <Table
        highlightOnHover
        stickyHeader={isSticky}
        stickyHeaderOffset={0}
        verticalSpacing="sm"
        style={{
          borderCollapse: "separate",
          borderSpacing: 0,
        }}
        styles={{
          th: {
            color: "var(--app-text-secondary)",
            fontWeight: 600,
            fontSize: 13,
            background: "transparent",
            backdropFilter: isSticky ? "blur(12px)" : undefined,
            WebkitBackdropFilter: isSticky ? "blur(12px)" : undefined,
            borderBottom: "1px solid var(--app-border-subtle)",
            whiteSpace: "nowrap",
            zIndex: 5,
            position: isSticky ? "sticky" : undefined,
            top: isSticky ? 0 : undefined,
          },
          td: {
            color: "var(--app-text-primary)",
            borderBottom: "1px solid var(--app-border-subtle)",
            whiteSpace: "nowrap",
          },
        }}
      >
        <Table.Thead
          style={
            isSticky
              ? {
                  position: "sticky",
                  top: 0,
                  zIndex: 5,
                  background: "transparent",
                }
              : undefined
          }
        >
          <Table.Tr>
            {columns.map((c) => {
              const isSorted = sortState?.key === c.key;
              const isSortable = Boolean(c.sortable && onSort);

              return (
                <Table.Th
                  key={c.key}
                  style={{
                    width: c.width,
                    textAlign: c.align ?? "left",
                    background: "transparent",
                    position: isSticky ? "sticky" : undefined,
                    top: isSticky ? 0 : undefined,
                    zIndex: isSticky ? 5 : undefined,
                  }}
                >
                  {isSortable ? (
                    <UnstyledButton
                      onClick={() => onSort?.(c.key)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        color: isSorted ? "var(--app-brand-primary)" : "var(--app-text-secondary)",
                        fontWeight: isSorted ? 700 : 600,
                        fontSize: "inherit",
                        cursor: "pointer",
                        padding: "2px 0",
                        userSelect: "none",
                        transition: "color 150ms ease",
                      }}
                      aria-label={`Sort by ${c.label}`}
                    >
                      <span>{c.label}</span>
                      {isSorted ? (
                        sortState?.direction === "asc" ? (
                          <CaretUp size={14} weight="bold" />
                        ) : (
                          <CaretDown size={14} weight="bold" />
                        )
                      ) : (
                        <CaretUpDown size={14} weight="regular" style={{ opacity: 0.45 }} />
                      )}
                    </UnstyledButton>
                  ) : (
                    <span>{c.label}</span>
                  )}
                </Table.Th>
              );
            })}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {rows.map((r) => (
            <Table.Tr
              key={rowKey(r)}
              onClick={() => onRowClick?.(r)}
              style={{
                cursor: onRowClick ? "pointer" : undefined,
              }}
            >
              {columns.map((c) => (
                <Table.Td
                  key={c.key}
                  style={{
                    textAlign: c.align ?? "left",
                  }}
                >
                  {c.render(r)}
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Table.ScrollContainer>
  );
}
