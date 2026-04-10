import ExcelJS from 'exceljs';
import {
  WarehouseItem,
  SetProduct,
  SetComponent,
  WarehouseData,
} from './types/inventory';

function parseStock(value: unknown): number {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Math.floor(value);
  const cleaned = String(value).replace(/,/g, '').trim();
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

/**
 * Buffer 기반 option-info 파싱
 */
async function parseOptionInfo(buffer: Buffer): Promise<WarehouseItem[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const worksheet = workbook.worksheets[0];

  const items: WarehouseItem[] = [];
  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value || '').trim();
  });

  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    if (h) colMap[h] = i;
  });

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const skuNo = String(row.getCell(colMap['SKU no.'] || 1).value || '').trim();
    if (!skuNo) return;

    const rawSellerCode = String(row.getCell(colMap['판매자 정의 코드'] || 4).value || '').trim();
    const sellerCode = rawSellerCode.split('|')[0].trim();
    if (!sellerCode) return;

    items.push({
      skuNo,
      productName: String(row.getCell(colMap['상품명'] || 2).value || '').trim(),
      optionName: String(row.getCell(colMap['옵션명'] || 3).value || '').trim(),
      sellerCode,
      txProductCode: String(row.getCell(colMap['TX 상품 코드'] || 5).value || '').trim(),
      optionType: String(row.getCell(colMap['옵션구성'] || 6).value || '').trim(),
      includedInSet: String(row.getCell(colMap['세트상품에 포함'] || 8).value || '').trim().toUpperCase() === 'Y',
      totalStock: parseStock(row.getCell(colMap['총재고'] || 12).value),
      allocatedQty: parseStock(row.getCell(colMap['할당된 수량'] || 15).value),
      availableStock: parseStock(row.getCell(colMap['할당가능 재고'] || 16).value),
    });
  });

  return items;
}

/**
 * Buffer 기반 Down-SKU-SkuDetails 파싱
 */
async function parseSetDetails(buffer: Buffer): Promise<Map<string, { name: string; sellerCode: string; components: SetComponent[] }>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const worksheet = workbook.worksheets[0];

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value || '').trim();
  });

  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    if (h) colMap[h] = i;
  });

  const setSkuCol = 1;
  const setNameCol = colMap['세트상품명.'] || 2;
  const sellerCodeCol = colMap['판매자정의코드'] || 3;
  const componentSkuCol = colMap['구성품 SKU no.'] || 7;
  const componentQtyCol = colMap['구성품 수량'] || 8;
  const componentStockCol = colMap['구성품 재고'] || 9;

  const setMap = new Map<string, { name: string; sellerCode: string; components: SetComponent[] }>();

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const setSkuNo = String(row.getCell(setSkuCol).value || '').trim();
    if (!setSkuNo) return;

    const componentSkuNo = String(row.getCell(componentSkuCol).value || '').trim();
    if (!componentSkuNo) return;

    const component: SetComponent = {
      componentSkuNo,
      componentQty: parseStock(row.getCell(componentQtyCol).value),
      componentStock: parseStock(row.getCell(componentStockCol).value),
    };

    if (!setMap.has(setSkuNo)) {
      setMap.set(setSkuNo, {
        name: String(row.getCell(setNameCol).value || '').trim(),
        sellerCode: String(row.getCell(sellerCodeCol).value || '').trim(),
        components: [],
      });
    }

    setMap.get(setSkuNo)!.components.push(component);
  });

  return setMap;
}

/**
 * Buffer 기반 Set-SKU 파싱
 */
async function parseSetSku(buffer: Buffer): Promise<Map<string, { availableStock: number; componentCount: number }>> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ArrayBuffer);
  const worksheet = workbook.worksheets[0];

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = String(cell.value || '').trim();
  });

  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    if (h) colMap[h] = i;
  });

  const skuCol = colMap['SKU no.'] || 2;
  const componentCountCol = colMap['포함수량'] || 6;
  const availableStockCol = colMap['가용재고'] || 7;

  const setStockMap = new Map<string, { availableStock: number; componentCount: number }>();

  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;

    const skuNo = String(row.getCell(skuCol).value || '').trim();
    if (!skuNo) return;

    setStockMap.set(skuNo, {
      availableStock: parseStock(row.getCell(availableStockCol).value),
      componentCount: parseStock(row.getCell(componentCountCol).value),
    });
  });

  return setStockMap;
}

/**
 * Buffer 기반 parseWarehouseExcel — 3개 파일 Buffer를 받아서 WarehouseData 반환
 */
export async function parseWarehouseExcel(
  optionInfoBuffer: Buffer,
  setSkuBuffer: Buffer,
  downSkuBuffer: Buffer
): Promise<WarehouseData> {
  const [items, setDetailsMap, setStockMap] = await Promise.all([
    parseOptionInfo(optionInfoBuffer),
    parseSetDetails(downSkuBuffer),
    parseSetSku(setSkuBuffer),
  ]);

  const itemsBySellerCode = new Map<string, WarehouseItem>();
  for (const item of items) {
    itemsBySellerCode.set(item.sellerCode, item);
  }

  const setProducts: SetProduct[] = [];
  const setsBySellerCode = new Map<string, SetProduct>();
  const componentToSets = new Map<string, string[]>();

  for (const [setSkuNo, details] of setDetailsMap) {
    const stockInfo = setStockMap.get(setSkuNo);

    let calculatedAvailable = Infinity;
    for (const comp of details.components) {
      const warehouseComp = items.find((it) => it.skuNo === comp.componentSkuNo);
      const compAvailableStock = warehouseComp ? warehouseComp.availableStock : comp.componentStock;
      const setsFromComp = Math.floor(compAvailableStock / (comp.componentQty || 1));
      calculatedAvailable = Math.min(calculatedAvailable, setsFromComp);
    }
    if (calculatedAvailable === Infinity) calculatedAvailable = 0;

    const setProduct: SetProduct = {
      setSkuNo,
      setName: details.name,
      sellerCode: details.sellerCode,
      componentCount: stockInfo?.componentCount || details.components.length,
      availableStock: calculatedAvailable,
      components: details.components,
    };

    setProducts.push(setProduct);
    setsBySellerCode.set(details.sellerCode, setProduct);

    for (const comp of details.components) {
      const existing = componentToSets.get(comp.componentSkuNo) || [];
      existing.push(details.sellerCode);
      componentToSets.set(comp.componentSkuNo, existing);
    }
  }

  return {
    items,
    setProducts,
    itemsBySellerCode,
    setsBySellerCode,
    componentToSets,
  };
}
