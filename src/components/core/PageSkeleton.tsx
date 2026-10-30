import { Box, Group, Paper, SimpleGrid, Skeleton, Stack } from "@mantine/core";
import type { CSSProperties, ReactNode } from "react";

/**
 * Loading placeholders that mirror the real page layouts.
 * Mode-aware: seamlessly adjusts colors and skeleton tones to light, dark, or night via CSS tokens.
 */
function Card({ h, children }: { h?: number; children?: ReactNode }) {
  return (
    <Paper
      withBorder
      p="md"
      style={{
        background: "var(--app-bg-surface)",
        borderColor: "var(--app-border-subtle)",
        borderRadius: "var(--app-radius-lg)",
        boxShadow: "var(--app-shadow-card)",
        backgroundImage: "var(--app-card-highlight)",
      }}
      h={h}
    >
      {children}
    </Paper>
  );
}

function Skel({
  h,
  w,
  mb,
  style,
  ...rest
}: {
  h?: number | string;
  w?: number | string;
  mb?: number | string;
  style?: CSSProperties;
  [key: string]: unknown;
}) {
  return (
    <Skeleton
      {...(h !== undefined ? { h } : {})}
      {...(w !== undefined ? { w } : {})}
      {...(mb !== undefined ? { mb } : {})}
      style={{
        borderRadius: "var(--app-radius-sm)",
        backgroundColor: "var(--app-skeleton-bg, rgba(15, 23, 42, 0.07))",
        ...style,
      }}
      {...rest}
    />
  );
}

export function DashboardSkeleton() {
  return (
    <Stack gap="md" aria-busy="true" aria-label="Loading">
      <Stack gap={6}>
        <Skel h={12} w={160} />
        <Skel h={28} w={220} />
      </Stack>
      <Card>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          <Stack gap="sm" justify="center">
            <Skel h={12} w={100} />
            <Skel h={48} w={260} />
          </Stack>
          <Stack gap="sm">
            <Skel h={36} />
            <Skel h={36} />
            <Skel h={40} />
          </Stack>
        </SimpleGrid>
      </Card>
      <Group justify="space-between">
        <Skel h={20} w={160} />
        <Skel h={28} w={200} />
      </Group>
      <SimpleGrid cols={{ base: 2, lg: 4 }} spacing="md">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i}>
            <Skel h={10} w="50%" mb="sm" />
            <Skel h={26} w="70%" />
          </Card>
        ))}
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Card>
          <Skel h={24} mb="md" />
          <SimpleGrid cols={7} spacing={6}>
            {Array.from({ length: 35 }).map((_, i) => (
              <Skel key={i} h={52} />
            ))}
          </SimpleGrid>
        </Card>
        <Card>
          <Skel h={20} w={160} mb="md" />
          <Stack gap="sm">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skel key={i} h={28} />
            ))}
          </Stack>
        </Card>
      </SimpleGrid>
    </Stack>
  );
}

export function TablePageSkeleton() {
  return (
    <Stack gap="md" aria-busy="true" aria-label="Loading">
      <Group justify="space-between">
        <Skel h={28} w={200} />
        <Skel h={34} w={120} />
      </Group>
      <Card>
        <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
          {[0, 1, 2].map((i) => (
            <Stack key={i} gap={6}>
              <Skel h={10} w={80} />
              <Skel h={36} />
            </Stack>
          ))}
        </SimpleGrid>
      </Card>
      <Card>
        <Stack gap="sm">
          <Skel h={14} w="40%" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skel key={i} h={30} />
          ))}
        </Stack>
      </Card>
    </Stack>
  );
}

/** Full-screen placeholder with header + sidebar matching current theme mode. */
export function ShellSkeleton({ dashboard }: { dashboard: boolean }) {
  return (
    <Box
      style={{
        minHeight: "100vh",
        background: "var(--app-bg-canvas)",
        color: "var(--app-text-primary)",
      }}
    >
      <Box
        h={60}
        px="md"
        style={{
          background: "var(--app-bg-header)",
          borderBottom: "1px solid var(--app-border-subtle)",
          display: "flex",
          alignItems: "center",
        }}
      >
        <Group justify="space-between" w="100%">
          <Skel h={22} w={110} style={{ opacity: 0.3 }} />
          <Skel h={26} w={120} style={{ opacity: 0.3 }} />
        </Group>
      </Box>
      <Box style={{ display: "flex" }}>
        {/* Floating glass rail placeholder — mirrors the collapsed AppSidebar card. */}
        <Box
          visibleFrom="md"
          w={76}
          p={0}
          style={{
            position: "sticky",
            top: 74,
            marginLeft: 14,
            height: "calc(100vh - 88px)",
            alignSelf: "flex-start",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: 14,
            paddingBottom: 14,
            borderRadius: 24,
            background: "var(--app-bg-surface)",
            border: "1px solid var(--app-border-subtle)",
            boxShadow: "var(--app-shadow-card)",
          }}
        >
          <Stack gap={8} w="100%" align="center">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skel key={i} h={44} w={44} style={{ borderRadius: "var(--app-radius-md)" }} />
            ))}
          </Stack>
          {/* Floating user/theme sub-pill placeholder docked at the bottom. */}
          <Box
            mt="auto"
            p="xs"
            w="calc(100% - 16px)"
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 8,
              borderRadius: "var(--app-radius-lg)",
              background: "var(--app-bg-elevated)",
              border: "1px solid var(--app-border-subtle)",
              boxShadow: "var(--app-shadow-card)",
            }}
          >
            <Skel h={40} w={40} style={{ borderRadius: "50%" }} />
            <Skel h={40} w={40} style={{ borderRadius: "var(--app-radius-md)" }} />
          </Box>
        </Box>
        <Box p="md" style={{ flex: 1, minWidth: 0, background: "var(--app-bg-canvas)" }}>
          {dashboard ? <DashboardSkeleton /> : <TablePageSkeleton />}
        </Box>
      </Box>
    </Box>
  );
}
