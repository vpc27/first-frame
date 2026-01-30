/**
 * Quality indicator badge for image alt text.
 */

import { Badge } from "@shopify/polaris";

type AltTextQuality = "missing" | "poor" | "good";

function getQuality(altText: string | null | undefined): AltTextQuality {
  if (!altText || altText.trim() === "") return "missing";

  const text = altText.trim().toLowerCase();
  if (text.length < 20) return "poor";

  const badPrefixes = ["image of", "photo of", "picture of", "img of"];
  for (const prefix of badPrefixes) {
    if (text.startsWith(prefix)) return "poor";
  }

  const badExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
  for (const ext of badExtensions) {
    if (text.includes(ext)) return "poor";
  }

  return "good";
}

interface AltTextBadgeProps {
  altText: string | null;
  onClick?: () => void;
}

export function AltTextBadge({ altText, onClick }: AltTextBadgeProps) {
  const quality = getQuality(altText);

  const tone =
    quality === "missing"
      ? "critical"
      : quality === "poor"
        ? "warning"
        : "success";

  const label =
    quality === "missing"
      ? "Alt Missing"
      : quality === "poor"
        ? "Alt Poor"
        : "Alt Good";

  return (
    <span
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      style={{ cursor: onClick ? "pointer" : "default" }}
    >
      <Badge tone={tone}>{label}</Badge>
    </span>
  );
}
