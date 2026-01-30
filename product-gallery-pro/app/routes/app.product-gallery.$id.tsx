/**
 * Variant Image Mapping Editor Page
 *
 * Full-featured mapping editor with:
 * - Multi-select images for batch assignment
 * - Variant filter tabs to view images by variant
 * - Compact sidebar with assignment controls
 * - AI auto-detection support
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useFetcher, useNavigation } from "@remix-run/react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  ButtonGroup,
  Card,
  Checkbox,
  InlineStack,
  Layout,
  Page,
  Select,
  Text,
  TextField,
  Tooltip,
  SkeletonBodyText,
  SkeletonDisplayText,
  SkeletonThumbnail,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getVariantMapping, getShopImageTags, saveShopImageTags } from "~/lib/variant-mapping.server";
import { getShopRules } from "~/lib/rules/storage.server";
import { logError } from "~/lib/logging.server";
import { AIDetectionModal } from "~/components/variant-mapping";
import type {
  VariantImageMap,
  ImageMapping,
  VariantOptions,
  AIDetectionResult,
  FallbackBehavior,
  MatchMode,
  ProductMedia,
} from "~/types/variant-mapping";
import {
  createEmptyMapping,
  createEmptyImageMapping,
  extractVariantOptions,
} from "~/types/variant-mapping";
import { colors, borderRadius, spacing, shadows } from "~/styles/design-system";

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { admin, session } = await authenticate.admin(request);
  const shopId = session.shop;
  const productId = params.id;

  if (!productId) {
    throw new Response("Product ID required", { status: 400 });
  }

  try {
    const [{ product, mapping, hasExistingMapping }, rulesData, shopTags] = await Promise.all([
      getVariantMapping(admin, productId),
      getShopRules(admin).catch(() => ({ rules: [] })),
      getShopImageTags(admin),
    ]);

    const activeRuleCount = (rulesData.rules || []).filter(
      (r: { status: string }) => r.status === "active"
    ).length;

    return json({
      shopId,
      product,
      mapping,
      hasExistingMapping,
      activeRuleCount,
      shopTags,
    });
  } catch (error) {
    logError("Failed to load variant mapping", error, { shopId, productId });
    throw new Response("Failed to load product", { status: 500 });
  }
};

// =============================================================================
// ACTION — tag management
// =============================================================================

export const action = async ({ request }: ActionFunctionArgs) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  if (intent === "addTag") {
    const tag = (formData.get("tag") as string || "").trim().toLowerCase();
    if (!tag || tag.length > 30 || !/^[a-z0-9-]+$/.test(tag)) {
      return json({ success: false, error: "Invalid tag. Use lowercase letters, numbers, and hyphens (max 30 chars)." }, { status: 400 });
    }
    const currentTags = await getShopImageTags(admin);
    if (currentTags.includes(tag)) {
      return json({ success: false, error: "Tag already exists." }, { status: 400 });
    }
    if (currentTags.length >= 50) {
      return json({ success: false, error: "Maximum 50 tags allowed." }, { status: 400 });
    }
    await saveShopImageTags(admin, [...currentTags, tag]);
    const updatedTags = await getShopImageTags(admin);
    return json({ success: true, shopTags: updatedTags });
  }

  if (intent === "deleteTag") {
    const tag = formData.get("tag") as string;
    const currentTags = await getShopImageTags(admin);
    await saveShopImageTags(admin, currentTags.filter((t) => t !== tag));
    const updatedTags = await getShopImageTags(admin);
    return json({ success: true, shopTags: updatedTags });
  }

  return json({ success: false, error: "Unknown intent" }, { status: 400 });
};

// =============================================================================
// Inline sub-components (kept in same file for simplicity)
// =============================================================================

function VariantFilterTabs({
  options,
  activeFilter,
  onFilter,
  mappings,
  totalImages,
}: {
  options: VariantOptions[];
  activeFilter: string;
  onFilter: (value: string) => void;
  mappings: Record<string, ImageMapping>;
  totalImages: number;
}) {
  const allValues = options.flatMap((o) => o.values);
  const universalCount = Object.values(mappings).filter((m) => m.universal).length;
  const unmappedCount =
    totalImages -
    Object.values(mappings).filter((m) => m.variants.length > 0 || m.universal).length;

  const countForValue = (value: string) => {
    return (
      Object.values(mappings).filter(
        (m) => m.variants.includes(value) || m.universal
      ).length
    );
  };

  const tabs = [
    { value: "all", label: "All", count: totalImages },
    ...allValues.map((v) => ({ value: v, label: v, count: countForValue(v) })),
    ...(universalCount > 0
      ? [{ value: "_universal", label: "Universal", count: universalCount }]
      : []),
    { value: "_unmapped", label: "Unmapped", count: unmappedCount },
  ];

  return (
    <div style={{ display: "flex", gap: spacing[1], flexWrap: "wrap" }}>
      {tabs.map((tab) => {
        const isActive = activeFilter === tab.value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onFilter(tab.value)}
            style={{
              padding: `6px 12px`,
              border: `1px solid ${isActive ? colors.primary[500] : colors.neutral[300]}`,
              borderRadius: borderRadius.full,
              background: isActive ? colors.primary[500] : colors.neutral[0],
              color: isActive ? colors.neutral[0] : colors.neutral[700],
              fontSize: "13px",
              fontWeight: isActive ? 600 : 400,
              cursor: "pointer",
              transition: "all 0.15s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {tab.label}
            <span
              style={{
                background: isActive
                  ? "rgba(255,255,255,0.3)"
                  : colors.neutral[100],
                padding: "1px 6px",
                borderRadius: borderRadius.full,
                fontSize: "11px",
                fontWeight: 600,
              }}
            >
              {tab.count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function ImageCard({
  media,
  mapping,
  isSelected,
  onToggleSelect,
  variantOptions,
  draggable,
  isDragOver,
  isDragging,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
}: {
  media: ProductMedia;
  mapping: ImageMapping | undefined;
  isSelected: boolean;
  onToggleSelect: (mediaId: string, multi: boolean) => void;
  variantOptions: VariantOptions[];
  draggable?: boolean;
  isDragOver?: boolean;
  isDragging?: boolean;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}) {
  const hasMapping = mapping && (mapping.variants.length > 0 || mapping.universal);
  const variantLabels = mapping?.variants ?? [];

  // Build color map for variant pills
  const allValues = variantOptions.flatMap((o) => o.values);
  const colorPalette = [
    colors.primary[500],
    colors.success.main,
    colors.warning.main,
    colors.info.main,
    colors.chart.tertiary,
    colors.chart.quaternary,
  ];

  return (
    <div
      onClick={(e) => onToggleSelect(media.id, e.metaKey || e.ctrlKey || e.shiftKey)}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        position: "relative",
        borderRadius: borderRadius.md,
        border: isDragOver
          ? `2px solid ${colors.primary[500]}`
          : isSelected
            ? `2px solid ${colors.primary[500]}`
            : `1px solid ${colors.neutral[200]}`,
        background: isDragOver ? colors.primary[50] : colors.neutral[0],
        cursor: draggable ? "grab" : "pointer",
        overflow: "hidden",
        transition: "all 0.12s ease",
        boxShadow: isSelected ? `0 0 0 1px ${colors.primary[500]}` : "none",
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      {/* Checkbox overlay */}
      <div
        style={{
          position: "absolute",
          top: "8px",
          left: "8px",
          zIndex: 2,
          width: "22px",
          height: "22px",
          borderRadius: "4px",
          border: `2px solid ${isSelected ? colors.primary[500] : "rgba(255,255,255,0.8)"}`,
          background: isSelected ? colors.primary[500] : "rgba(255,255,255,0.6)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backdropFilter: "blur(4px)",
        }}
      >
        {isSelected && (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 7 6 10 11 4" />
          </svg>
        )}
      </div>

      {/* Image / Video preview */}
      <div style={{ aspectRatio: "3/4", overflow: "hidden", position: "relative" }}>
        {(() => {
          const isVideo = media.mediaContentType === "VIDEO" || media.mediaContentType === "EXTERNAL_VIDEO";
          const imgUrl = media.image?.url || media.preview?.image?.url;
          if (imgUrl) {
            return (
              <>
                <img
                  src={imgUrl}
                  alt={media.alt || ""}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
                {isVideo && (
                  <div
                    style={{
                      position: "absolute",
                      top: "50%",
                      left: "50%",
                      transform: "translate(-50%, -50%)",
                      width: "36px",
                      height: "36px",
                      borderRadius: "50%",
                      background: "rgba(0,0,0,0.6)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="white">
                      <polygon points="4,2 14,8 4,14" />
                    </svg>
                  </div>
                )}
              </>
            );
          }
          return (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: colors.neutral[100],
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: colors.neutral[400],
                fontSize: "12px",
              }}
            >
              {isVideo ? "Video" : "No image"}
            </div>
          );
        })()}
      </div>

      {/* Variant pills footer */}
      <div
        style={{
          padding: "6px 8px",
          display: "flex",
          flexWrap: "wrap",
          gap: "3px",
          minHeight: "30px",
          borderTop: `1px solid ${colors.neutral[100]}`,
          background: colors.neutral[50],
        }}
      >
        {mapping?.universal ? (
          <span
            style={{
              padding: "2px 8px",
              background: colors.info.light,
              color: colors.info.dark,
              fontSize: "10px",
              fontWeight: 600,
              borderRadius: borderRadius.full,
              letterSpacing: "0.3px",
            }}
          >
            Universal
          </span>
        ) : variantLabels.length > 0 ? (
          variantLabels.map((v) => {
            const idx = allValues.indexOf(v);
            const pillColor = colorPalette[idx % colorPalette.length];
            return (
              <span
                key={v}
                style={{
                  padding: "2px 8px",
                  background: pillColor + "18",
                  color: pillColor,
                  fontSize: "10px",
                  fontWeight: 600,
                  borderRadius: borderRadius.full,
                  border: `1px solid ${pillColor}40`,
                }}
              >
                {v}
              </span>
            );
          })
        ) : (
          <span
            style={{
              padding: "2px 8px",
              background: colors.neutral[100],
              color: colors.neutral[500],
              fontSize: "10px",
              fontWeight: 500,
              borderRadius: borderRadius.full,
              fontStyle: "italic",
            }}
          >
            Not assigned
          </span>
        )}
        {/* Tag pills */}
        {mapping?.tags && mapping.tags.length > 0 && mapping.tags.map((tag) => (
          <span
            key={`tag-${tag}`}
            style={{
              padding: "2px 6px",
              background: colors.neutral[200],
              color: colors.neutral[600],
              fontSize: "9px",
              fontWeight: 500,
              borderRadius: borderRadius.full,
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Main Page Component
// =============================================================================

export default function VariantMappingPage() {
  const { product, mapping: initialMapping, hasExistingMapping, activeRuleCount, shopTags } =
    useLoaderData<typeof loader>();
  const navigate = useNavigate();
  const tagFetcher = useFetcher();
  const navigation = useNavigation();

  if (navigation.state === "loading") {
    return (
      <Page title="Loading...">
        <TitleBar title="Image Mapping" />
        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <SkeletonDisplayText size="small" />
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "12px" }}>
                  {[1,2,3,4,5,6].map(i => (
                    <div key={i} style={{ aspectRatio: "3/4", background: "#f1f1f1", borderRadius: "8px" }} />
                  ))}
                </div>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card><SkeletonBodyText lines={6} /></Card>
              <Card><SkeletonBodyText lines={4} /></Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

  const [rulesBannerDismissed, setRulesBannerDismissed] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [showTagInput, setShowTagInput] = useState(false);

  // Merge fetcher-returned tags with loader tags
  const currentShopTags: string[] = (tagFetcher.data as { shopTags?: string[] })?.shopTags ?? shopTags ?? [];

  // Core state
  const [mapping, setMapping] = useState<VariantImageMap>(
    initialMapping ?? createEmptyMapping()
  );
  const [originalMapping] = useState<VariantImageMap | null>(initialMapping);
  const [selectedMediaIds, setSelectedMediaIds] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState("all");
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [dragMediaId, setDragMediaId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Computed
  const variantOptions = useMemo(
    () => extractVariantOptions(product.variants),
    [product.variants]
  );
  const isDirty =
    JSON.stringify(mapping) !==
    JSON.stringify(originalMapping ?? createEmptyMapping());
  const selectionCount = selectedMediaIds.size;

  // Get the variant assignments for the selected images (for the sidebar)
  const commonVariants = useMemo(() => {
    if (selectionCount === 0) return new Set<string>();
    const selected = Array.from(selectedMediaIds);
    // Find variants common to ALL selected images
    const first = mapping.mappings[selected[0]]?.variants ?? [];
    const common = new Set(first);
    for (let i = 1; i < selected.length; i++) {
      const variants = new Set(mapping.mappings[selected[i]]?.variants ?? []);
      for (const v of common) {
        if (!variants.has(v)) common.delete(v);
      }
    }
    return common;
  }, [selectedMediaIds, mapping.mappings, selectionCount]);

  // Are any selected images universal?
  const anyUniversal = useMemo(() => {
    for (const id of selectedMediaIds) {
      if (mapping.mappings[id]?.universal) return true;
    }
    return false;
  }, [selectedMediaIds, mapping.mappings]);

  // Filter images based on active tab, sorted by position for variant views
  const filteredMedia = useMemo(() => {
    let result: typeof product.media;
    if (activeFilter === "all") {
      result = product.media;
    } else if (activeFilter === "_unmapped") {
      result = product.media.filter((m) => {
        const map = mapping.mappings[m.id];
        return !map || (map.variants.length === 0 && !map.universal);
      });
    } else if (activeFilter === "_universal") {
      result = product.media.filter((m) => mapping.mappings[m.id]?.universal);
    } else {
      // Filter by variant value, then sort by position
      result = product.media
        .filter((m) => {
          const map = mapping.mappings[m.id];
          return map && (map.variants.includes(activeFilter) || map.universal);
        })
        .sort((a, b) => {
          const posA = mapping.mappings[a.id]?.position ?? 999;
          const posB = mapping.mappings[b.id]?.position ?? 999;
          return posA - posB;
        });
    }
    return result;
  }, [activeFilter, product.media, mapping.mappings]);

  // Whether we're in a reorderable view (specific variant selected)
  const isReorderable = activeFilter !== "all" && activeFilter !== "_unmapped" && activeFilter !== "_universal";

  // Handlers
  const handleToggleSelect = useCallback(
    (mediaId: string, multi: boolean) => {
      setSelectedMediaIds((prev) => {
        const next = new Set(prev);
        if (multi) {
          // Toggle this one
          if (next.has(mediaId)) {
            next.delete(mediaId);
          } else {
            next.add(mediaId);
          }
        } else {
          // Single select - if already the only selected, deselect
          if (next.size === 1 && next.has(mediaId)) {
            next.clear();
          } else {
            next.clear();
            next.add(mediaId);
          }
        }
        return next;
      });
    },
    []
  );

  const handleSelectAll = useCallback(() => {
    setSelectedMediaIds(new Set(filteredMedia.map((m) => m.id)));
  }, [filteredMedia]);

  const handleSelectNone = useCallback(() => {
    setSelectedMediaIds(new Set());
  }, []);

  const handleAssignVariant = useCallback(
    (value: string, checked: boolean) => {
      if (selectedMediaIds.size === 0) return;

      setMapping((prev) => {
        const newMappings = { ...prev.mappings };

        for (const mediaId of selectedMediaIds) {
          const current = newMappings[mediaId] ?? createEmptyImageMapping();
          const variants = new Set(current.variants);

          if (checked) {
            variants.add(value);
          } else {
            variants.delete(value);
          }

          newMappings[mediaId] = {
            ...current,
            variants: Array.from(variants),
            universal: false,
            source: "manual",
            mapped_at: new Date().toISOString(),
          };
        }

        return {
          ...prev,
          updated_at: new Date().toISOString(),
          updated_by: "manual",
          mappings: newMappings,
        };
      });
    },
    [selectedMediaIds]
  );

  const handleSetUniversal = useCallback(
    (universal: boolean) => {
      if (selectedMediaIds.size === 0) return;

      setMapping((prev) => {
        const newMappings = { ...prev.mappings };

        for (const mediaId of selectedMediaIds) {
          const current = newMappings[mediaId] ?? createEmptyImageMapping();
          newMappings[mediaId] = {
            ...current,
            universal,
            variants: universal ? [] : current.variants,
            source: "manual",
            mapped_at: new Date().toISOString(),
          };
        }

        return {
          ...prev,
          updated_at: new Date().toISOString(),
          updated_by: "manual",
          mappings: newMappings,
        };
      });
    },
    [selectedMediaIds]
  );

  const handleClearMapping = useCallback(() => {
    if (selectedMediaIds.size === 0) return;

    setMapping((prev) => {
      const newMappings = { ...prev.mappings };

      for (const mediaId of selectedMediaIds) {
        delete newMappings[mediaId];
      }

      return {
        ...prev,
        updated_at: new Date().toISOString(),
        updated_by: "manual",
        mappings: newMappings,
      };
    });
  }, [selectedMediaIds]);

  const handleDrop = useCallback(
    (targetMediaId: string) => {
      if (!dragMediaId || dragMediaId === targetMediaId || !isReorderable) return;

      setMapping((prev) => {
        // Get current filtered+sorted media ids for this variant
        const variantMedia = product.media
          .filter((m) => {
            const map = prev.mappings[m.id];
            return map && (map.variants.includes(activeFilter) || map.universal);
          })
          .sort((a, b) => {
            const posA = prev.mappings[a.id]?.position ?? 999;
            const posB = prev.mappings[b.id]?.position ?? 999;
            return posA - posB;
          })
          .map((m) => m.id);

        // Reorder: remove dragged, insert before target
        const fromIdx = variantMedia.indexOf(dragMediaId);
        const toIdx = variantMedia.indexOf(targetMediaId);
        if (fromIdx === -1 || toIdx === -1) return prev;

        variantMedia.splice(fromIdx, 1);
        variantMedia.splice(toIdx, 0, dragMediaId);

        // Update positions
        const newMappings = { ...prev.mappings };
        variantMedia.forEach((id, idx) => {
          if (newMappings[id]) {
            newMappings[id] = { ...newMappings[id], position: idx };
          }
        });

        return {
          ...prev,
          updated_at: new Date().toISOString(),
          updated_by: "manual",
          settings: { ...prev.settings, custom_ordering: true },
          mappings: newMappings,
        };
      });

      setDragMediaId(null);
    },
    [dragMediaId, isReorderable, activeFilter, product.media]
  );

  const handleFallbackChange = useCallback((value: string) => {
    setMapping((prev) => ({
      ...prev,
      updated_at: new Date().toISOString(),
      settings: { ...prev.settings, fallback: value as FallbackBehavior },
    }));
  }, []);

  const handleApplyAIResults = useCallback((results: AIDetectionResult[]) => {
    setMapping((prev) => {
      const newMappings = { ...prev.mappings };

      for (const result of results) {
        if (result.detectedVariants.length > 0) {
          const existing =
            newMappings[result.mediaId] ?? createEmptyImageMapping("ai");
          newMappings[result.mediaId] = {
            ...existing,
            variants: result.detectedVariants,
            source: "ai",
            confidence: result.confidence,
            mapped_at: new Date().toISOString(),
          };
        }
      }

      return {
        ...prev,
        updated_at: new Date().toISOString(),
        updated_by: "ai",
        mappings: newMappings,
      };
    });
  }, []);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccess(false);

    try {
      const response = await fetch("/api/variant-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id, mapping }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || "Failed to save mapping");
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  }, [product.id, mapping]);

  const handleDiscard = useCallback(() => {
    setMapping(originalMapping ?? createEmptyMapping());
    setSelectedMediaIds(new Set());
  }, [originalMapping]);

  // Summary stats
  const stats = useMemo(() => {
    const entries = Object.values(mapping.mappings);
    const mapped = entries.filter((m) => m.variants.length > 0 || m.universal).length;
    const universal = entries.filter((m) => m.universal).length;
    return {
      total: product.media.length,
      mapped,
      universal,
      unmapped: product.media.length - mapped,
    };
  }, [mapping.mappings, product.media.length]);

  // Per-variant counts
  const variantCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const option of variantOptions) {
      for (const value of option.values) {
        counts[value] = Object.values(mapping.mappings).filter(
          (m) => m.variants.includes(value) || m.universal
        ).length;
      }
    }
    return counts;
  }, [mapping.mappings, variantOptions]);

  useEffect(() => {
    if (isDirty) setSaveSuccess(false);
  }, [isDirty]);

  // All variant values flat
  const allVariantValues = variantOptions.flatMap((o) => o.values);

  return (
    <Page
      backAction={{
        content: "Products",
        onAction: () => navigate("/app/products"),
      }}
      title={product.title}
      titleMetadata={
        hasExistingMapping ? (
          <Badge tone="success">Mapping saved</Badge>
        ) : (
          <Badge tone="attention">No mapping</Badge>
        )
      }
      primaryAction={{
        content: isSaving ? "Saving..." : "Save mapping",
        disabled: !isDirty || isSaving,
        loading: isSaving,
        onAction: handleSave,
      }}
      secondaryActions={[
        {
          content: "Discard changes",
          disabled: !isDirty,
          destructive: true,
          onAction: handleDiscard,
        },
        {
          content: "AI Auto-Detect",
          onAction: () => setIsAIModalOpen(true),
        },
      ]}
    >
      <TitleBar title="Image Mapping" />

      <BlockStack gap="400">
        {/* Alerts */}
        {saveError && (
          <Banner
            tone="critical"
            title="Save failed"
            onDismiss={() => setSaveError(null)}
          >
            <p>{saveError}</p>
          </Banner>
        )}
        {saveSuccess && (
          <Banner
            tone="success"
            title="Mapping saved"
            onDismiss={() => setSaveSuccess(false)}
          >
            <p>
              Variant image mapping has been saved. Changes will appear on the
              storefront.
            </p>
          </Banner>
        )}

        {activeRuleCount > 0 && !rulesBannerDismissed && (
          <Banner
            tone="info"
            title={`${activeRuleCount} gallery rule${activeRuleCount === 1 ? " is" : "s are"} active for this product`}
            onDismiss={() => setRulesBannerDismissed(true)}
            action={{ content: "View Rules", url: "/app/rules" }}
          >
            <p>Rules can filter, reorder, or badge images automatically.</p>
          </Banner>
        )}

        <Layout>
          {/* ============ MAIN CONTENT: Image Grid ============ */}
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                {/* Header with stats */}
                <InlineStack align="space-between" blockAlign="center" wrap>
                  <Text as="h2" variant="headingMd">
                    Product Images ({product.media.length})
                  </Text>
                  <InlineStack gap="200">
                    <StatPill
                      label="Mapped"
                      count={stats.mapped}
                      color={colors.success.main}
                    />
                    <StatPill
                      label="Unmapped"
                      count={stats.unmapped}
                      color={
                        stats.unmapped > 0
                          ? colors.warning.main
                          : colors.neutral[400]
                      }
                    />
                  </InlineStack>
                </InlineStack>

                {/* Filter tabs */}
                <VariantFilterTabs
                  options={variantOptions}
                  activeFilter={activeFilter}
                  onFilter={setActiveFilter}
                  mappings={mapping.mappings}
                  totalImages={product.media.length}
                />

                {/* Selection toolbar */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: `${spacing[2]} ${spacing[3]}`,
                    background: colors.neutral[50],
                    borderRadius: borderRadius.md,
                    fontSize: "13px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: spacing[3] }}>
                    <button
                      type="button"
                      onClick={handleSelectAll}
                      style={{
                        background: "none",
                        border: "none",
                        color: colors.primary[500],
                        cursor: "pointer",
                        fontWeight: 500,
                        fontSize: "13px",
                        padding: 0,
                      }}
                    >
                      Select all ({filteredMedia.length})
                    </button>
                    {selectionCount > 0 && (
                      <>
                        <span style={{ color: colors.neutral[300] }}>|</span>
                        <button
                          type="button"
                          onClick={handleSelectNone}
                          style={{
                            background: "none",
                            border: "none",
                            color: colors.neutral[600],
                            cursor: "pointer",
                            fontSize: "13px",
                            padding: 0,
                          }}
                        >
                          Deselect
                        </button>
                      </>
                    )}
                  </div>
                  <span style={{ color: colors.neutral[600] }}>
                    {selectionCount > 0
                      ? `${selectionCount} selected`
                      : "Click to select, Cmd/Ctrl+click for multi-select"}
                  </span>
                </div>

                {/* Reorder hint */}
                {isReorderable && filteredMedia.length > 1 && (
                  <div
                    style={{
                      padding: `${spacing[2]} ${spacing[3]}`,
                      background: colors.info.light,
                      color: colors.info.dark,
                      borderRadius: borderRadius.md,
                      fontSize: "12px",
                      fontWeight: 500,
                    }}
                  >
                    Drag images to reorder them for this variant
                  </div>
                )}

                {/* Image grid */}
                {filteredMedia.length === 0 ? (
                  <div
                    style={{
                      padding: spacing[10],
                      textAlign: "center",
                      color: colors.neutral[500],
                      background: colors.neutral[50],
                      borderRadius: borderRadius.md,
                      border: `1px dashed ${colors.neutral[300]}`,
                    }}
                  >
                    <Text as="p" variant="bodyMd" tone="subdued">
                      No images match this filter
                    </Text>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                      gap: spacing[3],
                    }}
                  >
                    {filteredMedia.map((media) => (
                      <ImageCard
                        key={media.id}
                        media={media}
                        mapping={mapping.mappings[media.id]}
                        isSelected={selectedMediaIds.has(media.id)}
                        onToggleSelect={handleToggleSelect}
                        variantOptions={variantOptions}
                        draggable={isReorderable}
                        isDragging={dragMediaId === media.id}
                        isDragOver={dragOverId === media.id}
                        onDragStart={() => setDragMediaId(media.id)}
                        onDragEnd={() => {
                          setDragMediaId(null);
                          setDragOverId(null);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = "move";
                          setDragOverId(media.id);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          setDragOverId(null);
                          handleDrop(media.id);
                        }}
                      />
                    ))}
                  </div>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>

          {/* ============ SIDEBAR ============ */}
          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              {/* Assignment panel */}
              <Card>
                <BlockStack gap="400">
                  <Text as="h3" variant="headingMd">
                    {selectionCount === 0
                      ? "Assign Variants"
                      : selectionCount === 1
                        ? "Assign to 1 image"
                        : `Assign to ${selectionCount} images`}
                  </Text>

                  {selectionCount === 0 ? (
                    <div
                      style={{
                        padding: spacing[6],
                        textAlign: "center",
                        color: colors.neutral[500],
                        background: colors.neutral[50],
                        borderRadius: borderRadius.md,
                        border: `1px dashed ${colors.neutral[300]}`,
                      }}
                    >
                      <Text as="p" variant="bodySm" tone="subdued">
                        Select one or more images to assign variants
                      </Text>
                    </div>
                  ) : (
                    <>
                      {/* Universal toggle */}
                      <Checkbox
                        label="Universal image"
                        helpText="Show for all variants"
                        checked={anyUniversal}
                        onChange={handleSetUniversal}
                      />

                      {/* Variant checkboxes */}
                      {!anyUniversal && (
                        <>
                          <div
                            style={{
                              height: "1px",
                              background: colors.neutral[200],
                            }}
                          />
                          {variantOptions.map((option) => (
                            <div key={option.name}>
                              <Text
                                as="p"
                                variant="bodySm"
                                fontWeight="semibold"
                                tone="subdued"
                              >
                                {option.name.toUpperCase()}
                              </Text>
                              <div
                                style={{
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: spacing[1],
                                  marginTop: spacing[2],
                                }}
                              >
                                {option.values.map((value) => {
                                  const isChecked = commonVariants.has(value);
                                  // Check if SOME but not all have it
                                  const isIndeterminate =
                                    !isChecked &&
                                    Array.from(selectedMediaIds).some(
                                      (id) =>
                                        mapping.mappings[id]?.variants.includes(
                                          value
                                        )
                                    );

                                  return (
                                    <label
                                      key={value}
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: spacing[2],
                                        padding: `${spacing[2]} ${spacing[3]}`,
                                        background: isChecked
                                          ? colors.primary[50]
                                          : "transparent",
                                        borderRadius: borderRadius.sm,
                                        cursor: "pointer",
                                        fontSize: "13px",
                                        fontWeight: isChecked ? 500 : 400,
                                        color: isChecked
                                          ? colors.primary[700]
                                          : colors.neutral[700],
                                        transition: "background 0.1s ease",
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isChecked || isIndeterminate}
                                        ref={(el) => {
                                          if (el) el.indeterminate = isIndeterminate;
                                        }}
                                        onChange={(e) =>
                                          handleAssignVariant(
                                            value,
                                            e.target.checked
                                          )
                                        }
                                        style={{
                                          width: "16px",
                                          height: "16px",
                                          accentColor: colors.primary[500],
                                          cursor: "pointer",
                                        }}
                                      />
                                      <span style={{ flex: 1 }}>{value}</span>
                                      <span
                                        style={{
                                          fontSize: "11px",
                                          color: colors.neutral[500],
                                          fontWeight: 400,
                                        }}
                                      >
                                        {variantCounts[value] || 0} img
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </>
                      )}

                      {/* Image Tags */}
                      <div style={{ height: "1px", background: colors.neutral[200] }} />
                      <Text as="p" variant="bodySm" fontWeight="semibold" tone="subdued">
                        IMAGE TAGS
                      </Text>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: spacing[1] }}>
                        {currentShopTags.map((tag) => {
                          const allSelected = Array.from(selectedMediaIds);
                          const allHaveTag = allSelected.length > 0 && allSelected.every(
                            (id) => (mapping.mappings[id]?.tags ?? []).includes(tag)
                          );
                          const isDefault = ["hero", "lifestyle", "product-shot", "detail", "size-guide", "material", "video", "universal"].includes(tag);
                          return (
                            <span
                              key={tag}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "2px",
                              }}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  if (selectedMediaIds.size === 0) return;
                                  setMapping((prev) => {
                                    const newMappings = { ...prev.mappings };
                                    for (const mediaId of selectedMediaIds) {
                                      const current = newMappings[mediaId] ?? createEmptyImageMapping();
                                      const tags = new Set(current.tags ?? []);
                                      if (allHaveTag) {
                                        tags.delete(tag);
                                      } else {
                                        tags.add(tag);
                                      }
                                      newMappings[mediaId] = {
                                        ...current,
                                        tags: Array.from(tags),
                                        mapped_at: new Date().toISOString(),
                                      };
                                    }
                                    return { ...prev, updated_at: new Date().toISOString(), mappings: newMappings };
                                  });
                                }}
                                style={{
                                  padding: "3px 10px",
                                  borderRadius: isDefault ? borderRadius.full : `${borderRadius.full} 0 0 ${borderRadius.full}`,
                                  border: `1px solid ${allHaveTag ? colors.neutral[600] : colors.neutral[300]}`,
                                  borderRight: !isDefault ? "none" : undefined,
                                  background: allHaveTag ? colors.neutral[700] : colors.neutral[50],
                                  color: allHaveTag ? colors.neutral[0] : colors.neutral[600],
                                  fontSize: "11px",
                                  fontWeight: 500,
                                  cursor: "pointer",
                                  transition: "all 0.12s ease",
                                }}
                              >
                                {tag}
                              </button>
                              {!isDefault && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    tagFetcher.submit(
                                      { intent: "deleteTag", tag },
                                      { method: "POST" }
                                    );
                                  }}
                                  style={{
                                    padding: "3px 5px",
                                    borderRadius: `0 ${borderRadius.full} ${borderRadius.full} 0`,
                                    border: `1px solid ${colors.neutral[300]}`,
                                    background: colors.neutral[50],
                                    color: colors.neutral[500],
                                    fontSize: "10px",
                                    cursor: "pointer",
                                    lineHeight: 1,
                                  }}
                                  title={`Remove "${tag}" tag`}
                                >
                                  x
                                </button>
                              )}
                            </span>
                          );
                        })}
                        {/* Add tag button / input */}
                        {showTagInput ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
                            <input
                              type="text"
                              value={newTagInput}
                              onChange={(e) => setNewTagInput(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && newTagInput) {
                                  tagFetcher.submit(
                                    { intent: "addTag", tag: newTagInput },
                                    { method: "POST" }
                                  );
                                  setNewTagInput("");
                                  setShowTagInput(false);
                                } else if (e.key === "Escape") {
                                  setNewTagInput("");
                                  setShowTagInput(false);
                                }
                              }}
                              placeholder="new-tag"
                              maxLength={30}
                              autoFocus
                              style={{
                                padding: "3px 8px",
                                borderRadius: borderRadius.full,
                                border: `1px solid ${colors.primary[300]}`,
                                fontSize: "11px",
                                width: "100px",
                                outline: "none",
                              }}
                            />
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setShowTagInput(true)}
                            style={{
                              padding: "3px 10px",
                              borderRadius: borderRadius.full,
                              border: `1px dashed ${colors.neutral[400]}`,
                              background: "transparent",
                              color: colors.neutral[500],
                              fontSize: "11px",
                              fontWeight: 500,
                              cursor: "pointer",
                            }}
                          >
                            + Add tag
                          </button>
                        )}
                      </div>

                      {/* Clear button */}
                      <div style={{ height: "1px", background: colors.neutral[200] }} />
                      <Button
                        variant="plain"
                        tone="critical"
                        onClick={handleClearMapping}
                      >
                        Clear assignment
                      </Button>
                    </>
                  )}
                </BlockStack>
              </Card>

              {/* Per-variant summary */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">
                    Coverage
                  </Text>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: spacing[2],
                    }}
                  >
                    {variantOptions.flatMap((option) =>
                      option.values.map((value) => {
                        const count = variantCounts[value] || 0;
                        const pct = Math.round(
                          (count / product.media.length) * 100
                        );
                        return (
                          <div
                            key={value}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: spacing[2],
                            }}
                          >
                            <span
                              style={{
                                flex: 1,
                                fontSize: "13px",
                                color: colors.neutral[700],
                              }}
                            >
                              {value}
                            </span>
                            <span
                              style={{
                                fontSize: "13px",
                                fontWeight: 600,
                                color:
                                  count === 0
                                    ? colors.critical.main
                                    : colors.neutral[800],
                                minWidth: "24px",
                                textAlign: "right",
                              }}
                            >
                              {count}
                            </span>
                            <div
                              style={{
                                width: "60px",
                                height: "6px",
                                background: colors.neutral[200],
                                borderRadius: borderRadius.full,
                                overflow: "hidden",
                              }}
                            >
                              <div
                                style={{
                                  width: `${pct}%`,
                                  height: "100%",
                                  background:
                                    count === 0
                                      ? colors.critical.main
                                      : colors.success.main,
                                  borderRadius: borderRadius.full,
                                  transition: "width 0.3s ease",
                                }}
                              />
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </BlockStack>
              </Card>

              {/* Settings */}
              <Card>
                <BlockStack gap="300">
                  <Text as="h3" variant="headingMd">
                    Fallback Behavior
                  </Text>
                  <Select
                    label="When a variant has no images"
                    labelHidden
                    options={[
                      { label: "Show all images", value: "show_all" },
                      {
                        label: "Show universal only",
                        value: "show_universal",
                      },
                      { label: "Show none", value: "show_none" },
                    ]}
                    value={mapping.settings.fallback}
                    onChange={handleFallbackChange}
                  />
                </BlockStack>
              </Card>

              {variantOptions.length >= 2 && (
                <Card>
                  <BlockStack gap="300">
                    <Text as="h3" variant="headingMd">
                      Match Mode
                    </Text>
                    <Select
                      label="How variant options are matched to images"
                      labelHidden
                      options={[
                        {
                          label: "Any option matches",
                          value: "any",
                        },
                        {
                          label: "All options must match",
                          value: "all",
                        },
                      ]}
                      value={mapping.settings.match_mode ?? "any"}
                      onChange={(val) =>
                        setMapping((prev) => ({
                          ...prev,
                          settings: { ...prev.settings, match_mode: val as MatchMode },
                        }))
                      }
                      helpText={
                        mapping.settings.match_mode === "all"
                          ? "Images show only when ALL variant options match their tags."
                          : "Images show when ANY variant option matches their tags."
                      }
                    />
                  </BlockStack>
                </Card>
              )}
            </BlockStack>
          </Layout.Section>
        </Layout>
      </BlockStack>

      {/* AI Detection Modal */}
      <AIDetectionModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        onApply={handleApplyAIResults}
        media={product.media}
        productId={product.id}
      />
    </Page>
  );
}

function StatPill({
  label,
  count,
  color,
}: {
  label: string;
  count: number;
  color: string;
}) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "3px 10px",
        background: color + "14",
        borderRadius: borderRadius.full,
        fontSize: "12px",
        fontWeight: 500,
        color,
      }}
    >
      <span style={{ fontWeight: 700 }}>{count}</span>
      {label}
    </span>
  );
}
