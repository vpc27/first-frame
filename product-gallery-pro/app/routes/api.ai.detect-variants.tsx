/**
 * API Route: AI Variant Detection
 *
 * POST - Detect variants for product images using AI vision model
 * GET  - Check AI detection availability
 */

import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import {
  detectVariantsForImages,
  checkAIDetectionAvailable,
} from "~/lib/ai-detection.server";
import { getVariantMapping } from "~/lib/variant-mapping.server";
import { logError, logInfo } from "~/lib/logging.server";
import type { AIDetectionRequest, AIDetectionResponse } from "~/types/variant-mapping";

/**
 * GET: Check if AI detection is available
 */
export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  try {
    const isAvailable = await checkAIDetectionAvailable();

    return json({
      success: true,
      data: {
        available: isAvailable,
        model: "llava + claude-fallback",
      },
    });
  } catch (error) {
    logError("AI detection availability check failed", error);
    return json(
      {
        success: false,
        error: "Failed to check AI availability",
      },
      { status: 500 }
    );
  }
}

/**
 * POST: Run AI variant detection on product images
 */
export async function action({ request }: ActionFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const shopId = session.shop;

  if (request.method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, { status: 405 });
  }

  try {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return json(
        { success: false, error: "Content-Type must be application/json" },
        { status: 400 }
      );
    }

    const body = (await request.json()) as AIDetectionRequest;

    if (!body.productId) {
      return json(
        { success: false, error: "Missing productId in request body" },
        { status: 400 }
      );
    }

    logInfo("AI variant detection started", {
      shopId,
      productId: body.productId,
      specificMediaIds: body.mediaIds?.length,
    });

    // Load product data
    const { product } = await getVariantMapping(admin, body.productId);

    if (!product) {
      return json(
        { success: false, error: "Product not found" },
        { status: 404 }
      );
    }

    // Filter media if specific IDs provided
    let mediaToProcess = product.media;
    if (body.mediaIds && body.mediaIds.length > 0) {
      mediaToProcess = product.media.filter((m) =>
        body.mediaIds!.includes(m.id)
      );
    }

    if (mediaToProcess.length === 0) {
      return json({
        success: true,
        data: {
          success: true,
          results: [],
          totalProcessed: 0,
          totalMatched: 0,
          processingTime: 0,
        } as AIDetectionResponse,
      });
    }

    // Check AI availability
    const aiAvailable = await checkAIDetectionAvailable();

    // Run detection
    const { results, totalProcessed, totalMatched, processingTime } =
      await detectVariantsForImages(
        mediaToProcess,
        product.variants,
        {
          title: product.title,
          type: product.productType,
        },
        {
          concurrency: 3, // Process 3 images concurrently
          useAI: aiAvailable,
        }
      );

    logInfo("AI variant detection complete", {
      shopId,
      productId: body.productId,
      totalProcessed,
      totalMatched,
      processingTime,
      aiUsed: aiAvailable,
    });

    const response: AIDetectionResponse = {
      success: true,
      results,
      totalProcessed,
      totalMatched,
      processingTime,
    };

    return json({ success: true, data: response });
  } catch (error) {
    logError("AI variant detection failed", error, { shopId });
    return json(
      {
        success: false,
        error: "Failed to detect variants",
      },
      { status: 500 }
    );
  }
}
