/**
 * Create New Rule Page (PGP-F2.0 UX Overhaul)
 *
 * Simplified: defaults to UseCasePicker layout.
 * "Advanced Editor" link leads to blank rule creation.
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useNavigate, useFetcher, useSearchParams } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Button,
  Card,
  FormLayout,
  TextField,
  Text,
  BlockStack,
  InlineStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { addShopRule } from "~/lib/rules/storage.server";
import type { Rule } from "~/types/rules";
import { createEmptyRule, validateRule } from "~/types/rules";
import {
  getAllTemplates,
  createRuleFromTemplate,
  type RuleTemplate,
} from "~/lib/rules/templates";
import { UseCasePicker } from "~/components/rules/UseCasePicker";
import { RuleWizard } from "~/components/rules/RuleWizard";
import { colors, borderRadius, spacing } from "~/styles/design-system";

// =============================================================================
// LOADER
// =============================================================================

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);
  return json({});
};

// =============================================================================
// ACTION
// =============================================================================

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const name = formData.get("name") as string;
  const templateId = formData.get("templateId") as string | null;
  const ruleJson = formData.get("rule") as string | null;

  let rule: Rule;

  if (ruleJson) {
    // Rule created via wizard
    rule = JSON.parse(ruleJson);
  } else if (templateId) {
    rule = createRuleFromTemplate(templateId);
    if (name) rule.name = name;
  } else {
    rule = createEmptyRule(name || "New Rule");
  }

  const validation = validateRule(rule);
  if (!validation.valid) {
    return json(
      { success: false, errors: validation.errors },
      { status: 400 }
    );
  }

  await addShopRule(admin, rule);
  return redirect(`/app/rules/${rule.id}`);
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function CreateRulePage() {
  const navigate = useNavigate();
  const fetcher = useFetcher();
  const [searchParams] = useSearchParams();

  const [mode, setMode] = useState<"picker" | "blank">(
    searchParams.get("mode") === "blank" ? "blank" : "picker"
  );
  const [name, setName] = useState("");
  const [wizardTemplateId, setWizardTemplateId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const handleCreateBlank = useCallback(() => {
    if (!name.trim()) return;
    fetcher.submit({ name }, { method: "POST" });
  }, [name, fetcher]);

  const handleSelectTemplate = useCallback((templateId: string) => {
    setWizardTemplateId(templateId);
    setWizardOpen(true);
  }, []);

  const handleCreateRule = useCallback(
    (rule: Rule) => {
      fetcher.submit(
        { rule: JSON.stringify(rule) },
        { method: "POST" }
      );
      setWizardOpen(false);
      setWizardTemplateId(null);
    },
    [fetcher]
  );

  // Blank mode - advanced editor
  if (mode === "blank") {
    return (
      <Page
        backAction={{ content: "Back", onAction: () => setMode("picker") }}
        title="Create Blank Rule"
      >
        <TitleBar title="Create Blank Rule" />
        <div style={{ maxWidth: "600px", margin: "0 auto", padding: spacing[6] }}>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Rule Name
              </Text>
              <FormLayout>
                <TextField
                  label="Name"
                  value={name}
                  onChange={setName}
                  placeholder="e.g., Mobile Gallery Optimization"
                  autoComplete="off"
                  helpText="Give your rule a descriptive name"
                />
              </FormLayout>
              <InlineStack gap="300" align="end">
                <Button onClick={() => setMode("picker")}>Cancel</Button>
                <Button
                  variant="primary"
                  onClick={handleCreateBlank}
                  disabled={!name.trim()}
                  loading={fetcher.state === "submitting"}
                >
                  Create Rule
                </Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </div>
      </Page>
    );
  }

  // Default: UseCasePicker layout
  return (
    <Page
      backAction={{ content: "Rules", onAction: () => navigate("/app/rules") }}
      title="Create Rule"
    >
      <TitleBar title="Create Rule" />

      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: spacing[6] }}>
        <BlockStack gap="600">
          <Text as="p" variant="bodyLg">
            Choose what you want to accomplish, and we&apos;ll guide you through setup.
          </Text>

          {/* Inline use case picker (not modal) */}
          <UseCaseGrid onSelectTemplate={handleSelectTemplate} />

          {/* Advanced option */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              paddingTop: spacing[4],
              borderTop: `1px solid ${colors.neutral[200]}`,
            }}
          >
            <button
              onClick={() => setMode("blank")}
              style={{
                background: "none",
                border: `1px solid ${colors.neutral[300]}`,
                borderRadius: borderRadius.md,
                padding: `${spacing[2]} ${spacing[4]}`,
                color: colors.neutral[700],
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Start from scratch (Advanced Editor)
            </button>
          </div>
        </BlockStack>
      </div>

      <RuleWizard
        open={wizardOpen}
        templateId={wizardTemplateId}
        onClose={() => { setWizardOpen(false); setWizardTemplateId(null); }}
        onCreateRule={handleCreateRule}
      />
    </Page>
  );
}

// =============================================================================
// INLINE USE CASE GRID (non-modal version)
// =============================================================================

function UseCaseGrid({
  onSelectTemplate,
}: {
  onSelectTemplate: (templateId: string) => void;
}) {
  const templates = getAllTemplates();

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

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: spacing[4],
      }}
    >
      {templates.map((template) => (
        <button
          key={template.id}
          onClick={() => onSelectTemplate(template.id)}
          style={{
            padding: spacing[4],
            background: colors.neutral[0],
            border: `2px solid ${colors.neutral[200]}`,
            borderRadius: borderRadius.lg,
            textAlign: "left",
            cursor: "pointer",
            transition: "all 0.2s",
            display: "flex",
            gap: spacing[3],
            alignItems: "flex-start",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = colors.primary[500];
            e.currentTarget.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = colors.neutral[200];
            e.currentTarget.style.transform = "translateY(0)";
          }}
        >
          <div style={{ fontSize: "28px", lineHeight: 1, flexShrink: 0 }}>
            {USE_CASE_ICONS[template.id] || "⚡"}
          </div>
          <div>
            <h3
              style={{
                fontSize: "16px",
                fontWeight: 600,
                margin: 0,
                color: colors.neutral[900],
              }}
            >
              {template.name}
            </h3>
            <p
              style={{
                fontSize: "14px",
                color: colors.neutral[600],
                margin: `${spacing[1]} 0 0 0`,
                lineHeight: 1.4,
              }}
            >
              {template.description}
            </p>
            <ul
              style={{
                margin: `${spacing[2]} 0 0 0`,
                padding: `0 0 0 ${spacing[4]}`,
                fontSize: "13px",
                color: colors.neutral[500],
              }}
            >
              {template.useCases.slice(0, 2).map((uc, i) => (
                <li key={i}>{uc}</li>
              ))}
            </ul>
          </div>
        </button>
      ))}
    </div>
  );
}
