import ExcelJS from 'exceljs';

/**
 * MJ (홍콩 창고) Daily Inventory List 파서
 *
 * 파일 구조:
 * Row 1: 카테고리 헤더 (Basic Information | Inventory)
 * Row 2: 컬럼 헤더 (No | SKU Code | Item Name | Quantity | Picking QTY | Estimated Qty | Weight | Expiry Date)
 * Row 3+: 데이터
 *
 * 같은 SKU가 여러 행에 나올 수 있음 (유통기한별) → 합산
 */
export interface MjInventoryItem {
  skuCode: string;
  itemName: string;
  quantity: number; // 합산된 가용 재고
}

export async function parseMjInventory(buffer: Buffer): Promise<MjInventoryItem[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const worksheet = workbook.worksheets[0];

  // 컬럼 헤더 찾기 (Row 2)
  const headerRow = worksheet.getRow(2);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, col) => {
    headers[col] = String(cell.value || '').trim();
  });

  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    if (h) colMap[h] = i;
  });

  const skuCol = colMap['SKU Code'] || 2;
  const nameCol = colMap['Item Name'] || 3;
  const qtyCol = colMap['Quantity'] || 4;

  // SKU별 합산 (같은 SKU, 다른 유통기한)
  const skuMap = new Map<string, { name: string; quantity: number }>();

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= 2) return; // 헤더 스킵

    const skuCode = String(row.getCell(skuCol).value || '').trim();
    if (!skuCode) return;

    const itemName = String(row.getCell(nameCol).value || '').trim();
    const qtyRaw = row.getCell(qtyCol).value;
    const quantity = typeof qtyRaw === 'number' ? qtyRaw : parseInt(String(qtyRaw || '0').replace(/,/g, ''), 10) || 0;

    const existing = skuMap.get(skuCode);
    if (existing) {
      existing.quantity += quantity;
    } else {
      skuMap.set(skuCode, { name: itemName, quantity });
    }
  });

  const items: MjInventoryItem[] = [];
  for (const [skuCode, data] of skuMap) {
    items.push({ skuCode, itemName: data.name, quantity: data.quantity });
  }

  return items;
}
