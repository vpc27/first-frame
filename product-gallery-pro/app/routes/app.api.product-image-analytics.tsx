import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { readProductImageAnalytics } from "~/lib/analyticsMetafields.server";
import { PRODUCT_WITH_MEDIA, type MediaNode } from "~/lib/shopifyGraphql.server";
import { toProductGid } from "~/lib/productId.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const url = new URL(request.url);
  const rawId = url.searchParams.get("productId") ?? "";
  const productGid = toProductGid(decodeURIComponent(rawId));

  try {
    const [mediaRes, imageAnalytics] = await Promise.all([
      admin.graphql(PRODUCT_WITH_MEDIA, { variables: { id: productGid } }),
      readProductImageAnalytics({ graphql: admin.graphql }, productGid).catch(
        () => null,
      ),
    ]);

    const mediaJson = (await mediaRes.json()) as {
      data?: {
        product?: {
          title: string;
          media: {
            nodes: MediaNode[];
          };
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (mediaJson.errors?.length) {
      console.error("[Image Analytics API] GraphQL errors:", mediaJson.errors);
    }

    const product = mediaJson.data?.product ?? null;

    // Filter out empty nodes (GraphQL returns empty objects for unmatched fragments)
    const media = (product?.media?.nodes ?? []).filter(
      (n) => n && n.id,
    );

    return json({
      productTitle: product?.title ?? "Unknown",
      media,
      imageAnalytics,
    });
  } catch (error) {
    console.error("[Image Analytics API] Error:", error);
    return json(
      {
        productTitle: "Error",
        media: [],
        imageAnalytics: null,
        error: error instanceof Error ? error.message : "Internal error",
      },
      { status: 200 },
    );
  }
}
