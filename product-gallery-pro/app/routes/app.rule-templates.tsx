/**
 * Rule Templates Page (PGP-F2.0)
 *
 * Displays all 8 pre-built templates with:
 * - Category grouping
 * - Detailed descriptions and use cases
 * - Quick setup wizard
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Button,
  Card,
  FormLayout,
  TextField,
  Modal,
  Text,
  BlockStack,
  InlineStack,
  Tabs,
  Banner,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { addShopRule } from "~/lib/rules/storage.server";
import {
  getAllTemplates,
  getTemplateCategories,
  getTemplateById,
  createRuleFromTemplate,
  type RuleTemplate,
  type TemplateCategory,
  type TemplateConfigOption,
} from "~/lib/rules/templates";
import { colors, borderRadius, spacing } from "~/styles/design-system";
import { getShopImageTags } from "~/lib/variant-mapping.server";

// =============================================================================
// LOADER
// =============================================================================

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const [templates, categories, shopTags] = await Promise.all([
    Promise.resolve(getAllTemplates()),
    Promise.resolve(getTemplateCategories()),
    getShopImageTags(admin).catch(() => [] as string[]),
  ]);

  return json({ templates, categories, shopTags });
};

// =============================================================================
// ACTION
// =============================================================================

export const action = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();

  const templateId = formData.get("templateId") as string;
  const configJson = formData.get("config") as string;
  const config = configJson ? JSON.parse(configJson) : {};

  // Multi-source traffic rules: create one rule per source group
  if (templateId === "traffic-source-gallery" && config.sourceGroups) {
    const groups = config.sourceGroups as Array<{
      utm: string;
      referrer: string;
      tags: string[];
      behavior: string;
    }>;
    for (const group of groups) {
      const groupConfig: Record<string, unknown> = {
        "conditions.conditions[0].value": group.utm,
        "conditions.conditions[1].value": group.referrer || group.utm + ".com",
        "actions[0].matchValues": group.tags,
        "actions[0].type": group.behavior || "prioritize",
      };
      const rule = createRuleFromTemplate(templateId, groupConfig);
      rule.name = `Traffic Source: ${group.utm}`;
      await addShopRule(admin, rule);
    }
    return redirect("/app/rules");
  }

  const rule = createRuleFromTemplate(templateId, config);
  await addShopRule(admin, rule);

  return redirect(`/app/rules/${rule.id}`);
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function TemplatesPage() {
  const { templates, categories, shopTags } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [selectedCategory, setSelectedCategory] = useState(0);
  const [wizardModal, setWizardModal] = useState<{
    open: boolean;
    template: RuleTemplate | null;
  }>({ open: false, template: null });
  const [wizardConfig, setWizardConfig] = useState<Record<string, unknown>>({});

  // Multi-source state for traffic-source-gallery template
  const [sourceGroups, setSourceGroups] = useState<Array<{
    utm: string;
    referrer: string;
    tags: string[];
    behavior: string;
  }>>([
    { utm: "instagram", referrer: "instagram.com", tags: ["lifestyle", "ugc", "social"], behavior: "prioritize" },
  ]);

  // Filter templates by selected category
  const categoryList = ["all", ...categories.map((c) => c.category)];
  const filteredTemplates =
    categoryList[selectedCategory] === "all"
      ? templates
      : templates.filter(
          (t: RuleTemplate) => t.category === categoryList[selectedCategory]
        );

  // Open template wizard
  const openWizard = (template: RuleTemplate) => {
    // Initialize config with default values
    const initialConfig: Record<string, unknown> = {};
    template.configOptions.forEach((opt) => {
      if (opt.defaultValue !== undefined) {
        initialConfig[opt.path] = opt.defaultValue;
      }
    });
    setWizardConfig(initialConfig);
    // Reset multi-source groups for traffic template
    if (template.id === "traffic-source-gallery") {
      setSourceGroups([
        { utm: "instagram", referrer: "instagram.com", tags: ["lifestyle", "ugc", "social"], behavior: "prioritize" },
      ]);
    }
    setWizardModal({ open: true, template });
  };

  // Handle template creation
  const handleCreate = useCallback(() => {
    if (!wizardModal.template) return;

    // Multi-source: pass sourceGroups in config
    if (wizardModal.template.id === "traffic-source-gallery") {
      fetcher.submit(
        {
          templateId: wizardModal.template.id,
          config: JSON.stringify({ sourceGroups }),
        },
        { method: "POST" }
      );
      return;
    }

    fetcher.submit(
      {
        templateId: wizardModal.template.id,
        config: JSON.stringify(wizardConfig),
      },
      { method: "POST" }
    );
  }, [wizardModal.template, wizardConfig, sourceGroups, fetcher]);

  // Tab items
  const tabs = [
    { id: "all", content: `All (${templates.length})` },
    ...categories.map((c) => ({
      id: c.category,
      content: `${c.label} (${c.count})`,
    })),
  ];

  return (
    <Page
      backAction={{ content: "Rules", onAction: () => navigate("/app/rules") }}
      title="Rule Templates"
      primaryAction={{
        content: "Create blank rule",
        onAction: () => navigate("/app/rules/new"),
      }}
    >
      <TitleBar title="Rule Templates" />

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: spacing[6] }}>
        <BlockStack gap="600">
          {/* Header */}
          <div>
            <Text as="p" variant="bodyLg">
              Get started quickly with pre-built rules for common use cases.
              Each template is fully customizable after creation.
            </Text>
          </div>

          {/* Category Tabs */}
          <Tabs
            tabs={tabs}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
          />

          {/* Templates Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: spacing[5],
            }}
          >
            {filteredTemplates.map((template: RuleTemplate) => (
              <TemplateCard
                key={template.id}
                template={template}
                onUse={() => openWizard(template)}
              />
            ))}
          </div>
        </BlockStack>
      </div>

      {/* Template Wizard Modal */}
      <Modal
        open={wizardModal.open}
        onClose={() => setWizardModal({ open: false, template: null })}
        title={`Create: ${wizardModal.template?.name}`}
        primaryAction={{
          content: wizardModal.template?.id === "traffic-source-gallery"
            ? `Create ${sourceGroups.length} Rule${sourceGroups.length > 1 ? "s" : ""}`
            : "Create Rule",
          onAction: handleCreate,
          loading: fetcher.state === "submitting",
        }}
        secondaryActions={[
          {
            content: "Cancel",
            onAction: () => setWizardModal({ open: false, template: null }),
          },
        ]}
        size="large"
      >
        <Modal.Section>
          {wizardModal.template && (
            <BlockStack gap="500">
              {/* Template Description */}
              <Banner tone="info">
                <Text as="p">{wizardModal.template.details}</Text>
              </Banner>

              {/* Multi-source wizard for traffic-source-gallery */}
              {wizardModal.template.id === "traffic-source-gallery" ? (
                <BlockStack gap="500">
                  <Text as="h3" variant="headingSm">
                    Configure traffic sources
                  </Text>
                  {sourceGroups.map((group, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: spacing[4],
                        background: colors.neutral[50],
                        borderRadius: borderRadius.md,
                        border: `1px solid ${colors.neutral[200]}`,
                      }}
                    >
                      <InlineStack align="space-between">
                        <Text as="h4" variant="headingSm">
                          Source {idx + 1}
                        </Text>
                        {sourceGroups.length > 1 && (
                          <button
                            onClick={() => setSourceGroups((prev) => prev.filter((_, i) => i !== idx))}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: colors.critical.main,
                              fontSize: "13px",
                            }}
                          >
                            Remove
                          </button>
                        )}
                      </InlineStack>
                      <div style={{ marginTop: spacing[3] }}>
                        <FormLayout>
                          <FormLayout.Group>
                            <TextField
                              label="UTM Source"
                              value={group.utm}
                              onChange={(v) =>
                                setSourceGroups((prev) =>
                                  prev.map((g, i) => (i === idx ? { ...g, utm: v } : g))
                                )
                              }
                              placeholder="e.g. instagram, facebook, google"
                              autoComplete="off"
                            />
                            <TextField
                              label="Referrer Domain"
                              value={group.referrer}
                              onChange={(v) =>
                                setSourceGroups((prev) =>
                                  prev.map((g, i) => (i === idx ? { ...g, referrer: v } : g))
                                )
                              }
                              placeholder="e.g. instagram.com"
                              autoComplete="off"
                            />
                          </FormLayout.Group>
                          <TemplateTagPicker
                            label="Image Tags"
                            value={group.tags}
                            onChange={(tags) =>
                              setSourceGroups((prev) =>
                                prev.map((g, i) => (i === idx ? { ...g, tags } : g))
                              )
                            }
                            helpText="Tags on images to show for this traffic source"
                            required
                            availableTags={shopTags}
                          />
                          <div>
                            <label
                              style={{
                                display: "block",
                                marginBottom: spacing[1],
                                fontSize: "14px",
                                fontWeight: 500,
                              }}
                            >
                              Behavior
                            </label>
                            <select
                              value={group.behavior}
                              onChange={(e) =>
                                setSourceGroups((prev) =>
                                  prev.map((g, i) =>
                                    i === idx ? { ...g, behavior: e.target.value } : g
                                  )
                                )
                              }
                              style={{
                                width: "100%",
                                padding: spacing[2],
                                border: `1px solid ${colors.neutral[300]}`,
                                borderRadius: borderRadius.md,
                                fontSize: "14px",
                              }}
                            >
                              <option value="prioritize">Prioritize tagged images (show first)</option>
                              <option value="filter">Show only tagged images</option>
                            </select>
                            <p style={{ fontSize: "12px", color: colors.neutral[500], marginTop: spacing[1] }}>
                              Prioritize keeps all images but shows tagged ones first. Filter hides non-tagged images.
                            </p>
                          </div>
                        </FormLayout>
                      </div>
                    </div>
                  ))}
                  <Button
                    onClick={() =>
                      setSourceGroups((prev) => [
                        ...prev,
                        { utm: "", referrer: "", tags: [], behavior: "prioritize" },
                      ])
                    }
                  >
                    + Add another source
                  </Button>
                </BlockStack>
              ) : (
                <>
                  {/* Generic Configuration Options */}
                  {wizardModal.template.configOptions.length > 0 ? (
                    <FormLayout>
                      <Text as="h3" variant="headingSm">
                        Configure your rule
                      </Text>
                      {wizardModal.template.configOptions.map((option) => (
                        <ConfigField
                          key={option.path}
                          option={option}
                          value={wizardConfig[option.path]}
                          onChange={(value) =>
                            setWizardConfig((prev) => ({
                              ...prev,
                              [option.path]: value,
                            }))
                          }
                          availableTags={option.type === "tags" ? shopTags : undefined}
                        />
                      ))}
                    </FormLayout>
                  ) : (
                    <Text as="p" tone="subdued">
                      This template has no required configuration. Click "Create
                      Rule" to create it with default settings, then customize in
                      the editor.
                    </Text>
                  )}
                </>
              )}

              {/* Use Cases */}
              <div>
                <Text as="h3" variant="headingSm">
                  Example use cases
                </Text>
                <ul
                  style={{
                    margin: `${spacing[2]} 0 0 0`,
                    padding: `0 0 0 ${spacing[5]}`,
                    color: colors.neutral[600],
                  }}
                >
                  {wizardModal.template.useCases.map((useCase, i) => (
                    <li key={i} style={{ marginBottom: spacing[1] }}>
                      {useCase}
                    </li>
                  ))}
                </ul>
              </div>
            </BlockStack>
          )}
        </Modal.Section>
      </Modal>
    </Page>
  );
}

