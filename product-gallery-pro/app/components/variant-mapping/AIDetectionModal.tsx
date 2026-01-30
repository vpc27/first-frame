/**
 * AIDetectionModal Component
 *
 * Modal for running AI variant detection and reviewing results.
 * Shows progress during detection and allows applying/reviewing suggestions.
 */

import { useState } from "react";
import { colors, borderRadius, spacing, shadows } from "~/styles/design-system";
import { getMediaImageUrl } from "~/types/variant-mapping";
import type { AIDetectionResult, ProductMedia } from "~/types/variant-mapping";

interface AIDetectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (results: AIDetectionResult[]) => void;
  media: ProductMedia[];
  productId: string;
  selectedMediaIds?: string[];
}

type DetectionState = "idle" | "detecting" | "complete" | "error";

export function AIDetectionModal({
  isOpen,
  onClose,
  onApply,
  media,
  productId,
  selectedMediaIds = [],
}: AIDetectionModalProps) {
  const [state, setState] = useState<DetectionState>("idle");
  const [results, setResults] = useState<AIDetectionResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(
    new Set()
  );
  const [scope, setScope] = useState<"all" | "selected">(
    selectedMediaIds.length > 0 ? "selected" : "all"
  );

  if (!isOpen) return null;

  const scopeMedia = scope === "selected" && selectedMediaIds.length > 0
    ? media.filter((m) => selectedMediaIds.includes(m.id))
    : media;

  const handleStartDetection = async () => {
    setState("detecting");
    setError(null);
    setResults([]);

    try {
      const body: Record<string, unknown> = { productId };
      if (scope === "selected" && selectedMediaIds.length > 0) {
        body.mediaIds = selectedMediaIds;
      }
      const response = await fetch("/api/ai/detect-variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Detection failed");
      }

      const detectionResults = data.data.results as AIDetectionResult[];
      setResults(detectionResults);

      // Pre-select high confidence results
      const highConfidence = new Set(
        detectionResults
          .filter((r) => r.confidence >= 0.7 && r.detectedVariants.length > 0)
          .map((r) => r.mediaId)
      );
      setSelectedResults(highConfidence);

      setState("complete");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Detection failed");
      setState("error");
    }
  };

  const handleToggleResult = (mediaId: string) => {
    setSelectedResults((prev) => {
      const next = new Set(prev);
      if (next.has(mediaId)) {
        next.delete(mediaId);
      } else {
        next.add(mediaId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const withVariants = results
      .filter((r) => r.detectedVariants.length > 0)
      .map((r) => r.mediaId);
    setSelectedResults(new Set(withVariants));
  };

  const handleSelectNone = () => {
    setSelectedResults(new Set());
  };

  const handleApply = () => {
    const selectedResultsList = results.filter((r) =>
      selectedResults.has(r.mediaId)
    );
    onApply(selectedResultsList);
    onClose();
  };

  const getMediaImage = (mediaId: string) => {
    const m = media.find((item) => item.id === mediaId);
    return m ? getMediaImageUrl(m) : null;
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && state !== "detecting") {
          onClose();
        }
      }}
    >
      <div
        style={{
          background: colors.neutral[0],
          borderRadius: borderRadius.lg,
          boxShadow: shadows.xl,
          width: "90%",
          maxWidth: "700px",
          maxHeight: "85vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: spacing[5],
            borderBottom: `1px solid ${colors.neutral[200]}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "18px",
                fontWeight: 600,
                color: colors.neutral[900],
              }}
            >
              AI Variant Detection
            </h2>
            <p
              style={{
                margin: `${spacing[1]} 0 0`,
                fontSize: "13px",
                color: colors.neutral[600],
              }}
            >
              Automatically detect variant options from product images
            </p>
          </div>
          {state !== "detecting" && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: "24px",
                color: colors.neutral[500],
                padding: spacing[2],
              }}
            >
              &times;
            </button>
          )}
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: spacing[5],
          }}
        >
          {state === "idle" && (
            <div style={{ textAlign: "center", padding: spacing[8] }}>
              <div
                style={{
                  fontSize: "48px",
                  marginBottom: spacing[4],
                }}
              >
                &#129302;
              </div>
              <h3
                style={{
                  margin: `0 0 ${spacing[2]}`,
                  color: colors.neutral[800],
                }}
              >
                Ready to Detect
              </h3>
              <p
                style={{
                  margin: `0 0 ${spacing[4]}`,
                  color: colors.neutral[600],
                  fontSize: "14px",
                }}
              >
                AI will analyze images and suggest variant assignments
                based on visual content and filenames.
              </p>

              {/* Scope selector */}
              {selectedMediaIds.length > 0 && (
                <div
                  style={{
                    display: "inline-flex",
                    gap: 0,
                    marginBottom: spacing[6],
                    borderRadius: borderRadius.md,
                    overflow: "hidden",
                    border: `1px solid ${colors.neutral[300]}`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setScope("all")}
                    style={{
                      padding: `${spacing[2]} ${spacing[4]}`,
                      background: scope === "all" ? colors.primary[500] : colors.neutral[0],
                      color: scope === "all" ? colors.neutral[0] : colors.neutral[700],
                      border: "none",
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    All images ({media.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setScope("selected")}
                    style={{
                      padding: `${spacing[2]} ${spacing[4]}`,
                      background: scope === "selected" ? colors.primary[500] : colors.neutral[0],
                      color: scope === "selected" ? colors.neutral[0] : colors.neutral[700],
                      border: "none",
                      borderLeft: `1px solid ${colors.neutral[300]}`,
                      fontSize: "13px",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Selected ({selectedMediaIds.length})
                  </button>
                </div>
              )}

              <div>
                <button
                  type="button"
                  onClick={handleStartDetection}
                  style={{
                    padding: `${spacing[3]} ${spacing[6]}`,
                    background: colors.primary[500],
                    color: colors.neutral[0],
                    border: "none",
                    borderRadius: borderRadius.md,
                    fontSize: "14px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Start Detection ({scopeMedia.length} image{scopeMedia.length !== 1 ? "s" : ""})
                </button>
              </div>
            </div>
          )}

          {state === "detecting" && (
            <div style={{ textAlign: "center", padding: spacing[8] }}>
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  border: `3px solid ${colors.neutral[200]}`,
                  borderTopColor: colors.primary[500],
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                  margin: `0 auto ${spacing[4]}`,
                }}
              />
              <style>
                {`@keyframes spin { to { transform: rotate(360deg); } }
@keyframes pulse-bar { 0%, 100% { opacity: 0.4; } 50% { opacity: 1; } }`}
              </style>
              <h3
                style={{
                  margin: `0 0 ${spacing[2]}`,
                  color: colors.neutral[800],
                }}
              >
                Analyzing {scopeMedia.length} image{scopeMedia.length !== 1 ? "s" : ""}...
              </h3>
              <p
                style={{
                  margin: 0,
                  color: colors.neutral[600],
                  fontSize: "14px",
                }}
              >
                This may take a moment
              </p>
              <div
                style={{
                  width: "200px",
                  height: "4px",
                  background: colors.neutral[200],
                  borderRadius: borderRadius.full,
                  margin: `${spacing[4]} auto 0`,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    background: colors.primary[500],
                    animation: "pulse-bar 1.5s ease-in-out infinite",
                  }}
                />
              </div>
            </div>
          )}

          {state === "error" && (
            <div style={{ textAlign: "center", padding: spacing[8] }}>
              <div
                style={{
                  fontSize: "48px",
                  marginBottom: spacing[4],
                }}
              >
                &#9888;
              </div>
              <h3
                style={{
                  margin: `0 0 ${spacing[2]}`,
                  color: colors.critical.main,
                }}
              >
                Detection Failed
              </h3>
              <p
                style={{
                  margin: `0 0 ${spacing[6]}`,
                  color: colors.neutral[600],
                  fontSize: "14px",
                }}
              >
                {error}
              </p>
              <button
                type="button"
                onClick={handleStartDetection}
                style={{
                  padding: `${spacing[3]} ${spacing[6]}`,
                  background: colors.primary[500],
                  color: colors.neutral[0],
                  border: "none",
                  borderRadius: borderRadius.md,
                  fontSize: "14px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Try Again
              </button>
            </div>
          )}

          {state === "complete" && (
            <div>
              {/* Stats summary */}
              <div
                style={{
                  display: "flex",
                  gap: spacing[4],
                  marginBottom: spacing[5],
                  padding: spacing[4],
                  background: colors.neutral[50],
                  borderRadius: borderRadius.md,
                }}
              >
                <div>
                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: 700,
                      color: colors.neutral[800],
                    }}
                  >
                    {results.length}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: colors.neutral[500],
                      textTransform: "uppercase",
                    }}
                  >
                    Processed
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: 700,
                      color: colors.success.main,
                    }}
                  >
                    {results.filter((r) => r.detectedVariants.length > 0).length}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: colors.neutral[500],
                      textTransform: "uppercase",
                    }}
                  >
                    Detected
                  </div>
                </div>
                <div>
                  <div
                    style={{
                      fontSize: "24px",
                      fontWeight: 700,
                      color: colors.primary[500],
                    }}
                  >
                    {selectedResults.size}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: colors.neutral[500],
                      textTransform: "uppercase",
                    }}
                  >
                    Selected
                  </div>
                </div>
              </div>

              {/* Selection controls */}
              <div
                style={{
                  display: "flex",
                  gap: spacing[2],
                  marginBottom: spacing[4],
                }}
              >
                <button
                  type="button"
                  onClick={handleSelectAll}
                  style={{
                    padding: `${spacing[2]} ${spacing[3]}`,
                    background: colors.neutral[100],
                    border: `1px solid ${colors.neutral[300]}`,
                    borderRadius: borderRadius.sm,
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Select All with Variants
                </button>
                <button
                  type="button"
                  onClick={handleSelectNone}
                  style={{
                    padding: `${spacing[2]} ${spacing[3]}`,
                    background: colors.neutral[100],
                    border: `1px solid ${colors.neutral[300]}`,
                    borderRadius: borderRadius.sm,
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Deselect All
                </button>
              </div>

              {/* Results list */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: spacing[2],
                }}
              >
                {results.map((result) => {
                  const imageUrl = getMediaImage(result.mediaId);
                  const isSelected = selectedResults.has(result.mediaId);
                  const hasVariants = result.detectedVariants.length > 0;

                  return (
                    <label
                      key={result.mediaId}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: spacing[3],
                        padding: spacing[3],
                        background: isSelected
                          ? colors.primary[50]
                          : colors.neutral[50],
                        border: `1px solid ${
                          isSelected ? colors.primary[300] : colors.neutral[200]
                        }`,
                        borderRadius: borderRadius.md,
                        cursor: hasVariants ? "pointer" : "not-allowed",
                        opacity: hasVariants ? 1 : 0.6,
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!hasVariants}
                        onChange={() => handleToggleResult(result.mediaId)}
                        style={{
                          width: "18px",
                          height: "18px",
                          accentColor: colors.primary[500],
                        }}
                      />

                      {imageUrl && (
                        <img
                          src={imageUrl}
                          alt=""
                          style={{
                            width: "48px",
                            height: "48px",
                            objectFit: "cover",
                            borderRadius: borderRadius.sm,
                          }}
                        />
                      )}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {hasVariants ? (
                          <>
                            <div
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: spacing[1],
                              }}
                            >
                              {result.detectedVariants.map((v) => (
                                <span
                                  key={v}
                                  style={{
                                    padding: `${spacing[1]} ${spacing[2]}`,
                                    background: colors.success.light,
                                    color: colors.success.dark,
                                    fontSize: "11px",
                                    fontWeight: 600,
                                    borderRadius: borderRadius.sm,
                                  }}
                                >
                                  {v}
                                </span>
                              ))}
                            </div>
                            {result.reasoning && (
                              <div
                                style={{
                                  fontSize: "11px",
                                  color: colors.neutral[600],
                                  marginTop: spacing[1],
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {result.reasoning}
                              </div>
                            )}
                          </>
                        ) : (
                          <div
                            style={{
                              fontSize: "12px",
                              color: colors.neutral[500],
                              fontStyle: "italic",
                            }}
                          >
                            No variants detected
                          </div>
                        )}
                      </div>

                      {/* Confidence badge */}
                      <div
                        style={{
                          padding: `${spacing[1]} ${spacing[2]}`,
                          background:
                            result.confidence >= 0.8
                              ? colors.success.light
                              : result.confidence >= 0.5
                                ? colors.warning.light
                                : colors.neutral[100],
                          color:
                            result.confidence >= 0.8
                              ? colors.success.dark
                              : result.confidence >= 0.5
                                ? colors.warning.dark
                                : colors.neutral[600],
                          fontSize: "11px",
                          fontWeight: 600,
                          borderRadius: borderRadius.sm,
                        }}
                      >
                        {Math.round(result.confidence * 100)}%
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {state === "complete" && (
          <div
            style={{
              padding: spacing[5],
              borderTop: `1px solid ${colors.neutral[200]}`,
              display: "flex",
              justifyContent: "flex-end",
              gap: spacing[3],
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: `${spacing[3]} ${spacing[5]}`,
                background: colors.neutral[100],
                color: colors.neutral[700],
                border: `1px solid ${colors.neutral[300]}`,
                borderRadius: borderRadius.md,
                fontSize: "14px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleApply}
              disabled={selectedResults.size === 0}
              style={{
                padding: `${spacing[3]} ${spacing[5]}`,
                background:
                  selectedResults.size > 0
                    ? colors.primary[500]
                    : colors.neutral[300],
                color: colors.neutral[0],
                border: "none",
                borderRadius: borderRadius.md,
                fontSize: "14px",
                fontWeight: 600,
                cursor: selectedResults.size > 0 ? "pointer" : "not-allowed",
              }}
            >
              Apply {selectedResults.size} Mapping
              {selectedResults.size !== 1 ? "s" : ""}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
