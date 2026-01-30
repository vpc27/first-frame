/**
 * RuleWizard Component (PGP-F2.0 UX Overhaul)
 *
 * Multi-step modal for guided rule creation.
 * Steps: Configure -> Select Images (optional) -> Review & Activate
 */

import { useState, useCallback, useMemo } from "react";
import {
  Modal,
  Button,
  TextField,
  Select,
  Text,
  BlockStack,
  InlineStack,
  Banner,
  FormLayout,
} from "@shopify/polaris";
import {
  getTemplateById,
  createRuleFromTemplate,
  getNestedValue,
  type RuleTemplate,
  type TemplateConfigOption,
} from "~/lib/rules/templates";
import {
  ImageSelectorStep,
  extractMatchDataFromImages,
  type ImageItem,
} from "~/components/rules/ImageSelectorStep";
import { summarizeConditions, summarizeActions } from "~/lib/rules/summary";
import type { Rule, ProductScope } from "~/types/rules";
import { ProductScopePicker } from "~/components/ProductScopePicker";
import { colors, borderRadius, spacing } from "~/styles/design-system";

// =============================================================================
// TYPES
// =============================================================================

interface SourceGroup {
  utm: string;
  referrer: string;
  tags: string[];
  behavior: string;
}

interface RuleWizardProps {
  open: boolean;
  templateId: string | null;
  onClose: () => void;
  onCreateRule: (rule: Rule) => void;
  /** For multi-source templates, create multiple rules at once */
  onCreateMultipleRules?: (rules: Rule[]) => void;
  /** Optional: product images for the image selector step */
  productImages?: ImageItem[];
  loadingImages?: boolean;
  /** Optional: available shop image tags for autocomplete */
  availableTags?: string[];
}

type WizardStep = "configure" | "images" | "review";

// =============================================================================
// STEP LOGIC PER CATEGORY
// =============================================================================

const CATEGORIES_WITH_IMAGE_STEP = new Set([
  "traffic",
  "customer",
  "testing",
  "regional",
]);

function needsImageStep(template: RuleTemplate): boolean {
  return CATEGORIES_WITH_IMAGE_STEP.has(template.category);
}

// =============================================================================
// COMPONENT
// =============================================================================

