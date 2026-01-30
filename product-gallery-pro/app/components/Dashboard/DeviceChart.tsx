/**
 * DeviceChart Component
 * Clean device breakdown visualization
 */

import { colors, borderRadius, spacing } from "~/styles/design-system";

interface DeviceStats {
  mobile: number;
  tablet: number;
  desktop: number;
}

interface DeviceChartProps {
  stats: DeviceStats;
  title?: string;
}

export function DeviceChart({ stats, title = "Devices" }: DeviceChartProps) {
  const total = stats.mobile + stats.tablet + stats.desktop;

  const containerStyle = {
    background: colors.neutral[0],
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.neutral[200]}`,
    padding: spacing[5],
  };

  // Empty state
  if (total === 0) {
    return (
      <div style={containerStyle}>
        <h3
          style={{
            fontSize: "15px",
            fontWeight: 600,
            color: colors.neutral[900],
            margin: `0 0 ${spacing[4]} 0`,
          }}
        >
          {title}
        </h3>
        <div
          style={{
            padding: spacing[6],
            textAlign: "center",
            background: colors.neutral[50],
            borderRadius: borderRadius.md,
            border: `1px dashed ${colors.neutral[300]}`,
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: borderRadius.full,
              background: colors.neutral[100],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto",
              marginBottom: spacing[3],
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.neutral[400]}
              strokeWidth="2"
            >
              <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
              <line x1="12" y1="18" x2="12" y2="18" />
            </svg>
          </div>
          <p
            style={{
              fontSize: "13px",
              color: colors.neutral[600],
              margin: 0,
            }}
          >
            No device data yet
          </p>
        </div>
      </div>
    );
  }

  const devices = [
    {
      name: "Mobile",
      value: stats.mobile,
      percentage: Math.round((stats.mobile / total) * 100),
      color: colors.primary[500],
    },
    {
      name: "Desktop",
      value: stats.desktop,
      percentage: Math.round((stats.desktop / total) * 100),
      color: colors.chart.secondary,
    },
    {
      name: "Tablet",
      value: stats.tablet,
      percentage: Math.round((stats.tablet / total) * 100),
      color: colors.chart.tertiary,
    },
  ].filter((d) => d.value > 0);

  return (
    <div style={containerStyle}>
      <h3
        style={{
          fontSize: "15px",
          fontWeight: 600,
          color: colors.neutral[900],
          margin: `0 0 ${spacing[4]} 0`,
        }}
      >
        {title}
      </h3>

      {/* Stacked bar */}
      <div
        style={{
          display: "flex",
          height: "8px",
          borderRadius: borderRadius.full,
          overflow: "hidden",
          marginBottom: spacing[4],
        }}
      >
        {devices.map((device, i) => (
          <div
            key={device.name}
            style={{
              width: `${device.percentage}%`,
              background: device.color,
              marginLeft: i > 0 ? "2px" : 0,
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", flexDirection: "column", gap: spacing[3] }}>
        {devices.map((device) => (
          <div
            key={device.name}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  borderRadius: "3px",
                  background: device.color,
                }}
              />
              <span
                style={{
                  fontSize: "13px",
                  color: colors.neutral[700],
                }}
              >
                {device.name}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "baseline", gap: spacing[2] }}>
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: colors.neutral[900],
                }}
              >
                {device.percentage}%
              </span>
              <span
                style={{
                  fontSize: "12px",
                  color: colors.neutral[500],
                }}
              >
                ({device.value.toLocaleString()})
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
