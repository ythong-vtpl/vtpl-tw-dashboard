/** 지원 국가 */
export type Country = 'TW' | 'HK';

/** 국가별 설정 */
export const COUNTRY_CONFIG: Record<Country, {
  label: string;
  flag: string;
  currency: string;
  currencySymbol: string;
  shoplineTokenEnv: string;
  channels: string[];
  channelRatios: { shopline: number; shopee: number; safety: number };
}> = {
  TW: {
    label: '대만',
    flag: '🇹🇼',
    currency: 'TWD',
    currencySymbol: 'NT$',
    shoplineTokenEnv: 'SHOPLINE_TW_ACCESS_TOKEN',
    channels: ['shopline', 'shopee'],
    channelRatios: { shopline: 0.6, shopee: 0.3, safety: 0.1 },
  },
  HK: {
    label: '홍콩',
    flag: '🇭🇰',
    currency: 'HKD',
    currencySymbol: 'HK$',
    shoplineTokenEnv: 'SHOPLINE_HK_ACCESS_TOKEN',
    channels: ['shopline'],
    channelRatios: { shopline: 0.9, shopee: 0, safety: 0.1 },
  },
};

/** 기본 채널 배분 비율 (대만 기본값, 하위 호환) */
export const CHANNEL_RATIOS = COUNTRY_CONFIG.TW.channelRatios;

/** Minimum percentage of channel allocation for each variant type (single vs set) */
export const MIN_VARIANT_TYPE_RATIO = 0.1;

/** Shopline API base URL */
export const SHOPLINE_API_BASE = 'https://open.shopline.io';

/** Rate limit delay between Shopline API calls (ms) */
export const SHOPLINE_RATE_LIMIT_MS = 300;

/** 국가별 Shopline 토큰 가져오기 */
export function getShoplineToken(country: Country): string {
  const envKey = COUNTRY_CONFIG[country].shoplineTokenEnv;
  return process.env[envKey] || '';
}
