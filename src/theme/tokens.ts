/**
 * SINGLE SOURCE OF TRUTH for every lucesem® visual token.
 * Changing a value here propagates to every Mantine component and every
 * `--app-*` CSS variable via `themeProvider.tsx`. Never hardcode styles elsewhere.
 */
export type ThemeMode = "light" | "dark" | "night";

export interface ModePalette {
  bgCanvas: string;
  bgSurface: string;
  bgElevated: string;
  bgHeader: string;
  textPrimary: string;
  textSecondary: string;
  textOnHeader: string;
  borderSubtle: string;
  hoverSurface: string;
  shadowCard: string;
  shadowFloating: string;
  shadowElevated: string;
  bgGlass: string;
  borderGlass: string;
  cardHighlight: string;
}

export const CENTRAL_DESIGN_TOKENS = {
  brand: {
    primary: "#009FE3",
    primaryHover: "#0088C2",
    primaryDeep: "#0077B6",
    navy: "#0F172A",
    logoSemLight: "#1E293B",
    logoSemDark: "#FFFFFF",
    success: "#16A34A",
    warning: "#D97706",
    danger: "#DC2626",
    locked: "#7C3AED",
  },
  modes: {
    light: {
      bgCanvas: "#F5F8FA",
      bgSurface: "#FFFFFF",
      bgElevated: "#EBF2F7",
      bgHeader: "#0F172A",
      textPrimary: "#1E293B",
      textSecondary: "#64748B",
      textOnHeader: "#FFFFFF",
      borderSubtle: "#E2E8F0",
      hoverSurface: "#EBF2F7",
      shadowCard:
        "0 1px 3px rgba(15,23,42,0.04), 0 6px 18px -3px rgba(15,23,42,0.07), 0 12px 28px -8px rgba(15,23,42,0.06)",
      shadowFloating:
        "0 4px 6px -1px rgba(15,23,42,0.04), 0 12px 30px -4px rgba(15,23,42,0.1), 0 24px 44px -8px rgba(15,23,42,0.07)",
      shadowElevated: "0 20px 48px -12px rgba(15,23,42,0.22), 0 6px 16px rgba(15,23,42,0.06)",
      bgGlass: "rgba(255, 255, 255, 0.88)",
      borderGlass: "rgba(226, 232, 240, 0.9)",
      cardHighlight: "linear-gradient(180deg, rgba(0, 159, 227, 0.035) 0%, transparent 45%)",
    },
    dark: {
      bgCanvas: "#0B1120",
      bgSurface: "#111827",
      bgElevated: "#1F2937",
      bgHeader: "#0F172A",
      textPrimary: "#E2E8F0",
      textSecondary: "#94A3B8",
      textOnHeader: "#FFFFFF",
      borderSubtle: "#1F2A3C",
      hoverSurface: "#1F2937",
      shadowCard:
        "0 2px 8px rgba(0,0,0,0.4), 0 8px 24px -4px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
      shadowFloating:
        "0 8px 32px rgba(0,0,0,0.65), 0 2px 8px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)",
      shadowElevated: "0 24px 50px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.1)",
      bgGlass: "rgba(17, 24, 39, 0.85)",
      borderGlass: "rgba(255, 255, 255, 0.09)",
      cardHighlight: "linear-gradient(180deg, rgba(0, 159, 227, 0.08) 0%, transparent 50%)",
    },
    night: {
      bgCanvas: "#000000",
      bgSurface: "#090D14",
      bgElevated: "#111722",
      bgHeader: "#000000",
      textPrimary: "#E5E7EB",
      textSecondary: "#8B95A5",
      textOnHeader: "#FFFFFF",
      borderSubtle: "#161D2A",
      hoverSurface: "#111722",
      shadowCard:
        "0 2px 10px rgba(0,0,0,0.8), 0 10px 30px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)",
      shadowFloating: "0 12px 36px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.12)",
      shadowElevated: "0 28px 60px rgba(0,0,0,0.92), inset 0 1px 0 rgba(255,255,255,0.14)",
      bgGlass: "rgba(9, 13, 20, 0.88)",
      borderGlass: "rgba(255, 255, 255, 0.12)",
      cardHighlight: "linear-gradient(180deg, rgba(0, 159, 227, 0.09) 0%, transparent 50%)",
    },
  } satisfies Record<ThemeMode, ModePalette>,
  fonts: {
    heading: "'Plus Jakarta Sans', 'Montserrat', sans-serif",
    body: "'Inter', 'Open Sans', sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  fontSize: { xs: "12px", sm: "13px", md: "14px", lg: "16px", xl: "20px", xxl: "28px" },
  headingTracking: "-0.02em",
  radius: { sm: "6px", md: "10px", lg: "14px" },
  spacing: { xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "32px" },
  gridGap: "16px",
  shadow: {
    card: "0 1px 2px rgba(15,23,42,0.04), 0 4px 12px -2px rgba(15,23,42,0.08), 0 12px 28px -12px rgba(15,23,42,0.14)",
    elevated: "0 18px 40px -12px rgba(15,23,42,0.28), 0 4px 12px rgba(15,23,42,0.08)",
  },
  breakpointMobile: 768,
} as const;

export const BRAND = {
  legalName: "lucesem technology gmbh",
  address: "Völkermarkter Ring 7, 9020 Klagenfurt am Wörthersee, AUSTRIA",
  phone: "+43 463 287007",
  email: "office@lucesem.at",
  website: "https://www.lucesem.at",
  meta: "UID-Nr.: ATU80642645 | FN: 627296 w | Standardzeiten: Mo–Fr 08:00–17:00 Uhr",
  logoUrl: "https://www.lucesem.at/wp-content/uploads/2024/12/logo-lucesem-blue-and-white.svg",
} as const;
