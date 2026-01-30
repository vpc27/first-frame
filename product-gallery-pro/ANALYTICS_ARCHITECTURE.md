# Analytics Architecture — Product Gallery Pro

## Overview

Product Gallery Pro tracks how shoppers interact with product image galleries on the storefront. Analytics data flows through three layers: **client-side collection**, **server-side ingestion**, and **Shopify metafield storage** — requiring zero external infrastructure.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│  STOREFRONT (Buyer's Browser)                           │
│                                                         │
│  analytics.js                                           │
│  ├─ Listens for gallery interactions                    │
│  ├─ Aggregates events in-memory per session             │
│  └─ Sends one summary POST on page unload              │
└──────────────────────┬──────────────────────────────────┘
                       │ POST /apps/product-gallery-pro/analytics
                       ▼
┌─────────────────────────────────────────────────────────┐
│  BACKEND (Remix API Route)                              │
│                                                         │
│  api.analytics.$.tsx                                    │
│  ├─ Validates & parses the session summary              │
│  ├─ Merges into shop-level aggregate (metafield)        │
│  └─ Merges per-product image metrics (metafield)        │
└──────────────────────┬──────────────────────────────────┘
                       │ GraphQL metafield mutations
                       ▼
┌─────────────────────────────────────────────────────────┐
│  STORAGE (Shopify Metafields)                           │
│                                                         │
│  product_gallery_pro.analytics_summary  (shop-level)    │
│  product_gallery_pro.image_analytics    (per-product)   │
└──────────────────────┬──────────────────────────────────┘
                       │ GraphQL metafield queries
                       ▼
┌─────────────────────────────────────────────────────────┐
│  ADMIN DASHBOARD (app._index.tsx)                       │
│                                                         │
│  Displays: views, engagement rate, zoom events,         │
│  video plays, 30-day trend chart, top products,         │
│  device breakdown, per-image heatmaps                   │
└─────────────────────────────────────────────────────────┘
```

---

## Layer 1: Client-Side Collection

**File:** `extensions/product-gallery/assets/analytics.js`

The script loads on every product page where the gallery block is rendered, gated by the `enable_analytics` shop setting (read via Liquid from a public metafield).

### What we track

| Event | Trigger |
|---|---|
| `gallery_view` | Page visible for 800ms (filters bounces) |
| `zoom_click` | Click on product image |
| `zoom_hover` | Hover over image for 1+ second |
| `thumbnail_click` | Click on a thumbnail |
| `video_play` | Play a gallery video |
| `slide_change` | Swipe or arrow navigation |

### Session-level metrics

- **Unique images viewed** — distinct media IDs seen
- **Max slide index** — deepest gallery position reached
- **Active time** — cumulative interaction time (5s idle gap threshold, 30s per-image cap)
- **Per-image breakdown** — viewed, zoomed, and active time per media ID
- **Device type** — mobile / tablet / desktop (from viewport width)

### Transmission

All events are aggregated in-memory and sent as **one JSON summary per page visit**, triggered on `visibilitychange`, `pagehide`, or 5-minute inactivity. Uses `fetch` with `keepalive: true` and falls back to `navigator.sendBeacon`.

---

## Layer 2: Server-Side Ingestion

**File:** `app/routes/api.analytics.$.tsx`

This is a Shopify app proxy endpoint (public, no admin session required). It accepts the session summary via POST, identifies the shop from the request, and delegates to the storage layer.

**Request flow:**
1. Parse JSON body → validate required fields (`counts`, `shop`)
2. Call `mergeAndSaveSession()` — incremental merge into shop-level summary
3. Call `mergeAndSaveImageMetrics()` — per-product image-level merge
4. Return `{ success: true }`

CORS headers are set to allow cross-origin requests from any storefront domain.

---

## Layer 3: Storage

**File:** `app/lib/analyticsMetafields.server.ts`

All analytics are stored in **Shopify metafields** via GraphQL — no custom database, no external service.

### Shop-level metafield: `product_gallery_pro.analytics_summary`

Stores the aggregate across all sessions:

- **Totals:** views, zoom events, thumbnail clicks, video plays, slide changes, sessions
- **Daily views:** keyed by date string, pruned to 90 days
- **Device breakdown:** `{ mobile, desktop, tablet }` counts
- **Top products:** top 50 products by views, each with full interaction counts
- **Session averages source data:** total unique images viewed, total active time, total max slide index, sessions with interaction

### Product-level metafield: `product_gallery_pro.image_analytics`

Per-product, stores per-image metrics:

- Sessions where image was viewed
- Sessions where image was zoomed
- Total active time on the image

### Merge strategy

Each incoming session is **incrementally merged** — read current metafield, add new counts, prune stale data, write back. This avoids full recomputation and keeps writes small.

---

## Layer 4: Admin Dashboard

**File:** `app/routes/app._index.tsx`

The dashboard reads the shop-level metafield once in the Remix loader and derives all display metrics server-side:

| Metric | Derivation |
|---|---|
| Gallery Views | `totalViews` (raw count) |
| Engagement Rate | `sessionsWithInteraction / totalSessions × 100` |
| Zoom Interactions | `zoomEvents` (raw count) |
| Video Plays | `videoPlays` (raw count) |
| Avg Images / Session | `totalUniqueImagesViewed / totalSessions` |
| Avg Time in Gallery | `totalActiveTimeMs / totalSessions / 1000` (seconds) |
| Avg Swipe Depth | `totalMaxSlideIndex / totalSessions` |

The dashboard also renders:
- **30-day trend chart** (Recharts AreaChart from `dailyViews`)
- **Top products table** with per-product engagement stats
- **Device breakdown** (mobile / tablet / desktop)

A separate endpoint (`app.api.product-image-analytics.tsx`) serves per-image heatmap data for individual product drill-downs.

---

## Settings Integration

The `enable_analytics` boolean lives in the shop settings metafield (`product_gallery_pro.settings`, visibility `PUBLIC_READ`). When toggled off in the admin settings page, the Liquid template stops injecting `analytics.js` on the storefront — no data is collected.

---

## Key Design Decisions

1. **Session-level aggregation on the client** — one network request per page visit instead of per-event streaming. Reduces load on the backend and simplifies ingestion.

2. **Shopify metafields as the storage backend** — zero infrastructure to provision or maintain. Scales with the Shopify plan. Trade-off: metafield size limits (~512KB) require pruning (90-day daily views, top 50 products).

3. **Incremental merge** — each session is merged additively into the existing summary. No batch jobs or scheduled recalculation needed.

4. **800ms view threshold** — gallery views are only counted after 800ms of page visibility to filter out bounces and accidental navigations.

5. **Public app proxy endpoint** — the ingestion endpoint runs through Shopify's app proxy (no admin auth), making it accessible from any storefront page without exposing admin credentials.

---

## File Reference

| File | Role |
|---|---|
| `extensions/product-gallery/assets/analytics.js` | Client-side event collection & aggregation |
| `extensions/product-gallery/blocks/gallery.liquid` | Conditional script loading |
| `app/routes/api.analytics.$.tsx` | Ingestion endpoint + dashboard read APIs |
| `app/lib/analyticsMetafields.server.ts` | Metafield read/merge/write logic |
| `app/routes/app._index.tsx` | Admin analytics dashboard |
| `app/routes/app.api.product-image-analytics.tsx` | Per-product image metrics API |
| `app/routes/app.settings.tsx` | Analytics enable/disable toggle |
| `app/lib/settingsMetafields.server.ts` | Settings metafield persistence |
