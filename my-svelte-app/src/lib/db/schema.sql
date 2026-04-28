-- JTS-IMS SQLite Schema
-- All tables, constraints, and indexes for the local SQLite database.

CREATE TABLE IF NOT EXISTS users (
  id          TEXT PRIMARY KEY,
  email       TEXT NOT NULL UNIQUE,
  role        TEXT NOT NULL CHECK(role IN ('owner', 'staff')),
  is_active   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS delivery_providers (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tire_products (
  id                   TEXT PRIMARY KEY,
  brand                TEXT NOT NULL,
  size                 TEXT NOT NULL,
  pattern              TEXT NOT NULL,
  quantity             INTEGER NOT NULL DEFAULT 0,
  unit_cost_price      REAL NOT NULL,
  retail_price         REAL NOT NULL,
  delivery_provider_id TEXT REFERENCES delivery_providers(id),
  low_stock_threshold  INTEGER,
  is_archived          INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL,
  UNIQUE(brand, size, pattern),
  CHECK(retail_price >= unit_cost_price),
  CHECK(quantity >= 0)
);

CREATE TABLE IF NOT EXISTS stock_in_transactions (
  id                   TEXT PRIMARY KEY,
  tire_product_id      TEXT NOT NULL REFERENCES tire_products(id),
  delivery_provider_id TEXT REFERENCES delivery_providers(id),
  quantity             INTEGER NOT NULL CHECK(quantity > 0),
  transaction_date     TEXT NOT NULL,
  notes                TEXT,
  created_at           TEXT NOT NULL,
  updated_at           TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_out_transactions (
  id               TEXT PRIMARY KEY,
  tire_product_id  TEXT NOT NULL REFERENCES tire_products(id),
  quantity         INTEGER NOT NULL CHECK(quantity > 0),
  reason           TEXT NOT NULL,
  transaction_date TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sales_transactions (
  id                TEXT PRIMARY KEY,
  tire_product_id   TEXT NOT NULL REFERENCES tire_products(id),
  quantity_sold     INTEGER NOT NULL CHECK(quantity_sold > 0),
  unit_retail_price REAL NOT NULL,
  unit_cost_price   REAL NOT NULL,
  revenue           REAL NOT NULL,
  gross_profit      REAL NOT NULL,
  transaction_date  TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL CHECK(type IN ('low_stock', 'dead_stock', 'sync_status', 'report_ready')),
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'unread' CHECK(status IN ('unread', 'read', 'dismissed')),
  payload    TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tire_products_brand   ON tire_products(brand);
CREATE INDEX IF NOT EXISTS idx_tire_products_size    ON tire_products(size);
CREATE INDEX IF NOT EXISTS idx_tire_products_pattern ON tire_products(pattern);
CREATE INDEX IF NOT EXISTS idx_stock_in_date         ON stock_in_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_stock_out_date        ON stock_out_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_sales_date            ON sales_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_sales_product         ON sales_transactions(tire_product_id);
