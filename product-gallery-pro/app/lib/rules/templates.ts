/**
 * Pre-built Rule Templates (PGP-F2.0)
 *
 * 8 starter templates for common use cases:
 * 1. Variant Image Filtering - Show images for selected variant
 * 2. Mobile Optimization - Limit to 5 images on mobile
 * 3. Instagram Traffic - Lifestyle images first
 * 4. Sale Badge - Add "SALE" badge during date range
 * 5. VIP Customer - Show exclusive images to VIP tags
 * 6. Low Stock Alert - "Only X left!" badge
 * 7. A/B Test Hero - Different hero for 50% traffic
 * 8. Regional Images - Different images by country
 */

import type { Rule } from "~/types/rules";
import { generateRuleId, createEmptyRule } from "~/types/rules";
import type { ConditionGroup } from "~/types/rules-conditions";
import type { Action } from "~/types/rules-actions";

// =============================================================================
// TEMPLATE INTERFACE
// =============================================================================

export interface RuleTemplate {
  /** Template identifier */
  id: string;

  /** Display name */
  name: string;

  /** Short description */
  description: string;

  /** Detailed explanation */
  details: string;

  /** Category for grouping */
  category: TemplateCategory;

  /** Icon name for display */
  icon: string;

  /** Example use cases */
  useCases: string[];

  /** The pre-configured rule */
  rule: Omit<Rule, "id" | "createdAt" | "updatedAt">;

  /** Configuration options the user should fill in */
  configOptions: TemplateConfigOption[];
}

export type TemplateCategory =
  | "variant"
  | "mobile"
  | "traffic"
  | "promotion"
  | "customer"
  | "inventory"
  | "testing"
  | "regional";

export interface TemplateConfigOption {
  /** Field path in the rule (e.g., "conditions.conditions[0].value") */
  path: string;

  /** Display label */
  label: string;

  /** Input type */
  type: "text" | "number" | "date" | "select" | "multiselect" | "tags";

  /** Placeholder text */
  placeholder?: string;

  /** Default value */
  defaultValue?: string | number | string[];

  /** Options for select/multiselect */
  options?: Array<{ value: string; label: string }>;

  /** Help text */
  helpText?: string;

  /** Whether this field is required */
  required?: boolean;
}

// =============================================================================
// TEMPLATE DEFINITIONS
// =============================================================================

