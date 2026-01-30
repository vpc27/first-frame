/**
 * VariantCheckboxes Component
 *
 * Displays checkboxes for assigning variant options to the selected image.
 * Organized by option group (e.g., Color, Size).
 */

import { colors, borderRadius, spacing } from "~/styles/design-system";
import type { VariantOptions, ImageMapping } from "~/types/variant-mapping";

interface VariantCheckboxesProps {
  variantOptions: VariantOptions[];
  mapping: ImageMapping | null;
  onToggleVariant: (value: string) => void;
  disabled?: boolean;
}

export function VariantCheckboxes({
  variantOptions,
  mapping,
  onToggleVariant,
  disabled = false,
}: VariantCheckboxesProps) {
  const selectedVariants = new Set(mapping?.variants ?? []);

  if (variantOptions.length === 0) {
    return (
      <div
        style={{
          padding: spacing[4],
          color: colors.neutral[500],
          fontStyle: "italic",
          fontSize: "13px",
        }}
      >
        This product has no variant options
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: spacing[4],
      }}
    >
      {variantOptions.map((option) => (
        <div key={option.name}>
          {/* Option group header */}
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
            {option.name}
          </div>

          {/* Option values */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: spacing[2],
            }}
          >
            {option.values.map((value) => {
              const isChecked = selectedVariants.has(value);
              const isUniversal = mapping?.universal ?? false;

              return (
                <label
                  key={value}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: spacing[2],
                    padding: `${spacing[2]} ${spacing[3]}`,
                    background: isChecked
                      ? colors.primary[50]
                      : colors.neutral[50],
                    border: `1px solid ${
                      isChecked ? colors.primary[300] : colors.neutral[200]
                    }`,
                    borderRadius: borderRadius.sm,
                    cursor: disabled || isUniversal ? "not-allowed" : "pointer",
                    opacity: disabled || isUniversal ? 0.5 : 1,
                    transition: "all 0.15s ease",
                    fontSize: "13px",
                    fontWeight: isChecked ? 500 : 400,
                    color: isChecked ? colors.primary[700] : colors.neutral[700],
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={disabled || isUniversal}
                    onChange={() => onToggleVariant(value)}
                    style={{
                      width: "16px",
                      height: "16px",
                      accentColor: colors.primary[500],
                      cursor: disabled || isUniversal ? "not-allowed" : "pointer",
                    }}
                  />
                  {value}
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
