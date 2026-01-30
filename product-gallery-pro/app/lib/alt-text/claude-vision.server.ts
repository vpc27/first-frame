/**
 * Claude Vision API provider for alt text generation.
 */

import { config } from "../config.server";
import { logAIRequest, logError } from "../logging.server";
import type { AIAnalysisResult } from "../ollama.server";
import { ALT_TEXT_SYSTEM_PROMPT, buildUserPrompt } from "./prompts";

interface ClaudeMessage {
  role: "user" | "assistant";
  content: Array<
    | { type: "text"; text: string }
    | { type: "image"; source: { type: "url"; url: string } }
  >;
}

interface ClaudeResponse {
  content: Array<{ type: "text"; text: string }>;
  usage: { input_tokens: number; output_tokens: number };
}

export async function generateAltTextWithClaude(options: {
  imageUrl: string;
  productTitle: string;
  productType?: string;
  productVendor?: string;
}): Promise<
  AIAnalysisResult<{ altText: string; confidence: number; keywords: string[] }>
> {
  const apiKey = config.anthropic.apiKey;
  if (!apiKey) {
    return { success: false, error: "ANTHROPIC_API_KEY not configured" };
  }

  try {
    const { imageUrl, productTitle, productType, productVendor } = options;
    const startedAt = Date.now();

    const messages: ClaudeMessage[] = [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "url", url: imageUrl } },
          {
            type: "text",
            text: buildUserPrompt({ productTitle, productType, productVendor }),
          },
        ],
      },
    ];

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
        system: ALT_TEXT_SYSTEM_PROMPT,
        messages,
      }),
    });

    const elapsed = Date.now() - startedAt;
    logAIRequest("claude_alt_text", { elapsedMs: elapsed });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Claude API request failed (${response.status}): ${errorText}`);
    }

    const data = (await response.json()) as ClaudeResponse;
    const textContent = data.content.find((c) => c.type === "text");
    if (!textContent) {
      throw new Error("No text content in Claude response");
    }

    const jsonMatch = textContent.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in Claude response");
    }

    const parsed = JSON.parse(jsonMatch[0]) as {
      altText: string;
      confidence: number;
      keywords: string[];
    };

    if (parsed.altText && parsed.altText.length > 125) {
      parsed.altText = `${parsed.altText.slice(0, 122)}...`;
    }

    return { success: true, data: parsed };
  } catch (error) {
    logError("Claude alt text generation failed", error);
    return { success: false, error: String(error) };
  }
}
