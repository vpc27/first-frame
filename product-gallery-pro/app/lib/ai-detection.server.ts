/**
 * AI Variant Detection Server Module (PGP-F1.5)
 *
 * Uses Ollama/LLaVA vision model to detect which variant options
 * are present in product images. Falls back to Claude if Ollama unavailable.
 * Includes filename pattern fallback.
 */

import { Buffer } from "node:buffer";
import { config } from "./config.server";
import { logAIRequest, logError, logInfo } from "./logging.server";
import {
  extractVariantOptions,
  getMediaImageUrl,
  type AIDetectionResult,
  type ProductMedia,
  type ProductVariant,
  type VariantOptions,
} from "~/types/variant-mapping";

// Re-export for backward compatibility
export { extractVariantOptions };

const OLLAMA_HOST = config.ollama.host;
const OLLAMA_MODEL = config.ollama.model;

// =============================================================================
// TYPES
// =============================================================================

interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
}

interface DetectionContext {
  productTitle: string;
  productType: string | null;
  variantOptions: VariantOptions[];
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

async function imageUrlToBase64(imageUrl: string): Promise<string> {
  const response = await fetch(imageUrl);
  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer).toString("base64");
}

function parseJsonResponse<T = unknown>(response: string): T {
  let cleaned = response
    .replace(/```json\n?/g, "")
    .replace(/```\n?/g, "")
    .trim();

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in AI response");
  }

  return JSON.parse(jsonMatch[0]) as T;
}

// =============================================================================
// FILENAME PATTERN DETECTION
// =============================================================================

const COLOR_PATTERNS: Record<string, string[]> = {
  red: ["red", "crimson", "scarlet", "ruby", "burgundy", "maroon"],
  blue: ["blue", "navy", "azure", "cobalt", "sapphire", "indigo", "teal", "cyan"],
  green: ["green", "olive", "forest", "lime", "mint", "sage", "emerald"],
  yellow: ["yellow", "gold", "golden", "mustard", "lemon"],
  orange: ["orange", "tangerine", "coral", "peach"],
  purple: ["purple", "violet", "lavender", "plum", "mauve", "lilac"],
  pink: ["pink", "rose", "blush", "fuchsia", "magenta"],
  black: ["black", "noir", "ebony", "onyx"],
  white: ["white", "ivory", "cream", "pearl", "snow"],
  grey: ["grey", "gray", "charcoal", "slate", "silver", "ash"],
  brown: ["brown", "tan", "chocolate", "coffee", "caramel", "bronze", "beige", "khaki"],
};

const SIZE_PATTERNS: Record<string, string[]> = {
  XS: ["xs", "extra-small", "extra small", "xsmall"],
  S: ["s", "small", "sm"],
  M: ["m", "medium", "med"],
  L: ["l", "large", "lg"],
  XL: ["xl", "extra-large", "extra large", "xlarge"],
  XXL: ["xxl", "2xl", "xx-large"],
  XXXL: ["xxxl", "3xl", "xxx-large"],
};

export function detectFromFilename(
  media: ProductMedia,
  variantOptions: VariantOptions[]
): { variants: string[]; confidence: number } {
  const detected: string[] = [];
  let totalMatches = 0;

  const imageUrl = getMediaImageUrl(media);
  const urlParts = imageUrl?.split("/") ?? [];
  const filename = urlParts[urlParts.length - 1]?.split("?")[0] ?? "";
  const searchText = `${filename} ${media.alt ?? ""} ${media.image?.altText ?? ""} ${media.preview?.image?.altText ?? ""}`.toLowerCase();

  for (const option of variantOptions) {
    const optionNameLower = option.name.toLowerCase();

    if (
      optionNameLower === "color" ||
      optionNameLower === "colour" ||
      optionNameLower.includes("color")
    ) {
      for (const value of option.values) {
        const valueLower = value.toLowerCase();
        if (searchText.includes(valueLower)) {
          detected.push(value);
          totalMatches++;
          continue;
        }
        for (const [, aliases] of Object.entries(COLOR_PATTERNS)) {
          if (aliases.includes(valueLower)) {
            for (const alias of aliases) {
              if (searchText.includes(alias)) {
                detected.push(value);
                totalMatches++;
                break;
              }
            }
            break;
          }
        }
      }
    }

    if (
      optionNameLower === "size" ||
      optionNameLower.includes("size")
    ) {
      for (const value of option.values) {
        const valueLower = value.toLowerCase();
        const regex = new RegExp(`\\b${valueLower}\\b`, "i");
        if (regex.test(searchText)) {
          detected.push(value);
          totalMatches++;
          continue;
        }
        for (const [canonical, aliases] of Object.entries(SIZE_PATTERNS)) {
          if (canonical.toLowerCase() === valueLower || aliases.includes(valueLower)) {
            for (const alias of aliases) {
              const aliasRegex = new RegExp(`\\b${alias}\\b`, "i");
              if (aliasRegex.test(searchText)) {
                detected.push(value);
                totalMatches++;
                break;
              }
            }
            break;
          }
        }
      }
    }

    if (
      optionNameLower !== "color" &&
      optionNameLower !== "colour" &&
      optionNameLower !== "size" &&
      !optionNameLower.includes("color") &&
      !optionNameLower.includes("size")
    ) {
      for (const value of option.values) {
        const valueLower = value.toLowerCase();
        if (valueLower.length >= 3 && searchText.includes(valueLower)) {
          detected.push(value);
          totalMatches++;
        }
      }
    }
  }

  const confidence = totalMatches > 0 ? Math.min(0.6 + totalMatches * 0.1, 0.8) : 0;
  return { variants: detected, confidence };
}

