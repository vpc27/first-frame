/**
 * MappingSummary Component
 *
 * Shows a summary of the current mapping state:
 * - Per-variant image counts
 * - Warnings for unmapped variants
 * - Overall mapping statistics
 */

import { colors, borderRadius, spacing } from "~/styles/design-system";
import type {
  ImageMapping,
  VariantOptions,
  MappingSummary as MappingSummaryType,
  MappingWarning,
} from "~/types/variant-mapping";

interface MappingSummaryProps {
  mappings: Record<string, ImageMapping>;
  variantOptions: VariantOptions[];
  totalImages: number;
}

function calculateSummary(
  mappings: Record<string, ImageMapping>,
  variantOptions: VariantOptions[],
  totalImages: number
): MappingSummaryType {
  const mappingEntries = Object.values(mappings);
  const mappedImages = mappingEntries.filter(
    (m) => m.variants.length > 0 || m.universal
  ).length;
  const universalImages = mappingEntries.filter((m) => m.universal).length;
  const unmappedImages = totalImages - mappedImages;

  // Count images per variant option value
  const variantCounts: Record<string, number> = {};

  for (const option of variantOptions) {
    for (const value of option.values) {
      variantCounts[value] = universalImages; // Universal images count for all
    }
  }

  for (const mapping of mappingEntries) {
    for (const variant of mapping.variants) {
      variantCounts[variant] = (variantCounts[variant] || 0) + 1;
    }
  }

  // Generate warnings
  const warnings: MappingWarning[] = [];

  for (const option of variantOptions) {
    for (const value of option.values) {
      const count = variantCounts[value] || 0;
      if (count === 0) {
        warnings.push({
          type: "no_images",
          variantValue: value,
          message: `"${value}" has no images assigned`,
        });
      }
    }
  }

  // Check for low confidence AI mappings
  for (const [mediaId, mapping] of Object.entries(mappings)) {
    if (
      mapping.source === "ai" &&
      mapping.confidence !== null &&
      mapping.confidence < 0.5
    ) {
      warnings.push({
        type: "low_confidence",
        mediaId,
        message: `Image has low AI confidence (${Math.round(mapping.confidence * 100)}%)`,
      });
    }
  }

  if (unmappedImages > 0 && totalImages > 0) {
    warnings.push({
      type: "unmapped",
      message: `${unmappedImages} image${unmappedImages !== 1 ? "s" : ""} not assigned to any variant`,
    });
  }

  return {
    totalImages,
    mappedImages,
    universalImages,
    unmappedImages,
    variantCounts,
    warnings,
  };
}

export function MappingSummary({
  mappings,
  variantOptions,
  totalImages,
}: MappingSummaryProps) {
  const summary = calculateSummary(mappings, variantOptions, totalImages);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing[4],
      }}
    >
      {/* Stats row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
          gap: spacing[3],
        }}
      >
        <StatBox
          label="Total"
          value={summary.totalImages}
          color={colors.neutral[600]}
        />
        <StatBox
          label="Mapped"
          value={summary.mappedImages}
          color={colors.success.main}
        />
        <StatBox
          label="Universal"
          value={summary.universalImages}
          color={colors.info.main}
        />
        <StatBox
          label="Unmapped"
          value={summary.unmappedImages}
          color={
            summary.unmappedImages > 0
              ? colors.warning.main
              : colors.neutral[400]
          }
        />
      </div>

      {/* Per-variant counts */}
      {variantOptions.length > 0 && (
        <div>
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: colors.neutral[600],
              textTransform: "uppercase",
              letterSpacing: "0.5px",
              marginBottom: spacing[2],
            }}
          >
            Images per Variant
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: spacing[2],
            }}
          >
            {variantOptions.flatMap((option) =>
              option.values.map((value) => {
                const count = summary.variantCounts[value] || 0;
                return (
                  <span
                    key={value}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: spacing[1],
                      padding: `${spacing[1]} ${spacing[2]}`,
                      background:
                        count === 0 ? colors.warning.light : colors.neutral[100],
                      border: `1px solid ${
                        count === 0 ? colors.warning.main : colors.neutral[200]
                      }`,
                      borderRadius: borderRadius.sm,
                      fontSize: "12px",
                      color:
                        count === 0 ? colors.warning.dark : colors.neutral[700],
                    }}
                  >
                    {value}
                    <span
                      style={{
                        fontWeight: 600,
                        color:
                          count === 0
                            ? colors.warning.dark
                            : colors.neutral[800],
                      }}
                    >
                      {count}
                    </span>
                  </span>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Warnings */}
      {summary.warnings.length > 0 && (
        <div
          style={{
            padding: spacing[3],
            background: colors.warning.light,
            borderRadius: borderRadius.md,
            border: `1px solid ${colors.warning.main}`,
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: colors.warning.dark,
              marginBottom: spacing[2],
            }}
          >
            Warnings ({summary.warnings.length})
          </div>
          <ul
            style={{
              margin: 0,
              padding: `0 0 0 ${spacing[4]}`,
              fontSize: "12px",
              color: colors.warning.dark,
            }}
          >
            {summary.warnings.slice(0, 5).map((warning, index) => (
              <li key={index} style={{ marginBottom: spacing[1] }}>
                {warning.message}
              </li>
            ))}
            {summary.warnings.length > 5 && (
              <li style={{ fontStyle: "italic" }}>
                ...and {summary.warnings.length - 5} more
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      style={{
        padding: spacing[3],
        background: colors.neutral[50],
        borderRadius: borderRadius.sm,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "24px",
          fontWeight: 700,
          color,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: "11px",
          color: colors.neutral[500],
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
      >
        {label}
      </div>
    </div>
  );
}
