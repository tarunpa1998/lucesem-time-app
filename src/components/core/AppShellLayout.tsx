import {
  AppShell,
  Burger,
  Group,
  Box,
  Text,
  Indicator,
  ActionIcon,
  Popover,
  Stack,
  ScrollArea,
  Button,
} from "@mantine/core";
import { useDisclosure, useMediaQuery, useMounted } from "@mantine/hooks";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";
import { NOTIFIED_EVENT } from "./notify";
import { ShellSkeleton } from "./PageSkeleton";
import { FloatingDock } from "./FloatingDock";
import { AppSidebar } from "./AppSidebar";
import { AppFolderTabs } from "./primitives";
import { useI18n } from "@/lib/i18n";
import { meQuery, notificationsQuery } from "@/lib/session";
import { logout } from "@/backend/auth.functions";
import { markNotificationsRead } from "@/backend/org.functions";
import { AppLiveClock } from "./AppLiveClock";
import { ChangePasswordModal } from "./ChangePasswordModal";

export function Logo() {
  return (
    <Text
      component="span"
      ff="var(--app-font-heading)"
      fw={800}
      fz={22}
      style={{ letterSpacing: "-0.03em" }}
    >
      <span style={{ color: "var(--app-brand-primary)" }}>luce</span>
      <span style={{ color: "var(--app-text-on-header)" }}>sem</span>
      <sup style={{ color: "var(--app-text-on-header)", fontSize: 10 }}>®</sup>
    </Text>
  );
}

