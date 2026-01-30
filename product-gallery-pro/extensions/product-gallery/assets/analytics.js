/**
 * Product Gallery Pro - Analytics Module (Hybrid Aggregation)
 *
 * Aggregates gallery interactions client-side during the page session,
 * then sends a single summary via fetch (keepalive) on page unload.
 * The App Proxy endpoint merges summaries into Shopify metafields (zero infra).
 */
(function () {
  "use strict";

  var ENDPOINT = "/apps/product-gallery-pro/analytics";

  var config = window.PGPAnalyticsConfig || { debug: false, enabled: true };
  var DEBUG = config.debug || location.hostname.includes("localhost") || location.search.includes("pgp_debug=1");

  function log() {
    if (DEBUG) console.log.apply(console, ["[PGP Analytics]"].concat(Array.prototype.slice.call(arguments)));
  }

  log("Initializing analytics...");

  if (config.enabled === false) {
    log("Analytics disabled via config");
    return;
  }

  // --- Helpers ---

  function getShopDomain() {
    try { if (window.Shopify && window.Shopify.shop) return window.Shopify.shop; } catch (e) {}
    if (location.hostname.includes(".myshopify.com")) return location.hostname;
    return location.hostname;
  }

  function getDeviceType() {
    var w = window.innerWidth || 1024;
    return w < 640 ? "mobile" : w < 1024 ? "tablet" : "desktop";
  }

  function getSessionId() {
    try { if (window.Shopify && window.Shopify.analytics && window.Shopify.analytics.meta && window.Shopify.analytics.meta.sessionId) return window.Shopify.analytics.meta.sessionId; } catch (e) {}
    var sid = sessionStorage.getItem("pgp_sid");
    if (!sid) {
      sid = "pgp_" + Math.random().toString(36).slice(2, 10) + Date.now();
      sessionStorage.setItem("pgp_sid", sid);
    }
    return sid;
  }

  function getProductId() {
    try { if (window.ShopifyAnalytics && window.ShopifyAnalytics.meta && window.ShopifyAnalytics.meta.product) return String(window.ShopifyAnalytics.meta.product.id); } catch (e) {}
    try {
      var meta = document.querySelector('meta[property="og:url"]');
      if (meta) { var m = meta.content.match(/\/products\/([^\/\?]+)/); if (m) return m[1]; }
    } catch (e) {}
    var m = location.pathname.match(/\/products\/([^\/\?]+)/);
    return m ? m[1] : null;
  }

  var shop = getShopDomain();
  var deviceType = getDeviceType();
  log("Shop:", shop, "Device:", deviceType);

  // --- Aggregation state (in-memory for current page) ---

  var counts = {
    gallery_view: 0,
    zoom_click: 0,
    zoom_hover: 0,
    thumbnail_click: 0,
    video_play: 0,
    slide_change: 0,
  };

  var productCounts = {};

  // --- Session-level metrics ---
  var uniqueImagesViewed = {};
  var maxSlideIndex = 0;
  var galleryActiveTime = 0;
  var lastInteractionTime = 0;
  var interactionStarted = false;

  // --- Per-image metrics ---
  var imageActiveTime = {};    // { mediaId: totalMs }
  var imageZoomed = {};        // { mediaId: true }
  var currentActiveMediaId = null;
  var currentActiveStartTime = 0;
  var MAX_ACTIVE_STRETCH_MS = 30000; // cap per stretch to avoid stale tabs

  function switchActiveImage(newMediaId) {
    var now = Date.now();
    if (currentActiveMediaId && currentActiveStartTime > 0) {
      var elapsed = Math.min(now - currentActiveStartTime, MAX_ACTIVE_STRETCH_MS);
      imageActiveTime[currentActiveMediaId] = (imageActiveTime[currentActiveMediaId] || 0) + elapsed;
    }
    currentActiveMediaId = newMediaId;
    currentActiveStartTime = newMediaId ? now : 0;
  }

  function trackActiveTime() {
    var now = Date.now();
    if (interactionStarted && lastInteractionTime > 0) {
      var gap = now - lastInteractionTime;
      if (gap < 5000) {
        galleryActiveTime += gap;
      }
    }
    lastInteractionTime = now;
    interactionStarted = true;
  }

  function trackImageView(mediaId) {
    if (mediaId) uniqueImagesViewed[mediaId] = true;
  }

  function trackSlideIndex(index) {
    var idx = parseInt(index, 10);
    if (!isNaN(idx) && idx > maxSlideIndex) maxSlideIndex = idx;
  }

  function ensureProduct(pid) {
    if (!pid) return;
    if (!productCounts[pid]) {
      productCounts[pid] = {
        gallery_view: 0, zoom_click: 0, zoom_hover: 0,
        thumbnail_click: 0, video_play: 0, slide_change: 0,
      };
    }
  }

  function record(eventType, productId) {
    if (counts[eventType] !== undefined) counts[eventType]++;
    if (productId) {
      ensureProduct(productId);
      if (productCounts[productId][eventType] !== undefined) {
        productCounts[productId][eventType]++;
      }
    }
    trackActiveTime();
    log("Recorded:", eventType, productId || "");
  }

  // --- Send summary on page unload ---

  var summarySent = false;

  function buildSummary() {
    var hasActivity = false;
    for (var k in counts) { if (counts[k] > 0) { hasActivity = true; break; } }
    if (!hasActivity) return null;

    // Flush per-image active timer
    switchActiveImage(null);

    var finalActiveTime = galleryActiveTime;
    if (lastInteractionTime > 0) {
      var sinceLastMs = Date.now() - lastInteractionTime;
      if (sinceLastMs < 5000) finalActiveTime += sinceLastMs;
    }

    var products = [];
    for (var pid in productCounts) {
      if (productCounts.hasOwnProperty(pid)) {
        var c = productCounts[pid];
        products.push({ product_id: pid, counts: { gallery_view: c.gallery_view, zoom_click: c.zoom_click, zoom_hover: c.zoom_hover, thumbnail_click: c.thumbnail_click, video_play: c.video_play, slide_change: c.slide_change } });
      }
    }

    // Build per-image metrics
    var allMediaIds = {};
    var mid;
    for (mid in uniqueImagesViewed) allMediaIds[mid] = true;
    for (mid in imageActiveTime) allMediaIds[mid] = true;
    for (mid in imageZoomed) allMediaIds[mid] = true;

    var image_metrics = [];
    for (mid in allMediaIds) {
      if (allMediaIds.hasOwnProperty(mid) && mid) {
        image_metrics.push({
          media_id: mid,
          viewed: !!uniqueImagesViewed[mid],
          zoomed: !!imageZoomed[mid],
          active_time_ms: Math.round(imageActiveTime[mid] || 0),
        });
      }
    }

    return {
      shop: shop,
      session_id: getSessionId(),
      device_type: deviceType,
      timestamp: new Date().toISOString(),
      date: new Date().toISOString().slice(0, 10),
      counts: { gallery_view: counts.gallery_view, zoom_click: counts.zoom_click, zoom_hover: counts.zoom_hover, thumbnail_click: counts.thumbnail_click, video_play: counts.video_play, slide_change: counts.slide_change },
      products: products,
      session_metrics: {
        unique_images_viewed: Object.keys(uniqueImagesViewed).length,
        max_slide_index: maxSlideIndex,
        active_time_ms: Math.round(finalActiveTime),
      },
      image_metrics: image_metrics,
    };
  }

  function sendSummary() {
    if (summarySent) return;
    summarySent = true;

    var summary = buildSummary();
    if (!summary) { log("No events to send"); return; }

    log("Sending summary:", summary);

    var payload = JSON.stringify(summary);
    var url = ENDPOINT + "?shop=" + encodeURIComponent(shop);

    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
    })
      .then(function (r) { log("Response status:", r.status); return r.text(); })
      .then(function (text) { log("Response body:", text); })
      .catch(function (e) {
        log("Fetch error:", e.message);
        if (navigator.sendBeacon) {
          navigator.sendBeacon(url, new Blob([payload], { type: "application/json" }));
        }
      });
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") sendSummary();
  });
  window.addEventListener("pagehide", sendSummary);

  var inactivityTimer;
  function resetInactivity() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(sendSummary, 5 * 60 * 1000);
  }

  // Public API
  window.ProductGalleryProAnalytics = {
    track: function (root, type, data) {
      var pid = (data && data.product_id) || (root && root.dataset && root.dataset.productId);
      record(type, pid);
      resetInactivity();
    },
    send: function (type, data) {
      record(type, (data && data.product_id) || getProductId());
      resetInactivity();
    },
  };

  // --- Auto-track product pages ---

  function initTracking() {
    if (!location.pathname.includes("/products/")) { log("Not a product page"); return; }

    var pid = getProductId();
    if (!pid) { log("No product ID"); return; }

    log("Tracking product:", pid);
    resetInactivity();

    // Track initially visible image
    var initialSlide = document.querySelector('.pgp-slide.pgp-active, .pgp-slide:first-child, .pgp-stack-item:first-child');
    if (initialSlide) {
      var initialMediaId = initialSlide.getAttribute("data-media-id");
      trackImageView(initialMediaId);
      trackSlideIndex(initialSlide.getAttribute("data-index") || "0");
      switchActiveImage(initialMediaId);
    }

    // 1. Gallery view
    var viewSent = false;
    setTimeout(function () { if (!viewSent) { viewSent = true; record("gallery_view", pid); } }, 800);

    // 2. Click tracking
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (t.matches && (t.matches('.product__media img, [data-media-id] img, .product-single__media img') || t.closest('.product__media img, [data-media-id] img'))) {
        record("zoom_click", pid); resetInactivity();
        var slide = t.closest('[data-media-id]');
        if (slide) {
          var zMediaId = slide.getAttribute("data-media-id");
          trackImageView(zMediaId);
          if (zMediaId) imageZoomed[zMediaId] = true;
        }
        return;
      }
      var thumb = t.closest && t.closest('[data-media-id], .product__media-item, .thumbnail');
      if (thumb) {
        record("thumbnail_click", pid); resetInactivity();
        var mediaId = thumb.getAttribute("data-media-id");
        if (mediaId) {
          trackImageView(mediaId);
          switchActiveImage(mediaId);
        }
        var idx = thumb.getAttribute("data-index");
        if (idx) trackSlideIndex(idx);
      }
    });

    // 3. Hover zoom
    var hoverTimeout;
    document.addEventListener("mouseover", function (e) {
      if (e.target.matches && e.target.matches('.product__media img, [data-media-id] img')) {
        hoverTimeout = setTimeout(function () {
          record("zoom_hover", pid); resetInactivity();
          var hSlide = e.target.closest('[data-media-id]');
          if (hSlide) { var hId = hSlide.getAttribute("data-media-id"); if (hId) imageZoomed[hId] = true; }
        }, 1000);
      }
    });
    document.addEventListener("mouseout", function (e) {
      if (e.target.matches && e.target.matches('.product__media img, [data-media-id] img')) clearTimeout(hoverTimeout);
    });

    // 4. Video plays
    document.addEventListener("play", function (e) {
      if (e.target.tagName === "VIDEO") { record("video_play", pid); resetInactivity(); }
    }, true);

    // 5. Swipe navigation
    var swipeStartX = 0, swipeTracked = false;
    document.addEventListener("touchstart", function (e) {
      var g = e.target.closest && e.target.closest('.product__media, .product-gallery, [data-media-id], .slider, .slideshow, .pgp-gallery');
      if (g) { swipeStartX = e.touches[0].clientX; swipeTracked = false; }
    }, { passive: true });
    document.addEventListener("touchend", function (e) {
      if (swipeTracked) return;
      var g = e.target.closest && e.target.closest('.product__media, .product-gallery, [data-media-id], .slider, .slideshow, .pgp-gallery');
      if (g && Math.abs(swipeStartX - e.changedTouches[0].clientX) > 50) {
        swipeTracked = true; record("slide_change", pid); resetInactivity();
        setTimeout(function () {
          var as = document.querySelector('.pgp-slide.pgp-active');
          if (as) {
            var swMediaId = as.getAttribute("data-media-id");
            trackImageView(swMediaId);
            trackSlideIndex(as.getAttribute("data-index") || "0");
            switchActiveImage(swMediaId);
          }
        }, 100);
      }
    }, { passive: true });

    // 6. Nav button clicks
    document.addEventListener("click", function (e) {
      var navBtn = e.target.closest && e.target.closest('.slider-button, .slideshow__button, [data-slide], .product__media-nav button, .slider-nav button, [class*="arrow"], [class*="prev"], [class*="next"], .pgp-nav');
      if (navBtn) {
        record("slide_change", pid); resetInactivity();
        setTimeout(function () {
          var as = document.querySelector('.pgp-slide.pgp-active');
          if (as) {
            var navMediaId = as.getAttribute("data-media-id");
            trackImageView(navMediaId);
            trackSlideIndex(as.getAttribute("data-index") || "0");
            switchActiveImage(navMediaId);
          }
        }, 100);
      }
    });

    log("Tracking initialized");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTracking);
  } else {
    initTracking();
  }

  log("Analytics loaded");
})();
