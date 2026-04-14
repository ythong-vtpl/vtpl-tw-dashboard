'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, ShoppingCart, AlertTriangle, DollarSign } from 'lucide-react';

interface GmvSummary {
  country: string;
  currency: string;
  currencySymbol: string;
  month: string;
  daysTracked: number;
  totalOrders: number;
  totalAmount: number;
  realGmv: number;
  cvsUnpaidCount: number;
  cvsUnpaidAmount: number;
  yesterday: {
    date: string;
    orders: number;
    amount: number;
    realGmv: number;
  } | null;
  dailyData: any[];
}

export default function GmvPage() {

  const [summary, setSummary] = useState<GmvSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatAmount = (amount: number) => {
    const sym = summary?.currencySymbol || 'NT$';
    return `${sym}${amount.toLocaleString()}`;
  };

  useEffect(() => {
    setLoading(true);
    setError(null);
    setSummary(null);
    fetch('/api/gmv/summary')
      .then(res => res.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setSummary(data);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">데이터 로딩 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl">
        <h2 className="text-2xl font-bold mb-6">GMV</h2>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <p className="text-sm text-red-800">데이터 로드 실패: {error}</p>
            <p className="text-xs text-red-600 mt-1">GMV 트래커가 실행 중인지 확인하세요.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="max-w-5xl">
      <h2 className="text-2xl font-bold mb-2">🇹🇼 대만 GMV</h2>
      <p className="text-gray-500 mb-6">{summary.month} ({summary.daysTracked}일 추적 중)</p>

      {/* 상단 요약 카드 */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <DollarSign className="w-4 h-4 text-green-600" />
              <span className="text-xs text-gray-500">이번 달 실 GMV</span>
            </div>
            <p className="text-xl font-bold">{formatAmount(summary.realGmv)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <ShoppingCart className="w-4 h-4 text-blue-600" />
              <span className="text-xs text-gray-500">총 주문</span>
            </div>
            <p className="text-xl font-bold">{summary.totalOrders.toLocaleString()}건</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-purple-600" />
              <span className="text-xs text-gray-500">총 주문 금액</span>
            </div>
            <p className="text-xl font-bold">{formatAmount(summary.totalAmount)}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-orange-500" />
              <span className="text-xs text-gray-500">CVS 미수령</span>
            </div>
            <p className="text-xl font-bold">{summary.cvsUnpaidCount}건</p>
            <p className="text-xs text-gray-400">{formatAmount(summary.cvsUnpaidAmount)}</p>
          </CardContent>
        </Card>
      </div>

      {/* 어제 요약 */}
      {summary.yesterday && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-sm">어제 ({summary.yesterday.date})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold">{summary.yesterday.orders}건</p>
                <p className="text-xs text-gray-500">주문</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{formatAmount(summary.yesterday.amount)}</p>
                <p className="text-xs text-gray-500">주문 금액</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{formatAmount(summary.yesterday.realGmv)}</p>
                <p className="text-xs text-gray-500">실 GMV</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 일별 테이블 */}
      {summary.dailyData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">일별 GMV</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-gray-500 border-b sticky top-0 bg-white">
                  <tr>
                    <th className="py-2 pr-4">날짜</th>
                    <th className="py-2 pr-4 text-right">주문수</th>
                    <th className="py-2 pr-4 text-right">주문 금액</th>
                    <th className="py-2 pr-4 text-right">실 GMV</th>
                    <th className="py-2 pr-4 text-right">CVS 미수령</th>
                  </tr>
                </thead>
                <tbody>
                  {[...summary.dailyData].reverse().map((d: any, i: number) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-1.5 pr-4">{d.date}</td>
                      <td className="py-1.5 pr-4 text-right">{d.total_order_count}</td>
                      <td className="py-1.5 pr-4 text-right">{formatAmount(d.total_order_amount || 0)}</td>
                      <td className="py-1.5 pr-4 text-right text-green-600 font-medium">
                        {formatAmount((d.regular_order_amount || 0) + (d.cvs_paid_amount || 0))}
                      </td>
                      <td className="py-1.5 pr-4 text-right text-orange-500">
                        {d.cvs_unpaid_count > 0 ? `${d.cvs_unpaid_count}건 (${formatAmount(d.cvs_unpaid_amount || 0)})` : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
