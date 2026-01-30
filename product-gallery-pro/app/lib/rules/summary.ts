/**
 * Plain-language rule summarizer (PGP-F2.0 UX Overhaul)
 *
 * Converts technical WHEN/THEN rules into merchant-friendly text.
 */

import type { Rule } from "~/types/rules";
import type { Condition, ConditionGroup } from "~/types/rules-conditions";
import { isConditionGroup } from "~/types/rules-conditions";
import type { Action } from "~/types/rules-actions";
import type { TemplateCategory } from "~/lib/rules/templates";

// =============================================================================
// TYPES
// =============================================================================

export interface RuleSummary {
  title: string;
  description: string;
  icon: string;
  category: RuleCategory;
  categoryColor: string;
  conditionSummary: string;
  actionSummary: string;
}

export type RuleCategory =
  | "variant"
  | "traffic"
  | "mobile"
  | "customer"
  | "promotion"
  | "inventory"
  | "testing"
  | "regional"
  | "time"
  | "general";

interface CategoryConfig {
  icon: string;
  color: string;
  label: string;
}

const CATEGORY_CONFIG: Record<RuleCategory, CategoryConfig> = {
  variant: { icon: "ColorSwatchIcon", color: "primary", label: "Variant" },
  traffic: { icon: "CameraIcon", color: "info", label: "Traffic" },
  mobile: { icon: "DeviceMobileIcon", color: "success", label: "Mobile" },
  customer: { icon: "StarIcon", color: "warning", label: "Customer" },
  promotion: { icon: "TagIcon", color: "critical", label: "Promotion" },
  inventory: { icon: "ExclamationCircleIcon", color: "warning", label: "Inventory" },
  testing: { icon: "BeakerIcon", color: "info", label: "Testing" },
  regional: { icon: "GlobeIcon", color: "success", label: "Regional" },
  time: { icon: "ClockIcon", color: "neutral", label: "Time" },
  general: { icon: "SettingsIcon", color: "neutral", label: "General" },
};

// =============================================================================
// MAIN FUNCTION
// =============================================================================

export function generateRuleSummary(rule: Rule): RuleSummary {
  const category = getCategoryFromRule(rule);
  const config = CATEGORY_CONFIG[category];
  const conditionSummary = summarizeConditions(rule.conditions);
  const actionSummary = summarizeActions(rule.actions);

  return {
    title: rule.name,
    description: rule.description || buildAutoDescription(conditionSummary, actionSummary),
    icon: config.icon,
    category,
    categoryColor: config.color,
    conditionSummary,
    actionSummary,
  };
}

export function getCategoryLabel(category: RuleCategory): string {
  return CATEGORY_CONFIG[category]?.label || "General";
}

export function getCategoryConfig(category: RuleCategory): CategoryConfig {
  return CATEGORY_CONFIG[category] || CATEGORY_CONFIG.general;
}

// =============================================================================
// CATEGORY DETECTION
// =============================================================================

export function getCategoryFromRule(rule: Rule): RuleCategory {
  // Check templateId first
  if (rule.templateId) {
    const templateCategoryMap: Record<string, RuleCategory> = {
      "variant-filtering": "variant",
      "mobile-optimization": "mobile",
      "instagram-traffic": "traffic",
      "sale-badge": "promotion",
      "vip-customer": "customer",
      "low-stock-alert": "inventory",
      "ab-test-hero": "testing",
      "regional-images": "regional",
    };
    if (templateCategoryMap[rule.templateId]) {
      return templateCategoryMap[rule.templateId];
    }
  }

  // Infer from conditions
  const conditionTypes = extractConditionTypes(rule.conditions);

  if (conditionTypes.has("variant")) return "variant";
  if (conditionTypes.has("ab_test")) return "testing";
  if (conditionTypes.has("device")) return "mobile";
  if (conditionTypes.has("traffic_source") || conditionTypes.has("url")) return "traffic";
  if (conditionTypes.has("customer")) return "customer";
  if (conditionTypes.has("geo")) return "regional";
  if (conditionTypes.has("inventory")) return "inventory";
  if (conditionTypes.has("time")) return "time";

  // Infer from actions
  const actionTypes = new Set(rule.actions.map((a) => a.type));
  if (actionTypes.has("badge")) return "promotion";

  return "general";
}

