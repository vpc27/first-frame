/**
 * Rules Storage Server Module (PGP-F2.0)
 *
 * Handles loading and saving rules using Shopify metafields.
 * - Shop-level rules: shop.metafields.product_gallery_pro.rules
 * - Product-level overrides: product.metafields.product_gallery_pro.rule_overrides
 */

import type {
  Rule,
  ShopRulesMetafield,
  ProductRuleOverrides,
} from "~/types/rules";
import {
  createDefaultShopRules,
  createDefaultProductOverrides,
  sortRulesByPriority,
} from "~/types/rules";
import { toProductGid } from "../productId.server";
import { checkMetafieldSize } from "../metafieldGuard";

// =============================================================================
// CONSTANTS
// =============================================================================

const NAMESPACE = "product_gallery_pro";
const SHOP_RULES_KEY = "rules";
const PRODUCT_OVERRIDES_KEY = "rule_overrides";
const METAFIELD_TYPE = "json";

type AdminGraphql = (
  query: string,
  options?: { variables?: Record<string, unknown> }
) => Promise<Response>;

// =============================================================================
// GRAPHQL QUERIES & MUTATIONS
// =============================================================================

/**
 * Query to get shop-level rules metafield
 */
const SHOP_RULES_QUERY = `#graphql
  query ShopRulesMetafield {
    shop {
      id
      metafield(namespace: "${NAMESPACE}", key: "${SHOP_RULES_KEY}") {
        id
        value
      }
    }
  }
`;

/**
 * Query to get product-level rule overrides
 */
const PRODUCT_OVERRIDES_QUERY = `#graphql
  query ProductRuleOverrides($id: ID!) {
    product(id: $id) {
      id
      metafield(namespace: "${NAMESPACE}", key: "${PRODUCT_OVERRIDES_KEY}") {
        id
        value
      }
    }
  }
`;

/**
 * Mutation to set metafields
 */
const METAFIELDS_SET_MUTATION = `#graphql
  mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
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

/**
 * Mutation to delete a metafield
 */
const METAFIELD_DELETE_MUTATION = `#graphql
  mutation MetafieldDelete($input: MetafieldDeleteInput!) {
    metafieldDelete(input: $input) {
      deletedId
      userErrors {
        field
        message
      }
    }
  }
