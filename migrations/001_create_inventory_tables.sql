-- Sister Ann TW Dashboard - Inventory Schema
-- Supabase SQL Editor에서 실행

CREATE SCHEMA IF NOT EXISTS inventory;

-- 일일 재고 스냅샷 (매일 배분 실행 시 저장)
CREATE TABLE IF NOT EXISTS inventory.daily_snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  snapshot_date DATE NOT NULL,
  seller_code TEXT NOT NULL,
  product_name TEXT,
  is_set_product BOOLEAN DEFAULT false,
  warehouse_available_stock INTEGER DEFAULT 0,
  shopline_allocation INTEGER DEFAULT 0,
  shopee_allocation INTEGER DEFAULT 0,
  safety_stock INTEGER DEFAULT 0,
  current_shopline_stock INTEGER DEFAULT 0,
  gift_reserve INTEGER DEFAULT 0,
  frozen BOOLEAN DEFAULT false,
  promo_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(snapshot_date, seller_code)
);

-- 배분 실행 로그
CREATE TABLE IF NOT EXISTS inventory.allocation_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dry_run BOOLEAN DEFAULT false,
  total_skus_processed INTEGER DEFAULT 0,
  total_skus_updated INTEGER DEFAULT 0,
  total_skus_skipped INTEGER DEFAULT 0,
  total_errors INTEGER DEFAULT 0,
  shopline_total_allocation INTEGER DEFAULT 0,
  shopee_total_allocation INTEGER DEFAULT 0,
  safety_total INTEGER DEFAULT 0,
  errors JSONB,
  shopee_excel_generated BOOLEAN DEFAULT false,
  execution_time_ms INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_snapshots_date ON inventory.daily_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_snapshots_seller ON inventory.daily_snapshots(seller_code);
CREATE INDEX IF NOT EXISTS idx_runs_created ON inventory.allocation_runs(created_at DESC);

-- inventory 스키마에 대한 API 접근 허용
GRANT USAGE ON SCHEMA inventory TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA inventory TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA inventory TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA inventory GRANT ALL ON TABLES TO service_role;
