/**
 * Rules Engine - Action Executors (PGP-F2.0)
 *
 * Implements all 6 action type executors:
 * - filter: Show/hide images
 * - reorder: Change image order
 * - badge: Add visual overlays
 * - limit: Reduce image count
 * - prioritize: Boost certain images
 * - replace: Swap gallery content
 */

import type { RuleEvaluationContext, ProcessedMediaItem, BadgeOverlay } from "~/types/rules";
import type {
  Action,
  FilterAction,
  ReorderAction,
  BadgeAction,
  LimitAction,
  PrioritizeAction,
  ReplaceAction,
  FilterMatchType,
} from "~/types/rules-actions";
import { formatBadgeText } from "~/types/rules-actions";

// =============================================================================
// MAIN ACTION EXECUTOR
// =============================================================================

/**
 * Execute an action on processed media
 */
export function executeAction(
  action: Action,
  media: ProcessedMediaItem[],
  context: RuleEvaluationContext
): ProcessedMediaItem[] {
  switch (action.type) {
    case "filter":
      return executeFilterAction(action, media, context);
    case "reorder":
      return executeReorderAction(action, media, context);
    case "badge":
      return executeBadgeAction(action, media, context);
    case "limit":
      return executeLimitAction(action, media, context);
    case "prioritize":
      return executePrioritizeAction(action, media, context);
    case "replace":
      return executeReplaceAction(action, media, context);
    default:
      console.warn(`[Rules] Unknown action type: ${(action as Action).type}`);
      return media;
  }
}

// =============================================================================
// FILTER ACTION
// =============================================================================

/**
 * Execute filter action - show or hide specific images
 */
function executeFilterAction(
  action: FilterAction,
  media: ProcessedMediaItem[],
  context: RuleEvaluationContext
): ProcessedMediaItem[] {
  return media.map((item) => {
    const matches = matchesFilterCriteria(item, action, context);

    if (action.mode === "include") {
      // Include mode: only show matching items
      return { ...item, visible: matches };
    } else {
      // Exclude mode: hide matching items
      return { ...item, visible: item.visible && !matches };
    }
  });
}

/**
 * Check if a media item matches filter criteria
 */
function matchesFilterCriteria(
  item: ProcessedMediaItem,
  action: FilterAction,
  context: RuleEvaluationContext
): boolean {
  switch (action.matchType) {
    case "media_tag":
      // Match against media tags
      if (!item.tags || item.tags.length === 0) return false;
      return action.matchValues.some((tag) =>
        item.tags!.some((t) => t.toLowerCase() === tag.toLowerCase())
      );

    case "variant_value":
      // Match against variant values the image is mapped to
      if (!item.variantValues || item.variantValues.length === 0) {
        // If no variant mapping, check against selected variant values
        if (action.matchMode === "any") {
          return action.matchValues.some((val) =>
            context.variant.selectedValues.some(
              (sv) => sv.toLowerCase() === val.toLowerCase()
            )
          );
        }
        return false;
      }
      if (action.matchMode === "all") {
        return action.matchValues.every((val) =>
          item.variantValues!.some((v) => v.toLowerCase() === val.toLowerCase())
        );
      }
      return action.matchValues.some((val) =>
        item.variantValues!.some((v) => v.toLowerCase() === val.toLowerCase())
      );

    case "media_type":
      // Match against media type
      if (!action.mediaTypes) return false;
      return action.mediaTypes.includes(item.type as typeof action.mediaTypes[number]);

    case "position":
      // Match against position
      if (!action.positions) return false;
      return action.positions.includes(item.position);

    case "alt_text":
      // Match against alt text
      if (!item.alt) return false;
      return action.matchValues.some((val) =>
        item.alt!.toLowerCase().includes(val.toLowerCase())
      );

    case "universal":
      // Match universal images
      return item.universal === true;

    default:
      return false;
  }
}

// =============================================================================
// REORDER ACTION
// =============================================================================

/**
 * Execute reorder action - change image order
 */
function executeReorderAction(
  action: ReorderAction,
  media: ProcessedMediaItem[],
  context: RuleEvaluationContext
): ProcessedMediaItem[] {
  // Get only visible items for reordering
  const visibleItems = media.filter((item) => item.visible);
  const hiddenItems = media.filter((item) => !item.visible);

  let reordered: ProcessedMediaItem[];

  switch (action.strategy) {
    case "move_to_front":
      reordered = reorderMoveToFront(visibleItems, action);
      break;

    case "move_to_back":
      reordered = reorderMoveToBack(visibleItems, action);
      break;

    case "move_to_position":
      reordered = reorderMoveToPosition(visibleItems, action);
      break;

    case "shuffle":
      reordered = shuffleArray([...visibleItems]);
      break;

    case "reverse":
      reordered = [...visibleItems].reverse();
      break;

    case "sort_by_tag_order":
      reordered = reorderByTagOrder(visibleItems, action);
      break;

    default:
      reordered = visibleItems;
  }

  // Update positions
  reordered = reordered.map((item, index) => ({
    ...item,
    newPosition: index,
  }));

  // Combine with hidden items
  return [...reordered, ...hiddenItems];
}

