/**
 * EngagementChart Component
 * Time-series area chart for gallery engagement over time
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
import { Text, BlockStack } from "@shopify/polaris";

interface DataPoint {
  date: string;
  views: number;
  zooms?: number;
}

interface EngagementChartProps {
  data: DataPoint[];
  title?: string;
  loading?: boolean;
}

export function EngagementChart({
  data,
  title = "Engagement Over Time",
  loading,
}: EngagementChartProps) {
  // Format date for display (e.g., "Jan 15")
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  // Format data for chart
  const chartData = data.map((d) => ({
    ...d,
    displayDate: formatDate(d.date),
  }));

  const containerStyle = {
    background: "#FFFFFF",
    borderRadius: "12px",
    border: "1px solid #E1E3E5",
    padding: "24px",
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h3">
            {title}
          </Text>
          <div
            style={{
              height: 280,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#F6F6F7",
              borderRadius: 8,
            }}
          >
            <Text tone="subdued" as="p">
              Loading chart...
            </Text>
          </div>
        </BlockStack>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div style={containerStyle}>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h3">
            {title}
          </Text>
          <div
            style={{
              height: 280,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #F4F6FF 0%, #F6F6F7 100%)",
              borderRadius: 8,
            }}
          >
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>📊</div>
              <Text tone="subdued" as="p">
                No data available yet
              </Text>
              <Text variant="bodySm" tone="subdued" as="p">
                Analytics will appear once customers view your galleries
              </Text>
            </div>
          </div>
        </BlockStack>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <BlockStack gap="400">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Text variant="headingMd" as="h3">
            {title}
          </Text>
          <Text variant="bodySm" as="span" tone="subdued">
            Last 30 days
          </Text>
        </div>
        <div style={{ width: "100%", height: 280 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2C6ECB" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#2C6ECB" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E1E3E5" vertical={false} />
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 11, fill: "#6D7175" }}
                tickLine={false}
                axisLine={{ stroke: "#E1E3E5" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#6D7175" }}
                tickLine={false}
                axisLine={false}
                width={45}
                tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(1)}k` : value}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "#fff",
                  border: "1px solid #E1E3E5",
                  borderRadius: 8,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  padding: "12px",
                }}
                labelStyle={{ fontWeight: 600, marginBottom: 4, color: "#202223" }}
                formatter={(value: number) => [value.toLocaleString(), "Views"]}
              />
              <Area
                type="monotone"
                dataKey="views"
                stroke="#2C6ECB"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorViews)"
                name="Gallery Views"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </BlockStack>
    </div>
  );
}
