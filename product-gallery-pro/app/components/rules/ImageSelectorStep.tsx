/**
 * ImageSelectorStep Component (PGP-F2.0 UX Overhaul)
 *
 * Visual image selection within the RuleWizard. Lets merchants pick
 * product images to apply rules to, with quick-select by tags.
 */

import { useState, useCallback } from "react";
import { TextField, Button, BlockStack, Text } from "@shopify/polaris";
import { colors, borderRadius, spacing, shadows } from "~/styles/design-system";

// =============================================================================
// TYPES
// =============================================================================

export interface ImageItem {
  id: string;
  src: string;
  alt?: string;
  tags?: string[];
  position: number;
}

interface ImageSelectorStepProps {
  images: ImageItem[];
  selectedImageIds: string[];
  onSelectionChange: (ids: string[]) => void;
  loading?: boolean;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ImageSelectorStep({
  images,
  selectedImageIds,
  onSelectionChange,
  loading,
}: ImageSelectorStepProps) {
  const [searchQuery, setSearchQuery] = useState("");

  // Collect all unique tags
  const allTags = Array.from(
    new Set(images.flatMap((img) => img.tags || []))
  ).sort();

  // Filter images by search
  const filteredImages = searchQuery
    ? images.filter(
        (img) =>
          (img.alt || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
          (img.tags || []).some((t) =>
            t.toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    : images;

  const toggleImage = useCallback(
    (id: string) => {
      const next = selectedImageIds.includes(id)
        ? selectedImageIds.filter((i) => i !== id)
        : [...selectedImageIds, id];
      onSelectionChange(next);
    },
    [selectedImageIds, onSelectionChange]
  );

  const selectByTag = useCallback(
    (tag: string) => {
      const tagImageIds = images
        .filter((img) => (img.tags || []).includes(tag))
        .map((img) => img.id);
      const merged = Array.from(new Set([...selectedImageIds, ...tagImageIds]));
      onSelectionChange(merged);
    },
    [images, selectedImageIds, onSelectionChange]
  );

  const selectAll = useCallback(() => {
    onSelectionChange(images.map((img) => img.id));
  }, [images, onSelectionChange]);

  const clearAll = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: spacing[8] }}>
        <Text as="p" tone="subdued">
          Loading images...
        </Text>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: spacing[8] }}>
        <Text as="p" tone="subdued">
          No images found. Select a product to see its images.
        </Text>
      </div>
    );
  }

  return (
    <BlockStack gap="400">
      {/* Search + actions */}
      <div
        style={{
          display: "flex",
          gap: spacing[3],
          alignItems: "flex-end",
        }}
      >
        <div style={{ flex: 1 }}>
          <TextField
            label=""
            labelHidden
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by alt text or tag..."
            autoComplete="off"
            clearButton
            onClearButtonClick={() => setSearchQuery("")}
          />
        </div>
        <Button onClick={selectAll} size="slim">
          Select all
        </Button>
        <Button onClick={clearAll} size="slim">
          Clear
        </Button>
      </div>

      {/* Quick-select tags */}
      {allTags.length > 0 && (
        <div>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: colors.neutral[500],
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: spacing[2],
            }}
          >
            Quick select by tag
          </div>
          <div style={{ display: "flex", gap: spacing[1], flexWrap: "wrap" }}>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => selectByTag(tag)}
                style={{
                  padding: `${spacing[1]} ${spacing[2]}`,
                  fontSize: "12px",
                  background: colors.primary[50],
                  color: colors.primary[700],
                  border: `1px solid ${colors.primary[200]}`,
                  borderRadius: borderRadius.full,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = colors.primary[100];
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = colors.primary[50];
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Selected count */}
      <div
        style={{
          fontSize: "13px",
          color: colors.neutral[600],
        }}
      >
        {selectedImageIds.length} of {images.length} images selected
      </div>

      {/* Image grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
          gap: spacing[3],
          maxHeight: "400px",
          overflowY: "auto",
          padding: spacing[1],
        }}
      >
        {filteredImages.map((image) => {
          const isSelected = selectedImageIds.includes(image.id);
          return (
            <button
              key={image.id}
              onClick={() => toggleImage(image.id)}
              style={{
                position: "relative",
                padding: 0,
                border: `2px solid ${isSelected ? colors.primary[500] : colors.neutral[200]}`,
                borderRadius: borderRadius.md,
                overflow: "hidden",
                cursor: "pointer",
                background: isSelected ? colors.primary[50] : colors.neutral[0],
                transition: "all 0.15s",
                aspectRatio: "1",
              }}
            >
              <img
                src={image.src}
                alt={image.alt || `Image ${image.position}`}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  opacity: isSelected ? 1 : 0.7,
                  transition: "opacity 0.15s",
                }}
              />

              {/* Checkbox overlay */}
              <div
                style={{
                  position: "absolute",
                  top: spacing[1],
                  right: spacing[1],
                  width: "22px",
                  height: "22px",
                  borderRadius: borderRadius.sm,
                  background: isSelected ? colors.primary[500] : "rgba(255,255,255,0.8)",
                  border: isSelected ? "none" : `1px solid ${colors.neutral[300]}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {isSelected && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <polyline
                      points="20 6 9 17 4 12"
                      stroke="white"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </div>

              {/* Tags */}
              {image.tags && image.tags.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: `${spacing[1]} ${spacing[1]}`,
                    background: "rgba(0,0,0,0.6)",
                    fontSize: "10px",
                    color: "white",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {image.tags.join(", ")}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </BlockStack>
  );
}

// =============================================================================
// HELPER: Extract rule match data from selected images
// =============================================================================

export function extractMatchDataFromImages(
  images: ImageItem[],
  selectedIds: string[]
): { matchType: string; matchValues: string[] } {
  const selectedImages = images.filter((img) => selectedIds.includes(img.id));

  // Try to use tags first
  const allTags = selectedImages.flatMap((img) => img.tags || []);
  const uniqueTags = Array.from(new Set(allTags));
  if (uniqueTags.length > 0) {
    return { matchType: "media_tag", matchValues: uniqueTags };
  }

  // Fallback to alt text patterns
  const altTexts = selectedImages
    .map((img) => img.alt)
    .filter((alt): alt is string => Boolean(alt));
  if (altTexts.length > 0) {
    return { matchType: "alt_text", matchValues: altTexts };
  }

  // Final fallback: use position
  return {
    matchType: "position",
    matchValues: selectedImages.map((img) => String(img.position)),
  };
}
