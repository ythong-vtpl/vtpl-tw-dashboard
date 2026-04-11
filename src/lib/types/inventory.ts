/** Single SKU inventory record from TraxLogistics warehouse */
export interface WarehouseItem {
  skuNo: string;
  productName: string;
  optionName: string;
  sellerCode: string;
  txProductCode: string;
  optionType: string; // '단일 상품' | '멀티옵션'
  includedInSet: boolean;
  totalStock: number;
  allocatedQty: number;
  availableStock: number;
}

/** Set product composition: one component within a set */
export interface SetComponent {
  componentSkuNo: string;
  componentQty: number;
  componentStock: number;
}

/** Set product definition */
export interface SetProduct {
  setSkuNo: string;
  setName: string;
  sellerCode: string;
  componentCount: number;
  availableStock: number;
  components: SetComponent[];
}

/** Shopline product variation */
export interface ShoplineVariation {
  id: string;
  sku: string;
  quantity: number;
  price: number;
  fieldName?: string;
}

/** Shopline product */
export interface ShoplineProduct {
  _id: string;
  title: string;
  handle: string;
  unlimited_quantity?: boolean;
  status: string;
  variations: ShoplineVariation[];
}

/** SKU match result between warehouse and channel */
export interface SkuMatch {
  sellerCode: string;
  warehouseItem: WarehouseItem | null;
  setProduct: SetProduct | null;
  shoplineProduct: ShoplineProduct;
  shoplineVariation: ShoplineVariation;
  isSetProduct: boolean;
  warehouseAvailableStock: number;
}

/** Channel allocation ratios */
export interface ChannelRatios {
  shopline: number;
  shopee: number;
  safety: number;
}

/** Allocation result for a single SKU on a single channel */
export interface AllocationResult {
  sellerCode: string;
  productName: string;
  isSetProduct: boolean;
  warehouseAvailableStock: number;
  shoplineAllocation: number;
  shopeeAllocation: number;
  safetyStock: number;
  currentShoplineStock: number;
  shoplineProductId: string;
  shoplineVariationId: string;
  /** 증정 프로모션으로 제외된 수량 */
  giftReserve?: number;
  /** 재고 동결 여부 */
  frozen?: boolean;
  /** 적용된 프로모션 메모 */
  promoNote?: string;
}

/** Summary of inventory update operations */
export interface UpdateSummary {
  totalSkusProcessed: number;
  totalSkusUpdated: number;
  totalSkusSkipped: number;
  unmatchedShoplineSkus: string[];
  unmatchedWarehouseSkus: string[];
  updates: UpdateDetail[];
  errors: UpdateError[];
}

export interface UpdateDetail {
  sellerCode: string;
  productName: string;
  previousQty: number;
  newQty: number;
  shoplineProductId: string;
  shoplineVariationId: string;
}

export interface UpdateError {
  sellerCode: string;
  error: string;
}

/** Parsed warehouse data bundle */
export interface WarehouseData {
  items: WarehouseItem[];
  setProducts: SetProduct[];
  /** Map from seller code to WarehouseItem */
  itemsBySellerCode: Map<string, WarehouseItem>;
  /** Map from seller code to SetProduct */
  setsBySellerCode: Map<string, SetProduct>;
  /** Map from component SKU no to list of set seller codes that use it */
  componentToSets: Map<string, string[]>;
}
