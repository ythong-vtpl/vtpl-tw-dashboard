import { NextResponse } from 'next/server';
import { getGmvSupabase } from '@/lib/supabase';

export async function GET() {
  const sb = getGmvSupabase();

  // 이번 달 데이터
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

  // 집계
  const totalOrders = days.reduce((s: number, d: any) => s + (d.total_order_count || 0), 0);
  const totalAmount = days.reduce((s: number, d: any) => s + (d.total_order_amount || 0), 0);
  const realGmv = days.reduce((s: number, d: any) => s + (d.regular_order_amount || 0) + (d.cvs_paid_amount || 0), 0);
  const cvsUnpaidCount = days.reduce((s: number, d: any) => s + (d.cvs_unpaid_count || 0), 0);
  const cvsUnpaidAmount = days.reduce((s: number, d: any) => s + (d.cvs_unpaid_amount || 0), 0);

  // 어제 데이터
  const yesterday = days.length > 0 ? days[days.length - 1] : null;

  return NextResponse.json({
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
