/**
 * Product ID normalization for Shopify GIDs.
 * Used by product routes to accept either numeric id or full gid.
 */

export function toProductGid(id: string): string {
  if (!id || typeof id !== "string") return id;
  const trimmed = id.trim();
  if (trimmed.startsWith("gid://")) return trimmed;
  const num = trimmed.replace(/\D/g, "");
  return num ? `gid://shopify/Product/${num}` : trimmed;
}
