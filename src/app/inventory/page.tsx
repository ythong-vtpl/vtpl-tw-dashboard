'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Play, Download, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

interface FileSlot {
  key: string;
  label: string;
  description: string;
  file: File | null;
}

interface AllocateResult {
  success: boolean;
  dryRun: boolean;
  summary: {
    totalSkusProcessed: number;
    totalSkusUpdated: number;
    totalSkusSkipped: number;
    updates: { sellerCode: string; productName: string; previousQty: number; newQty: number }[];
    errors: { sellerCode: string; error: string }[];
    unmatchedShoplineSkus: string[];
  };
  shopee: {
    matched: number;
    totalShopeeStock: number;
    downloadId: string;
  } | null;
  activePromos: number;
  executionTimeMs: number;
}

export default function InventoryPage() {
  const [files, setFiles] = useState<FileSlot[]>([
    { key: 'optionInfo', label: 'option-info', description: '옵션별 재고', file: null },
    { key: 'setSku', label: 'Set-SKU', description: '세트 구성', file: null },
    { key: 'downSku', label: 'Down-SKU-SkuDetails', description: 'SKU 상세', file: null },
    { key: 'shopeeTemplate', label: 'Shopee 템플릿', description: 'Sales Info (선택)', file: null },
  ]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AllocateResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback((key: string, file: File | null) => {
    setFiles(prev => prev.map(f => f.key === key ? { ...f, file } : f));
  }, []);

  const handleDrop = useCallback((key: string, e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.xlsx')) {
      handleFileChange(key, file);
    }
  }, [handleFileChange]);

  const requiredFilesReady = files[0].file && files[1].file && files[2].file;

  const handleAllocate = async (dryRun: boolean) => {
    if (!requiredFilesReady) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('optionInfo', files[0].file!);
      formData.append('setSku', files[1].file!);
      formData.append('downSku', files[2].file!);
      if (files[3].file) formData.append('shopeeTemplate', files[3].file!);
      formData.append('dryRun', String(dryRun));

      const res = await fetch('/api/inventory/allocate', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || '배분 실행 실패');
        return;
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || '네트워크 오류');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadShopee = () => {
    if (!result?.shopee?.downloadId) return;
    window.open(`/api/inventory/download?id=${result.shopee.downloadId}`, '_blank');
  };

  return (
    <div className="max-w-5xl">
      <h2 className="text-2xl font-bold mb-6">재고 배분</h2>

      {/* 파일 업로드 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {files.map((slot) => (
          <Card
            key={slot.key}
            className={`cursor-pointer transition-colors ${
              slot.file ? 'border-green-300 bg-green-50' : 'border-dashed hover:border-gray-400'
            }`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(slot.key, e)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {slot.file ? (
                  <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
                ) : (
                  <Upload className="w-5 h-5 text-gray-400 flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{slot.label}</p>
                  <p className="text-xs text-gray-500">
                    {slot.file ? slot.file.name : slot.description}
                  </p>
                </div>
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={(e) => handleFileChange(slot.key, e.target.files?.[0] || null)}
                  />
                  <span className="text-xs text-blue-600 hover:text-blue-800">
                    {slot.file ? '변경' : '선택'}
                  </span>
                </label>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 실행 버튼 */}
      <div className="flex gap-3 mb-6">
        <Button
          onClick={() => handleAllocate(false)}
          disabled={!requiredFilesReady || loading}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> 실행 중...</>
          ) : (
            <><Play className="w-4 h-4 mr-2" /> 재고 배분 실행 (LIVE)</>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() => handleAllocate(true)}
          disabled={!requiredFilesReady || loading}
        >
          DRY RUN (미리보기)
        </Button>
      </div>

      {/* 에러 */}
      {error && (
        <Card className="border-red-300 bg-red-50 mb-6">
          <CardContent className="p-4 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-600" />
            <span className="text-sm text-red-800">{error}</span>
          </CardContent>
        </Card>
      )}

      {/* 결과 */}
      {result && (
        <div className="space-y-4">
          {/* 요약 카드 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                {result.dryRun ? (
                  <Badge variant="outline">DRY RUN</Badge>
                ) : (
                  <Badge className="bg-green-600">LIVE</Badge>
                )}
                배분 결과
                <span className="text-sm font-normal text-gray-500 ml-auto">
                  {(result.executionTimeMs / 1000).toFixed(1)}초
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold">{result.summary.totalSkusProcessed}</p>
                  <p className="text-xs text-gray-500">처리 SKU</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-blue-600">{result.summary.totalSkusUpdated}</p>
                  <p className="text-xs text-gray-500">업데이트</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-400">{result.summary.totalSkusSkipped}</p>
                  <p className="text-xs text-gray-500">변경없음</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{result.summary.errors.length}</p>
                  <p className="text-xs text-gray-500">오류</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 쇼피 다운로드 */}
          {result.shopee && (
            <Card>
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="font-medium">Shopee 업로드용 엑셀</p>
                  <p className="text-sm text-gray-500">
                    매칭 {result.shopee.matched}개 SKU / 총 배분 {result.shopee.totalShopeeStock}개
                  </p>
                </div>
                <Button onClick={handleDownloadShopee} variant="outline">
                  <Download className="w-4 h-4 mr-2" /> 다운로드
                </Button>
              </CardContent>
            </Card>
          )}

          {/* 변경 내역 */}
          {result.summary.updates.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">변경 내역 (상위 50개)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-gray-500 border-b sticky top-0 bg-white">
                      <tr>
                        <th className="py-2 pr-4">SKU</th>
                        <th className="py-2 pr-4">상품명</th>
                        <th className="py-2 pr-4 text-right">이전</th>
                        <th className="py-2 pr-4 text-right">변경</th>
                        <th className="py-2 text-right">차이</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.summary.updates.slice(0, 50).map((u, i) => {
                        const diff = u.newQty - u.previousQty;
                        return (
                          <tr key={i} className="border-b last:border-0">
                            <td className="py-1.5 pr-4 font-mono text-xs">{u.sellerCode}</td>
                            <td className="py-1.5 pr-4 truncate max-w-[200px]">{u.productName}</td>
                            <td className="py-1.5 pr-4 text-right">{u.previousQty}</td>
                            <td className="py-1.5 pr-4 text-right font-medium">{u.newQty}</td>
                            <td className={`py-1.5 text-right ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-gray-400'}`}>
                              {diff > 0 ? '+' : ''}{diff}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 에러 */}
          {result.summary.errors.length > 0 && (
            <Card className="border-orange-200">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-orange-500" />
                  오류 ({result.summary.errors.length}건)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {result.summary.errors.map((e, i) => (
                  <div key={i} className="text-sm py-1">
                    <span className="font-mono text-xs">{e.sellerCode}</span>
                    <span className="text-gray-500 ml-2">{e.error}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
