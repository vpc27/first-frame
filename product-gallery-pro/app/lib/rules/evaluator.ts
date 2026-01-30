/**
 * Rules Evaluation Engine (PGP-F2.0)
 *
 * High-performance rule evaluation engine that:
 * - Evaluates rules in priority order
 * - Handles AND/OR logic with nesting
 * - Supports condition negation
 * - Implements stopProcessing
 * - Provides fallback behavior
 *
 * Performance target: <16ms for 50 rules
 */

import type {
  Rule,
  RuleEvaluationContext,
  RuleEvaluationResult,
  RuleMatchResult,
  MediaItem,
  ProcessedMediaItem,
  ShopRulesMetafield,
  BadgeOverlay,
} from "~/types/rules";
import { sortRulesByPriority, filterActiveRules } from "~/types/rules";
import type { ConditionGroup, Condition } from "~/types/rules-conditions";
import { isConditionGroup } from "~/types/rules-conditions";
import type { Action } from "~/types/rules-actions";
import { evaluateCondition } from "./conditions";
import { executeAction } from "./actions";

// =============================================================================
// MAIN EVALUATION FUNCTION
// =============================================================================

/**
 * Evaluate all rules against context and return processed media
 */
export function evaluateRules(
  rules: Rule[],
  context: RuleEvaluationContext,
  settings: ShopRulesMetafield["globalSettings"]
): RuleEvaluationResult {
  const startTime = performance.now();

  // Initialize processed media from context
  let processedMedia: ProcessedMediaItem[] = context.media.map((item, index) => ({
    ...item,
    visible: true,
    newPosition: index,
    badges: [],
    appliedRuleIds: [],
  }));

  const matchedRules: Rule[] = [];
  let rulesEvaluated = 0;
  let conditionsChecked = 0;
  let actionsApplied = 0;

  // Check if rules engine is enabled
  if (!settings.enableRules) {
    return {
      media: processedMedia,
      matchedRules: [],
      evaluationTimeMs: performance.now() - startTime,
      usedLegacyFallback: settings.useLegacyFallback,
      debug: {
        rulesEvaluated: 0,
        conditionsChecked: 0,
        actionsApplied: 0,
      },
    };
  }

  // Filter to active rules and sort by priority
  const activeRules = filterActiveRules(sortRulesByPriority(rules));

  // Limit rules to evaluate
  const rulesToEvaluate = activeRules.slice(0, settings.maxRulesPerEvaluation);

  // Evaluate each rule
  for (const rule of rulesToEvaluate) {
    rulesEvaluated++;

    // Check if rule scope matches
    if (!matchesScope(rule, context)) {
      continue;
    }

    // Evaluate conditions
    const { matched, conditionsCount } = evaluateConditionGroup(
      rule.conditions,
      context
    );
    conditionsChecked += conditionsCount;

    if (matched) {
      matchedRules.push(rule);

      // Execute actions
      for (const action of rule.actions) {
        processedMedia = executeAction(action, processedMedia, context);
        actionsApplied++;

        // Track which rule affected each media item
        processedMedia.forEach((item) => {
          if (!item.appliedRuleIds.includes(rule.id)) {
            // Only add if the item was potentially affected
            // For now, add to all visible items
            if (item.visible) {
              item.appliedRuleIds.push(rule.id);
            }
          }
        });
      }

      // Check if we should stop processing
      if (rule.stopProcessing) {
        break;
      }
    }
  }

  // Apply fallback if no rules matched
  if (matchedRules.length === 0 && settings.fallbackBehavior !== "default_gallery") {
    processedMedia = applyFallback(processedMedia, settings.fallbackBehavior);
  }

  // Renumber positions for visible items
  let visibleIndex = 0;
  processedMedia = processedMedia.map((item) => ({
    ...item,
    newPosition: item.visible ? visibleIndex++ : -1,
  }));

  // Sort by new position
  processedMedia.sort((a, b) => {
    if (!a.visible && !b.visible) return 0;
    if (!a.visible) return 1;
    if (!b.visible) return -1;
    return a.newPosition - b.newPosition;
  });

  const evaluationTimeMs = performance.now() - startTime;

  return {
    media: processedMedia,
    matchedRules,
    evaluationTimeMs,
    usedLegacyFallback: matchedRules.length === 0 && settings.useLegacyFallback,
    debug: {
      rulesEvaluated,
      conditionsChecked,
      actionsApplied,
    },
  };
}

// =============================================================================
// SCOPE MATCHING
// =============================================================================

/**
 * Check if a rule's scope matches the current context
 */
function matchesScope(rule: Rule, context: RuleEvaluationContext): boolean {
  switch (rule.scope) {
    case "shop":
      // Shop-level rules always apply
      return true;

    case "collection":
      // Collection rules apply if viewing from that collection
      if (!rule.scopeId) return true;
      return context.collectionId === rule.scopeId;

    case "product":
      // Product rules apply if on that product
      if (!rule.scopeId) return true;
      return context.product.id === rule.scopeId;

    default:
      return true;
  }
}

// =============================================================================
// CONDITION EVALUATION
// =============================================================================

/**
 * Evaluate a condition group (AND/OR logic)
 */
