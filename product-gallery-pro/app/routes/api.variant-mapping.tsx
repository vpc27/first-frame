/**
 * API Route: Variant Image Mapping
 *
 * GET  ?productId={id} - Load product data and existing mapping
 * POST                 - Save mapping to product metafield
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import {
  getVariantMapping,
  saveVariantMapping,
  deleteVariantMapping,
} from "~/lib/variant-mapping.server";
import { logError, logInfo } from "~/lib/logging.server";
import type {
  VariantImageMap,
  VariantMappingLoadResponse,
  VariantMappingSaveResponse,
} from "~/types/variant-mapping";

/**
 * GET: Load product data and existing variant mapping
 */
export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const shopId = session.shop;

  try {
    const url = new URL(request.url);
    const productId = url.searchParams.get("productId");

    if (!productId) {
      return json(
        { success: false, error: "Missing productId parameter" },
        { status: 400 }
      );
    }

    logInfo("api.variant-mapping load", { shopId, productId });

    const result: VariantMappingLoadResponse = await getVariantMapping(
      admin,
      productId
    );

    return json({ success: true, data: result });
  } catch (error) {
    logError("api.variant-mapping loader failed", error, { shopId });
    return json(
      {
        success: false,
        error: "Failed to load variant mapping",
      },
      { status: 500 }
    );
  }
}

/**
 * POST: Save variant mapping to product metafield
 * DELETE: Remove variant mapping from product
 */
export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const shopId = session.shop;

  try {
    // Handle DELETE
    if (request.method === "DELETE") {
      const url = new URL(request.url);
      const productId = url.searchParams.get("productId");

      if (!productId) {
        return json(
          { success: false, error: "Missing productId parameter" },
          { status: 400 }
        );
      }

      logInfo("api.variant-mapping delete", { shopId, productId });
      await deleteVariantMapping(admin, productId);

      return json({ success: true });
    }

    // Handle POST
    if (request.method !== "POST") {
      return json({ success: false, error: "Method not allowed" }, { status: 405 });
    }

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return json(
        { success: false, error: "Content-Type must be application/json" },
        { status: 400 }
      );
    }

    const body = (await request.json()) as {
      productId?: string;
      mapping?: VariantImageMap;
    };

    if (!body.productId) {
      return json(
        { success: false, error: "Missing productId in request body" },
        { status: 400 }
      );
    }

    if (!body.mapping) {
      return json(
        { success: false, error: "Missing mapping in request body" },
        { status: 400 }
      );
    }

    // Validate mapping structure
    if (body.mapping.version !== 1) {
      return json(
        { success: false, error: "Invalid mapping version" },
        { status: 400 }
      );
    }

    logInfo("api.variant-mapping save", {
      shopId,
      productId: body.productId,
      mappingCount: Object.keys(body.mapping.mappings).length,
    });

    const savedMapping = await saveVariantMapping(
      admin,
      body.productId,
      body.mapping
    );

    const response: VariantMappingSaveResponse = {
      success: true,
      mapping: savedMapping,
    };

    return json({ success: true, data: response });
  } catch (error) {
    logError("api.variant-mapping action failed", error, { shopId });
    return json(
      {
        success: false,
        error: "Failed to save variant mapping",
      },
      { status: 500 }
    );
  }
}
