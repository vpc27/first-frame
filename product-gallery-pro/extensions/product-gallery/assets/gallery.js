/**
 * Product Gallery Pro - Gallery Module
 * Handles gallery navigation with swipe support
 * Automatically replaces theme's native gallery
 * Supports carousel, stack, and grid layouts
 */
(function () {
  "use strict";

  var config = window.PGPConfig || {};
  var settings = config.settings || {};

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  // Normalize GID to numeric string: "gid://shopify/MediaImage/123" -> "123"
  function numericId(id) {
    if (typeof id === "string" && id.indexOf("/") !== -1) {
      return id.split("/").pop();
    }
    return String(id);
  }

  // Build mediaId -> mapping entry lookup (keys are numeric IDs)
  function getMappingLookup() {
    var map = config.variantImageMap;
    if (!map || !map.mappings) return null;
    var lookup = {};
    for (var gid in map.mappings) {
      lookup[numericId(gid)] = map.mappings[gid];
    }
    return lookup;
  }

  // Sort an array of DOM elements by their mapping position
  function sortByPosition(elements, mappingLookup) {
    if (!mappingLookup) return elements;
    return elements.slice().sort(function (a, b) {
      var mA = mappingLookup[a.dataset.mediaId];
      var mB = mappingLookup[b.dataset.mediaId];
      var posA = mA && typeof mA.position === "number" ? mA.position : 9999;
      var posB = mB && typeof mB.position === "number" ? mB.position : 9999;
      return posA - posB;
    });
  }

  // Resolve which media IDs are allowed for a given variant ID
  // Returns { allowed: {id: true}, universalOnly: {id: true} } or null
  function resolveAllowedMedia(variantId) {
    var map = config.variantImageMap;
    if (!map || !map.mappings) return null;

    var variantLookup = config.variants || {};
    var optionValues = variantLookup[String(variantId)] || [];
    if (optionValues.length === 0) return null;

    var mapSettings = map.settings || {};
    var matchMode = mapSettings.match_mode || "any";

    var allowed = {};
    var universalOnly = {};

    for (var gid in map.mappings) {
      var m = map.mappings[gid];
      var nid = numericId(gid);

      if (m.universal) {
        allowed[nid] = true;
        universalOnly[nid] = true;
        continue;
      }

      var mv = m.variants || [];
      if (mv.length === 0) continue;

      var matched;
      if (matchMode === "all") {
        matched = optionValues.every(function (o) {
          return mv.indexOf(o) !== -1;
        });
      } else {
        matched = optionValues.some(function (o) {
          return mv.indexOf(o) !== -1;
        });
      }
      if (matched) {
        allowed[nid] = true;
      }
    }

    var hasAny = false;
    for (var k in allowed) { hasAny = true; break; }
    return hasAny ? { allowed: allowed, universalOnly: universalOnly } : null;
  }

  // ---------------------------------------------------------------------------
  // DOM Setup
  // ---------------------------------------------------------------------------

  function applySettingsToDOM(root) {
    if (!config.hasAppSettings) return;

    var s = settings;
    var currentLayout = root.dataset.layout;
    var targetLayout = s.layout;

    if (currentLayout !== targetLayout) {
      root.dataset.layout = targetLayout;
      root.className = root.className.replace(/pgp-layout-\w+/g, "pgp-layout-" + targetLayout);
    }

    root.dataset.showThumbnails = s.showThumbnails;
    root.dataset.thumbPosition = s.thumbnailPosition;
    root.dataset.enableZoom = s.enableZoom;
    root.dataset.zoomType = s.zoomType;
    root.dataset.zoomLevel = s.zoomLevel;
    root.dataset.variantFiltering = s.variantFiltering;
    root.dataset.lazyLoading = s.lazyLoading;
    root.dataset.autoplayVideo = s.autoplayVideo;
    root.dataset.enableAnalytics = s.enableAnalytics;
    root.dataset.imageFit = s.imageFit || 'auto';

    if (s.thumbnailPosition === "none" || !s.showThumbnails) {
      var thumbs = root.querySelector(".pgp-thumbnails");
      if (thumbs) thumbs.style.display = "none";
    }
  }

  function replaceNativeGallery() {
    var pgpGallery = document.querySelector(".pgp-gallery");
    if (!pgpGallery) return;

    var nativeGallery = document.querySelector("media-gallery");
    if (nativeGallery && !nativeGallery.contains(pgpGallery) && !pgpGallery.contains(nativeGallery)) {
      nativeGallery.parentNode.insertBefore(pgpGallery, nativeGallery);
      nativeGallery.style.display = "none";
    }

    document.querySelectorAll("slider-component").forEach(function (el) {
      if (!el.contains(pgpGallery) && !pgpGallery.contains(el)) {
        if (el.closest("[data-section-type='product']") || el.closest(".product") || el.closest("section.product")) {
          el.style.display = "none";
        }
      }
    });

    pgpGallery.style.display = "grid";
    pgpGallery.style.visibility = "visible";
    pgpGallery.style.opacity = "1";
  }

  // ---------------------------------------------------------------------------
  // Carousel
  // ---------------------------------------------------------------------------

  function initCarouselGallery(root) {
    // Build stable slide/thumb maps keyed by media-id (never changes)
    var slideByMediaId = {};
    var thumbByMediaId = {};
    var allSlideMediaIds = []; // original Liquid order

    Array.from(root.querySelectorAll(".pgp-slide")).forEach(function (el) {
      var mid = el.dataset.mediaId;
      slideByMediaId[mid] = el;
      allSlideMediaIds.push(mid);
    });

    var thumbContainer = root.querySelector(".pgp-thumbnails");
    if (thumbContainer) {
      Array.from(thumbContainer.querySelectorAll(".pgp-thumb")).forEach(function (el) {
        var mid = el.dataset.mediaId;
        if (mid) thumbByMediaId[mid] = el;
      });
    }

    var prevBtn = root.querySelector(".pgp-prev");
    var nextBtn = root.querySelector(".pgp-next");
    var counter = root.querySelector(".pgp-counter");
    var mainWrapper = root.querySelector(".pgp-main-wrapper");
    var mainSlider = root.querySelector("#pgp-main-slider");

    var mappingLookup = getMappingLookup();

    if (allSlideMediaIds.length === 0) return;

    // activeIds: the ordered list of media IDs currently visible
    var activeIds = allSlideMediaIds.slice();
    var current = 0;

    // ---- showSlide ----
    function showSlide(index) {
      if (activeIds.length === 0) return;

      current = ((index % activeIds.length) + activeIds.length) % activeIds.length;

      var activeMediaId = activeIds[current];

      // Determine adjacent (prev/next) IDs for preloading
      var prevId = activeIds.length > 1 ? activeIds[(current - 1 + activeIds.length) % activeIds.length] : null;
      var nextId = activeIds.length > 1 ? activeIds[(current + 1) % activeIds.length] : null;

      // Update slide visibility via inline styles (bulletproof against theme CSS)
      allSlideMediaIds.forEach(function (mid) {
        var slide = slideByMediaId[mid];
        var isActive = mid === activeMediaId;
        slide.classList.toggle("pgp-active", isActive);
        if (isActive) {
          slide.style.display = "";
          slide.style.position = "";
          // Force-load the active image if it hasn't been fetched yet.
          // removeAttribute('loading') lifts the lazy constraint so the
          // browser re-evaluates and loads the now-visible image.
          var img = slide.querySelector("img");
          if (img && img.hasAttribute("loading")) {
            img.removeAttribute("loading");
          }
        } else {
          slide.style.display = "none";
          slide.style.position = "";
        }
      });

      // Preload adjacent slides into browser cache for smooth next/prev navigation.
      // Remove lazy constraint so browser won't block future loads, and use
      // new Image() to warm the HTTP cache (since display:none slides won't trigger fetch).
      [prevId, nextId].forEach(function (mid) {
        if (!mid) return;
        var slide = slideByMediaId[mid];
        var img = slide && slide.querySelector("img");
        if (img && !img.complete) {
          if (img.hasAttribute("loading")) img.removeAttribute("loading");
          var preload = new Image();
          preload.src = img.src;
        }
      });

      // Update thumbnail visibility & active state
      // Reorder thumbs in DOM to match activeIds order
      if (thumbContainer) {
        var activeSet = {};
        activeIds.forEach(function (mid) { activeSet[mid] = true; });

        // First append active thumbs in order, then hide the rest
        activeIds.forEach(function (mid) {
          var thumb = thumbByMediaId[mid];
          if (thumb) {
            thumbContainer.appendChild(thumb);
            thumb.style.display = "";
            thumb.classList.toggle("pgp-thumb--active", mid === activeMediaId);
            thumb.setAttribute("aria-selected", mid === activeMediaId ? "true" : "false");
          }
        });

        // Hide and append non-active thumbs
        allSlideMediaIds.forEach(function (mid) {
          if (activeSet[mid]) return;
          var thumb = thumbByMediaId[mid];
          if (thumb) {
            thumbContainer.appendChild(thumb);
            thumb.style.display = "none";
            thumb.classList.remove("pgp-thumb--active");
            thumb.setAttribute("aria-selected", "false");
          }
        });
      }

      // Update counter
      if (counter) {
        counter.textContent = (current + 1) + "/" + activeIds.length;
      }

      // Show/hide nav buttons
      var multi = activeIds.length > 1;
      if (prevBtn) prevBtn.style.display = multi ? "" : "none";
      if (nextBtn) nextBtn.style.display = multi ? "" : "none";
      if (counter) counter.style.display = multi ? "" : "none";
    }

    // ---- filterByVariant ----
    function filterByVariant(variantId) {
      if (!variantId) {
        // No variant: show all, sorted by position
        activeIds = sortByPosition(
          allSlideMediaIds.map(function (mid) { return slideByMediaId[mid]; }),
          mappingLookup
        ).map(function (el) { return el.dataset.mediaId; });
      } else {
        var result = resolveAllowedMedia(variantId);

        if (result) {
          // Custom mapping path
          var mapSettings = (config.variantImageMap && config.variantImageMap.settings) || {};
          var fallback = mapSettings.fallback || "show_all";

          var filtered = allSlideMediaIds.filter(function (mid) {
            return result.allowed[mid];
          });

          // Fallback if nothing matched
          if (filtered.length === 0) {
            if (fallback === "show_all") {
              filtered = allSlideMediaIds.slice();
            } else if (fallback === "show_universal") {
              filtered = allSlideMediaIds.filter(function (mid) {
                return result.universalOnly[mid];
              });
            }
          }

          if (filtered.length === 0) {
            filtered = allSlideMediaIds.slice();
          }

          // Sort by mapping position
          activeIds = sortByPosition(
            filtered.map(function (mid) { return slideByMediaId[mid]; }),
            mappingLookup
          ).map(function (el) { return el.dataset.mediaId; });
        } else {
          // Native fallback: data-variant-id
          var filtered2 = allSlideMediaIds.filter(function (mid) {
            var slide = slideByMediaId[mid];
            var svid = slide.dataset.variantId;
            if (svid === String(variantId)) return true;
            return !svid;
          });

          if (filtered2.length === 0) {
            filtered2 = allSlideMediaIds.slice();
          }

          activeIds = filtered2;
        }
      }

      // Apply rules (badges, limits, filters) — pass all media for cross-variant support
      activeIds = evaluateAndApplyRules(root, activeIds, allSlideMediaIds, variantId);

      current = 0;
      showSlide(0);
    }

    // ---- Event listeners ----

    if (prevBtn) {
      prevBtn.onclick = function (e) {
        e.preventDefault();
        showSlide(current - 1);
      };
    }
    if (nextBtn) {
      nextBtn.onclick = function (e) {
        e.preventDefault();
        showSlide(current + 1);
      };
    }

    // Thumbnail clicks — use media-id lookup
    Object.keys(thumbByMediaId).forEach(function (mid) {
      thumbByMediaId[mid].onclick = function (e) {
        e.preventDefault();
        var idx = activeIds.indexOf(mid);
        if (idx !== -1) {
          showSlide(idx);
        }
      };
    });

    // Keyboard navigation
    root.setAttribute("tabindex", "0");
    root.onkeydown = function (e) {
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        showSlide(current - 1);
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        showSlide(current + 1);
      }
    };

    // Touch swipe
    var swipeTarget = mainWrapper || root;
    var startX = 0, startY = 0, startTime = 0;

    swipeTarget.addEventListener("touchstart", function (e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
    }, { passive: true });

    swipeTarget.addEventListener("touchend", function (e) {
      var endX = e.changedTouches[0].clientX;
      var endY = e.changedTouches[0].clientY;
      var dx = startX - endX;
      var dy = startY - endY;
      var elapsed = Date.now() - startTime;

      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) && elapsed < 500) {
        showSlide(dx > 0 ? current + 1 : current - 1);
      }
    }, { passive: true });

    // Shopify variant change listeners
    document.addEventListener("variant:changed", function (e) {
      if (e.detail && e.detail.variant) {
        filterByVariant(e.detail.variant.id);
      }
    });

    document.addEventListener("change", function (e) {
      if (e.target.matches('input[name="id"], select[name="id"]')) {
        filterByVariant(e.target.value);
      }
    });

    // ---- Initial render ----
    // Determine initial variant: URL param > selected form input > default variant
    var initVariant = new URLSearchParams(window.location.search).get("variant");
    if (!initVariant) {
      var variantInput = document.querySelector('input[name="id"], select[name="id"]');
      if (variantInput) initVariant = variantInput.value;
    }
    if (!initVariant && config.defaultVariantId) {
      initVariant = String(config.defaultVariantId);
    }

    filterByVariant(initVariant || null);
  }

  // ---------------------------------------------------------------------------
  // Stack & Grid layout converters
  // ---------------------------------------------------------------------------

  function convertToStackLayout(root) {
    var slides = root.querySelectorAll(".pgp-slide");
    if (!slides.length) return;

    var stack = document.createElement("div");
    stack.className = "pgp-stack";

    slides.forEach(function (slide, index) {
      var item = document.createElement("div");
      item.className = "pgp-stack-item";
      item.dataset.index = index;
      item.dataset.mediaId = slide.dataset.mediaId || "";
      item.dataset.mediaType = slide.dataset.mediaType || "image";

      while (slide.firstChild) {
        item.appendChild(slide.firstChild);
      }
      stack.appendChild(item);
    });

    var mainWrapper = root.querySelector(".pgp-main-wrapper");
    var thumbnails = root.querySelector(".pgp-thumbnails");
    if (mainWrapper) mainWrapper.remove();
    if (thumbnails) thumbnails.remove();

    root.appendChild(stack);

    stack.querySelectorAll("img").forEach(function (img) {
      img.style.display = "block";
    });

    // Apply rules to stack layout
    var stackIds = Array.from(stack.querySelectorAll('.pgp-stack-item')).map(function(el) { return el.dataset.mediaId; });
    var filteredIds = evaluateAndApplyRules(root, stackIds);
    // Hide items not in filteredIds
    var filteredSet = {};
    filteredIds.forEach(function(id) { filteredSet[id] = true; });
    stack.querySelectorAll('.pgp-stack-item').forEach(function(el) {
      if (!filteredSet[el.dataset.mediaId]) el.style.display = 'none';
    });
  }

  function convertToGridLayout(root) {
    var slides = root.querySelectorAll(".pgp-slide");
    if (!slides.length) return;

    var grid = document.createElement("div");
    grid.className = "pgp-grid";

    slides.forEach(function (slide, index) {
      var item = document.createElement("div");
      item.className = "pgp-grid-item";
      item.dataset.index = index;
      item.dataset.mediaId = slide.dataset.mediaId || "";
      item.dataset.mediaType = slide.dataset.mediaType || "image";

      while (slide.firstChild) {
        item.appendChild(slide.firstChild);
      }
      grid.appendChild(item);
    });

    var mainWrapper = root.querySelector(".pgp-main-wrapper");
    var thumbnails = root.querySelector(".pgp-thumbnails");
    if (mainWrapper) mainWrapper.remove();
    if (thumbnails) thumbnails.remove();

    root.appendChild(grid);

    grid.querySelectorAll("img").forEach(function (img) {
      img.style.display = "block";
    });

    // Apply rules to grid layout
    var gridIds = Array.from(grid.querySelectorAll('.pgp-grid-item')).map(function(el) { return el.dataset.mediaId; });
    var filteredIds = evaluateAndApplyRules(root, gridIds);
    var filteredSet = {};
    filteredIds.forEach(function(id) { filteredSet[id] = true; });
    grid.querySelectorAll('.pgp-grid-item').forEach(function(el) {
      if (!filteredSet[el.dataset.mediaId]) el.style.display = 'none';
    });
  }

  // ---------------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------------

  function initGallery(root) {
    var layout = settings.layout || root.dataset.layout || "carousel";

    if (layout === "carousel") {
      initCarouselGallery(root);
    } else if (layout === "stack") {
      convertToStackLayout(root);
    } else if (layout === "grid") {
      convertToGridLayout(root);
    }
  }

  // Classify images as landscape/portrait for auto image-fit mode
  function classifyImageAspectRatios(root) {
    var imageFit = root.dataset.imageFit || 'auto';
    if (imageFit !== 'auto') return;

    var images = root.querySelectorAll('img.pgp-image');
    images.forEach(function(img) {
      function classify() {
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        if (w && h) {
          if (w >= h) {
            img.classList.add('pgp-landscape');
            img.classList.remove('pgp-portrait');
          } else {
            img.classList.add('pgp-portrait');
            img.classList.remove('pgp-landscape');
          }
        }
      }
      if (img.complete && img.naturalWidth) {
        classify();
      } else {
        img.addEventListener('load', classify);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Rules Engine Integration
  // ---------------------------------------------------------------------------

  /**
   * Evaluate rules against media, supporting cross-variant injection.
   * @param {Element} root - Gallery root element
   * @param {string[]} variantFilteredIds - Media IDs after variant filtering
   * @param {string[]} [allMediaIds] - All media IDs (for cross-variant rules). Optional for non-carousel layouts.
   * @returns {string[]} - Final visible media IDs after rules
   */
  function evaluateAndApplyRules(root, variantFilteredIds, allMediaIds, currentVariantId) {
    var rulesData = config.rulesData;
    if (!rulesData || !rulesData.rules || rulesData.rules.length === 0) return variantFilteredIds;
    if (typeof window.PGPRulesEvaluator !== 'function') return variantFilteredIds;

    // Clear all existing badges first (re-evaluation on variant change)
    root.querySelectorAll('.pgp-badge-container').forEach(function(el) { el.remove(); });

    // Helper: build media item from DOM element
    function buildMediaItem(mid, idx) {
      var slide = root.querySelector('.pgp-slide[data-media-id="' + mid + '"]')
                || root.querySelector('.pgp-stack-item[data-media-id="' + mid + '"]')
                || root.querySelector('.pgp-grid-item[data-media-id="' + mid + '"]');
      if (!slide) return null;
      var img = slide.querySelector('img.pgp-image') || slide.querySelector('img');
      return {
        id: mid,
        type: slide.dataset.mediaType || 'image',
        src: img ? (img.src || img.currentSrc || '') : '',
        srcHiRes: img ? (img.dataset.highRes || '') : '',
        alt: img ? (img.alt || '') : '',
        position: idx,
        tags: (slide.dataset.tags || '').split(',').filter(Boolean),
        variantValues: (slide.dataset.variants || '').split(',').filter(Boolean),
        universal: slide.dataset.universal === 'true',
      };
    }

    // Step 1: Evaluate rules on VARIANT-FILTERED media only
    // This ensures badge/limit/reorder operate on the correct scope
    var mediaItems = [];
    variantFilteredIds.forEach(function(mid, idx) {
      var item = buildMediaItem(mid, idx);
      if (item) mediaItems.push(item);
    });

    if (mediaItems.length === 0) return variantFilteredIds;

    var evaluator = new window.PGPRulesEvaluator({
      rules: rulesData.rules,
      globalSettings: rulesData.globalSettings || {},
      legacyMapping: config.variantImageMap,
    });

    var variantLookup = config.variants || {};
    var optionValues = currentVariantId ? (variantLookup[String(currentVariantId)] || []) : [];
    var context = evaluator.buildContext({
      mediaItems: mediaItems,
      variantId: currentVariantId,
      selectedValues: optionValues,
    });
    var result = evaluator.evaluate(context);
    if (!result || !result.media) return variantFilteredIds;


    // Build visible list from rule evaluation
    var newVisibleIds = [];
    var sorted = result.media.slice().sort(function(a, b) { return a.newPosition - b.newPosition; });
    sorted.forEach(function(item) {
      if (item.visible) newVisibleIds.push(item.id);
    });

    // Cascading fallback for filter actions:
    // If a filter-include rule matched but produced zero visible images for
    // the current variant's media set, fall back to the variant-filtered
    // gallery. This prevents pulling in tagged images from other variants.
    if (newVisibleIds.length === 0 && result.matchedRules.length > 0) {
      var hadFilterAction = false;
      result.matchedRules.forEach(function(rule) {
        (rule.actions || []).forEach(function(action) {
          if (action.type === 'filter') hadFilterAction = true;
        });
      });
      if (hadFilterAction) {
        newVisibleIds = variantFilteredIds.slice();
      }
    }


    // Render badges on visible slides
    sorted.forEach(function(item) {
      if (!item.badges || item.badges.length === 0) return;
      if (!item.visible) return;

      var slide = root.querySelector('.pgp-slide[data-media-id="' + item.id + '"]')
                || root.querySelector('.pgp-stack-item[data-media-id="' + item.id + '"]')
                || root.querySelector('.pgp-grid-item[data-media-id="' + item.id + '"]');
      if (!slide) return;

      if (getComputedStyle(slide).position === 'static') {
        slide.style.position = 'relative';
      }

      item.badges.forEach(function(badge) {
        var container = document.createElement('div');
        container.className = 'pgp-badge-container pgp-badge-container--' + (badge.position || 'top-left');

        var badgeEl = document.createElement('span');
        badgeEl.className = 'pgp-badge pgp-badge--' + (badge.style || 'primary');
        badgeEl.textContent = badge.text || '';

        if (badge.backgroundColor) badgeEl.style.backgroundColor = badge.backgroundColor;
        if (badge.textColor) badgeEl.style.color = badge.textColor;

        container.appendChild(badgeEl);
        slide.appendChild(container);
      });
    });

    return newVisibleIds;
  }

  function init() {
    var galleries = document.querySelectorAll(".pgp-gallery");
    if (galleries.length > 0) {
      replaceNativeGallery();
      galleries.forEach(applySettingsToDOM);
      galleries.forEach(initGallery);
      galleries.forEach(classifyImageAspectRatios);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
