/**
 * UseCasePicker Component (PGP-F2.0 UX Overhaul)
 *
 * Modal that opens when clicking "+ Create". Replaces blank/template choice
 * with a categorized grid of use cases.
 */

import { useState } from "react";
import { Modal, Text, BlockStack } from "@shopify/polaris";
import {
  getAllTemplates,
  type RuleTemplate,
  type TemplateCategory,
} from "~/lib/rules/templates";
import { colors, borderRadius, spacing } from "~/styles/design-system";

// =============================================================================
// TYPES
// =============================================================================

interface UseCasePickerProps {
  open: boolean;
  onClose: () => void;
  onSelectTemplate: (templateId: string) => void;
  onAdvancedEditor: () => void;
}

interface CategoryTab {
  id: TemplateCategory | "popular" | "all";
  label: string;
}

// =============================================================================
// CONSTANTS
// =============================================================================

const CATEGORY_TABS: CategoryTab[] = [
  { id: "popular", label: "Popular" },
  { id: "all", label: "All" },
  { id: "variant", label: "Variant" },
  { id: "traffic", label: "Traffic" },
  { id: "mobile", label: "Mobile" },
  { id: "customer", label: "Customer" },
  { id: "promotion", label: "Promotion" },
  { id: "inventory", label: "Inventory" },
  { id: "testing", label: "Testing" },
  { id: "regional", label: "Regional" },
];

const POPULAR_IDS = [
  "variant-filtering",
  "mobile-optimization",
  "instagram-traffic",
  "sale-badge",
];

const USE_CASE_ICONS: Record<string, string> = {
  "variant-filtering": "🎨",
  "mobile-optimization": "📱",
  "instagram-traffic": "📷",
  "sale-badge": "🏷️",
  "vip-customer": "👤",
  "low-stock-alert": "📦",
  "ab-test-hero": "🔬",
  "regional-images": "🌍",
};

const CATEGORY_COLORS: Record<string, { bg: string; border: string }> = {
  variant: { bg: colors.primary[50], border: colors.primary[200] },
  traffic: { bg: colors.info.light, border: colors.info.main },
  mobile: { bg: colors.success.light, border: colors.success.main },
  customer: { bg: colors.warning.light, border: colors.warning.main },
  promotion: { bg: colors.critical.light, border: colors.critical.main },
  inventory: { bg: colors.warning.light, border: colors.warning.main },
  testing: { bg: colors.info.light, border: colors.info.main },
  regional: { bg: colors.success.light, border: colors.success.main },
};

// =============================================================================
// COMPONENT
// =============================================================================

export function UseCasePicker({
  open,
  onClose,
  onSelectTemplate,
  onAdvancedEditor,
}: UseCasePickerProps) {
  const [activeTab, setActiveTab] = useState<string>("popular");
  const templates = getAllTemplates();

  const filteredTemplates =
    activeTab === "popular"
      ? templates.filter((t) => POPULAR_IDS.includes(t.id))
      : activeTab === "all"
        ? templates
        : templates.filter((t) => t.category === activeTab);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="What would you like to do?"
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Category tabs */}
          <div
            style={{
              display: "flex",
              gap: spacing[1],
              overflowX: "auto",
              paddingBottom: spacing[2],
              borderBottom: `1px solid ${colors.neutral[200]}`,
            }}
          >
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  padding: `${spacing[1]} ${spacing[3]}`,
                  borderRadius: borderRadius.full,
                  border: "none",
                  background: activeTab === tab.id ? colors.primary[500] : "transparent",
                  color: activeTab === tab.id ? colors.neutral[0] : colors.neutral[600],
                  fontSize: "13px",
                  fontWeight: activeTab === tab.id ? 600 : 400,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Template grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: spacing[3],
            }}
          >
            {filteredTemplates.map((template) => (
              <UseCaseCard
                key={template.id}
                template={template}
                onSelect={() => onSelectTemplate(template.id)}
              />
            ))}
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: spacing[3],
              borderTop: `1px solid ${colors.neutral[200]}`,
            }}
          >
            <button
              onClick={() => {
                setActiveTab("all");
              }}
              style={{
                background: "none",
                border: "none",
                color: colors.primary[500],
                fontSize: "14px",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Browse all templates
            </button>
            <button
              onClick={onAdvancedEditor}
              style={{
                background: "none",
                border: `1px solid ${colors.neutral[300]}`,
                borderRadius: borderRadius.md,
                padding: `${spacing[2]} ${spacing[3]}`,
                color: colors.neutral[700],
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Advanced Editor
            </button>
          </div>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

// =============================================================================
// USE CASE CARD
// =============================================================================

function UseCaseCard({
  template,
  onSelect,
}: {
  template: RuleTemplate;
  onSelect: () => void;
}) {
  const icon = USE_CASE_ICONS[template.id] || "⚡";
  const categoryColor = CATEGORY_COLORS[template.category] || CATEGORY_COLORS.variant;

  return (
    <button
      onClick={onSelect}
      style={{
        padding: spacing[4],
        background: colors.neutral[0],
        border: `1px solid ${colors.neutral[200]}`,
        borderRadius: borderRadius.lg,
        textAlign: "left",
        cursor: "pointer",
        transition: "all 0.15s",
        display: "flex",
        gap: spacing[3],
        alignItems: "flex-start",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = categoryColor.border;
        e.currentTarget.style.background = categoryColor.bg;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = colors.neutral[200];
        e.currentTarget.style.background = colors.neutral[0];
      }}
    >
      <div
        style={{
          fontSize: "24px",
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: colors.neutral[900],
            marginBottom: spacing[1],
          }}
        >
          {template.name}
        </div>
        <div
          style={{
            fontSize: "13px",
            color: colors.neutral[600],
            lineHeight: 1.4,
          }}
        >
          {template.description}
        </div>
      </div>
    </button>
  );
}
