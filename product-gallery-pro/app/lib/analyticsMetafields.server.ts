/**
 * Analytics storage via Shopify Metafields (zero-infrastructure).
 *
 * Shop-level metafield: product_gallery_pro.analytics_summary
 * Stores aggregate counts, daily views, device breakdown, top products,
 * and session-level averages (images per session, active time, swipe depth).
 *
 * Uses GraphQL Admin API for all reads and writes.
 */

import { checkMetafieldSize } from "./metafieldGuard";

const NAMESPACE = "product_gallery_pro";
const SUMMARY_KEY = "analytics_summary";

// --- GraphQL queries/mutations ---

const SHOP_ID_QUERY = `#graphql
  query ShopId {
    shop { id }
  }
`;

const READ_SHOP_METAFIELD = `#graphql
  query ReadAnalyticsSummary {
    shop {
      id
      metafield(namespace: "${NAMESPACE}", key: "${SUMMARY_KEY}") {
        value
      }
    }
  }
`;

const METAFIELDS_SET_MUTATION = `#graphql
  mutation AnalyticsSummarySet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { key namespace value }
      userErrors { field message code }
    }
  }
`;

// --- Types ---

type AdminGraphql = (
  query: string,
  options?: { variables?: Record<string, unknown> },
) => Promise<Response>;

export type AnalyticsSummary = {
  totalViews: number;
  zoomEvents: number;
  thumbnailClicks: number;
  videoPlays: number;
  slideChanges: number;
  lastUpdated: string;
  dailyViews: Record<string, number>;
  deviceBreakdown: { mobile: number; desktop: number; tablet: number };
  topProducts: TopProductEntry[];
  // Session-level aggregate metrics
  totalSessions: number;
  totalUniqueImagesViewed: number; // sum across all sessions
  totalActiveTimeMs: number;       // sum across all sessions
  totalMaxSlideIndex: number;      // sum of max indices across sessions
  sessionsWithInteraction: number; // sessions that had at least one interaction beyond view
};

export type TopProductEntry = {
  id: string;
  views: number;
  zoomEvents: number;
  thumbnailClicks: number;
  videoPlays: number;
  slideChanges: number;
  // Per-product session aggregates
  sessions: number;
  totalActiveTimeMs: number;
  totalMaxSlideIndex: number;
};

export type SessionSummary = {
  shop: string;
  session_id: string;
  device_type: string;
  timestamp: string;
  date: string;
  counts: {
    gallery_view: number;
    zoom_click: number;
    zoom_hover: number;
    thumbnail_click: number;
    video_play: number;
    slide_change: number;
  };
  products: Array<{
    product_id: string;
    counts: {
      gallery_view: number;
      zoom_click: number;
      zoom_hover: number;
      thumbnail_click: number;
      video_play: number;
      slide_change: number;
    };
  }>;
  session_metrics?: {
    unique_images_viewed: number;
    max_slide_index: number;
    active_time_ms: number;
  };
  image_metrics?: Array<{
    media_id: string;
    viewed: boolean;
    zoomed: boolean;
    active_time_ms: number;
  }>;
};

// --- Helpers ---

function emptyAnalyticsSummary(): AnalyticsSummary {
  return {
    totalViews: 0,
    zoomEvents: 0,
    thumbnailClicks: 0,
    videoPlays: 0,
    slideChanges: 0,
    lastUpdated: new Date().toISOString().slice(0, 10),
    dailyViews: {},
    deviceBreakdown: { mobile: 0, desktop: 0, tablet: 0 },
    topProducts: [],
    totalSessions: 0,
    totalUniqueImagesViewed: 0,
    totalActiveTimeMs: 0,
    totalMaxSlideIndex: 0,
    sessionsWithInteraction: 0,
  };
}

// Keep only the last N days of daily views to prevent unbounded growth
const MAX_DAILY_DAYS = 90;
function pruneDailyViews(daily: Record<string, number>): Record<string, number> {
  const entries = Object.entries(daily).sort(([a], [b]) => b.localeCompare(a));
  return Object.fromEntries(entries.slice(0, MAX_DAILY_DAYS));
}

// Keep only top N products
const MAX_TOP_PRODUCTS = 50;
function pruneTopProducts(products: TopProductEntry[]): TopProductEntry[] {
  return products
    .sort((a, b) => b.views - a.views)
    .slice(0, MAX_TOP_PRODUCTS);
}

// --- Read ---

