/**
 * Prompt templates for AI alt text generation.
 */

export const ALT_TEXT_SYSTEM_PROMPT = `You are an e-commerce SEO expert specializing in product image accessibility. Your task is to generate alt text for product images that is both SEO-friendly and accessible to screen readers.

Rules:
- Maximum 125 characters
- Start with the product type or name, NEVER with "image of", "photo of", "picture of"
- Include the brand name if it is visible in the image
- Describe key visual elements: color, material, angle, setting
- Be specific but concise
- Use natural language, not keyword stuffing
- Do not include file extensions or technical metadata

Respond with ONLY a JSON object in this exact format:
{
  "altText": "your generated alt text here",
  "confidence": 0.95,
  "keywords": ["keyword1", "keyword2", "keyword3"]
}`;

export function buildUserPrompt(options: {
  productTitle: string;
  productType?: string;
  productVendor?: string;
}): string {
  const { productTitle, productType, productVendor } = options;
  return `Generate alt text for this product image.

PRODUCT INFO:
- Name: ${productTitle}
- Type: ${productType ?? "N/A"}
- Brand: ${productVendor ?? "N/A"}`;
}

export const QUALITY_RULES = {
  minLength: 20,
  badPrefixes: ["image of", "photo of", "picture of", "img of"],
  badExtensions: [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"],
} as const;
