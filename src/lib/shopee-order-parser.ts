import ExcelJS from 'exceljs';
import officeCrypto from 'officecrypto-tool';

const SHOPEE_ORDER_PASSWORD = '911751';

/** 쇼피 주문 1행 */
export interface ShopeeOrder {
  orderId: string;
  orderStatus: string;
  orderDate: string;       // YYYY-MM-DD
  productName: string;
  mainSku: string;
  optionSku: string;
  quantity: number;
  price: number;
  subtotal: number;
}

/** SKU별 판매 집계 */
export interface SkuSalesSummary {
  sku: string;
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
  orderCount: number;
  dailySales: Record<string, number>; // date -> quantity
}

/** 업로드 분석 결과 */
export interface SalesAnalysisResult {
  orders: ShopeeOrder[];
  skuSummary: SkuSalesSummary[];
  dailyTotal: { date: string; quantity: number; revenue: number }[];
  dateRange: { from: string; to: string };
  totalOrders: number;
  totalQuantity: number;
  totalRevenue: number;
}

/**
 * 암호화된 쇼피 주문 엑셀 파일 복호화 + 파싱
 */
export async function parseShopeeOrders(fileBuffer: Buffer): Promise<SalesAnalysisResult> {
  // 1. 복호화
  let decryptedBuffer: Buffer;
  const isEncrypted = await officeCrypto.isEncrypted(fileBuffer);
  if (isEncrypted) {
    decryptedBuffer = await officeCrypto.decrypt(fileBuffer, { password: SHOPEE_ORDER_PASSWORD });
  } else {
    decryptedBuffer = fileBuffer;
  }

  // 2. 엑셀 파싱
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(decryptedBuffer as unknown as ArrayBuffer);
  const worksheet = workbook.worksheets[0];

  // 헤더 매핑 (중국어 컬럼명)
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value || '').trim();
  });

  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    if (h) colMap[h] = i;
  });

  // 주요 컬럼 찾기 (쇼피 TW 주문 내역 컬럼명)
  const orderIdCol = colMap['訂單編號'] || colMap['Order ID'] || 1;
  const statusCol = colMap['訂單狀態'] || colMap['Order Status'] || 2;
  const dateCol = colMap['訂單成立日期'] || colMap['Order Creation Date'] || 7;
  const productNameCol = colMap['商品名稱'] || colMap['Product Name'] || 26;
  const mainSkuCol = colMap['主商品貨號'] || colMap['Parent SKU Reference No.'] || 33;
  const optionSkuCol = colMap['商品選項貨號'] || colMap['SKU Reference No.'] || 34;
  const quantityCol = colMap['數量'] || colMap['Quantity'] || 35;
  const priceCol = colMap['商品活動價格'] || colMap['Deal Price'] || colMap['商品原價'] || 0;
  const subtotalCol = colMap['商品小計'] || colMap['Product Subtotal'] || 0;

  // 3. 행 파싱
  const orders: ShopeeOrder[] = [];

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const orderId = String(row.getCell(orderIdCol).value || '').trim();
    if (!orderId) return;

    const orderStatus = String(row.getCell(statusCol).value || '').trim();

    // 날짜 파싱
    let orderDate = '';
    const rawDate = row.getCell(dateCol).value;
    if (rawDate instanceof Date) {
      orderDate = rawDate.toISOString().slice(0, 10);
    } else if (rawDate) {
      const dateStr = String(rawDate).trim();
      // "2025-01-15 12:30:00" or "2025/01/15" 등
      const match = dateStr.match(/(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
      if (match) {
        orderDate = `${match[1]}-${match[2].padStart(2, '0')}-${match[3].padStart(2, '0')}`;
      }
    }

    const productName = String(row.getCell(productNameCol).value || '').trim();
    const mainSku = String(row.getCell(mainSkuCol).value || '').trim();
    const optionSku = String(row.getCell(optionSkuCol).value || '').trim();
    const quantity = parseNum(row.getCell(quantityCol).value);
    const price = priceCol ? parseNum(row.getCell(priceCol).value) : 0;
    const subtotal = subtotalCol ? parseNum(row.getCell(subtotalCol).value) : price * quantity;

    orders.push({
      orderId,
      orderStatus,
      orderDate,
      productName,
      mainSku,
      optionSku: optionSku || mainSku,
      quantity,
      price,
      subtotal,
    });
  });

  // 4. SKU별 집계 (완료 주문만)
  const completedOrders = orders.filter(o =>
    o.orderStatus === '已完成' || o.orderStatus === 'Completed' ||
    o.orderStatus === '運送中' || o.orderStatus === 'Shipping' ||
    o.orderStatus === '待出貨' || o.orderStatus === 'To Ship'
  );

  const skuMap = new Map<string, SkuSalesSummary>();
  const dailyMap = new Map<string, { quantity: number; revenue: number }>();
  const orderIdSet = new Set<string>();

  for (const order of completedOrders) {
    const sku = order.optionSku || order.mainSku;
    if (!sku) continue;

    if (!skuMap.has(sku)) {
      skuMap.set(sku, {
        sku,
        productName: order.productName,
        totalQuantity: 0,
        totalRevenue: 0,
        orderCount: 0,
        dailySales: {},
      });
    }

    const summary = skuMap.get(sku)!;
    summary.totalQuantity += order.quantity;
    summary.totalRevenue += order.subtotal;
    if (!orderIdSet.has(`${order.orderId}-${sku}`)) {
      summary.orderCount++;
      orderIdSet.add(`${order.orderId}-${sku}`);
    }

    // 일별
    if (order.orderDate) {
      summary.dailySales[order.orderDate] = (summary.dailySales[order.orderDate] || 0) + order.quantity;

      if (!dailyMap.has(order.orderDate)) {
        dailyMap.set(order.orderDate, { quantity: 0, revenue: 0 });
      }
      const daily = dailyMap.get(order.orderDate)!;
      daily.quantity += order.quantity;
      daily.revenue += order.subtotal;
    }
  }

  // 정렬
  const skuSummary = Array.from(skuMap.values()).sort((a, b) => b.totalQuantity - a.totalQuantity);
  const dailyTotal = Array.from(dailyMap.entries())
    .map(([date, data]) => ({ date, ...data }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const dates = dailyTotal.map(d => d.date);

  return {
    orders,
    skuSummary,
    dailyTotal,
    dateRange: {
      from: dates[0] || '',
      to: dates[dates.length - 1] || '',
    },
    totalOrders: new Set(completedOrders.map(o => o.orderId)).size,
    totalQuantity: completedOrders.reduce((sum, o) => sum + o.quantity, 0),
    totalRevenue: completedOrders.reduce((sum, o) => sum + o.subtotal, 0),
  };
}

function parseNum(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/,/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}
