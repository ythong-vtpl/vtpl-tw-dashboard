import {
  Promotion,
  PromoConfig,
  ActivePromoEffect,
  ChannelRatioOverride,
  PRIORITY_RATIOS,
  PROMO_TYPE_RATIOS,
} from './types/promo';
import { CHANNEL_RATIOS } from './config';
import { loadPromosFromGoogleSheets } from './google-sheets-promo';

/**
 * No local promos file in dashboard — Google Sheets only.
 */
function loadLocalPromos(): Promotion[] {
  // Dashboard에서는 promos.json 사용 안 함 (Google Sheets 전용)
  return [];
}


/**
 * Load promotions from all sources (local + Google Sheets).
 * Google Sheets promos take priority for duplicate IDs.
 */
export async function loadPromos(): Promise<Promotion[]> {
  const localPromos = loadLocalPromos();

  // Try Google Sheets (non-blocking - falls back gracefully)
  let sheetPromos: Promotion[] = [];
  try {
    sheetPromos = await loadPromosFromGoogleSheets();
  } catch (err: any) {
    console.warn(`[Promo] Google Sheets 로드 실패: ${err.message}`);
  }

  const allPromos = [...localPromos, ...sheetPromos];

  if (allPromos.length === 0) {
    console.log('[Promo] 프로모션 없음 - 기본 비율 적용');
  } else {
    console.log(`[Promo] 총 ${allPromos.length}개 프로모션 (로컬: ${localPromos.length}, 시트: ${sheetPromos.length})`);
  }

  return allPromos;
}

/**
 * Filter active promotions for today's date.
 */
export function getActivePromos(promos: Promotion[], today?: string): Promotion[] {
  const todayStr = today || new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const active = promos.filter((p) => {
    return p.start <= todayStr && todayStr <= p.end;
  });

  if (active.length > 0) {
    console.log(`[Promo] 오늘(${todayStr}) 활성 프로모션: ${active.length}개`);
    for (const p of active) {
      console.log(`  - [${p.type}] ${p.note} (${p.start} ~ ${p.end})`);
      if (p.type === 'gift' && p.gift_qty) {
        console.log(`    증정 제외: ${p.gift_qty}개 (SKU: ${p.affected_skus.join(', ')})`);
      }
    }
  } else {
    console.log(`[Promo] 오늘(${todayStr}) 활성 프로모션 없음 - 기본 비율 적용`);
  }

  return active;
}

/**
 * Calculate the combined promo effect for a specific SKU.
 * Multiple promos can stack (gift reserves add up, ratios use the most impactful one).
 */
export function getPromoEffectForSku(
  sku: string,
  activePromos: Promotion[]
): ActivePromoEffect | null {
  // Find promos that affect this SKU
  const applicablePromos = activePromos.filter((p) => {
    // Empty affected_skus = applies to all SKUs
    if (p.affected_skus.length === 0) return true;
    return p.affected_skus.includes(sku);
  });

  if (applicablePromos.length === 0) return null;

  // Start with default ratios
  let ratios: ChannelRatioOverride = { ...CHANNEL_RATIOS };
  let totalGiftReserve = 0;
  let freeze = false;
  const notes: string[] = [];
  const promoIds: string[] = [];

  for (const promo of applicablePromos) {
    promoIds.push(promo.id);
    notes.push(promo.note);

    // Handle freeze
    if (promo.type === 'freeze') {
      freeze = true;
      continue;
    }

    // Handle gift reserve
    if (promo.type === 'gift' && promo.gift_qty) {
      totalGiftReserve += promo.gift_qty;
    }

    // Handle ratio adjustments
    // Priority: explicit priority > promo type default > current ratios
    if (promo.priority && PRIORITY_RATIOS[promo.priority]) {
      const priorityRatio = PRIORITY_RATIOS[promo.priority];
      // Use the most aggressive ratio (highest for the target channel)
      ratios = pickMoreAggressiveRatio(ratios, priorityRatio, promo.channel);
    } else if (PROMO_TYPE_RATIOS[promo.type]) {
      const typeRatio = PROMO_TYPE_RATIOS[promo.type]!;
      ratios = pickMoreAggressiveRatio(ratios, typeRatio, promo.channel);
    }
  }

  return {
    promoId: promoIds.join('+'),
    type: applicablePromos[0].type,
    note: notes.join(' / '),
    giftReserve: totalGiftReserve,
    shoplineRatio: ratios.shopline,
    shopeeRatio: ratios.shopee,
    safetyRatio: ratios.safety,
    freeze,
  };
}

/**
 * Pick the more aggressive ratio based on channel focus.
 */
function pickMoreAggressiveRatio(
  current: ChannelRatioOverride,
  candidate: ChannelRatioOverride,
  channel: 'shopline' | 'shopee' | 'all'
): ChannelRatioOverride {
  if (channel === 'shopline') {
    // If shopline promo, prefer higher shopline ratio
    return candidate.shopline >= current.shopline ? candidate : current;
  } else if (channel === 'shopee') {
    // If shopee promo, prefer higher shopee ratio
    return candidate.shopee >= current.shopee ? candidate : current;
  }
  // For 'all', just use the candidate (latest promo wins)
  return candidate;
}

/**
 * Generate a summary of active promotions for Slack report.
 */
export function getPromoSummaryForSlack(activePromos: Promotion[]): string[] {
  if (activePromos.length === 0) return [];

  return activePromos.map((p) => {
    let line = `[${p.type}] ${p.note} (${p.start}~${p.end})`;
    if (p.type === 'gift' && p.gift_qty) {
      line += ` | 증정 제외: ${p.gift_qty}개`;
    }
    if (p.affected_skus.length > 0) {
      line += ` | SKU: ${p.affected_skus.slice(0, 3).join(', ')}`;
      if (p.affected_skus.length > 3) line += ` 외 ${p.affected_skus.length - 3}개`;
    }
    return line;
  });
}
