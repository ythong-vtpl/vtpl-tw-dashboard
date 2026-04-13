/**
 * 홍콩 Shopline 세트 상품 구성 매핑
 *
 * SET SKU → 구성품 SKU + 수량
 * MJ 재고에서 구성품별 가용재고를 확인하고, min(구성품재고/수량)으로 세트 가용재고 계산
 *
 * ⚠️ 새로운 세트 상품 추가 시 여기에 매핑을 추가해야 합니다.
 */
export interface HkSetComponent {
  sku: string;
  quantity: number;
}

export interface HkSetConfig {
  setSku: string;
  setName: string;
  components: HkSetComponent[];
}

export const HK_SET_CONFIGS: HkSetConfig[] = [
  // ── S-EGF 앰플 세트 ──
  { setSku: 'SET26462802', setName: '앰플 2병', components: [{ sku: '8809603934628', quantity: 2 }] },
  { setSku: 'SET26462803', setName: '앰플 3병', components: [{ sku: '8809603934628', quantity: 3 }] },
  { setSku: 'SET2026041315', setName: '앰플 3병 + 샤쉐 7개', components: [{ sku: '8809603934628', quantity: 3 }] }, // 샤쉐는 무제한

  // ── 리필 3개 세트 (세트 1개 = 리필 3개 소진) ──
  { setSku: 'SET2026041311', setName: '리필19 x3', components: [{ sku: '8809603933843', quantity: 3 }] },
  { setSku: 'SET2026041312', setName: '리필21 x3', components: [{ sku: '8809603933850', quantity: 3 }] },
  { setSku: 'SET2026041313', setName: '리필23 x3', components: [{ sku: '8809603933867', quantity: 3 }] },
  { setSku: 'SET2026041314', setName: '리필25 x3', components: [{ sku: '8809603933874', quantity: 3 }] },

  // ── PERFECT COVER SET = 服貼底妝套裝 (본품 + 프라이머) ──
  { setSku: 'SET251011119', setName: 'PERFECT COVER 19', components: [{ sku: '8809603933935', quantity: 1 }, { sku: '8809603933218', quantity: 1 }] },
  { setSku: 'SET251011121', setName: 'PERFECT COVER 21', components: [{ sku: '8809603933904', quantity: 1 }, { sku: '8809603933218', quantity: 1 }] },
  { setSku: 'SET251011123', setName: 'PERFECT COVER 23', components: [{ sku: '8809603933911', quantity: 1 }, { sku: '8809603933218', quantity: 1 }] },
  { setSku: 'SET25101115', setName: 'PERFECT COVER 25', components: [{ sku: '8809603933942', quantity: 1 }, { sku: '8809603933218', quantity: 1 }] },

  // ── PERFECT BASE SET = 完美底妝套裝 (본품 + 세범팩트) ──
  { setSku: 'SET2024127419', setName: 'PERFECT BASE 19', components: [{ sku: '8809603933935', quantity: 1 }, { sku: '8809603933669', quantity: 1 }] },
  { setSku: 'SET2024127421', setName: 'PERFECT BASE 21', components: [{ sku: '8809603933904', quantity: 1 }, { sku: '8809603933669', quantity: 1 }] },
  { setSku: 'SET2024127423', setName: 'PERFECT BASE 23', components: [{ sku: '8809603933911', quantity: 1 }, { sku: '8809603933669', quantity: 1 }] },
  { setSku: 'SET2024127425', setName: 'PERFECT BASE 25', components: [{ sku: '8809603933942', quantity: 1 }, { sku: '8809603933669', quantity: 1 }] },

  // ── 핑에 본품+리필 세트 ──
  { setSku: 'SETREF2505119', setName: '핑에19 본품+리필', components: [{ sku: '8809603933935', quantity: 1 }, { sku: '8809603933843', quantity: 1 }] },
  { setSku: 'SETREF2505121', setName: '핑에21 본품+리필', components: [{ sku: '8809603933904', quantity: 1 }, { sku: '8809603933850', quantity: 1 }] },
  { setSku: 'SETREF2505123', setName: '핑에23 본품+리필', components: [{ sku: '8809603933911', quantity: 1 }, { sku: '8809603933867', quantity: 1 }] },
  { setSku: 'SETREF2505125', setName: '핑에25 본품+리필', components: [{ sku: '8809603933942', quantity: 1 }, { sku: '8809603933874', quantity: 1 }] },

  // ── 신년한정 본품+리필x2 (hidden) ──
  { setSku: 'SETREF2507119', setName: '신년한정19 본품+리필x2', components: [{ sku: '8809603933935', quantity: 1 }, { sku: '8809603933843', quantity: 2 }] },
  { setSku: 'SETREF2507121', setName: '신년한정21 본품+리필x2', components: [{ sku: '8809603933904', quantity: 1 }, { sku: '8809603933850', quantity: 2 }] },
  { setSku: 'SETREF2507123', setName: '신년한정23 본품+리필x2', components: [{ sku: '8809603933911', quantity: 1 }, { sku: '8809603933867', quantity: 2 }] },
  { setSku: 'SETREF2507125', setName: '신년한정25 본품+리필x2', components: [{ sku: '8809603933942', quantity: 1 }, { sku: '8809603933874', quantity: 2 }] },

  // ── 아이라이너 3pcs SET ──
  { setSku: 'SET2510061011', setName: '아이라이너 01 (06+10+11)', components: [{ sku: '8809603933492', quantity: 1 }, { sku: '8809603933539', quantity: 1 }, { sku: '8809603933546', quantity: 1 }] },
  { setSku: 'SET2500141516', setName: '아이라이너 02 (14+15+16)', components: [{ sku: '8809603933577', quantity: 1 }, { sku: '8809603933584', quantity: 1 }, { sku: '8809603934017', quantity: 1 }] },
  { setSku: 'SET2500091315', setName: '아이라이너 03 (09+13+15)', components: [{ sku: '8809603933522', quantity: 1 }, { sku: '8809603933560', quantity: 1 }, { sku: '8809603933584', quantity: 1 }] },
  { setSku: 'SET2500000389', setName: '아이라이너 04 (03+08+09)', components: [{ sku: '8809603933461', quantity: 1 }, { sku: '8809603933515', quantity: 1 }, { sku: '8809603933522', quantity: 1 }] },
  { setSku: 'SET2500004610', setName: '아이라이너 05 (04+06+10)', components: [{ sku: '8809603933478', quantity: 1 }, { sku: '8809603933492', quantity: 1 }, { sku: '8809603933539', quantity: 1 }] },
  { setSku: 'SET2510000345', setName: '아이라이너 06 (03+04+05)', components: [{ sku: '8809603933461', quantity: 1 }, { sku: '8809603933478', quantity: 1 }, { sku: '8809603933485', quantity: 1 }] },
];

/** SET SKU → 구성품 매핑 (빠른 조회용) */
export const HK_SET_MAP = new Map(HK_SET_CONFIGS.map(c => [c.setSku, c]));

/**
 * MJ 재고에서 세트 가용재고 계산
 */
export function calculateHkSetStock(
  setSku: string,
  mjStockMap: Map<string, number>
): number {
  const config = HK_SET_MAP.get(setSku);
  if (!config) return -1;

  let minSets = Infinity;
  for (const comp of config.components) {
    const available = mjStockMap.get(comp.sku) || 0;
    const possibleSets = Math.floor(available / comp.quantity);
    minSets = Math.min(minSets, possibleSets);
  }

  return minSets === Infinity ? 0 : minSets;
}
