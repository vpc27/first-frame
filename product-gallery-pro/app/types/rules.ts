/**
 * Gallery Rules Engine - Core Type Definitions (PGP-F2.0)
 *
 * A scalable rules engine that replaces hardcoded variant filtering with a
 * flexible "WHEN condition THEN action" system. One unified architecture
 * handles all 20+ use cases (variant filtering, traffic personalization,
 * A/B testing, mobile optimization, geo-targeting, customer segments, etc.).
 */

import type { ConditionGroup, Condition, ConditionType } from "./rules-conditions";
import type { Action, ActionType } from "./rules-actions";

// Re-export condition and action types for convenience
export type { ConditionGroup, Condition, ConditionType } from "./rules-conditions";
export type { Action, ActionType } from "./rules-actions";

// =============================================================================
// RULE SCOPE
// =============================================================================

/**
 * Scope determines where a rule applies
 */
export type RuleScope = "shop" | "collection" | "product";

export type ProductScopeMode = "all" | "include" | "exclude";

export interface ProductScopeItem {
  id: string;       // Shopify GID "gid://shopify/Product/12345"
  title: string;    // Cached for display
  handle: string;   // For slug display
  image?: string;   // Thumbnail URL
}

export interface ProductScope {
  mode: ProductScopeMode;
  products: ProductScopeItem[];
}

/**
 * Rule status
 */
export type RuleStatus = "active" | "paused" | "draft" | "scheduled";

// =============================================================================
// CORE RULE INTERFACE
// =============================================================================

/**
 * A complete rule definition
 */
export interface Rule {
  /** Unique rule identifier */
  id: string;

  /** Human-readable name */
  name: string;

  /** Optional description */
  description?: string;

  // === Targeting ===

  /** Where this rule applies */
  scope: RuleScope;

  /** Specific ID if scope is "collection" or "product" */
  scopeId?: string;

  /** Product include/exclude filter (works with any scope) */
  productScope?: ProductScope;

  // === Logic ===

  /** Nested AND/OR conditions */
  conditions: ConditionGroup;

  /** Actions to execute when conditions match */
  actions: Action[];

  // === Execution ===

  /** Lower = higher priority (evaluated first) */
  priority: number;

  /** Stop evaluating more rules after this one matches */
  stopProcessing: boolean;

  // === Scheduling ===

  /** Current rule status */
  status: RuleStatus;

  /** ISO timestamp for scheduled activation */
  startDate?: string;

  /** ISO timestamp for scheduled deactivation */
  endDate?: string;

  // === Metadata ===

  /** ISO timestamp when created */
  createdAt: string;

  /** ISO timestamp when last modified */
  updatedAt: string;

  /** Optional tags for organization */
  tags?: string[];

  /** If created from a template, which one */
  templateId?: string;
}

// =============================================================================
// RULE STORAGE (METAFIELDS)
// =============================================================================

/**
 * Evaluation mode for rule processing
 */
export type RuleEvaluationMode = "first_match" | "all_matches" | "highest_priority";

/**
 * Fallback behavior when no rules match
 */
export type RuleFallbackBehavior = "default_gallery" | "show_all" | "show_none";

/**
 * Global settings for the rules engine
 */
export interface RulesGlobalSettings {
  /** Whether rules engine is enabled */
  enableRules: boolean;

  /** What to do when no rules match */
  fallbackBehavior: RuleFallbackBehavior;

  /** Maximum rules to evaluate per request (performance guard) */
  maxRulesPerEvaluation: number;

  /** Whether to use legacy variant mapping as fallback */
  useLegacyFallback: boolean;
}

/**
 * Shop-level rules storage structure
 * Stored in: shop.metafields.product_gallery_pro.rules
 */
export interface ShopRulesMetafield {
  /** Schema version for future migrations */
  version: 1;

  /** How to evaluate multiple matching rules */
  evaluationMode: RuleEvaluationMode;

  /** All shop-level rules */
  rules: Rule[];

  /** Global settings */
  globalSettings: RulesGlobalSettings;

  /** ISO timestamp of last update */
  updatedAt: string;
}

/**
 * Product-level rule overrides
 * Stored in: product.metafields.product_gallery_pro.rule_overrides
 */
export interface ProductRuleOverrides {
  /** Schema version for future migrations */
  version: 1;

  /** Whether to disable all shop rules for this product */
  disableShopRules: boolean;

  /** Specific shop rule IDs to disable for this product */
  disabledRuleIds: string[];

  /** Product-specific rules (override shop rules) */
  rules: Rule[];

  /** ISO timestamp of last update */
  updatedAt: string;
}

// =============================================================================
// RULE EVALUATION CONTEXT
// =============================================================================

/**
 * Device types for context
 */
export type DeviceType = "mobile" | "tablet" | "desktop";

/**
 * Customer information for context
 */
