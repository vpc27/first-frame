/**
 * Gallery Rules Engine - Action Types (PGP-F2.0)
 *
 * Defines all 6 action types that cover the needs:
 * - filter: Show/hide images based on tags or criteria
 * - reorder: Change image order
 * - badge: Add visual overlays (sale, low stock, etc.)
 * - limit: Reduce image count (mobile optimization)
 * - prioritize: Boost certain images to front
 * - replace: Completely swap gallery content
 */

// =============================================================================
// ACTION TYPES
// =============================================================================

/**
 * All available action types
 */
export type ActionType = "filter" | "reorder" | "badge" | "limit" | "prioritize" | "replace";

// =============================================================================
// BASE ACTION INTERFACE
// =============================================================================

/**
 * Base interface for all actions
 */
export interface BaseAction {
  /** Action type discriminator */
  type: ActionType;

  /** Optional ID for tracking which action was applied */
  id?: string;
}

// =============================================================================
// FILTER ACTION
// =============================================================================

/**
 * Filter mode - include or exclude matching images
 */
export type FilterMode = "include" | "exclude";

/**
 * How to match images for filtering
 */
export type FilterMatchType =
  | "media_tag"
  | "variant_value"
  | "media_type"
  | "position"
  | "alt_text"
  | "universal";

/**
 * Filter action - show or hide specific images
 *
 * Use cases:
 * - Show only images tagged "red" when Red variant selected
 * - Exclude video on mobile
 * - Show only images with specific alt text
 */
export interface FilterAction extends BaseAction {
  type: "filter";

  /** Whether to include or exclude matching images */
  mode: FilterMode;

  /** How to identify which images to filter */
  matchType: FilterMatchType;

  /** Values to match against (tags, variant values, etc.) */
  matchValues: string[];

  /** For position matching: specific positions to filter */
  positions?: number[];

  /** For media_type: which types to match */
  mediaTypes?: Array<"image" | "video" | "external_video" | "model_3d">;

  /** For variant_value matching: which option name to check */
  optionName?: string;

  /** Match mode for variant values: any match or all must match */
  matchMode?: "any" | "all";
}

// =============================================================================
// REORDER ACTION
// =============================================================================

/**
 * Reorder strategy
 */
export type ReorderStrategy =
  | "move_to_front"
  | "move_to_back"
  | "move_to_position"
  | "shuffle"
  | "reverse"
  | "sort_by_tag_order";

/**
 * Reorder action - change image order
 *
 * Use cases:
 * - Move lifestyle images to front for Instagram traffic
 * - Put video first or last
 * - Custom sorting for campaigns
 */
export interface ReorderAction extends BaseAction {
  type: "reorder";

  /** Reordering strategy */
  strategy: ReorderStrategy;

  /** How to identify images to move */
  matchType?: FilterMatchType;

  /** Values to match for identifying images */
  matchValues?: string[];

  /** Target position (for move_to_position) */
  position?: number;

  /** Tag order for sort_by_tag_order */
  tagOrder?: string[];

  /** Whether to preserve relative order of matched items */
  preserveRelativeOrder?: boolean;
}

// =============================================================================
// BADGE ACTION
// =============================================================================

/**
 * Badge position on the image
 */
export type BadgePosition = "top-left" | "top-right" | "bottom-left" | "bottom-right" | "center";

/**
 * Badge style preset
 */
export type BadgeStyle =
  | "primary"
  | "secondary"
  | "success"
  | "warning"
  | "danger"
  | "info"
  | "custom";

/**
 * Badge target - which images to add badge to
 */
export type BadgeTarget = "all" | "first" | "last" | "matched" | "positions";

/**
 * Badge action - add visual overlay to images
 *
 * Use cases:
 * - "SALE" badge during promotions
 * - "Only 3 left!" low stock alert
 * - "NEW" badge for recent items
 * - "VIP" exclusive indicator
 */
export interface BadgeAction extends BaseAction {
  type: "badge";

  /** Badge text - can include dynamic placeholders */
  text: string;

  /** Where to position the badge */
  position: BadgePosition;

  /** Visual style */
  style: BadgeStyle;

  /** Which images to add badge to */
  target: BadgeTarget;

  /** Positions to add badge to (if target is "positions") */
  targetPositions?: number[];

  /** Match criteria (if target is "matched") */
  matchType?: FilterMatchType;

  /** Match values (if target is "matched") */
  matchValues?: string[];

  /** Custom background color (if style is "custom") */
  backgroundColor?: string;

  /** Custom text color (if style is "custom") */
  textColor?: string;

  /** Custom CSS class */
  customClass?: string;

  /** Icon to show before text */
  icon?: "fire" | "star" | "clock" | "tag" | "percent" | "heart" | "alert" | "check" | "none";

