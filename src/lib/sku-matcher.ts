import {
  WarehouseData,
  ShoplineProduct,
  SkuMatch,
} from './types/inventory';

export interface MatchResult {
  matched: SkuMatch[];
  unmatchedShoplineSkus: string[];
  unmatchedWarehouseSkus: string[];
}

/**
 * Match Shopline product variations to warehouse inventory by seller code / SKU.
 *
 * Matching rule: TraxLogistics `판매자 정의 코드` (sellerCode) === Shopline variation `sku`
 *
 * For set products, sellerCode format is typically like "8809603933423-2" (with a suffix).
 */
export function matchSkus(
  warehouseData: WarehouseData,
  shoplineProducts: ShoplineProduct[]
): MatchResult {
  const matched: SkuMatch[] = [];
  const unmatchedShoplineSkus: string[] = [];

  // Track which warehouse items were matched
  const matchedSingleCodes = new Set<string>();
  const matchedSetCodes = new Set<string>();

  for (const product of shoplineProducts) {
    for (const variation of product.variations) {
      const sku = variation.sku?.trim();
      if (!sku) continue;

      // Try matching as single product first
      const warehouseItem = warehouseData.itemsBySellerCode.get(sku) || null;

      // Try matching as set product
      const setProduct = warehouseData.setsBySellerCode.get(sku) || null;

      if (warehouseItem || setProduct) {
        const isSet = !!setProduct && !warehouseItem;

        // Determine available stock
        let availableStock = 0;
        if (warehouseItem) {
          availableStock = warehouseItem.availableStock;
          matchedSingleCodes.add(sku);
        }
        if (setProduct) {
          availableStock = setProduct.availableStock;
          matchedSetCodes.add(sku);
        }

        // If both match (single item also exists as a set), prefer the one with data
        // In practice, a SKU is either a single item OR a set, not both
        matched.push({
          sellerCode: sku,
          warehouseItem,
          setProduct,
          shoplineProduct: product,
          shoplineVariation: variation,
          isSetProduct: isSet,
          warehouseAvailableStock: availableStock,
        });
      } else {
        unmatchedShoplineSkus.push(sku);
      }
    }
  }

  // Find unmatched warehouse SKUs (in warehouse but not on Shopline)
  const allShoplineSkus = new Set<string>();
  for (const product of shoplineProducts) {
    for (const variation of product.variations) {
      if (variation.sku) allShoplineSkus.add(variation.sku.trim());
    }
  }

  const unmatchedWarehouseSkus: string[] = [];
  for (const [code] of warehouseData.itemsBySellerCode) {
    if (!allShoplineSkus.has(code)) {
      unmatchedWarehouseSkus.push(code);
    }
  }
  for (const [code] of warehouseData.setsBySellerCode) {
    if (!allShoplineSkus.has(code)) {
      unmatchedWarehouseSkus.push(code);
    }
  }

  console.log(`\n[Matcher] Results:`);
  console.log(`  Matched: ${matched.length} (${matched.filter((m) => m.isSetProduct).length} sets, ${matched.filter((m) => !m.isSetProduct).length} singles)`);
  console.log(`  Unmatched Shopline SKUs: ${unmatchedShoplineSkus.length}`);
  console.log(`  Unmatched Warehouse SKUs: ${unmatchedWarehouseSkus.length}`);

  if (unmatchedShoplineSkus.length > 0) {
    console.log(`  Unmatched Shopline samples: ${unmatchedShoplineSkus.slice(0, 5).join(', ')}`);
  }

  return { matched, unmatchedShoplineSkus, unmatchedWarehouseSkus };
}
