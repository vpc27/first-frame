/**
 * Rules Preview API (PGP-F2.0)
 *
 * Allows testing rules against sample contexts:
 * - POST /api/rules/preview - Test a rule or set of rules
 */

import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import type { Rule, RuleEvaluationContext, MediaItem, ShopRulesMetafield } from "~/types/rules";
import { evaluateRules, createMinimalContext } from "~/lib/rules/evaluator";

// =============================================================================
// ACTION (POST)
// =============================================================================

export const action = async ({ request }: ActionFunctionArgs) => {
  await authenticate.admin(request);

  try {
    const body = await request.json();
    const { rules, context: partialContext, settings } = body as {
      rules: Rule[];
      context?: Partial<RuleEvaluationContext>;
      settings?: ShopRulesMetafield["globalSettings"];
    };

    if (!rules || !Array.isArray(rules)) {
      return json(
        { success: false, error: "Rules array is required" },
        { status: 400 }
      );
    }

    // Create sample media if not provided
    const sampleMedia: MediaItem[] = partialContext?.media || [
      {
        id: "media_1",
        type: "image",
        src: "https://example.com/image1.jpg",
        alt: "Product image 1",
        position: 0,
        tags: ["hero", "product-shot"],
        variantValues: ["Red"],
        universal: false,
      },
      {
        id: "media_2",
        type: "image",
        src: "https://example.com/image2.jpg",
        alt: "Product image 2",
        position: 1,
        tags: ["lifestyle"],
        variantValues: ["Red", "Blue"],
        universal: false,
      },
      {
        id: "media_3",
        type: "image",
        src: "https://example.com/image3.jpg",
        alt: "Product image 3",
        position: 2,
        tags: ["product-shot"],
        variantValues: ["Blue"],
        universal: false,
      },
      {
        id: "media_4",
        type: "image",
        src: "https://example.com/image4.jpg",
        alt: "Universal product image",
        position: 3,
        tags: ["universal"],
        universal: true,
      },
      {
        id: "media_5",
        type: "video",
        src: "https://example.com/video.mp4",
        alt: "Product video",
        position: 4,
        tags: ["video"],
        universal: true,
      },
    ];

    // Create full context from partial context
    const context = createMinimalContext(sampleMedia, partialContext);

    // Use default settings if not provided
    const globalSettings: ShopRulesMetafield["globalSettings"] = settings || {
      enableRules: true,
      fallbackBehavior: "default_gallery",
      maxRulesPerEvaluation: 50,
      useLegacyFallback: true,
    };

    // Evaluate rules
    const result = evaluateRules(rules, context, globalSettings);

    return json({
      success: true,
      data: {
        result: {
          media: result.media,
          matchedRules: result.matchedRules.map((r) => ({
            id: r.id,
            name: r.name,
          })),
          evaluationTimeMs: result.evaluationTimeMs,
          usedLegacyFallback: result.usedLegacyFallback,
        },
        debug: result.debug,
        context: {
          device: context.device,
          variant: context.variant,
          customer: context.customer,
          time: context.time,
        },
      },
    });
  } catch (error) {
    console.error("[Rules Preview API] Error:", error);
    return json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
};

// =============================================================================
// LOADER (GET - Sample contexts)
// =============================================================================

export const loader = async () => {
  // Return sample contexts that can be used for testing
  return json({
    success: true,
    data: {
      sampleContexts: [
        {
          name: "Mobile visitor from Instagram",
          description: "Mobile device, traffic from Instagram UTM",
          context: {
            device: "mobile",
            screenWidth: 375,
            traffic: {
              path: "/products/test-product",
              utmSource: "instagram",
              utmMedium: "social",
            },
            customer: {
              isLoggedIn: false,
              tags: [],
            },
            variant: {
              selectedOptions: { Color: "Red" },
              selectedValues: ["Red"],
            },
          },
        },
        {
          name: "VIP customer on desktop",
          description: "Logged in VIP customer on desktop",
          context: {
            device: "desktop",
            screenWidth: 1920,
            customer: {
              isLoggedIn: true,
              tags: ["VIP", "wholesale"],
              orderCount: 10,
              totalSpent: 5000,
            },
            variant: {
              selectedOptions: {},
              selectedValues: [],
            },
          },
        },
        {
          name: "Low stock product",
          description: "Product with low inventory",
          context: {
            device: "desktop",
            screenWidth: 1440,
            inventory: {
              totalInventory: 3,
              variantInventory: {},
              inStock: true,
            },
            variant: {
              selectedOptions: { Size: "Large" },
              selectedValues: ["Large"],
            },
          },
        },
        {
          name: "First-time visitor",
          description: "New visitor on their first page view",
          context: {
            device: "tablet",
            screenWidth: 768,
            session: {
              isFirstVisit: true,
              pageViews: 1,
              duration: 0,
              viewedProductIds: [],
              viewedCollectionIds: [],
            },
            customer: {
              isLoggedIn: false,
              tags: [],
            },
          },
        },
        {
          name: "US visitor",
          description: "Visitor from United States",
          context: {
            device: "desktop",
            screenWidth: 1440,
            geo: {
              country: "US",
              region: "CA",
            },
            variant: {
              selectedOptions: {},
              selectedValues: [],
            },
          },
        },
      ],
    },
  });
};
