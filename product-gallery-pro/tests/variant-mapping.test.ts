/**
 * Unit tests for the Variant Image Mapping System (PGP-F1.5)
 */

import { describe, it, expect } from "vitest";
import {
  createEmptyMapping,
  createEmptyImageMapping,
  DEFAULT_MAPPING_SETTINGS,
} from "~/types/variant-mapping";
import type {
  VariantImageMap,
  ImageMapping,
  ProductMedia,
  ProductVariant,
  VariantOptions,
} from "~/types/variant-mapping";
import {
  extractVariantOptions,
  detectFromFilename,
} from "~/lib/ai-detection.server";

// =============================================================================
// TYPE DEFINITION TESTS
// =============================================================================

describe("createEmptyMapping", () => {
  it("should return a valid empty mapping", () => {
    const mapping = createEmptyMapping();

    expect(mapping.version).toBe(1);
    expect(mapping.updated_by).toBe("manual");
    expect(mapping.mappings).toEqual({});
    expect(mapping.settings).toEqual(DEFAULT_MAPPING_SETTINGS);
    expect(mapping.updated_at).toBeDefined();
  });

  it("should have correct default settings", () => {
    const mapping = createEmptyMapping();

    expect(mapping.settings.fallback).toBe("show_all");
    expect(mapping.settings.match_mode).toBe("any");
    expect(mapping.settings.custom_ordering).toBe(false);
  });
});

describe("createEmptyImageMapping", () => {
  it("should return a valid empty image mapping with default source", () => {
    const imageMapping = createEmptyImageMapping();

    expect(imageMapping.variants).toEqual([]);
    expect(imageMapping.universal).toBe(false);
    expect(imageMapping.position).toBe(0);
    expect(imageMapping.source).toBe("manual");
    expect(imageMapping.confidence).toBeNull();
    expect(imageMapping.mapped_at).toBeDefined();
  });

  it("should accept a custom source", () => {
    const imageMapping = createEmptyImageMapping("ai");
    expect(imageMapping.source).toBe("ai");
  });
});

// =============================================================================
// VARIANT OPTION EXTRACTION TESTS
// =============================================================================

describe("extractVariantOptions", () => {
  it("should extract unique option groups from variants", () => {
    const variants: ProductVariant[] = [
      {
        id: "v1",
        title: "Red / Small",
        selectedOptions: [
          { name: "Color", value: "Red" },
          { name: "Size", value: "Small" },
        ],
        image: null,
      },
      {
        id: "v2",
        title: "Red / Large",
        selectedOptions: [
          { name: "Color", value: "Red" },
          { name: "Size", value: "Large" },
        ],
        image: null,
      },
      {
        id: "v3",
        title: "Blue / Small",
        selectedOptions: [
          { name: "Color", value: "Blue" },
          { name: "Size", value: "Small" },
        ],
        image: null,
      },
    ];

    const options = extractVariantOptions(variants);

    expect(options).toHaveLength(2);

    const colorOption = options.find((o) => o.name === "Color");
    expect(colorOption).toBeDefined();
    expect(colorOption!.values).toContain("Red");
    expect(colorOption!.values).toContain("Blue");

    const sizeOption = options.find((o) => o.name === "Size");
    expect(sizeOption).toBeDefined();
    expect(sizeOption!.values).toContain("Small");
    expect(sizeOption!.values).toContain("Large");
  });

  it("should handle single-option variants", () => {
    const variants: ProductVariant[] = [
      {
        id: "v1",
        title: "Default",
        selectedOptions: [{ name: "Title", value: "Default Title" }],
        image: null,
      },
    ];

    const options = extractVariantOptions(variants);
    expect(options).toHaveLength(1);
    expect(options[0].name).toBe("Title");
  });

  it("should handle empty variants", () => {
    const options = extractVariantOptions([]);
    expect(options).toEqual([]);
  });

  it("should sort values alphabetically", () => {
    const variants: ProductVariant[] = [
      {
        id: "v1",
        title: "Zebra",
        selectedOptions: [{ name: "Pattern", value: "Zebra" }],
        image: null,
      },
      {
        id: "v2",
        title: "Apple",
        selectedOptions: [{ name: "Pattern", value: "Apple" }],
        image: null,
      },
      {
        id: "v3",
        title: "Mango",
        selectedOptions: [{ name: "Pattern", value: "Mango" }],
        image: null,
      },
    ];

    const options = extractVariantOptions(variants);
    expect(options[0].values).toEqual(["Apple", "Mango", "Zebra"]);
  });
});

