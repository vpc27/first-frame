/**
 * TopProductsTable Component
 * Shows top performing products by gallery engagement
 */

import { Text, BlockStack, InlineStack, Badge, ProgressBar } from "@shopify/polaris";

interface TopProduct {
  productId: string;
  title: string;
  views: number;
  engagementRate: number;
}

interface TopProductsTableProps {
  products: TopProduct[];
  loading?: boolean;
}

export function TopProductsTable({ products, loading }: TopProductsTableProps) {
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
            Top Performing Products
          </Text>
          <Text tone="subdued" as="p">
            Loading...
          </Text>
        </BlockStack>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div style={containerStyle}>
        <BlockStack gap="400">
          <Text variant="headingMd" as="h3">
            Top Performing Products
          </Text>
          <div
            style={{
              padding: "24px",
              textAlign: "center",
              background: "#F6F6F7",
              borderRadius: "8px",
            }}
          >
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>🏆</div>
            <Text tone="subdued" as="p">
              No product data yet
            </Text>
          </div>
        </BlockStack>
      </div>
    );
  }

  // Find max views for relative comparison
  const maxViews = Math.max(...products.map((p) => p.views));

  const getBadgeTone = (rate: number) => {
    if (rate >= 40) return "success";
    if (rate >= 25) return "info";
    if (rate >= 15) return "warning";
    return "attention";
  };

  return (
    <div style={containerStyle}>
      <BlockStack gap="400">
        <InlineStack align="space-between">
          <Text variant="headingMd" as="h3">
            Top Performing Products
          </Text>
          <Text variant="bodySm" as="span" tone="subdued">
            By views
          </Text>
        </InlineStack>
        <BlockStack gap="300">
          {products.map((product, index) => (
            <div
              key={product.productId}
              style={{
                padding: "12px 16px",
                background: index === 0 ? "#F1F8F5" : "#F6F6F7",
                borderRadius: "8px",
                border: index === 0 ? "1px solid #95C9B4" : "1px solid transparent",
              }}
            >
              <BlockStack gap="200">
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="200" blockAlign="center">
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "50%",
                        background: index === 0 ? "#008060" : index === 1 ? "#2C6ECB" : "#6D7175",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "12px",
                        fontWeight: 600,
                      }}
                    >
                      {index + 1}
                    </div>
                    <Text variant="bodyMd" as="span" fontWeight={index === 0 ? "semibold" : "regular"}>
                      {product.title.length > 25
                        ? product.title.substring(0, 25) + "..."
                        : product.title}
                    </Text>
                  </InlineStack>
                  <Badge tone={getBadgeTone(product.engagementRate)}>
                    {product.engagementRate}%
                  </Badge>
                </InlineStack>
                <InlineStack gap="200" blockAlign="center">
                  <div style={{ width: "70px" }}>
                    <Text variant="bodySm" as="span" tone="subdued">
                      {product.views.toLocaleString()}
                    </Text>
                  </div>
                  <div style={{ flex: 1 }}>
                    <ProgressBar
                      progress={(product.views / maxViews) * 100}
                      size="small"
                      tone={index === 0 ? "success" : "primary"}
                    />
                  </div>
                </InlineStack>
              </BlockStack>
            </div>
          ))}
        </BlockStack>
      </BlockStack>
    </div>
  );
}
