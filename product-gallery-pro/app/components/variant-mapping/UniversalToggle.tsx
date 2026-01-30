/**
 * UniversalToggle Component
 *
 * Toggle to mark an image as "universal" (shown for all variants).
 */

import { colors, borderRadius, spacing } from "~/styles/design-system";
import type { ImageMapping } from "~/types/variant-mapping";

interface UniversalToggleProps {
  mapping: ImageMapping | null;
  onToggle: (universal: boolean) => void;
  disabled?: boolean;
}

export function UniversalToggle({
  mapping,
  onToggle,
  disabled = false,
}: UniversalToggleProps) {
  const isUniversal = mapping?.universal ?? false;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: spacing[4],
        background: isUniversal ? colors.info.light : colors.neutral[50],
        border: `1px solid ${isUniversal ? colors.info.main : colors.neutral[200]}`,
        borderRadius: borderRadius.md,
      }}
    >
      <div>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: colors.neutral[800],
            marginBottom: spacing[1],
          }}
        >
          Universal Image
        </div>
        <div
          style={{
            fontSize: "12px",
            color: colors.neutral[600],
          }}
        >
          Show this image for all variants
        </div>
      </div>

      <label
        style={{
          position: "relative",
          display: "inline-block",
          width: "48px",
          height: "26px",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <input
          type="checkbox"
          checked={isUniversal}
          disabled={disabled}
          onChange={(e) => onToggle(e.target.checked)}
          style={{
            opacity: 0,
            width: 0,
            height: 0,
          }}
        />
        <span
          style={{
            position: "absolute",
            cursor: disabled ? "not-allowed" : "pointer",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: isUniversal
              ? colors.info.main
              : colors.neutral[300],
            borderRadius: "26px",
            transition: "0.2s",
          }}
        >
          <span
            style={{
              position: "absolute",
              content: '""',
              height: "20px",
              width: "20px",
              left: isUniversal ? "25px" : "3px",
              bottom: "3px",
              backgroundColor: colors.neutral[0],
              borderRadius: "50%",
              transition: "0.2s",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            }}
          />
        </span>
      </label>
    </div>
  );
}
