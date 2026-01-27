import type { ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { unauthenticated } from "../shopify.server";
import { db } from "~/lib/dbGallery.server";
import { logAnalyticsIngest, logError } from "~/lib/logging.server";

export async function action({ request }: ActionFunctionArgs) {
  try {
    const { session } = await unauthenticated.appProxy(request);
    const shopId = session?.shop;

    if (!shopId) {
      return json({ success: false, error: "Missing shop" }, { status: 400 });
    }

    const body = await request.json().catch(() => null);
    if (!body) {
      return json(
        { success: false, error: "Invalid JSON payload" },
        { status: 400 },
      );
    }

    const events = Array.isArray(body) ? body : [body];

    const insert = db.prepare(
      `
      INSERT INTO analytics_events
        (shop_id, product_id, image_id, event_type, event_data, session_id, device_type, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `,
    );

    const runInsert = db.transaction((rows: any[]) => {
      for (const event of rows) {
        insert.run(
          shopId,
          event.product_id || null,
          event.image_id || null,
          event.event_type,
          JSON.stringify(event.event_data || {}),
          event.session_id || null,
          event.device_type || null,
        );
      }
    });

    runInsert(events);
    logAnalyticsIngest(events.length, { shopId });

    return json({ success: true });
  } catch (error) {
    logError("proxy analytics ingest failed", error);
    return json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to ingest analytics",
      },
      { status: 500 },
    );
  }
}

