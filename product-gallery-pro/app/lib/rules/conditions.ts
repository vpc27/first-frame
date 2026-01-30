/**
 * Rules Engine - Condition Evaluators (PGP-F2.0)
 *
 * Implements all 10+ condition type evaluators:
 * - variant: Variant filtering
 * - url: URL/path matching
 * - device: Device type detection
 * - customer: Customer data matching
 * - time: Date/time conditions
 * - geo: Geographic conditions
 * - inventory: Stock level conditions
 * - traffic_source: UTM parameter matching
 * - session: Session data conditions
 * - collection: Collection context
 * - product: Product data matching
 * - ab_test: A/B test bucket
 */

import type { RuleEvaluationContext } from "~/types/rules";
import type {
  Condition,
  VariantCondition,
  UrlCondition,
  DeviceCondition,
  CustomerCondition,
  TimeCondition,
  GeoCondition,
  InventoryCondition,
  TrafficSourceCondition,
  SessionCondition,
  CollectionCondition,
  ProductCondition,
  ABTestCondition,
  StringOperator,
  NumberOperator,
  BooleanOperator,
  ListOperator,
} from "~/types/rules-conditions";

// =============================================================================
// MAIN EVALUATOR
// =============================================================================

/**
 * Evaluate a single condition against context
 */
export function evaluateCondition(
  condition: Condition,
  context: RuleEvaluationContext
): boolean {
  switch (condition.type) {
    case "variant":
      return evaluateVariantCondition(condition, context);
    case "url":
      return evaluateUrlCondition(condition, context);
    case "device":
      return evaluateDeviceCondition(condition, context);
    case "customer":
      return evaluateCustomerCondition(condition, context);
    case "time":
      return evaluateTimeCondition(condition, context);
    case "geo":
      return evaluateGeoCondition(condition, context);
    case "inventory":
      return evaluateInventoryCondition(condition, context);
    case "traffic_source":
      return evaluateTrafficSourceCondition(condition, context);
    case "session":
      return evaluateSessionCondition(condition, context);
    case "collection":
      return evaluateCollectionCondition(condition, context);
    case "product":
      return evaluateProductCondition(condition, context);
    case "ab_test":
      return evaluateABTestCondition(condition, context);
    default:
      console.warn(`[Rules] Unknown condition type: ${(condition as Condition).type}`);
      return false;
  }
}

// =============================================================================
// VARIANT CONDITION
// =============================================================================

/**
 * Evaluate variant condition
 * Matches selected variant options against the condition
 */
export function evaluateVariantCondition(
  condition: VariantCondition,
  context: RuleEvaluationContext
): boolean {
  const { selectedOptions, selectedValues } = context.variant;

  // If no variant selected, condition doesn't match
  if (Object.keys(selectedOptions).length === 0 && selectedValues.length === 0) {
    return false;
  }

  // If optionName is specified, match against that specific option
  if (condition.optionName) {
    const optionValue = selectedOptions[condition.optionName];
    if (!optionValue) return false;
    return evaluateStringOperator(condition.operator, optionValue, condition.value);
  }

  // Otherwise, match against any selected value
  const valuesToCheck = selectedValues.length > 0
    ? selectedValues
    : Object.values(selectedOptions);

  // Check if any selected value matches
  return valuesToCheck.some((value) =>
    evaluateStringOperator(condition.operator, value, condition.value)
  );
}

// =============================================================================
// URL CONDITION
// =============================================================================

/**
 * Evaluate URL condition
 * Matches against URL components
 */
