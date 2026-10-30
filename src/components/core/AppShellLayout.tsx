import {
  AppShell,
  Burger,
  Group,
  NavLink,
  SegmentedControl,
  Box,
  Text,
  Badge,
  UnstyledButton,
  Menu,
  Indicator,
  ActionIcon,
  Popover,
  Stack,
  ScrollArea,
  Button,
} from "@mantine/core";
import { useDisclosure, useNetwork, useMediaQuery, useMounted } from "@mantine/hooks";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  SquaresFour,
  Kanban,
  ChartBar,
  Island,
  WifiHigh,
  WifiSlash,
  Buildings,
  Users,
  UsersThree,
  ClipboardText,
  Bell,
  SignOut,
  Checks,
  LockSimple,
  Globe,
  Key,
  Tag,
  type Icon,
} from "@phosphor-icons/react";
import { useEffect, useState, type ReactNode } from "react";
import { NOTIFIED_EVENT } from "./notify";
import { ShellSkeleton } from "./PageSkeleton";
import { FloatingDock } from "./FloatingDock";
import { useI18n, type TKey } from "@/lib/i18n";
import { useThemeMode } from "@/theme/themeProvider";
import type { ThemeMode } from "@/theme/tokens";
import { meQuery, notificationsQuery } from "@/lib/session";
import { logout } from "@/backend/auth.functions";
import { markNotificationsRead } from "@/backend/org.functions";
import { AppLiveClock } from "./AppLiveClock";
import { ChangePasswordModal } from "./ChangePasswordModal";

type NavItem = { key: TKey; icon: Icon; to: string };
const NAV: NavItem[] = [
  { key: "dashboard", icon: SquaresFour, to: "/" },
  { key: "myProjects", icon: Kanban, to: "/projects" },
  { key: "reportsTitle", icon: ChartBar, to: "/reports" },
  { key: "absences", icon: Island, to: "/absences" },
];
const ADMIN_NAV: NavItem[] = [
  { key: "approvals", icon: Checks, to: "/admin/approvals" },
  { key: "control", icon: LockSimple, to: "/admin/control" },
  { key: "portal", icon: Globe, to: "/admin/portal" },
  { key: "activities", icon: Tag, to: "/admin/activities" },
  { key: "customers", icon: Buildings, to: "/admin/customers" },
  { key: "projects", icon: ClipboardText, to: "/admin/projects" },
  { key: "teams", icon: UsersThree, to: "/admin/teams" },
  { key: "users", icon: Users, to: "/admin/users" },
];

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
  const { mode, setMode } = useThemeMode();
  const net = useNetwork();
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

  // Desktop: slim icon rail that expands while the mouse is over it.
  const [hovered, setHovered] = useState(false);
  const expanded = mobile || hovered;
  const renderNav = (items: NavItem[]) =>
    items.map((n) => (
      <NavLink
        key={n.to}
        component={Link}
        to={n.to}
        label={expanded ? t(n.key) : undefined}
        aria-label={t(n.key)}
        active={path === n.to}
        leftSection={<n.icon size={22} weight="duotone" />}
        onClick={close}
        styles={{
          root: { borderRadius: "var(--app-radius-md)", color: "var(--app-text-primary)" },
        }}
      />
    ));

  // Until the app is ready in the browser, show a layout-shaped placeholder instead of
  // rendering the page twice (server pass + browser pass).
  if (!mounted) return <ShellSkeleton dashboard={path === "/"} />;

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{ width: { base: 240, md: 72 }, breakpoint: "md", collapsed: { mobile: !opened } }}
      footer={{ height: 72, collapsed: !bottomAction || !mobile, offset: true }}
      padding="md"
      styles={{
        header: {
          background: "var(--app-bg-header)",
          borderColor: "var(--app-bg-header)",
          color: "var(--app-text-on-header)",
        },
        navbar: { background: "var(--app-bg-surface)", borderColor: "var(--app-border-subtle)" },
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
            />
            <Logo />
          </Group>
          <Group gap="xs" wrap="nowrap">
            <Box visibleFrom="sm">
              <AppLiveClock />
            </Box>
            <Badge
              variant="light"
              color={net.online ? "green" : "orange"}
              leftSection={net.online ? <WifiHigh size={12} /> : <WifiSlash size={12} />}
              tt="none"
            >
              <Box component="span" visibleFrom="sm">
                {net.online ? t("online") : t("offline")}
              </Box>
            </Badge>
            {me && <NotificationBell />}
            <UnstyledButton
              onClick={() => setLang(lang === "de" ? "en" : "de")}
              style={{
                color: "var(--app-text-on-header)",
                fontWeight: 700,
                fontSize: 13,
                padding: "4px 8px",
                border: "1px solid var(--app-brand-primary)",
                borderRadius: "var(--app-radius-sm)",
              }}
            >
              {lang === "de" ? "EN" : "DE"}
            </UnstyledButton>
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar
        p="sm"
        onMouseEnter={() => !mobile && setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={
          mobile
            ? {
                background: "var(--app-bg-surface)",
                borderRight: "1px solid var(--app-border-subtle)",
              }
            : {
                width: hovered ? 240 : 72,
                transition: "width 180ms ease, box-shadow 180ms ease",
                overflowX: "hidden",
                boxShadow: hovered ? "var(--app-shadow-elevated)" : "none",
                zIndex: 150,
                background: "var(--app-bg-surface)",
                borderRight: "1px solid var(--app-border-subtle)",
              }
        }
      >
        <Box style={{ flex: 1 }}>
          {renderNav(NAV)}
          {me?.isAdmin && (
            <>
              <Text
                fz="xs"
                fw={700}
                c="var(--app-text-secondary)"
                tt="uppercase"
                mt="md"
                mb={4}
                px="sm"
              >
                {expanded ? t("admin") : "·"}
              </Text>
              {renderNav(ADMIN_NAV)}
            </>
          )}
        </Box>
        {me && expanded && (
          <Menu position="top-start" width={220}>
            <Menu.Target>
              <UnstyledButton
                p="sm"
                mb="sm"
                style={{
                  borderRadius: "var(--app-radius-md)",
                  border: "1px solid var(--app-border-subtle)",
                }}
              >
                <Text fz="sm" fw={600} c="var(--app-text-primary)" truncate>
                  {me.displayName}
                </Text>
                <Text fz="xs" c="var(--app-text-secondary)" truncate>
                  {me.email}
                </Text>
              </UnstyledButton>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<Key size={14} />} onClick={() => setPwOpen(true)}>
                {t("changePassword")}
              </Menu.Item>
              <Menu.Item leftSection={<SignOut size={14} />} onClick={doLogout}>
                {t("signOut")}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
        {expanded && (
          <>
            <Text fz="xs" c="var(--app-text-secondary)" mb={6} fw={600}>
              {t("theme")}
            </Text>
            <SegmentedControl
              fullWidth
              size="xs"
              value={mode}
              onChange={(v) => setMode(v as ThemeMode)}
              data={(["light", "dark", "night"] as const).map((m) => ({ value: m, label: t(m) }))}
            />
          </>
        )}
      </AppShell.Navbar>

      <AppShell.Main pb={96}>{children}</AppShell.Main>
      {me && <FloatingDock />}
      <ChangePasswordModal opened={pwOpen} onClose={() => setPwOpen(false)} />
      {bottomAction && (
        <AppShell.Footer p="sm" hiddenFrom="md">
          {bottomAction}
        </AppShell.Footer>
      )}
    </AppShell>
  );
}
