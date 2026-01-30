# Shopify Data & Database Standards

## Session Storage (Prisma + SQLite)
- Prisma manages OAuth session storage via `@shopify/shopify-app-session-storage-prisma`.
- Schema defined in `prisma/schema.prisma`.
- Never modify session records directly — use the Shopify session adapter.

## Analytics Storage (sql.js + SQLite)
- Analytics events stored in `database/gallery.db` using sql.js (pure JS, no native modules).
- Schema defined in `database/schema.sql`.
- Events: views, zooms, video plays, swipes, variant selections.

## Shopify Metafields
- Namespace: `product_gallery_pro`.
- Used for: shop settings, analytics summaries, per-product configuration.
- Always read/write via GraphQL (`shopifyGraphql.server.ts`).
- Never expose the Shopify Admin API access token to the client.

## Authentication
- Every admin route must call `authenticate.admin(request)` to get an authenticated GraphQL client.
- Storefront/proxy routes use app proxy authentication.
- Never hardcode API keys — use environment variables.
