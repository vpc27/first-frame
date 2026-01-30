/**
 * Gallery Rules Engine - Condition Types (PGP-F2.0)
 *
 * Defines all 10 condition types that cover 20+ use cases:
 * - variant: Variant filtering (#1)
 * - url: Traffic source (#2), Influencer links (#19)
 * - device: Mobile optimization (#4)
 * - customer: New/returning (#6), VIP (#7), B2B (#12)
 * - time: Seasonal (#8), Time-of-day (#11)
 * - geo: Regional (#5), Locale (#16)
 * - inventory: Stock-based (#10)
 * - traffic_source: UTM params (#2)
 * - session: First visit (#6), History (#15)
 * - collection: Collection context (#13)
 */

// =============================================================================
// CONDITION GROUP (AND/OR LOGIC)
// =============================================================================

/**
 * Logical operator for combining conditions
 */
export type LogicalOperator = "AND" | "OR";

/**
 * A group of conditions combined with AND/OR logic
 */
export interface ConditionGroup {
  operator: LogicalOperator;
  conditions: Array<Condition | ConditionGroup>;
}

// =============================================================================
// CONDITION TYPES
// =============================================================================

/**
 * All available condition types
 */
export type ConditionType =
  | "variant"
  | "url"
  | "device"
  | "customer"
  | "time"
  | "geo"
  | "inventory"
  | "traffic_source"
  | "session"
  | "collection"
  | "product"
  | "ab_test";

/**
 * Comparison operators for string values
 */
export type StringOperator =
  | "equals"
  | "not_equals"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "matches_regex"
  | "in_list"
  | "not_in_list";

/**
 * Comparison operators for numeric values
 */
export type NumberOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "greater_than_or_equals"
  | "less_than"
  | "less_than_or_equals"
  | "between"
  | "not_between";

/**
 * Comparison operators for boolean values
 */
export type BooleanOperator = "is_true" | "is_false";

/**
 * Comparison operators for date/time values
 */
export type DateOperator =
  | "before"
  | "after"
  | "on"
  | "between"
  | "in_last_n_days"
  | "in_next_n_days";

/**
 * Comparison operators for list/array values
 */
export type ListOperator =
  | "contains"
  | "not_contains"
  | "contains_any"
  | "contains_all"
  | "is_empty"
  | "is_not_empty";

// =============================================================================
// BASE CONDITION INTERFACE
// =============================================================================

/**
 * Base interface for all conditions
 */
export interface BaseCondition {
  /** Condition type discriminator */
  type: ConditionType;

  /** Whether to negate the condition result */
  negate?: boolean;
}

// =============================================================================
// VARIANT CONDITION (#1 - Variant Filtering)
// =============================================================================

/**
 * Variant condition - filters based on selected variant options
 *
 * Use cases:
 * - Show images tagged for "Red" color when Red variant selected
 * - Show size-specific images when size changes
 * - Multi-option matching (Color AND Size)
 */
export interface VariantCondition extends BaseCondition {
  type: "variant";

  /** Which option to match (e.g., "Color", "Size") - if not set, matches any option */
  optionName?: string;

  /** The operator to use */
  operator: StringOperator;

  /** Value to compare against */
  value: string | string[];
}

// =============================================================================
// URL CONDITION (#2 Traffic Source, #19 Influencer Links)
// =============================================================================

/**
 * URL condition - matches against URL components
 *
 * Use cases:
 * - Instagram traffic gets lifestyle images first
 * - Influencer links show specific content
 * - Landing page personalization
 */
export interface UrlCondition extends BaseCondition {
  type: "url";

  /** Which URL component to check */
  field: "path" | "referrer" | "param" | "full_url" | "host";

  /** Parameter name if field is "param" */
  paramName?: string;

  /** The operator to use */
  operator: StringOperator;

  /** Value to compare against */
  value: string | string[];
}

// =============================================================================
// DEVICE CONDITION (#4 - Mobile Optimization)
// =============================================================================

/**
 * Device type values
 */
export type DeviceTypeValue = "mobile" | "tablet" | "desktop" | "any";

/**
 * Device condition - matches based on device type or screen size
 *
 * Use cases:
 * - Limit images on mobile for performance
 * - Show different layouts per device
 * - Hide video on mobile
 */
export interface DeviceCondition extends BaseCondition {
  type: "device";

  /** What aspect of device to check */
  field: "type" | "screen_width" | "screen_height" | "touch_enabled";

  /** Operator for comparison */
  operator: StringOperator | NumberOperator | BooleanOperator;

  /** Value to compare against */
  value: DeviceTypeValue | number | boolean | string[];
}

// =============================================================================
// CUSTOMER CONDITION (#6 New/Returning, #7 VIP, #12 B2B)
// =============================================================================