  /** Dynamic text placeholders */
  dynamicValues?: {
    /** Use inventory count in text (e.g., "Only {{count}} left!") */
    inventoryCount?: boolean;
    /** Use price in text */
    price?: boolean;
    /** Use discount percentage in text */
    discountPercent?: boolean;
  };
}

// =============================================================================
// LIMIT ACTION
// =============================================================================

/**
 * Which images to keep when limiting
 */
export type LimitKeep = "first" | "last" | "even_distribution" | "matched";

/**
 * Limit action - reduce total image count
 *
 * Use cases:
 * - Show max 5 images on mobile for performance
 * - Limit to 3 images for quick view modal
 * - Keep only hero images for collection grid
 */
export interface LimitAction extends BaseAction {
  type: "limit";

  /** Maximum number of images to show */
  maxImages: number;

  /** Which images to keep */
  keep: LimitKeep;

  /** Match criteria (if keep is "matched") */
  matchType?: FilterMatchType;

  /** Match values (if keep is "matched") */
  matchValues?: string[];

  /** Whether to always include the first image regardless of limit */
  alwaysIncludeFirst?: boolean;
}

// =============================================================================
// PRIORITIZE ACTION
// =============================================================================

/**
 * Prioritize strategy
 */
export type PrioritizeStrategy = "boost_to_front" | "boost_positions" | "interleave";

/**
 * Prioritize action - boost certain images without hiding others
 *
 * Use cases:
 * - UGC images first for social traffic
 * - Product shots first, lifestyle after
 * - Video content prioritized
 */
export interface PrioritizeAction extends BaseAction {
  type: "prioritize";

  /** Prioritization strategy */
  strategy: PrioritizeStrategy;

  /** How to identify images to prioritize */
  matchType: FilterMatchType;

  /** Values to match for prioritization */
  matchValues: string[];

  /** How many positions to boost (for boost_positions) */
  boostAmount?: number;

  /** How to interleave (for interleave strategy) */
  interleaveRatio?: {
    /** Number of prioritized items */
    prioritized: number;
    /** Number of regular items */
    regular: number;
  };
}

// =============================================================================
// REPLACE ACTION
// =============================================================================

/**
 * Replace source - where to get replacement images from
 */
export type ReplaceSource = "metafield" | "collection" | "static_urls" | "product_metafield";

/**
 * Replace action - completely swap gallery content
 *
 * Use cases:
 * - Campaign-specific gallery
 * - A/B test completely different images
 * - Seasonal content swap
 */
export interface ReplaceAction extends BaseAction {
  type: "replace";

  /** Where to get replacement images */
  source: ReplaceSource;

  /** Metafield namespace (if source is metafield) */
  metafieldNamespace?: string;

  /** Metafield key (if source is metafield) */
  metafieldKey?: string;

  /** Collection handle (if source is collection) */
  collectionHandle?: string;

  /** Static URLs (if source is static_urls) */
  staticUrls?: Array<{
    src: string;
    alt?: string;
    position: number;
  }>;

  /** Whether to append to existing gallery instead of replacing */
  appendMode?: boolean;

  /** Maximum images to pull from source */
  maxImages?: number;
}

// =============================================================================
// UNION TYPE
// =============================================================================

/**
 * Union of all action types
 */
export type Action =
  | FilterAction
  | ReorderAction
  | BadgeAction
  | LimitAction
  | PrioritizeAction
  | ReplaceAction;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Get display name for an action type
 */
export function getActionTypeLabel(type: ActionType): string {
  const labels: Record<ActionType, string> = {
    filter: "Filter Images",
    reorder: "Reorder Images",
    badge: "Add Badge",
    limit: "Limit Count",
    prioritize: "Prioritize Images",
    replace: "Replace Gallery",
  };
  return labels[type];
}

/**
 * Get description for an action type
 */
export function getActionTypeDescription(type: ActionType): string {
  const descriptions: Record<ActionType, string> = {
    filter: "Show or hide specific images based on tags, variants, or media type",
    reorder: "Change the order of images in the gallery",
    badge: "Add visual overlays like 'SALE' or 'Low Stock' badges",
    limit: "Reduce the total number of images shown",
    prioritize: "Boost certain images to the front without hiding others",
    replace: "Completely swap the gallery with different images",
  };
  return descriptions[type];
}

/**
 * Create a default action for a given type
 */