function extractConditionTypes(group: ConditionGroup): Set<string> {
  const types = new Set<string>();
  for (const item of group.conditions) {
    if (isConditionGroup(item)) {
      for (const t of extractConditionTypes(item)) {
        types.add(t);
      }
    } else {
      types.add(item.type);
    }
  }
  return types;
}

// =============================================================================
// CONDITION SUMMARIZER
// =============================================================================

export function summarizeConditions(conditions: ConditionGroup): string {
  if (conditions.conditions.length === 0) {
    return "Always (no conditions)";
  }

  const parts = conditions.conditions.map((item) => {
    if (isConditionGroup(item)) {
      return `(${summarizeConditions(item)})`;
    }
    return summarizeCondition(item);
  });

  const joiner = conditions.operator === "AND" ? " and " : " or ";
  return parts.join(joiner);
}

function summarizeCondition(condition: Condition): string {
  const negatePrefix = condition.negate ? "NOT " : "";

  switch (condition.type) {
    case "variant": {
      const option = condition.optionName || "any option";
      const val = formatValue(condition.value);
      return `${negatePrefix}${option} is ${val}`;
    }
    case "device": {
      if (condition.field === "type") {
        const val = formatValue(condition.value);
        return `${negatePrefix}visitor is on ${val}`;
      }
      if (condition.field === "screen_width") {
        return `${negatePrefix}screen width ${formatOperator(condition.operator as string)} ${condition.value}px`;
      }
      return `${negatePrefix}device ${condition.field} ${formatOperator(condition.operator as string)} ${formatValue(condition.value)}`;
    }
    case "url": {
      const fieldLabels: Record<string, string> = {
        path: "page path",
        referrer: "referrer",
        param: "URL parameter",
        full_url: "URL",
        host: "host",
      };
      const field = fieldLabels[condition.field] || condition.field;
      return `${negatePrefix}${field} ${formatOperator(condition.operator)} ${formatValue(condition.value)}`;
    }
    case "traffic_source": {
      const fieldLabels: Record<string, string> = {
        utm_source: "traffic source",
        utm_medium: "traffic medium",
        utm_campaign: "campaign",
        utm_content: "content",
        utm_term: "term",
        referrer: "referrer",
      };
      const field = fieldLabels[condition.field] || condition.field;
      return `${negatePrefix}${field} is ${formatValue(condition.value)}`;
    }
    case "customer": {
      if (condition.field === "is_logged_in") {
        return condition.operator === "is_true"
          ? `${negatePrefix}customer is logged in`
          : `${negatePrefix}customer is not logged in`;
      }
      if (condition.field === "tags") {
        return `${negatePrefix}customer has tag ${formatValue(condition.value)}`;
      }
      if (condition.field === "order_count") {
        return `${negatePrefix}order count ${formatOperator(condition.operator as string)} ${condition.value}`;
      }
      if (condition.field === "total_spent") {
        return `${negatePrefix}total spent ${formatOperator(condition.operator as string)} $${condition.value}`;
      }
      return `${negatePrefix}customer ${condition.field} ${formatOperator(condition.operator as string)} ${formatValue(condition.value)}`;
    }
    case "time": {
      if (condition.field === "date" && condition.operator === "between") {
        return `${negatePrefix}date is between ${condition.value} and ${(condition as { valueEnd?: string }).valueEnd || ""}`;
      }
      if (condition.field === "day_of_week") {
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const val = Array.isArray(condition.value)
          ? condition.value.map((d) => days[d as number] || d).join(", ")
          : days[condition.value as number] || condition.value;
        return `${negatePrefix}day is ${val}`;
      }
      if (condition.field === "hour") {
        return `${negatePrefix}hour ${formatOperator(condition.operator as string)} ${condition.value}`;
      }
      return `${negatePrefix}date ${formatOperator(condition.operator as string)} ${formatValue(condition.value)}`;
    }
    case "geo": {
      const val = formatValue(condition.value);
      const fieldLabels: Record<string, string> = {
        country: "country",
        region: "region",
        city: "city",
        continent: "continent",
      };
      return `${negatePrefix}${fieldLabels[condition.field] || condition.field} is ${val}`;
    }
    case "inventory": {
      if (condition.field === "in_stock") {
        return condition.operator === "is_true"
          ? `${negatePrefix}product is in stock`
          : `${negatePrefix}product is out of stock`;
      }
      if (condition.field === "total_quantity") {
        return `${negatePrefix}stock ${formatOperator(condition.operator as string)} ${condition.value}`;
      }
      return `${negatePrefix}inventory ${condition.field} ${formatOperator(condition.operator as string)} ${condition.value}`;
    }
    case "session": {
      if (condition.field === "is_first_visit") {
        return condition.operator === "is_true"
          ? `${negatePrefix}this is the first visit`
          : `${negatePrefix}this is a returning visit`;
      }
      return `${negatePrefix}session ${condition.field} ${formatOperator(condition.operator as string)} ${formatValue(condition.value)}`;
    }
    case "collection": {
      return `${negatePrefix}collection ${condition.field} ${formatOperator(condition.operator as string)} ${formatValue(condition.value)}`;
    }
    case "product": {
      return `${negatePrefix}product ${condition.field} ${formatOperator(condition.operator as string)} ${formatValue(condition.value)}`;
    }
    case "ab_test": {
      const pct = condition.bucketMax - condition.bucketMin + 1;
      return `${negatePrefix}${pct}% of traffic (test: ${condition.testId})`;
    }
    default:
      return "Unknown condition";
  }
}