export const ruleTemplates: RuleTemplate[] = [
  // =========================================================================
  // 1. VARIANT IMAGE FILTERING
  // =========================================================================
  {
    id: "variant-filtering",
    name: "Variant Image Filtering",
    description: "Show images for selected variant",
    details:
      "When a customer selects a variant (e.g., 'Red'), only show images tagged with that variant value. Universal images always show.",
    category: "variant",
    icon: "ColorSwatchIcon",
    useCases: [
      "Show color-specific product photos",
      "Display size-appropriate lifestyle images",
      "Material or finish-specific galleries",
    ],
    rule: {
      name: "Variant Image Filtering",
      description: "Show images matching the selected variant option",
      scope: "shop",
      conditions: {
        operator: "AND",
        conditions: [
          {
            type: "variant",
            operator: "equals",
            value: "", // User fills in
            optionName: "Color", // User can change
          },
        ],
      },
      actions: [
        {
          type: "filter",
          mode: "include",
          matchType: "variant_value",
          matchValues: [], // Auto-populated from selected variant
          matchMode: "any",
        },
      ],
      priority: 10,
      stopProcessing: false,
      status: "active",
    },
    configOptions: [
      {
        path: "conditions.conditions[0].optionName",
        label: "Option Name",
        type: "text",
        placeholder: "e.g., Color, Size, Material",
        defaultValue: "Color",
        helpText: "The variant option to filter by",
        required: true,
      },
    ],
  },

  // =========================================================================
  // 2. MOBILE OPTIMIZATION
  // =========================================================================
  {
    id: "mobile-optimization",
    name: "Mobile Optimization",
    description: "Limit images on mobile for faster loading",
    details:
      "Reduce the number of gallery images on mobile devices to improve page load time and user experience.",
    category: "mobile",
    icon: "DeviceMobileIcon",
    useCases: [
      "Speed up mobile page loads",
      "Reduce data usage for customers",
      "Improve mobile conversion rates",
    ],
    rule: {
      name: "Mobile Gallery Optimization",
      description: "Show maximum 5 images on mobile devices",
      scope: "shop",
      conditions: {
        operator: "AND",
        conditions: [
          {
            type: "device",
            field: "type",
            operator: "equals",
            value: "mobile",
          },
        ],
      },
      actions: [
        {
          type: "limit",
          maxImages: 5,
          keep: "first",
          alwaysIncludeFirst: true,
        },
      ],
      priority: 20,
      stopProcessing: false,
      status: "active",
    },
    configOptions: [
      {
        path: "actions[0].maxImages",
        label: "Maximum Images",
        type: "number",
        defaultValue: 5,
        helpText: "How many images to show on mobile",
        required: true,
      },
    ],
  },

  // =========================================================================
  // 3. TRAFFIC SOURCE GALLERY (generic)
  // =========================================================================
  {
    id: "traffic-source-gallery",
    name: "Traffic Source Gallery",
    description: "Prioritize specific images based on traffic source (UTM)",
    details:
      "When visitors arrive from a specific traffic source (e.g., Instagram, Facebook, Google, TikTok), prioritize images tagged for that audience. Works with UTM parameters and referrer detection.",
    category: "traffic",
    icon: "CameraIcon",
    useCases: [
      "Optimize for social media referrals",
      "Show influencer content first",
      "Match visitor expectations from any traffic source",
    ],
    rule: {
      name: "Traffic Source Gallery",
      description: "Prioritize tagged images for visitors from a specific traffic source",
      scope: "shop",
      conditions: {
        operator: "OR",
        conditions: [
          {
            type: "traffic_source",
            field: "utm_source",
            operator: "equals",
            value: "instagram",
          },
          {
            type: "url",
            field: "referrer",
            operator: "contains",
            value: "instagram.com",
          },
        ],
      },
      actions: [
        {
          type: "prioritize",
          strategy: "boost_to_front",
          matchType: "media_tag",
          matchValues: ["lifestyle", "ugc", "social"],
        },
      ],
      priority: 15,
      stopProcessing: false,
      status: "active",
    },
    configOptions: [
      {
        path: "conditions.conditions[0].value",
        label: "UTM Source",
        type: "text",
        placeholder: "e.g. instagram, facebook, google, tiktok",
        defaultValue: "instagram",
        helpText: "The utm_source parameter value to match",
        required: true,
      },
      {
        path: "conditions.conditions[1].value",
        label: "Referrer Domain (optional)",
        type: "text",
        placeholder: "e.g. instagram.com, facebook.com",
        defaultValue: "instagram.com",
        helpText: "Also match visitors from this referrer domain",
      },
      {
        path: "actions[0].matchValues",
        label: "Image Tags to Prioritize",
        type: "tags",
        defaultValue: ["lifestyle", "ugc", "social"],
        helpText: "Select tags for images that should appear first for this traffic source",
        required: true,
      },
      {
        path: "actions[0].type",
        label: "Behavior",
        type: "select",
        defaultValue: "prioritize",
        options: [
          { value: "prioritize", label: "Prioritize tagged images (show first)" },
          { value: "filter", label: "Show only tagged images" },
        ],
        helpText: "Prioritize keeps all images but shows tagged ones first. Filter hides non-tagged images.",
        required: true,
      },
    ],
  },

  // =========================================================================
  // 4. SALE BADGE
  // =========================================================================
  {
    id: "sale-badge",
    name: "Sale Badge",
    description: "Add SALE badge during promotional period",
    details:
      "Display a prominent 'SALE' badge on the first image during a specified date range. Perfect for Black Friday, seasonal sales, or flash promotions.",
    category: "promotion",
    icon: "TagIcon",
    useCases: [
      "Black Friday / Cyber Monday sales",
      "Seasonal clearance events",
      "Flash sales and limited-time offers",
    ],
    rule: {
      name: "Sale Badge",
      description: "Show SALE badge during promotional period",
      scope: "shop",
      conditions: {
        operator: "AND",
        conditions: [
          {
            type: "time",
            field: "date",
            operator: "between",
            value: new Date().toISOString().split("T")[0],
            valueEnd: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
              .toISOString()
              .split("T")[0],
          },
        ],
      },
      actions: [
        {
          type: "badge",
          text: "SALE",
          position: "top-right",
          style: "danger",
          target: "first",
          icon: "tag",
        },
      ],
      priority: 5,
      stopProcessing: false,
      status: "draft", // Start as draft so user sets dates
    },
    configOptions: [
      {
        path: "conditions.conditions[0].value",
        label: "Start Date",
        type: "date",
        helpText: "When the sale starts",
        required: true,
      },
      {
        path: "conditions.conditions[0].valueEnd",
        label: "End Date",
        type: "date",
        helpText: "When the sale ends",
        required: true,
      },
      {
        path: "actions[0].text",
        label: "Badge Text",
        type: "text",
        defaultValue: "SALE",
        helpText: "Text to display on the badge",
        required: true,
      },
    ],
  },

  // =========================================================================
  // 5. VIP CUSTOMER
  // =========================================================================
  {
    id: "vip-customer",
    name: "VIP Customer",
    description: "Show exclusive images to VIP customers",
    details:
      "Customers tagged as 'VIP' see exclusive product images not shown to regular visitors. Great for loyalty rewards or wholesale customers.",
    category: "customer",
    icon: "StarIcon",
    useCases: [
      "Exclusive content for loyal customers",
      "Wholesale-specific product views",
      "Early access previews",
    ],
    rule: {
      name: "VIP Customer Gallery",
      description: "Show exclusive images to VIP tagged customers",
      scope: "shop",
      conditions: {
        operator: "AND",
        conditions: [
          {
            type: "customer",
            field: "is_logged_in",
            operator: "is_true",
            value: true,
          },
          {
            type: "customer",
            field: "tags",
            operator: "contains",
            value: ["VIP"],
          },
        ],
      },
      actions: [
        {
          type: "filter",
          mode: "include",
          matchType: "media_tag",
          matchValues: ["vip", "exclusive"],
        },
        {
          type: "badge",
          text: "VIP EXCLUSIVE",
          position: "top-left",
          style: "primary",
          target: "matched",
          matchType: "media_tag",
          matchValues: ["exclusive"],
          icon: "star",
        },
      ],
      priority: 8,
      stopProcessing: false,
      status: "active",
    },
    configOptions: [
      {
        path: "conditions.conditions[1].value",
        label: "Customer Tags",
        type: "tags",
        defaultValue: ["VIP"],
        helpText: "Customer tags that qualify for exclusive content",
        required: true,
      },
      {
        path: "actions[0].matchValues",
        label: "Exclusive Image Tags",
        type: "tags",
        defaultValue: ["vip", "exclusive"],
        helpText: "Tags on images to show to VIP customers",
        required: true,
      },
    ],
  },

  // =========================================================================
  // 6. LOW STOCK ALERT
  // =========================================================================
  {
    id: "low-stock-alert",
    name: "Low Stock Alert",
    description: 'Add "Only X left!" urgency badge',
    details:
      "When inventory drops below a threshold, display an urgency badge showing the remaining stock. Creates FOMO and encourages faster purchasing.",
    category: "inventory",
    icon: "ExclamationCircleIcon",
    useCases: [
      "Create urgency for low stock items",
      "Reduce cart abandonment",
      "Drive faster purchase decisions",
    ],
    rule: {
      name: "Low Stock Alert Badge",
      description: 'Show "Only X left!" when stock is low',
      scope: "shop",
      conditions: {
        operator: "AND",
        conditions: [
          {
            type: "inventory",
            field: "total_quantity",
            operator: "less_than",
            value: 10,
          },
          {
            type: "inventory",
            field: "in_stock",
            operator: "is_true",
            value: true,
          },
        ],
      },
      actions: [
        {
          type: "badge",
          text: "Only {{count}} left!",
          position: "bottom-left",
          style: "warning",
          target: "first",
          icon: "alert",
          dynamicValues: {
            inventoryCount: true,
          },
        },
      ],
      priority: 3,
      stopProcessing: false,
      status: "active",
    },
    configOptions: [
      {
        path: "conditions.conditions[0].value",
        label: "Stock Threshold",
        type: "number",
        defaultValue: 10,
        helpText: "Show badge when stock is below this number",
        required: true,
      },
      {
        path: "actions[0].text",
        label: "Badge Text",
        type: "text",
        defaultValue: "Only {{count}} left!",
        helpText: "Use {{count}} for dynamic inventory number",
        required: true,
      },
    ],
  },

  // =========================================================================
  // 7. A/B TEST HERO
  // =========================================================================
  {
    id: "ab-test-hero",
    name: "A/B Test Hero",
    description: "Test different hero images for 50% of traffic",
    details:
      "Split traffic to test which hero image performs better. 50% see the original, 50% see lifestyle images first. Use with analytics to measure impact.",
    category: "testing",
    icon: "BeakerIcon",
    useCases: [
      "Test product shot vs lifestyle hero",
      "Compare UGC vs professional photos",
      "Optimize for conversion",
    ],
    rule: {
      name: "A/B Test: Lifestyle Hero",
      description: "Show lifestyle images first for 50% of visitors",
      scope: "shop",
      conditions: {
        operator: "AND",
        conditions: [
          {
            type: "ab_test",
            testId: "hero_image_test",
            bucketMin: 0,
            bucketMax: 49,
          },
        ],
      },
      actions: [
        {
          type: "prioritize",
          strategy: "boost_to_front",
          matchType: "media_tag",
          matchValues: ["lifestyle"],
        },
      ],
      priority: 25,
      stopProcessing: false,
      status: "active",
      tags: ["ab-test", "hero_image_test"],
    },
    configOptions: [
      {
        path: "conditions.conditions[0].testId",
        label: "Test ID",
        type: "text",
        defaultValue: "hero_image_test",
        helpText: "Unique identifier for this A/B test",
        required: true,
      },
      {
        path: "conditions.conditions[0].bucketMax",
        label: "Traffic Percentage",
        type: "select",
        defaultValue: "49",
        options: [
          { value: "9", label: "10%" },
          { value: "24", label: "25%" },
          { value: "49", label: "50%" },
          { value: "74", label: "75%" },
          { value: "89", label: "90%" },
        ],
        helpText: "Percentage of traffic to show variant B",
        required: true,
      },
      {
        path: "actions[0].matchValues",
        label: "Images to Prioritize (Variant B)",
        type: "tags",
        defaultValue: ["lifestyle"],
        helpText: "Image tags to show first in the test variant",
        required: true,
      },
    ],
  },

  // =========================================================================
  // 8. REGIONAL IMAGES
  // =========================================================================
  {
    id: "regional-images",
    name: "Regional Images",
    description: "Show different images by country",
    details:
      "Display region-specific images based on visitor location. Perfect for showing local models, regional packaging, or culturally appropriate content.",
    category: "regional",
    icon: "GlobeIcon",
    useCases: [
      "Show local models for different markets",
      "Display regional packaging differences",
      "Culturally appropriate product presentation",
    ],
    rule: {
      name: "Regional Images - US Market",
      description: "Show US-specific images for US visitors",
      scope: "shop",
      conditions: {
        operator: "AND",
        conditions: [
          {
            type: "geo",
            field: "country",
            operator: "in_list",
            value: ["US", "CA"],
          },
        ],
      },
      actions: [
        {
          type: "prioritize",
          strategy: "boost_to_front",
          matchType: "media_tag",
          matchValues: ["us", "north-america"],
        },
      ],
      priority: 12,
      stopProcessing: false,
      status: "active",
    },
    configOptions: [
      {
        path: "conditions.conditions[0].value",
        label: "Countries",
        type: "tags",
        defaultValue: ["US", "CA"],
        helpText: "ISO country codes (e.g., US, CA, GB, DE)",
        required: true,
      },
      {
        path: "actions[0].matchValues",
        label: "Regional Image Tags",
        type: "tags",
        defaultValue: ["us", "north-america"],
        helpText: "Tags on images to prioritize for this region",
        required: true,
      },
    ],
  },
];

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get all templates
 */
