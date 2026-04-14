import { NextRequest, NextResponse } from 'next/server';
import { getInventorySupabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const country = request.nextUrl.searchParams.get('country') || 'TW';
  const sb = getInventorySupabase();

  try {
    // 가장 오래된 날짜
    const { data: minData } = await sb
      .from('sales_data')
      .select('order_date')
      .eq('country', country)
      .order('order_date', { ascending: true })
      .limit(1);

    // 가장 최근 날짜
    const { data: maxData } = await sb
      .from('sales_data')
      .select('order_date')
      .eq('country', country)
      .order('order_date', { ascending: false })
      .limit(1);

    return NextResponse.json({
      minDate: minData?.[0]?.order_date || null,
      maxDate: maxData?.[0]?.order_date || null,
      hasData: !!(minData?.length),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
