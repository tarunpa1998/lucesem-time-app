import { ActionIcon, Avatar, Box, Menu, Stack, Text, Tooltip, UnstyledButton } from "@mantine/core";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppFolderTabs } from "./primitives";
import {
  Buildings,
  ChartBar,
  Checks,
  ClipboardText,
  FolderSimple,
  Globe,
  Island,
  Kanban,
  Key,
  LockSimple,
  Moon,
  MoonStars,
  SignOut,
  SquaresFour,
  Sun,
  Tag,
  UserCircle,
  Users,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";
import { useI18n, type TKey } from "@/lib/i18n";
import { useThemeMode } from "@/theme/themeProvider";
import type { ThemeMode } from "@/theme/tokens";
import { meQuery } from "@/lib/session";

type NavItem = { key: TKey; icon: Icon; to: string };

const NAV: NavItem[] = [
  { key: "dashboard", icon: SquaresFour, to: "/" },
  { key: "workBoard", icon: Kanban, to: "/board" },
  { key: "myProjects", icon: FolderSimple, to: "/projects" },
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

const THEME_ORDER: ThemeMode[] = ["light", "dark", "night"];

/**
 * Theme control. Closed rail: only the active mode's icon; clicking cycles
 * light → dark → night. Open rail (hover / mobile drawer): a segmented
 * control showing all three modes.
 */
export function ThemeToggle({ expanded }: { expanded: boolean }) {
  const { t } = useI18n();
  const { mode, setMode } = useThemeMode();
  if (expanded)
    return (
      <AppFolderTabs
        compact
        fullWidth
        value={mode}
        onChange={(v) => setMode(v as ThemeMode)}
        items={THEME_ORDER.map((m) => ({ value: m, label: t(m) }))}
      />
    );
  const nextIndex = (THEME_ORDER.indexOf(mode) + 1) % THEME_ORDER.length;
  const next: ThemeMode = THEME_ORDER[nextIndex] ?? "light";
  const ActiveIcon = mode === "light" ? Sun : mode === "dark" ? Moon : MoonStars;
  const label = `${t("switchTo")} ${t(next)}`;
  return (
    <Tooltip label={label} position="right" offset={14} withArrow>
      <ActionIcon
        aria-label={label}
        variant="subtle"
        color="lucesem"
        size={40}
        onClick={() => setMode(next)}
        style={{ borderRadius: "var(--app-radius-md)" }}
      >
        <ActiveIcon size={22} weight="duotone" />
      </ActionIcon>
    </Tooltip>
  );
}

/** Avatar / name button with the profile, change-password and sign-out menu. */
function UserMenu({
  expanded,
  onLogout,
  onChangePassword,
}: {
  expanded: boolean;
  onLogout: () => void;
  onChangePassword: () => void;
}) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { data: me } = useQuery(meQuery);
  if (!me) return null;
  const initials = me.displayName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");

  return (
    <Menu position={expanded ? "top-start" : "right-end"} width={230} withArrow>
      {expanded ? (
        <Menu.Target>
          <UnstyledButton
            px="xs"
            py="xs"
            style={{
              borderRadius: "var(--app-radius-md)",
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10,
              transition: "background var(--app-transition-fast)",
            }}
          >
            {me.avatarUrl ? (
              <Avatar src={me.avatarUrl} size={36} radius="xl" alt={me.displayName} />
            ) : (
              <Box
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "color-mix(in srgb, var(--app-brand-primary) 14%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--app-brand-primary) 25%, transparent)",
                  color: "var(--app-brand-primary)",
                  fontWeight: 700,
                  fontSize: 12,
                  flexShrink: 0,
                }}
              >
                {initials}
              </Box>
            )}
            <Box style={{ minWidth: 0, flex: 1, textAlign: "left" }}>
              <Text fz="sm" fw={600} c="var(--app-text-primary)" truncate>
                {me.displayName}
              </Text>
              <Text fz="xs" c="var(--app-text-secondary)" truncate>
                {me.jobTitle || me.email}
              </Text>
            </Box>
          </UnstyledButton>
        </Menu.Target>
      ) : (
        <Tooltip label={me.displayName} position="right" offset={14} withArrow>
          <Menu.Target>
            <UnstyledButton
              aria-label={me.displayName}
              style={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: me.avatarUrl
                  ? "transparent"
                  : "color-mix(in srgb, var(--app-brand-primary) 14%, transparent)",
                border: "1px solid color-mix(in srgb, var(--app-brand-primary) 25%, transparent)",
                color: "var(--app-brand-primary)",
                fontWeight: 700,
                fontSize: 13,
                overflow: "hidden",
              }}
            >
              {me.avatarUrl ? (
                <Avatar src={me.avatarUrl} size={40} radius="xl" alt={me.displayName} />
              ) : (
                initials
              )}
            </UnstyledButton>
          </Menu.Target>
        </Tooltip>
      )}
      <Menu.Dropdown>
        <Menu.Item
          leftSection={<UserCircle size={16} />}
          onClick={() => void navigate({ to: "/profile" })}
        >
          {t("profile")}
        </Menu.Item>
        <Menu.Item leftSection={<Key size={16} />} onClick={onChangePassword}>
          {t("changePassword")}
        </Menu.Item>
        <Menu.Item leftSection={<SignOut size={16} />} onClick={onLogout}>
          {t("signOut")}
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

