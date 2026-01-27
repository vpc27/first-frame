(function () {
  const PROXY_BASE = "/apps/product-gallery-pro";

  function deviceType() {
    if (typeof window === "undefined") return "desktop";
    const width = window.innerWidth || 1024;
    if (width < 640) return "mobile";
    if (width < 1024) return "tablet";
    return "desktop";
  }

  async function send(events) {
    try {
      const payload = Array.isArray(events) ? events : [events];
      const url = `${PROXY_BASE}/analytics`;
      const body = JSON.stringify(payload);

      if (navigator.sendBeacon) {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon(url, blob);
      } else {
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        });
      }
    } catch (e) {
      // swallow errors in storefront; admin can still see totals from other data
      console.warn("PGP analytics send failed", e);
    }
  }

  function buildBaseEvent(root) {
    return {
      shop_id: null,
      product_id: root.getAttribute("data-product-id") || null,
      image_id: null,
      session_id:
        (window && window.Shopify && Shopify.analytics && Shopify.analytics.meta && Shopify.analytics.meta.sessionId) ||
        `pgp_${Math.random().toString(36).slice(2, 10)}`,
      device_type: deviceType(),
    };
  }

  window.ProductGalleryProAnalytics = {
    track(root, eventType, extra) {
      if (!root) return;
      const base = buildBaseEvent(root);
      const event = {
        ...base,
        event_type: eventType,
        event_data: extra || {},
      };
      send(event);
    },
  };
})();

