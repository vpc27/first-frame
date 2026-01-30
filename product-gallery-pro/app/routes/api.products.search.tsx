import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import type { ProductScopeItem } from "~/types/rules";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const query = url.searchParams.get("q") || "";
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "10", 10), 25);

  if (!query.trim()) {
    return json({ products: [] });
  }

  const response = await admin.graphql(
    `#graphql
    query searchProducts($query: String!, $first: Int!) {
      products(first: $first, query: $query) {
        edges {
          node {
            id
            title
            handle
            featuredImage {
              url(transform: { maxWidth: 64, maxHeight: 64 })
            }
          }
        }
      }
    }`,
    { variables: { query, first: limit } }
  );

  const data = await response.json();
  const edges = data.data?.products?.edges || [];

  const products: ProductScopeItem[] = edges.map(
    (edge: { node: { id: string; title: string; handle: string; featuredImage?: { url: string } } }) => ({
      id: edge.node.id,
      title: edge.node.title,
      handle: edge.node.handle,
      image: edge.node.featuredImage?.url,
    })
  );

  return json({ products });
};