export async function readAnalyticsSummary(
  admin: { graphql: AdminGraphql },
): Promise<{ shopGid: string; summary: AnalyticsSummary }> {
  const res = await admin.graphql(READ_SHOP_METAFIELD);
  const json = (await res.json()) as {
    data?: {
      shop?: {
        id: string;
        metafield?: { value: string } | null;
      };
    };
    errors?: Array<{ message: string }>;
  };

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join("; "));
  }

  const shopGid = json.data?.shop?.id ?? "";
  const raw = json.data?.shop?.metafield?.value;

  if (!raw) {
    return { shopGid, summary: emptyAnalyticsSummary() };
  }

  try {
    const parsed = JSON.parse(raw);
    // Merge with defaults so missing fields don't cause errors
    const summary: AnalyticsSummary = { ...emptyAnalyticsSummary(), ...parsed };
    return { shopGid, summary };
  } catch {
    return { shopGid, summary: emptyAnalyticsSummary() };
  }
}

// --- Merge a session summary into the stored summary ---

export function mergeSessionIntoSummary(
  existing: AnalyticsSummary,
  session: SessionSummary,
): AnalyticsSummary {
  const c = session.counts;
  const date = session.date;
  const device = session.device_type as "mobile" | "desktop" | "tablet";
  const sm = session.session_metrics;

  // Determine if this session had any interaction beyond just viewing
  const interactions = c.zoom_click + c.zoom_hover + c.thumbnail_click + c.video_play + c.slide_change;

  const merged: AnalyticsSummary = {
    totalViews: existing.totalViews + c.gallery_view,
    zoomEvents: existing.zoomEvents + c.zoom_click + c.zoom_hover,
    thumbnailClicks: existing.thumbnailClicks + c.thumbnail_click,
    videoPlays: existing.videoPlays + c.video_play,
    slideChanges: existing.slideChanges + c.slide_change,
    lastUpdated: date,
    dailyViews: { ...existing.dailyViews },
    deviceBreakdown: { ...existing.deviceBreakdown },
    topProducts: [...existing.topProducts],
    // Session-level aggregates
    totalSessions: existing.totalSessions + 1,
    totalUniqueImagesViewed: existing.totalUniqueImagesViewed + (sm?.unique_images_viewed ?? 0),
    totalActiveTimeMs: existing.totalActiveTimeMs + (sm?.active_time_ms ?? 0),
    totalMaxSlideIndex: existing.totalMaxSlideIndex + (sm?.max_slide_index ?? 0),
    sessionsWithInteraction: existing.sessionsWithInteraction + (interactions > 0 ? 1 : 0),
  };

  // Daily views
  merged.dailyViews[date] = (merged.dailyViews[date] || 0) + c.gallery_view;
  merged.dailyViews = pruneDailyViews(merged.dailyViews);

  // Device breakdown
  if (device === "mobile" || device === "desktop" || device === "tablet") {
    merged.deviceBreakdown[device] += c.gallery_view;
  }

  // Per-product
  for (const prod of session.products) {
    const pc = prod.counts;
    const idx = merged.topProducts.findIndex((p) => p.id === prod.product_id);
    if (idx >= 0) {
      const p = merged.topProducts[idx];
      merged.topProducts[idx] = {
        ...p,
        views: p.views + pc.gallery_view,
        zoomEvents: p.zoomEvents + pc.zoom_click + pc.zoom_hover,
        thumbnailClicks: p.thumbnailClicks + pc.thumbnail_click,
        videoPlays: p.videoPlays + pc.video_play,
        slideChanges: p.slideChanges + pc.slide_change,
        sessions: (p.sessions || 0) + 1,
        totalActiveTimeMs: (p.totalActiveTimeMs || 0) + (sm?.active_time_ms ?? 0),
        totalMaxSlideIndex: (p.totalMaxSlideIndex || 0) + (sm?.max_slide_index ?? 0),
      };
    } else {
      merged.topProducts.push({
        id: prod.product_id,
        views: pc.gallery_view,
        zoomEvents: pc.zoom_click + pc.zoom_hover,
        thumbnailClicks: pc.thumbnail_click,
        videoPlays: pc.video_play,
        slideChanges: pc.slide_change,
        sessions: 1,
        totalActiveTimeMs: sm?.active_time_ms ?? 0,
        totalMaxSlideIndex: sm?.max_slide_index ?? 0,
      });
    }
  }
  merged.topProducts = pruneTopProducts(merged.topProducts);

  return merged;
}

// --- Write ---

