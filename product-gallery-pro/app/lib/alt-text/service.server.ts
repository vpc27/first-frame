/**
 * Unified alt text service.
 * Ollama primary, Claude fallback.
 */

import { config } from "../config.server";
import { generateAltText as generateAltTextOllama, checkOllamaHealth } from "../ollama.server";
import type { AIAnalysisResult } from "../ollama.server";
import { generateAltTextWithClaude } from "./claude-vision.server";
import { QUALITY_RULES } from "./prompts";
import { logInfo, logError } from "../logging.server";

type AltTextResult = AIAnalysisResult<{
  altText: string;
  confidence: number;
  keywords: string[];
}>;

export type AltTextQuality = "missing" | "poor" | "good";

interface GenerateOptions {
  imageUrl: string;
  productTitle: string;
  productType?: string;
  productVendor?: string;
}

/**
 * Generate alt text. Tries Ollama first, falls back to Claude.
 */
export async function generateAltText(
  options: GenerateOptions,
): Promise<AltTextResult> {
  // Try Ollama first
  const ollamaAvailable = await checkOllamaHealth();
  if (ollamaAvailable) {
    logInfo("alt-text: using Ollama provider");
    const result = await generateAltTextOllama(options);
    if (result.success) return result;
    logError("alt-text: Ollama failed, trying Claude fallback", result.error);
  }

  // Fall back to Claude
  if (config.anthropic.apiKey) {
    logInfo("alt-text: using Claude fallback");
    return generateAltTextWithClaude(options);
  }

  return {
    success: false,
    error: ollamaAvailable
      ? "Ollama generation failed and no Claude API key configured"
      : "Ollama is offline and no Claude API key configured. Start Ollama with: ollama serve",
  };
}

/**
 * Generate alt text for multiple images with concurrency limit.
 */
export async function generateBulkAltText(
  images: Array<{ mediaId: string; imageUrl: string }>,
  productContext: {
    productTitle: string;
    productType?: string;
    productVendor?: string;
  },
): Promise<
  Array<{
    mediaId: string;
    result: AltTextResult;
  }>
> {
  const CONCURRENCY = 3;
  const results: Array<{ mediaId: string; result: AltTextResult }> = [];
  const queue = [...images];

  async function processNext(): Promise<void> {
    while (queue.length > 0) {
      const item = queue.shift()!;
      const result = await generateAltText({
        imageUrl: item.imageUrl,
        ...productContext,
      });
      results.push({ mediaId: item.mediaId, result });
    }
  }

  const workers = Array.from({ length: Math.min(CONCURRENCY, queue.length) }, () =>
    processNext(),
  );
  await Promise.all(workers);

  return results;
}

/**
 * Assess alt text quality using pure heuristics (no AI call).
 */
export function assessAltTextQuality(
  altText: string | null | undefined,
  productTitle?: string,
): AltTextQuality {
  if (!altText || altText.trim() === "") return "missing";

  const text = altText.trim().toLowerCase();

  if (text.length < QUALITY_RULES.minLength) return "poor";

  for (const prefix of QUALITY_RULES.badPrefixes) {
    if (text.startsWith(prefix)) return "poor";
  }

  for (const ext of QUALITY_RULES.badExtensions) {
    if (text.includes(ext)) return "poor";
  }

  if (
    productTitle &&
    text === productTitle.trim().toLowerCase()
  ) {
    return "poor";
  }

  return "good";
}
