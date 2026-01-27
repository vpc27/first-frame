// scripts/seed-demo-data.js
// Populate demo analytics data for Product Gallery Pro (ESM-compatible)

/* eslint-disable @typescript-eslint/no-var-requires */
import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, "..", "database", "gallery.db");

// Ensure database directory exists
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

// Ensure schema is applied
const schemaPath = path.resolve(__dirname, "..", "database", "schema.sql");
const schemaSql = fs.readFileSync(schemaPath, "utf8");
db.exec(schemaSql);

// Ensure demo shop exists (required for FOREIGN KEY constraints)
const demoShopId = "demo-store.myshopify.com";
db.prepare(
  `
  INSERT INTO shops (id, access_token, scope, installed_at, created_at, updated_at)
  VALUES (?, ?, ?, datetime('now'), datetime('now'), datetime('now'))
  ON CONFLICT(id) DO UPDATE SET
    scope = excluded.scope,
    updated_at = datetime('now')
`,
).run(demoShopId, "demo-access-token", "write_products");

// Ensure settings row exists for demo shop (optional but useful)
db.prepare(
  `
  INSERT INTO settings (shop_id)
  VALUES (?)
  ON CONFLICT(shop_id) DO NOTHING
`,
).run(demoShopId);

// Seed analytics events for demo
const events = [];
const now = new Date();

// Generate 30 days of fake data
for (let day = 0; day < 30; day++) {
  const date = new Date(now);
  date.setDate(date.getDate() - day);

  // Random events per day
  const viewCount = Math.floor(Math.random() * 500) + 200;

  for (let i = 0; i < viewCount; i++) {
    const baseEvent = {
      shop_id: demoShopId,
      product_id: ["prod_1", "prod_2", "prod_3"][Math.floor(Math.random() * 3)],
      session_id: `ses_${Math.random().toString(36).slice(2, 11)}`,
      device_type: ["mobile", "desktop", "tablet"][Math.floor(Math.random() * 3)],
      created_at: date.toISOString(),
    };

    events.push({
      ...baseEvent,
      event_type: "gallery_view",
      image_id: null,
    });

    // 30% chance of zoom
    if (Math.random() < 0.3) {
      events.push({
        ...baseEvent,
        image_id: `img_${Math.floor(Math.random() * 5) + 1}`,
        event_type: Math.random() < 0.5 ? "zoom_click" : "zoom_hover",
      });
    }
  }
}

// Insert events
const insert = db.prepare(`
  INSERT INTO analytics_events (shop_id, product_id, image_id, event_type, event_data, session_id, device_type, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertMany = db.transaction((rows) => {
  for (const event of rows) {
    insert.run(
      event.shop_id,
      event.product_id,
      event.image_id || null,
      event.event_type,
      JSON.stringify({}),
      event.session_id,
      event.device_type,
      event.created_at,
    );
  }
});

insertMany(events);

console.log(`✅ Seeded ${events.length} demo analytics events into ${dbPath}`);