export async function writeAnalyticsSummary(
  admin: { graphql: AdminGraphql },
  shopGid: string,
  summary: AnalyticsSummary,
): Promise<void> {
  checkMetafieldSize(JSON.stringify(summary));
  const res = await admin.graphql(METAFIELDS_SET_MUTATION, {
    variables: {
      metafields: [
        {
          ownerId: shopGid,
          namespace: NAMESPACE,
          key: SUMMARY_KEY,
          type: "json",
          value: JSON.stringify(summary),
        },
      ],
    },
  });

  const json = (await res.json()) as {
    data?: { metafieldsSet?: { userErrors: Array<{ message: string }> } };
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

// --- Convenience: read, merge, write in one call ---

export async function mergeAndSaveSession(
  admin: { graphql: AdminGraphql },
  session: SessionSummary,
): Promise<AnalyticsSummary> {
  const { shopGid, summary } = await readAnalyticsSummary(admin);
  const merged = mergeSessionIntoSummary(summary, session);
  await writeAnalyticsSummary(admin, shopGid, merged);
  return merged;
}

// --- Dashboard helpers (convert stored summary to dashboard-friendly shapes) ---

export function getOverviewFromSummary(summary: AnalyticsSummary) {
  // Engagement rate: % of sessions that had at least one interaction (zoom, click, swipe, video)
  // This is capped at 100% by definition
  const engagementRate =
    summary.totalSessions > 0
      ? Math.round((summary.sessionsWithInteraction / summary.totalSessions) * 100)
      : 0;

  // Avg images viewed per session
  const avgImagesPerSession =
    summary.totalSessions > 0
      ? Math.round((summary.totalUniqueImagesViewed / summary.totalSessions) * 10) / 10
      : 0;

  // Avg active time in seconds
  const avgActiveTimeSec =
    summary.totalSessions > 0
      ? Math.round(summary.totalActiveTimeMs / summary.totalSessions / 100) / 10
      : 0;

  // Avg swipe depth (max slide index reached)
  const avgSwipeDepth =
    summary.totalSessions > 0
      ? Math.round((summary.totalMaxSlideIndex / summary.totalSessions) * 10) / 10
      : 0;

  return {
    totalViews: summary.totalViews,
    zoomEvents: summary.zoomEvents,
    thumbnailClicks: summary.thumbnailClicks,
    videoPlays: summary.videoPlays,
    engagementRate,
    avgImagesPerSession,
    avgActiveTimeSec,
    avgSwipeDepth,
    totalSessions: summary.totalSessions,
    sessionsWithInteraction: summary.sessionsWithInteraction,
  };
}

export function getTimeseriesFromSummary(
  summary: AnalyticsSummary,
  days = 30,
): Array<{ date: string; views: number }> {
  const result: Array<{ date: string; views: number }> = [];
  const now = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ date: key, views: summary.dailyViews[key] || 0 });
  }

  return result;
}

export function getTopProductsFromSummary(
  summary: AnalyticsSummary,
  limit = 50,
  titleMap?: Record<string, string>,
): Array<{
  productId: string;
  title: string;
  views: number;
  engagementRate: number;
  avgActiveTimeSec: number;
  avgSwipeDepth: number;
}> {
  return summary.topProducts
    .sort((a, b) => b.views - a.views)
    .slice(0, limit)
    .map((p) => {
      const interactions = p.zoomEvents + p.thumbnailClicks + p.videoPlays + p.slideChanges;
      const sessions = p.sessions || 0;
      return {
        productId: p.id,
        title: titleMap?.[p.id] || `Product ${p.id}`,
        views: p.views,
        engagementRate: p.views > 0 ? Math.min(Math.round((interactions / p.views) * 100), 100) : 0,
        avgActiveTimeSec: sessions > 0
          ? Math.round((p.totalActiveTimeMs || 0) / sessions / 100) / 10
          : 0,
        avgSwipeDepth: sessions > 0
          ? Math.round(((p.totalMaxSlideIndex || 0) / sessions) * 10) / 10
          : 0,
      };
    });
}

// Fetch product titles from Shopify for a list of product IDs
export async function fetchProductTitles(
  admin: { graphql: AdminGraphql },
  productIds: string[],
): Promise<Record<string, string>> {
  if (productIds.length === 0) return {};

  const gids = productIds.map(
    (id) => id.startsWith("gid://") ? id : `gid://shopify/Product/${id}`,
  );

  const res = await admin.graphql(
    `#graphql
      query ProductTitles($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on Product {
            id
            title
          }
        }
      }
    `,
    { variables: { ids: gids } },
  );

  const json = (await res.json()) as {
    data?: { nodes?: Array<{ id: string; title: string } | null> };
  };

  const map: Record<string, string> = {};
  for (const node of json.data?.nodes ?? []) {
    if (!node) continue;
    const numericId = node.id.replace(/\D/g, "");
    map[numericId] = node.title;
    map[node.id] = node.title;
  }
  return map;
}

