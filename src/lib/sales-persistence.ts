import { getInventorySupabase } from './supabase';
import { SalesDataRow } from './types/sales';

const BATCH_SIZE = 500;

/**
 * 판매 데이터를 Supabase에 upsert (중복 안전)
 * order_id + sku + channel 기준으로 중복 방지
 */
export async function upsertSalesData(rows: SalesDataRow[]): Promise<{
  success: boolean;
  inserted: number;
  error?: string;
}> {
  if (rows.length === 0) return { success: true, inserted: 0 };

  const sb = getInventorySupabase();
  let totalInserted = 0;

  // 배치 처리
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    const { error } = await sb
      .from('sales_data')
      .upsert(batch, { onConflict: 'order_id,sku,channel' });

    if (error) {
      console.error('[Sales] Supabase upsert error:', error.message);
      return { success: false, inserted: totalInserted, error: error.message };
    }

    totalInserted += batch.length;
  }

  console.log(`[Sales] ${totalInserted}행 저장 완료`);
  return { success: true, inserted: totalInserted };
}