export function evaluateUrlCondition(
  condition: UrlCondition,
  context: RuleEvaluationContext
): boolean {
  const { traffic } = context;

  let valueToCheck: string | undefined;

  switch (condition.field) {
    case "path":
      valueToCheck = traffic.path;
      break;
    case "referrer":
      valueToCheck = traffic.referrer;
      break;
    case "param":
      if (condition.paramName) {
        valueToCheck = traffic.customParams?.[condition.paramName];
      }
      break;
    case "full_url":
      valueToCheck = traffic.path; // In storefront, full URL needs to be constructed
      break;
    case "host":
      // Host is typically consistent but can be extracted from referrer
      valueToCheck = undefined; // Would need to be passed in context
      break;
  }

  if (valueToCheck === undefined) {
    // For "not_contains" or "not_equals", undefined should return true
    if (condition.operator === "not_contains" || condition.operator === "not_equals") {
      return true;
    }
    return false;
  }

  return evaluateStringOperator(condition.operator, valueToCheck, condition.value);
}

// =============================================================================
// DEVICE CONDITION
// =============================================================================

/**
 * Evaluate device condition
 * Matches device type or screen characteristics
 */
export function evaluateDeviceCondition(
  condition: DeviceCondition,
  context: RuleEvaluationContext
): boolean {
  switch (condition.field) {
    case "type":
      return evaluateStringOperator(
        condition.operator as StringOperator,
        context.device,
        condition.value as string | string[]
      );

    case "screen_width":
      return evaluateNumberOperator(
        condition.operator as NumberOperator,
        context.screenWidth,
        condition.value as number
      );

    case "screen_height":
      // Screen height not typically available in context
      return false;

    case "touch_enabled":
      // Infer touch enabled from device type
      const isTouchDevice = context.device === "mobile" || context.device === "tablet";
      return evaluateBooleanOperator(
        condition.operator as BooleanOperator,
        isTouchDevice
      );

    default:
      return false;
  }
}

// =============================================================================
// CUSTOMER CONDITION
// =============================================================================

/**
 * Evaluate customer condition
 * Matches customer data
 */
export function evaluateCustomerCondition(
  condition: CustomerCondition,
  context: RuleEvaluationContext
): boolean {
  const { customer } = context;

  switch (condition.field) {
    case "is_logged_in":
    case "has_account":
      return evaluateBooleanOperator(
        condition.operator as BooleanOperator,
        customer.isLoggedIn
      );

    case "tags":
      return evaluateListOperator(
        condition.operator as ListOperator,
        customer.tags,
        condition.value as string | string[]
      );

    case "order_count":
      if (customer.orderCount === undefined) return false;
      return evaluateNumberOperator(
        condition.operator as NumberOperator,
        customer.orderCount,
        condition.value as number
      );

    case "total_spent":
      if (customer.totalSpent === undefined) return false;
      return evaluateNumberOperator(
        condition.operator as NumberOperator,
        customer.totalSpent,
        condition.value as number
      );

    case "email_domain":
      if (!customer.emailDomain) return false;
      return evaluateStringOperator(
        condition.operator as StringOperator,
        customer.emailDomain,
        condition.value as string | string[]
      );

    default:
      return false;
  }
}

// =============================================================================
// TIME CONDITION
// =============================================================================

/**
 * Evaluate time condition
 * Matches date, time, or day of week
 */
export function evaluateTimeCondition(
  condition: TimeCondition,
  context: RuleEvaluationContext
): boolean {
  const { time } = context;
  const now = new Date(time.now);

  switch (condition.field) {
    case "date":
    case "datetime":
      return evaluateDateOperator(condition, now);

    case "day_of_week":
      if (Array.isArray(condition.value)) {
        return (condition.value as number[]).includes(time.dayOfWeek);
      }
      return evaluateNumberOperator(
        condition.operator as NumberOperator,
        time.dayOfWeek,
        condition.value as number
      );

    case "hour":
      return evaluateNumberOperator(
        condition.operator as NumberOperator,
        time.hour,
        condition.value as number,
        condition.valueEnd as number | undefined
      );

    default:
      return false;
  }
}

/**
 * Evaluate date-specific operators
 */