export function getAllTemplates(): RuleTemplate[] {
  return ruleTemplates;
}

/**
 * Get template by ID
 */
export function getTemplateById(id: string): RuleTemplate | undefined {
  // Support legacy "instagram-traffic" alias
  const lookupId = id === "instagram-traffic" ? "traffic-source-gallery" : id;
  return ruleTemplates.find((t) => t.id === lookupId);
}

/**
 * Get templates by category
 */
export function getTemplatesByCategory(category: TemplateCategory): RuleTemplate[] {
  return ruleTemplates.filter((t) => t.category === category);
}

/**
 * Get all template categories with counts
 */
export function getTemplateCategories(): Array<{
  category: TemplateCategory;
  label: string;
  count: number;
}> {
  const categoryLabels: Record<TemplateCategory, string> = {
    variant: "Variant Filtering",
    mobile: "Mobile Optimization",
    traffic: "Traffic Source",
    promotion: "Promotions",
    customer: "Customer Segments",
    inventory: "Inventory",
    testing: "A/B Testing",
    regional: "Regional",
  };

  const counts = new Map<TemplateCategory, number>();
  ruleTemplates.forEach((t) => {
    counts.set(t.category, (counts.get(t.category) || 0) + 1);
  });

  return Object.entries(categoryLabels).map(([category, label]) => ({
    category: category as TemplateCategory,
    label,
    count: counts.get(category as TemplateCategory) || 0,
  }));
}