/** Individual navigation item matching the modern software floating capsule design */
function SidebarNavItem({
  item,
  expanded,
  isActive,
  onNavigate,
}: {
  item: NavItem;
  expanded: boolean;
  isActive: boolean;
  onNavigate: () => void;
}) {
  const { t } = useI18n();
  const IconComponent = item.icon;

  const content = (
    <UnstyledButton
      component={Link}
      to={item.to}
      onClick={onNavigate}
      style={{
        display: "block",
        width: "100%",
        position: "relative",
        textDecoration: "none",
      }}
    >
      <Box
        style={{
          width: "100%",
          height: 38,
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: expanded ? "flex-start" : "center",
        }}
      >
        {/* Active glowing blue pill at the rail's left outer edge */}
        {isActive && (
          <Box
            style={{
              position: "absolute",
              left: 0,
              top: "50%",
              transform: "translateY(-50%)",
              width: 4,
              height: 20,
              borderTopRightRadius: 4,
              borderBottomRightRadius: 4,
              background: "var(--app-brand-primary)",
              boxShadow: "0 2px 10px color-mix(in srgb, var(--app-brand-primary) 60%, transparent)",
              zIndex: 2,
            }}
          />
        )}

        {/* Inner item box: dead center in collapsed mode, horizontal row in expanded mode */}
        <Box
          data-active={isActive || undefined}
          className="app-sidebar-item"
          style={{
            width: expanded ? "calc(100% - 16px)" : 38,
            height: 34,
            marginLeft: expanded ? 8 : "auto",
            marginRight: expanded ? 8 : "auto",
            borderRadius: "var(--app-radius-md)",
            display: "flex",
            alignItems: "center",
            justifyContent: expanded ? "flex-start" : "center",
            paddingLeft: expanded ? 10 : 0,
            paddingRight: expanded ? 10 : 0,
            gap: expanded ? 10 : 0,
            cursor: "pointer",
          }}
        >
          <Box
            style={{
              width: 22,
              height: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IconComponent
              size={19}
              weight={isActive ? "bold" : "duotone"}
              style={{
                color: isActive ? "var(--app-brand-primary)" : "currentColor",
              }}
            />
          </Box>
          {expanded && (
            <Text
              fz="13px"
              fw={isActive ? 600 : 500}
              truncate
              style={{
                color: isActive ? "var(--app-brand-primary)" : "var(--app-text-secondary)",
                userSelect: "none",
              }}
            >
              {t(item.key)}
            </Text>
          )}
        </Box>
      </Box>
    </UnstyledButton>
  );

  if (expanded) {
    return content;
  }

  return (
    <Tooltip
      label={t(item.key)}
      position="right"
      offset={14}
      withArrow
      transitionProps={{ duration: 150 }}
    >
      {content}
    </Tooltip>
  );
}

/**
 * Content of the floating glass navigation rail (rendered inside AppShell.Navbar).
 * Collapsed: icons dead-center horizontally with left active indicator bar and right tooltips.
 * Expanded: smooth slide-in labels.
 * Bottom: docked floating sub-pill with user and theme switcher.
 */
export function AppSidebar({
  expanded,
  onNavigate,
  onLogout,
  onChangePassword,
}: {
  expanded: boolean;
  onNavigate: () => void;
  onLogout: () => void;
  onChangePassword: () => void;
}) {
  const { t } = useI18n();
  const { data: me } = useQuery(meQuery);
  const path = useRouterState({ select: (s) => s.location.pathname });

  const isItemActive = (to: string) => {
    if (to === "/") return path === "/";
    return path === to || path.startsWith(`${to}/`);
  };

  return (
    <Stack h="100%" gap={0} justify="space-between" pt={12} pb={8} style={{ overflow: "hidden" }}>
      <Box
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          overflowX: "hidden",
          scrollPaddingTop: 8,
          scrollPaddingBottom: 8,
        }}
      >
        <Stack gap={1}>
          {NAV.map((n) => (
            <SidebarNavItem
              key={n.to}
              item={n}
              expanded={expanded}
              isActive={isItemActive(n.to)}
              onNavigate={onNavigate}
            />
          ))}
        </Stack>

        {me?.isAdmin && (
          <>
            {expanded ? (
              <Text
                fz={10}
                fw={700}
                c="var(--app-text-secondary)"
                tt="uppercase"
                px="md"
                mt={8}
                mb={3}
                style={{ letterSpacing: "0.08em", opacity: 0.8 }}
              >
                {t("admin")}
              </Text>
            ) : (
              <Box
                my={8}
                w={28}
                h={1}
                mx="auto"
                style={{ background: "var(--app-border-subtle)" }}
              />
            )}
            <Stack gap={1}>
              {ADMIN_NAV.map((n) => (
                <SidebarNavItem
                  key={n.to}
                  item={n}
                  expanded={expanded}
                  isActive={isItemActive(n.to)}
                  onNavigate={onNavigate}
                />
              ))}
            </Stack>
          </>
        )}
      </Box>

      {me && (
        <Box px="xs" pb="xs" pt={6} style={{ flexShrink: 0 }}>
          <Stack
            gap={6}
            style={{
              alignItems: expanded ? "stretch" : "center",
            }}
          >
            <UserMenu expanded={expanded} onLogout={onLogout} onChangePassword={onChangePassword} />
            <ThemeToggle expanded={expanded} />
          </Stack>
        </Box>
      )}
    </Stack>
  );
}
