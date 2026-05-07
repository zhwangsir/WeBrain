/**
 * WeBrain Design System — Monochrome Editorial
 * Dual-theme (light/dark) with black/white base.
 * Green for success/on. Red for error/destructive. No purple.
 */

import type { ThemeConfig } from "antd";
import { theme as antdTheme } from "antd";

/* ─── Typography ─── */
const fontFamily = '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

/* ─── Shadow tokens ─── */
const shadowLight = {
  canonical: "0 1px 3px rgba(0, 0, 0, 0.06)",
  hover: "0 4px 12px rgba(0, 0, 0, 0.08)",
};

const shadowDark = {
  canonical: "0 1px 3px rgba(0, 0, 0, 0.25)",
  hover: "0 4px 12px rgba(0, 0, 0, 0.35)",
};

function makeTokens(isDark: boolean): ThemeConfig["token"] {
  const s = isDark ? shadowDark : shadowLight;
  const primary = isDark ? "#f5f5f5" : "#000000";
  const primaryHover = isDark ? "#ffffff" : "#333333";
  const primaryActive = isDark ? "#e5e5e5" : "#111111";

  return {
    colorPrimary: primary,
    colorPrimaryHover: primaryHover,
    colorPrimaryActive: primaryActive,
    colorPrimaryText: primary,
    colorPrimaryTextHover: primaryHover,

    colorSuccess: isDark ? "#22c55e" : "#16a34a",
    colorSuccessBg: isDark ? "#14532d" : "#f0fdf4",
    colorSuccessBorder: isDark ? "#166534" : "#bbf7d0",

    colorError: isDark ? "#ef4444" : "#dc2626",
    colorErrorBg: isDark ? "#450a0a" : "#fef2f2",
    colorErrorBorder: isDark ? "#7f1d1d" : "#fecaca",

    colorWarning: isDark ? "#eab308" : "#ca8a04",
    colorWarningBg: isDark ? "#422006" : "#fefce8",

    colorInfo: primary,

    colorBgContainer: isDark ? "#141414" : "#fafafa",
    colorBgElevated: isDark ? "#1a1a1a" : "#ffffff",
    colorBgLayout: isDark ? "#0a0a0a" : "#ffffff",
    colorBgSpotlight: isDark ? "#ffffff" : "#000000",

    colorText: isDark ? "#f5f5f5" : "#000000",
    colorTextSecondary: isDark ? "#a1a1aa" : "#666666",
    colorTextTertiary: isDark ? "#71717a" : "#999999",
    colorTextQuaternary: isDark ? "#52525b" : "#cccccc",

    colorBorder: isDark ? "#27272a" : "#e5e5e5",
    colorBorderSecondary: isDark ? "#3f3f46" : "#f5f5f5",

    borderRadius: 8,
    borderRadiusLG: 10,
    borderRadiusSM: 6,
    borderRadiusXS: 4,

    fontFamily,
    fontSize: 14,
    fontSizeLG: 16,
    fontSizeSM: 13,

    boxShadow: s.canonical,
    boxShadowSecondary: s.hover,
    boxShadowTertiary: s.hover,

    paddingXS: 4,
    paddingSM: 8,
    padding: 16,
    paddingMD: 24,
    paddingLG: 32,
    paddingXL: 48,

    controlHeight: 40,
    controlHeightLG: 48,
    controlHeightSM: 32,
  };
}

function makeComponents(isDark: boolean): ThemeConfig["components"] {
  const bg = isDark ? "#141414" : "#fafafa";
  const bgPage = isDark ? "#0a0a0a" : "#ffffff";
  const text = isDark ? "#f5f5f5" : "#000000";
  const text2 = isDark ? "#a1a1aa" : "#666666";
  const border = isDark ? "#27272a" : "#e5e5e5";
  const primary = isDark ? "#f5f5f5" : "#000000";

  return {
    Layout: {
      siderBg: bg,
      headerBg: bg,
      headerHeight: 64,
      headerPadding: "0 48px",
      lightSiderBg: bg,
      lightTriggerBg: bgPage,
      lightTriggerColor: text2,
    },
    Menu: {
      itemBg: "transparent",
      itemColor: text2,
      itemHoverBg: bgPage,
      itemHoverColor: text,
      itemSelectedBg: bgPage,
      itemSelectedColor: primary,
      itemBorderRadius: 8,
      itemMarginInline: 8,
      itemMarginBlock: 2,
      itemHeight: 40,
      subMenuItemBg: bg,
    },
    Card: {
      borderRadiusLG: 10,
      borderRadius: 10,
      headerBg: "transparent",
      headerFontSize: 16,
      headerHeight: 56,
    },
    Button: {
      borderRadius: 8,
      borderRadiusLG: 8,
      borderRadiusSM: 6,
      contentFontSize: 14,
      contentFontSizeLG: 16,
      primaryShadow: "none",
    },
    Input: {
      borderRadius: 8,
      paddingInline: 16,
      paddingBlock: 10,
    },
    Table: {
      borderRadius: 10,
      headerBg: bgPage,
      headerColor: text,
      headerSplitColor: border,
      rowHoverBg: bgPage,
    },
    Badge: {
      dotSize: 8,
      statusSize: 8,
    },
    Tag: {
      borderRadius: 6,
      defaultBg: bgPage,
      defaultColor: text2,
    },
    Tooltip: {
      borderRadius: 8,
    },
    Modal: {
      borderRadius: 12,
      contentBg: bg,
    },
    Drawer: {
      borderRadius: 12,
    },
    Message: {
      borderRadius: 10,
    },
    List: {
      itemPadding: "16px 0",
    },
    Switch: {
      colorPrimary: isDark ? "#22c55e" : "#16a34a",
      colorPrimaryHover: isDark ? "#4ade80" : "#22c55e",
    },
  };
}

export function getAntdTheme(isDark: boolean): ThemeConfig {
  return {
    algorithm: isDark ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
    token: makeTokens(isDark),
    components: makeComponents(isDark),
  };
}

/* Synchronous version for when algorithm is handled separately */
export function getAntdThemeSync(isDark: boolean): Omit<ThemeConfig, "algorithm"> {
  return {
    token: makeTokens(isDark),
    components: makeComponents(isDark),
  };
}

/* ─── Exported design tokens for inline styles (reference only; prefer CSS vars) ─── */
export const designTokens = {
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    "2xl": 48,
    "3xl": 64,
    "4xl": 80,
  },
  radius: {
    sm: 6,
    md: 8,
    lg: 10,
    xl: 12,
    full: 9999,
  },
  font: {
    heading: { weight: 600, lineHeight: 1.2 },
    body: { weight: 400, lineHeight: 1.6 },
    caption: { weight: 300, lineHeight: 1.5 },
  },
  breakpoints: {
    sm: 640,
    md: 768,
    lg: 1024,
    xl: 1280,
    "2xl": 1536,
    "4k": 3840,
  },
} as const;
