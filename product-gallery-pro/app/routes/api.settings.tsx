import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { createShop, getSettings, updateSettings } from "~/lib/dbGallery.server";
import { logError, logInfo } from "~/lib/logging.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shopId = session.shop;

  try {
    // Ensure shop exists in our domain DB (needed for settings foreign key)
    if (!session.shop) {
      throw new Error("Missing shop in session");
    }
    const accessToken = (session as any).accessToken ?? "";
    const scope = ((session as any).scope ?? process.env.SCOPES ?? "").toString();
    if (accessToken) {
      createShop(shopId, accessToken, scope);
    } else {
      // Still create placeholder to satisfy FK constraints in hackathon/dev.
      createShop(shopId, "dev-access-token", scope || "write_products");
    }

    const settings = getSettings(shopId);
    return json({ success: true, data: settings });
  } catch (error) {
    logError("api.settings loader failed", error, { shopId });
    return json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch settings",
      },
      { status: 500 },
    );
  }
}

export async function action({ request }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shopId = session.shop;

  if (request.method !== "PUT" && request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    // Ensure shop exists in our domain DB (needed for settings foreign key)
    const accessToken = (session as any).accessToken ?? "";
    const scope = ((session as any).scope ?? process.env.SCOPES ?? "").toString();
    if (accessToken) {
      createShop(shopId, accessToken, scope);
    } else {
      createShop(shopId, "dev-access-token", scope || "write_products");
    }

    const contentType = request.headers.get("content-type") || "";
    let body: any;

    if (contentType.includes("application/json")) {
      body = (await request.json()) as any;
    } else {
      const form = await request.formData();
      const getValue = (name: string) =>
        form.get(name) ?? form.get(`${name}[]`);
      const getBool = (name: string) =>
        form.has(name) || form.has(`${name}[]`);

      body = {
        layout: getValue("layout"),
        thumbnail_position: getValue("thumbnail_position"),
        thumbnail_size: getValue("thumbnail_size"),
        enable_zoom: getBool("enable_zoom"),
        zoom_type: getValue("zoom_type"),
        zoom_level: Number(getValue("zoom_level") || 2.5),
        variant_filtering: getBool("variant_filtering"),
        lazy_loading: getBool("lazy_loading"),
        autoplay_video: getBool("autoplay_video"),
        enable_analytics: getBool("enable_analytics"),
        enable_ai: getBool("enable_ai"),
      };
    }

    logInfo("api.settings update", { shopId, received: body });
    updateSettings(shopId, body);
    const updated = getSettings(shopId);
    return json({ success: true, data: updated });
  } catch (error) {
    logError("api.settings action failed", error, { shopId });
    return json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to update settings",
      },
      { status: 500 },
    );
  }
}

