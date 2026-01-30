import { useState, useRef, useCallback } from "react";
import { useFetcher } from "@remix-run/react";
import {
  Select,
  TextField,
  Text,
  BlockStack,
  InlineStack,
  Thumbnail,
  Icon,
} from "@shopify/polaris";
import { SearchIcon, XCircleIcon } from "@shopify/polaris-icons";
import type { ProductScope, ProductScopeItem } from "~/types/rules";

interface ProductScopePickerProps {
  productScope: ProductScope | undefined;
  onChange: (scope: ProductScope | undefined) => void;
}

export function ProductScopePicker({ productScope, onChange }: ProductScopePickerProps) {
  const mode = productScope?.mode || "all";
  const products = productScope?.products || [];
  const [searchValue, setSearchValue] = useState("");
  const [showResults, setShowResults] = useState(false);
  const fetcher = useFetcher<{ products: ProductScopeItem[] }>();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleModeChange = useCallback(
    (value: string) => {
      if (value === "all") {
        onChange(undefined);
      } else {
        onChange({
          mode: value as "include" | "exclude",
          products: [],
        });
      }
    },
    [onChange]
  );

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchValue(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (!value.trim()) {
        setShowResults(false);
        return;
      }
      debounceRef.current = setTimeout(() => {
        fetcher.load(`/api/products/search?q=${encodeURIComponent(value)}`);
        setShowResults(true);
      }, 300);
    },
    [fetcher]
  );

  const addProduct = useCallback(
    (product: ProductScopeItem) => {
      if (products.some((p) => p.id === product.id)) return;
      onChange({
        mode: mode as "include" | "exclude",
        products: [...products, product],
      });
      setSearchValue("");
      setShowResults(false);
    },
    [mode, products, onChange]
  );

  const removeProduct = useCallback(
    (id: string) => {
      onChange({
        mode: mode as "include" | "exclude",
        products: products.filter((p) => p.id !== id),
      });
    },
    [mode, products, onChange]
  );

  const searchResults = (fetcher.data?.products || []).filter(
    (p) => !products.some((existing) => existing.id === p.id)
  );

  return (
    <BlockStack gap="300">
      <Select
        label="Product scope"
        options={[
          { label: "All products", value: "all" },
          { label: "Only specific products", value: "include" },
          { label: "All except specific products", value: "exclude" },
        ]}
        value={mode}
        onChange={handleModeChange}
        helpText={
          mode === "all"
            ? "This rule applies to all products"
            : mode === "include"
              ? "This rule only applies to the selected products"
              : "This rule applies to all products except the selected ones"
        }
      />

      {mode !== "all" && (
        <BlockStack gap="200">
          <div style={{ position: "relative" }}>
            <TextField
              label="Search products"
              labelHidden
              value={searchValue}
              onChange={handleSearchChange}
              placeholder="Search for products to add..."
              autoComplete="off"
              prefix={<Icon source={SearchIcon} />}
              onFocus={() => {
                if (searchValue.trim() && fetcher.data) setShowResults(true);
              }}
              onBlur={() => {
                // Delay to allow click on results
                setTimeout(() => setShowResults(false), 200);
              }}
            />
            {showResults && searchResults.length > 0 && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  zIndex: 100,
                  background: "white",
                  border: "1px solid #dfe3e8",
                  borderRadius: "0 0 8px 8px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  maxHeight: "240px",
                  overflowY: "auto",
                }}
              >
                {searchResults.map((product) => (
                  <button
                    key={product.id}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addProduct(product);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      width: "100%",
                      padding: "8px 12px",
                      background: "none",
                      border: "none",
                      borderBottom: "1px solid #f1f2f3",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    {product.image ? (
                      <Thumbnail source={product.image} alt={product.title} size="small" />
                    ) : (
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          background: "#f1f2f3",
                          borderRadius: 4,
                        }}
                      />
                    )}
                    <div>
                      <div style={{ fontWeight: 500, fontSize: "13px" }}>{product.title}</div>
                      <div style={{ fontSize: "12px", color: "#6d7175" }}>
                        /products/{product.handle}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            {showResults && fetcher.state === "loading" && (
              <div
                style={{
                  position: "absolute",
                  top: "100%",
                  left: 0,
                  right: 0,
                  zIndex: 100,
                  background: "white",
                  border: "1px solid #dfe3e8",
                  borderRadius: "0 0 8px 8px",
                  padding: "12px",
                  textAlign: "center",
                  fontSize: "13px",
                  color: "#6d7175",
                }}
              >
                Searching...
              </div>
            )}
          </div>

          {products.length === 0 ? (
            <Text as="p" tone="subdued">
              Search for products to add
            </Text>
          ) : (
            <BlockStack gap="100">
              {products.map((product) => (
                <div
                  key={product.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "6px 8px",
                    background: "#f6f6f7",
                    borderRadius: "6px",
                  }}
                >
                  {product.image ? (
                    <Thumbnail source={product.image} alt={product.title} size="small" />
                  ) : (
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        background: "#e1e3e5",
                        borderRadius: 4,
                      }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 500, fontSize: "13px" }}>{product.title}</div>
                    <div style={{ fontSize: "12px", color: "#6d7175" }}>
                      /products/{product.handle}
                    </div>
                  </div>
                  <button
                    onClick={() => removeProduct(product.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "4px",
                      color: "#8c9196",
                      display: "flex",
                    }}
                    aria-label={`Remove ${product.title}`}
                  >
                    <Icon source={XCircleIcon} />
                  </button>
                </div>
              ))}
            </BlockStack>
          )}
        </BlockStack>
      )}
    </BlockStack>
  );
}
