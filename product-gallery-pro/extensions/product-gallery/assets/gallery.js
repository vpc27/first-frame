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

  console.log("[PGP Gallery] Settings loaded:", settings);
  console.log("[PGP Gallery] Has app settings:", config.hasAppSettings);
  console.log("[PGP Gallery] Raw metafield:", config._rawMetafield);

  // Apply settings to DOM if they differ from Liquid defaults
  function applySettingsToDOM(root) {
    if (!config.hasAppSettings) return;

    var s = settings;
    var currentLayout = root.dataset.layout;
    var targetLayout = s.layout;

    console.log("[PGP Gallery] Current layout:", currentLayout, "Target layout:", targetLayout);

    // If layout needs to change, we need to rebuild the gallery
    if (currentLayout !== targetLayout) {
      console.log("[PGP Gallery] Layout change needed:", currentLayout, "->", targetLayout);
      root.dataset.layout = targetLayout;
      root.className = root.className.replace(/pgp-layout-\w+/g, "pgp-layout-" + targetLayout);
    }

    // Apply other settings as data attributes
    root.dataset.showThumbnails = s.showThumbnails;
    root.dataset.thumbPosition = s.thumbnailPosition;
    root.dataset.enableZoom = s.enableZoom;
    root.dataset.zoomType = s.zoomType;
    root.dataset.zoomLevel = s.zoomLevel;
    root.dataset.variantFiltering = s.variantFiltering;
    root.dataset.lazyLoading = s.lazyLoading;
    root.dataset.autoplayVideo = s.autoplayVideo;
    root.dataset.enableAnalytics = s.enableAnalytics;

    // Hide thumbnails if position is "none"
    if (s.thumbnailPosition === "none" || !s.showThumbnails) {
      var thumbs = root.querySelector(".pgp-thumbnails");
      if (thumbs) thumbs.style.display = "none";
    }
  }

  // Replace Dawn/native theme gallery with our gallery
  function replaceNativeGallery() {
    var pgpGallery = document.querySelector(".pgp-gallery");
    if (!pgpGallery) {
      console.log("[PGP Gallery] No PGP gallery found");
      return;
    }

    // Find Dawn's media-gallery
    var nativeGallery = document.querySelector("media-gallery");

    if (nativeGallery && !nativeGallery.contains(pgpGallery) && !pgpGallery.contains(nativeGallery)) {
      console.log("[PGP Gallery] Found native gallery, replacing...");

      // Insert our gallery right before Dawn's gallery
      nativeGallery.parentNode.insertBefore(pgpGallery, nativeGallery);

      // Hide Dawn's gallery completely
      nativeGallery.style.display = "none";

      console.log("[PGP Gallery] Replaced native gallery");
    }

    // Also hide any slider-component that's a product gallery
    document.querySelectorAll("slider-component").forEach(function(el) {
      if (!el.contains(pgpGallery) && !pgpGallery.contains(el)) {
        if (el.closest("[data-section-type='product']") || el.closest(".product") || el.closest("section.product")) {
          el.style.display = "none";
        }
      }
    });

    // Ensure our gallery is visible
    pgpGallery.style.display = "grid";
    pgpGallery.style.visibility = "visible";
    pgpGallery.style.opacity = "1";
  }

  function initCarouselGallery(root) {
    var allSlides = Array.from(root.querySelectorAll(".pgp-slide"));
    var thumbContainer = root.querySelector(".pgp-thumbnails");
    var allThumbs = thumbContainer ? Array.from(thumbContainer.querySelectorAll(".pgp-thumb")) : [];
    var prevBtn = root.querySelector(".pgp-prev");
    var nextBtn = root.querySelector(".pgp-next");
    var counter = root.querySelector(".pgp-counter");
    var mainWrapper = root.querySelector(".pgp-main-wrapper");

    if (!allSlides.length) {
      console.log("[PGP Gallery] No slides found for carousel");
      return;
    }

    // Active slides (may be filtered by variant)
    var slides = allSlides;
    var total = slides.length;
    var current = 0;

    console.log("[PGP Gallery] Carousel initialized:", total, "slides");

    function showSlide(index) {
      if (slides.length === 0) return;

      // Wrap around in both directions
      current = ((index % slides.length) + slides.length) % slides.length;

      // Update all slides visibility
      allSlides.forEach(function(s) {
        var isActive = s === slides[current];
        s.classList.toggle("pgp-active", isActive);
        s.style.display = isActive ? "block" : "none";
      });

      // Update thumbnails
      allThumbs.forEach(function(t) {
        var thumbIndex = parseInt(t.dataset.index, 10);
        var slideIndex = slides.indexOf(allSlides[thumbIndex]);
        var isActive = slideIndex === current;
        t.classList.toggle("pgp-thumb--active", isActive);
        t.setAttribute("aria-selected", isActive ? "true" : "false");
      });

      // Update counter
      if (counter) {
        counter.textContent = (current + 1) + "/" + slides.length;
      }

      // Show/hide nav buttons if only one slide
      if (prevBtn) prevBtn.style.display = slides.length > 1 ? "" : "none";
      if (nextBtn) nextBtn.style.display = slides.length > 1 ? "" : "none";
      if (counter) counter.style.display = slides.length > 1 ? "" : "none";
    }

    // Filter slides by variant
    function filterByVariant(variantId) {
      if (!settings.variantFiltering) return;
      if (!variantId) {
        slides = allSlides;
      } else {
        var variantSlide = null;
        slides = allSlides.filter(function(s) {
          var slideVariantId = s.dataset.variantId;
          if (slideVariantId === String(variantId)) {
            variantSlide = s;
            return true;
          }
          return !slideVariantId;
        });

        if (slides.length === 0) {
          slides = allSlides;
        }

        allThumbs.forEach(function(t) {
          var thumbIndex = parseInt(t.dataset.index, 10);
          var slideIncluded = slides.includes(allSlides[thumbIndex]);
          t.style.display = slideIncluded ? "" : "none";
        });

        if (variantSlide) {
          current = slides.indexOf(variantSlide);
        } else {
          current = 0;
        }
      }

      total = slides.length;
      showSlide(current);
      console.log("[PGP Gallery] Filtered to", slides.length, "slides for variant", variantId);
    }

    // Navigation buttons
    if (prevBtn) {
      prevBtn.onclick = function(e) {
        e.preventDefault();
        showSlide(current - 1);
      };
    }
    if (nextBtn) {
      nextBtn.onclick = function(e) {
        e.preventDefault();
        showSlide(current + 1);
      };
    }

    // Thumbnails
    allThumbs.forEach(function(thumb) {
      thumb.onclick = function(e) {
        e.preventDefault();
        var index = parseInt(thumb.dataset.index, 10);
        var slideIndex = slides.indexOf(allSlides[index]);
        if (slideIndex !== -1) {
          showSlide(slideIndex);
        }
      };
    });

    // Keyboard navigation
    root.setAttribute("tabindex", "0");
    root.onkeydown = function(e) {
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

    swipeTarget.addEventListener("touchstart", function(e) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      startTime = Date.now();
    }, { passive: true });

    swipeTarget.addEventListener("touchend", function(e) {
      var endX = e.changedTouches[0].clientX;
      var endY = e.changedTouches[0].clientY;
      var dx = startX - endX;
      var dy = startY - endY;
      var elapsed = Date.now() - startTime;

      if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) && elapsed < 500) {
        if (dx > 0) {
          showSlide(current + 1);
        } else {
          showSlide(current - 1);
        }
      }
    }, { passive: true });

    // Listen for Shopify variant changes
    if (settings.variantFiltering) {
      document.addEventListener("variant:changed", function(e) {
        if (e.detail && e.detail.variant) {
          filterByVariant(e.detail.variant.id);
        }
      });

      document.addEventListener("change", function(e) {
        if (e.target.matches('input[name="id"], select[name="id"]')) {
          filterByVariant(e.target.value);
        }
      });

      var currentVariant = new URLSearchParams(window.location.search).get("variant");
      if (currentVariant) {
        filterByVariant(currentVariant);
      }
    }

    // Initialize first slide
    showSlide(0);
  }

  function initGallery(root) {
    // Use settings from parsed metafield, fall back to data attribute, then default
    var layout = settings.layout || root.dataset.layout || "carousel";

    console.log("[PGP Gallery] Initializing with layout:", layout);

    if (layout === "carousel") {
      initCarouselGallery(root);
    } else if (layout === "stack") {
      // For stack/grid layouts with carousel HTML, convert the DOM
      convertToStackLayout(root);
      console.log("[PGP Gallery] Stack layout initialized -", root.querySelectorAll(".pgp-stack-item").length, "items");
    } else if (layout === "grid") {
      convertToGridLayout(root);
      console.log("[PGP Gallery] Grid layout initialized -", root.querySelectorAll(".pgp-grid-item").length, "items");
    }
  }

  // Convert carousel HTML to stack layout
  function convertToStackLayout(root) {
    var slides = root.querySelectorAll(".pgp-slide");
    if (!slides.length) return;

    // Create stack container
    var stack = document.createElement("div");
    stack.className = "pgp-stack";

    slides.forEach(function(slide, index) {
      var item = document.createElement("div");
      item.className = "pgp-stack-item";
      item.dataset.index = index;
      item.dataset.mediaId = slide.dataset.mediaId || "";
      item.dataset.mediaType = slide.dataset.mediaType || "image";

      // Move content from slide to stack item
      while (slide.firstChild) {
        item.appendChild(slide.firstChild);
      }
      stack.appendChild(item);
    });

    // Remove carousel elements
    var mainWrapper = root.querySelector(".pgp-main-wrapper");
    var thumbnails = root.querySelector(".pgp-thumbnails");
    if (mainWrapper) mainWrapper.remove();
    if (thumbnails) thumbnails.remove();

    // Add stack
    root.appendChild(stack);

    // Show all images (they were hidden for carousel)
    stack.querySelectorAll("img").forEach(function(img) {
      img.style.display = "block";
    });
  }

  // Convert carousel HTML to grid layout
  function convertToGridLayout(root) {
    var slides = root.querySelectorAll(".pgp-slide");
    if (!slides.length) return;

    // Create grid container
    var grid = document.createElement("div");
    grid.className = "pgp-grid";

    slides.forEach(function(slide, index) {
      var item = document.createElement("div");
      item.className = "pgp-grid-item";
      item.dataset.index = index;
      item.dataset.mediaId = slide.dataset.mediaId || "";
      item.dataset.mediaType = slide.dataset.mediaType || "image";

      // Move content from slide to grid item
      while (slide.firstChild) {
        item.appendChild(slide.firstChild);
      }
      grid.appendChild(item);
    });

    // Remove carousel elements
    var mainWrapper = root.querySelector(".pgp-main-wrapper");
    var thumbnails = root.querySelector(".pgp-thumbnails");
    if (mainWrapper) mainWrapper.remove();
    if (thumbnails) thumbnails.remove();

    // Add grid
    root.appendChild(grid);

    // Show all images (they were hidden for carousel)
    grid.querySelectorAll("img").forEach(function(img) {
      img.style.display = "block";
    });
  }

  function init() {
    var galleries = document.querySelectorAll(".pgp-gallery");
    console.log("[PGP Gallery] Found", galleries.length, "galleries");

    if (galleries.length > 0) {
      replaceNativeGallery();
      // Apply settings from metafield before initializing
      galleries.forEach(applySettingsToDOM);
      galleries.forEach(initGallery);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
