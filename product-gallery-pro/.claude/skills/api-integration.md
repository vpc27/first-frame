# API Integration Standards

## Shopify GraphQL
- Use the authenticated `admin.graphql()` client from `authenticate.admin(request)`.
- All queries should be typed via GraphQL CodeGen where possible.
- Handle GraphQL `userErrors` in mutation responses.

## Error Handling
- Use `try/catch` blocks in all route loaders and actions.
- Return structured JSON: `{ success: false, error: "message" }` on failure.
- Throw errors if `response.ok` is false for external HTTP calls.

## Retry with Backoff
- For external API calls (Ollama, etc.), implement exponential backoff:
  ```ts
  async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
    for (let i = 0; i < retries; i++) {
      try {
        const res = await fetch(url, options);
        if (res.ok) return res;
      } catch (e) {
        if (i === retries - 1) throw e;
      }
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
    throw new Error(`Failed after ${retries} retries`);
  }
  ```

## Rate Limiting
- Track requests per minute for external APIs.
- Respect `Retry-After` headers.
- Shopify GraphQL has a cost-based throttle — check `extensions.cost` in responses.

## CORS
- Storefront-facing API routes must include appropriate CORS headers.
- Admin routes do not need CORS (embedded in Shopify Admin iframe).
