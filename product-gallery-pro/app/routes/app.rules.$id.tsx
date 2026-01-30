/**
 * Rule Editor Page (PGP-F2.0)
 *
 * Visual WHEN/THEN rule builder with:
 * - Condition type selector with inputs
 * - Action type selector with inputs
 * - AND/OR logic toggle
 * - Advanced settings (priority, schedule, scope)
 * - Live preview
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import { useState, useCallback, useEffect } from "react";
import {
  Page,
  Button,
  Card,
  FormLayout,
  TextField,
  Select,
  Checkbox,
  Banner,
  Badge,
  Divider,
  Text,
  BlockStack,
  InlineStack,
  Modal,
  Collapsible,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getShopRule } from "~/lib/rules/storage.server";
// getABTestResults removed (was SQLite-based, no longer needed)
const getABTestResults = async (_shopId: string, _ruleId: string) => [] as any[];
import type { Rule, RuleStatus } from "~/types/rules";
import { validateRule, createEmptyRule } from "~/types/rules";
import type { ConditionGroup, Condition, ConditionType } from "~/types/rules-conditions";
import {
  createConditionGroup,
  createDefaultCondition,
  getConditionTypeLabel,
  getFieldsForConditionType,
  getOperatorsForCondition,
  isConditionGroup,
} from "~/types/rules-conditions";
import type { Action, ActionType } from "~/types/rules-actions";
import {
  createDefaultAction,
  getActionTypeLabel,
  getActionTypeDescription,
} from "~/types/rules-actions";
import { ProductScopePicker } from "~/components/ProductScopePicker";
import { colors, borderRadius, spacing, shadows } from "~/styles/design-system";
import {
  summarizeConditions,
  summarizeActions,
  getCategoryFromRule,
  getCategoryConfig,
} from "~/lib/rules/summary";

// =============================================================================
// LOADER
// =============================================================================

export const loader = async ({ params, request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopId = session.shop;
  const { id } = params;

  if (!id) {
    throw new Response("Rule ID required", { status: 400 });
  }

  console.log("[RuleEditor] Loading rule with id:", id);
  const rule = await getShopRule(admin, id);
  console.log("[RuleEditor] Found rule:", rule ? rule.name : "NOT FOUND");

  if (!rule) {
    console.log("[RuleEditor] Rule not found, redirecting to /app/rules");
    return redirect("/app/rules");
  }

  // Check if rule has ab_test condition
  const hasABTest = rule.conditions?.conditions?.some(
    (c: { type?: string }) => c.type === "ab_test"
  );

  let abTestResults: Array<{ bucket: number; sessionCount: number }> = [];
  if (hasABTest) {
    abTestResults = await getABTestResults(shopId, id).catch(() => []);
  }

  return json({ rule, abTestResults, hasABTest });
};

// =============================================================================
// ACTION
// =============================================================================

export const action = async ({ params, request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const { id } = params;

  // Handle via API
  return json({ success: true });
};

// =============================================================================
// COMPONENT
// =============================================================================

export default function RuleEditorPage() {
  const { rule: initialRule, abTestResults, hasABTest } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [rule, setRule] = useState<Rule>(initialRule);
  const [isDirty, setIsDirty] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [saveSuccess, setSaveSuccess] = useState(false);
  // Default to Advanced mode so rules are always immediately editable
  const [editorMode, setEditorMode] = useState<"simple" | "advanced">("advanced");

  // Track changes
  useEffect(() => {
    setIsDirty(JSON.stringify(rule) !== JSON.stringify(initialRule));
  }, [rule, initialRule]);

  // Handle save
  const handleSave = useCallback(() => {
    const validation = validateRule(rule);
    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors([]);

    fetcher.submit(
      JSON.stringify({ ruleId: rule.id, updates: rule }),
      {
        method: "PUT",
        action: "/api/rules",
        encType: "application/json",
      }
    );

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  }, [rule, fetcher]);

  // Update rule field
  const updateField = useCallback(
    <K extends keyof Rule>(field: K, value: Rule[K]) => {
      setRule((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  // Update conditions
  const updateConditions = useCallback((conditions: ConditionGroup) => {
    setRule((prev) => ({ ...prev, conditions }));
  }, []);

  // Update actions
  const updateActions = useCallback((actions: Action[]) => {
    setRule((prev) => ({ ...prev, actions }));
  }, []);

  return (
    <Page
      backAction={{ content: "Rules", onAction: () => navigate("/app/rules") }}
      title={rule.name}
      titleMetadata={<StatusBadge status={rule.status} />}
      primaryAction={{
        content: "Save",
        onAction: handleSave,
        disabled: !isDirty,
        loading: fetcher.state === "submitting",
      }}
      secondaryActions={[
        {
          content: rule.status === "active" ? "Pause" : "Activate",
          onAction: () =>
            updateField("status", rule.status === "active" ? "paused" : "active"),
        },
      ]}
    >
      <TitleBar title={`Edit: ${rule.name}`} />

      <div style={{ maxWidth: "900px", margin: "0 auto", padding: spacing[6] }}>
        <BlockStack gap="600">
          {/* Errors */}
          {errors.length > 0 && (
            <Banner title="Please fix the following errors" tone="critical">
              <ul>
                {errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </Banner>
          )}

          {/* Success */}
          {saveSuccess && (
            <Banner title="Rule saved successfully" tone="success" />
          )}

          {/* Editor Mode Toggle */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: spacing[2],
            }}
          >
            <span
              style={{
                fontSize: "13px",
                color: colors.neutral[600],
              }}
            >
              Editor mode:
            </span>
            <div
              style={{
                display: "inline-flex",
                borderRadius: borderRadius.md,
                border: `1px solid ${colors.neutral[300]}`,
                overflow: "hidden",
              }}
            >
              <button
                onClick={() => setEditorMode("simple")}
                style={{
                  padding: `${spacing[1]} ${spacing[3]}`,
                  fontSize: "13px",
                  fontWeight: editorMode === "simple" ? 600 : 400,
                  background: editorMode === "simple" ? colors.primary[500] : colors.neutral[0],
                  color: editorMode === "simple" ? colors.neutral[0] : colors.neutral[700],
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                Simple
              </button>
              <button
                onClick={() => setEditorMode("advanced")}
                style={{
                  padding: `${spacing[1]} ${spacing[3]}`,
                  fontSize: "13px",
                  fontWeight: editorMode === "advanced" ? 600 : 400,
                  background: editorMode === "advanced" ? colors.primary[500] : colors.neutral[0],
                  color: editorMode === "advanced" ? colors.neutral[0] : colors.neutral[700],
                  border: "none",
                  borderLeft: `1px solid ${colors.neutral[300]}`,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                Advanced
              </button>
            </div>
          </div>

          {/* Simple Mode View */}
          {editorMode === "simple" && (
            <>
              {/* Basic Info */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Rule Details
                  </Text>
                  <FormLayout>
                    <TextField
                      label="Name"
                      value={rule.name}
                      onChange={(value) => updateField("name", value)}
                      autoComplete="off"
                    />
                    <TextField
                      label="Description"
                      value={rule.description || ""}
                      onChange={(value) => updateField("description", value)}
                      multiline={2}
                      autoComplete="off"
                    />
                  </FormLayout>
                </BlockStack>
              </Card>

              {/* Plain-language conditions */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    When this happens
                  </Text>
                  <div
                    style={{
                      padding: spacing[4],
                      background: colors.neutral[50],
                      borderRadius: borderRadius.md,
                      border: `1px solid ${colors.neutral[200]}`,
                      fontSize: "15px",
                      color: colors.neutral[800],
                      lineHeight: 1.6,
                    }}
                  >
                    {summarizeConditions(rule.conditions)}
                  </div>
                  <div style={{ fontSize: "13px", color: colors.neutral[500] }}>
                    Switch to Advanced mode to edit conditions directly.
                  </div>
                </BlockStack>
              </Card>

              {/* Plain-language actions */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">
                    Do this
                  </Text>
                  <div
                    style={{
                      padding: spacing[4],
                      background: colors.primary[50],
                      borderRadius: borderRadius.md,
                      border: `1px solid ${colors.primary[200]}`,
                      fontSize: "15px",
                      color: colors.neutral[800],
                      lineHeight: 1.6,
                    }}
                  >
                    {summarizeActions(rule.actions)}
                  </div>
                  <div style={{ fontSize: "13px", color: colors.neutral[500] }}>
                    Switch to Advanced mode to edit actions directly.
                  </div>
                </BlockStack>
              </Card>

              {/* Status toggle */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">
                    Status
                  </Text>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: spacing[3],
                    }}
                  >
                    <button
                      onClick={() =>
                        updateField("status", rule.status === "active" ? "paused" : "active")
                      }
                      style={{
                        width: "44px",
                        height: "24px",
                        borderRadius: borderRadius.full,
                        background:
                          rule.status === "active"
                            ? colors.success.main
                            : colors.neutral[400],
                        border: "none",
                        cursor: "pointer",
                        position: "relative",
                        transition: "background 0.2s",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          top: "2px",
                          left: rule.status === "active" ? "22px" : "2px",
                          width: "20px",
                          height: "20px",
                          borderRadius: borderRadius.full,
                          background: colors.neutral[0],
                          transition: "left 0.2s",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        }}
                      />
                    </button>
                    <span style={{ fontSize: "14px", color: colors.neutral[800] }}>
                      {rule.status === "active" ? "Active" : "Paused"}
                    </span>
                  </div>
                </BlockStack>
              </Card>
            </>
          )}

          {/* Advanced Mode: original WHEN/THEN builder */}
          {editorMode === "advanced" && (
            <>

          {/* Basic Info */}
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Rule Details
              </Text>
              <FormLayout>
                <TextField
                  label="Name"
                  value={rule.name}
                  onChange={(value) => updateField("name", value)}
                  autoComplete="off"
                />
                <TextField
                  label="Description"
                  value={rule.description || ""}
                  onChange={(value) => updateField("description", value)}
                  multiline={2}
                  autoComplete="off"
                />
              </FormLayout>
            </BlockStack>
          </Card>

          {/* WHEN Conditions */}
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between">
                <Text as="h2" variant="headingMd">
                  WHEN these conditions are met
                </Text>
                <Select
                  label=""
                  labelHidden
                  options={[
                    { label: "Match ALL (AND)", value: "AND" },
                    { label: "Match ANY (OR)", value: "OR" },
                  ]}
                  value={rule.conditions.operator}
                  onChange={(value) =>
                    updateConditions({
                      ...rule.conditions,
                      operator: value as "AND" | "OR",
                    })
                  }
                />
              </InlineStack>

              <ConditionBuilder
                conditions={rule.conditions}
                onChange={updateConditions}
              />
            </BlockStack>
          </Card>

          {/* THEN Actions */}
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                THEN apply these actions
              </Text>

              <ActionBuilder actions={rule.actions} onChange={updateActions} />
            </BlockStack>
          </Card>

          {/* Product Scope */}
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Product Scope
              </Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Choose which products this rule applies to. By default, it applies to all products.
              </Text>
              <ProductScopePicker
                productScope={rule.productScope}
                onChange={(ps) => updateField("productScope", ps)}
              />
            </BlockStack>
          </Card>

          {/* Advanced Settings */}
          <Card>
            <BlockStack gap="400">
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: spacing[2],
                  padding: 0,
                  width: "100%",
                }}
              >
                <Text as="h2" variant="headingMd">
                  Advanced Settings
                </Text>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  style={{
                    transform: showAdvanced ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.2s",
                  }}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              <Collapsible open={showAdvanced} id="advanced-settings">
                <div style={{ paddingTop: spacing[4] }}>
                  <FormLayout>
                    <FormLayout.Group>
                      <TextField
                        label="Priority"
                        type="number"
                        value={String(rule.priority)}
                        onChange={(value) =>
                          updateField("priority", parseInt(value, 10) || 0)
                        }
                        helpText="Lower numbers are evaluated first (0-1000)"
                        autoComplete="off"
                      />
                      <Select
                        label="Scope"
                        options={[
                          { label: "Shop-wide", value: "shop" },
                          { label: "Collection", value: "collection" },
                          { label: "Product", value: "product" },
                        ]}
                        value={rule.scope}
                        onChange={(value) =>
                          updateField("scope", value as Rule["scope"])
                        }
                        helpText="Where this rule applies"
                      />
                    </FormLayout.Group>

                    <Checkbox
                      label="Stop processing other rules when this matches"
                      checked={rule.stopProcessing}
                      onChange={(checked) =>
                        updateField("stopProcessing", checked)
                      }
                      helpText="If checked, no rules with lower priority will be evaluated"
                    />

                    <Divider />

                    <Text as="h3" variant="headingSm">
                      Schedule
                    </Text>

                    <FormLayout.Group>
                      <TextField
                        label="Start Date"
                        type="date"
                        value={rule.startDate?.split("T")[0] || ""}
                        onChange={(value) =>
                          updateField(
                            "startDate",
                            value ? new Date(value).toISOString() : undefined
                          )
                        }
                        autoComplete="off"
                      />
                      <TextField
                        label="End Date"
                        type="date"
                        value={rule.endDate?.split("T")[0] || ""}
                        onChange={(value) =>
                          updateField(
                            "endDate",
                            value ? new Date(value).toISOString() : undefined
                          )
                        }
                        autoComplete="off"
                      />
                    </FormLayout.Group>
                  </FormLayout>
                </div>
              </Collapsible>
            </BlockStack>
          </Card>

          {/* A/B Test Results */}
          {hasABTest && (
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  A/B Test Results (30d)
                </Text>
                {(abTestResults as Array<{ bucket: number; sessionCount: number }>).length === 0 ? (
                  <Text as="p" tone="subdued">
                    No A/B test data yet. Results will appear after the rule matches visitors.
                  </Text>
                ) : (
                  <div
                    style={{
                      border: `1px solid ${colors.neutral[200]}`,
                      borderRadius: borderRadius.md,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr",
                        padding: `${spacing[3]} ${spacing[4]}`,
                        background: colors.neutral[50],
                        borderBottom: `1px solid ${colors.neutral[200]}`,
                        fontSize: "12px",
                        fontWeight: 600,
                        color: colors.neutral[600],
                        textTransform: "uppercase",
                      }}
                    >
                      <div>Bucket</div>
                      <div>Sessions</div>
                    </div>
                    {(abTestResults as Array<{ bucket: number; sessionCount: number }>).map(
                      (row: { bucket: number; sessionCount: number }) => (
                        <div
                          key={row.bucket}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            padding: `${spacing[3]} ${spacing[4]}`,
                            borderBottom: `1px solid ${colors.neutral[100]}`,
                            fontSize: "13px",
                          }}
                        >
                          <div>{row.bucket}</div>
                          <div style={{ fontWeight: 600 }}>{row.sessionCount}</div>
                        </div>
                      )
                    )}
                  </div>
                )}
              </BlockStack>
            </Card>
          )}

          {/* Metadata */}
          <div
            style={{
              fontSize: "12px",
              color: colors.neutral[500],
              textAlign: "center",
            }}
          >
            Created: {new Date(rule.createdAt).toLocaleDateString()} | Last
            updated: {new Date(rule.updatedAt).toLocaleDateString()}
            {rule.templateId && ` | From template: ${rule.templateId}`}
          </div>
            </>
          )}

        </BlockStack>
      </div>
    </Page>
  );
}