/**
 * Customer condition - matches based on customer data
 *
 * Use cases:
 * - Show exclusive images to VIP customers
 * - Different content for logged-in vs guests
 * - B2B-specific imagery
 * - New customer welcome content
 */
export interface CustomerCondition extends BaseCondition {
  type: "customer";

  /** What aspect of customer to check */
  field:
    | "is_logged_in"
    | "tags"
    | "order_count"
    | "total_spent"
    | "email_domain"
    | "has_account";

  /** Operator for comparison */
  operator: BooleanOperator | ListOperator | NumberOperator | StringOperator;

  /** Value to compare against */
  value: boolean | string | string[] | number;
}

// =============================================================================
// TIME CONDITION (#8 Seasonal, #11 Time-of-Day)
// =============================================================================

/**
 * Day of week values (0=Sunday through 6=Saturday)
 */
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/**
 * Time condition - matches based on date/time
 *
 * Use cases:
 * - Holiday season badges (Nov 15 - Dec 31)
 * - Flash sale indicators
 * - Day-of-week promotions
 * - Business hours content
 */
export interface TimeCondition extends BaseCondition {
  type: "time";

  /** What aspect of time to check */
  field: "date" | "day_of_week" | "hour" | "datetime";

  /** Operator for comparison */
  operator: DateOperator | NumberOperator | ListOperator;

  /** Value to compare against */
  value: string | number | number[] | DayOfWeek[];

  /** End value for range comparisons */
  valueEnd?: string | number;

  /** Timezone for comparison (e.g., "America/New_York") */
  timezone?: string;
}

// =============================================================================
// GEO CONDITION (#5 Regional, #16 Locale)
// =============================================================================

/**
 * Geo condition - matches based on visitor location
 *
 * Use cases:
 * - Show region-specific imagery (US vs EU)
 * - Language-specific badges
 * - Shipping restriction notices
 */
export interface GeoCondition extends BaseCondition {
  type: "geo";

  /** What aspect of geo to check */
  field: "country" | "region" | "city" | "continent";

  /** Operator for comparison */
  operator: StringOperator;

  /** Value to compare against (ISO codes for country/region) */
  value: string | string[];
}

// =============================================================================
// INVENTORY CONDITION (#10 Stock-Based)
// =============================================================================

/**
 * Inventory condition - matches based on stock levels
 *
 * Use cases:
 * - "Low stock" badge when under 5 units
 * - "Sold out" overlay
 * - "Back in stock" highlight
 */
export interface InventoryCondition extends BaseCondition {
  type: "inventory";

  /** What aspect of inventory to check */
  field: "total_quantity" | "variant_quantity" | "in_stock" | "compare_at_price_set";

  /** Which variant to check (for variant_quantity) */
  variantId?: string;

  /** Operator for comparison */
  operator: NumberOperator | BooleanOperator;

  /** Value to compare against */
  value: number | boolean;

  /** End value for range comparisons */
  valueEnd?: number;
}

// =============================================================================
// TRAFFIC SOURCE CONDITION (#2 UTM Params)
// =============================================================================

/**
 * Traffic source condition - matches based on UTM parameters
 *
 * Use cases:
 * - Facebook ads show different hero
 * - Email campaign specific content
 * - Affiliate link tracking
 */
export interface TrafficSourceCondition extends BaseCondition {
  type: "traffic_source";

  /** Which UTM parameter to check */
  field: "utm_source" | "utm_medium" | "utm_campaign" | "utm_content" | "utm_term" | "referrer";

  /** Operator for comparison */
  operator: StringOperator;

  /** Value to compare against */
  value: string | string[];
}

// =============================================================================
// SESSION CONDITION (#6 First Visit, #15 History)
// =============================================================================

/**
 * Session condition - matches based on session data
 *
 * Use cases:
 * - First visit welcome content
 * - Show recently viewed related content
 * - Progressive disclosure based on engagement
 */
export interface SessionCondition extends BaseCondition {
  type: "session";

  /** What aspect of session to check */
  field:
    | "is_first_visit"
    | "page_views"
    | "duration_seconds"
    | "viewed_products"
    | "viewed_collections";

  /** Operator for comparison */
  operator: BooleanOperator | NumberOperator | ListOperator;

  /** Value to compare against */
  value: boolean | number | string[];

  /** End value for range comparisons */
  valueEnd?: number;
}

// =============================================================================
// COLLECTION CONDITION (#13 Collection Context)
// =============================================================================

/**
 * Collection condition - matches based on collection context
 *
 * Use cases:
 * - Different images on Sale collection
 * - New arrivals collection specific content
 * - Category-specific badges
 */
export interface CollectionCondition extends BaseCondition {
  type: "collection";

  /** What aspect of collection to check */
  field: "id" | "handle" | "title" | "tags";

