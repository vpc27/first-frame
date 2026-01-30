/**
 * SQLite database client for Product Gallery Pro domain data
 * (separate from Prisma session storage).
 */

import path from "path";
import fs from "fs";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";
import type { AnalyticsEvent, Settings } from "~/types";
import { config } from "./config.server";

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = config.database.url.replace("file:", "");
const resolvedDbPath = path.resolve(dbPath);

fs.mkdirSync(path.dirname(resolvedDbPath), { recursive: true });

const db = new Database(resolvedDbPath);

// Ensure schema exists
const schemaPath = path.resolve(__dirname, "..", "..", "database", "schema.sql");
const schemaSql = fs.readFileSync(schemaPath, "utf8");
db.exec(schemaSql);

db.pragma("journal_mode = WAL");

export function getShop(shopId: string) {
  return db.prepare("SELECT * FROM shops WHERE id = ?").get(shopId);
}

export function createShop(shopId: string, accessToken: string, scope: string) {
  return db
    .prepare(
      `
    INSERT INTO shops (id, access_token, scope) 
    VALUES (?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET 
      access_token = excluded.access_token,
      scope = excluded.scope,
      updated_at = datetime('now')
  `,
    )
    .run(shopId, accessToken, scope);
}

export function deleteShop(shopId: string) {
  return db.prepare("DELETE FROM shops WHERE id = ?").run(shopId);
}

function ensureShopExists(shopId: string) {
  const existing = getShop(shopId);
  if (existing) return;

  // In dev/hackathon, create a placeholder shop row so FK constraints don't block settings writes.
  // The "real" token/scope can be upserted later by routes that have session access.
  createShop(
    shopId,
    "dev-access-token",
    (process.env.SCOPES ?? "write_products").toString(),
  );
}

export function getSettings(shopId: string): Settings {
  ensureShopExists(shopId);

  const row = db
    .prepare("SELECT * FROM settings WHERE shop_id = ?")
    .get(shopId) as any | undefined;

  if (!row) {
    return {
      shop_id: shopId,
      layout: "carousel",
      thumbnail_position: "bottom",
      thumbnail_size: "medium",
      enable_zoom: true,
      zoom_type: "both",
      zoom_level: 2.5,
      variant_filtering: true,
      lazy_loading: true,
      autoplay_video: false,
      enable_analytics: true,
      enable_ai: true,
      image_fit: "auto",
    };
  }

  // Defensive defaults in case DB contains nulls from prior buggy writes.
  return {
    ...row,
    layout: (row.layout ?? "carousel") as Settings["layout"],
    thumbnail_position: (row.thumbnail_position ?? "bottom") as Settings["thumbnail_position"],
    thumbnail_size: (row.thumbnail_size ?? "medium") as Settings["thumbnail_size"],
    zoom_type: (row.zoom_type ?? "both") as Settings["zoom_type"],
    zoom_level: Number(row.zoom_level ?? 2.5),
    enable_zoom: Boolean(row.enable_zoom),
    variant_filtering: Boolean(row.variant_filtering),
    lazy_loading: Boolean(row.lazy_loading),
    autoplay_video: Boolean(row.autoplay_video),
    enable_analytics: Boolean(row.enable_analytics),
    enable_ai: Boolean(row.enable_ai),
    image_fit: (row.image_fit ?? "auto") as Settings["image_fit"],
  } as Settings;
}

export function updateSettings(shopId: string, settings: Partial<Settings>) {
  ensureShopExists(shopId);

  const existing = getSettings(shopId);
  // Prevent null/undefined from overwriting stored values.
  const sanitized = Object.fromEntries(
    Object.entries(settings).filter(([, v]) => v !== null && v !== undefined),
  ) as Partial<Settings>;
  const merged: Settings = { ...existing, ...sanitized, shop_id: shopId };

  return db
    .prepare(
      `
    INSERT INTO settings (
      shop_id, layout, thumbnail_position, thumbnail_size,
      enable_zoom, zoom_type, zoom_level,
      variant_filtering, lazy_loading, autoplay_video,
      enable_analytics, enable_ai
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(shop_id) DO UPDATE SET
      layout = excluded.layout,
      thumbnail_position = excluded.thumbnail_position,
      thumbnail_size = excluded.thumbnail_size,
      enable_zoom = excluded.enable_zoom,
      zoom_type = excluded.zoom_type,
      zoom_level = excluded.zoom_level,
      variant_filtering = excluded.variant_filtering,
      lazy_loading = excluded.lazy_loading,
      autoplay_video = excluded.autoplay_video,
      enable_analytics = excluded.enable_analytics,
      enable_ai = excluded.enable_ai,
      updated_at = datetime('now')
  `,
    )
    .run(
      shopId,
      merged.layout,
      merged.thumbnail_position,
      merged.thumbnail_size,
      merged.enable_zoom ? 1 : 0,
      merged.zoom_type,
      merged.zoom_level,
      merged.variant_filtering ? 1 : 0,
      merged.lazy_loading ? 1 : 0,
      merged.autoplay_video ? 1 : 0,
      merged.enable_analytics ? 1 : 0,
      merged.enable_ai ? 1 : 0,
    );
}

// ANALYTICS HELPERS

type AnalyticsOverview = {
  totalViews: number;
  zoomEvents: number;
  thumbnailClicks: number;
};

type AnalyticsTimeseriesPoint = {
  date: string;
  views: number;
};

export function getAnalyticsOverview(shopId: string): AnalyticsOverview {
  const row = db
    .prepare(
      `
      SELECT
        SUM(CASE WHEN event_type = 'gallery_view' THEN 1 ELSE 0 END) AS totalViews,
        SUM(CASE WHEN event_type IN ('zoom_hover', 'zoom_click') THEN 1 ELSE 0 END) AS zoomEvents,
        SUM(CASE WHEN event_type = 'thumbnail_click' THEN 1 ELSE 0 END) AS thumbnailClicks
      FROM analytics_events
      WHERE shop_id = ?
    `,
    )
    .get(shopId) as {
    totalViews: number | null;
    zoomEvents: number | null;
    thumbnailClicks: number | null;
  } | null;

  return {
    totalViews: row?.totalViews ?? 0,
    zoomEvents: row?.zoomEvents ?? 0,
    thumbnailClicks: row?.thumbnailClicks ?? 0,
  };
}

export function getAnalyticsTimeseries(
  shopId: string,
  days = 30,
): AnalyticsTimeseriesPoint[] {
  const rows = db
    .prepare(
      `
      SELECT
        date(created_at) as date,
        COUNT(*) as views
      FROM analytics_events
      WHERE shop_id = ?
        AND event_type = 'gallery_view'
        AND created_at >= datetime('now', ?)
      GROUP BY date
      ORDER BY date ASC
    `,
    )
    .all(shopId, `-${days} days`) as Array<{ date: string; views: number }>;

  return rows;
}

export { db };

