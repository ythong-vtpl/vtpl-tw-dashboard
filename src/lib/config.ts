/** Channel allocation ratios (must sum to 1.0) */
export const CHANNEL_RATIOS = {
  shopline: 0.6,
  shopee: 0.3,
  safety: 0.1,
} as const;

/** Minimum percentage of channel allocation for each variant type (single vs set) */
export const MIN_VARIANT_TYPE_RATIO = 0.1;

/** Shopline API base URL */
export const SHOPLINE_API_BASE = 'https://open.shopline.io';

/** Rate limit delay between Shopline API calls (ms) */
export const SHOPLINE_RATE_LIMIT_MS = 300;
