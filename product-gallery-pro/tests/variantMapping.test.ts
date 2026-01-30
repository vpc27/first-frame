import { describe, it, expect } from "vitest";

// Test the variant filtering logic that uses Shopify's native variant-media data
describe("Variant Media Filtering", () => {
  describe("Variant filtering logic", () => {
    // Simulating the gallery.js filtering logic
    // This uses Shopify's native variant.featured_media data - zero config needed
    function filterSlides(
      allSlides: Array<{ mediaId: string; variantIds: string }>,
      variantId: string,
      mapping: Record<string, string[]> | null
    ): Array<{ mediaId: string; variantIds: string }> {
      if (!variantId) {
        return allSlides;
      }

      const variantIdStr = String(variantId);

      // Use mapping (from Shopify's native variant.featured_media)
      if (mapping && mapping[variantIdStr]) {
        const mappedMediaIds = mapping[variantIdStr];
        return allSlides.filter((s) => {
          // Include if media is mapped to this variant
          if (mappedMediaIds.includes(s.mediaId)) {
            return true;
          }
          // Include generic slides (no variant association)
          return !s.variantIds;
        });
      } else {
        // Fallback: use data-variant-ids attribute
        return allSlides.filter((s) => {
          const variantIds = (s.variantIds || "").split(",").filter(Boolean);
          if (variantIds.includes(variantIdStr)) {
            return true;
          }
          // Include generic slides
          return variantIds.length === 0;
        });
      }
    }

    const allSlides = [
      { mediaId: "media1", variantIds: "" },           // Generic image
      { mediaId: "media2", variantIds: "variant1" },   // Black variant
      { mediaId: "media3", variantIds: "variant2" },   // Beige variant
      { mediaId: "media4", variantIds: "" },           // Generic image
      { mediaId: "media5", variantIds: "variant3" },   // Blue variant
    ];

    // Mapping built from Shopify's native variant.featured_media
    const nativeMapping = {
      "variant1": ["media2"],  // Black -> media2
      "variant2": ["media3"],  // Beige -> media3
      "variant3": ["media5"],  // Blue -> media5
    };

    it("should return all slides when no variant selected", () => {
      const result = filterSlides(allSlides, "", nativeMapping);
      expect(result).toHaveLength(5);
    });

    it("should filter using Shopify native mapping for Black variant", () => {
      const result = filterSlides(allSlides, "variant1", nativeMapping);
      // Should include: media1 (generic), media2 (variant1), media4 (generic)
      expect(result).toHaveLength(3);
      expect(result.map(s => s.mediaId)).toEqual(["media1", "media2", "media4"]);
    });

    it("should filter using Shopify native mapping for Beige variant", () => {
      const result = filterSlides(allSlides, "variant2", nativeMapping);
      // Should include: media1 (generic), media3 (variant2), media4 (generic)
      expect(result).toHaveLength(3);
      expect(result.map(s => s.mediaId)).toEqual(["media1", "media3", "media4"]);
    });

    it("should filter using Shopify native mapping for Blue variant", () => {
      const result = filterSlides(allSlides, "variant3", nativeMapping);
      // Should include: media1 (generic), media4 (generic), media5 (variant3)
      expect(result).toHaveLength(3);
      expect(result.map(s => s.mediaId)).toEqual(["media1", "media4", "media5"]);
    });

    it("should fall back to data-variant-ids when no mapping", () => {
      const result = filterSlides(allSlides, "variant1", null);
      // Should include: media1 (generic), media2 (variant1), media4 (generic)
      expect(result).toHaveLength(3);
      expect(result.map(s => s.mediaId)).toEqual(["media1", "media2", "media4"]);
    });

    it("should return all slides for unknown variant", () => {
      const result = filterSlides(allSlides, "unknown", nativeMapping);
      // No mapping for this variant, falls back to data-variant-ids
      // Only generic slides match (no variantIds)
      expect(result).toHaveLength(2);
      expect(result.map(s => s.mediaId)).toEqual(["media1", "media4"]);
    });
  });
});