function evaluateDateOperator(
  condition: TimeCondition,
  now: Date
): boolean {
  const conditionDate = new Date(condition.value as string);

  switch (condition.operator) {
    case "before":
      return now < conditionDate;

    case "after":
      return now > conditionDate;

    case "on":
      return (
        now.getFullYear() === conditionDate.getFullYear() &&
        now.getMonth() === conditionDate.getMonth() &&
        now.getDate() === conditionDate.getDate()
      );

    case "between":
      if (!condition.valueEnd) return false;
      const endDate = new Date(condition.valueEnd as string);
      return now >= conditionDate && now <= endDate;

    case "in_last_n_days":
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - (condition.value as number));
      return now >= daysAgo;

    case "in_next_n_days":
      const daysAhead = new Date();
      daysAhead.setDate(daysAhead.getDate() + (condition.value as number));
      return now <= daysAhead;

    default:
      return false;
  }
}

// =============================================================================
// GEO CONDITION
// =============================================================================

/**
 * Evaluate geo condition
 * Matches visitor location
 */
export function evaluateGeoCondition(
  condition: GeoCondition,
  context: RuleEvaluationContext
): boolean {
  const { geo } = context;

  let valueToCheck: string | undefined;

  switch (condition.field) {
    case "country":
      valueToCheck = geo.country;
      break;
    case "region":
      valueToCheck = geo.region;
      break;
    case "city":
      valueToCheck = geo.city;
      break;
    case "continent":
      // Would need to derive continent from country
      valueToCheck = undefined;
      break;
  }

  if (valueToCheck === undefined) {
    return condition.operator === "not_equals" || condition.operator === "not_in_list";
  }

  return evaluateStringOperator(condition.operator, valueToCheck, condition.value);
}

// =============================================================================
// INVENTORY CONDITION
// =============================================================================

/**
 * Evaluate inventory condition
 * Matches stock levels
 */
export function evaluateInventoryCondition(
  condition: InventoryCondition,
  context: RuleEvaluationContext
): boolean {
  const { inventory } = context;

  switch (condition.field) {
    case "total_quantity":
      return evaluateNumberOperator(
        condition.operator as NumberOperator,
        inventory.totalInventory,
        condition.value as number,
        condition.valueEnd
      );

    case "variant_quantity":
      if (!condition.variantId) {
        // If no variant specified, check selected variant
        const selectedVariantId = context.variant.id;
        if (!selectedVariantId) return false;
        const qty = inventory.variantInventory[selectedVariantId] ?? 0;
        return evaluateNumberOperator(
          condition.operator as NumberOperator,
          qty,
          condition.value as number,
          condition.valueEnd
        );
      }
      const variantQty = inventory.variantInventory[condition.variantId] ?? 0;
      return evaluateNumberOperator(
        condition.operator as NumberOperator,
        variantQty,
        condition.value as number,
        condition.valueEnd
      );

    case "in_stock":
      return evaluateBooleanOperator(
        condition.operator as BooleanOperator,
        inventory.inStock
      );

    case "compare_at_price_set":
      // Would need price context
      return false;

    default:
      return false;
  }
}

// =============================================================================
// TRAFFIC SOURCE CONDITION
// =============================================================================

/**
 * Evaluate traffic source condition
 * Matches UTM parameters
 */
export function evaluateTrafficSourceCondition(
  condition: TrafficSourceCondition,
  context: RuleEvaluationContext
): boolean {
  const { traffic } = context;

  let valueToCheck: string | undefined;

  switch (condition.field) {
    case "utm_source":
      valueToCheck = traffic.utmSource;
      break;
    case "utm_medium":
      valueToCheck = traffic.utmMedium;
      break;
    case "utm_campaign":
      valueToCheck = traffic.utmCampaign;
      break;
    case "utm_content":
      valueToCheck = traffic.utmContent;
      break;
    case "utm_term":
      valueToCheck = traffic.utmTerm;
      break;
    case "referrer":
      valueToCheck = traffic.referrer;
      break;
  }

  if (valueToCheck === undefined) {
    return condition.operator === "not_equals" || condition.operator === "not_in_list";
  }

  return evaluateStringOperator(condition.operator, valueToCheck, condition.value);
}

