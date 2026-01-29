import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
} from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import {
  getSettingsFromMetafields,
  updateSettingsInMetafields,
  dismissOnboarding,
} from "~/lib/settingsMetafields.server";
import { logError, logInfo } from "~/lib/logging.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin, session } = await authenticate.admin(request);
  const shopId = session.shop;

  try {
    if (!session.shop) {
      throw new Error("Missing shop in session");
    }
    const settings = await getSettingsFromMetafields(admin, shopId);
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
  const { admin, session } = await authenticate.admin(request);
  const shopId = session.shop;

  if (request.method !== "PUT" && request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  try {
    const contentType = request.headers.get("content-type") || "";
    let body: any;

    if (contentType.includes("application/json")) {
      body = (await request.json()) as any;
    } else {
      const form = await request.formData();
      const getValue = (name: string) => {
        const val = form.get(name) ?? form.get(`${name}[]`);
        return typeof val === 'string' ? val : null;
      };
      // For booleans, check if value is "true" (not just presence)
      const getBool = (name: string) => {
        const val = getValue(name);
        return val === "true" || val === "on";
      };

      body = {
        layout: getValue("layout") || "carousel",
        thumbnail_position: getValue("thumbnail_position") || "bottom",
        thumbnail_size: getValue("thumbnail_size") || "medium",
        enable_zoom: getBool("enable_zoom"),
        zoom_type: getValue("zoom_type") || "both",
        zoom_level: Number(getValue("zoom_level")) || 2.5,
        variant_filtering: getBool("variant_filtering"),
        lazy_loading: getBool("lazy_loading"),
        autoplay_video: getBool("autoplay_video"),
        enable_analytics: getBool("enable_analytics"),
        enable_ai: getBool("enable_ai"),
        image_fit: getValue("image_fit") || "auto",
      };
    }

    if (body.action === "dismiss_onboarding") {
      await dismissOnboarding(admin);
      return json({ success: true });
    }

    logInfo("api.settings parsed body", { shopId, body });

    logInfo("api.settings update", { shopId, received: body });
    await updateSettingsInMetafields(admin, shopId, body);
    const updated = await getSettingsFromMetafields(admin, shopId);
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

