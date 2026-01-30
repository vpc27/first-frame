# Product Gallery Pro – Hackathon Setup & Demo

Use this guide to run the app in a store and present a smooth demo. No native deps, no Node-version quirks.

---

## Prerequisites

- **Node.js** 20+ ([download](https://nodejs.org/en/download/))
- **Shopify Partner account** ([sign up](https://partners.shopify.com/signup))
- **Development store** ([create one](https://help.shopify.com/en/partners/dashboard/development-stores#create-a-development-store))
- **Shopify CLI** (optional; `shopify app dev` uses it under the hood):
  ```bash
  npm install -g @shopify/cli@latest
  ```

---

## Setup (three commands)

```bash
cd product-gallery-pro
npm install
npm run db:setup   # optional: seeds demo analytics data
npm run dev
```

- **`npm run dev`** starts the Remix app and the theme extension dev server.  
- Install the app in your dev store when prompted (or open the URL shown in the terminal).  
- Use the **.env** from the project root (or copy from `.env.example`). The CLI can fill in `SHOPIFY_*` when needed.

---

## What to expect

| Thing | Where |
|-------|--------|
| App (admin) | URL shown by `npm run dev` (e.g. tunnel + `/apps/...`) – open in browser or via “Test your app” in Partners. |
| Theme extension preview | `http://127.0.0.1:9293` when the theme server is running. |
| AI (Ollama) | Optional. Run `ollama serve` and pull `llava:7b` to use “Generate alt text” and “Score quality” in the app. |

---

## Demo script (live run)

Use this order when presenting:

1. **Dashboard** – Open the app, show Home: store summary, gallery/zoom/AI toggles, engagement snapshot.
2. **Settings** – Go to Settings, change layout (e.g. Grid) or zoom, save, refresh to show persistence.
3. **AI Insights** – Open AI insights, show product list; optionally click a product to open Product AI.
4. **Product AI** (if Ollama is on) – Pick an image, click “Generate alt text”, then “Apply to Shopify”; show success. Optionally run “Score quality”.
5. **Theme / storefront** – On the storefront, open a product page and show the gallery block (layout/zoom match Settings).

---

## Troubleshooting

| Issue | Fix |
|------|-----|
| **Port 9293 in use** | `lsof -i :9293` → `kill <PID>` (or `kill -9 <PID>`). |
| **GraphiQL port in use** | Run `npm run dev -- --graphiql-port 3458` (or another free port), or ignore the warning; a random port will be used. |
| **“Session” or Prisma errors** | Run `npm run setup` (Prisma generate + migrate). |
| **Gallery settings** | Stored in Shopify shop metafields (`product_gallery_pro.settings`). No DB needed for settings. |
| **Analytics / demo data** | Run `npm run db:setup` once so SQLite has shops + analytics_events. Dashboard also syncs a summary to `product_gallery_pro.analytics_summary`. |
| **“Ignoring ffi...” (Ruby gem)** | Optional: `gem pristine ffi --version 1.16.3`. Safe to ignore if the app runs. |

---

## One-line recap

```bash
npm install && npm run db:setup && npm run dev
```

Then install the app in your dev store and follow the [Demo script](#demo-script-live-run) above.
