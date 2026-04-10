import { NextRequest, NextResponse } from 'next/server';
import { getGmvSupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const from = request.nextUrl.searchParams.get('from');
  const to = request.nextUrl.searchParams.get('to');

  const sb = getGmvSupabase();

  let query = sb
    .from('daily_gmv')
    .select('*')
    .order('date', { ascending: true });

  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // real_gmv 계산 추가
  const enriched = (data || []).map((d: any) => ({
    ...d,
    real_gmv: (d.regular_order_amount || 0) + (d.cvs_paid_amount || 0),
    gmv_difference: (d.total_order_amount || 0) - ((d.regular_order_amount || 0) + (d.cvs_paid_amount || 0)),
  }));

  return NextResponse.json(enriched);
}