export function evaluateConditionGroup(
  group: ConditionGroup,
  context: RuleEvaluationContext
): { matched: boolean; conditionsCount: number } {
  let conditionsCount = 0;

  if (group.conditions.length === 0) {
    // Empty condition group matches everything
    return { matched: true, conditionsCount: 0 };
  }

  const results: boolean[] = [];

  for (const condition of group.conditions) {
    conditionsCount++;

    let result: boolean;

    if (isConditionGroup(condition)) {
      // Recursive evaluation for nested groups
      const nestedResult = evaluateConditionGroup(condition, context);
      result = nestedResult.matched;
      conditionsCount += nestedResult.conditionsCount - 1; // Subtract 1 to avoid double counting
    } else {
      // Evaluate single condition
      result = evaluateCondition(condition, context);

      // Apply negation if specified
      if (condition.negate) {
        result = !result;
      }
    }

    results.push(result);

    // Short-circuit evaluation
    if (group.operator === "AND" && !result) {
      return { matched: false, conditionsCount };
    }
    if (group.operator === "OR" && result) {
      return { matched: true, conditionsCount };
    }
  }

  // Final result based on operator
  const matched =
    group.operator === "AND"
      ? results.every((r) => r)
      : results.some((r) => r);

  return { matched, conditionsCount };
}

// =============================================================================
// FALLBACK BEHAVIOR
// =============================================================================

/**
 * Apply fallback behavior when no rules match
 */
function applyFallback(
  media: ProcessedMediaItem[],
  behavior: ShopRulesMetafield["globalSettings"]["fallbackBehavior"]
): ProcessedMediaItem[] {
  switch (behavior) {
    case "show_all":
      // Show all media (no filtering)
      return media.map((item) => ({ ...item, visible: true }));

    case "show_none":
      // Hide all media
      return media.map((item) => ({ ...item, visible: false }));

    case "default_gallery":
    default:
      // Keep current visibility (no change)
      return media;
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create a minimal evaluation context for testing
 */
export function createMinimalContext(
  media: MediaItem[],
  overrides: Partial<RuleEvaluationContext> = {}
): RuleEvaluationContext {
  return {
    device: "desktop",
    screenWidth: 1920,
    customer: {
      isLoggedIn: false,
      tags: [],
    },
    traffic: {
      path: "/",
    },
    session: {
      isFirstVisit: true,
      pageViews: 1,
      duration: 0,
      viewedProductIds: [],
      viewedCollectionIds: [],
    },
    time: {
      now: new Date().toISOString(),
      dayOfWeek: new Date().getDay(),
      hour: new Date().getHours(),
    },
    geo: {},
    product: {
      id: "",
      tags: [],
      collectionIds: [],
    },
    variant: {
      selectedOptions: {},
      selectedValues: [],
    },
    inventory: {
      totalInventory: 0,
      variantInventory: {},
      inStock: true,
    },
    media,
    abTestBucket: Math.floor(Math.random() * 100),
    ...overrides,
  };
}

/**
 * Get visible media from evaluation result
 */
export function getVisibleMedia(result: RuleEvaluationResult): ProcessedMediaItem[] {
  return result.media.filter((item) => item.visible);
}

/**
 * Get media IDs in order from evaluation result
 */
export function getMediaIdsInOrder(result: RuleEvaluationResult): string[] {
  return getVisibleMedia(result).map((item) => item.id);
}

/**
 * Check if evaluation was fast enough
 */
export function isEvaluationFast(result: RuleEvaluationResult): boolean {
  return result.evaluationTimeMs < 16; // Target: 1 frame (60fps)
}

/**
 * Create a test result for debugging
 */
export function createTestResult(
  media: MediaItem[],
  matchedRuleIds: string[] = []
): RuleEvaluationResult {
  return {
    media: media.map((item, index) => ({
      ...item,
      visible: true,
      newPosition: index,
      badges: [],
      appliedRuleIds: matchedRuleIds,
    })),
    matchedRules: [],
    evaluationTimeMs: 0,
    usedLegacyFallback: false,
  };
}

// =============================================================================
// BATCH EVALUATION
// =============================================================================

/**
 * Evaluate rules for multiple products efficiently
 */
export function evaluateRulesBatch(
  rules: Rule[],
  contexts: RuleEvaluationContext[],
  settings: ShopRulesMetafield["globalSettings"]
): RuleEvaluationResult[] {
  // Pre-filter and sort rules once
  const activeRules = filterActiveRules(sortRulesByPriority(rules));
  const rulesToEvaluate = activeRules.slice(0, settings.maxRulesPerEvaluation);

  return contexts.map((context) => {
    // For batch evaluation, we can reuse the filtered rules
    const startTime = performance.now();

    let processedMedia: ProcessedMediaItem[] = context.media.map((item, index) => ({
      ...item,
      visible: true,
      newPosition: index,
      badges: [],
      appliedRuleIds: [],
    }));

    const matchedRules: Rule[] = [];

    if (settings.enableRules) {
      for (const rule of rulesToEvaluate) {
        if (!matchesScope(rule, context)) continue;

        const { matched } = evaluateConditionGroup(rule.conditions, context);
        if (matched) {
          matchedRules.push(rule);
          for (const action of rule.actions) {
            processedMedia = executeAction(action, processedMedia, context);
          }
          if (rule.stopProcessing) break;
        }
      }
    }

    if (matchedRules.length === 0 && settings.fallbackBehavior !== "default_gallery") {
      processedMedia = applyFallback(processedMedia, settings.fallbackBehavior);
    }

    return {
      media: processedMedia,
      matchedRules,
      evaluationTimeMs: performance.now() - startTime,
      usedLegacyFallback: matchedRules.length === 0 && settings.useLegacyFallback,
    };
  });
}