function NotificationBell() {
  const { t, fmtDate } = useI18n();
  const qc = useQueryClient();
  const { data = [] } = useQuery(notificationsQuery);
  const unread = data.filter((n) => !n.read_at).length;
  useEffect(() => {
    const h = () => qc.invalidateQueries({ queryKey: ["notifications"] });
    window.addEventListener(NOTIFIED_EVENT, h);
    return () => window.removeEventListener(NOTIFIED_EVENT, h);
  }, [qc]);
  return (
    <Popover width={320} position="bottom-end" shadow="lg">
      <Popover.Target>
        <Indicator disabled={!unread} label={unread} size={16} color="red" offset={4}>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={t("notifications")}
            style={{ color: "var(--app-text-on-header)" }}
          >
            <Bell size={20} weight="duotone" />
          </ActionIcon>
        </Indicator>
      </Popover.Target>
      <Popover.Dropdown
        style={{ background: "var(--app-bg-surface)", borderColor: "var(--app-border-subtle)" }}
      >
        <Group justify="space-between" mb="xs">
          <Text fw={700} fz="sm">
            {t("notifications")}
          </Text>
          {unread > 0 && (
            <Button
              size="compact-xs"
              variant="subtle"
              onClick={async () => {
                await markNotificationsRead();
                qc.invalidateQueries({ queryKey: ["notifications"] });
              }}
            >
              {t("markRead")}
            </Button>
          )}
        </Group>
        <ScrollArea.Autosize mah={320}>
          <Stack gap={6}>
            {data.length === 0 && (
              <Text fz="sm" c="var(--app-text-secondary)">
                {t("noNotifications")}
              </Text>
            )}
            {data.map((n) => (
              <Box
                key={n.id}
                p={8}
                style={{
                  borderRadius: "var(--app-radius-sm)",
                  background: n.read_at ? "transparent" : "var(--app-bg-elevated)",
                }}
              >
                {n.kind.startsWith("toast.") && (
                  <Text fz="xs" fw={700} c={n.kind === "toast.error" ? "red" : "green"}>
                    {n.kind === "toast.error" ? t("notifError") : t("notifSuccess")}
                  </Text>
                )}
                <Text fz="sm">{n.message}</Text>
                <Text fz="xs" c="var(--app-text-secondary)">
                  {fmtDate(new Date(n.created_at).toISOString().slice(0, 10))} ·{" "}
                  {new Date(n.created_at).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </Box>
            ))}
          </Stack>
        </ScrollArea.Autosize>
      </Popover.Dropdown>
    </Popover>
  );
}

export function AppShellLayout({
  children,
  bottomAction,
}: {
  children: ReactNode;
  bottomAction?: ReactNode;
}) {
  const [pwOpen, setPwOpen] = useState(false);
  const [opened, { toggle, close }] = useDisclosure();
  const { t, lang, setLang } = useI18n();
  const mobile = useMediaQuery("(max-width: 61.99em)");
  // Session-dependent UI renders after mount so server HTML and first client render match.
  const mounted = useMounted();
  const { data: meData } = useQuery(meQuery);
  const me = mounted ? meData : undefined;
  const path = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();
  const qc = useQueryClient();

  const doLogout = async () => {
    await logout();
    qc.clear();
    const { db } = await import("@/lib/offline-db");
    await db()
      .entries.clear()
      .catch(() => {});
    await router.navigate({ to: "/login" });
  };

  // Desktop: floating glass rail that expands while the mouse is over it.
  const [hovered, setHovered] = useState(false);
  const expanded = mobile || hovered;

  // Until the app is ready in the browser, show a layout-shaped placeholder instead of
  // rendering the page twice (server pass + browser pass).
  if (!mounted) return <ShellSkeleton dashboard={path === "/"} />;

  return (
    <AppShell
      header={{ height: 60 }}
      // Desktop: 76px visual rail + 14px left margin + 14px right margin = 104px content offset.
      navbar={{ width: { base: 250, md: 104 }, breakpoint: "md", collapsed: { mobile: !opened } }}
      footer={{ height: 72, collapsed: !bottomAction || !mobile, offset: true }}
      padding="md"
      styles={{
        header: {
          background: "var(--app-bg-header)",
          borderColor: "var(--app-border-subtle)",
          color: "var(--app-text-on-header)",
        },
        navbar: {
          border: "none",
          background: "transparent",
        },
        main: { background: "var(--app-bg-canvas)" },
        footer: { background: "var(--app-bg-surface)", borderColor: "var(--app-border-subtle)" },
      }}
    >
      <AppShell.Header
        style={{ background: "var(--app-bg-header)", borderColor: "var(--app-border-subtle)" }}
      >
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger
              opened={opened}
              onClick={toggle}
              hiddenFrom="md"
              size="sm"
              color="var(--app-text-on-header)"
              aria-label={t("menu")}
            />
            <Logo />
          </Group>
          <Group gap="xs" wrap="nowrap" align="center">
            <Box visibleFrom="sm" style={{ display: "flex", alignItems: "center" }}>
              <AppLiveClock />
            </Box>
            {me && <NotificationBell />}
            <AppFolderTabs
              compact
              value={lang}
              onChange={(v) => setLang(v as "de" | "en")}
              items={[
                { value: "de", label: "DE" },
                { value: "en", label: "EN" },
              ]}
            />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar
        p={0}
        onMouseEnter={() => !mobile && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={
          mobile
            ? {
                // Mobile: floating glass drawer, inset below the header.
                left: 12,
                top: "calc(var(--app-shell-header-offset, 60px) + 12px)",
                bottom: 12,
                height: "calc(100dvh - var(--app-shell-header-offset, 60px) - 24px)",
                maxHeight: "calc(100dvh - var(--app-shell-header-offset, 60px) - 24px)",
                width: 250,
                borderRadius: 24,
                background: "var(--app-bg-surface)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid var(--app-border-subtle)",
                borderRight: "1px solid var(--app-border-subtle)",
                boxShadow: "var(--app-shadow-elevated)",
                overflow: "hidden",
                zIndex: 250,
              }
            : {
                // Desktop: complete detached floating glass rail / card.
                // Explicit height ensures the bottom 14px margin is respected
                // so the bottom corners are fully rounded and inside the viewport.
                left: 14,
                top: "calc(var(--app-shell-header-offset, 60px) + 14px)",
                bottom: 14,
                height: "calc(100dvh - var(--app-shell-header-offset, 60px) - 28px)",
                maxHeight: "calc(100dvh - var(--app-shell-header-offset, 60px) - 28px)",
                width: expanded ? 250 : 76,
                borderRadius: 24,
                background: "var(--app-bg-surface)",
                backdropFilter: "blur(16px)",
                WebkitBackdropFilter: "blur(16px)",
                border: "1px solid var(--app-border-subtle)",
                borderRight: "1px solid var(--app-border-subtle)",
                boxShadow: expanded ? "var(--app-shadow-floating)" : "var(--app-shadow-card)",
                overflow: "hidden",
                zIndex: 150,
                transition: "width 200ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 200ms ease",
              }
        }
      >
        <AppSidebar
          expanded={expanded}
          onNavigate={close}
          onLogout={doLogout}
          onChangePassword={() => setPwOpen(true)}
        />
      </AppShell.Navbar>

      <AppShell.Main pb={96}>{children}</AppShell.Main>
      {me && <FloatingDock menuOpen={opened} />}
      <ChangePasswordModal opened={pwOpen} onClose={() => setPwOpen(false)} />
      {bottomAction && (
        <AppShell.Footer p="sm" hiddenFrom="md">
          {bottomAction}
        </AppShell.Footer>
      )}
    </AppShell>
  );
}
