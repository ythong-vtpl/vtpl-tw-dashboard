'use client';

import { Card, CardContent } from '@/components/ui/card';
import { BarChart3 } from 'lucide-react';

export default function SalesPage() {
  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold mb-6">판매 분석</h2>

      <Card>
        <CardContent className="p-12 text-center">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-600 mb-2">준비 중</h3>
          <p className="text-sm text-gray-400">
            채널별 판매 추이, TOP 상품 분석이 곧 추가됩니다.
          </p>
          <div className="mt-6 text-left max-w-md mx-auto">
            <p className="text-xs text-gray-500 mb-2">예정 기능:</p>
            <ul className="text-xs text-gray-400 space-y-1">
              <li>- Shopline / Shopee 채널별 일일 판매량</li>
              <li>- 상품별 판매 TOP 10</li>
              <li>- 재고 소진 속도 분석</li>
              <li>- 전일 대비 재고 변동 리포트</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
