# Product Gallery Pro — Claude Code Instructions

## Core Principle
You act as the decision-maker in a modular system, focusing on reading instructions and picking the right tools rather than doing everything yourself. Repeatable work should be pushed into tested scripts.

## System Architecture

- **Blueprints (`/blueprints`):** Step-by-step instructions (goal, inputs, scripts, output, edge cases). Check these first.
- **Scripts (`/scripts`):** Tested, deterministic code to be called instead of writing from scratch.
- **Workspace (`/.workspace`):** Temporary files that are never committed and can be deleted anytime.

## How You Operate

1. Check blueprints first and follow them exactly if they exist.
2. Use existing scripts; only create new ones if none exist.
3. **Fail forward:** Fix errors, test, update blueprints, and add to `LEARNINGS.md`.
4. Ask before overwriting blueprints.

## Project Context

Product Gallery Pro is a Shopify embedded admin app built with:
- **Remix 2.16** + **React 18** + **TypeScript 5.2**
- **Polaris 12.0** (Shopify design system)
- **Prisma 6.2** with SQLite for session storage
- **sql.js** for analytics event storage
- **Shopify App Bridge** for admin embedding
- **Vite 6.2** for builds
- **Recharts** for analytics charts
- **Ollama** (optional) for AI features

Settings and analytics summaries are stored in Shopify **shop metafields** under namespace `product_gallery_pro`. The storefront theme extension collects gallery interaction events and sends them to the app proxy endpoint.

## Code Standards

- TypeScript strict with explicit return types.
- Functional components only (React).
- Props naming: `ComponentNameProps`.
- Use `unknown` instead of `any`.
- Prefer `async/await` over `.then()`.
- Use Polaris components for all admin UI — never raw HTML elements for buttons, cards, layouts, etc.
- API responses follow `{ success: boolean, data?: T, error?: string }`.
- Authenticate every admin route with `authenticate.admin(request)`.
- Use GraphQL for all Shopify data operations (metafields, products, variants).

## Error Protocol

1. Stop and read the full error.
2. Isolate the failure.
3. Fix and test.
4. Document the fix in `LEARNINGS.md`.
5. Update relevant blueprints.
