import { useEffect, useState } from "react";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useFetcher, useLoaderData } from "@remix-run/react";
import {
  Banner,
  BlockStack,
  Card,
  ChoiceList,
  Checkbox,
  Layout,
  Page,
  Select,
  Text,
  TextField,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import type { Settings } from "~/types";
import { getSettingsFromMetafields } from "~/lib/settingsMetafields.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopId = session.shop;

  const settings = await getSettingsFromMetafields(admin, shopId);

  return json({ shopId, settings });
};

export default function SettingsPage() {
  const { shopId, settings } = useLoaderData<typeof loader>();
  const fetcher = useFetcher<{ success: boolean; data?: Settings; error?: string }>();

  const isSaving =
    fetcher.state === "submitting" || fetcher.state === "loading";

  const [form, setForm] = useState<Settings>(settings);

  // If save succeeds, update local form state from server response (source of truth).
  useEffect(() => {
    if (fetcher.data?.success && fetcher.data.data) {
      setForm(fetcher.data.data);
    }
  }, [fetcher.data]);

  return (
    <Page>
      <TitleBar title="Gallery settings" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Defaults for {shopId}
              </Text>
              <BlockStack gap="200">
                {fetcher.data?.success === false && (
                  <Banner tone="critical" title="Failed to save settings">
                    <p>{fetcher.data.error || "Unknown error"}</p>
                  </Banner>
                )}
                <fetcher.Form method="post" action="/api/settings">
                  {/* Hidden inputs for all form values since Polaris components don't create native inputs */}
                  <input type="hidden" name="layout" value={form.layout} />
                  <input type="hidden" name="thumbnail_position" value={form.thumbnail_position} />
                  <input type="hidden" name="thumbnail_size" value={form.thumbnail_size} />
                  <input type="hidden" name="enable_zoom" value={form.enable_zoom ? "true" : ""} />
                  <input type="hidden" name="zoom_type" value={form.zoom_type} />
                  <input type="hidden" name="zoom_level" value={String(form.zoom_level)} />
                  <input type="hidden" name="variant_filtering" value={form.variant_filtering ? "true" : ""} />
                  <input type="hidden" name="lazy_loading" value={form.lazy_loading ? "true" : ""} />
                  <input type="hidden" name="autoplay_video" value={form.autoplay_video ? "true" : ""} />
                  <input type="hidden" name="enable_analytics" value={form.enable_analytics ? "true" : ""} />
                  <input type="hidden" name="enable_ai" value={form.enable_ai ? "true" : ""} />

                  <BlockStack gap="300">
                    <ChoiceList
                      title="Layout"
                      choices={[
                        { label: "Carousel", value: "carousel" },
                        { label: "Grid", value: "grid" },
                        { label: "Stack", value: "stack" },
                      ]}
                      selected={[form.layout]}
                      onChange={(values) =>
                        setForm((prev) => ({
                          ...prev,
                          layout: (values[0] || "carousel") as Settings["layout"],
                        }))
                      }
                    />

                    <InlineInputs>
                      <Select
                        label="Thumbnail position"
                        options={[
                          { label: "Bottom", value: "bottom" },
                          { label: "Left", value: "left" },
                          { label: "Right", value: "right" },
                          { label: "None", value: "none" },
                        ]}
                        name="thumbnail_position"
                        value={form.thumbnail_position}
                        onChange={(value) =>
                          setForm((prev) => ({
                            ...prev,
                            thumbnail_position:
                              value as Settings["thumbnail_position"],
                          }))
                        }
                      />
                      <Select
                        label="Thumbnail size"
                        options={[
                          { label: "Small", value: "small" },
                          { label: "Medium", value: "medium" },
                          { label: "Large", value: "large" },
                        ]}
                        name="thumbnail_size"
                        value={form.thumbnail_size}
                        onChange={(value) =>
                          setForm((prev) => ({
                            ...prev,
                            thumbnail_size: value as Settings["thumbnail_size"],
                          }))
                        }
                      />
                    </InlineInputs>

                    <InlineInputs>
                      <Checkbox
                        label="Enable zoom"
                        value="true"
                        name="enable_zoom"
                        checked={form.enable_zoom}
                        onChange={(checked) =>
                          setForm((prev) => ({
                            ...prev,
                            enable_zoom: checked,
                          }))
                        }
                      />
                      <Select
                        label="Zoom type"
                        options={[
                          { label: "Hover", value: "hover" },
                          { label: "Click", value: "click" },
                          { label: "Both", value: "both" },
                        ]}
                        name="zoom_type"
                        value={form.zoom_type}
                        onChange={(value) =>
                          setForm((prev) => ({
                            ...prev,
                            zoom_type: value as Settings["zoom_type"],
                          }))
                        }
                      />
                      <TextField
                        label="Zoom level"
                        type="number"
                        min={1.5}
                        max={4}
                        step={0.1}
                        name="zoom_level"
                        value={String(form.zoom_level)}
                        onChange={(value) =>
                          setForm((prev) => ({
                            ...prev,
                            zoom_level: Number(value) || prev.zoom_level,
                          }))
                        }
                      />
                    </InlineInputs>

                    <InlineInputs>
                      <Checkbox
                        label="Variant filtering"
                        value="true"
                        name="variant_filtering"
                        checked={form.variant_filtering}
                        onChange={(checked) =>
                          setForm((prev) => ({
                            ...prev,
                            variant_filtering: checked,
                          }))
                        }
                      />
                      <Checkbox
                        label="Lazy loading"
                        value="true"
                        name="lazy_loading"
                        checked={form.lazy_loading}
                        onChange={(checked) =>
                          setForm((prev) => ({
                            ...prev,
                            lazy_loading: checked,
                          }))
                        }
                      />
                      <Checkbox
                        label="Autoplay video"
                        value="true"
                        name="autoplay_video"
                        checked={form.autoplay_video}
                        onChange={(checked) =>
                          setForm((prev) => ({
                            ...prev,
                            autoplay_video: checked,
                          }))
                        }
                      />
                    </InlineInputs>

                    <InlineInputs>
                      <Checkbox
                        label="Enable analytics"
                        value="true"
                        name="enable_analytics"
                        checked={form.enable_analytics}
                        onChange={(checked) =>
                          setForm((prev) => ({
                            ...prev,
                            enable_analytics: checked,
                          }))
                        }
                      />
                      <Checkbox
                        label="Enable AI features"
                        value="true"
                        name="enable_ai"
                        checked={form.enable_ai}
                        onChange={(checked) =>
                          setForm((prev) => ({
                            ...prev,
                            enable_ai: checked,
                          }))
                        }
                      />
                    </InlineInputs>

                    <div>
                      <button
                        type="submit"
                        disabled={isSaving}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 4,
                          border: "none",
                          background: "#008060",
                          color: "white",
                          cursor: isSaving ? "default" : "pointer",
                        }}
                      >
                        {isSaving ? "Saving…" : "Save changes"}
                      </button>
                    </div>
                  </BlockStack>
                </fetcher.Form>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function InlineInputs({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      {children}
    </div>
  );
}


