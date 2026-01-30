/**
 * ImageGrid Component
 *
 * Displays a grid of product images with selection state for variant mapping.
 * Each image shows assigned variants and universal status.
 */

import { colors, borderRadius, spacing, shadows } from "~/styles/design-system";
import type { ProductMedia, ImageMapping } from "~/types/variant-mapping";

interface ImageGridProps {
  media: ProductMedia[];
  mappings: Record<string, ImageMapping>;
  selectedMediaId: string | null;
  onSelectMedia: (mediaId: string) => void;
}

export function ImageGrid({
  media,
  mappings,
  selectedMediaId,
  onSelectMedia,
}: ImageGridProps) {
  if (media.length === 0) {
    return (
      <div
        style={{
          padding: spacing[8],
          textAlign: "center",
          color: colors.neutral[500],
          background: colors.neutral[50],
          borderRadius: borderRadius.md,
          border: `1px dashed ${colors.neutral[300]}`,
        }}
      >
        No images found for this product
      </div>
    );
  }

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: spacing[4],
      }}
    >
      {media.map((item) => {
        const mapping = mappings[item.id];
        const isSelected = selectedMediaId === item.id;
        const hasMapping =
          mapping && (mapping.variants.length > 0 || mapping.universal);

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectMedia(item.id)}
            style={{
              position: "relative",
              padding: 0,
              border: isSelected
                ? `3px solid ${colors.primary[500]}`
                : `1px solid ${colors.neutral[200]}`,
              borderRadius: borderRadius.md,
              background: colors.neutral[0],
              cursor: "pointer",
              overflow: "hidden",
              aspectRatio: "1",
              boxShadow: isSelected ? shadows.md : shadows.sm,
              transition: "all 0.15s ease",
            }}
          >
            {/* Image */}
            {item.image?.url && (
              <img
                src={item.image.url}
                alt={item.alt || "Product image"}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            )}

            {/* Mapping indicator overlay */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                padding: spacing[2],
                background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
              }}
            >
              {mapping?.universal ? (
                <span
                  style={{
                    display: "inline-block",
                    padding: `${spacing[1]} ${spacing[2]}`,
                    background: colors.info.main,
                    color: colors.neutral[0],
                    fontSize: "10px",
                    fontWeight: 600,
                    borderRadius: borderRadius.sm,
                    textTransform: "uppercase",
                  }}
                >
                  Universal
                </span>
              ) : hasMapping ? (
                <span
                  style={{
                    display: "inline-block",
                    padding: `${spacing[1]} ${spacing[2]}`,
                    background: colors.success.main,
                    color: colors.neutral[0],
                    fontSize: "10px",
                    fontWeight: 600,
                    borderRadius: borderRadius.sm,
                  }}
                >
                  {mapping.variants.length} variant
                  {mapping.variants.length !== 1 ? "s" : ""}
                </span>
              ) : (
                <span
                  style={{
                    display: "inline-block",
                    padding: `${spacing[1]} ${spacing[2]}`,
                    background: colors.neutral[600],
                    color: colors.neutral[0],
                    fontSize: "10px",
                    fontWeight: 600,
                    borderRadius: borderRadius.sm,
                  }}
                >
                  Not mapped
                </span>
              )}
            </div>

            {/* Selection indicator */}
            {isSelected && (
              <div
                style={{
                  position: "absolute",
                  top: spacing[2],
                  right: spacing[2],
                  width: "24px",
                  height: "24px",
                  borderRadius: borderRadius.full,
                  background: colors.primary[500],
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: colors.neutral[0],
                  fontSize: "14px",
                }}
              >
                &#10003;
              </div>
            )}

            {/* AI confidence indicator */}
            {mapping?.source === "ai" && mapping.confidence !== null && (
              <div
                style={{
                  position: "absolute",
                  top: spacing[2],
                  left: spacing[2],
                  padding: `${spacing[1]} ${spacing[2]}`,
                  background:
                    mapping.confidence >= 0.8
                      ? colors.success.main
                      : mapping.confidence >= 0.5
                        ? colors.warning.main
                        : colors.critical.main,
                  color: colors.neutral[0],
                  fontSize: "10px",
                  fontWeight: 600,
                  borderRadius: borderRadius.sm,
                }}
              >
                AI {Math.round(mapping.confidence * 100)}%
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