// =============================================================================
// HELPER COMPONENTS
// =============================================================================

function TemplateCard({
  template,
  onUse,
}: {
  template: RuleTemplate;
  onUse: () => void;
}) {
  const categoryColors: Record<string, { bg: string; text: string; accent: string }> = {
    variant: { bg: colors.primary[50], text: colors.primary[700], accent: colors.primary[500] },
    mobile: { bg: colors.info.light, text: colors.info.dark, accent: colors.info.main },
    traffic: { bg: colors.success.light, text: colors.success.dark, accent: colors.success.main },
    promotion: { bg: colors.critical.light, text: colors.critical.dark, accent: colors.critical.main },
    customer: { bg: colors.warning.light, text: colors.warning.dark, accent: colors.warning.main },
    inventory: { bg: colors.neutral[100], text: colors.neutral[700], accent: colors.neutral[500] },
    testing: { bg: colors.primary[100], text: colors.primary[800], accent: colors.primary[600] },
    regional: { bg: colors.info.light, text: colors.info.dark, accent: colors.info.main },
  };

  const categoryStyle = categoryColors[template.category] || categoryColors.variant;

  return (
    <div
      style={{
        background: colors.neutral[0],
        border: `1px solid ${colors.neutral[200]}`,
        borderRadius: borderRadius.lg,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        transition: "all 0.2s",
      }}
    >
      {/* Header with accent */}
      <div
        style={{
          padding: spacing[4],
          background: categoryStyle.bg,
          borderBottom: `3px solid ${categoryStyle.accent}`,
        }}
      >
        <span
          style={{
            display: "inline-block",
            padding: `${spacing[1]} ${spacing[2]}`,
            background: categoryStyle.text,
            color: "white",
            borderRadius: borderRadius.sm,
            fontSize: "10px",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {template.category}
        </span>
      </div>

      {/* Content */}
      <div style={{ padding: spacing[5], flex: 1, display: "flex", flexDirection: "column" }}>
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
            margin: `${spacing[2]} 0 ${spacing[4]} 0`,
            lineHeight: 1.5,
            flex: 1,
          }}
        >
          {template.description}
        </p>

        {/* Quick info */}
        <div
          style={{
            display: "flex",
            gap: spacing[3],
            marginBottom: spacing[4],
            flexWrap: "wrap",
          }}
        >
          <InfoChip
            label="Conditions"
            value={String(
              (template.rule.conditions as { conditions: unknown[] }).conditions.length
            )}
          />
          <InfoChip label="Actions" value={String(template.rule.actions.length)} />
          <InfoChip
            label="Priority"
            value={String(template.rule.priority)}
          />
        </div>

        <Button onClick={onUse} fullWidth>
          Use this template
        </Button>
      </div>
    </div>
  );
}