  /** Operator for comparison */
  operator: StringOperator | ListOperator;

  /** Value to compare against */
  value: string | string[];
}

// =============================================================================
// PRODUCT CONDITION
// =============================================================================

/**
 * Product condition - matches based on product data
 *
 * Use cases:
 * - Vendor-specific image handling
 * - Product type specific layouts
 * - Tag-based content
 */
export interface ProductCondition extends BaseCondition {
  type: "product";

  /** What aspect of product to check */
  field: "id" | "handle" | "product_type" | "vendor" | "tags";

  /** Operator for comparison */
  operator: StringOperator | ListOperator;

  /** Value to compare against */
  value: string | string[];
}

// =============================================================================
// A/B TEST CONDITION
// =============================================================================

/**
 * A/B test condition - matches based on traffic bucket
 *
 * Use cases:
 * - 50/50 split for hero image testing
 * - Gradual rollout of new gallery features
 * - Multi-variant testing
 */
export interface ABTestCondition extends BaseCondition {
  type: "ab_test";

  /** Test identifier */
  testId: string;

  /** Minimum bucket (inclusive, 0-99) */
  bucketMin: number;

  /** Maximum bucket (inclusive, 0-99) */
  bucketMax: number;
}

// =============================================================================
// UNION TYPE
// =============================================================================

/**
 * Union of all condition types
 */
export type Condition =
  | VariantCondition
  | UrlCondition
  | DeviceCondition
  | CustomerCondition
  | TimeCondition
  | GeoCondition
  | InventoryCondition
  | TrafficSourceCondition
  | SessionCondition
  | CollectionCondition
  | ProductCondition
  | ABTestCondition;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Create an empty condition group
 */
export function createConditionGroup(operator: LogicalOperator = "AND"): ConditionGroup {
  return {
    operator,
    conditions: [],
  };
}

/**
 * Check if a condition is a group
 */
export function isConditionGroup(
  condition: Condition | ConditionGroup
): condition is ConditionGroup {
  return "operator" in condition && "conditions" in condition;
}

/**
 * Get display name for a condition type
 */
export function getConditionTypeLabel(type: ConditionType): string {
  const labels: Record<ConditionType, string> = {
    variant: "Selected Variant",
    url: "URL / Page",
    device: "Device",
    customer: "Customer",
    time: "Date / Time",
    geo: "Location",
    inventory: "Inventory",
    traffic_source: "Traffic Source",
    session: "Session",
    collection: "Collection",
    product: "Product",
    ab_test: "A/B Test",
  };
  return labels[type];
}

/**
 * Get available operators for a condition type and field
 */
export function getOperatorsForCondition(
  type: ConditionType,
  field?: string
): Array<{ value: string; label: string }> {
  const stringOps = [
    { value: "equals", label: "equals" },
    { value: "not_equals", label: "does not equal" },
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "does not contain" },
    { value: "starts_with", label: "starts with" },
    { value: "ends_with", label: "ends with" },
    { value: "in_list", label: "is one of" },
    { value: "not_in_list", label: "is not one of" },
  ];

  const numberOps = [
    { value: "equals", label: "equals" },
    { value: "not_equals", label: "does not equal" },
    { value: "greater_than", label: "is greater than" },
    { value: "greater_than_or_equals", label: "is at least" },
    { value: "less_than", label: "is less than" },
    { value: "less_than_or_equals", label: "is at most" },
    { value: "between", label: "is between" },
  ];

  const booleanOps = [
    { value: "is_true", label: "is true" },
    { value: "is_false", label: "is false" },
  ];

  const listOps = [
    { value: "contains", label: "contains" },
    { value: "not_contains", label: "does not contain" },
    { value: "contains_any", label: "contains any of" },
    { value: "contains_all", label: "contains all of" },
    { value: "is_empty", label: "is empty" },
    { value: "is_not_empty", label: "is not empty" },
  ];

  // Map based on type and field
  switch (type) {
    case "variant":
      return stringOps;
    case "url":
      return stringOps;
    case "device":
      if (field === "type") return stringOps.slice(0, 4);
      if (field === "touch_enabled") return booleanOps;
      return numberOps;
    case "customer":
      if (field === "is_logged_in" || field === "has_account") return booleanOps;
      if (field === "tags") return listOps;
      if (field === "order_count" || field === "total_spent") return numberOps;
      return stringOps;
    case "time":
      if (field === "day_of_week" || field === "hour") return numberOps;
      return [
        { value: "before", label: "is before" },
        { value: "after", label: "is after" },
        { value: "on", label: "is on" },
        { value: "between", label: "is between" },
      ];
    case "geo":
      return stringOps.filter((op) =>
        ["equals", "not_equals", "in_list", "not_in_list"].includes(op.value)
      );
    case "inventory":
      if (field === "in_stock") return booleanOps;
      return numberOps;
    case "traffic_source":
      return stringOps;
    case "session":
      if (field === "is_first_visit") return booleanOps;
      if (field === "viewed_products" || field === "viewed_collections") return listOps;
      return numberOps;
    case "collection":
    case "product":
      if (field === "tags") return listOps;
      return stringOps;
    case "ab_test":
      return []; // A/B test uses bucket range, not operators
    default:
      return stringOps;
  }
}