export function RuleWizard({
  open,
  templateId,
  onClose,
  onCreateRule,
  onCreateMultipleRules,
  productImages = [],
  loadingImages = false,
  availableTags = [],
}: RuleWizardProps) {
  const template = templateId ? getTemplateById(templateId) : null;
  const [step, setStep] = useState<WizardStep>("configure");
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [ruleName, setRuleName] = useState("");
  const [selectedImageIds, setSelectedImageIds] = useState<string[]>([]);
  const [activateOnCreate, setActivateOnCreate] = useState(true);
  const [productScope, setProductScope] = useState<ProductScope | undefined>(undefined);
  const isMultiSource = template?.id === "traffic-source-gallery";
  const [sourceGroups, setSourceGroups] = useState<SourceGroup[]>([
    { utm: "instagram", referrer: "instagram.com", tags: ["lifestyle", "ugc", "social"], behavior: "prioritize" },
  ]);

  // Reset state when template changes
  const resetWizard = useCallback(() => {
    setStep("configure");
    setConfig({});
    setRuleName("");
    setSelectedImageIds([]);
    setActivateOnCreate(true);
    setProductScope(undefined);
    setSourceGroups([
      { utm: "instagram", referrer: "instagram.com", tags: ["lifestyle", "ugc", "social"], behavior: "prioritize" },
    ]);
  }, []);

  // Steps for this template
  const steps = useMemo((): WizardStep[] => {
    if (!template) return ["configure", "review"];
    const s: WizardStep[] = ["configure"];
    if (needsImageStep(template) && productImages.length > 0) {
      s.push("images");
    }
    s.push("review");
    return s;
  }, [template, productImages.length]);

  const currentStepIndex = steps.indexOf(step);
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === steps.length - 1;

  const goNext = useCallback(() => {
    if (!isLastStep) setStep(steps[currentStepIndex + 1]);
  }, [currentStepIndex, isLastStep, steps]);

  const goBack = useCallback(() => {
    if (!isFirstStep) setStep(steps[currentStepIndex - 1]);
  }, [currentStepIndex, isFirstStep, steps]);

  // Build the final rule
  const buildRule = useCallback((): Rule | null => {
    if (!template) return null;

    // Apply config options
    const finalConfig = { ...config };

    // Set defaults for unfilled options
    for (const option of template.configOptions) {
      if (finalConfig[option.path] === undefined && option.defaultValue !== undefined) {
        finalConfig[option.path] = option.defaultValue;
      }
    }

    const rule = createRuleFromTemplate(template.id, finalConfig);

    // Apply custom name
    if (ruleName.trim()) {
      rule.name = ruleName.trim();
    }

    // Apply image selection data
    if (selectedImageIds.length > 0 && productImages.length > 0) {
      const matchData = extractMatchDataFromImages(productImages, selectedImageIds);
      // Apply to first action that has matchType/matchValues
      for (const action of rule.actions) {
        if ("matchValues" in action && "matchType" in action) {
          (action as { matchType: string; matchValues: string[] }).matchType = matchData.matchType;
          (action as { matchType: string; matchValues: string[] }).matchValues = matchData.matchValues;
          break;
        }
      }
    }

    // Set status
    rule.status = activateOnCreate ? "active" : "draft";

    // Apply product scope
    if (productScope) {
      rule.productScope = productScope;
    }

    return rule;
  }, [template, config, ruleName, selectedImageIds, productImages, activateOnCreate, productScope]);

  // Preview the built rule for the review step
  const previewRule = useMemo(() => buildRule(), [buildRule]);

  const handleCreate = useCallback(() => {
    if (isMultiSource) {
      // Create one rule per source group
      const rules: Rule[] = [];
      for (const group of sourceGroups) {
        if (!group.utm.trim()) continue;
        const groupConfig: Record<string, unknown> = {
          "conditions.conditions[0].value": group.utm,
          "conditions.conditions[1].value": group.referrer || group.utm + ".com",
          "actions[0].matchValues": group.tags,
          "actions[0].type": group.behavior || "prioritize",
        };
        const rule = createRuleFromTemplate("traffic-source-gallery", groupConfig);
        rule.name = ruleName.trim()
          ? `${ruleName.trim()} (${group.utm})`
          : `Traffic Source: ${group.utm}`;
        rule.status = activateOnCreate ? "active" : "draft";
        if (productScope) {
          rule.productScope = productScope;
        }
        rules.push(rule);
      }
      if (rules.length > 0) {
        if (onCreateMultipleRules) {
          onCreateMultipleRules(rules);
        } else {
          // Fallback: create them one by one
          rules.forEach((r) => onCreateRule(r));
        }
        resetWizard();
      }
      return;
    }

    const rule = buildRule();
    if (rule) {
      onCreateRule(rule);
      resetWizard();
    }
  }, [buildRule, onCreateRule, onCreateMultipleRules, resetWizard, isMultiSource, sourceGroups, ruleName, activateOnCreate]);

  if (!template) return null;

  // Step indicators
  const stepLabels: Record<WizardStep, string> = {
    configure: "Configure",
    images: "Select Images",
    review: "Review & Activate",
  };

  return (
    <Modal
      open={open}
      onClose={() => { onClose(); resetWizard(); }}
      title={template.name}
      large
      primaryAction={
        isLastStep
          ? {
              content: isMultiSource && sourceGroups.length > 1
                ? `Create ${sourceGroups.length} Rules`
                : "Create Rule",
              onAction: handleCreate,
            }
          : { content: "Next", onAction: goNext }
      }
      secondaryActions={
        isFirstStep
          ? [{ content: "Cancel", onAction: () => { onClose(); resetWizard(); } }]
          : [{ content: "Back", onAction: goBack }]
      }
    >
      <Modal.Section>
        <BlockStack gap="500">
          {/* Step indicator */}
          <div style={{ display: "flex", gap: spacing[2], alignItems: "center" }}>
            {steps.map((s, i) => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: spacing[2] }}>
                {i > 0 && (
                  <div
                    style={{
                      width: "24px",
                      height: "2px",
                      background: i <= currentStepIndex ? colors.primary[500] : colors.neutral[300],
                    }}
                  />
                )}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: spacing[1],
                  }}
                >
                  <div
                    style={{
                      width: "24px",
                      height: "24px",
                      borderRadius: borderRadius.full,
                      background: i <= currentStepIndex ? colors.primary[500] : colors.neutral[200],
                      color: i <= currentStepIndex ? colors.neutral[0] : colors.neutral[600],
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    {i + 1}
                  </div>
                  <span
                    style={{
                      fontSize: "13px",
                      fontWeight: i === currentStepIndex ? 600 : 400,
                      color: i === currentStepIndex ? colors.neutral[900] : colors.neutral[500],
                    }}
                  >
                    {stepLabels[s]}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Step content */}
          {step === "configure" && (
            isMultiSource ? (
              <MultiSourceConfigureStep
                ruleName={ruleName}
                onRuleNameChange={setRuleName}
                sourceGroups={sourceGroups}
                onSourceGroupsChange={setSourceGroups}
                availableTags={availableTags}
                templateDetails={template.details}
              />
            ) : (
              <ConfigureStep
                template={template}
                config={config}
                onConfigChange={setConfig}
                ruleName={ruleName}
                onRuleNameChange={setRuleName}
                availableTags={availableTags}
              />
            )
          )}

          {step === "images" && (
            <ImageSelectorStep
              images={productImages}
              selectedImageIds={selectedImageIds}
              onSelectionChange={setSelectedImageIds}
              loading={loadingImages}
            />
          )}

          {step === "review" && previewRule && (
            <ReviewStep
              rule={previewRule}
              activateOnCreate={activateOnCreate}
              onActivateChange={setActivateOnCreate}
              productScope={productScope}
              onProductScopeChange={setProductScope}
            />
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}

// =============================================================================
// MULTI-SOURCE CONFIGURE STEP
// =============================================================================

function MultiSourceConfigureStep({
  ruleName,
  onRuleNameChange,
  sourceGroups,
  onSourceGroupsChange,
  availableTags = [],
  templateDetails,
}: {
  ruleName: string;
  onRuleNameChange: (name: string) => void;
  sourceGroups: SourceGroup[];
  onSourceGroupsChange: (groups: SourceGroup[]) => void;
  availableTags?: string[];
  templateDetails: string;
}) {
  const updateGroup = (idx: number, partial: Partial<SourceGroup>) => {
    onSourceGroupsChange(
      sourceGroups.map((g, i) => (i === idx ? { ...g, ...partial } : g))
    );
  };

  const removeGroup = (idx: number) => {
    onSourceGroupsChange(sourceGroups.filter((_, i) => i !== idx));
  };

  const addGroup = () => {
    onSourceGroupsChange([
      ...sourceGroups,
      { utm: "", referrer: "", tags: [], behavior: "prioritize" },
    ]);
  };

  return (
    <BlockStack gap="400">
      <Text as="p" tone="subdued">
        {templateDetails}
      </Text>

      <TextField
        label="Rule Name Prefix (optional)"
        value={ruleName}
        onChange={onRuleNameChange}
        placeholder="Traffic Source Gallery"
        autoComplete="off"
        helpText="Each source will get its own rule. Leave blank for auto-naming."
      />

      {sourceGroups.map((group, idx) => (
        <div
          key={idx}
          style={{
            padding: spacing[4],
            background: colors.neutral[50],
            borderRadius: borderRadius.lg,
            border: `1px solid ${colors.neutral[200]}`,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: spacing[3] }}>
            <Text as="h3" variant="headingSm">
              Source {idx + 1}
            </Text>
            {sourceGroups.length > 1 && (
              <Button tone="critical" variant="plain" onClick={() => removeGroup(idx)}>
                Remove
              </Button>
            )}
          </div>
          <FormLayout>
            <FormLayout.Group>
              <TextField
                label="UTM Source"
                value={group.utm}
                onChange={(v) => updateGroup(idx, { utm: v })}
                placeholder="e.g. instagram, facebook, google"
                autoComplete="off"
                requiredIndicator
              />
              <TextField
                label="Referrer Domain"
                value={group.referrer}
                onChange={(v) => updateGroup(idx, { referrer: v })}
                placeholder="e.g. instagram.com"
                autoComplete="off"
                helpText="Also match visitors from this referrer"
              />
            </FormLayout.Group>
            <TagPickerField
              label="Image Tags"
              value={group.tags}
              onChange={(tags) => updateGroup(idx, { tags })}
              helpText="Tags on images to show for this traffic source"
              required
              availableTags={availableTags}
            />
            <Select
              label="Behavior"
              options={[
                { label: "Prioritize tagged images (show first)", value: "prioritize" },
                { label: "Show only tagged images", value: "filter" },
              ]}
              value={group.behavior}
              onChange={(v) => updateGroup(idx, { behavior: v })}
              helpText="Prioritize keeps all images but shows tagged ones first. Filter hides non-tagged images."
            />
          </FormLayout>
        </div>
      ))}

      <Button onClick={addGroup}>+ Add another source</Button>
    </BlockStack>
  );
}

// =============================================================================
// CONFIGURE STEP
// =============================================================================

function ConfigureStep({
  template,
  config,
  onConfigChange,
  ruleName,
  onRuleNameChange,
  availableTags = [],
}: {
  template: RuleTemplate;
  config: Record<string, unknown>;
  onConfigChange: (config: Record<string, unknown>) => void;
  ruleName: string;
  onRuleNameChange: (name: string) => void;
  availableTags?: string[];
}) {
  const updateConfig = (path: string, value: unknown) => {
    onConfigChange({ ...config, [path]: value });
  };

  return (
    <BlockStack gap="400">
      <Text as="p" tone="subdued">
        {template.details}
      </Text>

      <TextField
        label="Rule Name (optional)"
        value={ruleName}
        onChange={onRuleNameChange}
        placeholder={template.name}
        autoComplete="off"
        helpText="Leave blank to use the template name"
      />

      {template.configOptions.map((option) => (
        <ConfigField
          key={option.path}
          option={option}
          value={config[option.path]}
          onChange={(value) => updateConfig(option.path, value)}
          availableTags={option.type === "tags" ? availableTags : undefined}
        />
      ))}
    </BlockStack>
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
  const currentValue = value ?? option.defaultValue;

  switch (option.type) {
    case "text":
      return (
        <TextField
          label={option.label}
          value={String(currentValue || "")}
          onChange={onChange}
          placeholder={option.placeholder}
          helpText={option.helpText}
          autoComplete="off"
          requiredIndicator={option.required}
        />
      );
    case "number":
      return (
        <TextField
          label={option.label}
          type="number"
          value={String(currentValue || "")}
          onChange={(val) => onChange(parseInt(val, 10) || 0)}
          placeholder={option.placeholder}
          helpText={option.helpText}
          autoComplete="off"
          requiredIndicator={option.required}
        />
      );
    case "date":
      return (
        <TextField
          label={option.label}
          type="date"
          value={String(currentValue || "")}
          onChange={onChange}
          helpText={option.helpText}
          autoComplete="off"
          requiredIndicator={option.required}
        />
      );
    case "select":
      return (
        <Select
          label={option.label}
          options={option.options || []}
          value={String(currentValue || "")}
          onChange={onChange}
          helpText={option.helpText}
          requiredIndicator={option.required}
        />
      );
    case "tags":
      return (
        <TagPickerField
          label={option.label}
          value={Array.isArray(currentValue) ? (currentValue as string[]) : []}
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
          value={String(currentValue || "")}
          onChange={onChange}
          autoComplete="off"
        />
      );
  }
}

function TagPickerField({
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
    <BlockStack gap="200">
      <Text as="span" variant="bodyMd" fontWeight="medium">
        {label}{required && <span style={{ color: colors.critical.main }}> *</span>}
      </Text>

      {/* Selected tags */}
      {value.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[1] }}>
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
        <div>
          <Text as="span" variant="bodySm" tone="subdued">Available tags:</Text>
          <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[1], marginTop: spacing[1] }}>
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
      <InlineStack gap="200" blockAlign="end">
        <div style={{ flex: 1 }} onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); handleAddCustom(); }
        }}>
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
      </InlineStack>

      {helpText && (
        <Text as="span" variant="bodySm" tone="subdued">{helpText}</Text>
      )}
    </BlockStack>
  );
}