// =============================================================================
// SESSION CONDITION
// =============================================================================

/**
 * Evaluate session condition
 * Matches session data
 */
export function evaluateSessionCondition(
  condition: SessionCondition,
  context: RuleEvaluationContext
): boolean {
  const { session } = context;

  switch (condition.field) {
    case "is_first_visit":
      return evaluateBooleanOperator(
        condition.operator as BooleanOperator,
        session.isFirstVisit
      );

    case "page_views":
      return evaluateNumberOperator(
        condition.operator as NumberOperator,
        session.pageViews,
        condition.value as number,
        condition.valueEnd
      );

    case "duration_seconds":
      return evaluateNumberOperator(
        condition.operator as NumberOperator,
        session.duration,
        condition.value as number,
        condition.valueEnd
      );

    case "viewed_products":
      return evaluateListOperator(
        condition.operator as ListOperator,
        session.viewedProductIds,
        condition.value as string | string[]
      );

    case "viewed_collections":
      return evaluateListOperator(
        condition.operator as ListOperator,
        session.viewedCollectionIds,
        condition.value as string | string[]
      );

    default:
      return false;
  }
}

// =============================================================================
// COLLECTION CONDITION
// =============================================================================

/**
 * Evaluate collection condition
 * Matches collection context
 */
export function evaluateCollectionCondition(
  condition: CollectionCondition,
  context: RuleEvaluationContext
): boolean {
  // If not viewing from a collection, condition doesn't match
  if (!context.collectionId) {
    return condition.operator === "not_equals" || condition.operator === "not_contains";
  }

  switch (condition.field) {
    case "id":
      return evaluateStringOperator(
        condition.operator as StringOperator,
        context.collectionId,
        condition.value
      );

    case "handle":
    case "title":
    case "tags":
      // Would need additional collection data in context
      // For now, just match against collection ID
      return evaluateStringOperator(
        condition.operator as StringOperator,
        context.collectionId,
        condition.value
      );

    default:
      return false;
  }
}

// =============================================================================
// PRODUCT CONDITION
// =============================================================================

/**
 * Evaluate product condition
 * Matches product data
 */
export function evaluateProductCondition(
  condition: ProductCondition,
  context: RuleEvaluationContext
): boolean {
  const { product } = context;

  switch (condition.field) {
    case "id":
      return evaluateStringOperator(
        condition.operator as StringOperator,
        product.id,
        condition.value
      );

    case "handle":
      if (!product.handle) return false;
      return evaluateStringOperator(
        condition.operator as StringOperator,
        product.handle,
        condition.value
      );

    case "product_type":
      if (!product.productType) return false;
      return evaluateStringOperator(
        condition.operator as StringOperator,
        product.productType,
        condition.value
      );

    case "vendor":
      if (!product.vendor) return false;
      return evaluateStringOperator(
        condition.operator as StringOperator,
        product.vendor,
        condition.value
      );

    case "tags":
      return evaluateListOperator(
        condition.operator as ListOperator,
        product.tags,
        condition.value
      );

    default:
      return false;
  }
}

// =============================================================================
// A/B TEST CONDITION
// =============================================================================

/**
 * Evaluate A/B test condition
 * Matches against traffic bucket
 */
export function evaluateABTestCondition(
  condition: ABTestCondition,
  context: RuleEvaluationContext
): boolean {
  const bucket = context.abTestBucket;
  return bucket >= condition.bucketMin && bucket <= condition.bucketMax;
}

// =============================================================================
// OPERATOR HELPERS
// =============================================================================

/**
 * Evaluate string operators
 */
