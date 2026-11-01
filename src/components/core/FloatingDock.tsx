import { Box, Group, Paper, Tooltip, UnstyledButton } from "@mantine/core";
import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import { SquaresFour, ChartBar, Clock, type Icon } from "@phosphor-icons/react";
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

  const renderItem = ({
    to,
    onClick,
    isActive,
    label,
    icon: IconComponent,
  }: {
    to?: string;
    onClick?: () => void;
    isActive: boolean;
    label: string;
    icon: Icon;
  }) => (
    <Tooltip label={label} position="top" offset={10} withArrow>
      <UnstyledButton
        component={to ? Link : "button"}
        {...(to ? { to } : { onClick, type: "button" })}
        aria-label={label}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 44,
          height: 44,
          position: "relative",
          textDecoration: "none",
          borderRadius: "var(--app-radius-md)",
          outline: "none",
        }}
      >
        <Box
          data-active={isActive || undefined}
          className="app-sidebar-item"
          style={{
            width: 44,
            height: 44,
            borderRadius: "var(--app-radius-md)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            cursor: "pointer",
          }}
        >
          <Box
            style={{
              width: 24,
              height: 24,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <IconComponent
              size={22}
              weight={isActive ? "bold" : "duotone"}
              style={{
                color: isActive ? "var(--app-brand-primary)" : "var(--app-text-secondary)",
                transition: "color 150ms cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            />
          </Box>

          {/* Active glowing blue pill matching the closed sidebar style */}
          {isActive && (
            <Box
              style={{
                position: "absolute",
                bottom: 3,
                left: "50%",
                transform: "translateX(-50%)",
                width: 22,
                height: 3,
                borderRadius: 2,
                background: "var(--app-brand-primary)",
                boxShadow:
                  "0 2px 10px color-mix(in srgb, var(--app-brand-primary) 60%, transparent)",
                zIndex: 2,
              }}
            />
          )}
        </Box>
      </UnstyledButton>
    </Tooltip>
  );

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
        backdropFilter: "blur(14px)",
        WebkitBackdropFilter: "blur(14px)",
        border: "1px solid var(--app-border-subtle)",
        boxShadow: "var(--app-shadow-elevated)",
      }}
    >
      <Group gap={6} wrap="nowrap">
        {renderItem({
          to: "/",
          isActive: path === "/",
          label: t("dashboard"),
          icon: SquaresFour,
        })}
        {renderItem({
          to: "/reports",
          isActive: path === "/reports" || path.startsWith("/reports/"),
          label: t("reportsTitle"),
          icon: ChartBar,
        })}
        {renderItem({
          onClick: logTime,
          isActive: false,
          label: t("logTime"),
          icon: Clock,
        })}
      </Group>
    </Paper>
  );
}
