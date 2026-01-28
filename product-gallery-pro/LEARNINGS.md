# Product Gallery Pro - Development Learnings

This document captures key learnings, common mistakes, and best practices discovered during development.

---

## Table of Contents
1. [Shopify Polaris Form Components](#1-shopify-polaris-form-components)
2. [Shopify Metafields & Liquid Access](#2-shopify-metafields--liquid-access)
3. [Theme App Extensions](#3-theme-app-extensions)
4. [JavaScript in Shopify Themes](#4-javascript-in-shopify-themes)
5. [Debugging Strategies](#5-debugging-strategies)
6. [Best Practices Checklist](#6-best-practices-checklist)

---

## 1. Shopify Polaris Form Components

### The Problem
Polaris components (`ChoiceList`, `Select`, `Checkbox`, `TextField`) are **controlled React components** that don't automatically create native HTML `<input>` elements. When used inside a `<fetcher.Form>` or `<Form>`, the values are NOT submitted to the server.

### What Went Wrong
```jsx
// This looks correct but doesn't work!
<fetcher.Form method="post" action="/api/settings">
  <ChoiceList
    title="Layout"
    name="layout"  // This name prop is for accessibility, NOT form submission
    choices={[...]}
    selected={[form.layout]}
    onChange={(values) => setForm({...})}
  />
  <button type="submit">Save</button>
</fetcher.Form>
```

The form submits, but no values are sent to the server because Polaris components only update React state - they don't render `<input>` elements.

### The Solution
Add hidden inputs that sync with React state:

```jsx
<fetcher.Form method="post" action="/api/settings">
  {/* Hidden inputs for all form values */}
  <input type="hidden" name="layout" value={form.layout} />
  <input type="hidden" name="thumbnail_position" value={form.thumbnail_position} />
  <input type="hidden" name="enable_zoom" value={form.enable_zoom ? "true" : ""} />

  {/* Polaris components for UI */}
  <ChoiceList
    title="Layout"
    choices={[...]}
    selected={[form.layout]}
    onChange={(values) => setForm({...})}
  />
</fetcher.Form>
```

### Best Practice
**Always add hidden inputs when using Polaris form components with Remix forms.**

For booleans, use `value={checked ? "true" : ""}` pattern.

---

## 2. Shopify Metafields & Liquid Access

### The Problem
Metafields stored via Admin API may not be accessible in Liquid templates on the storefront.

### What Went Wrong

1. **Missing Metafield Definition**: Metafields need a definition with `storefrontAccess: PUBLIC_READ` to be accessible in Liquid.

2. **JSON Property Access in Liquid**: Even when the metafield is accessible, accessing nested JSON properties doesn't work reliably:
   ```liquid
   {% comment %} This may not work as expected {% endcomment %}
   {% assign settings = shop.metafields.my_app.settings.value %}
   {% assign layout = settings.layout %}  <!-- Often returns nil -->
   ```

3. **The `| json` filter on metafield objects**: Using `{{ metafield | json }}` on the metafield object (not `.value`) throws an error.

### The Solution

**Step 1: Create Metafield Definition with Storefront Access**
```typescript
const METAFIELD_DEFINITION_CREATE = `#graphql
  mutation MetafieldDefinitionCreate($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition { id }
      userErrors { field message }
    }
  }
`;

await admin.graphql(METAFIELD_DEFINITION_CREATE, {
  variables: {
    definition: {
      name: "Gallery Settings",
      namespace: "product_gallery_pro",
      key: "settings",
      type: "json",
      ownerType: "SHOP",
      access: {
        storefront: "PUBLIC_READ"  // Critical!
      }
    }
  }
});
```

**Step 2: Pass Raw Value to JavaScript**
Instead of parsing in Liquid, pass the raw JSON to JavaScript:

```liquid
<script>
  // Pass metafield value directly to JavaScript
  var _pgpMetafieldValue = {{ shop.metafields.product_gallery_pro.settings.value | json }};

  // Parse in JavaScript where it's reliable
  var settings = {
    layout: _pgpMetafieldValue?.layout || "carousel",
    enableZoom: _pgpMetafieldValue?.enable_zoom !== false,
    // ... etc
  };

  window.PGPConfig = { settings: settings };
</script>
```

### Best Practice
**Never rely on Liquid dot notation for JSON metafield properties. Pass the raw value to JavaScript and parse there.**

---

## 3. Theme App Extensions

### Key Learnings

1. **Block vs App Embed**: Use blocks for content that appears in specific sections (like product pages). Use app embeds for global functionality.

2. **Asset Loading Order**: Scripts with `defer` run after DOM is ready but may run before inline scripts in some scenarios.

3. **Replacing Native Theme Elements**: To replace a theme's native gallery:
   ```javascript
   function replaceNativeGallery() {
     var nativeGallery = document.querySelector("media-gallery");
     var myGallery = document.querySelector(".my-gallery");

     if (nativeGallery && myGallery) {
       nativeGallery.parentNode.insertBefore(myGallery, nativeGallery);
       nativeGallery.style.display = "none";
     }
   }
   ```

4. **Layout Flexibility**: Render one HTML structure (carousel) and convert to other layouts (grid/stack) via JavaScript for simpler Liquid templates.

### Best Practice
**Keep Liquid templates simple. Handle complex logic in JavaScript.**

---

## 4. JavaScript in Shopify Themes

### Common Pitfalls

1. **Caching**: Shopify CDN aggressively caches assets. During development, use hard refresh (Ctrl+Shift+R).

2. **Script Execution Order**: Inline scripts run immediately. External scripts with `defer` run after DOM ready.

3. **Config Object Pattern**: Use a global config object for settings:
   ```javascript
   // In Liquid (inline script)
   window.PGPConfig = {
     productId: {{ product.id | json }},
     settings: { /* parsed from metafield */ }
   };

   // In external JS file
   (function() {
     var config = window.PGPConfig || {};
     var settings = config.settings || {};
     // Use settings...
   })();
   ```

### Best Practice
**Define config in inline script, consume in external files. This ensures config is available before external scripts run.**

---

## 5. Debugging Strategies

### Effective Debugging Approach

1. **Add Strategic Console Logs**:
   ```javascript
   console.log('[PGP] Config loaded:', window.PGPConfig);
   console.log('[PGP] Settings:', settings);
   console.log('[PGP] Layout:', settings.layout);
   ```

2. **Debug Liquid Output**:
   ```liquid
   <script>
     window.PGPDebug = {
       metafieldRaw: {{ pgp_metafield | json }},
       metafieldValue: {{ pgp_metafield.value | json }},
       hasSettings: {% if pgp_metafield %}true{% else %}false{% endif %}
     };
     console.log('[PGP] Debug:', window.PGPDebug);
   </script>
   ```

3. **Server-Side Logging**:
   ```typescript
   // In API routes
   logInfo("api.settings parsed body", { shopId, body });
   ```

4. **Trace the Data Flow**:
   - User action → Form submission → API handler → Metafield storage
   - Page load → Metafield read → Liquid render → JavaScript init

### Best Practice
**When debugging, trace the entire data flow. Log at each step to identify exactly where data is lost or transformed incorrectly.**

---

## 6. Best Practices Checklist

### Before Starting Development
- [ ] Understand Shopify's metafield access model (Admin API vs Storefront API)
- [ ] Plan which data needs storefront access
- [ ] Create metafield definitions with appropriate access levels

### Form Handling (Polaris + Remix)
- [ ] Add hidden `<input>` for every Polaris form component
- [ ] Use `value={boolValue ? "true" : ""}` for boolean hidden inputs
- [ ] Parse booleans as `value === "true"` on the server

### Metafields
- [ ] Create metafield definition with `storefrontAccess: PUBLIC_READ`
- [ ] Check for existing definition before creating (idempotent)
- [ ] Pass raw JSON value to JavaScript for parsing
- [ ] Don't rely on Liquid dot notation for JSON properties

### Theme Extensions
- [ ] Use inline scripts for config, external scripts for logic
- [ ] Handle layout changes dynamically in JavaScript
- [ ] Test with hard refresh during development
- [ ] Hide native theme elements cleanly

### Debugging
- [ ] Add console logs at critical points
- [ ] Log server-side in API routes
- [ ] Check browser Network tab for actual request/response
- [ ] Verify metafield values in Shopify Admin → Settings → Custom data

---

## Quick Reference: Common Fixes

| Issue | Symptom | Fix |
|-------|---------|-----|
| Form values not saving | Settings reset on refresh | Add hidden inputs for Polaris components |
| Metafield not in Liquid | `metafield` is nil | Create definition with storefront access |
| JSON properties nil in Liquid | `settings.layout` is blank | Parse JSON in JavaScript, not Liquid |
| Old JS running | Console shows old logs | Hard refresh (Ctrl+Shift+R) |
| Boolean always true | Checkboxes always checked | Parse as `value === "true"` not `form.has()` |

---

## Architecture Decisions

### Settings Storage: Metafields vs Database

**Chosen: Metafields**

Pros:
- No custom database needed
- Data lives in Shopify (merchant's data stays with them)
- Accessible in Liquid templates (with definition)
- Survives app uninstall/reinstall

Cons:
- Limited to 512KB per metafield
- Need to handle storefront access explicitly
- JSON parsing quirks in Liquid

### Layout Rendering: Server vs Client

**Chosen: Client-side conversion**

Liquid renders carousel HTML, JavaScript converts to grid/stack as needed.

Pros:
- Simpler Liquid templates
- Single source of truth for HTML structure
- Easier to maintain

Cons:
- Brief flash of carousel before conversion (mitigated with CSS)
- More JavaScript logic

---

*Last updated: January 2025*
*Based on debugging session for Product Gallery Pro Shopify App*
