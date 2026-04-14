import { NextRequest, NextResponse } from 'next/server';
import { getGmvSupabase } from '@/lib/supabase';
import { Country, getShoplineToken, SHOPLINE_API_BASE, COUNTRY_CONFIG } from '@/lib/config';
import axios from 'axios';

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const country = (request.nextUrl.searchParams.get('country') as Country) || 'TW';

  if (country === 'TW') {
    return getTwGmvSummary();
  } else if (country === 'HK') {
    return getHkGmvSummary();
  }

  return NextResponse.json({ error: `지원하지 않는 국가: ${country}` }, { status: 400 });
}

/** 대만 GMV — Supabase daily_gmv 테이블에서 조회 */
async function getTwGmvSummary() {
  const sb = getGmvSupabase();

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const firstDay = `${year}-${month}-01`;
  const today = now.toISOString().split('T')[0];

  const { data: dailyData, error } = await sb
    .from('daily_gmv')
    .select('*')
    .gte('date', firstDay)
    .lte('date', today)
    .order('date', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const days = dailyData || [];

  const totalOrders = days.reduce((s: number, d: any) => s + (d.total_order_count || 0), 0);
  const totalAmount = days.reduce((s: number, d: any) => s + (d.total_order_amount || 0), 0);
  const realGmv = days.reduce((s: number, d: any) => s + (d.regular_order_amount || 0) + (d.cvs_paid_amount || 0), 0);
  const cvsUnpaidCount = days.reduce((s: number, d: any) => s + (d.cvs_unpaid_count || 0), 0);
  const cvsUnpaidAmount = days.reduce((s: number, d: any) => s + (d.cvs_unpaid_amount || 0), 0);

  const yesterday = days.length > 0 ? days[days.length - 1] : null;

  return NextResponse.json({
    country: 'TW',
    currency: 'TWD',
    currencySymbol: 'NT$',
    month: `${year}-${month}`,
    daysTracked: days.length,
    totalOrders,
    totalAmount,
    realGmv,
    cvsUnpaidCount,
    cvsUnpaidAmount,
    yesterday: yesterday ? {
      date: yesterday.date,
      orders: yesterday.total_order_count,
      amount: yesterday.total_order_amount,
      realGmv: (yesterday.regular_order_amount || 0) + (yesterday.cvs_paid_amount || 0),
    } : null,
    dailyData: days,
  });
}

/** 홍콩 GMV — Shopline API에서 직접 주문 조회 */
async function getHkGmvSummary() {
  const token = getShoplineToken('HK');
  if (!token) {
    return NextResponse.json({ error: '홍콩 Shopline 토큰이 설정되지 않았습니다.' }, { status: 500 });
  }

  const config = COUNTRY_CONFIG.HK;

  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const firstDay = `${year}-${month}-01`;

    // Shopline API에서 이번 달 주문 조회
    const client = axios.create({
      baseURL: SHOPLINE_API_BASE,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      timeout: 45000,
    });

    const allOrders: any[] = [];
    let page = 1;

    while (page <= 10) { // 안전 제한
      const res = await client.get('/v1/orders', { params: {
        created_at_min: `${firstDay}T00:00:00+08:00`,
        per_page: 250,
        page,
        sort_by: 'created_at',
        sort_order: 'desc',
      } });
      const orders = res.data?.items || res.data || [];
      if (!Array.isArray(orders) || orders.length === 0) break;

      for (const o of orders) {
        if (o.status !== 'cancelled') {
          allOrders.push(o);
        }
      }

      if (orders.length < 250) break;
      page++;
      await new Promise(r => setTimeout(r, 200));
    }

    // 일별 집계
    const dailyMap = new Map<string, { orders: number; amount: number }>();

    for (const o of allOrders) {
      const date = o.created_at?.split('T')[0];
      if (!date) continue;

      const amount = o.total?.dollars || 0;
      const existing = dailyMap.get(date) || { orders: 0, amount: 0 };
      existing.orders += 1;
      existing.amount += amount;
      dailyMap.set(date, existing);
    }

    const dailyData = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({
        date,
        total_order_count: d.orders,
        total_order_amount: d.amount,
        // 홍콩은 CVS 없음
        regular_order_amount: d.amount,
        cvs_paid_amount: 0,
        cvs_unpaid_count: 0,
        cvs_unpaid_amount: 0,
      }));

    const totalOrders = allOrders.length;
    const totalAmount = allOrders.reduce((s, o) => s + (o.total?.dollars || 0), 0);

    const yesterday = dailyData.length > 0 ? dailyData[dailyData.length - 1] : null;

    return NextResponse.json({
      country: 'HK',
      currency: 'HKD',
      currencySymbol: 'HK$',
      month: `${year}-${month}`,
      daysTracked: dailyData.length,
      totalOrders,
      totalAmount,
      realGmv: totalAmount, // 홍콩은 CVS 없으므로 전액 실 GMV
      cvsUnpaidCount: 0,
      cvsUnpaidAmount: 0,
      yesterday: yesterday ? {
        date: yesterday.date,
        orders: yesterday.total_order_count,
        amount: yesterday.total_order_amount,
        realGmv: yesterday.total_order_amount,
      } : null,
      dailyData,
    });
  } catch (err: any) {
    console.error('[HK GMV] Error:', err.response?.data || err.message);
    const msg = err.response?.data?.error_messages?.[0] || err.message || 'Shopline HK API 오류';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