export function createDefaultAction(type: ActionType): Action {
  switch (type) {
    case "filter":
      return {
        type: "filter",
        mode: "include",
        matchType: "variant_value",
        matchValues: [],
        matchMode: "any",
      };
    case "reorder":
      return {
        type: "reorder",
        strategy: "move_to_front",
        matchType: "media_tag",
        matchValues: [],
        preserveRelativeOrder: true,
      };
    case "badge":
      return {
        type: "badge",
        text: "SALE",
        position: "top-right",
        style: "primary",
        target: "first",
        icon: "none",
      };
    case "limit":
      return {
        type: "limit",
        maxImages: 5,
        keep: "first",
        alwaysIncludeFirst: true,
      };
    case "prioritize":
      return {
        type: "prioritize",
        strategy: "boost_to_front",
        matchType: "media_tag",
        matchValues: [],
      };
    case "replace":
      return {
        type: "replace",
        source: "metafield",
        appendMode: false,
      };
    default:
      return {
        type: "filter",
        mode: "include",
        matchType: "variant_value",
        matchValues: [],
      };
  }
}

/**
 * Get available badge styles with colors
 */
export function getBadgeStyles(): Array<{
  value: BadgeStyle;
  label: string;
  backgroundColor: string;
  textColor: string;
}> {
  return [
    { value: "primary", label: "Primary", backgroundColor: "#5c6ac4", textColor: "#ffffff" },
    { value: "secondary", label: "Secondary", backgroundColor: "#6b7280", textColor: "#ffffff" },
    { value: "success", label: "Success", backgroundColor: "#10b981", textColor: "#ffffff" },
    { value: "warning", label: "Warning", backgroundColor: "#f59e0b", textColor: "#000000" },
    { value: "danger", label: "Danger", backgroundColor: "#ef4444", textColor: "#ffffff" },
    { value: "info", label: "Info", backgroundColor: "#3b82f6", textColor: "#ffffff" },
    { value: "custom", label: "Custom", backgroundColor: "#ffffff", textColor: "#000000" },
  ];
}

/**
 * Get available badge icons
 */
export function getBadgeIcons(): Array<{
  value: NonNullable<BadgeAction["icon"]>;
  label: string;
  emoji: string;
}> {
  return [
    { value: "none", label: "No Icon", emoji: "" },
    { value: "fire", label: "Fire", emoji: "🔥" },
    { value: "star", label: "Star", emoji: "⭐" },
    { value: "clock", label: "Clock", emoji: "⏰" },
    { value: "tag", label: "Tag", emoji: "🏷️" },
    { value: "percent", label: "Percent", emoji: "%" },
    { value: "heart", label: "Heart", emoji: "❤️" },
    { value: "alert", label: "Alert", emoji: "⚠️" },
    { value: "check", label: "Check", emoji: "✓" },
  ];
}

/**
 * Format badge text with dynamic values
 */
export function formatBadgeText(
  text: string,
  context: {
    inventoryCount?: number;
    price?: string;
    discountPercent?: number;
  }
): string {
  let result = text;

  if (context.inventoryCount !== undefined) {
    result = result.replace(/\{\{count\}\}/gi, String(context.inventoryCount));
  }

  if (context.price !== undefined) {
    result = result.replace(/\{\{price\}\}/gi, context.price);
  }

  if (context.discountPercent !== undefined) {
    result = result.replace(/\{\{discount\}\}/gi, `${context.discountPercent}%`);
  }

  return result;
}

/**
 * Validate an action
 */
export function validateAction(action: Action): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  switch (action.type) {
    case "filter":
      if (!action.matchType) {
        errors.push("Filter action requires a match type");
      }
      if (action.matchType !== "universal" && (!action.matchValues || action.matchValues.length === 0)) {
        errors.push("Filter action requires at least one match value");
      }
      break;

    case "reorder":
      if (!action.strategy) {
        errors.push("Reorder action requires a strategy");
      }
      if (action.strategy === "move_to_position" && action.position === undefined) {
        errors.push("Move to position requires a target position");
      }
      break;

    case "badge":
      if (!action.text || action.text.trim() === "") {
        errors.push("Badge action requires text");
      }
      if (!action.position) {
        errors.push("Badge action requires a position");
      }
      if (action.style === "custom" && (!action.backgroundColor || !action.textColor)) {
        errors.push("Custom badge style requires background and text colors");
      }
      break;

    case "limit":
      if (action.maxImages === undefined || action.maxImages < 1) {
        errors.push("Limit action requires a valid max images count");
      }
      break;

    case "prioritize":
      if (!action.strategy) {
        errors.push("Prioritize action requires a strategy");
      }
      if (!action.matchType || !action.matchValues || action.matchValues.length === 0) {
        errors.push("Prioritize action requires match criteria");
      }
      break;

    case "replace":
      if (!action.source) {
        errors.push("Replace action requires a source");
      }
      if (action.source === "static_urls" && (!action.staticUrls || action.staticUrls.length === 0)) {
        errors.push("Static URL replace requires at least one URL");
      }
      if (action.source === "metafield" && (!action.metafieldNamespace || !action.metafieldKey)) {
        errors.push("Metafield replace requires namespace and key");
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
