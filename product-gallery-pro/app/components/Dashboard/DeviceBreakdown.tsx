/**
 * DeviceBreakdown Component
 * Shows device type distribution (mobile, tablet, desktop)
 */

import { Text, BlockStack, InlineStack } from "@shopify/polaris";

interface DeviceStats {
  mobile: number;
  tablet: number;
  desktop: number;
}

interface DeviceBreakdownProps {
  stats: DeviceStats;
  loading?: boolean;
}

export function DeviceBreakdown({ stats, loading }: DeviceBreakdownProps) {
  const total = stats.mobile + stats.tablet + stats.desktop;

  const getPercentage = (value: number) => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  const devices = [
    {
      name: "Mobile",
      icon: "📱",
      value: stats.mobile,
      percentage: getPercentage(stats.mobile),
      color: "#008060",
    },
    {
      name: "Desktop",
      icon: "💻",
      value: stats.desktop,
      percentage: getPercentage(stats.desktop),
      color: "#2C6ECB",
    },
    {
      name: "Tablet",
      icon: "📟",
      value: stats.tablet,
      percentage: getPercentage(stats.tablet),
      color: "#9C6ADE",
    },
  ];

  const containerStyle = {
    background: "#FFFFFF",
    borderRadius: "12px",
    border: "1px solid #E1E3E5",
    padding: "20px",
  };

  if (loading) {
    return (
      <div style={containerStyle}>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h3">
            Device Breakdown
          </Text>
          <Text tone="subdued" as="p">
            Loading...
          </Text>
        </BlockStack>
      </div>
    );
  }

  if (total === 0) {
    return (
      <div style={containerStyle}>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h3">
            Device Breakdown
          </Text>
          <div
            style={{
              padding: "24px",
              textAlign: "center",
              background: "#F6F6F7",
              borderRadius: "8px",
            }}
          >
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>📊</div>
            <Text tone="subdued" as="p">
              No device data yet
            </Text>
          </div>
        </BlockStack>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      <BlockStack gap="400">
        <Text variant="headingMd" as="h3">
          Device Breakdown
        </Text>

        {/* Horizontal bar visualization */}
        <div
          style={{
            display: "flex",
            height: "12px",
            borderRadius: "6px",
            overflow: "hidden",
            background: "#F6F6F7",
          }}
        >
          {devices.map((device) => (
            <div
              key={device.name}
              style={{
                width: `${device.percentage}%`,
                background: device.color,
                transition: "width 0.3s ease",
              }}
            />
          ))}
        </div>

        {/* Legend */}
        <BlockStack gap="200">
          {devices.map((device) => (
            <InlineStack key={device.name} align="space-between" blockAlign="center">
              <InlineStack gap="200" blockAlign="center">
                <div
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "3px",
                    background: device.color,
                  }}
                />
                <Text variant="bodyMd" as="span">
                  {device.icon} {device.name}
                </Text>
              </InlineStack>
              <InlineStack gap="200">
                <Text variant="bodyMd" as="span" fontWeight="semibold">
                  {device.percentage}%
                </Text>
                <Text variant="bodySm" as="span" tone="subdued">
                  ({device.value.toLocaleString()})
                </Text>
              </InlineStack>
            </InlineStack>
          ))}
        </BlockStack>
      </BlockStack>
    </div>
  );
}
