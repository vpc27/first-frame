import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import {
  readAnalyticsSummary,
  getOverviewFromSummary,
  getTimeseriesFromSummary,
} from "~/lib/analyticsMetafields.server";

export async function loader({ request }: LoaderFunctionArgs) {
  const { admin } = await authenticate.admin(request);

  const url = new URL(request.url);
  const path = url.pathname.replace("/api/analytics/", "");

  try {
    const { summary } = await readAnalyticsSummary(admin);

    switch (path) {
      case "overview": {
        const data = getOverviewFromSummary(summary);
        return json({ success: true, data });
      }
      case "timeseries": {
        const daysParam = url.searchParams.get("days");
        const days = daysParam ? Number(daysParam) || 30 : 30;
        const data = getTimeseriesFromSummary(summary, days);
        return json({ success: true, data });
      }
      default:
        return json({ success: false, error: "Not found" }, { status: 404 });
    }
  } catch (error) {
    console.error("[api.analytics] Error:", error);
    return json(
      {
        success: false,
        error: "Failed to load analytics",
      },
      { status: 500 },
    );
  }
}
