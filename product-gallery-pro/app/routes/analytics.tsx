import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { unauthenticated } from "../shopify.server";
import {
  mergeAndSaveSession,
  mergeAndSaveImageMetrics,
  type SessionSummary,
} from "~/lib/analyticsMetafields.server";

// CORS headers - required for app proxy and direct requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Requested-With",
  "Access-Control-Max-Age": "86400",
};

// Health check endpoint
export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const shop = url.searchParams.get("shop") || "unknown";

  return json(
    {
      success: true,
      message: "Product Gallery Pro Analytics API",
      shop,
      timestamp: new Date().toISOString(),
    },
    { headers: corsHeaders },
  );
}

// Receive aggregated session summaries and merge into metafields
export async function action({ request }: ActionFunctionArgs) {
  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  console.log("[Analytics API] POST request received");

  try {
    const bodyText = await request.text();
    console.log("[Analytics API] Body:", bodyText.substring(0, 500));

    let body: SessionSummary;
    try {
      body = JSON.parse(bodyText);
    } catch {
      console.error("[Analytics API] Invalid JSON body");
      return json(
        { success: false, error: "Invalid JSON" },
        { status: 400, headers: corsHeaders },
      );
    }

    // Extract shop domain from payload or query params
    const url = new URL(request.url);
    const shop =
      body.shop ||
      url.searchParams.get("shop") ||
      request.headers.get("X-Shopify-Shop-Domain");

    if (!shop) {
      console.error("[Analytics API] No shop identifier found");
      return json(
        { success: false, error: "Missing shop identifier" },
        { status: 400, headers: corsHeaders },
      );
    }

    console.log("[Analytics API] Shop:", shop);

    if (!body.counts) {
      console.error("[Analytics API] Missing counts in payload");
      return json(
        { success: false, error: "Missing counts" },
        { status: 400, headers: corsHeaders },
      );
    }

    // Use unauthenticated admin API — uses stored offline session token
    // This doesn't require request-level auth (no signature needed)
    let adminApi;
    try {
      const { admin } = await unauthenticated.admin(shop);
      adminApi = admin;
      console.log("[Analytics API] Got admin client for shop:", shop);
    } catch (e) {
      console.error("[Analytics API] Failed to get admin client:", e);
      return json(
        {
          success: false,
          error: "Could not authenticate with shop",
        },
        { status: 500, headers: corsHeaders },
      );
    }

    // Merge session summary into shop metafield
    // mergeAndSaveSession expects { graphql: fn }
    const merged = await mergeAndSaveSession({ graphql: adminApi.graphql }, body);
    console.log(
      `[Analytics API] Merged summary — totalViews: ${merged.totalViews}, videoPlays: ${merged.videoPlays}`,
    );

    // Merge per-image metrics into product metafields (non-fatal)
    if (body.image_metrics && body.image_metrics.length > 0 && body.products) {
      for (const prod of body.products) {
        try {
          const productGid = prod.product_id.startsWith("gid://")
            ? prod.product_id
            : `gid://shopify/Product/${prod.product_id}`;
          await mergeAndSaveImageMetrics(
            { graphql: adminApi.graphql },
            productGid,
            body.image_metrics,
          );
          console.log(`[Analytics API] Merged image metrics for product ${productGid}`);
        } catch (imgErr) {
          console.error(`[Analytics API] Image metrics merge failed for ${prod.product_id}:`, imgErr);
        }
      }
    }

    return json(
      { success: true, received: 1, persisted: true },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error("[Analytics API] Error:", error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal error",
      },
      { status: 500, headers: corsHeaders },
    );
  }
}