/**
 * Move matching items to the front
 */
function reorderMoveToFront(
  items: ProcessedMediaItem[],
  action: ReorderAction
): ProcessedMediaItem[] {
  if (!action.matchType || !action.matchValues) {
    return items;
  }

  const matched: ProcessedMediaItem[] = [];
  const unmatched: ProcessedMediaItem[] = [];

  items.forEach((item) => {
    if (matchesReorderCriteria(item, action)) {
      matched.push(item);
    } else {
      unmatched.push(item);
    }
  });

  if (action.preserveRelativeOrder !== false) {
    return [...matched, ...unmatched];
  }

  return [...matched, ...unmatched];
}

/**
 * Move matching items to the back
 */
function reorderMoveToBack(
  items: ProcessedMediaItem[],
  action: ReorderAction
): ProcessedMediaItem[] {
  if (!action.matchType || !action.matchValues) {
    return items;
  }

  const matched: ProcessedMediaItem[] = [];
  const unmatched: ProcessedMediaItem[] = [];

  items.forEach((item) => {
    if (matchesReorderCriteria(item, action)) {
      matched.push(item);
    } else {
      unmatched.push(item);
    }
  });

  return [...unmatched, ...matched];
}

/**
 * Move matching items to a specific position
 */
function reorderMoveToPosition(
  items: ProcessedMediaItem[],
  action: ReorderAction
): ProcessedMediaItem[] {
  if (!action.matchType || !action.matchValues || action.position === undefined) {
    return items;
  }

  const matched: ProcessedMediaItem[] = [];
  const unmatched: ProcessedMediaItem[] = [];

  items.forEach((item) => {
    if (matchesReorderCriteria(item, action)) {
      matched.push(item);
    } else {
      unmatched.push(item);
    }
  });

  const position = Math.min(action.position, unmatched.length);
  const result = [
    ...unmatched.slice(0, position),
    ...matched,
    ...unmatched.slice(position),
  ];

  return result;
}

/**
 * Sort items by tag order
 */
function reorderByTagOrder(
  items: ProcessedMediaItem[],
  action: ReorderAction
): ProcessedMediaItem[] {
  if (!action.tagOrder || action.tagOrder.length === 0) {
    return items;
  }

  return [...items].sort((a, b) => {
    const aIndex = getTagOrderIndex(a, action.tagOrder!);
    const bIndex = getTagOrderIndex(b, action.tagOrder!);
    return aIndex - bIndex;
  });
}

function getTagOrderIndex(item: ProcessedMediaItem, tagOrder: string[]): number {
  if (!item.tags) return tagOrder.length;

  for (let i = 0; i < tagOrder.length; i++) {
    if (item.tags.some((t) => t.toLowerCase() === tagOrder[i].toLowerCase())) {
      return i;
    }
  }
  return tagOrder.length;
}

/**
 * Check if item matches reorder criteria
 */
function matchesReorderCriteria(
  item: ProcessedMediaItem,
  action: ReorderAction
): boolean {
  if (!action.matchType || !action.matchValues) return false;

  switch (action.matchType) {
    case "media_tag":
      if (!item.tags) return false;
      return action.matchValues.some((tag) =>
        item.tags!.some((t) => t.toLowerCase() === tag.toLowerCase())
      );

    case "media_type":
      return action.matchValues.includes(item.type);

    case "alt_text":
      if (!item.alt) return false;
      return action.matchValues.some((val) =>
        item.alt!.toLowerCase().includes(val.toLowerCase())
      );

    case "position":
      return action.matchValues.includes(String(item.position));

    default:
      return false;
  }
}

/**
 * Fisher-Yates shuffle
 */
function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// =============================================================================
// BADGE ACTION
// =============================================================================

/**
 * Execute badge action - add visual overlay to images
 */
