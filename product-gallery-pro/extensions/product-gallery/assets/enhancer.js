/**
 * Product Gallery Pro - Image Zoom Enhancement
 *
 * Desktop: Amazon-style hover zoom panel to the right of the image.
 * Mobile:  Tap opens fullscreen lightbox with pinch-to-zoom.
 */
(function() {
  'use strict';

  var PREFIX = '[PGP Enhancer]';
  function log() {
    var args = [PREFIX].concat(Array.prototype.slice.call(arguments));
    console.log.apply(console, args);
  }

  log('Script loaded v2 — inline zoom panel');

  var config = window.PGPConfig || {};
  var settings = config.settings || {};
  var isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  var enableZoom = (settings.enable_zoom !== undefined ? settings.enable_zoom : settings.enableZoom) !== false;
  var zoomType   = settings.zoom_type || settings.zoomType || 'both';
  var zoomLevel  = settings.zoom_level || settings.zoomLevel || 2.5;

  var enableMagnifier = enableZoom && (zoomType === 'hover' || zoomType === 'both') && !isTouch;
  var enableLightbox  = enableZoom && (zoomType === 'click' || zoomType === 'both');

  log('Config:', JSON.stringify({
    enableZoom: enableZoom, zoomType: zoomType, zoomLevel: zoomLevel,
    isTouch: isTouch, enableMagnifier: enableMagnifier, enableLightbox: enableLightbox
  }));

  if (!enableZoom) { log('Zoom disabled, exiting'); return; }

  /* ================================================================
   *  Minimal CSS — only lightbox & video lightbox.
   *  Zoom panel/lens are styled entirely via inline JS styles
   *  to avoid any CSS specificity/cache conflicts.
   * ================================================================ */
  var CSS = [
    '.pgp-lightbox{position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:999999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .25s;touch-action:none;overflow:hidden}',
    '.pgp-lightbox.pgp-open{opacity:1}',
    '.pgp-lightbox img{max-width:92vw;max-height:92vh;object-fit:contain;border-radius:6px;touch-action:none;-webkit-user-select:none;user-select:none;will-change:transform;transform-origin:center center}',
    '.pgp-lightbox-close{position:fixed;top:12px;right:12px;width:44px;height:44px;background:rgba(0,0,0,.55);border:2px solid rgba(255,255,255,.5);border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:1000002;touch-action:manipulation;-webkit-tap-highlight-color:transparent;padding:0}',
    '.pgp-lightbox-close svg{width:20px;height:20px;stroke:#fff;stroke-width:2.5;fill:none;pointer-events:none}',
    '.pgp-lightbox-hint{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,.55);font-size:12px;font-family:system-ui,sans-serif;pointer-events:none;z-index:1000002;text-align:center}',
    '.pgp-video-lightbox{position:fixed;inset:0;background:rgba(0,0,0,.95);z-index:999999;display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .25s}',
    '.pgp-video-lightbox.pgp-open{opacity:1}',
    '.pgp-video-lightbox-content{position:relative;width:90vw;max-width:1200px;aspect-ratio:16/9}',
    '.pgp-video-lightbox-content video,.pgp-video-lightbox-content iframe{width:100%;height:100%;object-fit:contain;border:none;border-radius:8px}',
    '.pgp-zoom-cursor{cursor:crosshair !important}'
  ].join('\n');

  function injectStyles() {
    if (document.getElementById('pgp-enhancer-css')) return;
    var s = document.createElement('style');
    s.id = 'pgp-enhancer-css';
    s.textContent = CSS;
    document.head.appendChild(s);
    log('Styles injected');
  }

  function highRes(src, w) {
    if (!src) return '';
    var u = src.replace(/[?&]width=\d+/g, '').replace(/(_\d+x\d*)/g, '');
    return u + (u.indexOf('?') > -1 ? '&' : '?') + 'width=' + (w || 2000);
  }

  /* ================================================================
   *  AMAZON-STYLE ZOOM PANEL  (desktop only)
   * ================================================================
   *
   *  Lens: absolutely positioned inside the slide container.
   *  Panel: fixed-position div on document.body — never clipped.
   *
   *  ALL styles are set via element.style.cssText (inline) so no
   *  external CSS rule can interfere, regardless of specificity or
   *  !important or media queries like @media(hover:none).
   */
  function setupZoomPanel(imgEl, container) {
    if (imgEl.dataset.pgpPanel === '1') return;
    imgEl.dataset.pgpPanel = '1';

    container.style.position = 'relative';

    // Create lens (inside container, overlays the image)
    var lens = document.createElement('div');
    lens.style.cssText = 'position:absolute;border:2px solid rgba(60,130,246,0.6);background:rgba(60,130,246,0.18);pointer-events:none;z-index:50;display:none;';
    container.appendChild(lens);

    // Create panel (on body, never clipped)
    var panel = document.createElement('div');
    panel.style.cssText = 'position:fixed;border:1px solid #e0e0e0;border-radius:4px;overflow:hidden;background:#fff no-repeat;z-index:99999;box-shadow:0 4px 24px rgba(0,0,0,0.15);pointer-events:none;display:none;';
    document.body.appendChild(panel);

    var hiSrc = null;
    var hiLoaded = false;

    function ensureHighRes() {
      if (hiSrc) return;
      hiSrc = highRes(imgEl.dataset.highRes || imgEl.src || imgEl.currentSrc, 2000);
      var tmp = new Image();
      tmp.onload = function() { hiLoaded = true; };
      tmp.src = hiSrc;
    }

    var _showCount = 0;
    function show(e) {
      ensureHighRes();
      if (!hiSrc) return;

      var ir = imgEl.getBoundingClientRect();
      // Skip if image is not visible (hidden slide)
      if (ir.width < 10 || ir.height < 10) return;

      var cx = e.clientX - ir.left;
      var cy = e.clientY - ir.top;

      // Mouse outside image bounds → hide
      if (cx < 0 || cy < 0 || cx > ir.width || cy > ir.height) {
        lens.style.display = 'none';
        panel.style.display = 'none';
        return;
      }

      // Lens dimensions
      var lensW = ir.width / zoomLevel;
      var lensH = ir.height / zoomLevel;
      var lx = Math.max(0, Math.min(cx - lensW / 2, ir.width - lensW));
      var ly = Math.max(0, Math.min(cy - lensH / 2, ir.height - lensH));

      // Position lens relative to container
      var cr = container.getBoundingClientRect();
      lens.style.left   = (ir.left - cr.left + lx) + 'px';
      lens.style.top    = (ir.top  - cr.top  + ly) + 'px';
      lens.style.width  = lensW + 'px';
      lens.style.height = lensH + 'px';
      lens.style.display = 'block';

      // Panel position: prefer right of image, then left, then overlay
      var pw = ir.width;
      var ph = ir.height;
      var pl = ir.right + 12;
      var pt = ir.top;

      if (pl + pw > window.innerWidth) {
        pl = ir.left - pw - 12;
      }
      if (pl < 0) {
        pl = ir.left;
      }

      // Background math
      var bgW = pw * zoomLevel;
      var bgH = ph * zoomLevel;
      var px = lx / Math.max(ir.width  - lensW, 1);
      var py = ly / Math.max(ir.height - lensH, 1);

      panel.style.left   = pl + 'px';
      panel.style.top    = pt + 'px';
      panel.style.width  = pw + 'px';
      panel.style.height = ph + 'px';
      panel.style.backgroundImage    = 'url("' + hiSrc + '")';
      panel.style.backgroundSize     = bgW + 'px ' + bgH + 'px';
      panel.style.backgroundPosition = (px * 100) + '% ' + (py * 100) + '%';
      panel.style.display = 'block';

      if (_showCount < 3) {
        _showCount++;
        log('ZOOM ACTIVE — panel at', pl + ',' + pt, pw + 'x' + ph, 'display:', panel.style.display);
      }
    }

    function hide() {
      lens.style.display = 'none';
      panel.style.display = 'none';
    }

    // Listen on the IMAGE directly (not container) so child overlays
    // don't intercept. Also listen on container for mouseenter/leave.
    imgEl.addEventListener('mousemove', show);
    container.addEventListener('mouseleave', hide);
    // Also preload on enter
    container.addEventListener('mouseenter', function() { ensureHighRes(); });

    log('  Zoom panel ready for:', imgEl.src && imgEl.src.substring(0, 60));
  }

  /* ================================================================
   *  LIGHTBOX (mobile tap-to-open, pinch-to-zoom)
   * ================================================================ */
  var _zoomLocked = false;
  var _origViewport = null;
  function _blockAll(e) { e.preventDefault(); }

  function lockNativeZoom() {
    if (_zoomLocked) return;
    _zoomLocked = true;

    // 1. Block Safari gesture events
    document.addEventListener('gesturestart',  _blockAll, { passive: false });
    document.addEventListener('gesturechange', _blockAll, { passive: false });
    document.addEventListener('gestureend',    _blockAll, { passive: false });

    // 2. Block all multi-finger touchmove on document (catches touches that
    //    start outside the overlay, e.g. one finger on page behind)
    document.addEventListener('touchmove', _blockAll, { passive: false });

    // 3. Viewport meta: set maximum-scale=1 to disable browser pinch-zoom
    //    This is the only 100% reliable method across all mobile browsers.
    var vp = document.querySelector('meta[name="viewport"]');
    if (vp) {
      _origViewport = vp.getAttribute('content');
      // Remove any existing scale/user-scalable directives, then lock to 1
      var clean = _origViewport
        .replace(/,?\s*maximum-scale\s*=\s*[\d.]+/gi, '')
        .replace(/,?\s*minimum-scale\s*=\s*[\d.]+/gi, '')
        .replace(/,?\s*user-scalable\s*=\s*\w+/gi, '');
      vp.setAttribute('content', clean + ', maximum-scale=1, user-scalable=no');
    }
  }

  function unlockNativeZoom() {
    if (!_zoomLocked) return;
    _zoomLocked = false;

    document.removeEventListener('gesturestart',  _blockAll);
    document.removeEventListener('gesturechange', _blockAll);
    document.removeEventListener('gestureend',    _blockAll);
    document.removeEventListener('touchmove',     _blockAll);

    // Restore original viewport
    if (_origViewport !== null) {
      var vp = document.querySelector('meta[name="viewport"]');
      if (vp) vp.setAttribute('content', _origViewport);
      _origViewport = null;
    }
  }

  function openLightbox(imageSrc) {
    if (!enableLightbox) return;
    var src = highRes(imageSrc, 2000);

    var overlay = document.createElement('div');
    overlay.className = 'pgp-lightbox';
    overlay.style.touchAction = 'none';

    var img = document.createElement('img');
    img.src = src;
    img.alt = 'Zoomed product image';
    img.draggable = false;

    var closeBtn = document.createElement('button');
    closeBtn.className = 'pgp-lightbox-close';
    closeBtn.setAttribute('aria-label', 'Close lightbox');
    closeBtn.innerHTML = '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    var hint = document.createElement('div');
    hint.className = 'pgp-lightbox-hint';
    hint.textContent = isTouch ? 'Pinch to zoom \u00b7 Double-tap to reset \u00b7 Tap outside to close' : 'Press Escape or click outside to close';

    overlay.appendChild(img);
    overlay.appendChild(closeBtn);
    overlay.appendChild(hint);

    var dead = false;
    function close(reason) {
      if (dead) return;
      dead = true;
      unlockNativeZoom();
      overlay.classList.remove('pgp-open');
      document.body.style.overflow = '';
      document.removeEventListener('keydown', keyHandler);
      setTimeout(function() { if (overlay.parentNode) overlay.remove(); }, 300);
    }
    function keyHandler(e) { if (e.key === 'Escape') close('escape'); }

    // Close button
    closeBtn.addEventListener('pointerup', function(e) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      close('closeBtn-pointerup');
    });
    closeBtn.addEventListener('touchend', function(e) {
      e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
      close('closeBtn-touchend');
    }, { passive: false });
    closeBtn.addEventListener('click', function(e) {
      e.stopPropagation(); e.preventDefault();
      close('closeBtn-click');
    });
    // Prevent close button touches from reaching overlay pinch logic
    closeBtn.addEventListener('touchstart', function(e) { e.stopPropagation(); }, { passive: false });
    closeBtn.addEventListener('touchmove',  function(e) { e.stopPropagation(); }, { passive: false });
    closeBtn.addEventListener('pointerdown', function(e) { e.stopPropagation(); });

    // Backdrop click close (desktop)
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) close('backdrop-click');
    });
    document.addEventListener('keydown', keyHandler);

    // ── Pinch-to-zoom + pan + double-tap — ALL on the overlay ──
    // We listen on the overlay (the common ancestor) because during a pinch
    // one finger may land on the image and the other on the backdrop.
    // e.touches gives ALL active touches regardless of target.
    var scale = 1, tx = 0, ty = 0;
    var pinching = false, panning = false;
    var pDist = 0, panX0 = 0, panY0 = 0, panTX0 = 0, panTY0 = 0;
    var firstTouchTarget = null;
    var dblTap = 0;
    var maxScale = Math.max(zoomLevel, 4);

    function xform() {
      img.style.transform = 'scale(' + scale + ') translate(' + tx + 'px,' + ty + 'px)';
    }
    function clampPan() {
      if (scale <= 1) { tx = ty = 0; return; }
      var w = img.offsetWidth || 300, h = img.offsetHeight || 300;
      var mx = w * (scale - 1) / (2 * scale);
      var my = h * (scale - 1) / (2 * scale);
      tx = Math.max(-mx, Math.min(mx, tx));
      ty = Math.max(-my, Math.min(my, ty));
    }
    function dist(a, b) {
      var dx = a.clientX - b.clientX, dy = a.clientY - b.clientY;
      return Math.sqrt(dx * dx + dy * dy);
    }

    overlay.addEventListener('touchstart', function(e) {
      // Block native gestures and stop bubbling to document-level blocker
      e.preventDefault();
      e.stopPropagation();

      if (e.touches.length === 2) {
        pinching = true; panning = false;
        pDist = dist(e.touches[0], e.touches[1]);
      } else if (e.touches.length === 1) {
        firstTouchTarget = e.target;
        // Double-tap to reset
        var now = Date.now();
        if (now - dblTap < 300) {
          scale = 1; tx = ty = 0; xform();
          dblTap = 0;
          return;
        }
        dblTap = now;
        // Start panning if zoomed in
        if (scale > 1) {
          panning = true;
          panX0 = e.touches[0].clientX; panY0 = e.touches[0].clientY;
          panTX0 = tx; panTY0 = ty;
        }
      }
    }, { passive: false });

    overlay.addEventListener('touchmove', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if (pinching && e.touches.length >= 2) {
        var d = dist(e.touches[0], e.touches[1]);
        if (pDist > 0) scale = Math.max(1, Math.min(maxScale, scale * (d / pDist)));
        pDist = d;
        clampPan(); xform();
      } else if (panning && e.touches.length === 1 && scale > 1) {
        tx = panTX0 + (e.touches[0].clientX - panX0) / scale;
        ty = panTY0 + (e.touches[0].clientY - panY0) / scale;
        clampPan(); xform();
      }
    }, { passive: false });

    overlay.addEventListener('touchend', function(e) {
      if (e.touches.length < 2) pinching = false;
      if (e.touches.length === 0) {
        panning = false;
        // Snap back if barely zoomed
        if (scale <= 1.05) { scale = 1; tx = ty = 0; xform(); }
        // Single-tap on backdrop (not image/closeBtn) → close
        if (firstTouchTarget === overlay && scale <= 1) {
          close('backdrop-tap');
        }
        firstTouchTarget = null;
      }
    }, { passive: true });

    // Mount
    lockNativeZoom();
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    void overlay.offsetWidth;
    overlay.classList.add('pgp-open');
  }

  /* ================================================================
   *  VIDEO LIGHTBOX
   * ================================================================ */
  function openVideoLightbox(videoEl) {
    var overlay = document.createElement('div');
    overlay.className = 'pgp-video-lightbox';

    var closeBtn = document.createElement('button');
    closeBtn.className = 'pgp-lightbox-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = '<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';

    var wrap = document.createElement('div');
    wrap.className = 'pgp-video-lightbox-content';

    var m;
    if (videoEl.tagName === 'VIDEO') {
      m = videoEl.cloneNode(true);
      m.autoplay = true; m.controls = true; m.playsInline = true;
      m.muted = false; m.removeAttribute('muted');
    } else if (videoEl.tagName === 'IFRAME') {
      m = document.createElement('iframe');
      var s = videoEl.src || videoEl.dataset.src || '';
      if (s.indexOf('autoplay') === -1) s += (s.indexOf('?') > -1 ? '&' : '?') + 'autoplay=1';
      m.src = s; m.allow = 'autoplay;fullscreen;encrypted-media'; m.allowFullscreen = true;
    }
    if (m) wrap.appendChild(m);
    overlay.appendChild(wrap);
    overlay.appendChild(closeBtn);

    var dead = false;
    function close(reason) {
      if (dead) return; dead = true;
      var v = overlay.querySelector('video'); if (v) { v.pause(); v.src = ''; }
      var f = overlay.querySelector('iframe'); if (f) f.src = '';
      overlay.classList.remove('pgp-open');
      document.body.style.overflow = '';
      document.removeEventListener('keydown', kh);
      setTimeout(function() { if (overlay.parentNode) overlay.remove(); }, 300);
    }
    function kh(e) { if (e.key === 'Escape') close('escape'); }

    function closeFn(e) { e.preventDefault(); e.stopPropagation(); close('video-closeBtn'); }
    closeBtn.addEventListener('pointerup', closeFn);
    closeBtn.addEventListener('touchend',  closeFn, { passive: false });
    closeBtn.addEventListener('click',     closeFn);
    closeBtn.addEventListener('touchstart', function(e) { e.stopPropagation(); }, { passive: false });

    overlay.addEventListener('click', function(e) { if (e.target === overlay) close('video-backdrop'); });
    document.addEventListener('keydown', kh);

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    void overlay.offsetWidth;
    overlay.classList.add('pgp-open');
  }

  /* ================================================================
   *  SETUP
   * ================================================================ */
  function markImage(img) {
    if (img.dataset.pgpZoom === '1') return;
    img.dataset.pgpZoom = '1';

    var parent = img.closest('.pgp-slide') || img.closest('.pgp-stack-item') || img.closest('.pgp-grid-item') || img.closest('.product__media-item') || img.parentElement;
    if (!parent) return;

    if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';

    if (enableMagnifier && !isTouch) {
      img.classList.add('pgp-zoom-cursor');
      setupZoomPanel(img, parent);
    }
  }

  function findImages() {
    var imgs = [], seen = {};
    var els = document.querySelectorAll(
      '.pgp-slide img.pgp-image,.pgp-stack-item img.pgp-image,.pgp-grid-item img.pgp-image,.pgp-gallery img.pgp-image'
    );
    for (var i = 0; i < els.length; i++) {
      var im = els[i], s = im.src || im.currentSrc || '';
      if (!s || seen[s] || im.closest('.pgp-thumb,.pgp-thumbnails')) continue;
      seen[s] = true; imgs.push(im);
    }
    return imgs;
  }

  function setupClicks() {
    if (!enableLightbox) return;

    document.addEventListener('click', function(e) {
      var t = e.target;

      if (t.closest && t.closest('.pgp-lightbox,.pgp-video-lightbox,.pgp-lightbox-close')) return;

      var vw = t.closest && t.closest('.pgp-video-wrapper');
      if (vw) {
        var ve = vw.querySelector('video') || vw.querySelector('iframe');
        if (ve && !(t.tagName === 'VIDEO' || (t.closest && t.closest('video')))) {
          e.preventDefault(); e.stopPropagation();
          openVideoLightbox(ve);
        }
        return;
      }

      var imgEl = null;
      if (t.tagName === 'IMG' && t.dataset && t.dataset.pgpZoom === '1') {
        imgEl = t;
      } else if (t.closest) {
        var sl = t.closest('.pgp-slide,.pgp-stack-item,.pgp-grid-item');
        if (sl) imgEl = sl.querySelector('img[data-pgp-zoom="1"]');
      }

      if (!imgEl) return;
      if (t.closest && t.closest('.pgp-nav,.pgp-thumb,.pgp-thumbnails,button')) return;

      // Desktop with magnifier: don't open lightbox on click
      if (enableMagnifier && !isTouch) return;

      e.preventDefault(); e.stopPropagation();
      var src = imgEl.dataset.highRes || imgEl.src || imgEl.currentSrc;
      if (src) openLightbox(src);
    }, true);
  }

  function setupVideoIcons() {
    var wrappers = document.querySelectorAll('.pgp-video-wrapper');
    wrappers.forEach(function(w) {
      if (w.querySelector('.pgp-zoom-icon')) return;
      var ic = document.createElement('div');
      ic.className = 'pgp-zoom-icon';
      ic.style.cssText = 'position:absolute;bottom:10px;right:10px;width:32px;height:32px;background:rgba(0,0,0,.55);border-radius:50%;display:flex;align-items:center;justify-content:center;opacity:1;cursor:pointer;pointer-events:auto;z-index:10';
      ic.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3"/></svg>';
      w.style.position = 'relative';
      w.appendChild(ic);
      ic.addEventListener('click', function(e) {
        e.preventDefault(); e.stopPropagation();
        var v = w.querySelector('video') || w.querySelector('iframe');
        if (v) openVideoLightbox(v);
      });
    });
  }

  /* ================================================================
   *  INIT
   * ================================================================ */
  function init() {
    if (!location.pathname.includes('/products/')) return;
    injectStyles();

    var imgs = findImages();
    if (imgs.length === 0) {
      if (!init.r) init.r = 0;
      if (init.r < 15) {
        init.r++;
        setTimeout(init, 200);
        return;
      }
      return;
    }

    imgs.forEach(markImage);
    setupClicks();
    setupVideoIcons();
    log('Ready:', imgs.length, 'images');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(init, 100); });
  } else {
    setTimeout(init, 100);
  }

  window.ProductGalleryPro = { init: init, openLightbox: openLightbox };
})();
