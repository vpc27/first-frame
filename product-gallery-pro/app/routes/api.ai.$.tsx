import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  checkOllamaHealth,
  generateAltText as generateAltTextOllama,
  scoreImageQuality,
} from "~/lib/ollama.server";
import { generateAltText } from "~/lib/alt-text/service.server";
import { authenticate } from "../shopify.server";
import {
  PRODUCT_WITH_MEDIA,
  PRODUCT_UPDATE_MEDIA_ALT,
} from "~/lib/shopifyGraphql.server";
import type { ProductWithMediaResult } from "~/lib/shopifyGraphql.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const path = url.pathname.replace("/api/ai/", "");

  if (path === "health") {
    const isHealthy = await checkOllamaHealth();
    return json({
      success: true,
      data: {
        available: isHealthy,
      },
    });
  }

  return json({ error: "Not found" }, { status: 404 });
}

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const path = url.pathname.replace("/api/ai/", "");

  try {
    const body = (await request.json()) as Record<string, unknown>;

    switch (path) {
      case "alt-text": {
        const { imageUrl, productTitle, productType, productVendor } = body as {
          imageUrl: string;
          productTitle: string;
          productType?: string;
          productVendor?: string;
        };
        if (!imageUrl || !productTitle) {
          return json(
            {
              success: false,
              error: "Missing required fields: imageUrl, productTitle",
            },
            { status: 400 },
          );
        }
        const result = await generateAltTextOllama({
          imageUrl,
          productTitle,
          productType,
          productVendor,
        });
        return json(result);
      }

      case "generate-alt-text": {
        const { imageUrl, productTitle, productType, productVendor } = body as {
          imageUrl: string;
          productTitle: string;
          productType?: string;
          productVendor?: string;
        };
        if (!imageUrl || !productTitle) {
          return json(
            {
              success: false,
              error: "Missing required fields: imageUrl, productTitle",
            },
            { status: 400 },
          );
        }
        console.log(`[generate-alt-text] Generating for: ${productTitle}, image: ${imageUrl.slice(0, 80)}...`);
        const result = await generateAltText({
          imageUrl,
          productTitle,
          productType,
          productVendor,
        });
        if (!result.success) {
          console.error(`[generate-alt-text] Failed:`, result.error);
        } else {
          console.log(`[generate-alt-text] Success:`, result.data?.altText?.slice(0, 60));
        }
        return json(result);
      }

      case "generate-alt-text-bulk": {
        const { admin } = await authenticate.admin(request);
        const { productId, mediaIds, overwriteExisting } = body as {
          productId: string;
          mediaIds?: string[];
          overwriteExisting?: boolean;
        };
        if (!productId) {
          return json(
            { success: false, error: "Missing required field: productId" },
            { status: 400 },
          );
        }

        const response = await admin.graphql(PRODUCT_WITH_MEDIA, {
          variables: { id: productId },
        });
        const gqlResult = (await response.json()) as { data: ProductWithMediaResult };
        const product = gqlResult.data?.product;
        if (!product) {
          return json(
            { success: false, error: "Product not found" },
            { status: 404 },
          );
        }

        let mediaToProcess = product.media.nodes.filter(
          (m) => m.mediaContentType === "IMAGE" && m.image?.url,
        );

        if (mediaIds && mediaIds.length > 0) {
          mediaToProcess = mediaToProcess.filter((m) =>
            mediaIds.includes(m.id),
          );
        }

        if (!overwriteExisting) {
          mediaToProcess = mediaToProcess.filter(
            (m) => !m.alt || m.alt.trim() === "",
          );
        }

        const results: Array<{
          mediaId: string;
          success: boolean;
          altText?: string;
          confidence?: number;
          keywords?: string[];
          error?: string;
        }> = [];

        for (const media of mediaToProcess) {
          const result = await generateAltText({
            imageUrl: media.image!.url,
            productTitle: product.title,
            productType: product.productType ?? undefined,
            productVendor: product.vendor,
          });

          results.push({
            mediaId: media.id,
            success: result.success,
            altText: result.data?.altText,
            confidence: result.data?.confidence,
            keywords: result.data?.keywords,
            error: result.error,
          });
        }

        return json({
          success: true,
          data: {
            results,
            totalProcessed: results.length,
            totalSucceeded: results.filter((r) => r.success).length,
          },
        });
      }

      case "save-alt-text": {
        const { admin } = await authenticate.admin(request);
        const { productId, updates } = body as {
          productId: string;
          updates: Array<{ mediaId: string; altText: string }>;
        };

        if (!productId || !updates || updates.length === 0) {
          return json(
            {
              success: false,
              error: "Missing required fields: productId, updates",
            },
            { status: 400 },
          );
        }

        const media = updates.map((u) => ({
          id: u.mediaId,
          alt: u.altText,
        }));

        const response = await admin.graphql(PRODUCT_UPDATE_MEDIA_ALT, {
          variables: { productId, media },
        });

        const gqlResult = (await response.json()) as {
          data?: {
            productUpdateMedia: {
              media: Array<{ id: string; alt: string }>;
              mediaUserErrors: Array<{ field: string[]; message: string }>;
            };
          };
        };

        const errors =
          gqlResult.data?.productUpdateMedia?.mediaUserErrors ?? [];
        if (errors.length > 0) {
          return json(
            {
              success: false,
              error: errors.map((e) => e.message).join(", "),
            },
            { status: 400 },
          );
        }

        return json({
          success: true,
          data: {
            updated: gqlResult.data?.productUpdateMedia?.media ?? [],
          },
        });
      }

      case "quality-score": {
        const { imageUrl } = body as { imageUrl: string };
        if (!imageUrl) {
          return json(
            {
              success: false,
              error: "Missing required field: imageUrl",
            },
            { status: 400 },
          );
        }
        const result = await scoreImageQuality({ imageUrl });
        return json(result);
      }
      default:
        return json({ error: "Unknown AI endpoint" }, { status: 404 });
    }
  } catch (error) {
    return json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "AI processing failed",
      },
      { status: 500 },
    );
  }
}
