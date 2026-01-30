import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData, useFetcher, useNavigation } from "@remix-run/react";
import { Page, BlockStack, InlineStack, Button, Banner, List, Card, Layout, SkeletonPage, SkeletonBodyText, SkeletonDisplayText } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  readAnalyticsSummary,
  getOverviewFromSummary,
  getTimeseriesFromSummary,
  getTopProductsFromSummary,
  getDeviceStatsFromSummary,
  fetchProductTitles,
} from "~/lib/analyticsMetafields.server";
import { getSettingsFromMetafields, getOnboardingState } from "~/lib/settingsMetafields.server";
import { checkOllamaHealth } from "~/lib/ollama.server";
import { colors, borderRadius, spacing } from "~/styles/design-system";
import {
  MetricCard,
  AnalyticsChart,
  ProductRanking,
  DeviceChart,
} from "~/components/Dashboard";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopId = session.shop;

  console.log(`[Dashboard] Loading for shop: ${shopId}`);

  const [settings, aiHealthy, { summary }, onboardingState] = await Promise.all([
    getSettingsFromMetafields(admin, shopId),
    checkOllamaHealth(),
    readAnalyticsSummary(admin),
    getOnboardingState(admin),
  ]);

  const analytics = getOverviewFromSummary(summary);
  const timeseries = getTimeseriesFromSummary(summary, 30);
  const deviceStats = getDeviceStatsFromSummary(summary);

  // Fetch real product titles for all tracked products (up to 50)
  const productIds = summary.topProducts.map((p) => p.id);
  const titleMap = await fetchProductTitles(admin, productIds);
  const topProducts = getTopProductsFromSummary(summary, 50, titleMap);

  console.log(`[Dashboard] Analytics:`, analytics);
  console.log(`[Dashboard] Timeseries points: ${timeseries.length}`);

  return json({
    shopId,
    settings,
    aiHealthy,
    analytics,
    timeseries,
    topProducts,
    deviceStats,
    onboardingState,
  });
};

