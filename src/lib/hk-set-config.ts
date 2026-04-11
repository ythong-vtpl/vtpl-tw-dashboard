/**
 * 홍콩 Shopline 세트 상품 구성 매핑
 *
 * SET SKU → 구성품 SKU + 수량
 * MJ 재고에서 구성품별 가용재고를 확인하고, min(구성품재고/수량)으로 세트 가용재고 계산
 */
export interface HkSetComponent {
  sku: string;      // MJ 단품 SKU
  quantity: number;  // 세트 1개당 필요 수량
}

export interface HkSetConfig {
  setSku: string;
  setName: string;
  components: HkSetComponent[];
}

/**
 * 홍콩 세트 상품 구성 정의
 *
 * ⚠️ 새로운 세트 상품 추가 시 여기에 매핑을 추가해야 합니다.
 */
export const HK_SET_CONFIGS: HkSetConfig[] = [
  // ── S-EGF 앰플 세트 ──
  {
    setSku: 'SET26462802',
    setName: 'S-EGF 앰플 2병',
    components: [{ sku: '8809603934628', quantity: 2 }],
  },
  {
    setSku: 'SET26462803',
    setName: 'S-EGF 앰플 3병',
    components: [{ sku: '8809603934628', quantity: 3 }],
  },

  // ── 服貼底妝套裝 (핑크에센스 본품 + 프라이머) ──
  {
    setSku: 'SET251011119',
    setName: '핑크에센스 19호 + 프라이머',
    components: [
      { sku: '8809603933935', quantity: 1 }, // 핑크에센스 19
      { sku: '8809603933218', quantity: 1 }, // 프라이머
    ],
  },
  {
    setSku: 'SET251011121',
    setName: '핑크에센스 21호 + 프라이머',
    components: [
      { sku: '8809603933904', quantity: 1 }, // 핑크에센스 21
      { sku: '8809603933218', quantity: 1 }, // 프라이머
    ],
  },
  {
    setSku: 'SET251011123',
    setName: '핑크에센스 23호 + 프라이머',
    components: [
      { sku: '8809603933911', quantity: 1 }, // 핑크에센스 23
      { sku: '8809603933218', quantity: 1 }, // 프라이머
    ],
  },
  {
    setSku: 'SET25101115',
    setName: '핑크에센스 25호 + 프라이머',
    components: [
      { sku: '8809603933942', quantity: 1 }, // 핑크에센스 25
      { sku: '8809603933218', quantity: 1 }, // 프라이머
    ],
  },

  // ── 粉嫩精華遮瑕氣墊套裝 (본품 + 리필) ──
  {
    setSku: 'SETREF2505119',
    setName: '핑크에센스 19호 + 리필',
    components: [
      { sku: '8809603933935', quantity: 1 }, // 본품 19
      { sku: '8809603933843', quantity: 1 }, // 리필 19
    ],
  },
  {
    setSku: 'SETREF2505121',
    setName: '핑크에센스 21호 + 리필',
    components: [
      { sku: '8809603933904', quantity: 1 }, // 본품 21
      { sku: '8809603933850', quantity: 1 }, // 리필 21
    ],
  },
  {
    setSku: 'SETREF2505123',
    setName: '핑크에센스 23호 + 리필',
    components: [
      { sku: '8809603933911', quantity: 1 }, // 본품 23
      { sku: '8809603933867', quantity: 1 }, // 리필 23
    ],
  },
  {
    setSku: 'SETREF2505125',
    setName: '핑크에센스 25호 + 리필',
    components: [
      { sku: '8809603933942', quantity: 1 }, // 본품 25
      { sku: '8809603933874', quantity: 1 }, // 리필 25
    ],
  },

  // ── 完美底妝套裝 (본품 + 세범컨트롤팩트) ──
  {
    setSku: 'SET2024127419',
    setName: '핑크에센스 19호 + 세범팩트',
    components: [
      { sku: '8809603933935', quantity: 1 }, // 핑크에센스 19
      { sku: '8809603933669', quantity: 1 }, // 세범팩트
    ],
  },
  {
    setSku: 'SET2024127421',
    setName: '핑크에센스 21호 + 세범팩트',
    components: [
      { sku: '8809603933904', quantity: 1 },
      { sku: '8809603933669', quantity: 1 },
    ],
  },
  {
    setSku: 'SET2024127423',
    setName: '핑크에센스 23호 + 세범팩트',
    components: [
      { sku: '8809603933911', quantity: 1 },
      { sku: '8809603933669', quantity: 1 },
    ],
  },
  {
    setSku: 'SET2024127425',
    setName: '핑크에센스 25호 + 세범팩트',
    components: [
      { sku: '8809603933942', quantity: 1 },
      { sku: '8809603933669', quantity: 1 },
    ],
  },

  // ── 防水眼線筆 3pcs SET ──
  {
    setSku: 'SET2510061011',
    setName: '아이라이너 01 美珠 (06+10+11)',
    components: [
      { sku: '8809603933492', quantity: 1 }, // 06
      { sku: '8809603933539', quantity: 1 }, // 10 - 이 SKU는 MJ에 없을 수 있음, 확인 필요
      { sku: '8809603933546', quantity: 1 }, // 11
    ],
  },
  {
    setSku: 'SET2500141516',
    setName: '아이라이너 02 Breeze (14+15+16)',
    components: [
      { sku: '8809603933577', quantity: 1 }, // 14
      { sku: '8809603933584', quantity: 1 }, // 15
      { sku: '8809603934017', quantity: 1 }, // 16 (04 NEW)
    ],
  },
  {
    setSku: 'SET2500091315',
    setName: '아이라이너 03 My Day (09+13+15)',
    components: [
      { sku: '8809603933522', quantity: 1 }, // 09
      { sku: '8809603933560', quantity: 1 }, // 13
      { sku: '8809603933584', quantity: 1 }, // 15
    ],
  },
  {
    setSku: 'SET2500000389',
    setName: '아이라이너 04 Weekday (03+08+09)',
    components: [
      { sku: '8809603933461', quantity: 1 }, // 03
      { sku: '8809603933515', quantity: 1 }, // 08
      { sku: '8809603933522', quantity: 1 }, // 09
    ],
  },
  {
    setSku: 'SET2500004610',
    setName: '아이라이너 05 Glow (04+06+10)',
    components: [
      { sku: '8809603933478', quantity: 1 }, // 04
      { sku: '8809603933492', quantity: 1 }, // 06
      { sku: '8809603933539', quantity: 1 }, // 10 - 확인 필요
    ],
  },
  {
    setSku: 'SET2510000345',
    setName: '아이라이너 06 Mellow (03+04+05)',
    components: [
      { sku: '8809603933461', quantity: 1 }, // 03
      { sku: '8809603933478', quantity: 1 }, // 04
      { sku: '8809603933485', quantity: 1 }, // 05
    ],
  },
];

/**
 * MJ 재고에서 세트 가용재고 계산
 * = min(구성품 재고 / 구성품 필요수량)
 */
export function calculateHkSetStock(
  setSku: string,
  mjStockMap: Map<string, number>
): number {
  const config = HK_SET_CONFIGS.find(c => c.setSku === setSku);
  if (!config) return -1; // 매핑 없음

  let minSets = Infinity;
  for (const comp of config.components) {
    const available = mjStockMap.get(comp.sku) || 0;
    const possibleSets = Math.floor(available / comp.quantity);
    minSets = Math.min(minSets, possibleSets);
  }

  return minSets === Infinity ? 0 : minSets;
}