export interface CustomerContext {
  /** Whether customer is logged in */
  isLoggedIn: boolean;

  /** Customer ID if logged in */
  customerId?: string;

  /** Customer tags (e.g., "VIP", "wholesale") */
  tags: string[];

  /** Number of orders placed */
  orderCount?: number;

  /** Total spent by customer */
  totalSpent?: number;

  /** Customer email domain (for B2B detection) */
  emailDomain?: string;
}

/**
 * URL and traffic source information
 */
export interface TrafficContext {
  /** Current URL path */
  path: string;

  /** Referrer URL */
  referrer?: string;

  /** UTM source parameter */
  utmSource?: string;

  /** UTM medium parameter */
  utmMedium?: string;

  /** UTM campaign parameter */
  utmCampaign?: string;

  /** UTM content parameter */
  utmContent?: string;

  /** UTM term parameter */
  utmTerm?: string;

  /** Custom URL parameters */
  customParams?: Record<string, string>;
}

/**
 * Session information
 */
export interface SessionContext {
  /** Whether this is the first visit */
  isFirstVisit: boolean;

  /** Number of pages viewed this session */
  pageViews: number;

  /** Session duration in seconds */
  duration: number;

  /** Previously viewed products in session */
  viewedProductIds: string[];

  /** Previously viewed collections in session */
  viewedCollectionIds: string[];
}

/**
 * Time context
 */
export interface TimeContext {
  /** Current timestamp (ISO format) */
  now: string;

  /** Day of week (0=Sunday, 6=Saturday) */
  dayOfWeek: number;

  /** Hour of day (0-23) */
  hour: number;

  /** User's timezone (e.g., "America/New_York") */
  timezone?: string;
}

/**
 * Geo context
 */
export interface GeoContext {
  /** ISO country code (e.g., "US") */
  country?: string;

  /** Region/state code (e.g., "CA") */
  region?: string;

  /** City name */
  city?: string;
}

/**
 * Product context
 */
export interface ProductContext {
  /** Product ID */
  id: string;

  /** Product handle */
  handle?: string;

  /** Product type */
  productType?: string;

  /** Product vendor */
  vendor?: string;

  /** Product tags */
  tags: string[];

  /** Collection IDs this product belongs to */
  collectionIds: string[];
}

/**
 * Variant context
 */
export interface VariantContext {
  /** Selected variant ID */
  id?: string;

  /** Selected option values (e.g., { "Color": "Red", "Size": "Large" }) */
  selectedOptions: Record<string, string>;

  /** Currently selected option values array */
  selectedValues: string[];
}

/**
 * Inventory context
 */
export interface InventoryContext {
  /** Total inventory across all variants */
  totalInventory: number;

  /** Inventory per variant (variantId -> quantity) */
  variantInventory: Record<string, number>;

  /** Whether product is in stock */
  inStock: boolean;
}

/**
 * Media item in the gallery
 */
export interface MediaItem {
  /** Media ID */
  id: string;

  /** Media type */
  type: "image" | "video" | "external_video" | "model_3d";

  /** Alt text */
  alt?: string;

  /** Source URL */
  src: string;

  /** High-resolution URL */
  srcHiRes?: string;

  /** Position in original gallery */
  position: number;

  /** Custom tags for this media */
  tags?: string[];

  /** Variant values this media is mapped to (from legacy mapping) */
  variantValues?: string[];

  /** Whether this is a universal image */
  universal?: boolean;
}

/**
 * Complete context for rule evaluation
 */
export interface RuleEvaluationContext {
  /** Device information */
  device: DeviceType;

  /** Screen width in pixels */
  screenWidth: number;

  /** Customer information */
  customer: CustomerContext;

  /** Traffic/URL information */
  traffic: TrafficContext;

  /** Session information */
  session: SessionContext;

  /** Time information */
  time: TimeContext;

  /** Geo information */
  geo: GeoContext;

  /** Product information */
  product: ProductContext;

  /** Selected variant information */
  variant: VariantContext;

  /** Inventory information */
  inventory: InventoryContext;

  /** Collection context (if viewing from collection page) */
  collectionId?: string;

  /** All media items in the gallery */
  media: MediaItem[];

  /** A/B test bucket (0-99) for traffic splitting */
  abTestBucket: number;
}

// =============================================================================
// RULE EVALUATION RESULT
// =============================================================================

/**
 * Result of evaluating a single rule
 */
export interface RuleMatchResult {
  /** The rule that matched */
  rule: Rule;

  /** Whether all conditions were satisfied */
  matched: boolean;

  /** Individual condition results (for debugging) */
  conditionResults?: Array<{
    condition: Condition | ConditionGroup;
    matched: boolean;
    reason?: string;
  }>;
}

/**
 * Badge to display on an image
 */
export interface BadgeOverlay {
  /** Badge text */
  text: string;

