/**
 * Promotion types for inventory allocation adjustments.
 */

/** Promotion type */
export type PromoType =
  | 'gift'           // 증정 - 해당 수량 제외 후 배분
  | 'discount'       // 할인 행사 - 해당 채널 비율 상향
  | 'shopee_promo'   // 쇼피 행사 - 쇼피 비율 상향
  | 'shopline_promo' // 샵라인 행사 - 샵라인 비율 상향
  | 'clearance'      // 단종/소진 - safety 0%, 전량 배분
  | 'freeze';        // 재고 동결 - 배분 제외

/** Priority level for allocation ratio adjustment */
export type Priority = 'critical' | 'high' | 'medium' | 'low' | 'shopee_focus';

/** Single promotion definition */
export interface Promotion {
  id: string;
  channel: 'shopline' | 'shopee' | 'all';
  start: string;       // YYYY-MM-DD
  end: string;         // YYYY-MM-DD
  type: PromoType;
  affected_skus: string[];  // empty = 전체 적용
  gift_qty?: number;        // 증정 시 제외할 수량
  priority?: Priority;      // 배분 비율 조정
  note: string;
}

/** Promo config file structure */
export interface PromoConfig {
  promos: Promotion[];
}

/** Active promo result applied to a specific SKU */
export interface ActivePromoEffect {
  promoId: string;
  type: PromoType;
  note: string;
  giftReserve: number;       // 증정 제외 수량
  shoplineRatio: number;     // 조정된 비율
  shopeeRatio: number;
  safetyRatio: number;
  freeze: boolean;           // true면 배분 제외
}

/** Channel ratio override */
export interface ChannelRatioOverride {
  shopline: number;
  shopee: number;
  safety: number;
}

/** Priority-based ratio presets */
export const PRIORITY_RATIOS: Record<Priority, ChannelRatioOverride> = {
  critical:     { shopline: 0.70, shopee: 0.25, safety: 0.05 },
  high:         { shopline: 0.65, shopee: 0.30, safety: 0.05 },
  medium:       { shopline: 0.60, shopee: 0.30, safety: 0.10 },
  low:          { shopline: 0.50, shopee: 0.30, safety: 0.20 },
  shopee_focus: { shopline: 0.40, shopee: 0.50, safety: 0.10 },
};

/** Promo type default ratio adjustments */
export const PROMO_TYPE_RATIOS: Partial<Record<PromoType, ChannelRatioOverride>> = {
  shopee_promo:   { shopline: 0.40, shopee: 0.50, safety: 0.10 },
  shopline_promo: { shopline: 0.70, shopee: 0.25, safety: 0.05 },
  clearance:      { shopline: 0.55, shopee: 0.45, safety: 0.00 },
};