// =============================================================================
// AI VISION DETECTION — Ollama primary, Claude fallback
// =============================================================================

function buildVariantDetectionPrompt(context: DetectionContext): string {
  const optionsList = context.variantOptions
    .map((opt) => `- ${opt.name}: ${opt.values.join(", ")}`)
    .join("\n");

  return `You are an expert at identifying product variants from images. Analyze this product image and determine which variant options are visible.

PRODUCT: ${context.productTitle}
${context.productType ? `TYPE: ${context.productType}` : ""}

AVAILABLE OPTIONS:
${optionsList}

IMPORTANT INSTRUCTIONS:
1. Look carefully at the product in the image
2. Identify which specific variant options (like color, size, material, style) are visible
3. Only include options you can clearly see or determine from the image
4. Be conservative - if uncertain, don't include the option
5. Color, pattern, and style are usually visible in photos. Size, weight, and material are typically NOT determinable from an image unless a label or size chart is shown — skip these unless clearly visible.

Respond with ONLY a JSON object in this exact format:
{
  "variants": ["Red", "Large"],
  "confidence": 0.85,
  "reasoning": "The product shows a clearly red-colored item"
}

The "variants" array should contain the exact option VALUES (not names) that match what you see.
The "confidence" should be 0.0 to 1.0 based on how certain you are.
The "reasoning" should briefly explain what you observed.`;
}

