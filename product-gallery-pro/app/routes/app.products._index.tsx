/**
 * Products Listing Page
 *
 * Shows all products with mapping status and quick actions.
 */

import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useNavigation } from "@remix-run/react";
import { useState } from "react";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  TextField,
  SkeletonBodyText,
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
        media(first: 50) {
          nodes {
            ... on MediaImage {
              id
              alt
            }
          }
        }
        mediaCount {
          count
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
  media: { nodes: Array<{ id: string; alt?: string | null }> };
  mediaCount: { count: number };
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
    const totalMedia = p.mediaCount?.count ?? p.media.nodes.length;
    const missingAltCount = p.media.nodes.filter(
      (m) => !m.alt || m.alt.trim() === "",
    ).length;

    return {
      id: p.id,
      title: p.title,
      handle: p.handle,
      thumbnail: p.featuredImage?.url || null,
      variantCount: p.variantsCount?.count ?? 0,
      mappingStatus,
      altTextMissing: missingAltCount,
      altTextTotal: totalMedia,
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

  const mappingLabel = (status: string) => {
    if (status === "mapped") return "Images mapped";
    if (status === "partial") return "Partially mapped";
    return "Not mapped";
  };

  const altTextLabel = (missing: number, total: number) => {
    if (missing === 0) return "Alt text complete";
    return `${missing}/${total} missing alt text`;
  };

  const handleSearch = () => {
    if (searchValue) {
      navigate(`/app/products?q=${encodeURIComponent(searchValue)}`);
    } else {
      navigate("/app/products");
    }
  };

  const handleSearchKeyDown = (e: KeyboardEvent | { key: string }) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  if (isLoading) {
    return (
      <Page>
        <TitleBar title="Products" />
        <BlockStack gap="400">
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
      </Page>
    );
  }

  return (
    <Page>
      <TitleBar title="Products" />

      <BlockStack gap="400">
        {/* Search */}
        <div style={{ maxWidth: "320px" }} onKeyDown={handleSearchKeyDown}>
          <TextField
            label="Search products"
            labelHidden
            value={searchValue}
            onChange={setSearchValue}
            placeholder="Search by title..."
            autoComplete="off"
            clearButton
            onClearButtonClick={() => { setSearchValue(""); navigate("/app/products"); }}
            prefix={
              <span style={{ color: colors.neutral[400] }}>&#128269;</span>
            }
          />
        </div>

        {/* Product list */}
        {products.length === 0 ? (
          <Card>
            <div style={{ padding: spacing[6], textAlign: "center", color: colors.neutral[500] }}>
              <Text as="p">No products found.</Text>
            </div>
          </Card>
        ) : (
          <Card padding="0">
            <div>
              {products.map((product, index) => (
                <div
                  key={product.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "14px",
                    padding: "14px 16px",
                    cursor: "pointer",
                    transition: "background 0.1s",
                    borderBottom: index < products.length - 1 ? `1px solid ${colors.neutral[100]}` : "none",
                  }}
                  onClick={() => navigate(`/app/product-gallery/${productIdForUrl(product.id)}`)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = colors.neutral[50] || "#f9fafb";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  {/* Thumbnail */}
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "8px",
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
                          fontSize: "10px",
                        }}
                      >
                        No img
                      </div>
                    )}
                  </div>

                  {/* Title + metadata line */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: colors.neutral[900],
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {product.title}
                    </div>
                    <div style={{ fontSize: "12px", color: colors.neutral[600], marginTop: "2px" }}>
                      <span>{product.variantCount} variant{product.variantCount !== 1 ? "s" : ""}</span>
                      <span style={{ margin: "0 6px" }}>·</span>
                      <span>{mappingLabel(product.mappingStatus)}</span>
                      <span style={{ margin: "0 6px" }}>·</span>
                      <span>{altTextLabel(product.altTextMissing, product.altTextTotal)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/app/product-gallery/${productIdForUrl(product.id)}`);
                      }}
                      style={{
                        padding: "6px 12px",
                        background: colors.primary[500],
                        color: "white",
                        border: "none",
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 500,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Edit Images
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/app/products/${productIdForUrl(product.id)}`);
                      }}
                      style={{
                        padding: "6px 12px",
                        background: "transparent",
                        color: colors.neutral[700],
                        border: `1px solid ${colors.neutral[300]}`,
                        borderRadius: "6px",
                        fontSize: "12px",
                        fontWeight: 500,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      AI Analysis
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </BlockStack>
    </Page>
  );
}
