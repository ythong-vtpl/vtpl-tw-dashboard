import ExcelJS from 'exceljs';
import { AllocationResult } from './types/inventory';

const DATA_START_ROW = 7;
const COL = { SKU: 6, STOCK: 9 };

/**
 * Shopee Mass Update 엑셀 생성 (Buffer 반환)
 * templateBuffer: 쇼피 셀러센터에서 다운로드한 Sales Info 템플릿
 */
export async function generateShopeeUpdateExcel(
  allocations: AllocationResult[],
  templateBuffer: Buffer
): Promise<{
  buffer: Buffer;
  matched: number;
  unmatched: number;
  skipped: number;
  totalShopeeStock: number;
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(templateBuffer as unknown as ArrayBuffer);
  const worksheet = workbook.worksheets[0];

  const allocationMap = new Map<string, AllocationResult>();
  for (const alloc of allocations) {
    allocationMap.set(alloc.sellerCode, alloc);
  }

  let matched = 0;
  let unmatched = 0;
  let skipped = 0;
  let totalShopeeStock = 0;

  for (let rowNum = DATA_START_ROW; rowNum <= worksheet.rowCount; rowNum++) {
    const row = worksheet.getRow(rowNum);
    const sku = String(row.getCell(COL.SKU).value || '').trim();
    if (!sku) continue;

    const alloc = allocationMap.get(sku);
    if (alloc) {
      if (alloc.shopeeAllocation === 0 && alloc.frozen) {
        skipped++;
        continue;
      }
      row.getCell(COL.STOCK).value = alloc.shopeeAllocation;
      totalShopeeStock += alloc.shopeeAllocation;
      matched++;
    } else {
      unmatched++;
    }
  }

  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

  return { buffer, matched, unmatched, skipped, totalShopeeStock };
}
