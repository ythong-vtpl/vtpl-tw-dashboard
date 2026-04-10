import { NextRequest, NextResponse } from 'next/server';
import { parseWarehouseExcel } from '@/lib/excel-parser';
import { matchSkus } from '@/lib/sku-matcher';
import { calculateAllocation } from '@/lib/allocation';
import { loadPromos, getActivePromos } from '@/lib/promo';
import { fetchShoplineProducts, updateShoplineVariation } from '@/lib/shopline';
import { generateShopeeUpdateExcel } from '@/lib/shopee-export';
import { getInventorySupabase } from '@/lib/supabase';
import { SHOPLINE_RATE_LIMIT_MS } from '@/lib/config';
import { AllocationResult, UpdateSummary, UpdateDetail, UpdateError } from '@/lib/types/inventory';

// Vercel 서버리스 함수 타임아웃 설정 (60초)
export const maxDuration = 60;

// 생성된 쇼피 엑셀을 임시 저장 (메모리, 5분 TTL)
const shopeeExcelStore = new Map<string, { buffer: Buffer; createdAt: number }>();

function cleanExpiredExcels() {
  const now = Date.now();
  for (const [key, val] of shopeeExcelStore) {
    if (now - val.createdAt > 5 * 60 * 1000) shopeeExcelStore.delete(key);
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const formData = await request.formData();

    // 파일 추출
    const optionInfoFile = formData.get('optionInfo') as File | null;
    const setSkuFile = formData.get('setSku') as File | null;
    const downSkuFile = formData.get('downSku') as File | null;
    const shopeeTemplateFile = formData.get('shopeeTemplate') as File | null;
    const dryRun = formData.get('dryRun') === 'true';

    if (!optionInfoFile || !setSkuFile || !downSkuFile) {
      return NextResponse.json(
        { error: 'option-info, Set-SKU, Down-SKU 파일이 모두 필요합니다.' },
        { status: 400 }
      );
    }

    // Buffer 변환
    const optionInfoBuffer = Buffer.from(await optionInfoFile.arrayBuffer());
    const setSkuBuffer = Buffer.from(await setSkuFile.arrayBuffer());
    const downSkuBuffer = Buffer.from(await downSkuFile.arrayBuffer());

    // Step 1: 엑셀 파싱
    const warehouseData = await parseWarehouseExcel(optionInfoBuffer, setSkuBuffer, downSkuBuffer);

    // Step 2: 프로모션 로드
    const allPromos = await loadPromos();
    const activePromos = getActivePromos(allPromos);

    // Step 3: Shopline 상품 조회
    const shoplineProducts = await fetchShoplineProducts();

    // Step 4: SKU 매칭
    const matchResult = matchSkus(warehouseData, shoplineProducts);

    // Step 5: 배분 계산
    const allocations = calculateAllocation(warehouseData, matchResult.matched, activePromos);

    // Step 6: Shopline 재고 업데이트
    const updates: UpdateDetail[] = [];
    const errors: UpdateError[] = [];
    let skippedCount = 0;

    if (!dryRun) {
      for (const alloc of allocations) {
        if (alloc.shoplineAllocation === alloc.currentShoplineStock) {
          skippedCount++;
          continue;
        }

        const result = await updateShoplineVariation(
          alloc.shoplineProductId,
          alloc.shoplineVariationId,
          alloc.shoplineAllocation
        );

        if (result.success) {
          updates.push({
            sellerCode: alloc.sellerCode,
            productName: alloc.productName,
            previousQty: alloc.currentShoplineStock,
            newQty: alloc.shoplineAllocation,
            shoplineProductId: alloc.shoplineProductId,
            shoplineVariationId: alloc.shoplineVariationId,
          });
        } else {
          errors.push({
            sellerCode: alloc.sellerCode,
            error: result.error || 'Unknown error',
          });
        }

        await new Promise(r => setTimeout(r, SHOPLINE_RATE_LIMIT_MS));
      }
    } else {
      // DRY RUN: 변경될 항목만 기록
      for (const alloc of allocations) {
        if (alloc.shoplineAllocation !== alloc.currentShoplineStock) {
          updates.push({
            sellerCode: alloc.sellerCode,
            productName: alloc.productName,
            previousQty: alloc.currentShoplineStock,
            newQty: alloc.shoplineAllocation,
            shoplineProductId: alloc.shoplineProductId,
            shoplineVariationId: alloc.shoplineVariationId,
          });
        } else {
          skippedCount++;
        }
      }
    }

    // Step 7: 쇼피 엑셀 생성
    let shopeeResult = null;
    let downloadId: string | null = null;

    if (shopeeTemplateFile) {
      const templateBuffer = Buffer.from(await shopeeTemplateFile.arrayBuffer());
      const result = await generateShopeeUpdateExcel(allocations, templateBuffer);

      downloadId = `shopee_${Date.now()}`;
      cleanExpiredExcels();
      shopeeExcelStore.set(downloadId, {
        buffer: result.buffer,
        createdAt: Date.now(),
      });

      shopeeResult = {
        matched: result.matched,
        unmatched: result.unmatched,
        totalShopeeStock: result.totalShopeeStock,
        downloadId,
      };
    }

    // Step 8: Supabase 스냅샷 저장
    try {
      const sb = getInventorySupabase();
      const today = new Date().toISOString().split('T')[0];

      const snapshotRows = allocations.map(a => ({
        snapshot_date: today,
        seller_code: a.sellerCode,
        product_name: a.productName,
        is_set_product: a.isSetProduct,
        warehouse_available_stock: a.warehouseAvailableStock,
        shopline_allocation: a.shoplineAllocation,
        shopee_allocation: a.shopeeAllocation,
        safety_stock: a.safetyStock,
        current_shopline_stock: a.currentShoplineStock,
        gift_reserve: a.giftReserve || 0,
        frozen: a.frozen || false,
        promo_note: a.promoNote || null,
      }));

      await sb.from('daily_snapshots').upsert(snapshotRows, {
        onConflict: 'snapshot_date,seller_code',
      });

      // 실행 로그
      await sb.from('allocation_runs').insert({
        dry_run: dryRun,
        total_skus_processed: allocations.length,
        total_skus_updated: updates.length,
        total_skus_skipped: skippedCount,
        total_errors: errors.length,
        shopline_total_allocation: allocations.reduce((s, a) => s + a.shoplineAllocation, 0),
        shopee_total_allocation: allocations.reduce((s, a) => s + a.shopeeAllocation, 0),
        safety_total: allocations.reduce((s, a) => s + a.safetyStock, 0),
        errors: errors.length > 0 ? errors : null,
        shopee_excel_generated: !!shopeeResult,
        execution_time_ms: Date.now() - startTime,
      });
    } catch (dbErr) {
      console.warn('[Supabase] 스냅샷 저장 실패:', dbErr);
    }

    const summary: UpdateSummary = {
      totalSkusProcessed: allocations.length,
      totalSkusUpdated: updates.length,
      totalSkusSkipped: skippedCount,
      unmatchedShoplineSkus: matchResult.unmatchedShoplineSkus,
      unmatchedWarehouseSkus: matchResult.unmatchedWarehouseSkus,
      updates,
      errors,
    };

    return NextResponse.json({
      success: true,
      dryRun,
      summary,
      shopee: shopeeResult,
      activePromos: activePromos.length,
      executionTimeMs: Date.now() - startTime,
    });

  } catch (err: any) {
    console.error('[Allocate] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

// 쇼피 엑셀 다운로드용 (downloadId로 조회)
export { shopeeExcelStore };
