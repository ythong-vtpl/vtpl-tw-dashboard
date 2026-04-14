import { NextRequest, NextResponse } from 'next/server';
import axios from 'axios';
import { SHOPLINE_API_BASE, SHOPLINE_RATE_LIMIT_MS, getShoplineToken } from '@/lib/config';
import { upsertSalesData } from '@/lib/sales-persistence';
import { SalesDataRow } from '@/lib/types/sales';

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');

  if (!from || !to) {
    return NextResponse.json({ error: 'from, to 파라미터가 필요합니다.' }, { status: 400 });
  }

  const token = getShoplineToken('TW');
  if (!token) {
    return NextResponse.json({ error: 'Shopline TW 토큰이 설정되지 않았습니다.' }, { status: 500 });
  }

  try {
    const client = axios.create({
      baseURL: SHOPLINE_API_BASE,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    });

    const allOrders: any[] = [];
    let page = 1;
    const perPage = 250;

    while (true) {
      const res = await client.get('/v1/orders', {
        params: {
          created_at_min: `${from}T00:00:00+08:00`,
          created_at_max: `${to}T23:59:59+08:00`,
          per_page: perPage,
          page,
          status: 'completed,shipped,pending',
        },
      });

      const orders = res.data?.items || res.data || [];
      if (!Array.isArray(orders) || orders.length === 0) break;
      allOrders.push(...orders);
      if (orders.length < perPage) break;
      page++;
      await new Promise(r => setTimeout(r, SHOPLINE_RATE_LIMIT_MS));
    }

    // SKU별 집계 + Supabase 저장용 행
    const skuMap = new Map<string, { sku: string; productName: string; totalQuantity: number; totalRevenue: number; orderCount: number }>();
    const dailyMap = new Map<string, { quantity: number; revenue: number }>();
    const salesRows: SalesDataRow[] = [];

    for (const order of allOrders) {
      const orderId = order._id || order.id || '';
      const createdAt = order.created_at || order.order_created_at || '';
      const date = createdAt.slice(0, 10);
      const items = order.order_items || order.items || [];

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        const sku = item.sku || item.variant_sku || '';
        const productName = item.product_name || item.name || '';
        const quantity = item.quantity || 1;
        const price = item.price?.dollars ?? (item.price?.cents ? item.price.cents / 100 : item.price || 0);
        const subtotal = price * quantity;

        if (sku) {
          if (!skuMap.has(sku)) {
            skuMap.set(sku, { sku, productName, totalQuantity: 0, totalRevenue: 0, orderCount: 0 });
          }
          const s = skuMap.get(sku)!;
          s.totalQuantity += quantity;
          s.totalRevenue += subtotal;
          s.orderCount++;

          salesRows.push({
            order_id: `${orderId}-${idx}`,
            order_date: date,
            channel: 'shopline',
            sku,
            product_name: productName,
            quantity,
            unit_price: price,
            subtotal,
            order_status: order.status || 'completed',
            country: 'TW',
          });
        }

        if (date) {
          if (!dailyMap.has(date)) dailyMap.set(date, { quantity: 0, revenue: 0 });
          const d = dailyMap.get(date)!;
          d.quantity += quantity;
          d.revenue += subtotal;
        }
      }
    }

    // Supabase 저장
    const saveResult = await upsertSalesData(salesRows);

    const skuSummary = Array.from(skuMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
    const dailyTotal = Array.from(dailyMap.entries())
      .map(([date, d]) => ({ date, ...d }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      totalOrders: allOrders.length,
      totalQuantity: skuSummary.reduce((s, x) => s + x.totalQuantity, 0),
      totalRevenue: skuSummary.reduce((s, x) => s + x.totalRevenue, 0),
      skuSummary,
      dailyTotal,
      saved: saveResult,
    });
  } catch (err: any) {
    console.error('Shopline sales error:', err.response?.data || err.message);
    return NextResponse.json(
      { error: err.response?.data?.error_messages?.[0] || err.message },
      { status: 500 }
    );
  }
}
