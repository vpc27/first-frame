# Product Gallery Pro – Test Cases

Use this checklist to verify core flows after changes or before release.

---

## Automated tests

Run:

```bash
npm test
```

Covers:

- **`app/lib/productId.server.test.ts`** – `toProductGid()` (numeric → GID, full GID passthrough, edge cases).
- **`tests/api.ai.test.ts`** – AI API loader/action:
  - `GET /api/ai/health` returns `available: true/false`.
  - `POST /api/ai/alt-text` validation and success response.
  - `POST /api/ai/quality-score` validation and success response.
  - Unknown paths return 404.

---

## Manual QA checklist

### 1. App shell and navigation

| # | Step | Expected |
|---|------|----------|
| 1.1 | Open app in Shopify admin | App loads; nav shows Home, Settings, AI insights, Additional page. |
| 1.2 | Click **Home** | Dashboard shows store ID, gallery/zoom/AI summary, engagement snapshot. |
| 1.3 | Click **Settings** | Settings page with layout, zoom, analytics toggles. |
| 1.4 | Click **AI insights** | AI insights page with Ollama status and product list. |

### 2. Settings

| # | Step | Expected |
|---|------|----------|
| 2.1 | Change layout to **Grid**, click **Save changes** | “Saving…” then “Save changes” again; no error. |
| 2.2 | Reload the page | Layout still **Grid**. |
| 2.3 | Change **Enable zoom** and **Save**; reload | Zoom setting persists. |
| 2.4 | Enable **Enable analytics** / **Enable AI**, save, reload | Both toggles persist. |

### 3. AI insights page

| # | Step | Expected |
|---|------|----------|
| 3.1 | Open **AI insights** with Ollama running (`ollama serve`, `llava:7b` present) | Badge: **Ollama reachable** (or similar). |
| 3.2 | Open **AI insights** with Ollama stopped | Badge: **Ollama offline** (or similar). |
| 3.3 | Confirm products are listed | Each row shows title and links to a product. |
| 3.4 | Click a product row | Navigate to **Product AI** for that product. |

### 4. Product AI page (alt text & quality)

| # | Step | Expected |
|---|------|----------|
| 4.1 | From AI insights, open a product that has images | Product title, type/vendor, and list of image cards. |
| 4.2 | Click **Generate alt text** on one image | Button shows “Analyzing…” then suggested alt and confidence appear. |
| 4.3 | Click **Score quality** on one image | Button shows “Scoring…” then overall score and recommendation appear. |
| 4.4 | After alt is suggested, click **Apply to Shopify** | Success banner; no error. |
| 4.5 | In Shopify admin, open the same product and check that image’s alt | Alt text matches the applied suggestion. |
| 4.6 | On product with no images | Message like “No images on this product” (or similar). |

### 5. API and backend

| # | Step | Expected |
|---|------|----------|
| 5.1 | `GET /api/ai/health` (e.g. `curl` or browser) | `{ "success": true, "data": { "available": true/false } }`. |
| 5.2 | `POST /api/ai/alt-text` with `{ "imageUrl", "productTitle" }` | JSON with `success` and `data.altText` when Ollama is up. |
| 5.3 | `POST /api/ai/quality-score` with `{ "imageUrl" }` | JSON with `success` and `data.overallScore` when Ollama is up. |
| 5.4 | `POST /api/ai/alt-text` with missing `imageUrl` or `productTitle` | 400 and error message. |

### 6. Theme / storefront (if extension is installed)

| # | Step | Expected |
|---|------|----------|
| 6.1 | Add Product Gallery Pro block to product template, save | Block appears and renders on product page. |
| 6.2 | View product page on storefront | Gallery shows product media; layout matches Settings (e.g. grid/carousel). |
| 6.3 | With analytics enabled, interact (e.g. zoom, thumbnails) | No console errors; events sent if app proxy/backend is configured. |

### 7. Edge cases and errors

| # | Step | Expected |
|---|------|----------|
| 7.1 | Open **/app/products/999999999** (non‑existent id) | “Product not found” or similar; no crash. |
| 7.2 | Use **Apply to Shopify** when Ollama/API failed and no suggestion exists | Button either disabled or action does not overwrite with bad data. |
| 7.3 | Run **Generate alt text** with Ollama down | Error message in UI (e.g. banner or inline), no unhandled exception. |

---

## Running tests locally

- **Unit / API tests:**  
  `npm test` (or `npm run test:watch` for watch mode).
- **Ollama for AI flows:**  
  `ollama serve` and `ollama pull llava:7b` (or your configured model).
- **DB for settings/analytics:**  
  `npm run db:setup` if you use the seed script.

---

## Notes

- “Apply to Shopify” uses the Admin API (`productUpdateMedia`); the app needs **write_products**.
- AI endpoints require Ollama (and the correct model) for successful alt/quality results.
- App proxy and tunnel (e.g. ngrok) are needed for storefront analytics to hit your backend.
