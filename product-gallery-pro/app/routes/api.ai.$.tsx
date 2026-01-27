import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import {
  checkOllamaHealth,
  generateAltText,
  scoreImageQuality,
} from "~/lib/ollama.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const path = url.pathname.replace("/api/ai/", "");

  if (path === "health") {
    const isHealthy = await checkOllamaHealth();
    return json({
      success: true,
      data: {
        available: isHealthy,
      },
    });
  }

  return json({ error: "Not found" }, { status: 404 });
}

export async function action({ request }: ActionFunctionArgs) {
  const url = new URL(request.url);
  const path = url.pathname.replace("/api/ai/", "");

  try {
    const body = (await request.json()) as any;

    switch (path) {
      case "alt-text": {
        const { imageUrl, productTitle, productType, productVendor } = body;
        if (!imageUrl || !productTitle) {
          return json(
            {
              success: false,
              error: "Missing required fields: imageUrl, productTitle",
            },
            { status: 400 },
          );
        }
        const result = await generateAltText({
          imageUrl,
          productTitle,
          productType,
          productVendor,
        });
        return json(result);
      }
      case "quality-score": {
        const { imageUrl } = body;
        if (!imageUrl) {
          return json(
            {
              success: false,
              error: "Missing required field: imageUrl",
            },
            { status: 400 },
          );
        }
        const result = await scoreImageQuality({ imageUrl });
        return json(result);
      }
      default:
        return json({ error: "Unknown AI endpoint" }, { status: 404 });
    }
  } catch (error) {
    return json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "AI processing failed",
      },
      { status: 500 },
    );
  }
}

