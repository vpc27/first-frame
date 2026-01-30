/**
 * Variant Image Mapping Server Module (PGP-F1.5)
 *
 * Handles loading and saving variant-to-image mappings using Shopify product metafields.
 * Mappings allow multiple images per variant with AI auto-detection support.
 */

import type {
  VariantImageMap,
  ProductForMapping,
  VariantMappingLoadResponse,
  ImageMapping,
} from "~/types/variant-mapping";
import { createEmptyMapping } from "~/types/variant-mapping";
import { toProductGid } from "./productId.server";
import { checkMetafieldSize } from "./metafieldGuard";

const NAMESPACE = "product_gallery_pro";
const KEY = "variant_image_map";
const METAFIELD_TYPE = "json";

type AdminGraphql = (
  query: string,
  options?: { variables?: Record<string, unknown> }
) => Promise<Response>;

// =============================================================================
// GRAPHQL QUERIES & MUTATIONS
// =============================================================================

/**
 * Query to get product with media, variants, and existing mapping metafield
 */
const PRODUCT_WITH_MAPPING_QUERY = `#graphql
  query ProductWithMapping($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      productType
      vendor
      media(first: 100) {
        nodes {
          mediaContentType
          alt
          preview {
            image {
              url(transform: { maxWidth: 800 })
              altText
            }
          }
          ... on MediaImage {
            id
            image {
              url(transform: { maxWidth: 800 })
              altText
            }
          }
          ... on Video {
            id
          }
          ... on ExternalVideo {
            id
          }
        }
      }
      variants(first: 100) {
        nodes {
          id
          title
          selectedOptions {
            name
            value
          }
          image {
            url(transform: { maxWidth: 200 })
          }
        }
      }
      metafield(namespace: "${NAMESPACE}", key: "${KEY}") {
        id
        value
      }
    }
  }
`;

/**
 * Mutation to set the variant image mapping metafield
 */
const METAFIELDS_SET_MUTATION = `#graphql
  mutation VariantMappingSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields {
        id
        namespace
        key
        value
      }
      userErrors {
        field
        message
        code
      }
    }
  }
`;

/**
 * Query to check if metafield definition exists
 */
const METAFIELD_DEFINITION_QUERY = `#graphql
  query MetafieldDefinitions($namespace: String!, $key: String!, $ownerType: MetafieldOwnerType!) {
    metafieldDefinitions(first: 1, namespace: $namespace, key: $key, ownerType: $ownerType) {
      nodes {
        id
        namespace
        key
      }
    }
  }
`;

/**
 * Mutation to create metafield definition for storefront access
 */