export default function Dashboard() {
  const {
    shopId,
    settings,
    aiHealthy,
    analytics,
    timeseries,
    topProducts,
    deviceStats,
    onboardingState,
  } = useLoaderData<typeof loader>();

  const fetcher = useFetcher();
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";
  const shopDomain = shopId;
  const showOnboarding =
    !onboardingState.dismissed &&
    analytics.totalViews === 0 &&
    fetcher.state === "idle" &&
    fetcher.data == null;

  if (isLoading) {
    return (
      <Page fullWidth>
        <TitleBar title="Product Gallery Pro" />
        <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
          <BlockStack gap="600">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
              {[1,2,3,4].map(i => (
                <Card key={i}><SkeletonDisplayText size="small" /><SkeletonBodyText lines={2} /></Card>
              ))}
            </div>
            <Card><SkeletonBodyText lines={8} /></Card>
          </BlockStack>
        </div>
      </Page>
    );
  }

  return (
    <Page fullWidth>
      <TitleBar title="Product Gallery Pro" />

      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: spacing[6] }}>
        <BlockStack gap="600">
          {/* Page Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
            }}
          >
            <div>
              <h1
                style={{
                  fontSize: "24px",
                  fontWeight: 700,
                  color: colors.neutral[900],
                  margin: 0,
                }}
              >
                Dashboard
              </h1>
              <p
                style={{
                  fontSize: "14px",
                  color: colors.neutral[500],
                  margin: `${spacing[1]} 0 0 0`,
                }}
              >
                {shopId}
              </p>
            </div>
            <InlineStack gap="300">
              <Link to="/app/products">
                <Button>Products</Button>
              </Link>
              <Link to="/app/rules">
                <Button>Rules</Button>
              </Link>
              <Link to="/app/settings">
                <Button>Settings</Button>
              </Link>
              <Link to="/app/ai-insights">
                <Button variant="primary">AI Insights</Button>
              </Link>
            </InlineStack>
          </div>

          {/* Onboarding Setup Banner */}
          {showOnboarding && (
            <Banner
              title="Get started with Product Gallery Pro"
              tone="info"
              onDismiss={() => {
                fetcher.submit(
                  { action: "dismiss_onboarding" },
                  { method: "POST", action: "/api/settings", encType: "application/json" },
                );
              }}
            >
              <p style={{ marginBottom: "8px" }}>Complete these steps to enable the gallery on your store:</p>
              <List type="number">
                <List.Item>
                  <strong>Add gallery to your product page</strong> — Go to Theme Editor, select Product template, click Add block, and choose Product Gallery Pro.{" "}
                  <a
                    href={`https://${shopDomain}/admin/themes/current/editor?context=apps&template=product`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open Theme Editor
                  </a>
                </List.Item>
                <List.Item>
                  <strong>Enable zoom and enhancer (optional)</strong> — Go to Theme Editor, open App embeds, and toggle on PGP Gallery Enhancer.{" "}
                  <a
                    href={`https://${shopDomain}/admin/themes/current/editor?context=apps`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Open App Embeds
                  </a>
                </List.Item>
                <List.Item>
                  <strong>Configure gallery settings</strong> — Customize layout, zoom level, and features.{" "}
                  <Link to="/app/settings">Go to Settings</Link>
                </List.Item>
              </List>
            </Banner>
          )}

          {/* Metrics Row — Primary */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: spacing[4],
              }}
            >
              <h2
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: colors.neutral[700],
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  margin: 0,
                }}
              >
                Overview
              </h2>
              <span
                style={{
                  fontSize: "13px",
                  color: colors.neutral[500],
                }}
              >
                Last 30 days
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: spacing[4],
              }}
            >
              <MetricCard
                label="Gallery Views"
                value={analytics.totalViews}
                indicator="primary"
                subtitle="Total product page gallery loads"
                definition="Total number of times the product gallery was loaded on a product page. Counted once per page visit after 800ms (to exclude bounces)."
              />
              <MetricCard
                label="Engagement Rate"
                value={`${analytics.engagementRate}%`}
                indicator={analytics.engagementRate >= 25 ? "success" : "warning"}
                subtitle={`${analytics.sessionsWithInteraction} of ${analytics.totalSessions} sessions`}
                definition="Percentage of gallery sessions where the user performed at least one interaction (zoom, thumbnail click, swipe, or video play). Calculated as: sessions with interaction / total sessions."
              />
              <MetricCard
                label="Zoom Interactions"
                value={analytics.zoomEvents}
                indicator="success"
                subtitle="Hover & click zooms"
                definition="Total zoom events: includes both hover-zooms (mouse over image for 1+ second) and click-zooms (clicking on a product image). Higher values indicate strong product interest."
              />
              <MetricCard
                label="Video Plays"
                value={analytics.videoPlays}
                indicator="info"
                subtitle="Product videos watched"
                definition="Number of times a product video was played in the gallery. Counts each play event (pause + replay counts as a new play)."
              />
            </div>
          </div>

          {/* Metrics Row — Session Depth */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: spacing[4],
            }}
          >
            <MetricCard
              label="Images per Session"
              value={analytics.avgImagesPerSession}
              indicator="primary"
              subtitle="Avg unique images viewed"
              definition="Average number of unique images a user views during a single gallery session. Counts each distinct image (by media ID) seen via slides, thumbnails, or swipes. Higher = more product exploration."
            />
            <MetricCard
              label="Time in Gallery"
              value={`${analytics.avgActiveTimeSec}s`}
              indicator="success"
              subtitle="Avg active interaction time"
              definition="Average time (seconds) the user actively interacts with the gallery per session. Only counts time between interactions (gaps >5s are excluded as idle). Does not count passive viewing without interaction."
            />
            <MetricCard
              label="Swipe Depth"
              value={analytics.avgSwipeDepth}
              indicator="info"
              subtitle="Avg max image index reached"
              definition="Average deepest image position (0-indexed) reached during a session via swiping or navigation. A value of 3 means users typically view at least 4 images. Higher = users browse more of the gallery."
            />
          </div>

          {/* Main Content Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 380px",
              gap: spacing[5],
            }}
          >
            {/* Left Column */}
            <div style={{ display: "flex", flexDirection: "column", gap: spacing[5] }}>
              <AnalyticsChart data={timeseries} title="Gallery Views" />

              {/* Status Cards Row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: spacing[4],
                }}
              >
                {/* Gallery Config */}
                <div
                  style={{
                    background: colors.neutral[0],
                    borderRadius: borderRadius.lg,
                    border: `1px solid ${colors.neutral[200]}`,
                    padding: spacing[5],
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: spacing[4],
                    }}
                  >
                    <h3
                      style={{
                        fontSize: "15px",
                        fontWeight: 600,
                        color: colors.neutral[900],
                        margin: 0,
                      }}
                    >
                      Gallery Configuration
                    </h3>
                    <Link to="/app/settings">
                      <button
                        style={{
                          background: "none",
                          border: "none",
                          color: colors.primary[500],
                          fontSize: "13px",
                          fontWeight: 500,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        Edit
                      </button>
                    </Link>
                  </div>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: spacing[3],
                    }}
                  >
                    {[
                      { label: "Layout", value: settings?.layout || "carousel" },
                      { label: "Zoom", value: settings?.enable_zoom ? "Enabled" : "Disabled" },
                      { label: "Thumbnails", value: settings?.thumbnail_position || "bottom" },
                    ].map((item) => (
                      <div
                        key={item.label}
                        style={{
                          padding: spacing[3],
                          background: colors.neutral[50],
                          borderRadius: borderRadius.md,
                          textAlign: "center",
                        }}
                      >
                        <p
                          style={{
                            fontSize: "11px",
                            fontWeight: 500,
                            color: colors.neutral[500],
                            textTransform: "uppercase",
                            margin: 0,
                          }}
                        >
                          {item.label}
                        </p>
                        <p
                          style={{
                            fontSize: "14px",
                            fontWeight: 600,
                            color: colors.neutral[800],
                            margin: `${spacing[1]} 0 0 0`,
                            textTransform: "capitalize",
                          }}
                        >
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* AI Status */}
                <div
                  style={{
                    background: colors.neutral[0],
                    borderRadius: borderRadius.lg,
                    border: `1px solid ${colors.neutral[200]}`,
                    padding: spacing[5],
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: spacing[4],
                    }}
                  >
                    <h3
                      style={{
                        fontSize: "15px",
                        fontWeight: 600,
                        color: colors.neutral[900],
                        margin: 0,
                      }}
                    >
                      AI Features
                    </h3>
                    <Link to="/app/ai-insights">
                      <button
                        style={{
                          background: "none",
                          border: "none",
                          color: colors.primary[500],
                          fontSize: "13px",
                          fontWeight: 500,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        Open
                      </button>
                    </Link>
                  </div>
                  <div style={{ display: "flex", gap: spacing[3] }}>
                    <div
                      style={{
                        flex: 1,
                        padding: spacing[3],
                        background: aiHealthy ? colors.success.light : colors.critical.light,
                        borderRadius: borderRadius.md,
                        display: "flex",
                        alignItems: "center",
                        gap: spacing[2],
                      }}
                    >
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: borderRadius.full,
                          background: aiHealthy ? colors.success.main : colors.critical.main,
                        }}
                      />
                      <div>
                        <p
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: colors.neutral[800],
                            margin: 0,
                          }}
                        >
                          Ollama
                        </p>
                        <p
                          style={{
                            fontSize: "12px",
                            color: colors.neutral[600],
                            margin: 0,
                          }}
                        >
                          {aiHealthy ? "Connected" : "Offline"}
                        </p>
                      </div>
                    </div>
                    <div
                      style={{
                        flex: 1,
                        padding: spacing[3],
                        background: settings?.enable_ai
                          ? colors.success.light
                          : colors.neutral[100],
                        borderRadius: borderRadius.md,
                        display: "flex",
                        alignItems: "center",
                        gap: spacing[2],
                      }}
                    >
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: borderRadius.full,
                          background: settings?.enable_ai
                            ? colors.success.main
                            : colors.neutral[400],
                        }}
                      />
                      <div>
                        <p
                          style={{
                            fontSize: "13px",
                            fontWeight: 600,
                            color: colors.neutral[800],
                            margin: 0,
                          }}
                        >
                          AI Mode
                        </p>
                        <p
                          style={{
                            fontSize: "12px",
                            color: colors.neutral[600],
                            margin: 0,
                          }}
                        >
                          {settings?.enable_ai ? "Enabled" : "Disabled"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div style={{ display: "flex", flexDirection: "column", gap: spacing[5] }}>
              <ProductRanking products={topProducts} title="Top Products" initialCount={10} />
              <DeviceChart stats={deviceStats} title="Device Breakdown" />
            </div>
          </div>
        </BlockStack>
      </div>
    </Page>
  );
}
