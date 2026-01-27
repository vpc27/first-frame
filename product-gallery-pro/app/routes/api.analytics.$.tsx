import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import {
  getAnalyticsOverview,
  getAnalyticsTimeseries,
} from "~/lib/dbGallery.server";
import { logError } from "~/lib/logging.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const shopId = session.shop;

  const url = new URL(request.url);
  const path = url.pathname.replace("/api/analytics/", "");

  try {
    switch (path) {
      case "overview": {
        const data = getAnalyticsOverview(shopId);
        return json({ success: true, data });
      }
      case "timeseries": {
        const daysParam = url.searchParams.get("days");
        const days = daysParam ? Number(daysParam) || 30 : 30;
        const data = getAnalyticsTimeseries(shopId, days);
        return json({ success: true, data });
      }
      default:
        return json({ success: false, error: "Not found" }, { status: 404 });
    }
  } catch (error) {
    logError("api.analytics loader failed", error, { shopId, path });
    return json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to load analytics",
      },
      { status: 500 },
    );
  }
}

