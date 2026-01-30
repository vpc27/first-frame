/**
 * Rule Preview Panel (PGP-F2.0)
 *
 * Modal for testing rules with configurable context inputs.
 * Calls /api/rules/preview and displays matched rules + final result.
 */

import { useState, useCallback } from "react";
import {
  Modal,
  FormLayout,
  Select,
  TextField,
  Text,
  BlockStack,
  InlineStack,
  Badge,
  Banner,
  Button,
  Spinner,
} from "@shopify/polaris";
import type { Rule } from "~/types/rules";
import { colors, borderRadius, spacing } from "~/styles/design-system";

interface PreviewResult {
  result: {
    media: Array<{
      id: string;
      visible: boolean;
      badges: Array<{ text: string; position: string }>;
      appliedRuleIds: string[];
    }>;
    matchedRules: Array<{ id: string; name: string }>;
    evaluationTimeMs: number;
    usedLegacyFallback: boolean;
  };
  context: {
    device: string;
    variant: { selectedOptions: Record<string, string> };
    customer: { isLoggedIn: boolean; tags: string[] };
    time: { now: string };
  };
}

interface RulePreviewPanelProps {
  open: boolean;
  onClose: () => void;
  rules: Rule[];
}

export function RulePreviewPanel({ open, onClose, rules }: RulePreviewPanelProps) {
  const [device, setDevice] = useState("desktop");
  const [variantOption, setVariantOption] = useState("");
  const [variantValue, setVariantValue] = useState("");
  const [customerLoggedIn, setCustomerLoggedIn] = useState("false");
  const [customerTags, setCustomerTags] = useState("");
  const [utmSource, setUtmSource] = useState("");
  const [utmCampaign, setUtmCampaign] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PreviewResult | null>(null);

  const handlePreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    const selectedOptions: Record<string, string> = {};
    if (variantOption && variantValue) {
      selectedOptions[variantOption] = variantValue;
    }

    const context: Record<string, unknown> = {
      device,
      screenWidth: device === "mobile" ? 375 : device === "tablet" ? 768 : 1440,
      variant: {
        selectedOptions,
        selectedValues: variantValue ? [variantValue] : [],
      },
      customer: {
        isLoggedIn: customerLoggedIn === "true",
        tags: customerTags ? customerTags.split(",").map((t) => t.trim()) : [],
      },
      traffic: {
        path: "/products/test-product",
        utmSource: utmSource || undefined,
        utmCampaign: utmCampaign || undefined,
      },
    };

    try {
      const response = await fetch("/api/rules/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rules, context }),
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || "Preview failed");
      }

      setResult(data.data as PreviewResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }, [rules, device, variantOption, variantValue, customerLoggedIn, customerTags, utmSource, utmCampaign]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Preview Rules"
      primaryAction={{
        content: loading ? "Evaluating..." : "Run Preview",
        onAction: handlePreview,
        loading,
      }}
      secondaryActions={[{ content: "Close", onAction: onClose }]}
      large
    >
      <Modal.Section>
        <BlockStack gap="400">
          <Text as="h3" variant="headingSm">
            Simulation Context
          </Text>
          <FormLayout>
            <FormLayout.Group>
              <Select
                label="Device"
                options={[
                  { label: "Desktop", value: "desktop" },
                  { label: "Mobile", value: "mobile" },
                  { label: "Tablet", value: "tablet" },
                ]}
                value={device}
                onChange={setDevice}
              />
              <Select
                label="Customer"
                options={[
                  { label: "Guest", value: "false" },
                  { label: "Logged in", value: "true" },
                ]}
                value={customerLoggedIn}
                onChange={setCustomerLoggedIn}
              />
            </FormLayout.Group>
            <FormLayout.Group>
              <TextField
                label="Variant option name"
                value={variantOption}
                onChange={setVariantOption}
                placeholder="e.g., Color"
                autoComplete="off"
              />
              <TextField
                label="Variant value"
                value={variantValue}
                onChange={setVariantValue}
                placeholder="e.g., Red"
                autoComplete="off"
              />
            </FormLayout.Group>
            <FormLayout.Group>
              <TextField
                label="Customer tags"
                value={customerTags}
                onChange={setCustomerTags}
                placeholder="VIP, wholesale"
                autoComplete="off"
              />
              <TextField
                label="UTM Source"
                value={utmSource}
                onChange={setUtmSource}
                placeholder="instagram"
                autoComplete="off"
              />
            </FormLayout.Group>
            <TextField
              label="UTM Campaign"
              value={utmCampaign}
              onChange={setUtmCampaign}
              placeholder="summer-sale"
              autoComplete="off"
            />
          </FormLayout>
        </BlockStack>
      </Modal.Section>

      {error && (
        <Modal.Section>
          <Banner tone="critical" title="Preview Error">
            <p>{error}</p>
          </Banner>
        </Modal.Section>
      )}

      {loading && (
        <Modal.Section>
          <div style={{ textAlign: "center", padding: spacing[6] }}>
            <Spinner size="large" />
          </div>
        </Modal.Section>
      )}

      {result && (
        <Modal.Section>
          <BlockStack gap="400">
            <InlineStack align="space-between">
              <Text as="h3" variant="headingSm">
                Results
              </Text>
              <Text as="span" variant="bodySm" tone="subdued">
                {result.result.evaluationTimeMs.toFixed(2)}ms
              </Text>
            </InlineStack>

            {result.result.matchedRules.length === 0 ? (
              <Banner tone="warning" title="No rules matched">
                <p>
                  {result.result.usedLegacyFallback
                    ? "Fell back to legacy variant mapping."
                    : "No rules matched this context. Default gallery will be shown."}
                </p>
              </Banner>
            ) : (
              <BlockStack gap="200">
                <Text as="p" variant="bodySm" fontWeight="semibold">
                  Matched rules (in evaluation order):
                </Text>
                {result.result.matchedRules.map((r, i) => (
                  <div
                    key={r.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: spacing[2],
                      padding: `${spacing[2]} ${spacing[3]}`,
                      background: colors.neutral[50],
                      borderRadius: borderRadius.md,
                      border: `1px solid ${colors.neutral[200]}`,
                    }}
                  >
                    <Badge tone="success">{String(i + 1)}</Badge>
                    <Text as="span" variant="bodyMd" fontWeight="semibold">
                      {r.name}
                    </Text>
                  </div>
                ))}
              </BlockStack>
            )}

            <Text as="p" variant="bodySm" fontWeight="semibold">
              Media result: {result.result.media.filter((m) => m.visible).length} visible
              {" / "}
              {result.result.media.length} total
            </Text>
          </BlockStack>
        </Modal.Section>
      )}
    </Modal>
  );
}