function executeBadgeAction(
  action: BadgeAction,
  media: ProcessedMediaItem[],
  context: RuleEvaluationContext
): ProcessedMediaItem[] {
  // Format badge text with dynamic values
  const badgeText = formatBadgeText(action.text, {
    inventoryCount: action.dynamicValues?.inventoryCount
      ? context.inventory.totalInventory
      : undefined,
    // Could add price/discount context here
  });

  const badge: BadgeOverlay = {
    text: badgeText,
    position: action.position,
    style: action.style,
    backgroundColor: action.backgroundColor,
    textColor: action.textColor,
  };

  return media.map((item, index) => {
    // Only add badges to visible items
    if (!item.visible) return item;

    let shouldAddBadge = false;

    switch (action.target) {
      case "all":
        shouldAddBadge = true;
        break;

      case "first":
        shouldAddBadge = index === 0 || item.newPosition === 0;
        break;

      case "last":
        const visibleCount = media.filter((m) => m.visible).length;
        shouldAddBadge = index === visibleCount - 1;
        break;

      case "positions":
        if (action.targetPositions) {
          shouldAddBadge = action.targetPositions.includes(item.newPosition);
        }
        break;

      case "matched":
        if (action.matchType && action.matchValues) {
          shouldAddBadge = matchesBadgeCriteria(item, action);
        }
        break;
    }

    if (shouldAddBadge) {
      return {
        ...item,
        badges: [...item.badges, badge],
      };
    }

    return item;
  });
}

/**
 * Check if item matches badge criteria
 */
function matchesBadgeCriteria(
  item: ProcessedMediaItem,
  action: BadgeAction
): boolean {
  if (!action.matchType || !action.matchValues) return false;

  switch (action.matchType) {
    case "media_tag":
      if (!item.tags) return false;
      return action.matchValues.some((tag) =>
        item.tags!.some((t) => t.toLowerCase() === tag.toLowerCase())
      );

    case "media_type":
      return action.matchValues.includes(item.type);

    case "alt_text":
      if (!item.alt) return false;
      return action.matchValues.some((val) =>
        item.alt!.toLowerCase().includes(val.toLowerCase())
      );

    default:
      return false;
  }
}

// =============================================================================
// LIMIT ACTION
// =============================================================================

/**
 * Execute limit action - reduce total image count
 */
function executeLimitAction(
  action: LimitAction,
  media: ProcessedMediaItem[],
  context: RuleEvaluationContext
): ProcessedMediaItem[] {
  const visibleItems = media.filter((item) => item.visible);

  if (visibleItems.length <= action.maxImages) {
    return media; // No limiting needed
  }

  let itemsToKeep: ProcessedMediaItem[];

  switch (action.keep) {
    case "first":
      itemsToKeep = visibleItems.slice(0, action.maxImages);
      break;

    case "last":
      itemsToKeep = visibleItems.slice(-action.maxImages);
      break;

    case "even_distribution":
      itemsToKeep = selectEvenDistribution(visibleItems, action.maxImages);
      break;

    case "matched":
      if (action.matchType && action.matchValues) {
        const matched = visibleItems.filter((item) =>
          matchesLimitCriteria(item, action)
        );
        const unmatched = visibleItems.filter(
          (item) => !matchesLimitCriteria(item, action)
        );

        // Prioritize matched items, fill rest with unmatched
        if (matched.length >= action.maxImages) {
          itemsToKeep = matched.slice(0, action.maxImages);
        } else {
          itemsToKeep = [
            ...matched,
            ...unmatched.slice(0, action.maxImages - matched.length),
          ];
        }
      } else {
        itemsToKeep = visibleItems.slice(0, action.maxImages);
      }
      break;

    default:
      itemsToKeep = visibleItems.slice(0, action.maxImages);
  }

  // Always include first if specified
  if (action.alwaysIncludeFirst) {
    const firstItem = visibleItems[0];
    if (!itemsToKeep.includes(firstItem)) {
      itemsToKeep = [firstItem, ...itemsToKeep.slice(0, action.maxImages - 1)];
    }
  }

  const keepIds = new Set(itemsToKeep.map((item) => item.id));

  return media.map((item) => ({
    ...item,
    visible: item.visible && keepIds.has(item.id),
  }));
}

/**
 * Select items with even distribution
 */
function selectEvenDistribution(
  items: ProcessedMediaItem[],
  count: number
): ProcessedMediaItem[] {
  if (count >= items.length) return items;

  const result: ProcessedMediaItem[] = [];
  const step = items.length / count;

  for (let i = 0; i < count; i++) {
    const index = Math.floor(i * step);
    result.push(items[index]);
  }

  return result;
}

/**
 * Check if item matches limit criteria
 */
function matchesLimitCriteria(
  item: ProcessedMediaItem,
  action: LimitAction
): boolean {
  if (!action.matchType || !action.matchValues) return false;

  switch (action.matchType) {
    case "media_tag":
      if (!item.tags) return false;
      return action.matchValues.some((tag) =>
        item.tags!.some((t) => t.toLowerCase() === tag.toLowerCase())
      );

    case "media_type":
      return action.matchValues.includes(item.type);

    default:
      return false;
  }
}

// =============================================================================
// PRIORITIZE ACTION
// =============================================================================

/**
 * Execute prioritize action - boost certain images without hiding others
 */
