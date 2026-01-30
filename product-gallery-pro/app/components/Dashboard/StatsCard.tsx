/**
 * StatsCard Component
 * Displays a metric with optional trend indicator and color accent
 */

import { Text, InlineStack, Icon } from "@shopify/polaris";
import { ArrowUpIcon, ArrowDownIcon } from "@shopify/polaris-icons";

interface StatsCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    direction: "up" | "down";
  };
  icon?: string;
  tone?: "default" | "success" | "warning" | "critical" | "info";
  helpText?: string;
  loading?: boolean;
}

const toneColors = {
  default: { bg: "#F6F6F7", border: "#E1E3E5", accent: "#202223" },
  success: { bg: "#F1F8F5", border: "#95C9B4", accent: "#008060" },
  warning: { bg: "#FFF8E6", border: "#FFCC47", accent: "#B98900" },
  critical: { bg: "#FFF4F4", border: "#FFA8A8", accent: "#D72C0D" },
  info: { bg: "#F4F6FF", border: "#A4BCFD", accent: "#2C6ECB" },
};

export function StatsCard({
  title,
  value,
  change,
  icon,
  tone = "default",
  helpText,
  loading,
}: StatsCardProps) {
  const formattedValue =
    typeof value === "number" ? value.toLocaleString() : value;
  const colors = toneColors[tone];

  return (
    <div
      style={{
        background: colors.bg,
        borderRadius: "12px",
        border: `1px solid ${colors.border}`,
        padding: "20px",
        height: "100%",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {icon && (
          <div style={{ fontSize: "24px", marginBottom: "4px" }}>{icon}</div>
        )}
        <Text variant="headingXl" as="p" fontWeight="bold">
          {loading ? "—" : formattedValue}
        </Text>
        <Text variant="bodyMd" as="p" tone="subdued">
          {title}
        </Text>
        {change && !loading && (
          <InlineStack gap="100" blockAlign="center">
            <Icon
              source={change.direction === "up" ? ArrowUpIcon : ArrowDownIcon}
              tone={change.direction === "up" ? "success" : "critical"}
            />
            <Text
              variant="bodySm"
              as="span"
              tone={change.direction === "up" ? "success" : "critical"}
            >
              {change.value}% vs last period
            </Text>
          </InlineStack>
        )}
        {helpText && (
          <Text variant="bodySm" as="p" tone="subdued">
            {helpText}
          </Text>
        )}
      </div>
    </div>
  );
}
