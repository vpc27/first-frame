/**
 * Modal for single-image alt text generation and editing.
 */

import { useState, useCallback } from "react";
import {
  Modal,
  BlockStack,
  InlineStack,
  Text,
  TextField,
  Button,
  Banner,
  Spinner,
  Badge,
} from "@shopify/polaris";
import { useFetcher } from "@remix-run/react";

interface AltTextGeneratorModalProps {
  open: boolean;
  onClose: () => void;
  image: {
    id: string;
    url: string;
    currentAltText: string | null;
  };
  productContext: {
    title: string;
    type?: string;
    vendor?: string;
    productId: string;
  };
  onSaved?: (mediaId: string, altText: string) => void;
}

type ModalState = "idle" | "generating" | "preview" | "saving" | "saved";

export function AltTextGeneratorModal({
  open,
  onClose,
  image,
  productContext,
  onSaved,
}: AltTextGeneratorModalProps) {
  const [state, setState] = useState<ModalState>("idle");
  const [altText, setAltText] = useState(image.currentAltText ?? "");
  const [error, setError] = useState<string | null>(null);
  const [confidence, setConfidence] = useState<number | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const generateFetcher = useFetcher();
  const saveFetcher = useFetcher();

  const handleGenerate = useCallback(async () => {
    setState("generating");
    setError(null);

    try {
      const response = await fetch("/api/ai/generate-alt-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrl: image.url,
          productTitle: productContext.title,
          productType: productContext.type,
          productVendor: productContext.vendor,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Generation failed");
      }

      setAltText(data.data.altText);
      setConfidence(data.data.confidence);
      setKeywords(data.data.keywords ?? []);
      setState("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
      setState("idle");
    }
  }, [image.url, productContext]);

  const handleSave = useCallback(async () => {
    setState("saving");
    setError(null);

    try {
      const response = await fetch("/api/ai/save-alt-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: productContext.productId,
          updates: [{ mediaId: image.id, altText }],
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Save failed");
      }

      setState("saved");
      onSaved?.(image.id, altText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setState("preview");
    }
  }, [altText, image.id, productContext.productId, onSaved]);

  const handleClose = useCallback(() => {
    setState("idle");
    setError(null);
    setConfidence(null);
    setKeywords([]);
    onClose();
  }, [onClose]);

  const charCount = altText.length;
  const isOverLimit = charCount > 125;

  return (
    <Modal open={open} onClose={handleClose} title="Generate Alt Text">
      <Modal.Section>
        <InlineStack gap="400" align="start" blockAlign="start">
          {/* Image preview */}
          <div
            style={{
              width: "180px",
              flexShrink: 0,
              borderRadius: "8px",
              overflow: "hidden",
              border: "1px solid #e1e3e5",
            }}
          >
            <img
              src={image.url}
              alt={altText || "Product image"}
              style={{ width: "100%", display: "block" }}
            />
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <BlockStack gap="400">
              {error && (
                <Banner tone="critical" onDismiss={() => setError(null)}>
                  <p>{error}</p>
                </Banner>
              )}

              {state === "saved" && (
                <Banner tone="success">
                  <p>Alt text saved to Shopify.</p>
                </Banner>
              )}

              {image.currentAltText && state === "idle" && (
                <BlockStack gap="200">
                  <Text as="p" variant="bodySm" tone="subdued">
                    Current alt text
                  </Text>
                  <Text as="p" variant="bodyMd">
                    {image.currentAltText}
                  </Text>
                </BlockStack>
              )}

              {state === "generating" && (
                <InlineStack gap="200" blockAlign="center">
                  <Spinner size="small" />
                  <Text as="p">Generating alt text...</Text>
                </InlineStack>
              )}

              {(state === "preview" || state === "saving" || state === "saved") && (
                <BlockStack gap="300">
                  <TextField
                    label="Alt text"
                    value={altText}
                    onChange={setAltText}
                    multiline={3}
                    autoComplete="off"
                    helpText={`${charCount}/125 characters${isOverLimit ? " (over limit)" : ""}`}
                    error={isOverLimit ? "Alt text should be 125 characters or less" : undefined}
                  />

                  {confidence !== null && (
                    <InlineStack gap="200">
                      <Badge tone={confidence >= 0.8 ? "success" : "warning"}>
                        {`Confidence: ${Math.round(confidence * 100)}%`}
                      </Badge>
                    </InlineStack>
                  )}

                  {keywords.length > 0 && (
                    <BlockStack gap="100">
                      <Text as="p" variant="bodySm" tone="subdued">
                        Keywords
                      </Text>
                      <InlineStack gap="100">
                        {keywords.map((kw) => (
                          <Badge key={kw}>{kw}</Badge>
                        ))}
                      </InlineStack>
                    </BlockStack>
                  )}
                </BlockStack>
              )}

              {/* Action buttons */}
              <InlineStack gap="200">
                {(state === "idle" || state === "preview" || state === "saved") && (
                  <Button
                    onClick={handleGenerate}
                  >
                    {state === "idle" ? "Generate" : "Regenerate"}
                  </Button>
                )}

                {(state === "preview" || state === "saved") && (
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={!altText.trim() || isOverLimit}
                  >
                    Save to Shopify
                  </Button>
                )}
              </InlineStack>
            </BlockStack>
          </div>
        </InlineStack>
      </Modal.Section>
    </Modal>
  );
}
