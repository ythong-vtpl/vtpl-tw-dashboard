import { NextRequest, NextResponse } from 'next/server';
import { parseMjInventory } from '@/lib/mj-parser';
import { fetchShoplineProducts, updateShoplineVariation } from '@/lib/shopline';
import { SHOPLINE_RATE_LIMIT_MS } from '@/lib/config';
import { HK_SET_MAP } from '@/lib/hk-set-config';

export const maxDuration = 60;

const SAFETY_STOCK_RATIO = 0.05; // 안전재고 5%

interface VInfo {
  sku: string;
  title: string;
  field: string;
  current: number;
  price: number;
  productId: string;
  variationId: string;
  isSet: boolean;
  unlimited: boolean;
  status: string;
}

/**
 * 홍콩 재고 배분 API (구성품 풀 기반)
 *
 * 1. MJ 재고 × 95% (안전재고 5%)
 * 2. FLASH DEAL 우선 배분 (고정 수량)
 * 3. 나머지: 구성품 풀 기반 가격 가중치 배분
 *    - 세트 가중치 1.3x (비밀링크 포함)
 *    - 단품에도 적절히 배분 (0으로 만들지 않음)
 * 4. 04 아이펜슬 합산 (8809603934017 + 8809603933478)
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

    // Step 1: MJ 재고 파싱 + 안전재고 5% 적용
    const mjItems = await parseMjInventory(mjBuffer);
    const rawPool = new Map<string, number>();
    for (const item of mjItems) rawPool.set(item.skuCode, (rawPool.get(item.skuCode) || 0) + item.quantity);

    // 04 합산
    const wp04 = (rawPool.get('8809603934017') || 0) + (rawPool.get('8809603933478') || 0);
    rawPool.set('8809603934017', wp04);
    rawPool.set('8809603933478', wp04);

    // 안전재고 적용
    const pool = new Map<string, number>();
    for (const [sku, qty] of rawPool) pool.set(sku, Math.floor(qty * (1 - SAFETY_STOCK_RATIO)));

    // Step 2: Shopline HK (active + hidden)
    const shoplineProducts = await fetchShoplineProducts('HK');

    const allVars: VInfo[] = [];
    for (const p of shoplineProducts) {
      for (const v of p.variations) {
        const sku = v.sku?.trim();
        if (!sku) continue;
        allVars.push({
          sku,
          title: p.title,
          field: v.fieldName || '',
          current: v.quantity,
          price: v.price,
          productId: p._id,
          variationId: v.id,
          isSet: sku.toUpperCase().startsWith('SET'),
          unlimited: !!(p as any).unlimited_quantity,
          status: p.status,
        });
      }
    }

    // Step 3: 구성품 풀 기반 배분
    const remaining = new Map(pool);
    const allocations = new Map<string, number>();

    const deduct = (sku: string, qty: number) => {
      remaining.set(sku, Math.max(0, (remaining.get(sku) || 0) - qty));
    };

    const getSetMax = (setSku: string): number => {
      const config = HK_SET_MAP.get(setSku);
      if (!config) return 0;
      let min = Infinity;
      for (const c of config.components) {
        min = Math.min(min, Math.floor((remaining.get(c.sku) || 0) / c.quantity));
      }
      return min === Infinity ? 0 : Math.max(0, min);
    };

    const allocSet = (setSku: string, qty: number) => {
      const config = HK_SET_MAP.get(setSku);
      if (!config) return;
      for (const c of config.components) deduct(c.sku, qty * c.quantity);
    };

    // 세트 가중치 1.3x
    const calcWeight = (v: VInfo): number => {
      let w = v.price || 100;
      if (v.isSet) w *= 1.3;
      return w;
    };

    // TODO: FLASH DEAL 로직은 프로모션 기간에만 적용
    // 현재는 일반 풀 배분으로 처리

    // 풀 배분: 세트 + 단품
    const unalloc = allVars.filter(v => !allocations.has(v.variationId) && !v.unlimited);
    const compUsers = new Map<string, VInfo[]>();

    for (const v of unalloc) {
      if (v.isSet) {
        const config = HK_SET_MAP.get(v.sku);
        if (!config) { allocations.set(v.variationId, 0); continue; }
        for (const c of config.components) {
          if (!compUsers.has(c.sku)) compUsers.set(c.sku, []);
          compUsers.get(c.sku)!.push(v);
        }
      } else {
        if (!compUsers.has(v.sku)) compUsers.set(v.sku, []);
        compUsers.get(v.sku)!.push(v);
      }
    }

    for (const v of unalloc) {
      if (allocations.has(v.variationId)) continue;

      if (v.isSet) {
        const config = HK_SET_MAP.get(v.sku);
        if (!config) { allocations.set(v.variationId, 0); continue; }

        let maxSets = Infinity;
        for (const c of config.components) {
          const r = remaining.get(c.sku) || 0;
          const users = compUsers.get(c.sku) || [];
          const totalWeight = users.reduce((s, u) => s + calcWeight(u), 0);
          const myWeight = calcWeight(v);
          const myShare = totalWeight > 0 ? Math.floor(r * (myWeight / totalWeight)) : 0;
          maxSets = Math.min(maxSets, Math.floor(myShare / c.quantity));
        }
        if (maxSets === Infinity) maxSets = 0;
        allocations.set(v.variationId, Math.max(0, maxSets));
        if (maxSets > 0) allocSet(v.sku, maxSets);
      } else {
        const r = remaining.get(v.sku) || 0;
        const users = compUsers.get(v.sku) || [];
        const totalWeight = users.reduce((s, u) => s + calcWeight(u), 0);
        const myWeight = calcWeight(v);
        const myShare = totalWeight > 0 ? Math.floor(r * (myWeight / totalWeight)) : r;
        allocations.set(v.variationId, Math.max(0, myShare));
        if (myShare > 0) deduct(v.sku, myShare);
      }
    }

    // Step 4: 업데이트
    const updates: any[] = [];
    const errors: any[] = [];
    let skippedCount = 0;

    for (const v of allVars) {
      if (v.unlimited) continue;
      const newQty = allocations.get(v.variationId) ?? v.current;
      if (newQty === v.current) { skippedCount++; continue; }

      if (!dryRun) {
        const result = await updateShoplineVariation(v.productId, v.variationId, newQty, 'HK');
        if (result.success) {
          updates.push({ sku: v.sku, productName: v.title, previousQty: v.current, newQty, isSet: v.isSet });
        } else {
          errors.push({ sku: v.sku, error: result.error || 'Unknown' });
        }
        await new Promise(r => setTimeout(r, SHOPLINE_RATE_LIMIT_MS));
      } else {
        updates.push({ sku: v.sku, productName: v.title, previousQty: v.current, newQty, isSet: v.isSet });
      }
    }

    return NextResponse.json({
      success: true,
      country: 'HK',
      dryRun,
      summary: {
        mjItemCount: mjItems.length,
        shoplineVariationCount: allVars.length,
        safetyStockPercent: SAFETY_STOCK_RATIO * 100,
        updated: updates.length,
        skippedSame: skippedCount,
        errors: errors.length,
      },
      updates,
      errors,
      executionTimeMs: Date.now() - startTime,
    });
  } catch (err: any) {
    console.error('[HK Allocate] Error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
