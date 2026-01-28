/**
 * Product Gallery Pro - Image Zoom Enhancement
 * Adds lightbox zoom and hover magnifier to product images
 * Respects settings: enableZoom, zoomType (hover/click/both), zoomLevel
 */
(function() {
  'use strict';

  var config = window.PGPConfig || {};
  var settings = config.settings || {};
  var debug = config.debug;
  var isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  console.log('[PGP Zoom] Settings from config:', settings);

  // Check if zoom is enabled - use parsed settings from metafield
  var enableZoom = settings.enableZoom !== false; // Default true
  var zoomType = settings.zoomType || 'both'; // hover, click, or both
  var zoomLevel = settings.zoomLevel || 2.5;

  console.log('[PGP Zoom] Effective settings - enableZoom:', enableZoom, 'zoomType:', zoomType, 'zoomLevel:', zoomLevel);

  // Determine which features are active
  var enableMagnifier = enableZoom && (zoomType === 'hover' || zoomType === 'both') && !isTouch;
  var enableLightbox = enableZoom && (zoomType === 'click' || zoomType === 'both');

  function log() {
    if (debug) console.log.apply(console, ['[PGP Zoom]'].concat([].slice.call(arguments)));
  }

  log('Settings:', { enableZoom: enableZoom, zoomType: zoomType, zoomLevel: zoomLevel });
  log('Features:', { magnifier: enableMagnifier, lightbox: enableLightbox });

  if (!enableZoom) {
    console.log('[PGP] Zoom disabled by settings');
    return;
  }

  // CSS Styles
  var styles = '\
    .pgp-lightbox{position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:999999;display:flex;align-items:center;justify-content:center;opacity:0;visibility:hidden;transition:opacity .3s,visibility .3s}\
    .pgp-lightbox.active{opacity:1;visibility:visible}\
    .pgp-lightbox-content{position:relative;max-width:95vw;max-height:95vh}\
    .pgp-lightbox img{max-width:90vw;max-height:90vh;object-fit:contain;border-radius:8px;box-shadow:0 8px 32px rgba(0,0,0,.5)}\
    .pgp-lightbox-close{position:absolute;top:-40px;right:0;width:36px;height:36px;background:rgba(255,255,255,.15);border:none;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s}\
    .pgp-lightbox-close:hover{background:rgba(255,255,255,.25);transform:scale(1.1)}\
    .pgp-lightbox-close svg{width:20px;height:20px;stroke:#fff;stroke-width:2}\
    .pgp-lightbox-hint{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,.6);font-size:13px;font-family:system-ui,-apple-system,sans-serif}\
    .pgp-zoom-cursor{cursor:zoom-in !important}\
    .pgp-zoom-icon{position:absolute;bottom:12px;right:12px;width:36px;height:36px;background:rgba(0,0,0,.6);border-radius:50%;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:0;transition:opacity .2s;backdrop-filter:blur(4px)}\
    .pgp-zoom-icon svg{width:18px;height:18px;stroke:#fff;stroke-width:2}\
    .pgp-slide:hover .pgp-zoom-icon{opacity:1}\
    .pgp-magnifier{position:absolute;width:160px;height:160px;border:3px solid #fff;border-radius:50%;box-shadow:0 4px 20px rgba(0,0,0,.4);pointer-events:none;opacity:0;visibility:hidden;transition:opacity .15s;background-repeat:no-repeat;z-index:100;transform:translate(-50%,-50%)}\
    .pgp-magnifier.active{opacity:1;visibility:visible}\
    @media(hover:none){.pgp-zoom-icon{opacity:1}.pgp-magnifier{display:none !important}}\
  ';

  // Inject styles once
  function injectStyles() {
    if (document.getElementById('pgp-zoom-styles')) return;
    var style = document.createElement('style');
    style.id = 'pgp-zoom-styles';
    style.textContent = styles;
    document.head.appendChild(style);
  }

  // Get high-resolution image URL
  function getHighResUrl(src, width) {
    if (!src) return '';
    // Handle Shopify CDN URLs
    var url = src.replace(/[?&]width=\d+/g, '').replace(/(_\d+x\d*)/g, '');
    return url + (url.indexOf('?') > -1 ? '&' : '?') + 'width=' + (width || 2000);
  }

  // Create and show lightbox
  function openLightbox(imageSrc) {
    if (!enableLightbox) return;

    log('Opening lightbox');
    var highResSrc = getHighResUrl(imageSrc, 2000);

    var lightbox = document.createElement('div');
    lightbox.className = 'pgp-lightbox';
    lightbox.innerHTML = '\
      <div class="pgp-lightbox-content">\
        <img src="' + highResSrc + '" alt="Zoomed product image">\
        <button class="pgp-lightbox-close" aria-label="Close">\
          <svg viewBox="0 0 24 24" fill="none"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>\
        </button>\
      </div>\
      <div class="pgp-lightbox-hint">Click anywhere or press Escape to close</div>\
    ';

    function close() {
      lightbox.classList.remove('active');
      setTimeout(function() { lightbox.remove(); }, 300);
      document.body.style.overflow = '';
    }

    lightbox.addEventListener('click', function(e) {
      if (e.target === lightbox || e.target.closest('.pgp-lightbox-close')) {
        close();
      }
    });

    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', onKey);
      }
    });

    document.body.appendChild(lightbox);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(function() {
      lightbox.classList.add('active');
    });
  }

  // Setup magnifier for desktop hover zoom
  function setupMagnifier(img, parent) {
    if (!enableMagnifier) return;
    if (img.dataset.pgpMagnifier === '1') return;
    img.dataset.pgpMagnifier = '1';

    // Create magnifier lens
    var lens = document.createElement('div');
    lens.className = 'pgp-magnifier';
    parent.appendChild(lens);

    var highResSrc = null;
    var imgRect = null;

    // Load high-res image on first hover
    function loadHighRes() {
      if (highResSrc) return;
      var src = img.dataset.highRes || img.src || img.currentSrc || '';
      highResSrc = getHighResUrl(src, 1400);
      lens.style.backgroundImage = 'url("' + highResSrc + '")';
      log('Magnifier loaded high-res image');
    }

    parent.addEventListener('mouseenter', function() {
      loadHighRes();
      imgRect = img.getBoundingClientRect();
    });

    parent.addEventListener('mousemove', function(e) {
      if (!imgRect) imgRect = img.getBoundingClientRect();

      var x = e.clientX - imgRect.left;
      var y = e.clientY - imgRect.top;

      // Check if mouse is within image bounds
      if (x < 0 || x > imgRect.width || y < 0 || y > imgRect.height) {
        lens.classList.remove('active');
        return;
      }

      lens.classList.add('active');

      // Position lens at cursor (offset by parent position)
      var parentRect = parent.getBoundingClientRect();
      lens.style.left = (e.clientX - parentRect.left) + 'px';
      lens.style.top = (e.clientY - parentRect.top) + 'px';

      // Calculate background position for zoom effect
      var bgX = (x / imgRect.width) * 100;
      var bgY = (y / imgRect.height) * 100;
      lens.style.backgroundPosition = bgX + '% ' + bgY + '%';
      lens.style.backgroundSize = (imgRect.width * zoomLevel) + 'px auto';
    });

    parent.addEventListener('mouseleave', function() {
      lens.classList.remove('active');
      imgRect = null;
    });

    log('Magnifier initialized');
  }

  // Add zoom icon indicator
  function addZoomIcon(parent) {
    if (parent.querySelector('.pgp-zoom-icon')) return;

    var icon = document.createElement('div');
    icon.className = 'pgp-zoom-icon';
    icon.innerHTML = '<svg viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>';
    parent.appendChild(icon);
  }

  // Mark images as zoomable
  function markImageAsZoomable(img) {
    if (img.dataset.pgpZoom === '1') return;
    img.dataset.pgpZoom = '1';

    var parent = img.closest('.pgp-slide') || img.closest('.pgp-stack-item') || img.closest('.pgp-grid-item') || img.closest('.product__media-item') || img.parentElement;
    if (!parent) return;

    // Ensure parent has relative positioning
    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    // Add visual indicators
    if (enableLightbox) {
      img.classList.add('pgp-zoom-cursor');
      addZoomIcon(parent);
    }

    // Setup magnifier for desktop
    if (enableMagnifier) {
      setupMagnifier(img, parent);
    }

    log('Image marked as zoomable');
  }

  // Find all product images (supports carousel, stack, and grid layouts)
  function findProductImages() {
    var images = [];
    var seen = {};
    var selectors = [
      '.pgp-slide img.pgp-image',
      '.pgp-stack-item img.pgp-image',
      '.pgp-grid-item img.pgp-image',
      '.pgp-gallery img.pgp-image'
    ];

    var elements = document.querySelectorAll(selectors.join(','));

    for (var i = 0; i < elements.length; i++) {
      var img = elements[i];
      var src = img.src || img.currentSrc || '';

      if (!src || seen[src]) continue;
      // Skip thumbnails
      if (img.closest('.pgp-thumb, .pgp-thumbnails')) continue;

      seen[src] = true;
      images.push(img);
    }

    return images;
  }

  // Main click handler for lightbox
  function setupClickHandler() {
    if (!enableLightbox) return;

    document.addEventListener('click', function(e) {
      var target = e.target;
      var img = null;

      // Check if clicked on a zoomable image
      if (target.tagName === 'IMG' && target.dataset.pgpZoom === '1') {
        img = target;
      } else {
        var slide = target.closest('.pgp-slide');
        if (slide) {
          img = slide.querySelector('img[data-pgp-zoom="1"]');
        }
      }

      if (!img) return;

      // Don't trigger on nav buttons or thumbnails
      if (target.closest('.pgp-nav, .pgp-thumb, .pgp-thumbnails, button')) return;

      e.preventDefault();
      e.stopPropagation();

      var src = img.dataset.highRes || img.src || img.currentSrc;
      if (src) {
        openLightbox(src);
      }
    }, true);

    log('Click handler installed');
  }

  // Initialize
  function init() {
    log('Initializing zoom features...');

    if (!location.pathname.includes('/products/')) {
      log('Not a product page, skipping');
      return;
    }

    injectStyles();

    var images = findProductImages();
    log('Found', images.length, 'product images');

    if (images.length === 0) {
      if (!init.retries) init.retries = 0;
      if (init.retries < 15) {
        init.retries++;
        log('No images found, retrying...', init.retries);
        setTimeout(init, 200);
        return;
      }
      log('No product images found after retries');
      return;
    }

    images.forEach(markImageAsZoomable);
    setupClickHandler();

    var features = [];
    if (enableLightbox) features.push('click-to-zoom');
    if (enableMagnifier) features.push('hover magnifier');

    console.log('[PGP] Zoom ready:', images.length, 'images with', features.join(' + ') || 'no zoom');
  }

  // Wait for DOM and gallery
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      setTimeout(init, 100);
    });
  } else {
    setTimeout(init, 100);
  }

  // Export for external use
  window.ProductGalleryPro = { init: init, openLightbox: openLightbox };
})();
