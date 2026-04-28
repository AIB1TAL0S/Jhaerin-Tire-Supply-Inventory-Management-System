-- JTS-IMS Supabase PostgreSQL Schema
-- Mirrors the SQLite schema with UUID PKs, RLS, updated_at triggers, and constraints.

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL UNIQUE,
  role        TEXT NOT NULL CHECK (role IN ('owner', 'staff')),
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS delivery_providers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tire_products (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand                TEXT NOT NULL,
  size                 TEXT NOT NULL,
  pattern              TEXT NOT NULL,
  quantity             INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  unit_cost_price      NUMERIC(12, 2) NOT NULL,
  retail_price         NUMERIC(12, 2) NOT NULL,
  delivery_provider_id UUID REFERENCES delivery_providers(id) ON DELETE RESTRICT,
  low_stock_threshold  INTEGER,
  is_archived          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (brand, size, pattern),
  CHECK (retail_price >= unit_cost_price)
);

CREATE TABLE IF NOT EXISTS stock_in_transactions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tire_product_id      UUID NOT NULL REFERENCES tire_products(id) ON DELETE RESTRICT,
  delivery_provider_id UUID REFERENCES delivery_providers(id) ON DELETE RESTRICT,
  quantity             INTEGER NOT NULL CHECK (quantity > 0),
  transaction_date     TIMESTAMPTZ NOT NULL,
  notes                TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_out_transactions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tire_product_id  UUID NOT NULL REFERENCES tire_products(id) ON DELETE RESTRICT,
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  reason           TEXT NOT NULL,
  transaction_date TIMESTAMPTZ NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tire_product_id   UUID NOT NULL REFERENCES tire_products(id) ON DELETE RESTRICT,
  quantity_sold     INTEGER NOT NULL CHECK (quantity_sold > 0),
  unit_retail_price NUMERIC(12, 2) NOT NULL,
  unit_cost_price   NUMERIC(12, 2) NOT NULL,
  revenue           NUMERIC(14, 2) NOT NULL,
  gross_profit      NUMERIC(14, 2) NOT NULL,
  transaction_date  TIMESTAMPTZ NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type       TEXT NOT NULL CHECK (type IN ('low_stock', 'dead_stock', 'sync_status', 'report_ready')),
  message    TEXT NOT NULL,
  status     TEXT NOT NULL DEFAULT 'unread' CHECK (status IN ('unread', 'read', 'dismissed')),
  payload    JSONB,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tire_products_brand   ON tire_products(brand);
CREATE INDEX IF NOT EXISTS idx_tire_products_size    ON tire_products(size);
CREATE INDEX IF NOT EXISTS idx_tire_products_pattern ON tire_products(pattern);
CREATE INDEX IF NOT EXISTS idx_stock_in_date         ON stock_in_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_stock_out_date        ON stock_out_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_sales_date            ON sales_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_sales_product         ON sales_transactions(tire_product_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user    ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_settings_user         ON settings(user_id);

-- ── updated_at triggers ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'users', 'delivery_providers', 'tire_products',
    'stock_in_transactions', 'stock_out_transactions',
    'sales_transactions', 'settings'
  ] LOOP
    EXECUTE format(
      'CREATE TRIGGER trg_%s_updated_at BEFORE UPDATE ON %s FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
      t, t
    );
  END LOOP;
END;
$$;

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_providers     ENABLE ROW LEVEL SECURITY;
ALTER TABLE tire_products          ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_in_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_out_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_transactions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings               ENABLE ROW LEVEL SECURITY;

-- Helper: extract role from JWT
CREATE OR REPLACE FUNCTION auth_role()
RETURNS TEXT AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb -> 'user_metadata' ->> 'role',
    current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role',
    'staff'
  );
$$ LANGUAGE sql STABLE;

-- users: owners can read/write all; staff cannot write
CREATE POLICY "users_owner_all"  ON users FOR ALL    USING (auth_role() = 'owner');
CREATE POLICY "users_staff_read" ON users FOR SELECT USING (auth_role() = 'staff');

-- delivery_providers: all authenticated users can read; owners can write
CREATE POLICY "dp_read_all"    ON delivery_providers FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "dp_owner_write" ON delivery_providers FOR ALL    USING (auth_role() = 'owner');

-- tire_products: all authenticated users can read/write
CREATE POLICY "tp_auth_all" ON tire_products FOR ALL USING (auth.uid() IS NOT NULL);

-- stock_in_transactions: all authenticated users
CREATE POLICY "sit_auth_all" ON stock_in_transactions FOR ALL USING (auth.uid() IS NOT NULL);

-- stock_out_transactions: all authenticated users
CREATE POLICY "sot_auth_all" ON stock_out_transactions FOR ALL USING (auth.uid() IS NOT NULL);

-- sales_transactions: all authenticated users
CREATE POLICY "st_auth_all" ON sales_transactions FOR ALL USING (auth.uid() IS NOT NULL);

-- notifications: scoped to the owning user
CREATE POLICY "notif_own" ON notifications FOR ALL USING (user_id = auth.uid());

-- settings: scoped to the owning user
CREATE POLICY "settings_own" ON settings FOR ALL USING (user_id = auth.uid());