/**
 * Create a rule from a template
 */
export function createRuleFromTemplate(
  templateId: string,
  config?: Record<string, unknown>
): Rule {
  const template = getTemplateById(templateId);
  if (!template) {
    throw new Error(`Template not found: ${templateId}`);
  }

  const now = new Date().toISOString();
  const rule: Rule = {
    id: generateRuleId(),
    ...JSON.parse(JSON.stringify(template.rule)),
    createdAt: now,
    updatedAt: now,
    templateId,
  };

  // Apply configuration overrides
  if (config) {
    applyConfig(rule, config, template.configOptions);
  }

  // Post-processing: if traffic source template action was changed to "filter",
  // set the correct filter action structure
  if (templateId === "traffic-source-gallery" && rule.actions[0]) {
    const action = rule.actions[0] as unknown as Record<string, unknown>;
    if (action.type === "filter") {
      action.mode = "include";
      delete action.strategy;
    }
  }

  return rule;
}

/**
 * Apply configuration to a rule
 */
function applyConfig(
  rule: Rule,
  config: Record<string, unknown>,
  configOptions: TemplateConfigOption[]
): void {
  for (const option of configOptions) {
    if (config[option.path] !== undefined) {
      setNestedValue(rule as unknown as Record<string, unknown>, option.path, config[option.path]);
    }
  }
}

/**
 * Set a value at a nested path
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split(/[.[\]]+/).filter(Boolean);
  let current: Record<string, unknown> = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    const isNextArray = !isNaN(parseInt(nextPart, 10));

    if (current[part] === undefined) {
      current[part] = isNextArray ? [] : {};
    }

    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

/**
 * Get a value at a nested path
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(/[.[\]]+/).filter(Boolean);
  let current: unknown = obj;

  for (const part of parts) {
    if (current === undefined || current === null) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Validate template configuration
 */
export function validateTemplateConfig(
  templateId: string,
  config: Record<string, unknown>
): { valid: boolean; errors: string[] } {
  const template = getTemplateById(templateId);
  if (!template) {
    return { valid: false, errors: [`Template not found: ${templateId}`] };
  }

  const errors: string[] = [];

  for (const option of template.configOptions) {
    if (option.required && (config[option.path] === undefined || config[option.path] === "")) {
      errors.push(`${option.label} is required`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
