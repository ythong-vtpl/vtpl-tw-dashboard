import axios, { AxiosInstance } from 'axios';
import { ShoplineProduct } from './types/inventory';
import { SHOPLINE_API_BASE, SHOPLINE_RATE_LIMIT_MS, Country, getShoplineToken } from './config';

function createClient(country: Country = 'TW'): AxiosInstance {
  const token = getShoplineToken(country);
  return axios.create({
    baseURL: SHOPLINE_API_BASE,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });
}

/**
 * Fetch all Shopline products (active + hidden)
 */
export async function fetchShoplineProducts(country: Country = 'TW'): Promise<ShoplineProduct[]> {
  const client = createClient(country);
  const allProducts: ShoplineProduct[] = [];
  const statusesToFetch = ['active', 'hidden'];

  for (const status of statusesToFetch) {
    let page = 1;
    const perPage = 250;

    while (true) {
      const response = await client.get('/v1/products', {
        params: { status, per_page: perPage, page },
      });

      const products = response.data?.items || response.data || [];
      if (!Array.isArray(products) || products.length === 0) break;

      for (const product of products) {
        const variations = (product.variations || []).map((v: any) => ({
          id: v._id || v.id,
          sku: v.sku || '',
          quantity: v.quantity ?? 0,
          price: v.price?.dollars ?? (v.price?.cents ? v.price.cents / 100 : 0),
          fieldName: v.fields?.map((f: any) => f.name_translations?.['zh-hant'] || f.name).join(' / ') || '',
        }));

        allProducts.push({
          _id: product._id || product.id,
          title: product.title_translations?.['zh-hant'] || product.title || '',
          handle: product.handle || '',
          unlimited_quantity: product.unlimited_quantity || false,
          status: product.status || status,
          variations,
        });
      }

      if (products.length < perPage) break;
      page++;
      await new Promise(r => setTimeout(r, SHOPLINE_RATE_LIMIT_MS));
    }
  }

  return allProducts;
}

/**
 * Update Shopline inventory for a single variation
 */
export async function updateShoplineVariation(
  productId: string,
  variationId: string,
  quantity: number,
  country: Country = 'TW'
): Promise<{ success: boolean; error?: string }> {
  const client = createClient(country);
  try {
    await client.put(`/v1/products/${productId}/variations/${variationId}`, {
      quantity,
    });
    return { success: true };
  } catch (err: any) {
    const msg = err.response?.data?.error_messages?.[0] ||
      err.response?.data?.message ||
      err.message;
    return { success: false, error: msg };
  }
}
