import { NextRequest, NextResponse } from 'next/server';
import { parseShopeeOrders } from '@/lib/shopee-order-parser';
import { upsertSalesData } from '@/lib/sales-persistence';
import { SalesDataRow } from '@/lib/types/sales';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: '파일을 업로드해주세요.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await parseShopeeOrders(buffer);

    // Supabase에 저장 (완료/배송중/준비중 주문만)
    const completedOrders = result.orders.filter(o =>
      o.orderStatus === '已完成' || o.orderStatus === 'Completed' ||
      o.orderStatus === '運送中' || o.orderStatus === 'Shipping' ||
      o.orderStatus === '待出貨' || o.orderStatus === 'To Ship'
    );

    const rows: SalesDataRow[] = completedOrders.map(o => ({
      order_id: o.orderId,
      order_date: o.orderDate,
      channel: 'shopee' as const,
      sku: o.optionSku || o.mainSku,
      product_name: o.productName,
      quantity: o.quantity,
      unit_price: o.price,
      subtotal: o.subtotal,
      order_status: o.orderStatus,
      country: 'TW',
    }));

    const saveResult = await upsertSalesData(rows);

    return NextResponse.json({
      dateRange: result.dateRange,
      totalOrders: result.totalOrders,
      totalQuantity: result.totalQuantity,
      totalRevenue: result.totalRevenue,
      skuSummary: result.skuSummary,
      dailyTotal: result.dailyTotal,
      saved: saveResult,
    });
  } catch (err: any) {
    console.error('Sales upload error:', err);
    return NextResponse.json(
      { error: err.message || '파일 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
