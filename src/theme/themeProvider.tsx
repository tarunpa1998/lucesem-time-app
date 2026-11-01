import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  MantineProvider,
  createTheme,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { ModalsProvider } from "@mantine/modals";
import { CENTRAL_DESIGN_TOKENS as T, type ThemeMode } from "./tokens";

const brandTuple: MantineColorsTuple = [
  "#e5f6fd",
  "#cdeafa",
  "#9cd3f3",
  "#67bbed",
  "#3ea7e8",
  T.brand.primary,
  T.brand.primaryHover,
  T.brand.primaryDeep,
  "#00689f",
  "#00598a",
];

const theme = createTheme({
  primaryColor: "lucesem",
  primaryShade: 5,
  colors: { lucesem: brandTuple },
  fontFamily: T.fonts.body,
  fontFamilyMonospace: T.fonts.mono,
  headings: { fontFamily: T.fonts.heading, fontWeight: "700" },
  defaultRadius: "md",
  radius: { sm: T.radius.sm, md: T.radius.md, lg: T.radius.lg },
  fontSizes: {
    xs: T.fontSize.xs,
    sm: T.fontSize.sm,
    md: T.fontSize.md,
    lg: T.fontSize.lg,
    xl: T.fontSize.xl,
  },
  spacing: T.spacing,
  shadows: { sm: T.shadow.card, md: T.shadow.card, lg: T.shadow.elevated, xl: T.shadow.elevated },
});

function vars(mode: ThemeMode): Record<string, string> {
  const p = T.modes[mode];
  return {
    "--mantine-color-body": p.bgCanvas,
    "--mantine-color-default": p.bgSurface,
    "--mantine-color-default-hover": p.hoverSurface,
    "--mantine-color-default-border": p.borderSubtle,
    "--mantine-color-default-color": p.textPrimary,
    "--mantine-color-text": p.textPrimary,
    "--mantine-color-dimmed": p.textSecondary,
    "--mantine-color-placeholder": p.textSecondary,
    "--mantine-primary-color-filled": T.brand.primary,
    "--mantine-primary-color-filled-hover": T.brand.primaryHover,
    "--mantine-color-lucesem-0": brandTuple[0]!,
    "--mantine-color-lucesem-1": brandTuple[1]!,
    "--mantine-color-lucesem-2": brandTuple[2]!,
    "--mantine-color-lucesem-3": brandTuple[3]!,
    "--mantine-color-lucesem-4": brandTuple[4]!,
    "--mantine-color-lucesem-5": brandTuple[5]!,
    "--mantine-color-lucesem-6": brandTuple[6]!,
    "--mantine-color-lucesem-7": brandTuple[7]!,
    "--mantine-color-lucesem-8": brandTuple[8]!,
    "--mantine-color-lucesem-9": brandTuple[9]!,
    "--mantine-color-dark-7": p.bgSurface,
    "--mantine-color-dark-6": p.bgElevated,
    "--mantine-color-dark-5": p.hoverSurface,
    "--mantine-color-dark-4": p.borderSubtle,
    "--app-bg-canvas": p.bgCanvas,
    "--app-bg-surface": p.bgSurface,
    "--app-bg-elevated": p.bgElevated,
    "--app-bg-header": p.bgHeader,
    "--app-text-primary": p.textPrimary,
    "--app-text-secondary": p.textSecondary,
    "--app-text-on-header": p.textOnHeader,
    "--app-border-subtle": p.borderSubtle,
    "--app-hover-surface": p.hoverSurface,
    "--app-brand-primary": T.brand.primary,
    "--app-brand-hover": T.brand.primaryHover,
    "--app-brand-navy": T.brand.navy,
    "--app-logo-sem": mode === "light" ? T.brand.logoSemLight : T.brand.logoSemDark,
    "--app-success": T.brand.success,
    "--app-warning": T.brand.warning,
    "--app-danger": T.brand.danger,
    "--app-locked": T.brand.locked,
    "--app-font-heading": T.fonts.heading,
    "--app-font-body": T.fonts.body,
    "--app-font-mono": T.fonts.mono,
    "--app-heading-tracking": T.headingTracking,
    "--app-radius-sm": T.radius.sm,
    "--app-radius-md": T.radius.md,
    "--app-radius-lg": T.radius.lg,
    "--app-grid-gap": T.gridGap,
    "--app-shadow-card": p.shadowCard,
    "--app-shadow-floating": p.shadowFloating,
    "--app-shadow-elevated": p.shadowElevated,
    "--app-bg-glass": p.bgGlass,
    "--app-border-glass": p.borderGlass,
    "--app-card-highlight": p.cardHighlight,
    "--app-font-size-base": T.fontSize.md,
  };
}

const cssVariablesResolverFor =
  (mode: ThemeMode): CSSVariablesResolver =>
  () => ({
    variables: {},
    light: vars("light"),
    dark: vars(mode === "night" ? "night" : "dark"),
  });

interface ModeCtx {
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
}
const Ctx = createContext<ModeCtx>({ mode: "light", setMode: () => {} });
export const useThemeMode = () => useContext(Ctx);

function getInitialMode(): ThemeMode {
  if (typeof window !== "undefined") {
    try {
      const s = localStorage.getItem("lucesem-mode") as ThemeMode | null;
      if (s && s in T.modes) return s;
    } catch {
      // Fallback to light
    }
  }
  return "light";
}

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(getInitialMode);
  const resolver = useMemo(() => cssVariablesResolverFor(mode), [mode]);

  useEffect(() => {
    const s = localStorage.getItem("lucesem-mode") as ThemeMode | null;
    if (s && s in T.modes && s !== mode) setMode(s);
  }, [mode]);
  const update = (m: ThemeMode) => {
    setMode(m);
    try {
      localStorage.setItem("lucesem-mode", m);
      const scheme = m === "light" ? "light" : "dark";
      localStorage.setItem("mantine-color-scheme-value", scheme);
      document.documentElement.setAttribute("data-mantine-color-scheme", scheme);
      document.documentElement.setAttribute("data-app-mode", m);
      if (m !== "light") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } catch {
      // Ignore storage errors
    }
  };
  return (
    <Ctx.Provider value={{ mode, setMode: update }}>
      <MantineProvider
        key={mode}
        theme={theme}
        cssVariablesResolver={resolver}
        forceColorScheme={mode === "light" ? "light" : "dark"}
      >
        <ModalsProvider>
          <Notifications position="top-right" />
          {children}
        </ModalsProvider>
      </MantineProvider>
    </Ctx.Provider>
  );
}