// =============================================================================
// CONDITION BUILDER
// =============================================================================

function ConditionBuilder({
  conditions,
  onChange,
}: {
  conditions: ConditionGroup;
  onChange: (conditions: ConditionGroup) => void;
}) {
  const addCondition = (type: ConditionType) => {
    const newCondition = createDefaultCondition(type);
    onChange({
      ...conditions,
      conditions: [...conditions.conditions, newCondition],
    });
  };

  const updateCondition = (index: number, updated: Condition | ConditionGroup) => {
    const newConditions = [...conditions.conditions];
    newConditions[index] = updated;
    onChange({ ...conditions, conditions: newConditions });
  };

  const removeCondition = (index: number) => {
    onChange({
      ...conditions,
      conditions: conditions.conditions.filter((_, i) => i !== index),
    });
  };

  return (
    <BlockStack gap="400">
      {conditions.conditions.map((condition, index) => (
        <div key={index}>
          {index > 0 && (
            <div
              style={{
                textAlign: "center",
                padding: spacing[2],
                color: colors.neutral[500],
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              {conditions.operator}
            </div>
          )}
          {isConditionGroup(condition) ? (
            <NestedConditionGroup
              group={condition}
              onChange={(updated) => updateCondition(index, updated)}
              onRemove={() => removeCondition(index)}
            />
          ) : (
            <ConditionRow
              condition={condition}
              onChange={(updated) => updateCondition(index, updated)}
              onRemove={() => removeCondition(index)}
            />
          )}
        </div>
      ))}

      <AddConditionButton onAdd={addCondition} />
    </BlockStack>
  );
}

function ConditionRow({
  condition,
  onChange,
  onRemove,
}: {
  condition: Condition;
  onChange: (condition: Condition) => void;
  onRemove: () => void;
}) {
  const conditionTypes: Array<{ value: ConditionType; label: string }> = [
    { value: "variant", label: "Selected Variant" },
    { value: "device", label: "Device" },
    { value: "url", label: "URL / Page" },
    { value: "traffic_source", label: "Traffic Source" },
    { value: "customer", label: "Customer" },
    { value: "time", label: "Date / Time" },
    { value: "geo", label: "Location" },
    { value: "inventory", label: "Inventory" },
    { value: "session", label: "Session" },
    { value: "collection", label: "Collection" },
    { value: "product", label: "Product" },
    { value: "ab_test", label: "A/B Test" },
  ];

  const fields = getFieldsForConditionType(condition.type);
  const operators = getOperatorsForCondition(
    condition.type,
    "field" in condition ? (condition as { field?: string }).field : undefined
  );

  return (
    <div
      style={{
        display: "flex",
        gap: spacing[3],
        alignItems: "flex-start",
        padding: spacing[4],
        background: colors.neutral[50],
        borderRadius: borderRadius.md,
        border: `1px solid ${colors.neutral[200]}`,
      }}
    >
      {/* Condition Type */}
      <div style={{ width: "180px" }}>
        <Select
          label="Type"
          labelHidden
          options={conditionTypes}
          value={condition.type}
          onChange={(value) => {
            const newCondition = createDefaultCondition(value as ConditionType);
            onChange(newCondition);
          }}
        />
      </div>

      {/* Field (if applicable) */}
      {fields.length > 0 && "field" in condition && (
        <div style={{ width: "150px" }}>
          <Select
            label="Field"
            labelHidden
            options={fields.map((f) => {
              // Disable region/city for geo conditions — only country is available client-side
              if (condition.type === "geo" && (f.value === "region" || f.value === "city")) {
                return { ...f, label: `${f.label} (unavailable)`, disabled: true };
              }
              return f;
            })}
            value={(condition as { field: string }).field}
            onChange={(value) => onChange({ ...condition, field: value } as Condition)}
          />
        </div>
      )}

      {/* Operator */}
      {operators.length > 0 && "operator" in condition && (
        <div style={{ width: "150px" }}>
          <Select
            label="Operator"
            labelHidden
            options={operators}
            value={(condition as { operator: string }).operator}
            onChange={(value) => onChange({ ...condition, operator: value } as Condition)}
          />
        </div>
      )}

      {/* Value */}
      {"value" in condition && (condition.type as string) !== "ab_test" && (
        <div style={{ flex: 1 }}>
          <TextField
            label="Value"
            labelHidden
            value={
              Array.isArray((condition as { value: unknown }).value)
                ? (condition as { value: string[] }).value.join(", ")
                : String((condition as { value: unknown }).value || "")
            }
            onChange={(value) => {
              // Parse comma-separated values for list operators
              const parsedValue =
                (condition as { operator?: string }).operator === "in_list" ||
                (condition as { operator?: string }).operator === "not_in_list" ||
                (condition as { operator?: string }).operator === "contains_any" ||
                (condition as { operator?: string }).operator === "contains_all"
                  ? value.split(",").map((v) => v.trim())
                  : value;
              onChange({ ...condition, value: parsedValue } as Condition);
            }}
            placeholder="Enter value..."
            autoComplete="off"
          />
        </div>
      )}

      {/* A/B Test specific fields */}
      {condition.type === "ab_test" && (
        <>
          <div style={{ width: "120px" }}>
            <TextField
              label="Test ID"
              labelHidden
              value={condition.testId}
              onChange={(value) => onChange({ ...condition, testId: value })}
              placeholder="Test ID"
              autoComplete="off"
            />
          </div>
          <div style={{ width: "80px" }}>
            <TextField
              label="Min"
              labelHidden
              type="number"
              value={String(condition.bucketMin)}
              onChange={(value) =>
                onChange({ ...condition, bucketMin: parseInt(value, 10) || 0 })
              }
              autoComplete="off"
            />
          </div>
          <div style={{ width: "80px" }}>
            <TextField
              label="Max"
              labelHidden
              type="number"
              value={String(condition.bucketMax)}
              onChange={(value) =>
                onChange({ ...condition, bucketMax: parseInt(value, 10) || 99 })
              }
              autoComplete="off"
            />
          </div>
        </>
      )}

      {/* Negate checkbox */}
      <div style={{ paddingTop: spacing[2] }}>
        <Checkbox
          label="NOT"
          labelHidden
          checked={condition.negate || false}
          onChange={(checked) => onChange({ ...condition, negate: checked })}
        />
      </div>

      {/* Remove button */}
      <button
        onClick={onRemove}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: spacing[2],
          color: colors.neutral[400],
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

function NestedConditionGroup({
  group,
  onChange,
  onRemove,
}: {
  group: ConditionGroup;
  onChange: (group: ConditionGroup) => void;
  onRemove: () => void;
}) {
  return (
    <div
      style={{
        padding: spacing[4],
        background: colors.neutral[100],
        borderRadius: borderRadius.md,
        border: `1px dashed ${colors.neutral[300]}`,
      }}
    >
      <InlineStack align="space-between">
        <Text as="span" variant="bodySm" fontWeight="semibold">
          Nested Group ({group.operator})
        </Text>
        <button onClick={onRemove} style={{ background: "none", border: "none", cursor: "pointer" }}>
          Remove Group
        </button>
      </InlineStack>
      <div style={{ marginTop: spacing[3] }}>
        <ConditionBuilder conditions={group} onChange={onChange} />
      </div>
    </div>
  );
}

function AddConditionButton({ onAdd }: { onAdd: (type: ConditionType) => void }) {
  const [open, setOpen] = useState(false);

  const conditionTypes: Array<{ value: ConditionType; label: string; description: string }> = [
    { value: "variant", label: "Selected Variant", description: "Match selected variant options" },
    { value: "device", label: "Device", description: "Mobile, tablet, or desktop" },
    { value: "url", label: "URL / Page", description: "Page path, referrer, or parameters" },
    { value: "traffic_source", label: "Traffic Source", description: "UTM parameters and referrer" },
    { value: "customer", label: "Customer", description: "Logged in, tags, order history" },
    { value: "time", label: "Date / Time", description: "Date range, day of week, hour" },
    { value: "geo", label: "Location", description: "Country-level targeting (region/city not available)" },
    { value: "inventory", label: "Inventory", description: "Stock levels and availability" },
    { value: "session", label: "Session", description: "First visit, page views, history" },
    { value: "collection", label: "Collection", description: "Current collection context" },
    { value: "product", label: "Product", description: "Product type, vendor, tags" },
    { value: "ab_test", label: "A/B Test", description: "Traffic bucket for split testing" },
  ];

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Add condition</Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add Condition"
      >
        <Modal.Section>
          <BlockStack gap="200">
            {conditionTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => {
                  onAdd(type.value);
                  setOpen(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: spacing[3],
                  background: colors.neutral[50],
                  border: `1px solid ${colors.neutral[200]}`,
                  borderRadius: borderRadius.md,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: spacing[1] }}>
                  {type.label}
                </div>
                <div style={{ fontSize: "13px", color: colors.neutral[500] }}>
                  {type.description}
                </div>
              </button>
            ))}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </>
  );
}

// =============================================================================
// ACTION BUILDER
// =============================================================================

function ActionBuilder({
  actions,
  onChange,
}: {
  actions: Action[];
  onChange: (actions: Action[]) => void;
}) {
  const addAction = (type: ActionType) => {
    const newAction = createDefaultAction(type);
    onChange([...actions, newAction]);
  };

  const updateAction = (index: number, updated: Action) => {
    const newActions = [...actions];
    newActions[index] = updated;
    onChange(newActions);
  };

  const removeAction = (index: number) => {
    onChange(actions.filter((_, i) => i !== index));
  };

  return (
    <BlockStack gap="400">
      {actions.map((action, index) => (
        <ActionRow
          key={index}
          action={action}
          onChange={(updated) => updateAction(index, updated)}
          onRemove={() => removeAction(index)}
        />
      ))}

      <AddActionButton onAdd={addAction} />
    </BlockStack>
  );
}

function ActionRow({
  action,
  onChange,
  onRemove,
}: {
  action: Action;
  onChange: (action: Action) => void;
  onRemove: () => void;
}) {
  const actionTypes: Array<{ value: ActionType; label: string }> = [
    { value: "filter", label: "Filter Images" },
    { value: "reorder", label: "Reorder Images" },
    { value: "badge", label: "Add Badge" },
    { value: "limit", label: "Limit Count" },
    { value: "prioritize", label: "Prioritize Images" },
    { value: "replace", label: "Replace Gallery" },
  ];

  return (
    <div
      style={{
        padding: spacing[4],
        background: colors.primary[50],
        borderRadius: borderRadius.md,
        border: `1px solid ${colors.primary[200]}`,
      }}
    >
      <InlineStack gap="400" align="start" blockAlign="start">
        {/* Action Type */}
        <div style={{ width: "180px" }}>
          <Select
            label="Action"
            labelHidden
            options={actionTypes}
            value={action.type}
            onChange={(value) => {
              const newAction = createDefaultAction(value as ActionType);
              onChange(newAction);
            }}
          />
        </div>

        {/* Action-specific fields */}
        <div style={{ flex: 1 }}>
          <ActionFields action={action} onChange={onChange} />
        </div>

        {/* Remove button */}
        <button
          onClick={onRemove}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: spacing[2],
            color: colors.neutral[400],
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </InlineStack>
    </div>
  );
}

function ActionFields({
  action,
  onChange,
}: {
  action: Action;
  onChange: (action: Action) => void;
}) {
  switch (action.type) {
    case "filter":
      return (
        <FormLayout>
          <FormLayout.Group>
            <Select
              label="Mode"
              options={[
                { label: "Include matching", value: "include" },
                { label: "Exclude matching", value: "exclude" },
              ]}
              value={action.mode}
              onChange={(value) => onChange({ ...action, mode: value as "include" | "exclude" })}
            />
            <Select
              label="Match by"
              options={[
                { label: "Media tag", value: "media_tag" },
                { label: "Variant value", value: "variant_value" },
                { label: "Media type", value: "media_type" },
                { label: "Alt text", value: "alt_text" },
                { label: "Universal", value: "universal" },
              ]}
              value={action.matchType}
              onChange={(value) => onChange({ ...action, matchType: value as typeof action.matchType })}
            />
          </FormLayout.Group>
          {action.matchType !== "universal" && (
            <TextField
              label="Match values"
              value={action.matchValues.join(", ")}
              onChange={(value) => onChange({ ...action, matchValues: value.split(",").map((v) => v.trim()) })}
              helpText="Comma-separated values"
              autoComplete="off"
            />
          )}
        </FormLayout>
      );

    case "badge":
      return (
        <FormLayout>
          <FormLayout.Group>
            <TextField
              label="Badge text"
              value={action.text}
              onChange={(value) => onChange({ ...action, text: value })}
              placeholder="e.g., SALE, NEW"
              autoComplete="off"
            />
            <Select
              label="Position"
              options={[
                { label: "Top Left", value: "top-left" },
                { label: "Top Right", value: "top-right" },
                { label: "Bottom Left", value: "bottom-left" },
                { label: "Bottom Right", value: "bottom-right" },
                { label: "Center", value: "center" },
              ]}
              value={action.position}
              onChange={(value) => onChange({ ...action, position: value as typeof action.position })}
            />
          </FormLayout.Group>
          <FormLayout.Group>
            <Select
              label="Style"
              options={[
                { label: "Primary", value: "primary" },
                { label: "Success", value: "success" },
                { label: "Warning", value: "warning" },
                { label: "Danger", value: "danger" },
                { label: "Info", value: "info" },
              ]}
              value={action.style}
              onChange={(value) => onChange({ ...action, style: value as typeof action.style })}
            />
            <Select
              label="Apply to"
              options={[
                { label: "First image", value: "first" },
                { label: "All images", value: "all" },
                { label: "Last image", value: "last" },
              ]}
              value={action.target}
              onChange={(value) => onChange({ ...action, target: value as typeof action.target })}
            />
          </FormLayout.Group>
        </FormLayout>
      );

    case "limit":
      return (
        <FormLayout>
          <FormLayout.Group>
            <TextField
              label="Maximum images"
              type="number"
              value={String(action.maxImages)}
              onChange={(value) => onChange({ ...action, maxImages: parseInt(value, 10) || 1 })}
              autoComplete="off"
            />
            <Select
              label="Keep"
              options={[
                { label: "First images", value: "first" },
                { label: "Last images", value: "last" },
                { label: "Even distribution", value: "even_distribution" },
              ]}
              value={action.keep}
              onChange={(value) => onChange({ ...action, keep: value as typeof action.keep })}
            />
          </FormLayout.Group>
          <Checkbox
            label="Always include first image"
            checked={action.alwaysIncludeFirst}
            onChange={(checked) => onChange({ ...action, alwaysIncludeFirst: checked })}
          />
        </FormLayout>
      );

    case "reorder":
      return (
        <FormLayout>
          <Select
            label="Strategy"
            options={[
              { label: "Move to front", value: "move_to_front" },
              { label: "Move to back", value: "move_to_back" },
              { label: "Shuffle", value: "shuffle" },
              { label: "Reverse", value: "reverse" },
            ]}
            value={action.strategy}
            onChange={(value) => onChange({ ...action, strategy: value as typeof action.strategy })}
          />
          {(action.strategy === "move_to_front" || action.strategy === "move_to_back") && (
            <>
              <Select
                label="Match by"
                options={[
                  { label: "Media tag", value: "media_tag" },
                  { label: "Media type", value: "media_type" },
                  { label: "Alt text", value: "alt_text" },
                ]}
                value={action.matchType || "media_tag"}
                onChange={(value) => onChange({ ...action, matchType: value as typeof action.matchType })}
              />
              <TextField
                label="Match values"
                value={(action.matchValues || []).join(", ")}
                onChange={(value) => onChange({ ...action, matchValues: value.split(",").map((v) => v.trim()) })}
                helpText="Comma-separated values"
                autoComplete="off"
              />
            </>
          )}
        </FormLayout>
      );

    case "prioritize":
      return (
        <FormLayout>
          <Select
            label="Strategy"
            options={[
              { label: "Boost to front", value: "boost_to_front" },
              { label: "Boost positions", value: "boost_positions" },
              { label: "Interleave", value: "interleave" },
            ]}
            value={action.strategy}
            onChange={(value) => onChange({ ...action, strategy: value as typeof action.strategy })}
          />
          <Select
            label="Match by"
            options={[
              { label: "Media tag", value: "media_tag" },
              { label: "Variant value", value: "variant_value" },
              { label: "Media type", value: "media_type" },
            ]}
            value={action.matchType}
            onChange={(value) => onChange({ ...action, matchType: value as typeof action.matchType })}
          />
          <TextField
            label="Match values"
            value={action.matchValues.join(", ")}
            onChange={(value) => onChange({ ...action, matchValues: value.split(",").map((v) => v.trim()) })}
            helpText="Comma-separated values"
            autoComplete="off"
          />
        </FormLayout>
      );

    default:
      return <Text as="p">Configure action options...</Text>;
  }
}

function AddActionButton({ onAdd }: { onAdd: (type: ActionType) => void }) {
  const [open, setOpen] = useState(false);

  const actionTypes: Array<{ value: ActionType; label: string; description: string }> = [
    { value: "filter", label: "Filter Images", description: "Show or hide specific images" },
    { value: "reorder", label: "Reorder Images", description: "Change the order of images" },
    { value: "badge", label: "Add Badge", description: "Add visual overlays like SALE" },
    { value: "limit", label: "Limit Count", description: "Reduce total images shown" },
    { value: "prioritize", label: "Prioritize Images", description: "Boost certain images to front" },
    { value: "replace", label: "Replace Gallery", description: "Swap with different images" },
  ];

  return (
    <>
      <Button onClick={() => setOpen(true)}>+ Add action</Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add Action"
      >
        <Modal.Section>
          <BlockStack gap="200">
            {actionTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => {
                  onAdd(type.value);
                  setOpen(false);
                }}
                style={{
                  display: "block",
                  width: "100%",
                  padding: spacing[3],
                  background: colors.primary[50],
                  border: `1px solid ${colors.primary[200]}`,
                  borderRadius: borderRadius.md,
                  textAlign: "left",
                  cursor: "pointer",
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: spacing[1] }}>
                  {type.label}
                </div>
                <div style={{ fontSize: "13px", color: colors.neutral[500] }}>
                  {type.description}
                </div>
              </button>
            ))}
          </BlockStack>
        </Modal.Section>
      </Modal>
    </>
  );
}

// =============================================================================
// HELPERS
// =============================================================================

function StatusBadge({ status }: { status: RuleStatus }) {
  const statusConfig: Record<
    RuleStatus,
    { tone: "success" | "attention" | "info" | "warning"; label: string }
  > = {
    active: { tone: "success", label: "Active" },
    paused: { tone: "attention", label: "Paused" },
    draft: { tone: "info", label: "Draft" },
    scheduled: { tone: "warning", label: "Scheduled" },
  };
  const config = statusConfig[status];
  return <Badge tone={config.tone}>{config.label}</Badge>;
}
