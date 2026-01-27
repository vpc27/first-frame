import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  Box,
  InlineStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import type { Settings } from "~/types";
import {
  getAnalyticsOverview,
  getSettings,
} from "~/lib/dbGallery.server";
import { checkOllamaHealth } from "~/lib/ollama.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopId = session.shop;

  const [settings, aiHealthy, analytics] = await Promise.all<
    Settings | undefined,
    boolean,
    ReturnType<typeof getAnalyticsOverview>
  >([
    Promise.resolve(getSettings(shopId)),
    checkOllamaHealth(),
    Promise.resolve(getAnalyticsOverview(shopId)),
  ]);

  return json({
    shopId,
    settings,
    aiHealthy,
    analytics,
  });
};

export default function Index() {
  const { shopId, settings, aiHealthy, analytics } =
    useLoaderData<typeof loader>();

  return (
    <Page>
      <TitleBar title="Product Gallery Pro" />
      <BlockStack gap="500">
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Welcome to Product Gallery Pro
                  </Text>
                  <Text variant="bodyMd" as="p">
                    This dashboard gives you a high-level view of how your
                    product media is performing and whether AI-based
                    enhancements are ready to run.
                  </Text>
                </BlockStack>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">
                    Store overview
                  </Text>
                  <Text as="p" variant="bodyMd">
                    Connected store: <strong>{shopId}</strong>
                  </Text>
                </BlockStack>
                <InlineStack gap="400" wrap>
                  <Box
                    padding="400"
                    background="bg-surface-active"
                    borderWidth="025"
                    borderRadius="200"
                    borderColor="border"
                    minWidth="240px"
                  >
                    <BlockStack gap="100">
                      <Text as="h3" variant="headingSm">
                        <Link to="/app/settings" prefetch="intent">
                          Gallery layout
                        </Link>
                      </Text>
                      <Text as="p" variant="bodyMd">
                        {settings?.layout ?? "carousel"} with{" "}
                        {settings?.thumbnail_position ?? "bottom"} thumbnails.
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box
                    padding="400"
                    background="bg-surface-active"
                    borderWidth="025"
                    borderRadius="200"
                    borderColor="border"
                    minWidth="240px"
                  >
                    <BlockStack gap="100">
                      <Text as="h3" variant="headingSm">
                        <Link to="/app/settings" prefetch="intent">
                          Zoom & performance
                        </Link>
                      </Text>
                      <Text as="p" variant="bodyMd">
                        Zoom:{" "}
                        {settings?.enable_zoom ? "enabled" : "disabled"} (
                        {settings?.zoom_type ?? "both"}), lazy loading:{" "}
                        {settings?.lazy_loading ? "on" : "off"}.
                      </Text>
                    </BlockStack>
                  </Box>
                  <Box
                    padding="400"
                    background="bg-surface-active"
                    borderWidth="025"
                    borderRadius="200"
                    borderColor="border"
                    minWidth="240px"
                  >
                    <BlockStack gap="100">
                      <Text as="h3" variant="headingSm">
                        <Link to="/app/ai-insights" prefetch="intent">
                          AI status
                        </Link>
                      </Text>
                      <Text as="p" variant="bodyMd">
                        AI features:{" "}
                        {settings?.enable_ai ? "enabled" : "disabled"}. Ollama:{" "}
                        <strong>{aiHealthy ? "reachable" : "offline"}</strong>.
                      </Text>
                    </BlockStack>
                  </Box>
                </InlineStack>
                <BlockStack gap="200">
                  <Text as="h3" variant="headingMd">
                    Engagement snapshot (last 30 days)
                  </Text>
                  <InlineStack gap="400" wrap>
                    <Box
                      padding="300"
                      background="bg-surface-active"
                      borderWidth="025"
                      borderRadius="200"
                      borderColor="border"
                      minWidth="180px"
                    >
                      <BlockStack gap="050">
                        <Text as="span" variant="headingMd">
                          {analytics.totalViews}
                        </Text>
                        <Text as="span" variant="bodySm">
                          Gallery views
                        </Text>
                      </BlockStack>
                    </Box>
                    <Box
                      padding="300"
                      background="bg-surface-active"
                      borderWidth="025"
                      borderRadius="200"
                      borderColor="border"
                      minWidth="180px"
                    >
                      <BlockStack gap="050">
                        <Text as="span" variant="headingMd">
                          {analytics.totalViews
                            ? `${Math.round(
                                (analytics.zoomEvents / analytics.totalViews) *
                                  100,
                              )}%`
                            : "—"}
                        </Text>
                        <Text as="span" variant="bodySm">
                          Sessions with zoom
                        </Text>
                      </BlockStack>
                    </Box>
                    <Box
                      padding="300"
                      background="bg-surface-active"
                      borderWidth="025"
                      borderRadius="200"
                      borderColor="border"
                      minWidth="180px"
                    >
                      <BlockStack gap="050">
                        <Text as="span" variant="headingMd">
                          {analytics.totalViews
                            ? `${Math.round(
                                (analytics.thumbnailClicks /
                                  analytics.totalViews) *
                                  100,
                              )}%`
                            : "—"}
                        </Text>
                        <Text as="span" variant="bodySm">
                          Sessions with thumbnail clicks
                        </Text>
                      </BlockStack>
                    </Box>
                  </InlineStack>
                </BlockStack>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <BlockStack gap="500">
              <Card>
                <BlockStack gap="200">
                  <Text as="h2" variant="headingMd">
                    Next steps
                  </Text>
                  <BlockStack gap="200">
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        1. Configure gallery defaults
                      </Text>
                    <Text as="span" variant="bodyMd" fontWeight="medium">
                      Coming soon: settings page
                    </Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        2. Install theme block
                      </Text>
                    <Text as="span" variant="bodyMd" fontWeight="medium">
                      Add Product Gallery Pro to your theme
                    </Text>
                    </InlineStack>
                    <InlineStack align="space-between">
                      <Text as="span" variant="bodyMd">
                        3. Enable AI insights
                      </Text>
                    <Text as="span" variant="bodyMd" fontWeight="medium">
                      Run alt-text and quality analysis on key products
                    </Text>
                    </InlineStack>
                  </BlockStack>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
