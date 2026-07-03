-- سوبر ماركت ألماني - Supabase Schema
-- شغّل هذا الملف في SQL Editor في Supabase Dashboard

-- Products
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  sub TEXT DEFAULT '',
  price DOUBLE PRECISION NOT NULL,
  cat TEXT DEFAULT 'fruits',
  unit TEXT DEFAULT 'قطعة',
  badge TEXT DEFAULT '',
  discount DOUBLE PRECISION DEFAULT 0,
  active BOOLEAN DEFAULT true,
  image TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  items JSONB DEFAULT '[]',
  status TEXT DEFAULT 'pending',
  date TIMESTAMPTZ DEFAULT NOW(),
  total DOUBLE PRECISION DEFAULT 0,
  payment TEXT DEFAULT 'cash',
  "txnId" TEXT DEFAULT '',
  address TEXT DEFAULT '',
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  phone TEXT DEFAULT '',
  name TEXT DEFAULT ''
);

-- Categories
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT DEFAULT 'fa-tag',
  color TEXT DEFAULT '#16A34A',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings (key-value)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_cat ON products(cat);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(phone);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date DESC);

-- Enable Row Level Security (public read/write for API)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Allow all operations (since we use service_role key from backend)
CREATE POLICY "Allow all on products" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on orders" ON orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on categories" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on settings" ON settings FOR ALL USING (true) WITH CHECK (true);