const METAFIELD_DEFINITION_CREATE = `#graphql
  mutation MetafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition {
        id
        name
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// =============================================================================
// TYPES FOR GRAPHQL RESPONSES
// =============================================================================

type ProductWithMappingResult = {
  product: {
    id: string;
    title: string;
    handle: string;
    productType: string | null;
    vendor: string;
    media: {
      nodes: Array<{
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
      }>;
    };
    variants: {
      nodes: Array<{
        id: string;
        title: string;
        selectedOptions: Array<{
          name: string;
          value: string;
        }>;
        image: {
          url: string;
        } | null;
      }>;
    };
    metafield: {
      id: string;
      value: string;
    } | null;
  } | null;
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Parse mapping from metafield value with validation
 */
function parseMapping(value: string | null | undefined): VariantImageMap | null {
  if (!value) return null;

  try {
    const raw = JSON.parse(value) as Record<string, unknown>;

    // Validate version
    if (raw.version !== 1) {
      console.warn("Unknown variant mapping version:", raw.version);
      return null;
    }

    // Parse with type safety
    const mapping: VariantImageMap = {
      version: 1,
      updated_at: String(raw.updated_at || new Date().toISOString()),
      updated_by: (raw.updated_by as VariantImageMap["updated_by"]) || "manual",
      mappings: {},
      settings: {
        fallback:
          ((raw.settings as Record<string, unknown>)?.fallback as VariantImageMap["settings"]["fallback"]) ||
          "show_all",
        match_mode:
          ((raw.settings as Record<string, unknown>)?.match_mode as VariantImageMap["settings"]["match_mode"]) ||
          "any",
        custom_ordering: Boolean(
          (raw.settings as Record<string, unknown>)?.custom_ordering
        ),
      },
    };

    // Parse individual mappings
    const rawMappings = raw.mappings as Record<string, Record<string, unknown>> | undefined;
    if (rawMappings && typeof rawMappings === "object") {
      for (const [mediaId, rawImageMapping] of Object.entries(rawMappings)) {
        if (!rawImageMapping || typeof rawImageMapping !== "object") continue;

        const imageMapping: ImageMapping = {
          variants: Array.isArray(rawImageMapping.variants)
            ? (rawImageMapping.variants as string[])
            : [],
          universal: Boolean(rawImageMapping.universal),
          position: Number(rawImageMapping.position) || 0,
          source: (rawImageMapping.source as ImageMapping["source"]) || "manual",
          confidence:
            typeof rawImageMapping.confidence === "number"
              ? rawImageMapping.confidence
              : null,
          mapped_at: String(
            rawImageMapping.mapped_at || new Date().toISOString()
          ),
          tags: Array.isArray(rawImageMapping.tags)
            ? (rawImageMapping.tags as string[])
            : undefined,
        };

        mapping.mappings[mediaId] = imageMapping;
      }
    }

    return mapping;
  } catch (error) {
    console.error("Failed to parse variant mapping:", error);
    return null;
  }
}

/**
 * Transform GraphQL product result to ProductForMapping
 */
function transformProduct(
  product: ProductWithMappingResult["product"]
): ProductForMapping | null {
  if (!product) return null;

  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    productType: product.productType,
    vendor: product.vendor,
    media: product.media.nodes
      .filter((m) => m.id != null)
      .map((m) => ({
        id: m.id,
        alt: m.alt,
        mediaContentType: m.mediaContentType,
        image: m.image,
        preview: m.preview,
      })),
    variants: product.variants.nodes.map((v) => ({
      id: v.id,
      title: v.title,
      selectedOptions: v.selectedOptions,
      image: v.image,
    })),
  };
}

/**
 * Ensure the metafield definition exists for storefront access
 */
async function ensureMetafieldDefinition(
  admin: { graphql: AdminGraphql }
): Promise<void> {
  // Check if definition already exists
  const checkResponse = await admin.graphql(METAFIELD_DEFINITION_QUERY, {
    variables: {
      namespace: NAMESPACE,
      key: KEY,
      ownerType: "PRODUCT",
    },
  });

  const checkJson = (await checkResponse.json()) as {
    data?: {
      metafieldDefinitions?: { nodes: Array<{ id: string }> };
    };
  };

  if (checkJson.data?.metafieldDefinitions?.nodes?.length) {
    // Definition already exists
    return;
  }

  // Create metafield definition with storefront access
  const createResponse = await admin.graphql(METAFIELD_DEFINITION_CREATE, {
    variables: {
      definition: {
        name: "Variant Image Mapping",
        namespace: NAMESPACE,
        key: KEY,
        type: METAFIELD_TYPE,
        ownerType: "PRODUCT",
        access: {
          storefront: "PUBLIC_READ",
        },
      },
    },
  });

  const createJson = (await createResponse.json()) as {
    data?: {
      metafieldDefinitionCreate?: {
        userErrors: Array<{ message: string }>;
      };
    };
  };

  // Ignore "already exists" errors
  const userErrors =
    createJson.data?.metafieldDefinitionCreate?.userErrors ?? [];
  const hasNonDuplicateError = userErrors.some(
    (e) => !e.message.includes("already exists")
  );
  if (hasNonDuplicateError) {
    console.warn(
      "Metafield definition warning:",
      userErrors.map((e) => e.message).join("; ")
    );
  }
}

// =============================================================================
// EXPORTED FUNCTIONS
// =============================================================================

/**
 * Load product data and existing variant mapping
 */
export async function getVariantMapping(
  admin: { graphql: AdminGraphql },
  productId: string
): Promise<VariantMappingLoadResponse> {
  // Ensure metafield definition exists
  await ensureMetafieldDefinition(admin);

  // Convert to GID format if needed
  const gid = toProductGid(productId);

  // Fetch product with mapping
  const response = await admin.graphql(PRODUCT_WITH_MAPPING_QUERY, {
    variables: { id: gid },
  });

  const json = (await response.json()) as {
    data?: ProductWithMappingResult;
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }

  const product = transformProduct(json.data?.product ?? null);

  if (!product) {
    throw new Error(`Product not found: ${productId}`);
  }

  const mapping = parseMapping(json.data?.product?.metafield?.value);

  return {
    product,
    mapping,
    hasExistingMapping: mapping !== null,
  };
}

/**
 * Save variant mapping to product metafield
 */
export async function saveVariantMapping(
  admin: { graphql: AdminGraphql },
  productId: string,
  mapping: VariantImageMap
): Promise<VariantImageMap> {
  // Ensure metafield definition exists
  await ensureMetafieldDefinition(admin);

  // Convert to GID format if needed
  const gid = toProductGid(productId);

  // Update timestamp
  const updatedMapping: VariantImageMap = {
    ...mapping,
    updated_at: new Date().toISOString(),
  };

  // Serialize the mapping
  const value = JSON.stringify(updatedMapping);
  checkMetafieldSize(value);

  // Save to metafield
  const response = await admin.graphql(METAFIELDS_SET_MUTATION, {
    variables: {
      metafields: [
        {
          ownerId: gid,
          namespace: NAMESPACE,
          key: KEY,
          type: METAFIELD_TYPE,
          value,
        },
      ],
    },
  });

  const json = (await response.json()) as {
    data?: {
      metafieldsSet?: {
        metafields: Array<{ id: string; value: string }>;
        userErrors: Array<{ field: string[]; message: string }>;
      };
    };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }

  const userErrors = json.data?.metafieldsSet?.userErrors ?? [];
  if (userErrors.length > 0) {
    throw new Error(userErrors.map((e) => e.message).join("; "));
  }

  return updatedMapping;
}

/**
 * Delete variant mapping from product metafield
 */
export async function deleteVariantMapping(
  admin: { graphql: AdminGraphql },
  productId: string
): Promise<void> {
  const gid = toProductGid(productId);

  // Set to null/empty to delete
  const response = await admin.graphql(METAFIELDS_SET_MUTATION, {
    variables: {
      metafields: [
        {
          ownerId: gid,
          namespace: NAMESPACE,
          key: KEY,
          type: METAFIELD_TYPE,
          value: JSON.stringify(null),
        },
      ],
    },
  });

  const json = (await response.json()) as {
    data?: {
      metafieldsSet?: {
        userErrors: Array<{ field: string[]; message: string }>;
      };
    };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }

  const userErrors = json.data?.metafieldsSet?.userErrors ?? [];
  if (userErrors.length > 0) {
    throw new Error(userErrors.map((e) => e.message).join("; "));
  }
}

// =============================================================================
// SHOP-LEVEL IMAGE TAGS
// =============================================================================

const TAGS_KEY = "image_tags";

const DEFAULT_TAGS = [
  "hero",
  "lifestyle",
  "product-shot",
  "detail",
  "size-guide",
  "material",
  "video",
  "universal",
];

const SHOP_TAGS_QUERY = `#graphql
  query ShopImageTags {
    currentAppInstallation {
      metafield(namespace: "${NAMESPACE}", key: "${TAGS_KEY}") {
        value
      }
    }
  }
