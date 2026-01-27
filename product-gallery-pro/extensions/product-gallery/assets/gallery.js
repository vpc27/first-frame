(function () {
  function initGallery(root) {
    const settingsAttr = root.getAttribute("data-settings") || "{}";
    let settings;
    try {
      settings = JSON.parse(settingsAttr);
    } catch {
      settings = {};
    }

    const slides = Array.from(root.querySelectorAll(".pgp-slide"));
    const thumbs = Array.from(root.querySelectorAll(".pgp-thumb"));
    const prev = root.querySelector(".pgp-prev");
    const next = root.querySelector(".pgp-next");

    if (!slides.length) return;

    let index = 0;

    function showSlide(i) {
      index = (i + slides.length) % slides.length;
      slides.forEach((slide, idx) => {
        slide.classList.toggle("pgp-active", idx === index);
      });
      thumbs.forEach((thumb, idx) => {
        thumb.classList.toggle("pgp-thumb--active", idx === index);
      });
    }

    if (prev) {
      prev.addEventListener("click", () => {
        showSlide(index - 1);
        if (window.ProductGalleryProAnalytics) {
          window.ProductGalleryProAnalytics.track(root, "slide_change", {
            index,
            direction: "prev",
          });
        }
      });
    }

    if (next) {
      next.addEventListener("click", () => {
        showSlide(index + 1);
        if (window.ProductGalleryProAnalytics) {
          window.ProductGalleryProAnalytics.track(root, "slide_change", {
            index,
            direction: "next",
          });
        }
      });
    }

    thumbs.forEach((thumb, idx) => {
      thumb.addEventListener("click", () => {
        showSlide(idx);
        if (window.ProductGalleryProAnalytics) {
          window.ProductGalleryProAnalytics.track(root, "thumbnail_click", {
            index: idx,
          });
        }
      });
    });

    // Basic view + zoom tracking
    if (window.ProductGalleryProAnalytics) {
      window.ProductGalleryProAnalytics.track(root, "gallery_view", {
        layout: settings.layout,
        thumbnail_position: settings.thumbnail_position,
      });
    }

    if (settings.enable_zoom && settings.zoom_type !== "hover") {
      slides.forEach((slide) => {
        const img = slide.querySelector("img");
        if (!img) return;
        img.addEventListener("click", () => {
          if (window.ProductGalleryProAnalytics) {
            window.ProductGalleryProAnalytics.track(root, "zoom_click", {});
          }
        });
      });
    } else if (settings.enable_zoom && settings.zoom_type !== "click") {
      slides.forEach((slide) => {
        const img = slide.querySelector("img");
        if (!img) return;
        img.addEventListener("mouseenter", () => {
          if (window.ProductGalleryProAnalytics) {
            window.ProductGalleryProAnalytics.track(root, "zoom_hover", {});
          }
        });
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    const galleries = Array.from(
      document.querySelectorAll(".pgp-gallery"),
    );
    galleries.forEach(initGallery);
  });
})();

