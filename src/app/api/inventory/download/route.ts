import { NextRequest, NextResponse } from 'next/server';
import { shopeeExcelStore } from '../allocate/route';

export async function GET(request: NextRequest) {
  const downloadId = request.nextUrl.searchParams.get('id');

  if (!downloadId) {
    return NextResponse.json({ error: 'id 파라미터가 필요합니다.' }, { status: 400 });
  }

  const entry = shopeeExcelStore.get(downloadId);
  if (!entry) {
    return NextResponse.json({ error: '파일이 만료되었거나 존재하지 않습니다.' }, { status: 404 });
  }

  const filename = `shopee_stock_update_${new Date().toISOString().replace(/[:.]/g, '-')}.xlsx`;

  return new NextResponse(new Uint8Array(entry.buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