// =============================================================================
// ACTION SUMMARIZER
// =============================================================================

export function summarizeActions(actions: Action[]): string {
  if (actions.length === 0) return "No actions";
  return actions.map(summarizeAction).join(", then ");
}

function summarizeAction(action: Action): string {
  switch (action.type) {
    case "filter": {
      const mode = action.mode === "include" ? "Show only" : "Hide";
      if (action.matchType === "universal") return `${mode} universal images`;
      if (action.matchType === "variant_value") return `${mode} images for selected variant`;
      const vals = action.matchValues.length > 0 ? action.matchValues.join(", ") : "matching";
      return `${mode} images tagged "${vals}"`;
    }
    case "reorder": {
      if (action.strategy === "shuffle") return "Shuffle image order";
      if (action.strategy === "reverse") return "Reverse image order";
      const vals = action.matchValues?.join(", ") || "";
      if (action.strategy === "move_to_front") return `Move "${vals}" images to front`;
      if (action.strategy === "move_to_back") return `Move "${vals}" images to back`;
      return `Reorder images (${action.strategy})`;
    }
    case "badge": {
      const target =
        action.target === "first" ? "first image" :
        action.target === "all" ? "all images" :
        action.target === "last" ? "last image" :
        "matched images";
      return `Show "${action.text}" badge on ${target}`;
    }
    case "limit":
      return `Show maximum ${action.maxImages} images`;
    case "prioritize": {
      const vals = action.matchValues.join(", ");
      return `Prioritize "${vals}" images`;
    }
    case "replace":
      return `Replace gallery from ${action.source}`;
    default:
      return "Unknown action";
  }
}

// =============================================================================
// HELPERS
// =============================================================================

function formatValue(value: unknown): string {
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value || "");
}

function formatOperator(operator: string): string {
  const map: Record<string, string> = {
    equals: "is",
    not_equals: "is not",
    contains: "contains",
    not_contains: "does not contain",
    starts_with: "starts with",
    ends_with: "ends with",
    in_list: "is one of",
    not_in_list: "is not one of",
    greater_than: "is more than",
    greater_than_or_equals: "is at least",
    less_than: "is less than",
    less_than_or_equals: "is at most",
    between: "is between",
    before: "is before",
    after: "is after",
    on: "is on",
    is_true: "is true",
    is_false: "is false",
    contains_any: "has any of",
    contains_all: "has all of",
  };
  return map[operator] || operator;
}

function buildAutoDescription(conditionSummary: string, actionSummary: string): string {
  return `When ${conditionSummary.charAt(0).toLowerCase()}${conditionSummary.slice(1)}: ${actionSummary}`;
}
