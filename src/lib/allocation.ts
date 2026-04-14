import {
  WarehouseData,
  SkuMatch,
  AllocationResult,
} from './types/inventory';
import { Promotion, ActivePromoEffect } from './types/promo';
import { getPromoEffectForSku } from './promo';
import { CHANNEL_RATIOS } from './config';

type Channel = 'shopline' | 'shopee' | 'safety';

/**
 * 구성품 기반 재고 배분 시스템 (v2)
 *
 * 핵심 원칙:
 * 1. 구성품 풀(pool) 단위로 관리 — 같은 구성품을 쓰는 모든 상품의 배분 합 ≤ 가용재고
 * 2. 채널 비율로 먼저 풀 나누기 (SL 60% / SP 30% / SF 10%)
 * 3. 채널 풀 안에서 상품별 가중치 기반 분배 (가격 높을수록 더 많이)
 * 4. 세트 상품은 모든 구성품의 bottleneck으로 제한
 * 5. 프로모션 증정분은 사전 제외
 */
export function calculateAllocation(
  warehouseData: WarehouseData,
  matches: SkuMatch[],
  activePromos: Promotion[] = []
): AllocationResult[] {
  if (activePromos.length > 0) {
    console.log(`[Allocation] ${activePromos.length}개 프로모션 적용 중`);
  }

  // ── Step 1: 구성품 → 상품 매핑 빌드 ──
  interface ProductDemand {
    match: SkuMatch;
    components: { sku: string; qtyPerUnit: number }[];
    price: number;
    promoEffect: ActivePromoEffect | null;
  }

  const productDemands: Map<string, ProductDemand> = new Map();

  for (const match of matches) {
    const promoEffect = getPromoEffectForSku(match.sellerCode, activePromos);
    const components: { sku: string; qtyPerUnit: number }[] = [];

    if (match.isSetProduct && match.setProduct) {
      for (const comp of match.setProduct.components) {
        components.push({ sku: comp.componentSkuNo, qtyPerUnit: comp.componentQty || 1 });
      }
    } else if (match.warehouseItem) {
      components.push({ sku: match.warehouseItem.skuNo, qtyPerUnit: 1 });
    }

    productDemands.set(match.sellerCode, {
      match,
      components,
      price: match.shoplineVariation.price || 0,
      promoEffect,
    });
  }

  // ── Step 2: 구성품 풀 생성 ──
  // 각 구성품의 가용재고를 채널별로 분할
  interface ComponentPool {
    totalAvailable: number;
    pools: Record<Channel, number>;       // 채널별 총 풀
    remaining: Record<Channel, number>;   // 채널별 남은 풀
  }

  const componentPools = new Map<string, ComponentPool>();

  // 모든 구성품 식별
  const allComponentSkus = new Set<string>();
  for (const [, pd] of productDemands) {
    for (const comp of pd.components) {
      allComponentSkus.add(comp.sku);
    }
  }

  for (const compSku of allComponentSkus) {
    const warehouseItem = warehouseData.items.find(i => i.skuNo === compSku);
    let available = warehouseItem ? warehouseItem.availableStock : 0;
    available = Math.max(0, available);

    // 프로모션 증정분 사전 차감 (gift_qty)
    // 해당 구성품을 사용하는 상품 중 gift 프로모션 있으면 차감
    let giftReserveTotal = 0;
    for (const [, pd] of productDemands) {
      if (pd.promoEffect?.giftReserve && pd.promoEffect.giftReserve > 0) {
        const usesComp = pd.components.some(c => c.sku === compSku);
        if (usesComp) {
          giftReserveTotal += pd.promoEffect.giftReserve;
        }
      }
    }

    if (giftReserveTotal > 0) {
      const deducted = Math.min(giftReserveTotal, available);
      available -= deducted;
      console.log(`  [Gift] 구성품 ${compSku} 증정 제외: ${deducted}개 (남은 가용: ${available})`);
    }

    const shoplinePool = Math.floor(available * CHANNEL_RATIOS.shopline);
    const shopeePool = Math.floor(available * CHANNEL_RATIOS.shopee);
    const safetyPool = available - shoplinePool - shopeePool;

    componentPools.set(compSku, {
      totalAvailable: available,
      pools: { shopline: shoplinePool, shopee: shopeePool, safety: safetyPool },
      remaining: { shopline: shoplinePool, shopee: shopeePool, safety: safetyPool },
    });
  }

  // ── Step 3: 채널별 가중치 기반 배분 ──
  const results: AllocationResult[] = [];

  // 배분 우선순위 계산:
  // - 가격이 높을수록 가중치 높음 (매출 기여도)
  // - 단품보다 세트가 약간 높음 (객단가 높음)
  function calcWeight(pd: ProductDemand): number {
    let weight = pd.price || 100; // 기본 100
    if (pd.match.isSetProduct) weight *= 1.1; // 세트 10% 가산
    return weight;
  }

  // 각 상품의 채널별 배분량 저장
  const channelAllocations = new Map<string, Record<Channel, number>>();
  for (const [code] of productDemands) {
    channelAllocations.set(code, { shopline: 0, shopee: 0, safety: 0 });
  }

  // 채널별로 배분 실행
  const channels: Channel[] = ['shopline', 'shopee', 'safety'];

  for (const channel of channels) {
    // 이 채널에서 남은 구성품 풀 복사 (채널별 독립 계산)
    const channelRemaining = new Map<string, number>();
    for (const [sku, pool] of componentPools) {
      channelRemaining.set(sku, pool.pools[channel]);
    }

    // 동결 상품 제외한 대상 목록
    const candidates = Array.from(productDemands.entries())
      .filter(([, pd]) => !pd.promoEffect?.freeze)
      .filter(([, pd]) => pd.components.length > 0);

    // 가중치 기준 정렬 (높은 것부터)
    candidates.sort((a, b) => calcWeight(b[1]) - calcWeight(a[1]));

    // 구성품별로 해당 구성품을 사용하는 상품 수 계산
    const compProductCount = new Map<string, number>();
    for (const [, pd] of candidates) {
      for (const comp of pd.components) {
        compProductCount.set(comp.sku, (compProductCount.get(comp.sku) || 0) + 1);
      }
    }

    // 가중치 기반 비례 배분
    // 각 구성품별로, 그 구성품을 사용하는 상품들의 가중치 합 계산
    const compWeightSum = new Map<string, number>();
    for (const [, pd] of candidates) {
      const w = calcWeight(pd);
      for (const comp of pd.components) {
        compWeightSum.set(comp.sku, (compWeightSum.get(comp.sku) || 0) + w);
      }
    }

    // 각 상품이 각 구성품에서 가중치 비례로 받을 수 있는 양 계산
    // 세트는 모든 구성품의 min (bottleneck)
    for (const [code, pd] of candidates) {
      let maxUnits = Infinity;

      for (const comp of pd.components) {
        const remaining = channelRemaining.get(comp.sku) || 0;
        const totalWeight = compWeightSum.get(comp.sku) || 1;
        const myWeight = calcWeight(pd);

        // 내 가중치 비율만큼 이 구성품에서 받을 수 있는 양
        const myShare = Math.floor(remaining * (myWeight / totalWeight));
        // 구성품 소요량 고려 (x2면 절반만 만들 수 있음)
        const unitsFromThisComp = Math.floor(myShare / comp.qtyPerUnit);

        maxUnits = Math.min(maxUnits, unitsFromThisComp);
      }

      if (maxUnits === Infinity) maxUnits = 0;
      maxUnits = Math.max(0, maxUnits);

      // 배분 확정 & 구성품 풀에서 차감
      const alloc = channelAllocations.get(code)!;
      alloc[channel] = maxUnits;

      for (const comp of pd.components) {
        const consumed = maxUnits * comp.qtyPerUnit;
        const prev = channelRemaining.get(comp.sku) || 0;
        channelRemaining.set(comp.sku, prev - consumed);

        // 가중치 합에서 내 가중치 제거 (다음 순위 상품의 비율 계산용)
        const ws = compWeightSum.get(comp.sku) || 0;
        compWeightSum.set(comp.sku, ws - calcWeight(pd));
      }
    }

    // 남은 풀 재분배 (bottleneck으로 인해 남은 구성품 → 단품에 추가)
    let redistributed = true;
    let iterations = 0;
    while (redistributed && iterations < 5) {
      redistributed = false;
      iterations++;

      for (const [code, pd] of candidates) {
        // 단품만 재분배 대상 (세트는 bottleneck 때문에 추가 어려움)
        if (pd.match.isSetProduct) continue;
        if (pd.components.length !== 1) continue;

        const comp = pd.components[0];
        const remaining = channelRemaining.get(comp.sku) || 0;
        if (remaining <= 0) continue;

        // 이 구성품을 쓰는 다른 상품이 모두 배분 완료됐으면, 남은 걸 이 단품에 추가
        const otherUsers = candidates.filter(([c, p]) =>
          c !== code && p.components.some(cc => cc.sku === comp.sku)
        );
        const othersFullyAllocated = otherUsers.every(([c]) => {
          const oa = channelAllocations.get(c)!;
          return oa[channel] > 0; // 이미 배분 받았으면
        });

        if (othersFullyAllocated || otherUsers.length === 0) {
          const alloc = channelAllocations.get(code)!;
          const extra = Math.floor(remaining / comp.qtyPerUnit);
          if (extra > 0) {
            alloc[channel] += extra;
            channelRemaining.set(comp.sku, remaining - extra * comp.qtyPerUnit);
            redistributed = true;
          }
        }
      }
    }
  }

  // ── Step 4: 결과 조립 ──
  for (const [code, pd] of productDemands) {
    const alloc = channelAllocations.get(code)!;
    const productName =
      pd.match.warehouseItem?.productName ||
      pd.match.setProduct?.setName ||
      pd.match.shoplineProduct.title ||
      'Unknown';

    // 동결 상품
    if (pd.promoEffect?.freeze) {
      results.push({
        sellerCode: code,
        productName,
        isSetProduct: pd.match.isSetProduct,
        warehouseAvailableStock: pd.match.warehouseAvailableStock,
        shoplineAllocation: 0,
        shopeeAllocation: 0,
        safetyStock: 0,
        currentShoplineStock: pd.match.shoplineVariation.quantity,
        shoplineProductId: pd.match.shoplineProduct._id,
        shoplineVariationId: pd.match.shoplineVariation.id,
        frozen: true,
        promoNote: pd.promoEffect.note,
      });
      continue;
    }

    results.push({
      sellerCode: code,
      productName,
      isSetProduct: pd.match.isSetProduct,
      warehouseAvailableStock: pd.match.warehouseAvailableStock,
      shoplineAllocation: alloc.shopline,
      shopeeAllocation: alloc.shopee,
      safetyStock: alloc.safety,
      currentShoplineStock: pd.match.shoplineVariation.quantity,
      shoplineProductId: pd.match.shoplineProduct._id,
      shoplineVariationId: pd.match.shoplineVariation.id,
      giftReserve: pd.promoEffect?.giftReserve || 0,
      promoNote: pd.promoEffect?.note,
    });
  }

  // ── Step 5: 요약 로그 ──
  console.log(`\n[Allocation] Calculated allocations for ${results.length} SKUs`);
  const totalShopline = results.reduce((s, r) => s + r.shoplineAllocation, 0);
  const totalShopee = results.reduce((s, r) => s + r.shopeeAllocation, 0);
  const totalSafety = results.reduce((s, r) => s + r.safetyStock, 0);
  const totalGiftReserve = results.reduce((s, r) => s + (r.giftReserve || 0), 0);
  const frozenCount = results.filter((r) => r.frozen).length;

  console.log(`  Shopline total: ${totalShopline}`);
  console.log(`  Shopee total: ${totalShopee}`);
  console.log(`  Safety stock total: ${totalSafety}`);
  if (totalGiftReserve > 0) console.log(`  증정 제외 total: ${totalGiftReserve}`);
  if (frozenCount > 0) console.log(`  동결 SKU: ${frozenCount}개`);

  // 초과 배분 검증
  let overAllocCount = 0;
  for (const [compSku, pool] of componentPools) {
    let totalConsumed = 0;
    for (const [code, pd] of productDemands) {
      const compUsage = pd.components.find(c => c.sku === compSku);
      if (!compUsage) continue;
      const alloc = channelAllocations.get(code)!;
      const consumed = (alloc.shopline + alloc.shopee + alloc.safety) * compUsage.qtyPerUnit;
      totalConsumed += consumed;
    }
    if (totalConsumed > pool.totalAvailable) {
      const item = warehouseData.items.find(i => i.skuNo === compSku);
      console.warn(`  ⚠️ 초과배분: ${compSku} (${item?.productName || '?'}) - 가용: ${pool.totalAvailable}, 배분합: ${totalConsumed}`);
      overAllocCount++;
    }
  }
  if (overAllocCount === 0) {
    console.log(`  ✅ 구성품 초과배분 없음`);
  }

  return results;
}
