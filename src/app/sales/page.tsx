'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Upload, Loader2, CheckCircle, BarChart3, TrendingUp,
  ShoppingCart, Package, XCircle, RefreshCw, ChevronDown, ChevronUp,
  Calendar, ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

type Channel = 'all' | 'shopee' | 'shopline';
type Tab = 'daily' | 'monthly' | 'ranking' | 'compare';

export default function SalesPage() {
  // 필터
  const [channel, setChannel] = useState<Channel>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [tab, setTab] = useState<Tab>('daily');
  const [topN, setTopN] = useState(20);
  const [rankMode, setRankMode] = useState<'top' | 'slow'>('top');

  // 데이터
  const [dailyData, setDailyData] = useState<any[]>([]);
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [skuData, setSkuData] = useState<any[]>([]);
  const [compareData, setCompareData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [hasData, setHasData] = useState<boolean | null>(null);

  // 수집 UI
  const [ingestOpen, setIngestOpen] = useState(false);
  const [shopeeFile, setShopeeFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [uploadResult, setUploadResult] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 초기 로드: 데이터 범위 확인
  useEffect(() => {
    fetch('/api/sales/date-range?country=TW')
      .then(r => r.json())
      .then(data => {
        if (data.hasData && data.minDate && data.maxDate) {
          setHasData(true);
          // 기본: 최근 30일
          const to = data.maxDate;
          const fromDate = new Date(data.maxDate);
          fromDate.setDate(fromDate.getDate() - 30);
          const from = fromDate.toISOString().slice(0, 10);
          setDateFrom(from < data.minDate ? data.minDate : from);
          setDateTo(to);
        } else {
          setHasData(false);
          // 기본 날짜 세팅 (오늘 기준 30일)
          const now = new Date();
          setDateTo(now.toISOString().slice(0, 10));
          const from = new Date(now);
          from.setDate(from.getDate() - 30);
          setDateFrom(from.toISOString().slice(0, 10));
        }
      })
      .catch(() => setHasData(false));
  }, []);

  // 데이터 로드
  const fetchAnalytics = useCallback(async () => {
    if (!dateFrom || !dateTo) return;
    setLoading(true);
    setError(null);

    const base = `/api/sales/analytics?from=${dateFrom}&to=${dateTo}&channel=${channel}&country=TW`;

    try {
      const [daily, monthly, ranking, compare] = await Promise.all([
        fetch(`${base}&view=daily`).then(r => r.json()),
        fetch(`${base}&view=monthly`).then(r => r.json()),
        fetch(`${base}&view=${rankMode === 'top' ? 'sku-ranking' : 'slow-movers'}&limit=${topN}`).then(r => r.json()),
        fetch(`${base}&view=channel-compare`).then(r => r.json()),
      ]);

      setDailyData(Array.isArray(daily) ? daily : []);
      setMonthlyData(Array.isArray(monthly) ? monthly : []);
      setSkuData(Array.isArray(ranking) ? ranking : []);
      setCompareData(compare?.shopee ? compare : null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, channel, topN, rankMode]);

  useEffect(() => {
    if (dateFrom && dateTo && hasData) fetchAnalytics();
  }, [dateFrom, dateTo, channel, fetchAnalytics, hasData]);

  // 랭킹 모드/N 변경 시 재조회
  useEffect(() => {
    if (dateFrom && dateTo && hasData && tab === 'ranking') {
      const base = `/api/sales/analytics?from=${dateFrom}&to=${dateTo}&channel=${channel}&country=TW`;
      fetch(`${base}&view=${rankMode === 'top' ? 'sku-ranking' : 'slow-movers'}&limit=${topN}`)
        .then(r => r.json())
        .then(d => setSkuData(Array.isArray(d) ? d : []));
    }
  }, [topN, rankMode]);

  // 쇼피 업로드
  const handleShopeeUpload = async () => {
    if (!shopeeFile) return;
    setUploading(true); setUploadResult(null); setError(null);
    try {
      const fd = new FormData();
      fd.append('file', shopeeFile);
      const res = await fetch('/api/sales/upload', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setUploadResult(`Shopee ${data.saved?.inserted || 0}건 저장 (${data.dateRange?.from} ~ ${data.dateRange?.to})`);
      setShopeeFile(null);
      fetchAnalytics();
    } catch (err: any) { setError(err.message); }
    finally { setUploading(false); }
  };

  // Shopline 동기화
  const handleShoplineSync = async () => {
    if (!dateFrom || !dateTo) return;
    setSyncing(true); setSyncResult(null); setError(null);
    try {
      const res = await fetch(`/api/sales/shopline?from=${dateFrom}&to=${dateTo}`);
      const data = await res.json();
      if (!res.ok) { setError(data.error); return; }
      setSyncResult(`Shopline ${data.saved?.inserted || 0}건 저장 (주문 ${data.totalOrders}건)`);
      fetchAnalytics();
    } catch (err: any) { setError(err.message); }
    finally { setSyncing(false); }
  };

  const formatNT = (n: number) => `NT$${Math.round(n).toLocaleString()}`;

  // KPI 계산
  const totalQty = dailyData.reduce((s, d) => s + d.quantity, 0);
  const totalRev = dailyData.reduce((s, d) => s + d.revenue, 0);
  const totalOrders = compareData ? (compareData.shopee?.totalOrders || 0) + (compareData.shopline?.totalOrders || 0) : 0;
  const avgOrderValue = totalOrders > 0 ? totalRev / totalOrders : 0;

  return (
    <div className="max-w-6xl">
      <h2 className="text-2xl font-bold mb-4">판매 분석</h2>

      {/* 필터바 */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-400" />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border rounded px-2 py-1 text-sm" />
          <span className="text-gray-400">~</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border rounded px-2 py-1 text-sm" />
        </div>

        <select value={channel} onChange={e => setChannel(e.target.value as Channel)}
          className="border rounded px-3 py-1 text-sm bg-white">
          <option value="all">전체 채널</option>
          <option value="shopee">Shopee</option>
          <option value="shopline">Shopline</option>
        </select>

        <Button variant="outline" size="sm" onClick={() => setIngestOpen(!ingestOpen)}>
          {ingestOpen ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
          데이터 수집
        </Button>
      </div>

      {/* 데이터 수집 섹션 (접을 수 있음) */}
      {ingestOpen && (
        <div className="grid grid-cols-2 gap-4 mb-4">
          <Card className={`transition-colors ${shopeeFile ? 'border-green-300 bg-green-50' : 'border-dashed'}`}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {shopeeFile ? <CheckCircle className="w-5 h-5 text-green-600" /> : <Upload className="w-5 h-5 text-gray-400" />}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">Shopee 주문 파일</p>
                  <p className="text-xs text-gray-500 truncate">{shopeeFile ? shopeeFile.name : 'Order.all.*.xlsx (암호 자동 복호화)'}</p>
                </div>
                <label className="cursor-pointer text-xs text-blue-600 hover:text-blue-800 mr-2">
                  <input type="file" accept=".xlsx" className="hidden" onChange={e => setShopeeFile(e.target.files?.[0] || null)} />
                  {shopeeFile ? '변경' : '선택'}
                </label>
                <Button size="sm" onClick={handleShopeeUpload} disabled={!shopeeFile || uploading} className="bg-orange-500 hover:bg-orange-600 text-xs h-7">
                  {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : '업로드'}
                </Button>
              </div>
              {uploadResult && <p className="text-xs text-green-600 mt-2">{uploadResult}</p>}
            </CardContent>
          </Card>

          <Card className="border-dashed">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <RefreshCw className="w-5 h-5 text-blue-400" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">Shopline 동기화</p>
                  <p className="text-xs text-gray-500">위 날짜 범위의 주문 데이터를 API로 가져옵니다</p>
                </div>
                <Button size="sm" onClick={handleShoplineSync} disabled={syncing} className="bg-blue-500 hover:bg-blue-600 text-xs h-7">
                  {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : '동기화'}
                </Button>
              </div>
              {syncResult && <p className="text-xs text-green-600 mt-2">{syncResult}</p>}
            </CardContent>
          </Card>
        </div>
      )}

      {error && (
        <Card className="border-red-300 bg-red-50 mb-4">
          <CardContent className="p-3 flex items-center gap-2">
            <XCircle className="w-4 h-4 text-red-600" />
            <span className="text-sm text-red-800">{error}</span>
          </CardContent>
        </Card>
      )}

      {/* 데이터 없음 안내 */}
      {hasData === false && !loading && (
        <Card className="mb-6">
          <CardContent className="p-8 text-center">
            <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-600 mb-2">판매 데이터가 없습니다</h3>
            <p className="text-sm text-gray-400 mb-4">
              위의 &ldquo;데이터 수집&rdquo; 버튼을 눌러 Shopee 주문 파일을 업로드하거나 Shopline 데이터를 동기화해주세요.
            </p>
            <Button variant="outline" onClick={() => setIngestOpen(true)}>데이터 수집 열기</Button>
          </CardContent>
        </Card>
      )}

      {/* KPI 카드 */}
      {hasData && (
        <>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <KpiCard icon={<ShoppingCart className="w-4 h-4 text-blue-600" />} label="주문수" value={`${totalOrders.toLocaleString()}건`} />
            <KpiCard icon={<Package className="w-4 h-4 text-purple-600" />} label="판매 수량" value={`${totalQty.toLocaleString()}개`} />
            <KpiCard icon={<TrendingUp className="w-4 h-4 text-green-600" />} label="매출" value={formatNT(totalRev)} />
            <KpiCard icon={<BarChart3 className="w-4 h-4 text-orange-600" />} label="평균 주문단가" value={formatNT(avgOrderValue)} />
          </div>

          {/* 탭 */}
          <div className="flex gap-1 mb-4">
            {([
              { key: 'daily', label: '일별 추이' },
              { key: 'monthly', label: '월별 현황' },
              { key: 'ranking', label: '상품 랭킹' },
              { key: 'compare', label: '채널 비교' },
            ] as { key: Tab; label: string }[]).map(t => (
              <Button key={t.key} variant={tab === t.key ? 'default' : 'outline'} size="sm"
                className="text-xs" onClick={() => setTab(t.key)}>
                {t.label}
              </Button>
            ))}
            {loading && <Loader2 className="w-4 h-4 animate-spin ml-2 text-gray-400" />}
          </div>

          {/* 탭 컨텐츠 */}
          {tab === 'daily' && <DailyTab data={dailyData} channel={channel} formatNT={formatNT} />}
          {tab === 'monthly' && <MonthlyTab data={monthlyData} channel={channel} formatNT={formatNT} />}
          {tab === 'ranking' && (
            <RankingTab data={skuData} topN={topN} setTopN={setTopN}
              rankMode={rankMode} setRankMode={setRankMode} formatNT={formatNT} />
          )}
          {tab === 'compare' && compareData && <CompareTab data={compareData} formatNT={formatNT} />}
        </>
      )}
    </div>
  );
}

// ── 일별 추이 ──
function DailyTab({ data, channel, formatNT }: { data: any[]; channel: Channel; formatNT: (n: number) => string }) {
  if (data.length === 0) return <EmptyState />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">일별 판매 수량</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            {channel === 'all' ? (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => `${v}개`} labelFormatter={d => String(d)} />
                <Legend />
                <Bar dataKey="shopeeQty" name="Shopee" fill="#f97316" stackId="a" />
                <Bar dataKey="shoplineQty" name="Shopline" fill="#3b82f6" stackId="a" />
              </BarChart>
            ) : (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: any) => `${v}개`} labelFormatter={d => String(d)} />
                <Line type="monotone" dataKey="quantity" name="판매 수량"
                  stroke={channel === 'shopee' ? '#f97316' : '#3b82f6'} strokeWidth={2} dot={{ r: 2 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-sm">일별 매출</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: any) => formatNT(Number(v))} labelFormatter={d => String(d)} />
              <Legend />
              {channel === 'all' ? (
                <>
                  <Line type="monotone" dataKey="shopeeRev" name="Shopee" stroke="#f97316" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="shoplineRev" name="Shopline" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
                </>
              ) : (
                <Line type="monotone" dataKey="revenue" name="매출"
                  stroke={channel === 'shopee' ? '#f97316' : '#3b82f6'} strokeWidth={2} dot={{ r: 2 }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}

// ── 월별 현황 ──
function MonthlyTab({ data, channel, formatNT }: { data: any[]; channel: Channel; formatNT: (n: number) => string }) {
  if (data.length === 0) return <EmptyState />;

  // 전월 대비 성장률
  const withGrowth = data.map((d, i) => ({
    ...d,
    growth: i > 0 && data[i - 1].quantity > 0
      ? ((d.quantity - data[i - 1].quantity) / data[i - 1].quantity * 100).toFixed(1)
      : null,
  }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="text-sm">월별 판매 수량</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={withGrowth}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v: any) => `${v}개`} />
              <Legend />
              {channel === 'all' ? (
                <>
                  <Bar dataKey="shopeeQty" name="Shopee" fill="#f97316" />
                  <Bar dataKey="shoplineQty" name="Shopline" fill="#3b82f6" />
                </>
              ) : (
                <Bar dataKey="quantity" name="판매 수량" fill={channel === 'shopee' ? '#f97316' : '#3b82f6'} />
              )}
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* 월별 테이블 */}
      <Card>
        <CardHeader><CardTitle className="text-sm">월별 요약</CardTitle></CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 border-b">
              <tr>
                <th className="py-2 pr-4">월</th>
                <th className="py-2 pr-4 text-right">판매 수량</th>
                <th className="py-2 pr-4 text-right">매출</th>
                <th className="py-2 text-right">전월 대비</th>
              </tr>
            </thead>
            <tbody>
              {withGrowth.map((m: any) => (
                <tr key={m.month} className="border-b last:border-0">
                  <td className="py-1.5 pr-4 font-medium">{m.month}</td>
                  <td className="py-1.5 pr-4 text-right">{m.quantity.toLocaleString()}개</td>
                  <td className="py-1.5 pr-4 text-right text-green-600">{formatNT(m.revenue)}</td>
                  <td className="py-1.5 text-right">
                    {m.growth !== null ? (
                      <span className={`flex items-center justify-end gap-1 ${parseFloat(m.growth) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {parseFloat(m.growth) >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {m.growth}%
                      </span>
                    ) : <span className="text-gray-300">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ── 상품 랭킹 ──
function RankingTab({ data, topN, setTopN, rankMode, setRankMode, formatNT }: {
  data: any[]; topN: number; setTopN: (n: number) => void;
  rankMode: 'top' | 'slow'; setRankMode: (m: 'top' | 'slow') => void;
  formatNT: (n: number) => string;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button size="sm" variant={rankMode === 'top' ? 'default' : 'outline'} className="text-xs"
          onClick={() => setRankMode('top')}>TOP 판매</Button>
        <Button size="sm" variant={rankMode === 'slow' ? 'default' : 'outline'} className="text-xs"
          onClick={() => setRankMode('slow')}>판매 부진</Button>
        <div className="ml-auto flex gap-1">
          {[10, 20, 50].map(n => (
            <Button key={n} variant={topN === n ? 'default' : 'outline'} size="sm"
              className="text-xs h-7" onClick={() => setTopN(n)}>{n}</Button>
          ))}
        </div>
      </div>

      {data.length === 0 ? <EmptyState /> : (
        <>
          <Card>
            <CardContent className="pt-4">
              <ResponsiveContainer width="100%" height={Math.max(300, data.length * 28)}>
                <BarChart data={data} layout="vertical" margin={{ left: 120 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="sku" tick={{ fontSize: 10 }} width={110} />
                  <Tooltip formatter={(v: any) => `${v}개`} />
                  <Bar dataKey="totalQuantity" name="판매 수량" fill={rankMode === 'top' ? '#7c3aed' : '#ef4444'} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">상세 ({data.length}개)</CardTitle></CardHeader>
            <CardContent>
              <div className="max-h-[500px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-gray-500 border-b sticky top-0 bg-white">
                    <tr>
                      <th className="py-2 pr-3">#</th>
                      <th className="py-2 pr-3">SKU</th>
                      <th className="py-2 pr-3">상품명</th>
                      <th className="py-2 pr-3 text-right text-orange-600">Shopee</th>
                      <th className="py-2 pr-3 text-right text-blue-600">Shopline</th>
                      <th className="py-2 pr-3 text-right">합계</th>
                      <th className="py-2 text-right">매출</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((s: any, i: number) => (
                      <tr key={s.sku} className="border-b last:border-0">
                        <td className="py-1.5 pr-3 text-gray-400">{i + 1}</td>
                        <td className="py-1.5 pr-3 font-mono text-xs">{s.sku}</td>
                        <td className="py-1.5 pr-3 truncate max-w-[200px]" title={s.productName}>{s.productName}</td>
                        <td className="py-1.5 pr-3 text-right text-orange-600">{s.shopeeQty}</td>
                        <td className="py-1.5 pr-3 text-right text-blue-600">{s.shoplineQty}</td>
                        <td className="py-1.5 pr-3 text-right font-bold">{s.totalQuantity}</td>
                        <td className="py-1.5 text-right text-green-600">{formatNT(s.totalRevenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ── 채널 비교 ──
function CompareTab({ data, formatNT }: { data: any; formatNT: (n: number) => string }) {
  const { shopee, shopline, dailyCompare } = data;

  if (!shopee && !shopline) return <EmptyState />;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-orange-200">
          <CardContent className="p-4">
            <Badge className="bg-orange-500 mb-3">Shopee</Badge>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><p className="text-xl font-bold">{shopee.totalOrders.toLocaleString()}</p><p className="text-xs text-gray-500">주문수</p></div>
              <div><p className="text-xl font-bold">{shopee.totalQuantity.toLocaleString()}</p><p className="text-xs text-gray-500">수량</p></div>
              <div><p className="text-xl font-bold text-green-600">{formatNT(shopee.totalRevenue)}</p><p className="text-xs text-gray-500">매출</p></div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-blue-200">
          <CardContent className="p-4">
            <Badge className="bg-blue-500 mb-3">Shopline</Badge>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><p className="text-xl font-bold">{shopline.totalOrders.toLocaleString()}</p><p className="text-xs text-gray-500">주문수</p></div>
              <div><p className="text-xl font-bold">{shopline.totalQuantity.toLocaleString()}</p><p className="text-xs text-gray-500">수량</p></div>
              <div><p className="text-xl font-bold text-green-600">{formatNT(shopline.totalRevenue)}</p><p className="text-xs text-gray-500">매출</p></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {dailyCompare?.length > 0 && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-sm">일별 판매 수량 비교</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dailyCompare}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: any) => `${v}개`} labelFormatter={d => String(d)} />
                  <Legend />
                  <Bar dataKey="shopeeQty" name="Shopee" fill="#f97316" />
                  <Bar dataKey="shoplineQty" name="Shopline" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">일별 매출 비교</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={dailyCompare}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: any) => formatNT(Number(v))} labelFormatter={d => String(d)} />
                  <Legend />
                  <Line type="monotone" dataKey="shopeeRev" name="Shopee" stroke="#f97316" strokeWidth={2} dot={{ r: 2 }} />
                  <Line type="monotone" dataKey="shoplineRev" name="Shopline" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// ── 공통 ──

function KpiCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-gray-500">{label}</span></div>
        <p className="text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState() {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <BarChart3 className="w-8 h-8 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-400">해당 기간의 데이터가 없습니다</p>
      </CardContent>
    </Card>
  );
}
