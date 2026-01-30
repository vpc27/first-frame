/**
 * Ollama AI Client for Product Gallery Pro
 * Uses local LLaVA (vision) model via Ollama HTTP API.
 */

import { Buffer } from "node:buffer";
import { config } from "./config.server";
import { logAIRequest, logError } from "./logging.server";

const OLLAMA_HOST = config.ollama.host;
const OLLAMA_MODEL = config.ollama.model;

interface OllamaResponse {
  model: string;
  response: string;
  done: boolean;
}

export interface AIAnalysisResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function checkOllamaHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`);
    if (!response.ok) return false;

    const data = (await response.json()) as { models?: Array<{ name: string }> };
    const hasModel = data.models?.some((m) => m.name.includes("llava"));
    return Boolean(hasModel);
  } catch (error) {
    logError("Ollama health check failed", error);
    return false;
  }
}

async function queryOllamaWithImage(
  prompt: string,
  imageBase64: string,
): Promise<string> {
  const startedAt = Date.now();

  const response = await fetch(`${OLLAMA_HOST}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      prompt,
      images: [imageBase64],
      stream: false,
      options: {
        temperature: 0.3,
        top_p: 0.9,
        num_predict: 500,
      },
    }),
  });

  const elapsed = Date.now() - startedAt;
  logAIRequest("image_generate", { elapsedMs: elapsed });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Ollama request failed: ${errorText}`);
  }

  const data = (await response.json()) as OllamaResponse;
  return data.response;
}

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

// ALT TEXT

export async function generateAltText(options: {
  imageUrl: string;
  productTitle: string;
  productType?: string;
  productVendor?: string;
}): Promise<AIAnalysisResult<{
  altText: string;
  confidence: number;
  keywords: string[];
}>> {
  try {
    const { imageUrl, productTitle, productType, productVendor } = options;
    const imageBase64 = await imageUrlToBase64(imageUrl);

    const prompt = `You are an e-commerce SEO expert. Generate alt text for this product image.

PRODUCT INFO:
- Name: ${productTitle}
- Type: ${productType ?? "N/A"}
- Brand: ${productVendor ?? "N/A"}

REQUIREMENTS:
1. Maximum 125 characters
2. Start with product type or name (NOT "image of" or "photo of")
3. Include brand if visible
4. Describe key visual elements (color, angle, setting)
5. Be specific but concise

Respond with ONLY a JSON object in this exact format:
{
  "altText": "your generated alt text here",
  "confidence": 0.95,
  "keywords": ["keyword1", "keyword2", "keyword3"]
}`;

    const raw = await queryOllamaWithImage(prompt, imageBase64);
    const parsed = parseJsonResponse<{
      altText: string;
      confidence: number;
      keywords: string[];
    }>(raw);

    if (parsed.altText && parsed.altText.length > 125) {
      parsed.altText = `${parsed.altText.slice(0, 122)}...`;
    }

    return { success: true, data: parsed };
  } catch (error) {
    logError("Alt text generation failed", error);
    return { success: false, error: String(error) };
  }
}

// QUALITY SCORE

export async function scoreImageQuality(options: {
  imageUrl: string;
}): Promise<
  AIAnalysisResult<{
    overallScore: number;
    factors: Record<
      string,
      {
        score: number;
        issue: string | null;
      }
    >;
    topIssue: string | null;
    recommendation: string;
    isAcceptable: boolean;
  }>
> {
  try {
    const { imageUrl } = options;
    const imageBase64 = await imageUrlToBase64(imageUrl);

    const prompt = `You are a professional product photographer. Analyze this e-commerce product image for quality.

Score each factor from 1-10:
1. LIGHTING - Is it even with no harsh shadows? (10=perfect, 1=poor)
2. FOCUS - Is the product sharp and clear? (10=crystal clear, 1=blurry)
3. BACKGROUND - Is it clean and non-distracting? (10=perfect, 1=cluttered)
4. COMPOSITION - Is the product well-framed and centered? (10=perfect, 1=poor)
5. COLOR - Are colors accurate and well-balanced? (10=perfect, 1=off)
6. RESOLUTION - Is quality high enough for zoom? (10=excellent, 1=pixelated)

Calculate overall score as: (sum of all factors / 60) × 100

Respond with ONLY a JSON object like:
{
  "overallScore": 75,
  "factors": {
    "lighting": { "score": 7, "issue": "slight shadow on left" },
    "focus": { "score": 9, "issue": null },
    "background": { "score": 8, "issue": null },
    "composition": { "score": 7, "issue": "product slightly off-center" },
    "color": { "score": 8, "issue": null },
    "resolution": { "score": 9, "issue": null }
  },
  "topIssue": "slight shadow on left side",
  "recommendation": "Use a fill light or reflector on the left side"
}`;

    const raw = await queryOllamaWithImage(prompt, imageBase64);
    const parsed = parseJsonResponse<{
      overallScore: number;
      factors: Record<string, { score: number; issue: string | null }>;
      topIssue: string | null;
      recommendation: string;
    }>(raw);

    const withFlag = {
      ...parsed,
      isAcceptable: parsed.overallScore >= 60,
    };

    return { success: true, data: withFlag };
  } catch (error) {
    logError("Quality scoring failed", error);
    return { success: false, error: String(error) };
  }
}
