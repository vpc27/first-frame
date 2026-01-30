/**
 * Product Gallery Pro - Client-Side Rules Evaluator (PGP-F2.0)
 *
 * High-performance rule evaluation engine for the storefront.
 * Performance target: <16ms for 50 rules (1 frame at 60fps)
 *
 * Features:
 * - Evaluates WHEN/THEN rules in priority order
 * - Handles AND/OR nested conditions
 * - Supports all 10 condition types
 * - Executes all 6 action types
 * - Maintains backward compatibility with legacy variant mapping
 */
(function () {
  "use strict";

  // ==========================================================================
  // RULES EVALUATOR CLASS
  // ==========================================================================

  /**
   * RulesEvaluator - Main entry point for rule-based gallery filtering
   */
  function RulesEvaluator(options) {
    this.rules = options.rules || [];
    this.globalSettings = options.globalSettings || {
      enableRules: true,
      fallbackBehavior: "default_gallery",
      maxRulesPerEvaluation: 50,
      useLegacyFallback: true,
    };
    this.productOverrides = options.productOverrides || null;
    this.legacyMapping = options.legacyMapping || null;

    // Pre-filter and sort rules by priority
    this.activeRules = this._filterActiveRules(this.rules);

    console.log("[PGP RulesEvaluator] Initialized:", {
      totalRules: this.rules.length,
      activeRules: this.activeRules.length,
      hasLegacyMapping: !!this.legacyMapping,
    });
  }

  /**
   * Filter to only active rules (respects scheduling)
   */
  RulesEvaluator.prototype._filterActiveRules = function (rules) {
    var now = new Date();
    return rules
      .filter(function (rule) {
        if (rule.status !== "active" && rule.status !== "scheduled") {
          return false;
        }
        if (rule.status === "scheduled" && rule.startDate) {
          if (new Date(rule.startDate) > now) return false;
        }
        if (rule.endDate && new Date(rule.endDate) < now) {
          return false;
        }
        return true;
      })
      .sort(function (a, b) {
        return a.priority - b.priority;
      })
      .slice(0, this.globalSettings.maxRulesPerEvaluation);
  };

  /**
   * Build evaluation context from current page state
   */
  RulesEvaluator.prototype.buildContext = function (options) {
    var config = window.PGPConfig || {};
    var selectedOptions = options.selectedOptions || {};
    var selectedValues = Object.values(selectedOptions);

    // Detect device type
    var screenWidth = window.innerWidth;
    var deviceType = "desktop";
    if (screenWidth < 768) deviceType = "mobile";
    else if (screenWidth < 1024) deviceType = "tablet";

    // Parse URL parameters
    var urlParams = new URLSearchParams(window.location.search);
    var customParams = {};
    urlParams.forEach(function (value, key) {
      customParams[key] = value;
    });

    // Get session data from localStorage/sessionStorage
    var sessionData = this._getSessionData();

    // Get persisted UTM params and referrer (survives navigation)
    var persistedUtm = this._getPersistedUtm();

    // Build media items from DOM
    var mediaItems = options.mediaItems || [];

    return {
      device: deviceType,
      screenWidth: screenWidth,
      customer: {
        isLoggedIn: config.customerContext ? config.customerContext.isLoggedIn : (!!window.__st && !!window.__st.cid),
        customerId: window.__st && window.__st.cid,
        tags: config.customerContext ? config.customerContext.tags : this._getCustomerTags(),
        orderCount: config.customerContext ? config.customerContext.orderCount : 0,
        totalSpent: config.customerContext ? config.customerContext.totalSpent : 0,
      },
      traffic: {
        path: window.location.pathname,
        referrer: persistedUtm._referrer || document.referrer,
        utmSource: persistedUtm.utm_source || null,
        utmMedium: persistedUtm.utm_medium || null,
        utmCampaign: persistedUtm.utm_campaign || null,
        utmContent: persistedUtm.utm_content || null,
        utmTerm: persistedUtm.utm_term || null,
        customParams: customParams,
      },
      session: sessionData,
      time: {
        now: new Date().toISOString(),
        dayOfWeek: new Date().getDay(),
        hour: new Date().getHours(),
      },
      geo: this._getGeoData(),
      product: {
        id: String(config.productId || ""),
        handle: window.location.pathname.split("/products/")[1] || "",
        productType: options.productType || "",
        vendor: options.vendor || "",
        tags: options.productTags || [],
        collectionIds: options.collectionIds || [],
      },
      variant: {
        id: options.variantId ? String(options.variantId) : undefined,
        selectedOptions: selectedOptions,
        selectedValues: selectedValues,
      },
      inventory: {
        totalInventory: config.inventoryContext ? config.inventoryContext.totalInventory : (options.totalInventory || 0),
        variantInventory: config.inventoryContext ? config.inventoryContext.variantInventory : (options.variantInventory || {}),
        inStock: config.inventoryContext ? config.inventoryContext.inStock : (options.inStock !== false),
      },
      collectionId: options.collectionId,
      media: mediaItems,
      abTestBucket: this._getABTestBucket(),
    };
  };

  /**
   * Get customer tags (from Shopify customer object if available)
   */
  RulesEvaluator.prototype._getCustomerTags = function () {
    // Shopify exposes customer data in liquid, check for global
    if (window.__st && window.__st.ctags) {
      return window.__st.ctags.split(",").map(function (t) {
        return t.trim();
      });
    }
    return [];
  };

  /**
   * Get session data from storage
   */
  RulesEvaluator.prototype._getSessionData = function () {
    var data = {
      isFirstVisit: true,
      pageViews: 1,
      duration: 0,
      viewedProductIds: [],
      viewedCollectionIds: [],
    };

    try {
      var stored = sessionStorage.getItem("pgp_session");
      if (stored) {
        var parsed = JSON.parse(stored);
        data.isFirstVisit = false;
        data.pageViews = (parsed.pageViews || 0) + 1;
        data.duration = Math.floor((Date.now() - (parsed.startTime || Date.now())) / 1000);
        data.viewedProductIds = parsed.viewedProductIds || [];
        data.viewedCollectionIds = parsed.viewedCollectionIds || [];
      }

      // Update session
      var config = window.PGPConfig || {};
      if (config.productId && data.viewedProductIds.indexOf(String(config.productId)) === -1) {
        data.viewedProductIds.push(String(config.productId));
      }

      sessionStorage.setItem(
        "pgp_session",
        JSON.stringify({
          pageViews: data.pageViews,
          startTime: stored ? JSON.parse(stored).startTime : Date.now(),
          viewedProductIds: data.viewedProductIds,
          viewedCollectionIds: data.viewedCollectionIds,
        })
      );
    } catch (e) {
      // Session storage not available
    }

    return data;
  };

  /**
   * Get persisted UTM parameters and referrer.
   * UTM params and referrer are only present on the landing page URL.
   * This method persists them in sessionStorage so rules can match
   * on subsequent page views within the same session.
   */
  RulesEvaluator.prototype._getPersistedUtm = function () {
    var urlParams = new URLSearchParams(window.location.search);
    var utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
    var fromUrl = {};
    var hasUrlUtm = false;

    utmKeys.forEach(function (key) {
      var val = urlParams.get(key);
      if (val) {
        fromUrl[key] = val;
        hasUrlUtm = true;
      }
    });

    // Capture referrer on first visit (only set on landing page)
    var referrer = document.referrer || "";

    try {
      if (hasUrlUtm) {
        // Fresh UTM in URL — persist for the session (latest attribution wins)
        var toStore = Object.assign({}, fromUrl);
        if (referrer) {
          toStore._referrer = referrer;
        }
        sessionStorage.setItem("pgp_utm", JSON.stringify(toStore));
        fromUrl._referrer = referrer;
        return fromUrl;
      }
      // No UTM in URL — read persisted values
      var stored = sessionStorage.getItem("pgp_utm");
      if (stored) {
        var parsed = JSON.parse(stored);
        // If we have a fresh referrer and no stored one, save it
        if (referrer && !parsed._referrer) {
          parsed._referrer = referrer;
          sessionStorage.setItem("pgp_utm", JSON.stringify(parsed));
        }
        return parsed;
      }
      // No stored UTM — persist referrer if present (organic/direct first visit)
      if (referrer) {
        var refOnly = { _referrer: referrer };
        sessionStorage.setItem("pgp_utm", JSON.stringify(refOnly));
        return refOnly;
      }
      return {};
    } catch (e) {
      // sessionStorage not available — fall back to URL-only values
      if (referrer) {
        fromUrl._referrer = referrer;
      }
      return fromUrl;
    }
  };

  /**
   * Get geo data (from Shopify locale/country if available)
   *
   * LIMITATION: Shopify only exposes `window.Shopify.country` on the
   * client side. Region and city are NOT available without a third-party
   * geolocation service. Rules using region/city fields will not match.
   * Only country-level geo targeting is supported.
   */
  RulesEvaluator.prototype._getGeoData = function () {
    // Shopify provides country in Shopify object
    if (window.Shopify && window.Shopify.country) {
      return {
        country: window.Shopify.country,
      };
    }
    return {};
  };

  /**
   * Get A/B test bucket (0-99) - persistent per visitor
   */
  RulesEvaluator.prototype._getABTestBucket = function () {
    var bucket;
    try {
      bucket = localStorage.getItem("pgp_ab_bucket");
      if (bucket === null) {
        bucket = Math.floor(Math.random() * 100);
        localStorage.setItem("pgp_ab_bucket", String(bucket));
      } else {
        bucket = parseInt(bucket, 10);
      }
    } catch (e) {
      bucket = Math.floor(Math.random() * 100);
    }
    return bucket;
  };

  /**
   * Evaluate all rules and return result
   */
  RulesEvaluator.prototype.evaluate = function (context) {
    var startTime = performance.now();
    var self = this;

    // Initialize processed media
    var processedMedia = context.media.map(function (item, index) {
      return {
        id: item.id,
        type: item.type,
        src: item.src,
        srcHiRes: item.srcHiRes,
        alt: item.alt,
        position: item.position,
        tags: item.tags || [],
        variantValues: item.variantValues || [],
        universal: item.universal || false,
        visible: true,
        newPosition: index,
        badges: [],
        appliedRuleIds: [],
      };
    });

    var matchedRules = [];
    var rulesEvaluated = 0;

    // Check if rules engine is enabled
    if (!this.globalSettings.enableRules) {
      return {
        media: processedMedia,
        matchedRules: [],
        evaluationTimeMs: performance.now() - startTime,
        usedLegacyFallback: this.globalSettings.useLegacyFallback,
      };
    }

    // Evaluate each active rule
    for (var i = 0; i < this.activeRules.length; i++) {
      var rule = this.activeRules[i];
      rulesEvaluated++;

      // Check scope
      if (!this._matchesScope(rule, context)) continue;

      // Evaluate conditions
      var matched = this._evaluateConditionGroup(rule.conditions, context);

      if (matched) {
        matchedRules.push(rule);

        // Execute actions sorted by type for correct resolution order:
        // filter → reorder/prioritize → badge → limit
        var ACTION_ORDER = { filter: 0, reorder: 1, prioritize: 2, badge: 3, limit: 4 };
        var sortedActions = rule.actions.slice().sort(function(a, b) {
          return (ACTION_ORDER[a.type] || 99) - (ACTION_ORDER[b.type] || 99);
        });
        for (var j = 0; j < sortedActions.length; j++) {
          processedMedia = this._executeAction(sortedActions[j], processedMedia, context);
        }

        // Track applied rule
        processedMedia.forEach(function (item) {
          if (item.visible && item.appliedRuleIds.indexOf(rule.id) === -1) {
            item.appliedRuleIds.push(rule.id);
          }
        });

        // Stop processing if flag is set
        if (rule.stopProcessing) break;
      }
    }

    // Apply fallback if no rules matched
    if (matchedRules.length === 0) {
      if (this.globalSettings.useLegacyFallback && this.legacyMapping) {
        processedMedia = this._applyLegacyMapping(processedMedia, context);
      } else if (this.globalSettings.fallbackBehavior === "show_none") {
        processedMedia = processedMedia.map(function (item) {
          return Object.assign({}, item, { visible: false });
        });
      }
    }

    // Renumber positions
    var visibleIndex = 0;
    processedMedia = processedMedia.map(function (item) {
      return Object.assign({}, item, {
        newPosition: item.visible ? visibleIndex++ : -1,
      });
    });

    // Sort by position
    processedMedia.sort(function (a, b) {
      if (!a.visible && !b.visible) return 0;
      if (!a.visible) return 1;
      if (!b.visible) return -1;
      return a.newPosition - b.newPosition;
    });

    return {
      media: processedMedia,
      matchedRules: matchedRules,
      evaluationTimeMs: performance.now() - startTime,
      usedLegacyFallback: matchedRules.length === 0 && this.globalSettings.useLegacyFallback,
    };
  };

  /**
   * Check if rule scope matches context
   */
  RulesEvaluator.prototype._matchesScope = function (rule, context) {
    if (rule.scope === "shop") { /* pass */ }
    else if (rule.scope === "collection") {
      if (rule.scopeId && context.collectionId !== rule.scopeId) return false;
    } else if (rule.scope === "product") {
      if (rule.scopeId && context.product.id !== rule.scopeId) return false;
    }

    // Check productScope include/exclude
    if (rule.productScope && rule.productScope.mode !== "all") {
      var pid = this._normalizeProductId(context.product.id);
      var scopeProducts = rule.productScope.products || [];
      var found = false;
      for (var i = 0; i < scopeProducts.length; i++) {
        if (this._normalizeProductId(scopeProducts[i].id) === pid) {
          found = true;
          break;
        }
      }
      if (rule.productScope.mode === "include") return found;
      if (rule.productScope.mode === "exclude") return !found;
    }

    return true;
  };

  /**
   * Normalize a product ID to its numeric form for comparison.
   * Handles both "gid://shopify/Product/12345" and plain "12345".
   */
  RulesEvaluator.prototype._normalizeProductId = function (id) {
    var str = String(id);
    var match = str.match(/(\d+)$/);
    return match ? match[1] : str;
  };

  /**
   * Evaluate a condition group (AND/OR logic)
   */
  RulesEvaluator.prototype._evaluateConditionGroup = function (group, context) {
    if (!group.conditions || group.conditions.length === 0) {
      return true;
    }

    var self = this;
    var results = [];

    for (var i = 0; i < group.conditions.length; i++) {
      var condition = group.conditions[i];
      var result;

      if (condition.operator && condition.conditions) {
        // Nested group
        result = this._evaluateConditionGroup(condition, context);
      } else {
        // Single condition
        result = this._evaluateCondition(condition, context);
        if (condition.negate) result = !result;
      }

      results.push(result);

      // Short-circuit
      if (group.operator === "AND" && !result) return false;
      if (group.operator === "OR" && result) return true;
    }

    return group.operator === "AND"
      ? results.every(function (r) { return r; })
      : results.some(function (r) { return r; });
  };

  /**
   * Evaluate a single condition
   */
  RulesEvaluator.prototype._evaluateCondition = function (condition, context) {
    switch (condition.type) {
      case "variant":
        return this._evalVariant(condition, context);
      case "url":
        return this._evalUrl(condition, context);
      case "device":
        return this._evalDevice(condition, context);
      case "customer":
        return this._evalCustomer(condition, context);
      case "time":
        return this._evalTime(condition, context);
      case "geo":
        return this._evalGeo(condition, context);
      case "inventory":
        return this._evalInventory(condition, context);
      case "traffic_source":
        return this._evalTrafficSource(condition, context);
      case "session":
        return this._evalSession(condition, context);
      case "collection":
        return this._evalCollection(condition, context);
      case "product":
        return this._evalProduct(condition, context);
      case "ab_test":
        return this._evalABTest(condition, context);
      default:
        return false;
    }
  };

  // Condition evaluators
  RulesEvaluator.prototype._evalVariant = function (c, ctx) {
    var values = ctx.variant.selectedValues;
    if (!values.length) return false;
    if (c.optionName) {
      var v = ctx.variant.selectedOptions[c.optionName];
      if (!v) return false;
      return this._stringOp(c.operator, v, c.value);
    }
    for (var i = 0; i < values.length; i++) {
      if (this._stringOp(c.operator, values[i], c.value)) return true;
    }
    return false;
  };

  RulesEvaluator.prototype._evalUrl = function (c, ctx) {
    var v;
    if (c.field === "path") v = ctx.traffic.path;
    else if (c.field === "referrer") v = ctx.traffic.referrer;
    else if (c.field === "param" && c.paramName) v = ctx.traffic.customParams[c.paramName];
    if (v === undefined) return c.operator === "not_equals" || c.operator === "not_contains";
    return this._stringOp(c.operator, v, c.value);
  };

  RulesEvaluator.prototype._evalDevice = function (c, ctx) {
    if (c.field === "type") return this._stringOp(c.operator, ctx.device, c.value);
    if (c.field === "screen_width") return this._numOp(c.operator, ctx.screenWidth, c.value);
    if (c.field === "touch_enabled") {
      var touch = ctx.device === "mobile" || ctx.device === "tablet";
      return c.operator === "is_true" ? touch : !touch;
    }
    return false;
  };

  RulesEvaluator.prototype._evalCustomer = function (c, ctx) {
    if (c.field === "is_logged_in" || c.field === "has_account") {
      return c.operator === "is_true" ? ctx.customer.isLoggedIn : !ctx.customer.isLoggedIn;
    }
    if (c.field === "tags") return this._listOp(c.operator, ctx.customer.tags, c.value);
    if (c.field === "order_count") return this._numOp(c.operator, ctx.customer.orderCount || 0, c.value, c.valueEnd);
    if (c.field === "total_spent") return this._numOp(c.operator, ctx.customer.totalSpent || 0, c.value, c.valueEnd);
    return false;
  };

  RulesEvaluator.prototype._evalTime = function (c, ctx) {
    var now = new Date(ctx.time.now);
    if (c.field === "day_of_week") {
      if (Array.isArray(c.value)) return c.value.indexOf(ctx.time.dayOfWeek) !== -1;
      return this._numOp(c.operator, ctx.time.dayOfWeek, c.value);
    }
    if (c.field === "hour") return this._numOp(c.operator, ctx.time.hour, c.value, c.valueEnd);
    if (c.field === "date" || c.field === "datetime") {
      var d = new Date(c.value);
      if (c.operator === "before") return now < d;
      if (c.operator === "after") return now > d;
      if (c.operator === "between" && c.valueEnd) return now >= d && now <= new Date(c.valueEnd);
    }
    return false;
  };

  RulesEvaluator.prototype._evalGeo = function (c, ctx) {
    var v = c.field === "country" ? ctx.geo.country : ctx.geo.region;
    if (!v) return c.operator === "not_equals" || c.operator === "not_in_list";
    return this._stringOp(c.operator, v, c.value);
  };

  RulesEvaluator.prototype._evalInventory = function (c, ctx) {
    if (c.field === "in_stock") {
      return c.operator === "is_true" ? ctx.inventory.inStock : !ctx.inventory.inStock;
    }
    if (c.field === "total_quantity") {
      return this._numOp(c.operator, ctx.inventory.totalInventory, c.value, c.valueEnd);
    }
    return false;
  };

  RulesEvaluator.prototype._evalTrafficSource = function (c, ctx) {
    var v;
    if (c.field === "utm_source") v = ctx.traffic.utmSource;
    else if (c.field === "utm_medium") v = ctx.traffic.utmMedium;
    else if (c.field === "utm_campaign") v = ctx.traffic.utmCampaign;
    else if (c.field === "utm_content") v = ctx.traffic.utmContent;
    else if (c.field === "utm_term") v = ctx.traffic.utmTerm;
    else if (c.field === "referrer") v = ctx.traffic.referrer;
    if (!v) return c.operator === "not_equals" || c.operator === "not_in_list";
    return this._stringOp(c.operator, v, c.value);
  };

  RulesEvaluator.prototype._evalSession = function (c, ctx) {
    if (c.field === "is_first_visit") {
      return c.operator === "is_true" ? ctx.session.isFirstVisit : !ctx.session.isFirstVisit;
    }
    if (c.field === "page_views") return this._numOp(c.operator, ctx.session.pageViews, c.value);
    return false;
  };

  RulesEvaluator.prototype._evalCollection = function (c, ctx) {
    if (!ctx.collectionId) return c.operator === "not_equals";
    return this._stringOp(c.operator, ctx.collectionId, c.value);
  };

  RulesEvaluator.prototype._evalProduct = function (c, ctx) {
    if (c.field === "tags") return this._listOp(c.operator, ctx.product.tags, c.value);
    var v = ctx.product[c.field];
    if (!v) return c.operator === "not_equals";
    return this._stringOp(c.operator, v, c.value);
  };

  RulesEvaluator.prototype._evalABTest = function (c, ctx) {
    return ctx.abTestBucket >= c.bucketMin && ctx.abTestBucket <= c.bucketMax;
  };

  // Operator helpers
  RulesEvaluator.prototype._stringOp = function (op, actual, expected) {
    var a = String(actual).toLowerCase();
    var vals = Array.isArray(expected) ? expected : [expected];
    vals = vals.map(function (v) { return String(v).toLowerCase(); });

    if (op === "equals" || op === "in_list") return vals.indexOf(a) !== -1;
    if (op === "not_equals" || op === "not_in_list") return vals.indexOf(a) === -1;
    if (op === "contains") return vals.some(function (v) { return a.indexOf(v) !== -1; });
    if (op === "not_contains") return !vals.some(function (v) { return a.indexOf(v) !== -1; });
    if (op === "starts_with") return vals.some(function (v) { return a.indexOf(v) === 0; });
    if (op === "ends_with") return vals.some(function (v) { return a.slice(-v.length) === v; });
    return false;
  };

  RulesEvaluator.prototype._numOp = function (op, actual, expected, expectedEnd) {
    if (op === "equals") return actual === expected;
    if (op === "not_equals") return actual !== expected;
    if (op === "greater_than") return actual > expected;
    if (op === "greater_than_or_equals") return actual >= expected;
    if (op === "less_than") return actual < expected;
    if (op === "less_than_or_equals") return actual <= expected;
    if (op === "between" && expectedEnd !== undefined) return actual >= expected && actual <= expectedEnd;
    return false;
  };

  RulesEvaluator.prototype._listOp = function (op, list, values) {
    var arr = list.map(function (v) { return String(v).toLowerCase(); });
    var vals = (Array.isArray(values) ? values : [values]).map(function (v) { return String(v).toLowerCase(); });

    if (op === "contains" || op === "contains_any") return vals.some(function (v) { return arr.indexOf(v) !== -1; });
    if (op === "not_contains") return !vals.some(function (v) { return arr.indexOf(v) !== -1; });
    if (op === "contains_all") return vals.every(function (v) { return arr.indexOf(v) !== -1; });
    if (op === "is_empty") return arr.length === 0;
    if (op === "is_not_empty") return arr.length > 0;
    return false;
  };

  /**
   * Execute an action on media
   */
  RulesEvaluator.prototype._executeAction = function (action, media, context) {
    switch (action.type) {
      case "filter":
        return this._execFilter(action, media, context);
      case "reorder":
        return this._execReorder(action, media, context);
      case "badge":
        return this._execBadge(action, media, context);
      case "limit":
        return this._execLimit(action, media, context);
      case "prioritize":
        return this._execPrioritize(action, media, context);
      default:
        return media;
    }
  };

  RulesEvaluator.prototype._execFilter = function (action, media, context) {
    var self = this;
    return media.map(function (item) {
      var matches = self._matchesMedia(item, action, context);
      if (action.mode === "include") {
        return Object.assign({}, item, { visible: matches });
      } else {
        return Object.assign({}, item, { visible: item.visible && !matches });
      }
    });
  };

  RulesEvaluator.prototype._execReorder = function (action, media, context) {
    var visible = media.filter(function (m) { return m.visible; });
    var hidden = media.filter(function (m) { return !m.visible; });
    var self = this;

    if (action.strategy === "shuffle") {
      for (var i = visible.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var temp = visible[i];
        visible[i] = visible[j];
        visible[j] = temp;
      }
    } else if (action.strategy === "reverse") {
      visible.reverse();
    } else if (action.strategy === "move_to_front" && action.matchValues) {
      var matched = [];
      var unmatched = [];
      visible.forEach(function (item) {
        if (self._matchesMedia(item, action, context)) matched.push(item);
        else unmatched.push(item);
      });
      visible = matched.concat(unmatched);
    } else if (action.strategy === "move_to_back" && action.matchValues) {
      var matched = [];
      var unmatched = [];
      visible.forEach(function (item) {
        if (self._matchesMedia(item, action, context)) matched.push(item);
        else unmatched.push(item);
      });
      visible = unmatched.concat(matched);
    }

    visible = visible.map(function (item, i) {
      return Object.assign({}, item, { newPosition: i });
    });

    return visible.concat(hidden);
  };

  RulesEvaluator.prototype._execBadge = function (action, media, context) {
    var self = this;
    var badge = {
      text: this._formatBadgeText(action.text, context),
      position: action.position,
      style: action.style,
      backgroundColor: action.backgroundColor,
      textColor: action.textColor,
    };

    var visibleCount = media.filter(function (m) { return m.visible; }).length;

    return media.map(function (item, index) {
      if (!item.visible) return item;

      var shouldAdd = false;
      if (action.target === "all") shouldAdd = true;
      else if (action.target === "first") shouldAdd = item.newPosition === 0;
      else if (action.target === "last") shouldAdd = item.newPosition === visibleCount - 1;
      else if (action.target === "matched") shouldAdd = self._matchesMedia(item, action, context);

      if (shouldAdd) {
        return Object.assign({}, item, { badges: item.badges.concat([badge]) });
      }
      return item;
    });
  };

  RulesEvaluator.prototype._execLimit = function (action, media, context) {
    var visible = media.filter(function (m) { return m.visible; });
    if (visible.length <= action.maxImages) return media;

    var kept;
    if (action.keep === "first") kept = visible.slice(0, action.maxImages);
    else if (action.keep === "last") kept = visible.slice(-action.maxImages);
    else kept = visible.slice(0, action.maxImages);

    if (action.alwaysIncludeFirst && kept.indexOf(visible[0]) === -1) {
      kept = [visible[0]].concat(kept.slice(0, action.maxImages - 1));
    }

    var keptIds = kept.map(function (m) { return m.id; });
    return media.map(function (item) {
      return Object.assign({}, item, { visible: item.visible && keptIds.indexOf(item.id) !== -1 });
    });
  };

  RulesEvaluator.prototype._execPrioritize = function (action, media, context) {
    var visible = media.filter(function (m) { return m.visible; });
    var hidden = media.filter(function (m) { return !m.visible; });
    var self = this;

    var matched = [];
    var unmatched = [];
    visible.forEach(function (item) {
      if (self._matchesMedia(item, action, context)) matched.push(item);
      else unmatched.push(item);
    });

    var reordered = matched.concat(unmatched).map(function (item, i) {
      return Object.assign({}, item, { newPosition: i });
    });

    return reordered.concat(hidden);
  };

  RulesEvaluator.prototype._matchesMedia = function (item, action, context) {
    var matchType = action.matchType;
    var matchValues = action.matchValues || [];

    if (matchType === "media_tag") {
      return matchValues.some(function (v) {
        return item.tags.some(function (t) { return t.toLowerCase() === v.toLowerCase(); });
      });
    }
    if (matchType === "variant_value") {
      if (item.variantValues.length === 0) {
        // Match against selected variant
        return matchValues.some(function (v) {
          return context.variant.selectedValues.some(function (sv) {
            return sv.toLowerCase() === v.toLowerCase();
          });
        });
      }
      return matchValues.some(function (v) {
        return item.variantValues.some(function (vv) { return vv.toLowerCase() === v.toLowerCase(); });
      });
    }
    if (matchType === "media_type") {
      return matchValues.indexOf(item.type) !== -1;
    }
    if (matchType === "alt_text" && item.alt) {
      return matchValues.some(function (v) {
        return item.alt.toLowerCase().indexOf(v.toLowerCase()) !== -1;
      });
    }
    if (matchType === "universal") {
      return item.universal === true;
    }
    return false;
  };

  RulesEvaluator.prototype._formatBadgeText = function (text, context) {
    return text
      .replace(/\{\{count\}\}/gi, String(context.inventory.totalInventory))
      .replace(/\{\{price\}\}/gi, "");
  };

  /**
   * Apply legacy variant mapping as fallback
   */
  RulesEvaluator.prototype._applyLegacyMapping = function (media, context) {
    var mapping = this.legacyMapping;
    if (!mapping || !mapping.mappings) return media;

    var selectedValues = context.variant.selectedValues;
    if (!selectedValues.length) return media;

    var self = this;
    return media.map(function (item) {
      // Normalize ID for lookup
      var numericId = item.id.match(/\/(\d+)$/) ? item.id.match(/\/(\d+)$/)[1] : item.id;
      var m = mapping.mappings[numericId] || mapping.mappings[item.id];

      if (m && m.universal) return item;

      if (!m || !m.variants || m.variants.length === 0) {
        // Check if any other media is mapped to these values
        var hasMapped = Object.keys(mapping.mappings).some(function (key) {
          var mm = mapping.mappings[key];
          if (mm.universal) return false;
          return mm.variants && selectedValues.some(function (sv) {
            return mm.variants.indexOf(sv) !== -1;
          });
        });
        if (hasMapped) return Object.assign({}, item, { visible: false });
        return item;
      }

      var matchMode = mapping.settings && mapping.settings.match_mode || "any";
      var matches;
      if (matchMode === "all") {
        matches = selectedValues.every(function (sv) { return m.variants.indexOf(sv) !== -1; });
      } else {
        matches = selectedValues.some(function (sv) { return m.variants.indexOf(sv) !== -1; });
      }

      return Object.assign({}, item, { visible: matches });
    });
  };

  /**
   * Get visible media IDs in order
   */
  RulesEvaluator.prototype.getVisibleMediaIds = function (result) {
    return result.media
      .filter(function (m) { return m.visible; })
      .map(function (m) { return m.id; });
  };

  // Export to window
  window.PGPRulesEvaluator = RulesEvaluator;
})();
