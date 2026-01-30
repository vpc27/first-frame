import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import {
  BlockStack,
  Card,
  Page,
  Text,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { checkOllamaHealth } from "~/lib/ollama.server";
import { config } from "~/lib/config.server";
import { colors } from "~/styles/design-system";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopId = session.shop;

  const ollamaHealthy = await checkOllamaHealth();
  const claudeConfigured = Boolean(config.anthropic.apiKey);

  return json({ shopId, ollamaHealthy, claudeConfigured });
};

export default function AiToolsPage() {
  const { ollamaHealthy, claudeConfigured } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();

  const anyProviderAvailable = ollamaHealthy || claudeConfigured;

  const features = [
    {
      title: "Alt Text Generation",
      description:
        "Generate SEO-friendly, accessible alt text for product images using AI vision. Works per-image or in bulk for an entire product.",
      status: "Live",
      action: () => navigate("/app/products"),
      actionLabel: "Generate Alt Text",
    },
    {
      title: "Variant Detection",
      description:
        "Automatically detect which variant (color, size, style) each product image belongs to using AI vision analysis and filename pattern matching.",
      status: "Live",
      action: () => navigate("/app/products"),
      actionLabel: "Map Variants",
    },
  ];

  return (
    <Page>
      <TitleBar title="AI Tools" />

      <BlockStack gap="400">
        {/* Provider Status */}
        <Card>
          <BlockStack gap="200">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Text as="h2" variant="headingSm">
                Provider Status
              </Text>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: anyProviderAvailable ? "#1a7e3c" : colors.neutral[500],
                }}
              >
                {anyProviderAvailable ? "Available" : "No providers"}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                <div
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: ollamaHealthy ? "#1a7e3c" : colors.neutral[400],
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: colors.neutral[600] }}>
                  Ollama (primary) — {ollamaHealthy ? "Running locally" : "Not reachable"}
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                <div
                  style={{
                    width: "7px",
                    height: "7px",
                    borderRadius: "50%",
                    background: claudeConfigured ? "#1a7e3c" : colors.neutral[400],
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: colors.neutral[600] }}>
                  Claude API (fallback) — {claudeConfigured ? "API key configured" : "No API key set"}
                </span>
              </div>
            </div>
          </BlockStack>
        </Card>

        {/* Features list — same card-row pattern as products page */}
        <Card padding="0">
          <div>
            {features.map((feature, index) => (
              <div
                key={feature.title}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "14px",
                  padding: "14px 16px",
                  borderBottom: index < features.length - 1 ? `1px solid ${colors.neutral[100]}` : "none",
                }}
              >
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: colors.neutral[900] }}>
                    {feature.title}
                  </div>
                  <div style={{ fontSize: "12px", color: colors.neutral[600], marginTop: "2px" }}>
                    {feature.description}
                  </div>
                </div>

                {/* Status + Action — consistent right side */}
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "#1a7e3c",
                    }}
                  >
                    {feature.status}
                  </span>
                  <button
                    onClick={feature.action}
                    style={{
                      padding: "6px 12px",
                      background: colors.primary[500],
                      color: "white",
                      border: "none",
                      borderRadius: "6px",
                      fontSize: "12px",
                      fontWeight: 500,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {feature.actionLabel}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </BlockStack>
    </Page>
  );
}
