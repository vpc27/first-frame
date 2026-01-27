import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  BlockStack,
  Card,
  Layout,
  Page,
  Text,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { checkOllamaHealth } from "~/lib/ollama.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shopId = session.shop;

  const aiHealthy = await checkOllamaHealth();

  return json({ shopId, aiHealthy });
};

export default function AiInsightsPage() {
  const { shopId, aiHealthy } = useLoaderData<typeof loader>();

  return (
    <Page>
      <TitleBar title="AI insights" />
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Status for {shopId}
              </Text>
              <Text as="p" variant="bodyMd">
                Ollama connection:{" "}
                <strong>{aiHealthy ? "reachable" : "offline"}</strong>
              </Text>
              <Text as="p" variant="bodyMd">
                This page will show alt-text and image quality recommendations
                once AI analysis is wired in.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