export function getDeviceStatsFromSummary(
  summary: AnalyticsSummary,
): { mobile: number; desktop: number; tablet: number } {
  return { ...summary.deviceBreakdown };
}

// --- Per-image analytics (stored on product metafields) ---

const IMAGE_ANALYTICS_KEY = "image_analytics";

export type ImageAnalyticsEntry = {
  mediaId: string;
  sessions: number;
  zoomSessions: number;
  totalActiveTimeMs: number;
};

export type ProductImageAnalytics = {
  productId: string;
  totalProductSessions: number;
  images: ImageAnalyticsEntry[];
  lastUpdated: string;
};

function emptyProductImageAnalytics(productId: string): ProductImageAnalytics {
  return {
    productId,
    totalProductSessions: 0,
    images: [],
    lastUpdated: new Date().toISOString().slice(0, 10),
  };
}

const READ_PRODUCT_IMAGE_ANALYTICS = `#graphql
  query ReadProductImageAnalytics($id: ID!) {
    product(id: $id) {
      metafield(namespace: "${NAMESPACE}", key: "${IMAGE_ANALYTICS_KEY}") {
        value
      }
    }
  }
`;

export async function readProductImageAnalytics(
  admin: { graphql: AdminGraphql },
  productGid: string,
): Promise<ProductImageAnalytics> {
  const res = await admin.graphql(READ_PRODUCT_IMAGE_ANALYTICS, {
    variables: { id: productGid },
  });
  const json = (await res.json()) as {
    data?: { product?: { metafield?: { value: string } | null } };
  };
  const raw = json.data?.product?.metafield?.value;
  if (!raw) return emptyProductImageAnalytics(productGid);
  try {
    return { ...emptyProductImageAnalytics(productGid), ...JSON.parse(raw) };
  } catch {
    return emptyProductImageAnalytics(productGid);
  }
}

export function mergeImageMetricsIntoProduct(
  existing: ProductImageAnalytics,
  sessionImageMetrics: Array<{ media_id: string; viewed: boolean; zoomed: boolean; active_time_ms: number }>,
): ProductImageAnalytics {
  const merged: ProductImageAnalytics = {
    ...existing,
    totalProductSessions: existing.totalProductSessions + 1,
    images: [...existing.images],
    lastUpdated: new Date().toISOString().slice(0, 10),
  };

  for (const m of sessionImageMetrics) {
    const idx = merged.images.findIndex((e) => e.mediaId === m.media_id);
    if (idx >= 0) {
      const e = merged.images[idx];
      merged.images[idx] = {
        ...e,
        sessions: e.sessions + (m.viewed ? 1 : 0),
        zoomSessions: e.zoomSessions + (m.zoomed ? 1 : 0),
        totalActiveTimeMs: e.totalActiveTimeMs + m.active_time_ms,
      };
    } else {
      merged.images.push({
        mediaId: m.media_id,
        sessions: m.viewed ? 1 : 0,
        zoomSessions: m.zoomed ? 1 : 0,
        totalActiveTimeMs: m.active_time_ms,
      });
    }
  }

  return merged;
}

export async function writeProductImageAnalytics(
  admin: { graphql: AdminGraphql },
  productGid: string,
  data: ProductImageAnalytics,
): Promise<void> {
  checkMetafieldSize(JSON.stringify(data));
  const res = await admin.graphql(METAFIELDS_SET_MUTATION, {
    variables: {
      metafields: [
        {
          ownerId: productGid,
          namespace: NAMESPACE,
          key: IMAGE_ANALYTICS_KEY,
          type: "json",
          value: JSON.stringify(data),
        },
      ],
    },
  });
  const json = (await res.json()) as {
    data?: { metafieldsSet?: { userErrors: Array<{ message: string }> } };
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

export async function mergeAndSaveImageMetrics(
  admin: { graphql: AdminGraphql },
  productGid: string,
  imageMetrics: Array<{ media_id: string; viewed: boolean; zoomed: boolean; active_time_ms: number }>,
): Promise<ProductImageAnalytics> {
  const existing = await readProductImageAnalytics(admin, productGid);
  const merged = mergeImageMetricsIntoProduct(existing, imageMetrics);
  await writeProductImageAnalytics(admin, productGid, merged);
  return merged;
}