function evaluateStringOperator(
  operator: StringOperator,
  actualValue: string,
  conditionValue: string | string[]
): boolean {
  const actual = actualValue.toLowerCase();

  switch (operator) {
    case "equals":
      if (Array.isArray(conditionValue)) {
        return conditionValue.some((v) => actual === v.toLowerCase());
      }
      return actual === conditionValue.toLowerCase();

    case "not_equals":
      if (Array.isArray(conditionValue)) {
        return !conditionValue.some((v) => actual === v.toLowerCase());
      }
      return actual !== conditionValue.toLowerCase();

    case "contains":
      if (Array.isArray(conditionValue)) {
        return conditionValue.some((v) => actual.includes(v.toLowerCase()));
      }
      return actual.includes(conditionValue.toLowerCase());

    case "not_contains":
      if (Array.isArray(conditionValue)) {
        return !conditionValue.some((v) => actual.includes(v.toLowerCase()));
      }
      return !actual.includes(conditionValue.toLowerCase());

    case "starts_with":
      if (Array.isArray(conditionValue)) {
        return conditionValue.some((v) => actual.startsWith(v.toLowerCase()));
      }
      return actual.startsWith(conditionValue.toLowerCase());

    case "ends_with":
      if (Array.isArray(conditionValue)) {
        return conditionValue.some((v) => actual.endsWith(v.toLowerCase()));
      }
      return actual.endsWith(conditionValue.toLowerCase());

    case "matches_regex":
      try {
        const pattern = String(conditionValue);
        if (pattern.length > 200) return false;
        const regex = new RegExp(pattern, "i");
        return regex.test(actualValue);
      } catch {
        return false;
      }

    case "in_list":
      if (!Array.isArray(conditionValue)) return actual === conditionValue.toLowerCase();
      return conditionValue.some((v) => actual === v.toLowerCase());

    case "not_in_list":
      if (!Array.isArray(conditionValue)) return actual !== conditionValue.toLowerCase();
      return !conditionValue.some((v) => actual === v.toLowerCase());

    default:
      return false;
  }
}

/**
 * Evaluate number operators
 */
function evaluateNumberOperator(
  operator: NumberOperator,
  actualValue: number,
  conditionValue: number,
  conditionValueEnd?: number
): boolean {
  switch (operator) {
    case "equals":
      return actualValue === conditionValue;

    case "not_equals":
      return actualValue !== conditionValue;

    case "greater_than":
      return actualValue > conditionValue;

    case "greater_than_or_equals":
      return actualValue >= conditionValue;

    case "less_than":
      return actualValue < conditionValue;

    case "less_than_or_equals":
      return actualValue <= conditionValue;

    case "between":
      if (conditionValueEnd === undefined) return false;
      return actualValue >= conditionValue && actualValue <= conditionValueEnd;

    case "not_between":
      if (conditionValueEnd === undefined) return false;
      return actualValue < conditionValue || actualValue > conditionValueEnd;

    default:
      return false;
  }
}

/**
 * Evaluate boolean operators
 */
function evaluateBooleanOperator(
  operator: BooleanOperator,
  actualValue: boolean
): boolean {
  switch (operator) {
    case "is_true":
      return actualValue === true;

    case "is_false":
      return actualValue === false;

    default:
      return false;
  }
}

/**
 * Evaluate list operators
 */
function evaluateListOperator(
  operator: ListOperator,
  actualList: string[],
  conditionValue: string | string[]
): boolean {
  const values = Array.isArray(conditionValue) ? conditionValue : [conditionValue];
  const normalizedList = actualList.map((v) => v.toLowerCase());
  const normalizedValues = values.map((v) => v.toLowerCase());

  switch (operator) {
    case "contains":
      // List contains any of the values
      return normalizedValues.some((v) => normalizedList.includes(v));

    case "not_contains":
      // List doesn't contain any of the values
      return !normalizedValues.some((v) => normalizedList.includes(v));

    case "contains_any":
      // Same as contains
      return normalizedValues.some((v) => normalizedList.includes(v));

    case "contains_all":
      // List contains all of the values
      return normalizedValues.every((v) => normalizedList.includes(v));

    case "is_empty":
      return actualList.length === 0;

    case "is_not_empty":
      return actualList.length > 0;

    default:
      return false;
  }
}
