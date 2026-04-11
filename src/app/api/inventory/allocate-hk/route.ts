import { NextRequest, NextResponse } from 'next/server';
import { parseMjInventory } from '@/lib/mj-parser';
import { fetchShoplineProducts, updateShoplineVariation } from '@/lib/shopline';
import { SHOPLINE_RATE_LIMIT_MS } from '@/lib/config';

export const maxDuration = 60;

interface HkUpdateDetail {
  sku: string;
  productName: string;
  previousQty: number;
  newQty: number;
  productId: string;
  variationId: string;
}

/**
 * 홍콩 재고 배분 API
 *
 * 로직:
 * 1. MJ 엑셀에서 SKU별 가용재고 파악
 * 2. Shopline HK API에서 상품/옵션 목록 조회
 * 3. SKU 매칭 → 단품은 MJ 재고로 업데이트
 * 4. 세트(SET*) 상품은 스킵 (Shopline에서 수동 관리)
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();

  try {
    const formData = await request.formData();
    const mjFile = formData.get('mjInventory') as File | null;
    const dryRun = formData.get('dryRun') === 'true';

    if (!mjFile) {
      return NextResponse.json({ error: 'MJ 재고 파일이 필요합니다.' }, { status: 400 });
    }

    const mjBuffer = Buffer.from(await mjFile.arrayBuffer());

    // Step 1: MJ 재고 파싱
    const mjItems = await parseMjInventory(mjBuffer);
    const mjMap = new Map(mjItems.map(i => [i.skuCode, i]));

    // Step 2: Shopline HK 상품 조회
    const shoplineProducts = await fetchShoplineProducts('HK');

    // Step 3: SKU 매칭 & 배분 계산
    const updates: HkUpdateDetail[] = [];
    const errors: { sku: string; error: string }[] = [];
    const skipped: { sku: string; reason: string }[] = [];
    let matchedCount = 0;
    let unmatchedCount = 0;

    const allVariations: {
      sku: string;
      productName: string;
      currentQty: number;
      newQty: number;
      productId: string;
      variationId: string;
      isSet: boolean;
    }[] = [];

    for (const product of shoplineProducts) {
      for (const variation of product.variations) {
        const sku = variation.sku?.trim();
        if (!sku) continue;

        const isSet = sku.toUpperCase().startsWith('SET');
        const mjItem = mjMap.get(sku);

        if (isSet) {
          // 세트 상품: MJ에 없으므로 스킵 (Shopline 재고 유지)
          skipped.push({ sku, reason: '세트 상품 (수동 관리)' });
          continue;
        }

        if (mjItem) {
          matchedCount++;
          allVariations.push({
            sku,
            productName: product.title,
            currentQty: variation.quantity,
            newQty: mjItem.quantity,
            productId: product._id,
            variationId: variation.id,
            isSet: false,
          });
        } else {
          unmatchedCount++;
          skipped.push({ sku, reason: 'MJ 재고에 없음' });
        }
      }
    }

    // Step 4: Shopline 재고 업데이트
    let skippedSame = 0;

    if (!dryRun) {
      for (const v of allVariations) {
        if (v.newQty === v.currentQty) {
          skippedSame++;
          continue;
        }

        const result = await updateShoplineVariation(v.productId, v.variationId, v.newQty, 'HK');

        if (result.success) {
          updates.push({
            sku: v.sku,
            productName: v.productName,
            previousQty: v.currentQty,
            newQty: v.newQty,
            productId: v.productId,
            variationId: v.variationId,
          });
        } else {
          errors.push({ sku: v.sku, error: result.error || 'Unknown error' });
        }

        await new Promise(r => setTimeout(r, SHOPLINE_RATE_LIMIT_MS));
      }
    } else {
      // DRY RUN
      for (const v of allVariations) {
        if (v.newQty !== v.currentQty) {
          updates.push({
            sku: v.sku,
            productName: v.productName,
            previousQty: v.currentQty,
            newQty: v.newQty,
            productId: v.productId,
            variationId: v.variationId,
          });
        } else {
          skippedSame++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      country: 'HK',
      dryRun,
      summary: {
        mjItemCount: mjItems.length,
        shoplineProductCount: shoplineProducts.length,
        matched: matchedCount,
        unmatched: unmatchedCount,
        updated: updates.length,
        skippedSame,
        skippedSets: skipped.filter(s => s.reason.includes('세트')).length,
        errors: errors.length,
      },
      updates,
      errors,
      skipped: skipped.slice(0, 20),
      executionTimeMs: Date.now() - startTime,
    });
  } catch (err: any) {
    console.error('[HK Allocate] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