`;

const SHOP_METAFIELDS_SET = `#graphql
  mutation ShopMetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id }
      userErrors { field message }
    }
  }
`;

const APP_INSTALLATION_QUERY = `#graphql
  query AppInstallation {
    currentAppInstallation { id }
  }
`;

/**
 * Get shop-level image tags (returns DEFAULT_TAGS if none saved)
 */
export async function getShopImageTags(
  admin: { graphql: AdminGraphql }
): Promise<string[]> {
  try {
    const response = await admin.graphql(SHOP_TAGS_QUERY);
    const json = (await response.json()) as {
      data?: {
        currentAppInstallation?: {
          metafield?: { value: string } | null;
        };
      };
    };

    const value = json.data?.currentAppInstallation?.metafield?.value;
    if (value) {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn("Failed to load shop image tags:", e);
  }
  return DEFAULT_TAGS;
}

/**
 * Save shop-level image tags
 * Validation: alphanumeric + hyphens only, max 30 chars each, max 50 tags
 */
export async function saveShopImageTags(
  admin: { graphql: AdminGraphql },
  tags: string[]
): Promise<void> {
  // Validate and normalize
  const normalized = [...new Set(
    tags
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0 && t.length <= 30 && /^[a-z0-9-]+$/.test(t))
  )].slice(0, 50);

  // Get app installation ID for ownerId
  const installResponse = await admin.graphql(APP_INSTALLATION_QUERY);
  const installJson = (await installResponse.json()) as {
    data?: { currentAppInstallation?: { id: string } };
  };
  const ownerId = installJson.data?.currentAppInstallation?.id;
  if (!ownerId) throw new Error("Could not find app installation ID");

  checkMetafieldSize(JSON.stringify(normalized));
  const response = await admin.graphql(SHOP_METAFIELDS_SET, {
    variables: {
      metafields: [
        {
          ownerId,
          namespace: NAMESPACE,
          key: TAGS_KEY,
          type: "json",
          value: JSON.stringify(normalized),
        },
      ],
    },
  });

  const json = (await response.json()) as {
    data?: {
      metafieldsSet?: {
        userErrors: Array<{ message: string }>;
      };
    };
  };

  const errors = json.data?.metafieldsSet?.userErrors ?? [];
  if (errors.length > 0) {
    throw new Error(errors.map((e) => e.message).join("; "));
  }
}

/**
 * Get ordered image list for a specific variant value from a mapping.
 * Returns media IDs sorted by position, including universal images.
 */
export function getVariantImageList(
  mapping: VariantImageMap,
  variantValue: string
): string[] {
  const result: Array<{ mediaId: string; position: number }> = [];
  const universals: Array<{ mediaId: string; position: number }> = [];

  for (const [mediaId, imageMapping] of Object.entries(mapping.mappings)) {
    if (imageMapping.universal) {
      universals.push({ mediaId, position: imageMapping.position });
    } else if (imageMapping.variants.includes(variantValue)) {
      result.push({ mediaId, position: imageMapping.position });
    }
  }

  // Sort by position
  result.sort((a, b) => a.position - b.position);
  universals.sort((a, b) => a.position - b.position);

  // Universal images first, then variant-specific
  return [...universals.map((u) => u.mediaId), ...result.map((r) => r.mediaId)];
}

/**
 * Re-export createEmptyMapping for convenience
 */
export { createEmptyMapping };
