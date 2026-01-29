/**
 * Gallery settings stored in Shopify shop metafields.
 * Uses Admin API so settings live in Shopify (no custom DB for settings).
 * Settings are exposed to storefront via metafield definition.
 */

import type { Settings, OnboardingState } from "~/types";

const NAMESPACE = "product_gallery_pro";
const KEY = "settings";
const METAFIELD_TYPE = "json";

const SHOP_SETTINGS_QUERY = `#graphql
  query ShopSettingsMetafield($namespace: String!, $key: String!) {
    shop {
      id
      metafield(namespace: $namespace, key: $key) {
        value
      }
    }
  }
`;

const METAFIELDS_SET_MUTATION = `#graphql
  mutation SettingsMetafieldSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { key namespace value }
      userErrors { field message code }
    }
  }
`;

// Create metafield definition to expose to storefront
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

type AdminGraphql = (query: string, options?: { variables?: Record<string, unknown> }) => Promise<Response>;

const DEFAULT_SETTINGS = (shopId: string): Settings => ({
  shop_id: shopId,
  layout: "carousel",
  thumbnail_position: "bottom",
  thumbnail_size: "medium",
  enable_zoom: true,
  zoom_type: "both",
  zoom_level: 2.5,
  variant_filtering: true,
  lazy_loading: true,
  autoplay_video: false,
  enable_analytics: true,
  enable_ai: true,
  image_fit: "auto",
});

function parseSettings(shopId: string, value: string | null | undefined): Settings {
  if (!value) return DEFAULT_SETTINGS(shopId);
  try {
    const raw = JSON.parse(value) as Record<string, unknown>;
    return {
      shop_id: shopId,
      layout: (raw.layout ?? "carousel") as Settings["layout"],
      thumbnail_position: (raw.thumbnail_position ?? "bottom") as Settings["thumbnail_position"],
      thumbnail_size: (raw.thumbnail_size ?? "medium") as Settings["thumbnail_size"],
      enable_zoom: Boolean(raw.enable_zoom ?? true),
      zoom_type: (raw.zoom_type ?? "both") as Settings["zoom_type"],
      zoom_level: Number(raw.zoom_level ?? 2.5),
      variant_filtering: Boolean(raw.variant_filtering ?? true),
      lazy_loading: Boolean(raw.lazy_loading ?? true),
      autoplay_video: Boolean(raw.autoplay_video ?? false),
      enable_analytics: Boolean(raw.enable_analytics ?? true),
      enable_ai: Boolean(raw.enable_ai ?? true),
      image_fit: (raw.image_fit ?? "auto") as Settings["image_fit"],
    };
  } catch {
    return DEFAULT_SETTINGS(shopId);
  }
}

// Ensure metafield definition exists for storefront access
async function ensureMetafieldDefinition(
  admin: { graphql: AdminGraphql }
): Promise<void> {
  // Check if definition already exists
  const checkResponse = await admin.graphql(METAFIELD_DEFINITION_QUERY, {
    variables: {
      namespace: NAMESPACE,
      key: KEY,
      ownerType: "SHOP"
    },
  });
  const checkJson = await checkResponse.json() as {
    data?: { metafieldDefinitions?: { nodes: Array<{ id: string }> } };
  };

  if (checkJson.data?.metafieldDefinitions?.nodes?.length) {
    // Definition already exists
    return;
  }

  // Create metafield definition with storefront access
  const createResponse = await admin.graphql(METAFIELD_DEFINITION_CREATE, {
    variables: {
      definition: {
        name: "Gallery Settings",
        namespace: NAMESPACE,
        key: KEY,
        type: METAFIELD_TYPE,
        ownerType: "SHOP",
        access: {
          storefront: "PUBLIC_READ"
        }
      }
    }
  });

  const createJson = await createResponse.json() as {
    data?: { metafieldDefinitionCreate?: { userErrors: Array<{ message: string }> } };
    errors?: Array<{ message: string }>;
  };

  // Ignore "already exists" errors
  const userErrors = createJson.data?.metafieldDefinitionCreate?.userErrors ?? [];
  const hasNonDuplicateError = userErrors.some(e => !e.message.includes("already exists"));
  if (hasNonDuplicateError) {
    console.warn("Metafield definition warning:", userErrors.map(e => e.message).join("; "));
  }
}

export async function getSettingsFromMetafields(
  admin: { graphql: AdminGraphql },
  shopId: string,
): Promise<Settings> {
  // Ensure metafield definition exists for storefront access
  await ensureMetafieldDefinition(admin);

  const response = await admin.graphql(SHOP_SETTINGS_QUERY, {
    variables: { namespace: NAMESPACE, key: KEY },
  });
  const json = (await response.json()) as {
    data?: { shop?: { id?: string; metafield?: { value: string } | null } };
    errors?: Array<{ message: string }>;
  };
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  const shop = json.data?.shop;
  const value = shop?.metafield?.value;
  return parseSettings(shopId, value);
}

