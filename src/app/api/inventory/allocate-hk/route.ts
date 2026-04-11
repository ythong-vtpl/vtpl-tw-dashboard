import { NextRequest, NextResponse } from 'next/server';
import { parseMjInventory } from '@/lib/mj-parser';
import { fetchShoplineProducts, updateShoplineVariation } from '@/lib/shopline';
import { SHOPLINE_RATE_LIMIT_MS } from '@/lib/config';
import { HK_SET_CONFIGS, calculateHkSetStock } from '@/lib/hk-set-config';

export const maxDuration = 60;

interface HkUpdateDetail {
  sku: string;
  productName: string;
  previousQty: number;
  newQty: number;
  isSet: boolean;
  productId: string;
  variationId: string;
}

/**
 * 홍콩 재고 배분 API (구성품 풀 기반)
 *
 * 1. MJ 엑셀 → SKU별 가용재고
 * 2. Shopline HK → 상품/옵션 목록
 * 3. 단품: MJ 재고에서 세트 소요분 제외 후 배분
 * 4. 세트: 구성품 최소값(bottleneck)으로 자동 계산
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
    const mjStockMap = new Map<string, number>();
    for (const item of mjItems) {
      mjStockMap.set(item.skuCode, item.quantity);
    }

    // Step 2: Shopline HK 상품 조회
    const shoplineProducts = await fetchShoplineProducts('HK');

    // Step 3: 모든 옵션 분류 (단품 vs 세트)
    interface VariationInfo {
      sku: string;
      productName: string;
      currentQty: number;
      productId: string;
      variationId: string;
      isSet: boolean;
      isUnlimited: boolean;
    }

    const allVariations: VariationInfo[] = [];

    for (const product of shoplineProducts) {
      const isUnlimited = (product as any).unlimited_quantity === true;
      for (const variation of product.variations) {
        const sku = variation.sku?.trim();
        if (!sku) continue;
        allVariations.push({
          sku,
          productName: product.title,
          currentQty: variation.quantity,
          productId: product._id,
          variationId: variation.id,
          isSet: sku.toUpperCase().startsWith('SET'),
          isUnlimited,
        });
      }
    }

    // Step 4: 구성품 풀 기반 배분
    // 먼저 세트별 수량 계산 (구성품 bottleneck)
    const setAllocations = new Map<string, number>();
    const setConfigs = new Map(HK_SET_CONFIGS.map(c => [c.setSku, c]));

    for (const v of allVariations) {
      if (!v.isSet) continue;
      const config = setConfigs.get(v.sku);
      if (config) {
        const maxSets = calculateHkSetStock(v.sku, mjStockMap);
        setAllocations.set(v.sku, Math.max(0, maxSets));
      }
    }

    // 세트에 사용될 구성품 수량 합산
    const componentUsedBySet = new Map<string, number>();
    for (const [setSku, setQty] of setAllocations) {
      const config = setConfigs.get(setSku);
      if (!config) continue;
      for (const comp of config.components) {
        const prev = componentUsedBySet.get(comp.sku) || 0;
        componentUsedBySet.set(comp.sku, prev + setQty * comp.quantity);
      }
    }

    // 단품 재고 = MJ 재고 - 세트 소요분
    const singleAllocations = new Map<string, number>();
    for (const v of allVariations) {
      if (v.isSet || v.isUnlimited) continue;
      const mjStock = mjStockMap.get(v.sku) || 0;
      const usedBySet = componentUsedBySet.get(v.sku) || 0;
      const available = Math.max(0, mjStock - usedBySet);
      singleAllocations.set(v.sku, available);
    }

    // Step 5: 업데이트 목록 생성
    const updates: HkUpdateDetail[] = [];
    const errors: { sku: string; error: string }[] = [];
    const skipped: { sku: string; reason: string }[] = [];
    let skippedSame = 0;
    let matchedCount = 0;
    let setCount = 0;

    for (const v of allVariations) {
      if (v.isUnlimited) {
        skipped.push({ sku: v.sku, reason: '무제한 수량' });
        continue;
      }

      let newQty: number;

      if (v.isSet) {
        const config = setConfigs.get(v.sku);
        if (!config) {
          skipped.push({ sku: v.sku, reason: '세트 매핑 없음 (hk-set-config.ts에 추가 필요)' });
          continue;
        }
        newQty = setAllocations.get(v.sku) || 0;
        setCount++;
      } else {
        if (!mjStockMap.has(v.sku)) {
          skipped.push({ sku: v.sku, reason: 'MJ 재고에 없음' });
          continue;
        }
        newQty = singleAllocations.get(v.sku) || 0;
        matchedCount++;
      }

      if (newQty === v.currentQty) {
        skippedSame++;
        continue;
      }

      if (!dryRun) {
        const result = await updateShoplineVariation(v.productId, v.variationId, newQty, 'HK');
        if (result.success) {
          updates.push({
            sku: v.sku,
            productName: v.productName,
            previousQty: v.currentQty,
            newQty,
            isSet: v.isSet,
            productId: v.productId,
            variationId: v.variationId,
          });
        } else {
          errors.push({ sku: v.sku, error: result.error || 'Unknown error' });
        }
        await new Promise(r => setTimeout(r, SHOPLINE_RATE_LIMIT_MS));
      } else {
        updates.push({
          sku: v.sku,
          productName: v.productName,
          previousQty: v.currentQty,
          newQty,
          isSet: v.isSet,
          productId: v.productId,
          variationId: v.variationId,
        });
      }
    }

    return NextResponse.json({
      success: true,
      country: 'HK',
      dryRun,
      summary: {
        mjItemCount: mjItems.length,
        shoplineVariationCount: allVariations.length,
        matched: matchedCount,
        setCount,
        updated: updates.length,
        skippedSame,
        skippedOther: skipped.length,
        errors: errors.length,
      },
      updates,
      errors,
      skipped: skipped.slice(0, 30),
      executionTimeMs: Date.now() - startTime,
    });
  } catch (err: any) {
    console.error('[HK Allocate] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
