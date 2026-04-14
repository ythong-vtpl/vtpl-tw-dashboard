import { NextRequest, NextResponse } from 'next/server';
import { getInventorySupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const from = sp.get('from');
  const to = sp.get('to');
  const channel = sp.get('channel') || 'all';    // shopee | shopline | all
  const country = sp.get('country') || 'TW';
  const view = sp.get('view') || 'daily';         // daily | monthly | sku-ranking | slow-movers | channel-compare
  const limit = parseInt(sp.get('limit') || '20', 10);

  if (!from || !to) {
    return NextResponse.json({ error: 'from, to 파라미터가 필요합니다.' }, { status: 400 });
  }

  const sb = getInventorySupabase();

  try {
    // 기본 쿼리: 필터된 데이터 가져오기
    let query = sb
      .from('sales_data')
      .select('*')
      .gte('order_date', from)
      .lte('order_date', to)
      .eq('country', country);

    if (channel !== 'all') {
      query = query.eq('channel', channel);
    }

    const { data: rows, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const data = rows || [];

    switch (view) {
      case 'daily':
        return NextResponse.json(aggregateDaily(data));

      case 'monthly':
        return NextResponse.json(aggregateMonthly(data));

      case 'sku-ranking':
        return NextResponse.json(aggregateSkuRanking(data, limit, 'desc'));

      case 'slow-movers':
        return NextResponse.json(aggregateSkuRanking(data, limit, 'asc'));

      case 'channel-compare':
        return NextResponse.json(aggregateChannelCompare(data));

      default:
        return NextResponse.json({ error: '지원하지 않는 view입니다.' }, { status: 400 });
    }
  } catch (err: any) {
    console.error('Analytics error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

function aggregateDaily(data: any[]) {
  const map = new Map<string, { quantity: number; revenue: number; shopeeQty: number; shoplineQty: number; shopeeRev: number; shoplineRev: number }>();

  for (const row of data) {
    const d = row.order_date;
    if (!map.has(d)) map.set(d, { quantity: 0, revenue: 0, shopeeQty: 0, shoplineQty: 0, shopeeRev: 0, shoplineRev: 0 });
    const m = map.get(d)!;
    const qty = row.quantity || 0;
    const rev = parseFloat(row.subtotal) || 0;
    m.quantity += qty;
    m.revenue += rev;
    if (row.channel === 'shopee') { m.shopeeQty += qty; m.shopeeRev += rev; }
    if (row.channel === 'shopline') { m.shoplineQty += qty; m.shoplineRev += rev; }
  }

  return Array.from(map.entries())
    .map(([date, v]) => ({ date, ...v }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function aggregateMonthly(data: any[]) {
  const map = new Map<string, { quantity: number; revenue: number; shopeeQty: number; shoplineQty: number }>();

  for (const row of data) {
    const month = row.order_date?.slice(0, 7); // YYYY-MM
    if (!month) continue;
    if (!map.has(month)) map.set(month, { quantity: 0, revenue: 0, shopeeQty: 0, shoplineQty: 0 });
    const m = map.get(month)!;
    const qty = row.quantity || 0;
    m.quantity += qty;
    m.revenue += parseFloat(row.subtotal) || 0;
    if (row.channel === 'shopee') m.shopeeQty += qty;
    if (row.channel === 'shopline') m.shoplineQty += qty;
  }

  return Array.from(map.entries())
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

function aggregateSkuRanking(data: any[], limit: number, order: 'asc' | 'desc') {
  const map = new Map<string, { sku: string; productName: string; totalQuantity: number; totalRevenue: number; shopeeQty: number; shoplineQty: number }>();

  for (const row of data) {
    const sku = row.sku;
    if (!sku) continue;
    if (!map.has(sku)) map.set(sku, { sku, productName: row.product_name || '', totalQuantity: 0, totalRevenue: 0, shopeeQty: 0, shoplineQty: 0 });
    const m = map.get(sku)!;
    const qty = row.quantity || 0;
    m.totalQuantity += qty;
    m.totalRevenue += parseFloat(row.subtotal) || 0;
    if (row.channel === 'shopee') m.shopeeQty += qty;
    if (row.channel === 'shopline') m.shoplineQty += qty;
  }

  const sorted = Array.from(map.values()).sort((a, b) =>
    order === 'desc' ? b.totalQuantity - a.totalQuantity : a.totalQuantity - b.totalQuantity
  );

  // 부진 상품: 0개 제외
  if (order === 'asc') {
    return sorted.filter(s => s.totalQuantity > 0).slice(0, limit);
  }

  return sorted.slice(0, limit);
}

function aggregateChannelCompare(data: any[]) {
  const shopee = { totalOrders: new Set<string>(), totalQuantity: 0, totalRevenue: 0 };
  const shopline = { totalOrders: new Set<string>(), totalQuantity: 0, totalRevenue: 0 };

  const dailyMap = new Map<string, { shopeeQty: number; shoplineQty: number; shopeeRev: number; shoplineRev: number }>();

  for (const row of data) {
    const ch = row.channel === 'shopee' ? shopee : shopline;
    ch.totalOrders.add(row.order_id);
    ch.totalQuantity += row.quantity || 0;
    ch.totalRevenue += parseFloat(row.subtotal) || 0;

    const d = row.order_date;
    if (d) {
      if (!dailyMap.has(d)) dailyMap.set(d, { shopeeQty: 0, shoplineQty: 0, shopeeRev: 0, shoplineRev: 0 });
      const m = dailyMap.get(d)!;
      const qty = row.quantity || 0;
      const rev = parseFloat(row.subtotal) || 0;
      if (row.channel === 'shopee') { m.shopeeQty += qty; m.shopeeRev += rev; }
      if (row.channel === 'shopline') { m.shoplineQty += qty; m.shoplineRev += rev; }
    }
  }

  return {
    shopee: { totalOrders: shopee.totalOrders.size, totalQuantity: shopee.totalQuantity, totalRevenue: shopee.totalRevenue },
    shopline: { totalOrders: shopline.totalOrders.size, totalQuantity: shopline.totalQuantity, totalRevenue: shopline.totalRevenue },
    dailyCompare: Array.from(dailyMap.entries())
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date)),
  };
}
