/**
 * Rules Engine Settings Page
 *
 * Manages global rules engine configuration:
 * - Evaluation mode (first_match / all)
 * - Fallback behavior
 * - Max rules per evaluation
 * - Enable/disable rules globally
 */

import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page,
  Card,
  FormLayout,
  Select,
  Checkbox,
  TextField,
  Banner,
  Text,
  BlockStack,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import {
  getShopRules,
  updateGlobalSettings,
  updateEvaluationMode,
} from "~/lib/rules/storage.server";
import { colors, spacing } from "~/styles/design-system";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const rulesData = await getShopRules(admin);

  return json({
    evaluationMode: rulesData.evaluationMode,
    globalSettings: rulesData.globalSettings,
    totalRules: rulesData.rules.length,
  });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "updateSettings") {
    const enableRules = formData.get("enableRules") === "true";
    const fallbackBehavior = formData.get("fallbackBehavior") as string;
    const maxRules = parseInt(formData.get("maxRules") as string, 10) || 50;
    const useLegacyFallback = formData.get("useLegacyFallback") === "true";

    await updateGlobalSettings(admin, {
      enableRules,
      fallbackBehavior: fallbackBehavior as "default_gallery" | "hide_gallery" | "show_all",
      maxRulesPerEvaluation: maxRules,
      useLegacyFallback,
    });

    return json({ success: true });
  }

  if (intent === "updateMode") {
    const mode = formData.get("mode") as "first_match" | "all";
    await updateEvaluationMode(admin, mode);
    return json({ success: true });
  }

  return json({ success: false, error: "Unknown intent" }, { status: 400 });
};

export default function RulesSettingsPage() {
  const { evaluationMode, globalSettings, totalRules } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const fetcher = useFetcher();

  const [settings, setSettings] = useState(globalSettings);
  const [mode, setMode] = useState(evaluationMode);
  const [saved, setSaved] = useState(false);

  const handleSave = useCallback(() => {
    fetcher.submit(
      {
        intent: "updateSettings",
        enableRules: String(settings.enableRules),
        fallbackBehavior: settings.fallbackBehavior,
        maxRules: String(settings.maxRulesPerEvaluation),
        useLegacyFallback: String(settings.useLegacyFallback),
      },
      { method: "POST" }
    );

    if (mode !== evaluationMode) {
      fetcher.submit(
        { intent: "updateMode", mode },
        { method: "POST" }
      );
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }, [settings, mode, evaluationMode, fetcher]);

  return (
    <Page
      backAction={{
        content: "Rules",
        onAction: () => navigate("/app/rules"),
      }}
      title="Rules Engine Settings"
      primaryAction={{
        content: "Save",
        onAction: handleSave,
        loading: fetcher.state === "submitting",
      }}
    >
      <TitleBar title="Rules Engine Settings" />

      <div
        style={{ maxWidth: "800px", margin: "0 auto", padding: spacing[6] }}
      >
        <BlockStack gap="600">
          {saved && (
            <Banner title="Settings saved" tone="success" />
          )}

          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                General
              </Text>
              <FormLayout>
                <Checkbox
                  label="Enable rules engine"
                  helpText={`${totalRules} rules configured`}
                  checked={settings.enableRules}
                  onChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      enableRules: checked,
                    }))
                  }
                />
                <Checkbox
                  label="Use legacy variant filtering as fallback"
                  helpText="When no rules match, fall back to metafield-based variant filtering"
                  checked={settings.useLegacyFallback}
                  onChange={(checked) =>
                    setSettings((prev) => ({
                      ...prev,
                      useLegacyFallback: checked,
                    }))
                  }
                />
              </FormLayout>
            </BlockStack>
          </Card>

          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Evaluation
              </Text>
              <FormLayout>
                <Select
                  label="Evaluation mode"
                  options={[
                    {
                      label: "First match — stop after the first matching rule",
                      value: "first_match",
                    },
                    {
                      label: "All — evaluate all rules and merge results",
                      value: "all",
                    },
                  ]}
                  value={mode}
                  onChange={(value) => setMode(value as typeof mode)}
                  helpText="Controls how multiple matching rules interact"
                />
                <TextField
                  label="Max rules per evaluation"
                  type="number"
                  value={String(settings.maxRulesPerEvaluation)}
                  onChange={(value) =>
                    setSettings((prev) => ({
                      ...prev,
                      maxRulesPerEvaluation: parseInt(value, 10) || 50,
                    }))
                  }
                  helpText="Safety limit to prevent performance issues"
                  autoComplete="off"
                />
                <Select
                  label="Fallback behavior"
                  options={[
                    {
                      label: "Show default gallery",
                      value: "default_gallery",
                    },
                    { label: "Show all images", value: "show_all" },
                    { label: "Hide gallery", value: "hide_gallery" },
                  ]}
                  value={settings.fallbackBehavior}
                  onChange={(value) =>
                    setSettings((prev) => ({
                      ...prev,
                      fallbackBehavior: value as typeof prev.fallbackBehavior,
                    }))
                  }
                  helpText="What happens when no rules match"
                />
              </FormLayout>
            </BlockStack>
          </Card>
        </BlockStack>
      </div>
    </Page>
  );
}
