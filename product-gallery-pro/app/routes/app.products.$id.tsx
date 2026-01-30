import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  useLoaderData,
  useActionData,
  useSubmit,
  useNavigation,
  Link,
} from "@remix-run/react";
import { useState, useCallback } from "react";
import { getMediaImageUrl } from "~/types/variant-mapping";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Button,
  Thumbnail,
  Box,
  Banner,
  Divider,
  DataTable,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonPage,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  PRODUCT_WITH_MEDIA,
  PRODUCT_UPDATE_MEDIA_ALT,
  type ProductWithMediaResult,
} from "~/lib/shopifyGraphql.server";
import { logError } from "~/lib/logging.server";
import { toProductGid } from "~/lib/productId.server";
import {
  readProductImageAnalytics,
  type ProductImageAnalytics,
  type ImageAnalyticsEntry,
} from "~/lib/analyticsMetafields.server";

export async function loader({
  request,
  params,
}: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);
  const rawId = params.id ?? "";
  const productId = toProductGid(decodeURIComponent(rawId));

  const response = await admin.graphql(PRODUCT_WITH_MEDIA, {
    variables: { id: productId },
  });
  const result = (await response.json()) as {
    data?: ProductWithMediaResult;
    errors?: Array<{ message: string }>;
  };

  if (result.errors?.length) {
    return json(
      {
        product: null,
        imageAnalytics: null as ProductImageAnalytics | null,
        error: result.errors.map((e) => e.message).join("; "),
      },
      { status: 200 },
    );
  }

  const product = result.data?.product ?? null;

  // Fetch per-image analytics from product metafield
  let imageAnalytics: ProductImageAnalytics | null = null;
  if (product) {
    try {
      imageAnalytics = await readProductImageAnalytics(
        { graphql: admin.graphql },
        product.id,
      );
    } catch (e) {
      console.error("[Product Detail] Failed to read image analytics:", e);
    }
  }

  return json({
    product,
    imageAnalytics,
    error: null,
  });
}

export async function action({ request }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, { status: 405 });
  }

  const { admin } = await authenticate.admin(request);

  try {
    const formData = await request.formData();
    const intent = formData.get("intent");
    const productId = formData.get("productId");
    const mediaId = formData.get("mediaId");
    const alt = formData.get("alt");

    if (
      intent !== "update_alt" ||
      typeof productId !== "string" ||
      !productId ||
      typeof mediaId !== "string" ||
      !mediaId ||
      typeof alt !== "string"
    ) {
      return json(
        { ok: false, error: "Missing intent, productId, mediaId, or alt" },
        { status: 400 },
      );
    }

    const mutationResponse = await admin.graphql(PRODUCT_UPDATE_MEDIA_ALT, {
      variables: {
        productId,
        media: [{ id: mediaId, alt }],
      },
    });

    const mutationResult = (await mutationResponse.json()) as {
      data?: {
        productUpdateMedia?: {
          media: Array<{ id: string; alt: string | null }>;
          mediaUserErrors: Array<{ field: string[]; message: string }>;
        };
      };
      errors?: Array<{ message: string }>;
    };

    if (mutationResult.errors?.length) {
      return json(
        {
          ok: false,
          error: mutationResult.errors.map((e) => e.message).join("; "),
        },
        { status: 200 },
      );
    }

    const payload = mutationResult.data?.productUpdateMedia;
    const userErrors = payload?.mediaUserErrors ?? [];
    if (userErrors.length) {
      return json(
        {
          ok: false,
          error: userErrors.map((e) => e.message).join("; "),
        },
        { status: 200 },
      );
    }

    return json({ ok: true });
  } catch (err) {
    logError("Product update media alt failed", err);
    return json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Update failed",
      },
      { status: 200 },
    );
  }
}

/** Default minimum sessions before showing data. Set to 0 to always show. */
const MIN_SESSIONS_THRESHOLD = 0;

function numericId(id: string | undefined | null): string {
  if (!id) return "";
  const match = id.match(/(\d+)$/);
  return match ? match[1] : id;
}

