/**
 * Rules Hub Page (PGP-F2.0 UX Overhaul)
 *
 * Card-based dashboard with:
 * - Category filter tabs
 * - Plain-language rule summaries via RuleCard
 * - UseCasePicker modal (triggered by "+ Create")
 * - RuleWizard for guided creation
 * - Stats cards, Preview, delete modal
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Banner,
  Button,
  Modal,
  Text,
  BlockStack,
  InlineStack,
  EmptyState,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getShopRules } from "~/lib/rules/storage.server";
// getRuleMatchSummary removed (was SQLite-based, no longer needed)
const getRuleMatchSummary = async (_shopId: string) => [] as { ruleId: string; matchCount: number }[];
import { getShopImageTags } from "~/lib/variant-mapping.server";
import type { Rule } from "~/types/rules";
import { RulePreviewPanel } from "~/components/rules/RulePreviewPanel";
import { RuleCard } from "~/components/rules/RuleCard";
import { UseCasePicker } from "~/components/rules/UseCasePicker";
import { RuleWizard } from "~/components/rules/RuleWizard";
import { getCategoryFromRule, type RuleCategory } from "~/lib/rules/summary";
import { colors, borderRadius, spacing } from "~/styles/design-system";

// =============================================================================
// LOADER
// =============================================================================

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopId = session.shop;
  const [rulesData, matchSummary, shopTags] = await Promise.all([
    getShopRules(admin),
    getRuleMatchSummary(shopId).catch(() => []),
    getShopImageTags(admin).catch(() => [] as string[]),
  ]);

  const matchCounts: Record<string, number> = {};
  for (const m of matchSummary) {
    matchCounts[m.ruleId] = m.matchCount;
  }

  return json({
    rules: rulesData.rules,
    globalSettings: rulesData.globalSettings,
    evaluationMode: rulesData.evaluationMode,
    totalRules: rulesData.rules.length,
    activeRules: rulesData.rules.filter((r) => r.status === "active").length,
    matchCounts,
    shopTags,
  });
};

// =============================================================================
// ACTION
// =============================================================================

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);
  return json({ success: true });
};

// =============================================================================
// CATEGORY TABS
// =============================================================================

const CATEGORY_TABS: Array<{ id: RuleCategory | "all"; label: string }> = [
  { id: "all", label: "All" },
  { id: "variant", label: "Variant" },
  { id: "traffic", label: "Traffic" },
  { id: "mobile", label: "Mobile" },
  { id: "customer", label: "Customer" },
  { id: "promotion", label: "Promotion" },
  { id: "inventory", label: "Inventory" },
  { id: "testing", label: "Testing" },
  { id: "regional", label: "Regional" },
  { id: "time", label: "Time" },
];

// =============================================================================
// COMPONENT
// =============================================================================

export default function RulesHubPage() {
  const { rules, totalRules, activeRules, matchCounts, shopTags } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [howItWorksDismissed, setHowItWorksDismissed] = useState(() => {
    try {
      return localStorage.getItem("pgp_how_rules_work_dismissed") === "true";
    } catch {
      return false;
    }
  });
  const [useCasePickerOpen, setUseCasePickerOpen] = useState(false);
  const [wizardTemplateId, setWizardTemplateId] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteModal, setDeleteModal] = useState<{
    open: boolean;
    rule: Rule | null;
  }>({ open: false, rule: null });

  // Filter rules by category
  const filteredRules =
    activeCategory === "all"
      ? rules
      : (rules as Rule[]).filter(
          (r) => getCategoryFromRule(r) === activeCategory
        );

  // Category counts
  const categoryCounts: Record<string, number> = {};
  for (const rule of rules as Rule[]) {
    const cat = getCategoryFromRule(rule);
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  // Handlers
  const handleStatusToggle = useCallback(
    (rule: Rule) => {
      const newStatus = rule.status === "active" ? "paused" : "active";
      fetcher.submit(
        { ruleId: rule.id, updates: JSON.stringify({ status: newStatus }) },
        { method: "PUT", action: "/api/rules", encType: "application/json" }
      );
    },
    [fetcher]
  );

  const handleDelete = useCallback(() => {
    if (!deleteModal.rule) return;
    fetcher.submit(
      { ruleId: deleteModal.rule.id },
      { method: "DELETE", action: "/api/rules", encType: "application/json" }
    );
    setDeleteModal({ open: false, rule: null });
    // Revalidate after delete so the list updates (and shows empty state if needed)
    setTimeout(() => navigate("/app/rules", { replace: true }), 300);
  }, [deleteModal.rule, fetcher, navigate]);

  const handleDuplicate = useCallback(
    (rule: Rule) => {
      fetcher.submit(
        { action: "duplicate", ruleId: rule.id },
        { method: "POST", action: "/api/rules", encType: "application/json" }
      );
    },
    [fetcher]
  );

  const handleSelectTemplate = useCallback((templateId: string) => {
    setUseCasePickerOpen(false);
    setWizardTemplateId(templateId);
    setWizardOpen(true);
  }, []);

  const handleAdvancedEditor = useCallback(() => {
    setUseCasePickerOpen(false);
    navigate("/app/rules/new?mode=blank");
  }, [navigate]);

  const handleCreateRule = useCallback(
    (rule: Rule) => {
      fetcher.submit(
        JSON.stringify({ rule }),
        { method: "POST", action: "/api/rules", encType: "application/json" }
      );
      setWizardOpen(false);
      setWizardTemplateId(null);
      // Navigate to refresh the rules list with the new rule
      setTimeout(() => navigate("/app/rules", { replace: true }), 300);
    },
    [fetcher, navigate]
  );

  const handleCreateMultipleRules = useCallback(
    (rules: Rule[]) => {
      fetcher.submit(
        JSON.stringify({ action: "batch-create", rules }),
        { method: "POST", action: "/api/rules", encType: "application/json" }
      );
      setWizardOpen(false);
      setWizardTemplateId(null);
      setTimeout(() => navigate("/app/rules", { replace: true }), 500);
    },
    [fetcher, navigate]
  );

  // Empty state
  if (rules.length === 0) {
    return (
      <Page backAction={{ url: "/app" }}>
        <TitleBar title="Gallery Rules" />
        <div style={{ padding: spacing[6] }}>
          <EmptyState
            heading="Create your first gallery rule"
            action={{
              content: "Create rule",
              onAction: () => setUseCasePickerOpen(true),
            }}
            secondaryAction={{
              content: "Browse templates",
              onAction: () => navigate("/app/rule-templates"),
            }}
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>
              Rules let you automatically customize your product gallery based
              on variant selection, traffic source, device type, and more.
            </p>
            <div style={{ marginTop: spacing[4], textAlign: "left", fontSize: "13px", color: colors.neutral[600] }}>
              <strong>Quick start:</strong> Tag images in Products &gt; Edit Images, then create a rule here to control what visitors see.
            </div>
          </EmptyState>
        </div>

        <UseCasePicker
          open={useCasePickerOpen}
          onClose={() => setUseCasePickerOpen(false)}
          onSelectTemplate={handleSelectTemplate}
          onAdvancedEditor={handleAdvancedEditor}
        />

        <RuleWizard
          open={wizardOpen}
          templateId={wizardTemplateId}
          onClose={() => { setWizardOpen(false); setWizardTemplateId(null); }}
          onCreateRule={handleCreateRule}
          onCreateMultipleRules={handleCreateMultipleRules}
          availableTags={shopTags}
        />
      </Page>
    );
  }

  return (
    <Page backAction={{ url: "/app" }}>
      <TitleBar title="Gallery Rules" />

      <div
        style={{ maxWidth: "1200px", margin: "0 auto", padding: spacing[6] }}
      >
        <BlockStack gap="600">
          {/* Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  color: colors.neutral[900],
                  margin: 0,
                }}
              >
                Gallery Rules
              </h1>
              <p
                style={{
                  fontSize: "14px",
                  color: colors.neutral[500],
                  margin: `${spacing[1]} 0 0 0`,
                }}
              >
                {activeRules} of {totalRules} rules active
              </p>
            </div>
            <InlineStack gap="300">
              <Button onClick={() => setPreviewOpen(true)}>Preview</Button>
              <Button
                variant="primary"
                onClick={() => setUseCasePickerOpen(true)}
              >
                + Create rule
              </Button>
            </InlineStack>
          </div>

          {/* How it works banner */}
          {!howItWorksDismissed && (
            <Banner
              title="How Gallery Rules Work"
              tone="info"
              onDismiss={() => {
                setHowItWorksDismissed(true);
                try { localStorage.setItem("pgp_how_rules_work_dismissed", "true"); } catch {}
              }}
            >
              <ol style={{ margin: "4px 0 0 0", paddingLeft: "20px", lineHeight: 1.8 }}>
                <li><strong>Tag your images</strong> — In Products &gt; Edit Images, tag images (e.g., "lifestyle", "product-shot")</li>
                <li><strong>Create a rule</strong> — Pick a use case, configure conditions and actions</li>
                <li><strong>Activate</strong> — Toggle the rule to Active</li>
                <li><strong>Done</strong> — Rules apply automatically on your storefront</li>
              </ol>
            </Banner>
          )}

          {/* Stats Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: spacing[4],
            }}
          >
            <StatCard label="Total Rules" value={totalRules} color="primary" />
            <StatCard label="Active" value={activeRules} color="success" />
            <StatCard
              label="Paused"
              value={(rules as Rule[]).filter((r) => r.status === "paused").length}
              color="warning"
            />
            <StatCard
              label="Draft"
              value={(rules as Rule[]).filter((r) => r.status === "draft").length}
              color="info"
            />
          </div>

          {/* Category Tabs */}
          <div
            style={{
              display: "flex",
              gap: spacing[1],
              overflowX: "auto",
              paddingBottom: spacing[1],
            }}
          >
            {CATEGORY_TABS.map((tab) => {
              const count =
                tab.id === "all" ? rules.length : categoryCounts[tab.id] || 0;
              if (tab.id !== "all" && count === 0) return null;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveCategory(tab.id)}
                  style={{
                    padding: `${spacing[1]} ${spacing[3]}`,
                    borderRadius: borderRadius.full,
                    border: "none",
                    background:
                      activeCategory === tab.id
                        ? colors.primary[500]
                        : colors.neutral[100],
                    color:
                      activeCategory === tab.id
                        ? colors.neutral[0]
                        : colors.neutral[700],
                    fontSize: "13px",
                    fontWeight: activeCategory === tab.id ? 600 : 400,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s",
                  }}
                >
                  {tab.label}
                  {count > 0 && (
                    <span
                      style={{
                        marginLeft: spacing[1],
                        opacity: 0.7,
                      }}
                    >
                      ({count})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Rule Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
              gap: spacing[4],
            }}
          >
            {filteredRules.map((rule: Rule) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                matchCount={(matchCounts as Record<string, number>)[rule.id]}
                onToggleStatus={handleStatusToggle}
                onDelete={(r) => setDeleteModal({ open: true, rule: r })}
                onDuplicate={handleDuplicate}
                onEdit={(r) => navigate(`/app/rules/${r.id}`)}
              />
            ))}
          </div>

          {filteredRules.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: spacing[8],
                color: colors.neutral[500],
              }}
            >
              No rules in this category.
            </div>
          )}

          {/* Engine Settings Link */}
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              padding: spacing[4],
            }}
          >
            <button
              onClick={() => navigate("/app/rules-settings")}
              style={{
                background: "none",
                border: "none",
                color: colors.primary[500],
                fontSize: "14px",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Configure rules engine settings
            </button>
          </div>
        </BlockStack>
      </div>

      {/* Modals */}
      <RulePreviewPanel
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        rules={rules as Rule[]}
      />

      <UseCasePicker
        open={useCasePickerOpen}
        onClose={() => setUseCasePickerOpen(false)}
        onSelectTemplate={handleSelectTemplate}
        onAdvancedEditor={handleAdvancedEditor}
      />

      <RuleWizard
        open={wizardOpen}
        templateId={wizardTemplateId}
        onClose={() => { setWizardOpen(false); setWizardTemplateId(null); }}
        onCreateRule={handleCreateRule}
        onCreateMultipleRules={handleCreateMultipleRules}
        availableTags={shopTags}
      />

      <Modal
        open={deleteModal.open}
        onClose={() => setDeleteModal({ open: false, rule: null })}
        title="Delete rule?"
        primaryAction={{
          content: "Delete",
          destructive: true,
          onAction: handleDelete,
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setDeleteModal({ open: false, rule: null }),
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            Are you sure you want to delete &quot;{deleteModal.rule?.name}&quot;? This
            action cannot be undone.
          </Text>
        </Modal.Section>
      </Modal>
    </Page>
  );
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "primary" | "success" | "warning" | "info";
}) {
  const colorMap = {
    primary: colors.primary[500],
    success: colors.success.main,
    warning: colors.warning.main,
    info: colors.info.main,
  };

  return (
    <div
      style={{
        padding: spacing[4],
        background: colors.neutral[0],
        borderRadius: borderRadius.lg,
        border: `1px solid ${colors.neutral[200]}`,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "3px",
          background: colorMap[color],
        }}
      />
      <div
        style={{
          fontSize: "12px",
          fontWeight: 600,
          color: colors.neutral[500],
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          marginBottom: spacing[2],
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "28px",
          fontWeight: 700,
          color: colors.neutral[900],
        }}
      >
        {value}
      </div>
    </div>
  );
}
