/**
 * MetricCard Component
 * A clean, professional metric display card with hover tooltip definitions
 */

import { colors, borderRadius, spacing } from "~/styles/design-system";

interface MetricCardProps {
  label: string;
  value: string | number;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  indicator?: "primary" | "success" | "warning" | "info";
  subtitle?: string;
  /** Shown in a tooltip on hover — explains how this metric is calculated */
  definition?: string;
}

export function MetricCard({
  label,
  value,
  trend,
  indicator = "primary",
  subtitle,
  definition,
}: MetricCardProps) {
  const formattedValue =
    typeof value === "number" ? value.toLocaleString() : value;

  const indicatorColors = {
    primary: colors.primary[500],
    success: colors.success.main,
    warning: colors.warning.main,
    info: colors.info.main,
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        padding: spacing[5],
        background: colors.neutral[0],
        borderRadius: borderRadius.lg,
        border: `1px solid ${colors.neutral[200]}`,
        height: "100%",
        minHeight: "130px",
        position: "relative",
        overflow: "hidden",
        cursor: "default",
      }}
      title={definition}
    >
      {/* Subtle top accent line */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: indicatorColors[indicator],
          opacity: 0.8,
        }}
      />

      {/* Label */}
      <span
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: colors.neutral[500],
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          marginBottom: spacing[3],
        }}
      >
        {label}
      </span>

      {/* Value */}
      <span
        style={{
          fontSize: "36px",
          fontWeight: 700,
          color: colors.neutral[900],
          lineHeight: 1.1,
          fontFeatureSettings: "'tnum' on, 'lnum' on",
        }}
      >
        {formattedValue}
      </span>

      {/* Trend or Subtitle */}
      {trend && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: spacing[1],
            marginTop: spacing[2],
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: trend.isPositive ? colors.success.main : colors.critical.main,
            }}
          >
            {trend.isPositive ? "+" : ""}
            {trend.value}%
          </span>
          <span
            style={{
              fontSize: "12px",
              color: colors.neutral[500],
            }}
          >
            vs last period
          </span>
        </div>
      )}

      {subtitle && !trend && (
        <span
          style={{
            fontSize: "12px",
            color: colors.neutral[500],
            marginTop: spacing[2],
          }}
        >
          {subtitle}
        </span>
      )}
    </div>
  );
}