function getRecommendation(
  entry: ImageAnalyticsEntry,
  position: number,
  totalImages: number,
  totalProductSessions: number,
  isVideo: boolean,
): string {
  if (totalImages <= 1) return "\u2014";

  const seenPct = totalProductSessions > 0 ? entry.sessions / totalProductSessions : 0;
  const zoomRate = entry.sessions > 0 ? entry.zoomSessions / entry.sessions : 0;
  const avgTimeMs = entry.sessions > 0 ? entry.totalActiveTimeMs / entry.sessions : 0;

  // For videos, engagement is time-only; for images, weighted zoom + time
  const engagement = isVideo
    ? Math.min(avgTimeMs / 5000, 1)
    : zoomRate * 0.5 + Math.min(avgTimeMs / 5000, 1) * 0.5;

  if (position === 0 && engagement < 0.1 && totalImages > 2)
    return "Consider replacing hero image";
  if (position === 0) return "\u2014";
  if (seenPct < 0.4 && engagement > 0.4) return "Move earlier";
  if (seenPct > 0.6 && engagement < 0.15) return "Move down";
  if (seenPct < 0.2 && engagement < 0.1) return "Remove or replace";
  if (isVideo && seenPct < 0.3) return "Promote video";
  return "\u2014";
}

function getZoomBadge(
  zoomSessions: number,
  sessions: number,
): { label: string; tone: "success" | "warning" | "attention" | "info" | undefined } {
  if (sessions === 0) return { label: "None", tone: undefined };
  const rate = zoomSessions / sessions;
  if (rate > 0.3) return { label: "High", tone: "success" };
  if (rate > 0.15) return { label: "Medium", tone: "attention" };
  if (rate > 0) return { label: "Low", tone: "warning" };
  return { label: "None", tone: undefined };
}

type MediaNode = ProductWithMediaResult["product"] extends infer P
  ? P extends { media: { nodes: infer N } }
    ? N extends (infer M)[]
      ? M
      : never
    : never
  : never;