// =============================================================================
// FILENAME DETECTION TESTS
// =============================================================================

describe("detectFromFilename", () => {
  const colorOptions: VariantOptions[] = [
    { name: "Color", values: ["Red", "Blue", "Green", "Black"] },
  ];

  const sizeOptions: VariantOptions[] = [
    { name: "Size", values: ["S", "M", "L", "XL"] },
  ];

  const mixedOptions: VariantOptions[] = [
    { name: "Color", values: ["Red", "Blue"] },
    { name: "Size", values: ["Small", "Large"] },
  ];

  it("should detect color from image URL filename", () => {
    const media: ProductMedia = {
      id: "img1",
      alt: null,
      image: {
        url: "https://cdn.shopify.com/product-red-front.jpg",
        altText: null,
      },
    };

    const result = detectFromFilename(media, colorOptions);
    expect(result.variants).toContain("Red");
    expect(result.confidence).toBeGreaterThan(0);
  });

  it("should detect color from alt text", () => {
    const media: ProductMedia = {
      id: "img1",
      alt: "Blue cotton t-shirt",
      image: {
        url: "https://cdn.shopify.com/img_001.jpg",
        altText: "Blue cotton t-shirt",
      },
    };

    const result = detectFromFilename(media, colorOptions);
    expect(result.variants).toContain("Blue");
  });

  it("should return empty for no matches", () => {
    const media: ProductMedia = {
      id: "img1",
      alt: "Product photo",
      image: {
        url: "https://cdn.shopify.com/product.jpg",
        altText: null,
      },
    };

    const result = detectFromFilename(media, colorOptions);
    expect(result.variants).toEqual([]);
    expect(result.confidence).toBe(0);
  });

  it("should detect multiple option types", () => {
    const media: ProductMedia = {
      id: "img1",
      alt: "Red shirt large size",
      image: {
        url: "https://cdn.shopify.com/red-shirt-large.jpg",
        altText: null,
      },
    };

    const result = detectFromFilename(media, mixedOptions);
    expect(result.variants).toContain("Red");
    expect(result.variants).toContain("Large");
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("should handle media with no image URL", () => {
    const media: ProductMedia = {
      id: "img1",
      alt: "Red shirt",
      image: null,
    };

    const result = detectFromFilename(media, colorOptions);
    expect(result.variants).toContain("Red");
  });

  it("should be case-insensitive", () => {
    const media: ProductMedia = {
      id: "img1",
      alt: null,
      image: {
        url: "https://cdn.shopify.com/product-RED-FRONT.jpg",
        altText: null,
      },
    };

    const result = detectFromFilename(media, colorOptions);
    expect(result.variants).toContain("Red");
  });
});

// =============================================================================
// MAPPING LOGIC TESTS
// =============================================================================

describe("VariantImageMap structure", () => {
  it("should support multi-image per variant", () => {
    const mapping: VariantImageMap = {
      version: 1,
      updated_at: new Date().toISOString(),
      updated_by: "manual",
      mappings: {
        media1: {
          variants: ["Red"],
          universal: false,
          position: 0,
          source: "manual",
          confidence: null,
          mapped_at: new Date().toISOString(),
        },
        media2: {
          variants: ["Red"],
          universal: false,
          position: 1,
          source: "manual",
          confidence: null,
          mapped_at: new Date().toISOString(),
        },
        media3: {
          variants: ["Blue"],
          universal: false,
          position: 0,
          source: "manual",
          confidence: null,
          mapped_at: new Date().toISOString(),
        },
      },
      settings: DEFAULT_MAPPING_SETTINGS,
    };

    // Count images for "Red" variant
    const redImages = Object.values(mapping.mappings).filter((m) =>
      m.variants.includes("Red")
    );
    expect(redImages).toHaveLength(2);

    // Count images for "Blue" variant
    const blueImages = Object.values(mapping.mappings).filter((m) =>
      m.variants.includes("Blue")
    );
    expect(blueImages).toHaveLength(1);
  });

  it("should support universal images", () => {
    const mapping: VariantImageMap = {
      version: 1,
      updated_at: new Date().toISOString(),
      updated_by: "manual",
      mappings: {
        media1: {
          variants: [],
          universal: true,
          position: 0,
          source: "manual",
          confidence: null,
          mapped_at: new Date().toISOString(),
        },
        media2: {
          variants: ["Red"],
          universal: false,
          position: 0,
          source: "manual",
          confidence: null,
          mapped_at: new Date().toISOString(),
        },
      },
      settings: DEFAULT_MAPPING_SETTINGS,
    };

    const universalImages = Object.values(mapping.mappings).filter(
      (m) => m.universal
    );
    expect(universalImages).toHaveLength(1);
  });

  it("should support custom ordering via position", () => {
    const mapping: VariantImageMap = {
      version: 1,
      updated_at: new Date().toISOString(),
      updated_by: "manual",
      mappings: {
        media_a: {
          variants: ["Red"],
          universal: false,
          position: 2,
          source: "manual",
          confidence: null,
          mapped_at: new Date().toISOString(),
        },
        media_b: {
          variants: ["Red"],
          universal: false,
          position: 0,
          source: "manual",
          confidence: null,
          mapped_at: new Date().toISOString(),
        },
        media_c: {
          variants: ["Red"],
          universal: false,
          position: 1,
          source: "manual",
          confidence: null,
          mapped_at: new Date().toISOString(),
        },
      },
      settings: { ...DEFAULT_MAPPING_SETTINGS, custom_ordering: true },
    };

    // Sort by position
    const redImages = Object.entries(mapping.mappings)
      .filter(([, m]) => m.variants.includes("Red"))
      .sort(([, a], [, b]) => a.position - b.position)
      .map(([id]) => id);

    expect(redImages).toEqual(["media_b", "media_c", "media_a"]);
  });

  it("should track AI confidence scores", () => {
    const mapping: VariantImageMap = {
      version: 1,
      updated_at: new Date().toISOString(),
      updated_by: "ai",
      mappings: {
        media1: {
          variants: ["Red"],
          universal: false,
          position: 0,
          source: "ai",
          confidence: 0.92,
          mapped_at: new Date().toISOString(),
        },
        media2: {
          variants: ["Blue"],
          universal: false,
          position: 0,
          source: "ai",
          confidence: 0.45,
          mapped_at: new Date().toISOString(),
        },
      },
      settings: DEFAULT_MAPPING_SETTINGS,
    };

    const highConfidence = Object.values(mapping.mappings).filter(
      (m) => m.confidence !== null && m.confidence >= 0.7
    );
    expect(highConfidence).toHaveLength(1);

    const lowConfidence = Object.values(mapping.mappings).filter(
      (m) => m.confidence !== null && m.confidence < 0.5
    );
    expect(lowConfidence).toHaveLength(1);
  });
});

// =============================================================================
// FALLBACK BEHAVIOR TESTS
// =============================================================================

describe("Fallback behavior", () => {
  it("should default to show_all fallback", () => {
    const settings = DEFAULT_MAPPING_SETTINGS;
    expect(settings.fallback).toBe("show_all");
  });

  it("should default to any match mode", () => {
    const settings = DEFAULT_MAPPING_SETTINGS;
    expect(settings.match_mode).toBe("any");
  });

  it("should default to no custom ordering", () => {
    const settings = DEFAULT_MAPPING_SETTINGS;
    expect(settings.custom_ordering).toBe(false);
  });
});

// =============================================================================
// SERIALIZATION TESTS
// =============================================================================

describe("JSON serialization", () => {
  it("should round-trip through JSON.stringify/parse", () => {
    const original: VariantImageMap = {
      version: 1,
      updated_at: "2024-01-01T00:00:00.000Z",
      updated_by: "manual",
      mappings: {
        media1: {
          variants: ["Red", "Large"],
          universal: false,
          position: 0,
          source: "manual",
          confidence: null,
          mapped_at: "2024-01-01T00:00:00.000Z",
        },
        media2: {
          variants: [],
          universal: true,
          position: 1,
          source: "ai",
          confidence: 0.85,
          mapped_at: "2024-01-01T00:00:00.000Z",
        },
      },
      settings: {
        fallback: "show_universal",
        match_mode: "all",
        custom_ordering: true,
      },
    };

    const serialized = JSON.stringify(original);
    const parsed = JSON.parse(serialized) as VariantImageMap;

    expect(parsed.version).toBe(original.version);
    expect(parsed.updated_by).toBe(original.updated_by);
    expect(parsed.mappings.media1.variants).toEqual(["Red", "Large"]);
    expect(parsed.mappings.media2.universal).toBe(true);
    expect(parsed.mappings.media2.confidence).toBe(0.85);
    expect(parsed.settings.fallback).toBe("show_universal");
    expect(parsed.settings.match_mode).toBe("all");
    expect(parsed.settings.custom_ordering).toBe(true);
  });
});
