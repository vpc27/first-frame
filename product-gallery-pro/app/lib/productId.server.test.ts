import { describe, it, expect } from "vitest";
import { toProductGid } from "./productId.server";

describe("toProductGid", () => {
  it("returns full GID unchanged when input already is a GID", () => {
    const gid = "gid://shopify/Product/123";
    expect(toProductGid(gid)).toBe(gid);
  });

  it("converts numeric string to GID", () => {
    expect(toProductGid("123")).toBe("gid://shopify/Product/123");
    expect(toProductGid("52818131026283")).toBe(
      "gid://shopify/Product/52818131026283",
    );
  });

  it("strips non-digits and converts remainder to GID", () => {
    expect(toProductGid("Product/123")).toBe("gid://shopify/Product/123");
    expect(toProductGid("123abc")).toBe("gid://shopify/Product/123");
  });

  it("returns empty string as-is", () => {
    expect(toProductGid("")).toBe("");
  });

  it("returns trimmed input when it looks like GID", () => {
    expect(toProductGid("  gid://shopify/Product/456  ")).toBe(
      "gid://shopify/Product/456",
    );
  });

  it("returns trimmed input when no digits present", () => {
    expect(toProductGid("abc")).toBe("abc");
  });
});
