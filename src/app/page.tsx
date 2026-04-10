import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Package, TrendingUp, BarChart3 } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  return (
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold mb-2">Sister Ann TW Dashboard</h2>
      <p className="text-gray-500 mb-8">대만 이커머스 채널 관리</p>

      <div className="grid grid-cols-3 gap-4">
        <Link href="/inventory">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <Package className="w-8 h-8 text-blue-600 mb-2" />
              <CardTitle className="text-base">재고 배분</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                스마트쉽 파일 업로드 → Shopline 자동 반영 + Shopee 엑셀 생성
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/gmv">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <TrendingUp className="w-8 h-8 text-green-600 mb-2" />
              <CardTitle className="text-base">GMV</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                일일/월간 매출 현황, CVS 미수령 추적
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link href="/sales">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="pb-2">
              <BarChart3 className="w-8 h-8 text-purple-600 mb-2" />
              <CardTitle className="text-base">판매 분석</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">
                채널별 판매 추이, TOP 상품 (준비중)
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