// =============================================================================
// REVIEW STEP
// =============================================================================

function ReviewStep({
  rule,
  activateOnCreate,
  onActivateChange,
  productScope,
  onProductScopeChange,
}: {
  rule: Rule;
  activateOnCreate: boolean;
  onActivateChange: (value: boolean) => void;
  productScope: ProductScope | undefined;
  onProductScopeChange: (scope: ProductScope | undefined) => void;
}) {
  const conditionText = summarizeConditions(rule.conditions);
  const actionText = summarizeActions(rule.actions);

  return (
    <BlockStack gap="400">
      <Banner tone="info">
        Review your rule before creating it.
      </Banner>

      {/* Summary card */}
      <div
        style={{
          padding: spacing[4],
          background: colors.neutral[50],
          borderRadius: borderRadius.lg,
          border: `1px solid ${colors.neutral[200]}`,
        }}
      >
        <BlockStack gap="300">
          <div>
            <div
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: colors.neutral[500],
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginBottom: spacing[1],
              }}
            >
              Rule Name
            </div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: colors.neutral[900] }}>
              {rule.name}
            </div>
          </div>

          {rule.description && (
            <div>
              <div
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: colors.neutral[500],
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: spacing[1],
                }}
              >
                Description
              </div>
              <div style={{ fontSize: "14px", color: colors.neutral[700] }}>
                {rule.description}
              </div>
            </div>
          )}

          <div
            style={{
              borderTop: `1px solid ${colors.neutral[200]}`,
              paddingTop: spacing[3],
            }}
          >
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
              When
            </div>
            <div
              style={{
                fontSize: "14px",
                color: colors.neutral[800],
                padding: spacing[2],
                background: colors.neutral[0],
                borderRadius: borderRadius.md,
                border: `1px solid ${colors.neutral[200]}`,
              }}
            >
              {conditionText}
            </div>
          </div>

          <div>
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
              Then
            </div>
            <div
              style={{
                fontSize: "14px",
                color: colors.neutral[800],
                padding: spacing[2],
                background: colors.primary[50],
                borderRadius: borderRadius.md,
                border: `1px solid ${colors.primary[200]}`,
              }}
            >
              {actionText}
            </div>
          </div>
        </BlockStack>
      </div>

      {/* Product Scope */}
      <div
        style={{
          padding: spacing[4],
          background: colors.neutral[50],
          borderRadius: borderRadius.lg,
          border: `1px solid ${colors.neutral[200]}`,
        }}
      >
        <BlockStack gap="300">
          <Text as="h3" variant="headingSm">
            Product Scope
          </Text>
          <Text as="p" variant="bodySm" tone="subdued">
            Optionally limit which products this rule applies to.
          </Text>
          <ProductScopePicker
            productScope={productScope}
            onChange={onProductScopeChange}
          />
        </BlockStack>
      </div>

      {/* Activate toggle */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: spacing[3],
          padding: spacing[3],
          background: activateOnCreate ? colors.success.light : colors.neutral[100],
          borderRadius: borderRadius.md,
          border: `1px solid ${activateOnCreate ? colors.success.main : colors.neutral[300]}`,
        }}
      >
        <button
          onClick={() => onActivateChange(!activateOnCreate)}
          style={{
            width: "44px",
            height: "24px",
            borderRadius: borderRadius.full,
            background: activateOnCreate ? colors.success.main : colors.neutral[400],
            border: "none",
            cursor: "pointer",
            position: "relative",
            transition: "background 0.2s",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "2px",
              left: activateOnCreate ? "22px" : "2px",
              width: "20px",
              height: "20px",
              borderRadius: borderRadius.full,
              background: colors.neutral[0],
              transition: "left 0.2s",
              boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
            }}
          />
        </button>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: colors.neutral[900] }}>
            {activateOnCreate ? "Activate immediately" : "Save as draft"}
          </div>
          <div style={{ fontSize: "13px", color: colors.neutral[600] }}>
            {activateOnCreate
              ? "Rule will start applying to your gallery right away"
              : "Rule will be saved but won't apply until you activate it"}
          </div>
        </div>
      </div>
    </BlockStack>
  );
}
