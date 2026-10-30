import { ActionIcon, Group, Paper, Tooltip } from "@mantine/core";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { SquaresFour, ChartBar, Clock } from "@phosphor-icons/react";
import { useI18n } from "@/lib/i18n";

export const LOG_TIME_EVENT = "app:log-time";
export const LOG_TIME_FLAG = "lucesem-open-log";

/** Floating quick-action bar at the bottom of the screen (dashboard, reports, log time). */
export function FloatingDock({ menuOpen }: { menuOpen?: boolean } = {}) {
  const { t } = useI18n();
  const path = useRouterState({ select: (s) => s.location.pathname });
  const router = useRouter();

  const logTime = async () => {
    if (path === "/") {
      window.dispatchEvent(new Event(LOG_TIME_EVENT));
    } else {
      sessionStorage.setItem(LOG_TIME_FLAG, "1");
      await router.navigate({ to: "/" });
    }
  };

  const item = (active: boolean) => ({
    size: 44,
    radius: "xl" as const,
    variant: active ? ("filled" as const) : ("subtle" as const),
    color: active ? "lucesem" : "gray",
  });

  return (
    <Paper
      radius="xl"
      p={6}
      style={{
        position: "fixed",
        left: "50%",
        bottom: 20,
        transform: menuOpen ? "translate(-50%, calc(100% + 40px))" : "translate(-50%, 0)",
        opacity: menuOpen ? 0 : 1,
        pointerEvents: menuOpen ? "none" : "auto",
        transition: "transform 260ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease",
        zIndex: 100,
        background: "var(--app-bg-surface)",
        border: "1px solid var(--app-border-subtle)",
        boxShadow: "var(--app-shadow-elevated)",
      }}
    >
      <Group gap={6} wrap="nowrap">
        <Tooltip label={t("dashboard")} withArrow>
          <ActionIcon component={Link} to="/" aria-label={t("dashboard")} {...item(path === "/")}>
            <SquaresFour size={22} weight="duotone" />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t("reportsTitle")} withArrow>
          <ActionIcon
            component={Link}
            to="/reports"
            aria-label={t("reportsTitle")}
            {...item(path === "/reports")}
          >
            <ChartBar size={22} weight="duotone" />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={t("logTime")} withArrow>
          <ActionIcon onClick={logTime} aria-label={t("logTime")} {...item(false)}>
            <Clock size={22} weight="duotone" />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Paper>
  );
}
