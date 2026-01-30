/**
 * Products Listing Page
 *
 * Shows all products with mapping status and quick actions.
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useNavigation } from "@remix-run/react";
import { useState, useMemo } from "react";
import {
  Page,
  Card,
  Text,
  Badge,
  BlockStack,
  InlineStack,
  TextField,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonThumbnail,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { colors, borderRadius, spacing } from "~/styles/design-system";

const PRODUCTS_WITH_MAPPING_QUERY = `#graphql
  query ProductsWithMapping($first: Int!, $query: String) {
    products(first: $first, sortKey: UPDATED_AT, reverse: true, query: $query) {
      nodes {
        id
        title
        handle
        featuredImage {
          url(transform: { maxWidth: 80 })
        }
        variantsCount {
          count
        }
        metafield(namespace: "product_gallery_pro", key: "variant_image_map") {
          value
        }
        media(first: 1) {
          nodes {
            ... on MediaImage {
              id
            }
          }
        }
        totalInventory
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

type ProductNode = {
  id: string;
  title: string;
  handle: string;
  featuredImage: { url: string } | null;
  variantsCount: { count: number };
  metafield: { value: string } | null;
  media: { nodes: Array<{ id: string }> };
  totalInventory: number;
};

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const search = url.searchParams.get("q") || "";

  const response = await admin.graphql(PRODUCTS_WITH_MAPPING_QUERY, {
    variables: {
      first: 50,
      query: search ? `title:*${search}*` : null,
    },
  });

  const result = (await response.json()) as {
    data?: {
      products: {
        nodes: ProductNode[];
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    };
  };

  const products = result.data?.products?.nodes ?? [];

  const productsWithStatus = products.map((p) => {
    let mappingStatus: "mapped" | "unmapped" | "partial" = "unmapped";
    if (p.metafield?.value) {
      try {
        const mapping = JSON.parse(p.metafield.value);
        const mappingCount = Object.keys(mapping.mappings || {}).length;
        const mediaCount = p.media.nodes.length;
        if (mappingCount > 0 && mappingCount >= mediaCount) {
          mappingStatus = "mapped";
        } else if (mappingCount > 0) {
          mappingStatus = "partial";
        }
      } catch {
        // ignore parse errors
      }
    }
    return {
      id: p.id,
      title: p.title,
      handle: p.handle,
      thumbnail: p.featuredImage?.url || null,
      variantCount: p.variantsCount?.count ?? 0,
      mappingStatus,
    };
  });

  return json({ products: productsWithStatus, search });
};

export default function ProductsPage() {
  const { products, search: initialSearch } = useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";
  const [searchValue, setSearchValue] = useState(initialSearch || "");

  const productIdForUrl = (id: string) => {
    const m = id.match(/gid:\/\/shopify\/Product\/(\d+)/);
    return m ? m[1] : encodeURIComponent(id);
  };

  const statusBadge = (status: string) => {
    if (status === "mapped") return <Badge tone="success">Mapped</Badge>;
    if (status === "partial") return <Badge tone="attention">Partial</Badge>;
    return <Badge tone="info">Unmapped</Badge>;
  };

  const handleSearch = () => {
    if (searchValue) {
      navigate(`/app/products?q=${encodeURIComponent(searchValue)}`);
    } else {
      navigate("/app/products");
    }
  };

  if (isLoading) {
    return (
      <Page backAction={{ url: "/app" }}>
        <TitleBar title="Products" />
        <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "24px" }}>
          <BlockStack gap="600">
            <Text as="h1" variant="headingLg">Products</Text>
            <Card>
              <BlockStack gap="400">
                {[1,2,3,4,5].map(i => (
                  <InlineStack key={i} gap="400" blockAlign="center">
                    <SkeletonThumbnail size="small" />
                    <div style={{ flex: 1 }}><SkeletonBodyText lines={1} /></div>
                  </InlineStack>
                ))}
              </BlockStack>
            </Card>
          </BlockStack>
        </div>
      </Page>
    );
  }

  return (
    <Page backAction={{ url: "/app" }}>
      <TitleBar title="Products" />

      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: spacing[6] }}>
        <BlockStack gap="600">
          <InlineStack align="space-between" blockAlign="center">
            <Text as="h1" variant="headingLg">
              Products
            </Text>
          </InlineStack>

          {/* Search */}
          <div style={{ maxWidth: "400px" }}>
            <TextField
              label="Search products"
              labelHidden
              value={searchValue}
              onChange={setSearchValue}
              placeholder="Search by title..."
              autoComplete="off"
              onBlur={handleSearch}
              connectedRight={
                <button
                  onClick={handleSearch}
                  style={{
                    padding: `${spacing[2]} ${spacing[3]}`,
                    background: colors.primary[500],
                    color: "white",
                    border: "none",
                    borderRadius: `0 ${borderRadius.md} ${borderRadius.md} 0`,
                    cursor: "pointer",
                    fontSize: "13px",
                    fontWeight: 500,
                  }}
                >
                  Search
                </button>
              }
            />
          </div>

          {/* Product list */}
          {products.length === 0 ? (
            <Card>
              <div style={{ padding: spacing[8], textAlign: "center", color: colors.neutral[500] }}>
                <Text as="p">No products found.</Text>
              </div>
            </Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: spacing[2] }}>
              {products.map((product) => (
                <div
                  key={product.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: spacing[4],
                    padding: spacing[4],
                    background: colors.neutral[0],
                    border: `1px solid ${colors.neutral[200]}`,
                    borderRadius: borderRadius.md,
                    cursor: "pointer",
                    transition: "border-color 0.15s",
                  }}
                  onClick={() => navigate(`/app/product-gallery/${productIdForUrl(product.id)}`)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = colors.primary[300];
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = colors.neutral[200];
                  }}
                >
                  {/* Thumbnail */}
                  <div
                    style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: borderRadius.sm,
                      overflow: "hidden",
                      background: colors.neutral[100],
                      flexShrink: 0,
                    }}
                  >
                    {product.thumbnail ? (
                      <img
                        src={product.thumbnail}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "100%",
                          height: "100%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: colors.neutral[400],
                          fontSize: "11px",
                        }}
                      >
                        No img
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: colors.neutral[900],
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {product.title}
                    </div>
                    <div style={{ fontSize: "12px", color: colors.neutral[500], marginTop: "2px" }}>
                      {product.variantCount} variant{product.variantCount !== 1 ? "s" : ""}
                    </div>
                  </div>

                  {/* Status */}
                  <div>{statusBadge(product.mappingStatus)}</div>

                  {/* Actions */}
                  <InlineStack gap="200">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/app/product-gallery/${productIdForUrl(product.id)}`);
                      }}
                      style={{
                        padding: `${spacing[1]} ${spacing[3]}`,
                        background: colors.primary[500],
                        color: "white",
                        border: "none",
                        borderRadius: borderRadius.md,
                        fontSize: "12px",
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      Edit Images
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/app/experience/${productIdForUrl(product.id)}`);
                      }}
                      style={{
                        padding: `${spacing[1]} ${spacing[3]}`,
                        background: "transparent",
                        color: colors.primary[600],
                        border: `1px solid ${colors.primary[300]}`,
                        borderRadius: borderRadius.md,
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      Experience
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/app/products/${productIdForUrl(product.id)}`);
                      }}
                      style={{
                        padding: `${spacing[1]} ${spacing[3]}`,
                        background: "transparent",
                        color: colors.neutral[600],
                        border: `1px solid ${colors.neutral[300]}`,
                        borderRadius: borderRadius.md,
                        fontSize: "12px",
                        cursor: "pointer",
                      }}
                    >
                      AI Analysis
                    </button>
                  </InlineStack>
                </div>
              ))}
            </div>
          )}
        </BlockStack>
      </div>
    </Page>
  );
}