/**
 * Get available fields for a condition type
 */
export function getFieldsForConditionType(
  type: ConditionType
): Array<{ value: string; label: string }> {
  switch (type) {
    case "variant":
      return [
        { value: "option_value", label: "Option Value" },
        { value: "option_name", label: "Option Name" },
      ];
    case "url":
      return [
        { value: "path", label: "Page Path" },
        { value: "referrer", label: "Referrer" },
        { value: "param", label: "URL Parameter" },
        { value: "full_url", label: "Full URL" },
        { value: "host", label: "Host" },
      ];
    case "device":
      return [
        { value: "type", label: "Device Type" },
        { value: "screen_width", label: "Screen Width" },
        { value: "touch_enabled", label: "Touch Enabled" },
      ];
    case "customer":
      return [
        { value: "is_logged_in", label: "Is Logged In" },
        { value: "tags", label: "Customer Tags" },
        { value: "order_count", label: "Order Count" },
        { value: "total_spent", label: "Total Spent" },
        { value: "email_domain", label: "Email Domain" },
        { value: "has_account", label: "Has Account" },
      ];
    case "time":
      return [
        { value: "date", label: "Date" },
        { value: "datetime", label: "Date & Time" },
        { value: "day_of_week", label: "Day of Week" },
        { value: "hour", label: "Hour of Day" },
      ];
    case "geo":
      return [
        { value: "country", label: "Country" },
        { value: "region", label: "Region/State" },
        { value: "city", label: "City" },
        { value: "continent", label: "Continent" },
      ];
    case "inventory":
      return [
        { value: "total_quantity", label: "Total Quantity" },
        { value: "variant_quantity", label: "Variant Quantity" },
        { value: "in_stock", label: "In Stock" },
      ];
    case "traffic_source":
      return [
        { value: "utm_source", label: "UTM Source" },
        { value: "utm_medium", label: "UTM Medium" },
        { value: "utm_campaign", label: "UTM Campaign" },
        { value: "utm_content", label: "UTM Content" },
        { value: "referrer", label: "Referrer" },
      ];
    case "session":
      return [
        { value: "is_first_visit", label: "Is First Visit" },
        { value: "page_views", label: "Page Views" },
        { value: "duration_seconds", label: "Session Duration" },
        { value: "viewed_products", label: "Viewed Products" },
        { value: "viewed_collections", label: "Viewed Collections" },
      ];
    case "collection":
      return [
        { value: "id", label: "Collection ID" },
        { value: "handle", label: "Handle" },
        { value: "title", label: "Title" },
        { value: "tags", label: "Tags" },
      ];
    case "product":
      return [
        { value: "id", label: "Product ID" },
        { value: "handle", label: "Handle" },
        { value: "product_type", label: "Product Type" },
        { value: "vendor", label: "Vendor" },
        { value: "tags", label: "Tags" },
      ];
    case "ab_test":
      return [];
    default:
      return [];
  }
}

/**
 * Create a default condition for a given type
 */
export function createDefaultCondition(type: ConditionType): Condition {
  switch (type) {
    case "variant":
      return { type: "variant", operator: "equals", value: "" };
    case "url":
      return { type: "url", field: "path", operator: "contains", value: "" };
    case "device":
      return { type: "device", field: "type", operator: "equals", value: "mobile" };
    case "customer":
      return { type: "customer", field: "is_logged_in", operator: "is_true", value: true };
    case "time":
      return { type: "time", field: "date", operator: "between", value: "" };
    case "geo":
      return { type: "geo", field: "country", operator: "equals", value: "" };
    case "inventory":
      return { type: "inventory", field: "total_quantity", operator: "less_than", value: 10 };
    case "traffic_source":
      return {
        type: "traffic_source",
        field: "utm_source",
        operator: "equals",
        value: "",
      };
    case "session":
      return { type: "session", field: "is_first_visit", operator: "is_true", value: true };
    case "collection":
      return { type: "collection", field: "handle", operator: "equals", value: "" };
    case "product":
      return { type: "product", field: "product_type", operator: "equals", value: "" };
    case "ab_test":
      return { type: "ab_test", testId: "test_1", bucketMin: 0, bucketMax: 49 };
    default:
      return { type: "variant", operator: "equals", value: "" };
  }
}
