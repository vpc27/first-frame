/**
 * Type definitions for the Variant Image Mapping System (PGP-F1.5)
 *
 * This system allows merchants to assign multiple images per variant,
 * with AI auto-detection and manual override capabilities.
 */

// =============================================================================
// CORE MAPPING TYPES
// =============================================================================

/**
 * How an image was mapped to variants
 */
export type MappingSource = "manual" | "ai" | "filename" | "import";

/**
 * Fallback behavior when a variant has no mapped images
 */
export type FallbackBehavior = "show_all" | "show_universal" | "show_none";

/**
 * Match mode for variant option matching
 * - "any": Image shows if ANY selected option matches
 * - "all": Image shows only if ALL selected options match
 */
export type MatchMode = "any" | "all";

/**
 * Who/what last updated the mapping
 */
export type UpdatedBy = "manual" | "ai" | "filename" | "import";

/**
 * Settings for how variant filtering should behave
 */
export interface MappingSettings {
  /** What to show when variant has no mapped images */
  fallback: FallbackBehavior;
  /** How to match multi-option variants */
  match_mode: MatchMode;
  /** Whether custom ordering is enabled per variant */
  custom_ordering: boolean;
}

/**
 * Mapping configuration for a single image
 */
export interface ImageMapping {
  /** Option values this image is mapped to (e.g., ["Red", "Large"]) */
  variants: string[];
  /** If true, image is shown for ALL variants */
  universal: boolean;
  /** Display order within the variant's image set */
  position: number;
  /** How this mapping was created */
  source: MappingSource;
  /** AI confidence score (0-1) if source is "ai", null otherwise */
  confidence: number | null;
  /** ISO timestamp when this mapping was created/updated */
  mapped_at: string;
  /** Image tags for rules engine matching (e.g., ["hero", "lifestyle"]) */
  tags?: string[];
}

/**
 * Complete variant image mapping for a product
 * Stored in product metafield: product_gallery_pro.variant_image_map
 */
export interface VariantImageMap {
  /** Schema version for future migrations */
  version: 1;
  /** ISO timestamp of last update */
  updated_at: string;
  /** How the mapping was last updated */
  updated_by: UpdatedBy;
  /** Map of media ID -> image mapping configuration */
  mappings: Record<string, ImageMapping>;
  /** Global settings for this product's mapping */
  settings: MappingSettings;
}

// =============================================================================
// API REQUEST/RESPONSE TYPES
// =============================================================================

/**
 * Product media item from Shopify GraphQL
 */
export interface ProductMedia {
  id: string;
  alt: string | null;
  mediaContentType?: "IMAGE" | "VIDEO" | "EXTERNAL_VIDEO" | "MODEL_3D";
  image: {
    url: string;
    altText: string | null;
  } | null;
  preview?: {
    image: {
      url: string;
      altText: string | null;
    } | null;
  } | null;
}

/**
 * Product variant from Shopify GraphQL
 */
export interface ProductVariant {
  id: string;
  title: string;
  selectedOptions: Array<{
    name: string;
    value: string;
  }>;
  image: {
    url: string;
  } | null;
}

/**
 * Full product data for mapping editor
 */
export interface ProductForMapping {
  id: string;
  title: string;
  handle: string;
  productType: string | null;
  vendor: string;
  media: ProductMedia[];
  variants: ProductVariant[];
}

/**
 * Response from GET /api/variant-mapping
 */
export interface VariantMappingLoadResponse {
  product: ProductForMapping;
  mapping: VariantImageMap | null;
  hasExistingMapping: boolean;
}

/**
 * Request body for POST /api/variant-mapping
 */
export interface VariantMappingSaveRequest {
  productId: string;
  mapping: VariantImageMap;
}

/**
 * Response from POST /api/variant-mapping
 */
export interface VariantMappingSaveResponse {
  success: boolean;
  mapping: VariantImageMap;
}

// =============================================================================
// AI DETECTION TYPES
// =============================================================================

/**
 * AI detection result for a single image
 */
export interface AIDetectionResult {
  mediaId: string;
  detectedVariants: string[];
  confidence: number;
  reasoning: string | null;
}

/**
 * Request for AI variant detection
 */
export interface AIDetectionRequest {
  productId: string;
  /** Optional: only detect for specific media IDs */
  mediaIds?: string[];
}

/**
 * Response from AI detection API
 */
export interface AIDetectionResponse {
  success: boolean;
  results: AIDetectionResult[];
  totalProcessed: number;
  totalMatched: number;
  processingTime: number;
  error?: string;
}

/**
 * Progress update during AI detection (for streaming)
 */
export interface AIDetectionProgress {
  current: number;
  total: number;
  currentMediaId: string;
  status: "processing" | "completed" | "error";
}

// =============================================================================
// UI STATE TYPES
// =============================================================================

/**
 * Summary of mapping for display in UI
 */
export interface MappingSummary {
  totalImages: number;
  mappedImages: number;
  universalImages: number;
  unmappedImages: number;
  variantCounts: Record<string, number>; // variant option value -> image count
  warnings: MappingWarning[];
}

/**
 * Warning about potential mapping issues
 */
export interface MappingWarning {
  type: "no_images" | "low_confidence" | "duplicate" | "unmapped";
  variantValue?: string;
  mediaId?: string;
  message: string;
}

/**
 * State for the mapping editor UI
 */
export interface MappingEditorState {
  product: ProductForMapping | null;
  mapping: VariantImageMap;
  originalMapping: VariantImageMap | null;
  isDirty: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

// =============================================================================
// UTILITY TYPES
// =============================================================================

/**
 * Extract unique variant option values from product variants
 */
export interface VariantOptions {
  /** Option name (e.g., "Color", "Size") */
  name: string;
  /** All possible values for this option */
  values: string[];
}

/**
 * Default mapping settings
 */
export const DEFAULT_MAPPING_SETTINGS: MappingSettings = {
  fallback: "show_all",
  match_mode: "any",
  custom_ordering: false,
};

/**
 * Create an empty mapping structure
 */
export function createEmptyMapping(): VariantImageMap {
  return {
    version: 1,
    updated_at: new Date().toISOString(),
    updated_by: "manual",
    mappings: {},
    settings: { ...DEFAULT_MAPPING_SETTINGS },
  };
}

/**
 * Extract unique variant options from product variants.
 * This is a pure function safe for client and server use.
 */
export function extractVariantOptions(
  variants: ProductVariant[]
): VariantOptions[] {
  const optionsMap = new Map<string, Set<string>>();

  for (const variant of variants) {
    for (const option of variant.selectedOptions) {
      if (!optionsMap.has(option.name)) {
        optionsMap.set(option.name, new Set());
      }
      optionsMap.get(option.name)!.add(option.value);
    }
  }

  return Array.from(optionsMap.entries()).map(([name, values]) => ({
    name,
    values: Array.from(values).sort(),
  }));
}

/**
 * Create an empty image mapping
 */
export function createEmptyImageMapping(
  source: MappingSource = "manual"
): ImageMapping {
  return {
    variants: [],
    universal: false,
    position: 0,
    source,
    confidence: null,
    mapped_at: new Date().toISOString(),
    tags: [],
  };
}