`;

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Parse shop rules from metafield value
 */
function parseShopRules(value: string | null | undefined): ShopRulesMetafield | null {
  if (!value) return null;

  try {
    const raw = JSON.parse(value) as Record<string, unknown>;

    // Validate version
    if (raw.version !== 1) {
      console.warn("[Rules Storage] Unknown rules schema version:", raw.version);
      return null;
    }

    // Parse with type safety
    const rules: ShopRulesMetafield = {
      version: 1,
      evaluationMode:
        (raw.evaluationMode as ShopRulesMetafield["evaluationMode"]) || "first_match",
      rules: Array.isArray(raw.rules) ? (raw.rules as Rule[]) : [],
      globalSettings: {
        enableRules:
          (raw.globalSettings as Record<string, unknown>)?.enableRules !== false,
        fallbackBehavior:
          ((raw.globalSettings as Record<string, unknown>)
            ?.fallbackBehavior as ShopRulesMetafield["globalSettings"]["fallbackBehavior"]) ||
          "default_gallery",
        maxRulesPerEvaluation:
          Number(
            (raw.globalSettings as Record<string, unknown>)?.maxRulesPerEvaluation
          ) || 50,
        useLegacyFallback:
          (raw.globalSettings as Record<string, unknown>)?.useLegacyFallback !== false,
      },
      updatedAt: String(raw.updatedAt || new Date().toISOString()),
    };

    return rules;
  } catch (error) {
    console.error("[Rules Storage] Failed to parse shop rules:", error);
    return null;
  }
}

/**
 * Parse product rule overrides from metafield value
 */
function parseProductOverrides(
  value: string | null | undefined
): ProductRuleOverrides | null {
  if (!value) return null;

  try {
    const raw = JSON.parse(value) as Record<string, unknown>;

    // Validate version
    if (raw.version !== 1) {
      console.warn("[Rules Storage] Unknown overrides schema version:", raw.version);
      return null;
    }

    const overrides: ProductRuleOverrides = {
      version: 1,
      disableShopRules: Boolean(raw.disableShopRules),
      disabledRuleIds: Array.isArray(raw.disabledRuleIds)
        ? (raw.disabledRuleIds as string[])
        : [],
      rules: Array.isArray(raw.rules) ? (raw.rules as Rule[]) : [],
      updatedAt: String(raw.updatedAt || new Date().toISOString()),
    };

    return overrides;
  } catch (error) {
    console.error("[Rules Storage] Failed to parse product overrides:", error);
    return null;
  }
}

/**
 * Ensure the shop rules metafield definition exists for storefront access
 */
async function ensureShopRulesDefinition(
  admin: { graphql: AdminGraphql }
): Promise<void> {
  // Check if definition already exists
  const checkResponse = await admin.graphql(METAFIELD_DEFINITION_QUERY, {
    variables: {
      namespace: NAMESPACE,
      key: SHOP_RULES_KEY,
      ownerType: "SHOP",
    },
  });

  const checkJson = (await checkResponse.json()) as {
    data?: {
      metafieldDefinitions?: { nodes: Array<{ id: string }> };
    };
  };

  if (checkJson.data?.metafieldDefinitions?.nodes?.length) {
    return;
  }

  // Create metafield definition with storefront access
  const createResponse = await admin.graphql(METAFIELD_DEFINITION_CREATE, {
    variables: {
      definition: {
        name: "Gallery Rules",
        namespace: NAMESPACE,
        key: SHOP_RULES_KEY,
        type: METAFIELD_TYPE,
        ownerType: "SHOP",
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

  const userErrors = createJson.data?.metafieldDefinitionCreate?.userErrors ?? [];
  const hasNonDuplicateError = userErrors.some(
    (e) => !e.message.includes("already exists")
  );
  if (hasNonDuplicateError) {
    console.warn(
      "[Rules Storage] Shop rules definition warning:",
      userErrors.map((e) => e.message).join("; ")
    );
  }
}

/**
 * Ensure the product overrides metafield definition exists for storefront access
 */
async function ensureProductOverridesDefinition(
  admin: { graphql: AdminGraphql }
): Promise<void> {
  // Check if definition already exists
  const checkResponse = await admin.graphql(METAFIELD_DEFINITION_QUERY, {
    variables: {
      namespace: NAMESPACE,
      key: PRODUCT_OVERRIDES_KEY,
      ownerType: "PRODUCT",
    },
  });

  const checkJson = (await checkResponse.json()) as {
    data?: {
      metafieldDefinitions?: { nodes: Array<{ id: string }> };
    };
  };

  if (checkJson.data?.metafieldDefinitions?.nodes?.length) {
    return;
  }

  // Create metafield definition with storefront access
  const createResponse = await admin.graphql(METAFIELD_DEFINITION_CREATE, {
    variables: {
      definition: {
        name: "Gallery Rule Overrides",
        namespace: NAMESPACE,
        key: PRODUCT_OVERRIDES_KEY,
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

  const userErrors = createJson.data?.metafieldDefinitionCreate?.userErrors ?? [];
  const hasNonDuplicateError = userErrors.some(
    (e) => !e.message.includes("already exists")
  );
  if (hasNonDuplicateError) {
    console.warn(
      "[Rules Storage] Product overrides definition warning:",
      userErrors.map((e) => e.message).join("; ")
    );
  }
}

// =============================================================================
// SHOP RULES CRUD
// =============================================================================

/**
 * Load shop-level rules
 */
export async function getShopRules(
  admin: { graphql: AdminGraphql }
): Promise<ShopRulesMetafield> {
  await ensureShopRulesDefinition(admin);

  const response = await admin.graphql(SHOP_RULES_QUERY);
  const json = (await response.json()) as {
    data?: {
      shop: {
        id: string;
        metafield: { id: string; value: string } | null;
      };
    };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }

  const parsed = parseShopRules(json.data?.shop?.metafield?.value);
  return parsed || createDefaultShopRules();
}

/**
 * Save shop-level rules
 */
export async function saveShopRules(
  admin: { graphql: AdminGraphql },
  rules: ShopRulesMetafield
): Promise<ShopRulesMetafield> {
  await ensureShopRulesDefinition(admin);

  // Get shop ID
  const shopResponse = await admin.graphql(SHOP_RULES_QUERY);
  const shopJson = (await shopResponse.json()) as {
    data?: { shop: { id: string } };
  };
  const shopId = shopJson.data?.shop?.id;

  if (!shopId) {
    throw new Error("Could not determine shop ID");
  }

  // Update timestamp and sort rules by priority
  const updatedRules: ShopRulesMetafield = {
    ...rules,
    rules: sortRulesByPriority(rules.rules),
    updatedAt: new Date().toISOString(),
  };

  const value = JSON.stringify(updatedRules);
  checkMetafieldSize(value);

  const response = await admin.graphql(METAFIELDS_SET_MUTATION, {
    variables: {
      metafields: [
        {
          ownerId: shopId,
          namespace: NAMESPACE,
          key: SHOP_RULES_KEY,
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

  return updatedRules;
}

/**
 * Add a rule to shop rules
 */
export async function addShopRule(
  admin: { graphql: AdminGraphql },
  rule: Rule
): Promise<ShopRulesMetafield> {
  const current = await getShopRules(admin);
  current.rules.push(rule);
  return saveShopRules(admin, current);
}

/**
 * Update a rule in shop rules
 */
export async function updateShopRule(
  admin: { graphql: AdminGraphql },
  ruleId: string,
  updates: Partial<Rule>
): Promise<ShopRulesMetafield> {
  const current = await getShopRules(admin);
  const index = current.rules.findIndex((r) => r.id === ruleId);

  if (index === -1) {
    throw new Error(`Rule not found: ${ruleId}`);
  }

  current.rules[index] = {
    ...current.rules[index],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  return saveShopRules(admin, current);
}

/**
 * Delete a rule from shop rules
 */
export async function deleteShopRule(
  admin: { graphql: AdminGraphql },
  ruleId: string
): Promise<ShopRulesMetafield> {
  const current = await getShopRules(admin);
  current.rules = current.rules.filter((r) => r.id !== ruleId);
  return saveShopRules(admin, current);
}

/**
 * Reorder rules (update priorities)
 */
export async function reorderShopRules(
  admin: { graphql: AdminGraphql },
  ruleIds: string[]
): Promise<ShopRulesMetafield> {
  const current = await getShopRules(admin);

  // Update priorities based on order in ruleIds
  ruleIds.forEach((id, index) => {
    const rule = current.rules.find((r) => r.id === id);
    if (rule) {
      rule.priority = index;
      rule.updatedAt = new Date().toISOString();
    }
  });

  return saveShopRules(admin, current);
}

/**
 * Get a single rule by ID
 */
export async function getShopRule(
  admin: { graphql: AdminGraphql },
  ruleId: string
): Promise<Rule | null> {
  const current = await getShopRules(admin);
  console.log("[getShopRule] Looking for ruleId:", ruleId);
  console.log("[getShopRule] Available rule IDs:", current.rules.map((r) => r.id));
  const found = current.rules.find((r) => r.id === ruleId) || null;
  console.log("[getShopRule] Found:", found ? "yes" : "no");
  return found;
}

// =============================================================================
// PRODUCT OVERRIDES CRUD
// =============================================================================

/**
 * Load product-level rule overrides
 */
export async function getProductOverrides(
  admin: { graphql: AdminGraphql },
  productId: string
): Promise<ProductRuleOverrides> {
  await ensureProductOverridesDefinition(admin);

  const gid = toProductGid(productId);

  const response = await admin.graphql(PRODUCT_OVERRIDES_QUERY, {
    variables: { id: gid },
  });

  const json = (await response.json()) as {
    data?: {
      product: {
        id: string;
        metafield: { id: string; value: string } | null;
      } | null;
    };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }

  if (!json.data?.product) {
    throw new Error(`Product not found: ${productId}`);
  }

  const parsed = parseProductOverrides(json.data.product.metafield?.value);
  return parsed || createDefaultProductOverrides();
}

/**
 * Save product-level rule overrides
 */
export async function saveProductOverrides(
  admin: { graphql: AdminGraphql },
  productId: string,
  overrides: ProductRuleOverrides
): Promise<ProductRuleOverrides> {
  await ensureProductOverridesDefinition(admin);

  const gid = toProductGid(productId);

  const updatedOverrides: ProductRuleOverrides = {
    ...overrides,
    rules: sortRulesByPriority(overrides.rules),
    updatedAt: new Date().toISOString(),
  };

  const value = JSON.stringify(updatedOverrides);
  checkMetafieldSize(value);

  const response = await admin.graphql(METAFIELDS_SET_MUTATION, {
    variables: {
      metafields: [
        {
          ownerId: gid,
          namespace: NAMESPACE,
          key: PRODUCT_OVERRIDES_KEY,
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

  return updatedOverrides;
}

/**
 * Delete product-level rule overrides
 */
export async function deleteProductOverrides(
  admin: { graphql: AdminGraphql },
  productId: string
): Promise<void> {
  const gid = toProductGid(productId);

  // Set to empty value to effectively delete
  await admin.graphql(METAFIELDS_SET_MUTATION, {
    variables: {
      metafields: [
        {
          ownerId: gid,
          namespace: NAMESPACE,
          key: PRODUCT_OVERRIDES_KEY,
          type: METAFIELD_TYPE,
          value: JSON.stringify(createDefaultProductOverrides()),
        },
      ],
    },
  });
}

// =============================================================================
// COMBINED RULES LOADING
// =============================================================================

/**
 * Load effective rules for a product (combines shop rules with product overrides)
 */
export async function getEffectiveRules(
  admin: { graphql: AdminGraphql },
  productId: string
): Promise<{
  rules: Rule[];
  shopRules: ShopRulesMetafield;
  productOverrides: ProductRuleOverrides;
}> {
  const [shopRules, productOverrides] = await Promise.all([
    getShopRules(admin),
    getProductOverrides(admin, productId),
  ]);

  // If shop rules are disabled for this product, return only product rules
  if (productOverrides.disableShopRules) {
    return {
      rules: sortRulesByPriority(productOverrides.rules),
      shopRules,
      productOverrides,
    };
  }

  // Filter out disabled shop rules
  const enabledShopRules = shopRules.rules.filter(
    (r) => !productOverrides.disabledRuleIds.includes(r.id)
  );

  // Product rules take precedence (lower priority numbers)
  // Adjust product rule priorities to be before shop rules
  const adjustedProductRules = productOverrides.rules.map((r, i) => ({
    ...r,
    priority: i - productOverrides.rules.length, // Negative numbers come first
  }));

  const combinedRules = [...adjustedProductRules, ...enabledShopRules];

  return {
    rules: sortRulesByPriority(combinedRules),
    shopRules,
    productOverrides,
  };
}

// =============================================================================
// GLOBAL SETTINGS
// =============================================================================

/**
 * Update global rules settings
 */
export async function updateGlobalSettings(
  admin: { graphql: AdminGraphql },
  settings: Partial<ShopRulesMetafield["globalSettings"]>
): Promise<ShopRulesMetafield> {
  const current = await getShopRules(admin);
  current.globalSettings = {
    ...current.globalSettings,
    ...settings,
  };
  return saveShopRules(admin, current);
}

/**
 * Update evaluation mode
 */
export async function updateEvaluationMode(
  admin: { graphql: AdminGraphql },
  mode: ShopRulesMetafield["evaluationMode"]
): Promise<ShopRulesMetafield> {
  const current = await getShopRules(admin);
  current.evaluationMode = mode;
  return saveShopRules(admin, current);
}