function InfoChip({ label, value }: { label: string; value: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: spacing[1],
        padding: `${spacing[1]} ${spacing[2]}`,
        background: colors.neutral[100],
        borderRadius: borderRadius.sm,
        fontSize: "12px",
        color: colors.neutral[600],
      }}
    >
      <span style={{ fontWeight: 500 }}>{label}:</span>
      <span>{value}</span>
    </span>
  );
}

function ConfigField({
  option,
  value,
  onChange,
  availableTags,
}: {
  option: TemplateConfigOption;
  value: unknown;
  onChange: (value: unknown) => void;
  availableTags?: string[];
}) {
  switch (option.type) {
    case "text":
      return (
        <TextField
          label={option.label}
          value={String(value || "")}
          onChange={onChange}
          placeholder={option.placeholder}
          helpText={option.helpText}
          requiredIndicator={option.required}
          autoComplete="off"
        />
      );

    case "number":
      return (
        <TextField
          label={option.label}
          type="number"
          value={String(value || "")}
          onChange={(v) => onChange(parseInt(v, 10) || 0)}
          placeholder={option.placeholder}
          helpText={option.helpText}
          requiredIndicator={option.required}
          autoComplete="off"
        />
      );

    case "date":
      return (
        <TextField
          label={option.label}
          type="date"
          value={String(value || "")}
          onChange={onChange}
          helpText={option.helpText}
          requiredIndicator={option.required}
          autoComplete="off"
        />
      );

    case "select":
      return (
        <div>
          <label
            style={{
              display: "block",
              marginBottom: spacing[1],
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            {option.label}
            {option.required && <span style={{ color: colors.critical.main }}> *</span>}
          </label>
          <select
            value={String(value || "")}
            onChange={(e) => onChange(e.target.value)}
            style={{
              width: "100%",
              padding: spacing[2],
              border: `1px solid ${colors.neutral[300]}`,
              borderRadius: borderRadius.md,
              fontSize: "14px",
            }}
          >
            {option.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {option.helpText && (
            <p style={{ fontSize: "12px", color: colors.neutral[500], marginTop: spacing[1] }}>
              {option.helpText}
            </p>
          )}
        </div>
      );

    case "tags":
      return (
        <TemplateTagPicker
          label={option.label}
          value={Array.isArray(value) ? (value as string[]) : []}
          onChange={(tags) => onChange(tags)}
          helpText={option.helpText}
          required={option.required}
          availableTags={availableTags || []}
        />
      );

    default:
      return (
        <TextField
          label={option.label}
          value={String(value || "")}
          onChange={onChange}
          autoComplete="off"
        />
      );
  }
}

function TemplateTagPicker({
  label,
  value,
  onChange,
  helpText,
  required,
  availableTags,
}: {
  label: string;
  value: string[];
  onChange: (tags: string[]) => void;
  helpText?: string;
  required?: boolean;
  availableTags: string[];
}) {
  const [customTag, setCustomTag] = useState("");

  const addTag = (tag: string) => {
    const normalized = tag.trim().toLowerCase();
    if (normalized && !value.includes(normalized)) {
      onChange([...value, normalized]);
    }
  };

  const removeTag = (tag: string) => {
    onChange(value.filter((t) => t !== tag));
  };

  const handleAddCustom = () => {
    if (customTag.trim()) {
      addTag(customTag);
      setCustomTag("");
    }
  };

  return (
    <div>
      <label
        style={{
          display: "block",
          marginBottom: spacing[1],
          fontSize: "14px",
          fontWeight: 500,
        }}
      >
        {label}
        {required && <span style={{ color: colors.critical.main }}> *</span>}
      </label>

      {/* Selected tags */}
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[1], marginBottom: spacing[2] }}>
          {value.map((tag) => (
            <button
              key={tag}
              onClick={() => removeTag(tag)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: `${spacing[1]} ${spacing[2]}`,
                background: colors.primary[500],
                color: colors.neutral[0],
                border: "none",
                borderRadius: borderRadius.full,
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {tag} <span style={{ fontSize: "14px", lineHeight: 1 }}>&times;</span>
            </button>
          ))}
        </div>
      )}

      {/* Available tags */}
      {availableTags.length > 0 && (
        <div style={{ marginBottom: spacing[2] }}>
          <p style={{ fontSize: "12px", color: colors.neutral[500], margin: `0 0 ${spacing[1]} 0` }}>
            Available tags:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[1] }}>
            {availableTags.map((tag) => {
              const isSelected = value.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() => isSelected ? removeTag(tag) : addTag(tag)}
                  style={{
                    padding: `${spacing[1]} ${spacing[2]}`,
                    background: isSelected ? colors.primary[100] : colors.neutral[0],
                    color: isSelected ? colors.primary[700] : colors.neutral[700],
                    border: `1px solid ${isSelected ? colors.primary[300] : colors.neutral[300]}`,
                    borderRadius: borderRadius.full,
                    fontSize: "12px",
                    cursor: "pointer",
                    fontWeight: isSelected ? 600 : 400,
                  }}
                >
                  {tag}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Custom tag input */}
      <div style={{ display: "flex", gap: spacing[2], alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <TextField
            label=""
            labelHidden
            value={customTag}
            onChange={setCustomTag}
            placeholder="Add custom tag..."
            autoComplete="off"
          />
        </div>
        <Button onClick={handleAddCustom} disabled={!customTag.trim()}>Add</Button>
      </div>

      {helpText && (
        <p style={{ fontSize: "12px", color: colors.neutral[500], marginTop: spacing[1] }}>
          {helpText}
        </p>
      )}
    </div>
  );
}
