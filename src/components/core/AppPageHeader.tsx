import type { CSSProperties, ReactNode } from "react";
import { Box, Group, Paper, Text, ThemeIcon } from "@mantine/core";
import type { Icon } from "@phosphor-icons/react";

/**
 * Sticky floating sub-header card for all pages.
 * Preserves the full floating card aesthetic (all 4 rounded corners, border, elevation shadow)
 * while using an invisible canvas shield to hide all scrolling content underneath, preventing
 * any bleed into the gap above the card.
 */
export function AppPageHeader({
  title,
  subtitle,
  icon: I,
  actions,
  children,
  badge,
  sticky = true,
  style,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  icon?: Icon;
  actions?: ReactNode;
  children?: ReactNode;
  badge?: ReactNode;
  sticky?: boolean;
  style?: CSSProperties;
}) {
  const rightContent = actions ?? children;

  const cardContent = (
    <Paper
      component="header"
      p={{ base: "xs", sm: "sm", md: 14 }}
      style={{
        background: "var(--app-bg-surface)",
        border: "1px solid var(--app-border-subtle)",
        borderRadius: "var(--app-radius-lg)",
        boxShadow: "var(--app-shadow-floating)",
        backgroundImage: "var(--app-card-highlight)",
        transition: "box-shadow 200ms ease, background-color 200ms ease, border-color 200ms ease",
        width: "100%",
        position: "relative",
        ...style,
      }}
    >
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Group gap="sm" wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
          {I && (
            <ThemeIcon
              size={44}
              radius="md"
              variant="light"
              color="lucesem"
              style={{
                boxShadow: "var(--app-shadow-card)",
                border: "1px solid color-mix(in srgb, var(--app-brand-primary) 20%, transparent)",
                flexShrink: 0,
              }}
            >
              <I size={24} weight="duotone" />
            </ThemeIcon>
          )}
          <Box style={{ minWidth: 0, flex: 1 }}>
            <Group gap="xs" wrap="nowrap" align="center">
              <Text
                component="h1"
                m={0}
                ff="var(--app-font-heading)"
                fw={800}
                fz={{ base: 18, sm: 22 }}
                style={{
                  letterSpacing: "var(--app-heading-tracking, -0.02em)",
                  lineHeight: 1.25,
                }}
                c="var(--app-text-primary)"
                truncate
              >
                {title}
              </Text>
              {badge}
            </Group>
            {subtitle && (
              <Text fz="xs" c="var(--app-text-secondary)" lineClamp={1}>
                {subtitle}
              </Text>
            )}
          </Box>
        </Group>

        {rightContent && (
          <Group gap="xs" wrap="wrap" align="center">
            {rightContent}
          </Group>
        )}
      </Group>
    </Paper>
  );

  if (!sticky) {
    return cardContent;
  }

  return (
    <Box
      style={{
        position: "sticky",
        top: "var(--app-shell-header-offset, 60px)",
        zIndex: 35,
        background: "var(--app-bg-canvas)",
        paddingTop: 12,
        paddingBottom: 2,
        marginTop: "calc(-1 * var(--mantine-spacing-md, 16px))",
        width: "100%",
      }}
    >
      {cardContent}
    </Box>
  );
}
