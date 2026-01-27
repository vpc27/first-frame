-- SQLite database schema for Product Gallery Pro

-- ============================================
-- SHOPS TABLE
-- Stores merchant information and settings
-- ============================================
CREATE TABLE IF NOT EXISTS shops (
  id TEXT PRIMARY KEY,                      -- Shopify shop domain (e.g., "mystore.myshopify.com")
  access_token TEXT NOT NULL,               -- Shopify access token (encrypt in production)
  scope TEXT NOT NULL,                      -- Granted OAuth scopes
  installed_at TEXT DEFAULT (datetime('now')),
  uninstalled_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- ============================================
-- SETTINGS TABLE
-- Gallery configuration per shop
-- ============================================
CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id TEXT NOT NULL UNIQUE,
  
  -- Layout settings
  layout TEXT DEFAULT 'carousel',           -- 'carousel', 'grid', 'stack'
  thumbnail_position TEXT DEFAULT 'bottom', -- 'bottom', 'left', 'right', 'none'
  thumbnail_size TEXT DEFAULT 'medium',     -- 'small', 'medium', 'large'
  
  -- Zoom settings
  enable_zoom INTEGER DEFAULT 1,            -- Boolean: 0 or 1
  zoom_type TEXT DEFAULT 'both',            -- 'hover', 'click', 'both'
  zoom_level REAL DEFAULT 2.5,              -- 1.5 to 4.0
  
  -- Behavior settings
  variant_filtering INTEGER DEFAULT 1,
  lazy_loading INTEGER DEFAULT 1,
  autoplay_video INTEGER DEFAULT 0,
  
  -- Analytics settings
  enable_analytics INTEGER DEFAULT 1,
  
  -- AI settings
  enable_ai INTEGER DEFAULT 1,
  
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

-- ============================================
-- ANALYTICS EVENTS TABLE
-- Raw event data from gallery interactions
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  image_id TEXT,                            -- Null for non-image events
  event_type TEXT NOT NULL,                 -- See event types list
  event_data TEXT,                          -- JSON blob
  session_id TEXT,
  device_type TEXT,                         -- 'mobile', 'tablet', 'desktop'
  created_at TEXT DEFAULT (datetime('now')),
  
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_events_shop ON analytics_events(shop_id);
CREATE INDEX IF NOT EXISTS idx_events_product ON analytics_events(shop_id, product_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_date ON analytics_events(created_at);

-- ============================================
-- AI RESULTS TABLE
-- Cached AI analysis results
-- ============================================
CREATE TABLE IF NOT EXISTS ai_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  image_id TEXT NOT NULL,
  image_url TEXT NOT NULL,
  
  -- Analysis results (JSON blobs)
  alt_text_result TEXT,                     -- Generated alt text + keywords
  quality_result TEXT,                      -- Quality score + factors
  variant_result TEXT,                      -- Detected variant + confidence
  
  analyzed_at TEXT DEFAULT (datetime('now')),
  
  UNIQUE(shop_id, image_id),
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ai_shop ON ai_results(shop_id);
CREATE INDEX IF NOT EXISTS idx_ai_product ON ai_results(shop_id, product_id);

-- ============================================
-- ORDER SUGGESTIONS TABLE
-- AI-generated reorder recommendations
-- ============================================
CREATE TABLE IF NOT EXISTS order_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shop_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  
  current_order TEXT NOT NULL,              -- JSON array of image IDs
  suggested_order TEXT NOT NULL,            -- JSON array of image IDs
  changes TEXT NOT NULL,                    -- JSON array of changes with reasons
  reasoning TEXT,
  expected_improvement TEXT,
  confidence REAL,
  
  status TEXT DEFAULT 'pending',            -- 'pending', 'applied', 'dismissed'
  
  created_at TEXT DEFAULT (datetime('now')),
  applied_at TEXT,
  
  FOREIGN KEY (shop_id) REFERENCES shops(id) ON DELETE CASCADE
);

-- ============================================
-- SEED DATA (for demo)
-- ============================================
-- This will be populated by seed script

