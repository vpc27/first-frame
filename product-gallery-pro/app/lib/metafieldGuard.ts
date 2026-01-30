const MAX_METAFIELD_BYTES = 1_500_000; // 1.5MB safety margin (Shopify limit: 2MB)

export function checkMetafieldSize(value: string): void {
  const bytes = new TextEncoder().encode(value).length;
  if (bytes > MAX_METAFIELD_BYTES) {
    throw new Error(
      `Metafield payload too large (${(bytes / 1_000_000).toFixed(2)}MB). Maximum allowed is 1.5MB. Please reduce the data size.`
    );
  }
}