export async function updateSettingsInMetafields(
  admin: { graphql: AdminGraphql },
  shopId: string,
  settings: Partial<Settings>,
): Promise<void> {
  // Ensure metafield definition exists for storefront access
  await ensureMetafieldDefinition(admin);

  const response = await admin.graphql(SHOP_SETTINGS_QUERY, {
    variables: { namespace: NAMESPACE, key: KEY },
  });
  const json = (await response.json()) as {
    data?: { shop?: { id: string; metafield?: { value: string } | null }; errors?: Array<{ message: string }> };
  };
  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }
  const shop = json.data?.shop;
  const shopIdGid = shop?.id;
  if (!shopIdGid) {
    throw new Error("Shop ID not found");
  }

  const current = parseSettings(shopId, shop?.metafield?.value);
  const payload: Settings = { ...current, ...settings, shop_id: shopId };
  const value = JSON.stringify({
    layout: payload.layout,
    thumbnail_position: payload.thumbnail_position,
    thumbnail_size: payload.thumbnail_size,
    enable_zoom: payload.enable_zoom,
    zoom_type: payload.zoom_type,
    zoom_level: payload.zoom_level,
    variant_filtering: payload.variant_filtering,
    lazy_loading: payload.lazy_loading,
    autoplay_video: payload.autoplay_video,
    enable_analytics: payload.enable_analytics,
    enable_ai: payload.enable_ai,
    image_fit: payload.image_fit,
  });

  const setResponse = await admin.graphql(METAFIELDS_SET_MUTATION, {
    variables: {
      metafields: [
        {
          ownerId: shopIdGid,
          namespace: NAMESPACE,
          key: KEY,
          type: METAFIELD_TYPE,
          value,
        },
      ],
    },
  });
  const setJson = (await setResponse.json()) as {
    data?: { metafieldsSet?: { userErrors: Array<{ field: string[]; message: string }> } };
    errors?: Array<{ message: string }>;
  };
  if (setJson.errors?.length) {
    throw new Error(setJson.errors.map((e) => e.message).join("; "));
  }
  const userErrors = setJson.data?.metafieldsSet?.userErrors ?? [];
  if (userErrors.length > 0) {
    throw new Error(userErrors.map((e) => e.message).join("; "));
  }
}

const ONBOARDING_KEY = "onboarding";

const DEFAULT_ONBOARDING: OnboardingState = {
  dismissed: false,
  dismissedAt: null,
};

export async function getOnboardingState(
  admin: { graphql: AdminGraphql },
): Promise<OnboardingState> {
  const response = await admin.graphql(SHOP_SETTINGS_QUERY, {
    variables: { namespace: NAMESPACE, key: ONBOARDING_KEY },
  });
  const json = (await response.json()) as {
    data?: { shop?: { metafield?: { value: string } | null } };
  };
  const value = json.data?.shop?.metafield?.value;
  if (!value) return DEFAULT_ONBOARDING;
  try {
    const raw = JSON.parse(value) as Record<string, unknown>;
    return {
      dismissed: Boolean(raw.dismissed),
      dismissedAt: typeof raw.dismissedAt === "string" ? raw.dismissedAt : null,
    };
  } catch {
    return DEFAULT_ONBOARDING;
  }
}

export async function dismissOnboarding(
  admin: { graphql: AdminGraphql },
): Promise<void> {
  const shopResponse = await admin.graphql(SHOP_SETTINGS_QUERY, {
    variables: { namespace: NAMESPACE, key: ONBOARDING_KEY },
  });
  const shopJson = (await shopResponse.json()) as {
    data?: { shop?: { id: string } };
  };
  const shopIdGid = shopJson.data?.shop?.id;
  if (!shopIdGid) throw new Error("Shop ID not found");

  const value = JSON.stringify({
    dismissed: true,
    dismissedAt: new Date().toISOString(),
  });

  const setResponse = await admin.graphql(METAFIELDS_SET_MUTATION, {
    variables: {
      metafields: [
        {
          ownerId: shopIdGid,
          namespace: NAMESPACE,
          key: ONBOARDING_KEY,
          type: METAFIELD_TYPE,
          value,
        },
      ],
    },
  });
  const setJson = (await setResponse.json()) as {
    data?: { metafieldsSet?: { userErrors: Array<{ message: string }> } };
    errors?: Array<{ message: string }>;
  };
  if (setJson.errors?.length) {
    throw new Error(setJson.errors.map((e) => e.message).join("; "));
  }
  const userErrors = setJson.data?.metafieldsSet?.userErrors ?? [];
  if (userErrors.length > 0) {
    throw new Error(userErrors.map((e) => e.message).join("; "));
  }
}
