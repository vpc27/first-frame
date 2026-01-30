/**
 * AnalyticsChart Component
 * Professional time-series chart with clean aesthetics
 */

import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { colors, borderRadius, spacing } from "~/styles/design-system";

interface DataPoint {
  date: string;
  views: number;
}

interface AnalyticsChartProps {
  data: DataPoint[];
  title: string;
}

export function AnalyticsChart({ data, title }: AnalyticsChartProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const chartData = data.map((d) => ({
    ...d,
    displayDate: formatDate(d.date),
  }));

  const totalViews = data.reduce((sum, d) => sum + d.views, 0);
  const avgViews = data.length > 0 ? Math.round(totalViews / data.length) : 0;

  const containerStyle = {
    background: colors.neutral[0],
    borderRadius: borderRadius.lg,
    border: `1px solid ${colors.neutral[200]}`,
    padding: spacing[6],
  };

  // Empty state
  if (!data || data.length === 0) {
    return (
      <div style={containerStyle}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: spacing[4],
          }}
        >
          <div>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 600,
                color: colors.neutral[900],
                margin: 0,
              }}
            >
              {title}
            </h3>
            <p
              style={{
                fontSize: "13px",
                color: colors.neutral[500],
                margin: `${spacing[1]} 0 0 0`,
              }}
            >
              Last 30 days
            </p>
          </div>
        </div>
        <div
          style={{
            height: 260,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: colors.neutral[50],
            borderRadius: borderRadius.md,
            border: `1px dashed ${colors.neutral[300]}`,
          }}
        >
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: borderRadius.full,
              background: colors.neutral[100],
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: spacing[3],
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke={colors.neutral[400]}
              strokeWidth="2"
            >
              <path d="M3 3v18h18" />
              <path d="M18 17V9" />
              <path d="M13 17V5" />
              <path d="M8 17v-3" />
            </svg>
          </div>
          <p
            style={{
              fontSize: "14px",
              fontWeight: 500,
              color: colors.neutral[700],
              margin: 0,
            }}
          >
            No analytics data yet
          </p>
          <p
            style={{
              fontSize: "13px",
              color: colors.neutral[500],
              margin: `${spacing[1]} 0 0 0`,
            }}
          >
            Data will appear as customers view your galleries
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: spacing[5],
        }}
      >
        <div>
          <h3
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: colors.neutral[900],
              margin: 0,
            }}
          >
            {title}
          </h3>
          <p
            style={{
              fontSize: "13px",
              color: colors.neutral[500],
              margin: `${spacing[1]} 0 0 0`,
            }}
          >
            Last 30 days
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p
            style={{
              fontSize: "24px",
              fontWeight: 700,
              color: colors.neutral[900],
              margin: 0,
              fontFeatureSettings: "'tnum' on",
            }}
          >
            {totalViews.toLocaleString()}
          </p>
          <p
            style={{
              fontSize: "12px",
              color: colors.neutral[500],
              margin: `${spacing[1]} 0 0 0`,
            }}
          >
            total views · {avgViews.toLocaleString()}/day avg
          </p>
        </div>
      </div>

      {/* Chart */}
      <div style={{ width: "100%", height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={chartData}
            margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
          >
            <defs>
              <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={colors.primary[500]} stopOpacity={0.25} />
                <stop offset="100%" stopColor={colors.primary[500]} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={colors.neutral[200]}
              vertical={false}
            />
            <XAxis
              dataKey="displayDate"
              tick={{ fontSize: 11, fill: colors.neutral[500] }}
              tickLine={false}
              axisLine={{ stroke: colors.neutral[200] }}
              interval="preserveStartEnd"
              dy={8}
            />
            <YAxis
              tick={{ fontSize: 11, fill: colors.neutral[500] }}
              tickLine={false}
              axisLine={false}
              width={50}
              tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: colors.neutral[0],
                border: `1px solid ${colors.neutral[200]}`,
                borderRadius: borderRadius.md,
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.08)",
                padding: "12px 16px",
              }}
              labelStyle={{
                fontWeight: 600,
                color: colors.neutral[900],
                marginBottom: "4px",
              }}
              formatter={(value: number) => [
                <span key="v" style={{ fontWeight: 600, color: colors.neutral[900] }}>
                  {value.toLocaleString()} views
                </span>,
                null,
              ]}
              labelFormatter={(label) => label}
            />
            <Area
              type="monotone"
              dataKey="views"
              stroke={colors.primary[500]}
              strokeWidth={2}
              fill="url(#viewsGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
