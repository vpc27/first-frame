/**
 * Product Gallery Pro Design System
 *
 * A cohesive, professional design language for the app.
 * Inspired by modern analytics dashboards with a focus on clarity and trust.
 */

export const colors = {
  // Brand Colors
  primary: {
    50: "#F4F5FF",
    100: "#E8EAFF",
    200: "#C5CAFF",
    300: "#9FA8FF",
    400: "#7C87FF",
    500: "#5C6AC4", // Main brand color
    600: "#4959BD",
    700: "#3D4DB3",
    800: "#2E3A8C",
    900: "#1F2766",
  },

  // Semantic Colors
  success: {
    light: "#E3F1DF",
    main: "#108043",
    dark: "#0B5E2F",
  },
  warning: {
    light: "#FFF3CD",
    main: "#B98900",
    dark: "#856404",
  },
  critical: {
    light: "#FBEAE5",
    main: "#D72C0D",
    dark: "#9E1A00",
  },
  info: {
    light: "#E8F4FD",
    main: "#2C6ECB",
    dark: "#1A4D8F",
  },

  // Neutrals
  neutral: {
    0: "#FFFFFF",
    50: "#FAFBFB",
    100: "#F6F6F7",
    200: "#EDEEEF",
    300: "#E1E3E5",
    400: "#C9CCCF",
    500: "#8C9196",
    600: "#6D7175",
    700: "#5C5F62",
    800: "#303030",
    900: "#1A1C1D",
  },

  // Chart colors (harmonious palette)
  chart: {
    primary: "#5C6AC4",
    secondary: "#47C1BF",
    tertiary: "#9C6ADE",
    quaternary: "#F49342",
    quinary: "#50B83C",
  },
};

export const spacing = {
  0: "0",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
};

export const borderRadius = {
  sm: "6px",
  md: "8px",
  lg: "12px",
  xl: "16px",
  full: "9999px",
};

export const shadows = {
  sm: "0 1px 2px rgba(0, 0, 0, 0.05)",
  md: "0 1px 3px rgba(0, 0, 0, 0.1), 0 1px 2px rgba(0, 0, 0, 0.06)",
  lg: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
  xl: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
};

// Component-specific styles
export const cardStyles = {
  default: {
    background: colors.neutral[0],
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.neutral[200]}`,
    boxShadow: shadows.sm,
  },
  elevated: {
    background: colors.neutral[0],
    borderRadius: borderRadius.lg,
    border: "none",
    boxShadow: shadows.md,
  },
  subtle: {
    background: colors.neutral[50],
    borderRadius: borderRadius.md,
    border: `1px solid ${colors.neutral[200]}`,
    boxShadow: "none",
  },
};

export const metricCardStyles = {
  wrapper: {
    display: "flex",
    flexDirection: "column" as const,
    gap: spacing[2],
    padding: spacing[5],
    background: colors.neutral[0],
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.neutral[200]}`,
    minHeight: "120px",
  },
  value: {
    fontSize: "32px",
    fontWeight: 600,
    color: colors.neutral[900],
    lineHeight: 1.2,
  },
  label: {
    fontSize: "13px",
    fontWeight: 500,
    color: colors.neutral[600],
    textTransform: "uppercase" as const,
    letterSpacing: "0.5px",
  },
  indicator: {
    width: "8px",
    height: "8px",
    borderRadius: borderRadius.full,
  },
};