function executePrioritizeAction(
  action: PrioritizeAction,
  media: ProcessedMediaItem[],
  context: RuleEvaluationContext
): ProcessedMediaItem[] {
  const visibleItems = media.filter((item) => item.visible);
  const hiddenItems = media.filter((item) => !item.visible);

  const matched: ProcessedMediaItem[] = [];
  const unmatched: ProcessedMediaItem[] = [];

  visibleItems.forEach((item) => {
    if (matchesPrioritizeCriteria(item, action)) {
      matched.push(item);
    } else {
      unmatched.push(item);
    }
  });

  let reordered: ProcessedMediaItem[];

  switch (action.strategy) {
    case "boost_to_front":
      reordered = [...matched, ...unmatched];
      break;

    case "boost_positions":
      const boostAmount = action.boostAmount || 1;
      reordered = boostPositions(visibleItems, matched, boostAmount);
      break;

    case "interleave":
      const ratio = action.interleaveRatio || { prioritized: 1, regular: 1 };
      reordered = interleaveItems(matched, unmatched, ratio);
      break;

    default:
      reordered = [...matched, ...unmatched];
  }

  // Update positions
  reordered = reordered.map((item, index) => ({
    ...item,
    newPosition: index,
  }));

  return [...reordered, ...hiddenItems];
}

/**
 * Check if item matches prioritize criteria
 */
function matchesPrioritizeCriteria(
  item: ProcessedMediaItem,
  action: PrioritizeAction
): boolean {
  switch (action.matchType) {
    case "media_tag":
      if (!item.tags) return false;
      return action.matchValues.some((tag) =>
        item.tags!.some((t) => t.toLowerCase() === tag.toLowerCase())
      );

    case "media_type":
      return action.matchValues.includes(item.type);

    case "variant_value":
      if (!item.variantValues) return false;
      return action.matchValues.some((val) =>
        item.variantValues!.some((v) => v.toLowerCase() === val.toLowerCase())
      );

    case "alt_text":
      if (!item.alt) return false;
      return action.matchValues.some((val) =>
        item.alt!.toLowerCase().includes(val.toLowerCase())
      );

    default:
      return false;
  }
}

/**
 * Boost matched items by N positions
 */
function boostPositions(
  allItems: ProcessedMediaItem[],
  matchedItems: ProcessedMediaItem[],
  boostAmount: number
): ProcessedMediaItem[] {
  const result = [...allItems];
  const matchedIds = new Set(matchedItems.map((item) => item.id));

  for (let i = 0; i < result.length; i++) {
    if (matchedIds.has(result[i].id)) {
      const newPosition = Math.max(0, i - boostAmount);
      if (newPosition !== i) {
        const [item] = result.splice(i, 1);
        result.splice(newPosition, 0, item);
      }
    }
  }

  return result;
}

/**
 * Interleave prioritized and regular items
 */
function interleaveItems(
  prioritized: ProcessedMediaItem[],
  regular: ProcessedMediaItem[],
  ratio: { prioritized: number; regular: number }
): ProcessedMediaItem[] {
  const result: ProcessedMediaItem[] = [];
  let pIndex = 0;
  let rIndex = 0;

  while (pIndex < prioritized.length || rIndex < regular.length) {
    // Add prioritized items
    for (let i = 0; i < ratio.prioritized && pIndex < prioritized.length; i++) {
      result.push(prioritized[pIndex++]);
    }

    // Add regular items
    for (let i = 0; i < ratio.regular && rIndex < regular.length; i++) {
      result.push(regular[rIndex++]);
    }
  }

  return result;
}

// =============================================================================
// REPLACE ACTION
// =============================================================================

/**
 * Execute replace action - swap gallery content
 * Note: Full replacement requires server-side data fetching
 * This implementation handles static URLs and append mode
 */
function executeReplaceAction(
  action: ReplaceAction,
  media: ProcessedMediaItem[],
  context: RuleEvaluationContext
): ProcessedMediaItem[] {
  if (action.source === "static_urls" && action.staticUrls) {
    const staticMedia: ProcessedMediaItem[] = action.staticUrls.map((url, index) => ({
      id: `static_${index}`,
      type: "image" as const,
      src: url.src,
      alt: url.alt || "",
      position: url.position,
      visible: true,
      newPosition: index,
      badges: [],
      appliedRuleIds: [],
    }));

    if (action.appendMode) {
      // Append static URLs to existing media
      return [
        ...media,
        ...staticMedia.map((item, index) => ({
          ...item,
          newPosition: media.length + index,
        })),
      ];
    }

    // Replace all media with static URLs
    return staticMedia;
  }

  // For other sources (metafield, collection, product_metafield),
  // the data needs to be fetched server-side and passed into context
  // This is a placeholder that keeps existing media
  console.warn(
    `[Rules] Replace action source "${action.source}" requires server-side data fetching`
  );
  return media;
}
