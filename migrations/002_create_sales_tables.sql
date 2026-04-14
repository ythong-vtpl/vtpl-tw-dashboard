-- 판매 데이터 테이블 (주문 라인 단위)
CREATE TABLE IF NOT EXISTS inventory.sales_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id TEXT NOT NULL,
  order_date DATE NOT NULL,
  channel TEXT NOT NULL,            -- 'shopee' | 'shopline'
  sku TEXT NOT NULL,
  product_name TEXT,
  quantity INTEGER NOT NULL DEFAULT 0,
  unit_price NUMERIC(12,2) DEFAULT 0,
  subtotal NUMERIC(12,2) DEFAULT 0,
  order_status TEXT,
  country TEXT DEFAULT 'TW',
  ingested_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(order_id, sku, channel)
);

CREATE INDEX IF NOT EXISTS idx_sales_date ON inventory.sales_data(order_date);
CREATE INDEX IF NOT EXISTS idx_sales_channel ON inventory.sales_data(channel);
CREATE INDEX IF NOT EXISTS idx_sales_sku ON inventory.sales_data(sku);
CREATE INDEX IF NOT EXISTS idx_sales_country_date ON inventory.sales_data(country, order_date);

-- RLS 비활성화 (서비스 키 사용)
ALTER TABLE inventory.sales_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON inventory.sales_data FOR ALL USING (true) WITH CHECK (true);
