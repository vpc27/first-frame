/**
 * Modal for product-level bulk alt text generation with review table.
 */

import { useState, useCallback } from "react";
import {
  Modal,
  BlockStack,
  InlineStack,
  Text,
  Button,
  Banner,
  ProgressBar,
  TextField,
  Badge,
  Checkbox,
} from "@shopify/polaris";
import { colors, borderRadius, spacing } from "~/styles/design-system";

interface BulkImage {
  id: string;
  url: string;
  currentAltText: string | null;
}

interface BulkAltTextModalProps {
  open: boolean;
  onClose: () => void;
  images: BulkImage[];
  productContext: {
    title: string;
    type?: string;
    vendor?: string;
    productId: string;
  };
  onSaved?: (updates: Array<{ mediaId: string; altText: string }>) => void;
}

type BulkStep = "scope" | "generating" | "review" | "saving" | "done";
type Scope = "all" | "missing" | "selected";

interface GeneratedResult {
  mediaId: string;
  imageUrl: string;
  currentAltText: string | null;
  newAltText: string;
  confidence: number;
  accepted: boolean;
}

export function BulkAltTextModal({
  open,
  onClose,
  images,
  productContext,
  onSaved,
}: BulkAltTextModalProps) {
  const [step, setStep] = useState<BulkStep>("scope");
  const [scope, setScope] = useState<Scope>("missing");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [results, setResults] = useState<GeneratedResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const scopedImages =
    scope === "missing"
      ? images.filter((img) => !img.currentAltText || img.currentAltText.trim() === "")
      : scope === "selected"
        ? images.filter((img) => selectedIds.has(img.id))
        : images;

  const toggleImageSelection = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleGenerate = useCallback(async () => {
    setStep("generating");
    setError(null);
    const toProcess = scopedImages;
    setProgress({ current: 0, total: toProcess.length });
    const generated: GeneratedResult[] = [];

    for (let i = 0; i < toProcess.length; i++) {
      const img = toProcess[i];
      setProgress({ current: i + 1, total: toProcess.length });

      try {
        const response = await fetch("/api/ai/generate-alt-text", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrl: img.url,
            productTitle: productContext.title,
            productType: productContext.type,
            productVendor: productContext.vendor,
          }),
        });

        const data = await response.json();

        if (!data.success) {
          // Stop on first error — show it to user instead of silently continuing
          setError(data.error || "Generation failed. Check API key and billing.");
          setResults(generated);
          setStep("review");
          return;
        }

        generated.push({
          mediaId: img.id,
          imageUrl: img.url,
          currentAltText: img.currentAltText,
          newAltText: data.data.altText,
          confidence: data.data.confidence,
          accepted: true,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Network error during generation.");
        setResults(generated);
        setStep("review");
        return;
      }
    }

    setResults(generated);
    setStep("review");
  }, [scopedImages, productContext]);

  const handleToggleAccept = useCallback((mediaId: string) => {
    setResults((prev) =>
      prev.map((r) =>
        r.mediaId === mediaId ? { ...r, accepted: !r.accepted } : r,
      ),
    );
  }, []);

  const handleEditAltText = useCallback((mediaId: string, text: string) => {
    setResults((prev) =>
      prev.map((r) =>
        r.mediaId === mediaId ? { ...r, newAltText: text } : r,
      ),
    );
  }, []);

  const handleSaveAll = useCallback(async () => {
    setStep("saving");
    setError(null);

    const accepted = results.filter((r) => r.accepted && r.newAltText.trim());
    if (accepted.length === 0) {
      setError("No alt text to save.");
      setStep("review");
      return;
    }

    try {
      const response = await fetch("/api/ai/save-alt-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: productContext.productId,
          updates: accepted.map((r) => ({
            mediaId: r.mediaId,
            altText: r.newAltText,
          })),
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Save failed");
      }

      setStep("done");
      onSaved?.(
        accepted.map((r) => ({ mediaId: r.mediaId, altText: r.newAltText })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setStep("review");
    }
  }, [results, productContext.productId, onSaved]);

  const handleClose = useCallback(() => {
    setStep("scope");
    setResults([]);
    setError(null);
    setProgress({ current: 0, total: 0 });
    setSelectedIds(new Set());
    onClose();
  }, [onClose]);

  const acceptedCount = results.filter((r) => r.accepted).length;
  const missingCount = images.filter(
    (img) => !img.currentAltText || img.currentAltText.trim() === "",
  ).length;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Bulk Alt Text Generation"
      size="large"
    >
      <Modal.Section>
        <BlockStack gap="400">
          {error && (
            <Banner tone="critical" onDismiss={() => setError(null)}>
              <p>{error}</p>
            </Banner>
          )}

          {/* Step 1: Scope */}
          {step === "scope" && (
            <BlockStack gap="400">
              <Text as="p" variant="bodyMd">
                Generate AI alt text for product images. Select which images to
                process.
              </Text>

              <BlockStack gap="200">
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    border: `1px solid ${scope === "missing" ? colors.primary[500] : colors.neutral[200]}`,
                    borderRadius: borderRadius.md,
                    cursor: "pointer",
                    background:
                      scope === "missing" ? colors.primary[50] : "transparent",
                  }}
                >
                  <input
                    type="radio"
                    name="scope"
                    checked={scope === "missing"}
                    onChange={() => setScope("missing")}
                  />
                  <div>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      Missing only ({missingCount} images)
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Only generate for images without alt text
                    </Text>
                  </div>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    border: `1px solid ${scope === "all" ? colors.primary[500] : colors.neutral[200]}`,
                    borderRadius: borderRadius.md,
                    cursor: "pointer",
                    background:
                      scope === "all" ? colors.primary[50] : "transparent",
                  }}
                >
                  <input
                    type="radio"
                    name="scope"
                    checked={scope === "all"}
                    onChange={() => setScope("all")}
                  />
                  <div>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      All images ({images.length} images)
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Generate for all images (overwrites existing)
                    </Text>
                  </div>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 12px",
                    border: `1px solid ${scope === "selected" ? colors.primary[500] : colors.neutral[200]}`,
                    borderRadius: borderRadius.md,
                    cursor: "pointer",
                    background:
                      scope === "selected" ? colors.primary[50] : "transparent",
                  }}
                >
                  <input
                    type="radio"
                    name="scope"
                    checked={scope === "selected"}
                    onChange={() => setScope("selected")}
                  />
                  <div>
                    <Text as="p" variant="bodyMd" fontWeight="semibold">
                      Selected images ({selectedIds.size} selected)
                    </Text>
                    <Text as="p" variant="bodySm" tone="subdued">
                      Pick specific images to generate alt text for
                    </Text>
                  </div>
                </label>

                {scope === "selected" && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
                      gap: spacing[2],
                      padding: spacing[3],
                      border: `1px solid ${colors.neutral[200]}`,
                      borderRadius: borderRadius.md,
                      background: colors.neutral[50],
                      maxHeight: "240px",
                      overflowY: "auto",
                    }}
                  >
                    {images.map((img) => {
                      const isSelected = selectedIds.has(img.id);
                      return (
                        <div
                          key={img.id}
                          onClick={() => toggleImageSelection(img.id)}
                          style={{
                            position: "relative",
                            cursor: "pointer",
                            borderRadius: borderRadius.sm,
                            overflow: "hidden",
                            border: `2px solid ${isSelected ? colors.primary[500] : "transparent"}`,
                            opacity: isSelected ? 1 : 0.6,
                          }}
                        >
                          <img
                            src={img.url}
                            alt=""
                            style={{
                              width: "100%",
                              aspectRatio: "1",
                              objectFit: "cover",
                              display: "block",
                            }}
                          />
                          {isSelected && (
                            <div
                              style={{
                                position: "absolute",
                                top: "4px",
                                right: "4px",
                                width: "20px",
                                height: "20px",
                                borderRadius: borderRadius.full,
                                background: colors.primary[500],
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                color: "#fff",
                                fontSize: "12px",
                                fontWeight: 700,
                              }}
                            >
                              ✓
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </BlockStack>

              <InlineStack align="end">
                <Button
                  variant="primary"
                  onClick={handleGenerate}
                  disabled={scopedImages.length === 0}
                >
                  {`Generate (${scopedImages.length} images)`}
                </Button>
              </InlineStack>
            </BlockStack>
          )}

          {/* Step 2: Generating */}
          {step === "generating" && (
            <BlockStack gap="300">
              <Text as="p" variant="bodyMd">
                Generating alt text... ({progress.current}/{progress.total})
              </Text>
              <ProgressBar
                progress={
                  progress.total > 0
                    ? (progress.current / progress.total) * 100
                    : 0
                }
              />
            </BlockStack>
          )}

          {/* Step 3: Review */}
          {(step === "review" || step === "saving") && (
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="p" variant="bodyMd">
                  Review generated alt text ({acceptedCount} of{" "}
                  {results.length} accepted)
                </Text>
                <Button
                  variant="primary"
                  onClick={handleSaveAll}
                  loading={step === "saving"}
                  disabled={acceptedCount === 0}
                >
                  {`Save ${acceptedCount} to Shopify`}
                </Button>
              </InlineStack>

              <div
                style={{
                  maxHeight: "400px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: spacing[3],
                }}
              >
                {results.map((result) => (
                  <div
                    key={result.mediaId}
                    style={{
                      display: "flex",
                      gap: spacing[3],
                      padding: spacing[3],
                      border: `1px solid ${result.accepted ? colors.success.main + "40" : colors.neutral[200]}`,
                      borderRadius: borderRadius.md,
                      background: result.accepted
                        ? colors.success.main + "08"
                        : colors.neutral[50],
                      opacity: result.accepted ? 1 : 0.6,
                    }}
                  >
                    {/* Thumbnail */}
                    <div
                      style={{
                        width: "60px",
                        height: "60px",
                        borderRadius: borderRadius.sm,
                        overflow: "hidden",
                        flexShrink: 0,
                      }}
                    >
                      <img
                        src={result.imageUrl}
                        alt=""
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                        }}
                      />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {result.currentAltText && (
                        <Text as="p" variant="bodySm" tone="subdued">
                          Old: {result.currentAltText}
                        </Text>
                      )}
                      <TextField
                        label="New alt text"
                        labelHidden
                        value={result.newAltText}
                        onChange={(val) =>
                          handleEditAltText(result.mediaId, val)
                        }
                        autoComplete="off"
                        disabled={step === "saving"}
                      />
                      {result.confidence > 0 && (
                        <div style={{ marginTop: "4px" }}>
                          <Badge
                            tone={
                              result.confidence >= 0.8 ? "success" : "warning"
                            }
                          >
                            {`${Math.round(result.confidence * 100)}%`}
                          </Badge>
                        </div>
                      )}
                    </div>

                    {/* Accept toggle */}
                    <div style={{ flexShrink: 0, paddingTop: "4px" }}>
                      <Checkbox
                        label=""
                        checked={result.accepted}
                        onChange={() => handleToggleAccept(result.mediaId)}
                        disabled={step === "saving"}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </BlockStack>
          )}

          {/* Step 4: Done */}
          {step === "done" && (
            <BlockStack gap="300">
              <Banner tone="success">
                <p>
                  Saved alt text for {acceptedCount} image
                  {acceptedCount !== 1 ? "s" : ""} to Shopify.
                </p>
              </Banner>
              <InlineStack align="end">
                <Button onClick={handleClose}>Done</Button>
              </InlineStack>
            </BlockStack>
          )}
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