  /** Position */
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";

  /** Badge style */
  style: "primary" | "secondary" | "success" | "warning" | "danger" | "info" | "custom";

  /** Custom background color (if style is "custom") */
  backgroundColor?: string;

  /** Custom text color (if style is "custom") */
  textColor?: string;
}

/**
 * Processed media item after rules are applied
 */
export interface ProcessedMediaItem extends MediaItem {
  /** Whether this item is visible */
  visible: boolean;

  /** New position after reordering */
  newPosition: number;

  /** Badges to display */
  badges: BadgeOverlay[];

  /** Which rules affected this item */
  appliedRuleIds: string[];
}

/**
 * Final result of rule evaluation
 */
export interface RuleEvaluationResult {
  /** Processed media items (filtered, reordered, with badges) */
  media: ProcessedMediaItem[];

  /** Rules that matched */
  matchedRules: Rule[];

  /** Total evaluation time in milliseconds */
  evaluationTimeMs: number;

  /** Whether legacy fallback was used */
  usedLegacyFallback: boolean;

  /** Debug information */
  debug?: {
    rulesEvaluated: number;
    conditionsChecked: number;
    actionsApplied: number;
    contextSnapshot?: Partial<RuleEvaluationContext>;
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Generate a unique rule ID
 */
export function generateRuleId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Create a new empty rule
 */
export function createEmptyRule(name: string = "New Rule"): Rule {
  const now = new Date().toISOString();
  return {
    id: generateRuleId(),
    name,
    scope: "shop",
    conditions: {
      operator: "AND",
      conditions: [],
    },
    actions: [],
    priority: 100,
    stopProcessing: false,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Create default shop rules metafield structure
 */
export function createDefaultShopRules(): ShopRulesMetafield {
  return {
    version: 1,
    evaluationMode: "first_match",
    rules: [],
    globalSettings: {
      enableRules: true,
      fallbackBehavior: "default_gallery",
      maxRulesPerEvaluation: 50,
      useLegacyFallback: true,
    },
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Create default product rule overrides structure
 */
export function createDefaultProductOverrides(): ProductRuleOverrides {
  return {
    version: 1,
    disableShopRules: false,
    disabledRuleIds: [],
    rules: [],
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Sort rules by priority (lower number = higher priority)
 */
export function sortRulesByPriority(rules: Rule[]): Rule[] {
  return [...rules].sort((a, b) => a.priority - b.priority);
}

/**
 * Filter to only active rules (respects scheduling)
 */
export function filterActiveRules(rules: Rule[], now: Date = new Date()): Rule[] {
  return rules.filter((rule) => {
    // Must be active or scheduled
    if (rule.status !== "active" && rule.status !== "scheduled") {
      return false;
    }

    // Check scheduled status
    if (rule.status === "scheduled") {
      if (rule.startDate && new Date(rule.startDate) > now) {
        return false;
      }
    }

    // Check end date
    if (rule.endDate && new Date(rule.endDate) < now) {
      return false;
    }

    return true;
  });
}

/**
 * Recursively find all regex condition values in a condition tree
 */
function findRegexConditions(group: ConditionGroup): string[] {
  const results: string[] = [];
  for (const item of group.conditions) {
    if ("operator" in item && "conditions" in item) {
      // It's a nested ConditionGroup
      results.push(...findRegexConditions(item as ConditionGroup));
    } else {
      // It's a Condition
      const condition = item as Condition;
      if ("operator" in condition && (condition as any).operator === "matches_regex" && typeof (condition as any).value === "string") {
        results.push((condition as any).value);
      }
    }
  }
  return results;
}

/**
 * Validate a rule structure
 */
export function validateRule(rule: Partial<Rule>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!rule.name || rule.name.trim() === "") {
    errors.push("Rule name is required");
  }

  if (!rule.conditions) {
    errors.push("Rule must have conditions");
  }

  if (!rule.actions || rule.actions.length === 0) {
    errors.push("Rule must have at least one action");
  }

  if (rule.priority !== undefined && (rule.priority < 0 || rule.priority > 1000)) {
    errors.push("Priority must be between 0 and 1000");
  }

  if (rule.startDate && rule.endDate) {
    if (new Date(rule.startDate) > new Date(rule.endDate)) {
      errors.push("Start date must be before end date");
    }
  }

  // Validate regex conditions
  if (rule.conditions) {
    const regexValues = findRegexConditions(rule.conditions);
    for (const val of regexValues) {
      if (val.length > 200) {
        errors.push("Regex pattern must be 200 characters or fewer");
      }
      try {
        new RegExp(val);
      } catch {
        errors.push(`Invalid regex: ${val.slice(0, 50)}`);
      }
      if (/(\.\*){3,}|(\w\+)\+|\(\?.*\?\)/.test(val)) {
        errors.push("Regex contains potentially unsafe patterns");
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