async function queryOllamaForVariants(
  imageBase64: string,
  context: DetectionContext
): Promise<{ variants: string[]; confidence: number; reasoning: string }> {
  const startedAt = Date.now();
  const prompt = buildVariantDetectionPrompt(context);

  const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      images: [imageBase64],
      stream: false,
      options: {
        temperature: 0.2,
        top_p: 0.9,
        num_predict: 300,
      },
    }),
  });

  const elapsed = Date.now() - startedAt;
  logAIRequest("variant_detection", { elapsedMs: elapsed });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama request failed: ${errorText}`);
  }

  const data = (await response.json()) as OllamaResponse;
  return parseAndValidateVariants(data.response, context);
}

async function queryClaudeForVariants(
  imageUrl: string,
  context: DetectionContext
): Promise<{ variants: string[]; confidence: number; reasoning: string }> {
  const apiKey = config.anthropic.apiKey;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const startedAt = Date.now();
  const prompt = buildVariantDetectionPrompt(context);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2025-01-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      system: "You are an expert at identifying product variants from images. Respond with ONLY a JSON object.",
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "url", url: imageUrl } },
            { type: "text", text: prompt },
          ],
        },
      ],
    }),
  });

  const elapsed = Date.now() - startedAt;
  logAIRequest("claude_variant_detection", { elapsedMs: elapsed });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude API request failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as {
    content: Array<{ type: "text"; text: string }>;
  };

  const textContent = data.content.find((c) => c.type === "text");
  if (!textContent) {
    throw new Error("No text content in Claude response");
  }

  return parseAndValidateVariants(textContent.text, context);
}

function parseAndValidateVariants(
  rawText: string,
  context: DetectionContext
): { variants: string[]; confidence: number; reasoning: string } {
  const parsed = parseJsonResponse<{
    variants: string[];
    confidence: number;
    reasoning: string;
  }>(rawText);

  const validVariants = parsed.variants.filter((v) =>
    context.variantOptions.some((opt) => opt.values.includes(v))
  );

  return {
    variants: validVariants,
    confidence: parsed.confidence ?? 0.5,
    reasoning: parsed.reasoning ?? "",
  };
}

/**
 * Try Ollama first, fall back to Claude.
 */
async function queryAIForVariants(
  media: ProductMedia,
  context: DetectionContext
): Promise<{ variants: string[]; confidence: number; reasoning: string }> {
  const resolvedUrl = getMediaImageUrl(media);
  if (!resolvedUrl) {
    throw new Error("No image URL available for this media");
  }

  // Try Ollama first
  try {
    const imageBase64 = await imageUrlToBase64(resolvedUrl);
    return await queryOllamaForVariants(imageBase64, context);
  } catch (ollamaError) {
    logError("Ollama variant detection failed, trying Claude", ollamaError);
  }

  // Fall back to Claude
  if (config.anthropic.apiKey) {
    return await queryClaudeForVariants(resolvedUrl, context);
  }

  throw new Error("No AI provider available (Ollama offline, no Claude API key)");
}

// =============================================================================
// MAIN DETECTION FUNCTIONS
// =============================================================================

export async function detectVariantsForImage(
  media: ProductMedia,
  context: DetectionContext,
  useAI: boolean = true
): Promise<AIDetectionResult> {
  const filenameResult = detectFromFilename(media, context.variantOptions);

  if (filenameResult.confidence >= 0.7 || !useAI) {
    return {
      mediaId: media.id,
      detectedVariants: filenameResult.variants,
      confidence: filenameResult.confidence,
      reasoning: filenameResult.variants.length > 0
        ? `Detected from filename/alt text: ${filenameResult.variants.join(", ")}`
        : null,
    };
  }

  const imageUrl = getMediaImageUrl(media);
  if (imageUrl) {
    try {
      const aiResult = await queryAIForVariants(media, context);

      const mergedVariants = aiResult.confidence >= 0.6
        ? aiResult.variants
        : [...new Set([...filenameResult.variants, ...aiResult.variants])];

      const mergedConfidence = Math.max(
        aiResult.confidence,
        filenameResult.confidence
      );

      return {
        mediaId: media.id,
        detectedVariants: mergedVariants,
        confidence: mergedConfidence,
        reasoning: aiResult.reasoning,
      };
    } catch (error) {
      logError("AI detection failed, falling back to filename", error, {
        mediaId: media.id,
      });

      return {
        mediaId: media.id,
        detectedVariants: filenameResult.variants,
        confidence: filenameResult.confidence,
        reasoning: "AI detection failed, using filename detection",
      };
    }
  }

  return {
    mediaId: media.id,
    detectedVariants: filenameResult.variants,
    confidence: filenameResult.confidence,
    reasoning: filenameResult.variants.length > 0
      ? `Detected from alt text: ${filenameResult.variants.join(", ")}`
      : null,
  };
}

export async function detectVariantsForImages(
  media: ProductMedia[],
  variants: ProductVariant[],
  productContext: {
    title: string;
    type: string | null;
  },
  options: {
    concurrency?: number;
    useAI?: boolean;
    onProgress?: (current: number, total: number, mediaId: string) => void;
  } = {}
): Promise<{
  results: AIDetectionResult[];
  totalProcessed: number;
  totalMatched: number;
  processingTime: number;
}> {
  const startTime = Date.now();
  const { concurrency = 3, useAI = true, onProgress } = options;

  const variantOptions = extractVariantOptions(variants);
  const context: DetectionContext = {
    productTitle: productContext.title,
    productType: productContext.type,
    variantOptions,
  };

  logInfo("Starting variant detection", {
    mediaCount: media.length,
    variantCount: variants.length,
    optionGroups: variantOptions.length,
    useAI,
  });

  const results: AIDetectionResult[] = [];
  let totalMatched = 0;

  for (let i = 0; i < media.length; i += concurrency) {
    const batch = media.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(async (item, batchIndex) => {
        const result = await detectVariantsForImage(item, context, useAI);

        if (onProgress) {
          onProgress(i + batchIndex + 1, media.length, item.id);
        }

        return result;
      })
    );

    results.push(...batchResults);
    totalMatched += batchResults.filter((r) => r.detectedVariants.length > 0).length;
  }

  const processingTime = Date.now() - startTime;

  logInfo("Variant detection complete", {
    totalProcessed: results.length,
    totalMatched,
    processingTime,
  });

  return {
    results,
    totalProcessed: results.length,
    totalMatched,
    processingTime,
  };
}

export async function checkAIDetectionAvailable(): Promise<boolean> {
  // Check Ollama first
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`);
    if (response.ok) {
      const data = (await response.json()) as { models?: Array<{ name: string }> };
      if (data.models?.some((m) => m.name.includes("llava"))) {
        return true;
      }
    }
  } catch {
    // Ollama not available
  }

  // Fall back to Claude check
  return Boolean(config.anthropic.apiKey);
}
