/** Supabase sales_data 행 */
export interface SalesDataRow {
  order_id: string;
  order_date: string;       // YYYY-MM-DD
  channel: 'shopee' | 'shopline';
  sku: string;
  product_name?: string;
  quantity: number;
  unit_price?: number;
  subtotal?: number;
  order_status?: string;
  country?: string;
}

/** 일별 분석 */
export interface DailyAnalytics {
  date: string;
  quantity: number;
  revenue: number;
  shopeeQty?: number;
  shoplineQty?: number;
  shopeeRev?: number;
  shoplineRev?: number;
}

/** 월별 분석 */
export interface MonthlyAnalytics {
  month: string;
  quantity: number;
  revenue: number;
  shopeeQty?: number;
  shoplineQty?: number;
}

/** SKU 랭킹 */
export interface SkuRanking {
  sku: string;
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
  shopeeQty: number;
  shoplineQty: number;
}

/** 채널 요약 */
export interface ChannelSummary {
  channel: string;
  totalOrders: number;
  totalQuantity: number;
  totalRevenue: number;
}
