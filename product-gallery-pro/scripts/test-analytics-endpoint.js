/**
 * Test script to verify the analytics endpoint is working
 * Run with: node scripts/test-analytics-endpoint.js
 */

const testEvent = {
  shop: "product-gallery-pro-dev.myshopify.com",
  product_id: "test-product-123",
  event_type: "gallery_view",
  event_data: { image_count: 5, source: "test-script" },
  session_id: "test-session-" + Date.now(),
  device_type: "desktop",
  timestamp: new Date().toISOString(),
};

async function testEndpoint(baseUrl) {
  const endpoint = `${baseUrl}/apps/product-gallery-pro/analytics?shop=${testEvent.shop}`;
  console.log(`Testing endpoint: ${endpoint}`);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([testEvent]),
    });

    const text = await response.text();
    console.log(`Status: ${response.status}`);
    console.log(`Response: ${text}`);

    if (response.ok) {
      console.log("✓ Endpoint is working!");
    } else {
      console.log("✗ Endpoint returned error");
    }
  } catch (error) {
    console.log(`✗ Request failed: ${error.message}`);
  }
}

// Test against local dev server
const baseUrl = process.argv[2] || "http://localhost:3000";
console.log(`\nTesting analytics endpoint at ${baseUrl}\n`);
testEndpoint(baseUrl);