export default function ProductAiPage() {
  const { product, imageAnalytics, error } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [analyzing, setAnalyzing] = useState<Record<string, "alt" | "quality" | null>>({});
  const [aiAlt, setAiAlt] = useState<Record<string, { altText: string; confidence?: number }>>({});
  const [aiQuality, setAiQuality] = useState<
    Record<string, { overallScore: number; recommendation?: string; isAcceptable?: boolean }>
  >({});
  const [applyError, setApplyError] = useState<string | null>(null);

  const baseUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}`
      : "";

  const runAltAnalysis = useCallback(
    async (imageUrl: string, mediaId: string, productTitle: string, productType?: string, vendor?: string) => {
      setAnalyzing((p) => ({ ...p, [mediaId]: "alt" }));
      setApplyError(null);
      try {
        const res = await fetch(`${baseUrl}/api/ai/alt-text`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl,
            productTitle,
            productType: productType ?? undefined,
            productVendor: vendor ?? undefined,
          }),
        });
        const data = (await res.json()) as {
          success?: boolean;
          data?: { altText: string; confidence?: number };
          error?: string;
        };
        if (data.success && data.data) {
          setAiAlt((p) => ({ ...p, [mediaId]: data.data! }));
        } else {
          setApplyError(data.error ?? "Alt-text analysis failed");
        }
      } catch (e) {
        setApplyError(e instanceof Error ? e.message : "Request failed");
      } finally {
        setAnalyzing((p) => ({ ...p, [mediaId]: null }));
      }
    },
    [baseUrl],
  );

  const runQualityAnalysis = useCallback(
    async (imageUrl: string, mediaId: string) => {
      setAnalyzing((p) => ({ ...p, [mediaId]: "quality" }));
      setApplyError(null);
      try {
        const res = await fetch(`${baseUrl}/api/ai/quality-score`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageUrl }),
        });
        const data = (await res.json()) as {
          success?: boolean;
          data?: {
            overallScore: number;
            recommendation?: string;
            isAcceptable?: boolean;
          };
          error?: string;
        };
        if (data.success && data.data) {
          setAiQuality((p) => ({ ...p, [mediaId]: data.data! }));
        } else {
          setApplyError(data.error ?? "Quality analysis failed");
        }
      } catch (e) {
        setApplyError(e instanceof Error ? e.message : "Request failed");
      } finally {
        setAnalyzing((p) => ({ ...p, [mediaId]: null }));
      }
    },
    [baseUrl],
  );

  const applyAltToShopify = useCallback(
    (mediaId: string, alt: string) => {
      if (!product) return;
      setApplyError(null);
      const fd = new FormData();
      fd.set("intent", "update_alt");
      fd.set("productId", product.id);
      fd.set("mediaId", mediaId);
      fd.set("alt", alt);
      submit(fd, { method: "post" });
    },
    [product, submit],
  );

  if (error || !product) {
    return (
      <Page>
        <TitleBar title="Product AI" />
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Banner tone="critical" title="Error">
                  {error ?? "Product not found."}
                </Banner>
                <Link to="/app/products">
                  <Button>Back to Products</Button>
                </Link>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  if (navigation.state === "loading") {
    return (
      <Page>
        <TitleBar title="Product AI" />
        <BlockStack gap="500">
          <Layout>
            <Layout.Section>
              <Card><SkeletonDisplayText size="small" /><SkeletonBodyText lines={2} /></Card>
              {[1,2,3,4].map(i => (
                <Card key={i}><SkeletonBodyText lines={4} /></Card>
              ))}
            </Layout.Section>
          </Layout>
        </BlockStack>
      </Page>
    );
  }

  const mediaNodes = (product.media?.nodes ?? []).filter(
    (n): n is MediaNode & { id: string } =>
      n != null && "id" in n && (n.image?.url != null || n.preview?.image?.url != null),
  );
  const isSubmitting = navigation.state === "submitting";

  return (
    <Page>
      <TitleBar title={`AI: ${product.title}`} />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <InlineStack align="space-between" blockAlign="center" wrap>
              <Link to="/app/products">
                <Button variant="plain">&larr; Products</Button>
              </Link>
            </InlineStack>
            {(applyError || (actionData && !actionData.ok && "error" in actionData)) && (
              <Box paddingBlockEnd="200">
                <Banner
                  tone="critical"
                  onDismiss={() => {
                    setApplyError(null);
                  }}
                >
                  {applyError ?? (actionData && "error" in actionData ? String(actionData.error) : "")}
                </Banner>
              </Box>
            )}
            {navigation.state === "submitting" && (
              <Banner tone="info">Applying alt text to Shopify...</Banner>
            )}
            {actionData?.ok === true && (
              <Banner tone="success">
                Alt text saved to Shopify. Refresh the product in the admin to
                see it.
              </Banner>
            )}
            <BlockStack gap="400">
              <Text as="h1" variant="headingLg">
                {product.title}
              </Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                {product.productType ?? "No type"} &middot; {product.vendor ?? "No vendor"}
              </Text>
              {mediaNodes.length > 0 && (
                <Text as="p" variant="bodyMd" tone="subdued">
                  Run alt-text and quality analysis on each image, then use
                  "Apply to Shopify" to save suggested alt text.
                </Text>
              )}
            </BlockStack>
            <BlockStack gap="500">
              {mediaNodes.length === 0 ? (
                <Card>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    No images on this product. Add media in Shopify to run AI
                    analysis.
                  </Text>
                </Card>
              ) : (
                mediaNodes.map((media) => {
                  const url = media.image?.url ?? media.preview?.image?.url ?? "";
                  const currentAlt = media.alt ?? media.image?.altText ?? media.preview?.image?.altText ?? "";
                  const altResult = aiAlt[media.id];
                  const qualityResult = aiQuality[media.id];
                  const loadingAlt = analyzing[media.id] === "alt";
                  const loadingQuality = analyzing[media.id] === "quality";

                  return (
                    <Card key={media.id}>
                      <BlockStack gap="400">
                        <InlineStack gap="400" blockAlign="center" wrap>
                          <Thumbnail
                            source={url}
                            alt={currentAlt || "Product image"}
                            size="large"
                          />
                          <BlockStack gap="200">
                            <Text as="span" variant="bodyMd" fontWeight="medium">
                              Current alt text
                            </Text>
                            <Text as="span" variant="bodySm" tone="subdued">
                              {currentAlt || "---"}
                            </Text>
                            {altResult && (
                              <>
                                <Text as="span" variant="bodyMd" fontWeight="medium">
                                  Suggested alt text
                                </Text>
                                <Text as="span" variant="bodySm">
                                  {altResult.altText}
                                  {altResult.confidence != null && (
                                    <span> ({(altResult.confidence * 100).toFixed(0)}%)</span>
                                  )}
                                </Text>
                                <Button
                                  size="slim"
                                  onClick={() => applyAltToShopify(media.id, altResult.altText)}
                                  loading={isSubmitting}
                                  disabled={isSubmitting}
                                >
                                  Apply to Shopify
                                </Button>
                              </>
                            )}
                          </BlockStack>
                        </InlineStack>
                        <Divider />
                        <InlineStack gap="200" wrap>
                          <Button
                            size="slim"
                            onClick={() =>
                              runAltAnalysis(
                                url,
                                media.id,
                                product.title,
                                product.productType ?? undefined,
                                product.vendor,
                              )
                            }
                            loading={loadingAlt}
                            disabled={loadingAlt || loadingQuality}
                          >
                            {loadingAlt ? "Analyzing..." : "Generate alt text"}
                          </Button>
                          <Button
                            size="slim"
                            variant="secondary"
                            onClick={() => runQualityAnalysis(url, media.id)}
                            loading={loadingQuality}
                            disabled={loadingAlt || loadingQuality}
                          >
                            {loadingQuality ? "Scoring..." : "Score quality"}
                          </Button>
                        </InlineStack>
                        {qualityResult && (
                          <BlockStack gap="100">
                            <InlineStack gap="200" blockAlign="center">
                              <Text as="span" variant="bodyMd" fontWeight="medium">
                                Quality score
                              </Text>
                              <Badge tone={qualityResult.isAcceptable ? "success" : "warning"}>
                                {`${qualityResult.overallScore}/100`}
                              </Badge>
                            </InlineStack>
                            {qualityResult.recommendation && (
                              <Text as="p" variant="bodySm" tone="subdued">
                                {qualityResult.recommendation}
                              </Text>
                            )}
                          </BlockStack>
                        )}
                      </BlockStack>
                    </Card>
                  );
                })
              )}
            </BlockStack>
          </Layout.Section>
        </Layout>

        {/* Image Performance Section */}
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">
                  Image Performance
                </Text>
                {!imageAnalytics || imageAnalytics.totalProductSessions < MIN_SESSIONS_THRESHOLD ? (
                  <Banner tone="info">
                    Insufficient data — more sessions are needed to show
                    image performance metrics.
                    {imageAnalytics
                      ? ` (${imageAnalytics.totalProductSessions} session${imageAnalytics.totalProductSessions === 1 ? "" : "s"} so far)`
                      : ""}
                  </Banner>
                ) : (
                  <DataTable
                    columnContentTypes={[
                      "text",
                      "numeric",
                      "text",
                      "text",
                      "text",
                      "text",
                      "text",
                    ]}
                    headings={[
                      "Image",
                      "Position",
                      "Type",
                      "Seen By",
                      "Avg Time",
                      "Zoom Usage",
                      "Recommendation",
                    ]}
                    rows={mediaNodes.map((media, idx) => {
                      const entry = imageAnalytics.images.find(
                        (e) => numericId(e.mediaId) === numericId(media.id),
                      );
                      const sessions = entry?.sessions ?? 0;
                      const zoomSessions = entry?.zoomSessions ?? 0;
                      const totalActiveTimeMs = entry?.totalActiveTimeMs ?? 0;
                      const totalSessions = imageAnalytics.totalProductSessions;

                      const seenPct =
                        totalSessions > 0
                          ? Math.round((sessions / totalSessions) * 100)
                          : 0;
                      const avgTimeSec =
                        sessions > 0
                          ? Math.round((totalActiveTimeMs / sessions / 1000) * 10) / 10
                          : 0;
                      const isVideo = (media as any).mediaContentType === "VIDEO" || (media as any).mediaContentType === "EXTERNAL_VIDEO";
                      const zoom = getZoomBadge(zoomSessions, sessions);
                      const rec = entry
                        ? getRecommendation(
                            entry,
                            idx,
                            mediaNodes.length,
                            totalSessions,
                            isVideo,
                          )
                        : "\u2014";

                      const thumbUrl = media.image?.url ?? media.preview?.image?.url;
                      return [
                        thumbUrl ? (
                          <Thumbnail
                            key={media.id}
                            source={thumbUrl}
                            alt={media.alt ?? ""}
                            size="small"
                          />
                        ) : (
                          "N/A"
                        ),
                        idx + 1,
                        isVideo ? "Video" : "Image",
                        `${seenPct}%`,
                        `${avgTimeSec}s`,
                        <Badge key={`z-${media.id}`} tone={zoom.tone}>
                          {zoom.label}
                        </Badge>,
                        rec,
                      ];
                    })}
                  />
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
