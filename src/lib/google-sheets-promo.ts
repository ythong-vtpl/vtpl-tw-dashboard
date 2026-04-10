import https from 'https';
import { Promotion, PromoType } from './types/promo';

/**
 * Google Sheets 프로모션 탭에서 프로모션 데이터를 읽어옵니다.
 * 공개 시트 CSV export 방식 - API 키 불필요!
 *
 * 시트 구조 (프로모션 탭):
 * | 시작일 | 종료일 | 채널 | 유형 | SKU (콤마구분) | 증정수량 | 우선순위 | 메모 |
 */

const SHEET_TAB_NAME = '프로모션';
// 헤더 매칭: 부분 일치 지원 (예: "일" → "시작일" 매칭)
const EXPECTED_HEADERS = ['시작일', '종료일', '채널', '유형', 'SKU', '증정수량', '우선순위', '메모'];
const HEADER_ALIASES: Record<string, string> = {
  '일': '시작일',
  '시작': '시작일',
  '시작일': '시작일',
  '종료일': '종료일',
  '종료': '종료일',
  '채널': '채널',
  '유형': '유형',
  '타입': '유형',
  'type': '유형',
  'sku': 'SKU',
  'SKU': 'SKU',
  '증정수량': '증정수량',
  '증정': '증정수량',
  '수량': '증정수량',
  '우선순위': '우선순위',
  '메모': '메모',
  'memo': '메모',
  'note': '메모',
};

const VALID_CHANNELS = ['shopline', 'shopee', 'all'] as const;
const VALID_TYPES: PromoType[] = ['gift', 'discount', 'shopee_promo', 'shopline_promo', 'clearance', 'freeze'];
const VALID_PRIORITIES = ['critical', 'high', 'medium', 'low', 'shopee_focus'] as const;

/**
 * Fetch CSV from a public Google Sheet tab.
 */
function fetchSheetCsv(sheetId: string, tabName: string): Promise<string> {
  const encodedTab = encodeURIComponent(tabName);
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodedTab}`;

  return new Promise((resolve, reject) => {
    const request = https.get(url, (res) => {
      // Handle redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        const redirectUrl = res.headers.location;
        if (redirectUrl) {
          https.get(redirectUrl, (redirectRes) => {
            let data = '';
            redirectRes.on('data', (chunk) => (data += chunk));
            redirectRes.on('end', () => resolve(data));
          }).on('error', reject);
        } else {
          reject(new Error('Redirect without location header'));
        }
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} - 시트 또는 탭을 찾을 수 없음`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    });

    request.on('error', reject);
    request.setTimeout(10000, () => {
      request.destroy();
      reject(new Error('Google Sheets 요청 타임아웃 (10초)'));
    });
  });
}

/**
 * Parse CSV string into rows. Handles quoted fields with commas inside.
 */
function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  const lines = csv.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    const row: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === ',' && !inQuotes) {
        row.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    row.push(current.trim());
    rows.push(row);
  }

  return rows;
}

export async function loadPromosFromGoogleSheets(): Promise<Promotion[]> {
  const sheetId = process.env.GOOGLE_SHEETS_ID;

  if (!sheetId) {
    console.log('[Google Sheets] GOOGLE_SHEETS_ID 미설정 - 구글 시트 프로모션 스킵');
    return [];
  }

  try {
    const csv = await fetchSheetCsv(sheetId, SHEET_TAB_NAME);
    const rows = parseCsv(csv);

    if (rows.length < 2) {
      console.log('[Google Sheets] 프로모션 데이터 없음');
      return [];
    }

    // Validate headers (with alias support)
    const rawHeaders = rows[0].map((h) => h.replace(/"/g, '').trim());
    const colIdx: Record<string, number> = {};
    rawHeaders.forEach((h, i) => {
      const normalized = HEADER_ALIASES[h] || h;
      colIdx[normalized] = i;
    });

    const missingHeaders = EXPECTED_HEADERS.filter((h) => !(h in colIdx));
    if (missingHeaders.length > 0) {
      console.warn(`[Google Sheets] 헤더 불일치. 누락: ${missingHeaders.join(', ')}`);
      console.warn(`  기대: ${EXPECTED_HEADERS.join(' | ')}`);
      console.warn(`  실제: ${rawHeaders.join(' | ')}`);
      return [];
    }

    const promos: Promotion[] = [];
    let skippedRows = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0 || row.every((c) => !c.trim())) continue;

      const getValue = (col: string) => {
        const idx = colIdx[col];
        return idx !== undefined && idx < row.length ? row[idx].replace(/"/g, '').trim() : '';
      };

      const startDate = getValue('시작일');
      const endDate = getValue('종료일');
      const channel = getValue('채널').toLowerCase();
      const type = getValue('유형').toLowerCase();
      const skuStr = getValue('SKU');
      const giftQtyStr = getValue('증정수량');
      const priority = getValue('우선순위').toLowerCase();
      const note = getValue('메모');

      // Validate required fields
      if (!startDate || !endDate || !type) {
        skippedRows++;
        continue;
      }

      // Validate channel
      if (!VALID_CHANNELS.includes(channel as any)) {
        console.warn(`[Google Sheets] Row ${i + 1}: 잘못된 채널 "${channel}" - 스킵`);
        skippedRows++;
        continue;
      }

      // Validate type
      if (!VALID_TYPES.includes(type as PromoType)) {
        console.warn(`[Google Sheets] Row ${i + 1}: 잘못된 유형 "${type}" - 스킵`);
        skippedRows++;
        continue;
      }

      // Parse SKUs (comma or space separated)
      const affectedSkus = skuStr
        ? skuStr.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
        : [];

      // Parse gift quantity
      const giftQty = giftQtyStr ? parseInt(giftQtyStr.replace(/,/g, ''), 10) : undefined;

      // Validate gift type has quantity and SKU
      if (type === 'gift') {
        if (!giftQty || isNaN(giftQty)) {
          console.warn(`[Google Sheets] Row ${i + 1}: gift 유형인데 증정수량 없음 - 스킵`);
          skippedRows++;
          continue;
        }
        if (affectedSkus.length === 0) {
          console.warn(`[Google Sheets] Row ${i + 1}: gift 유형인데 SKU 없음 - 스킵`);
          skippedRows++;
          continue;
        }
      }

      const promo: Promotion = {
        id: `gsheet_row${i + 1}`,
        channel: channel as 'shopline' | 'shopee' | 'all',
        start: normalizeDate(startDate),
        end: normalizeDate(endDate),
        type: type as PromoType,
        affected_skus: affectedSkus,
        note: note || `${type} 프로모션`,
      };

      if (giftQty && !isNaN(giftQty)) {
        promo.gift_qty = giftQty;
      }

      if (priority && VALID_PRIORITIES.includes(priority as any)) {
        promo.priority = priority as any;
      }

      promos.push(promo);
    }

    console.log(`[Google Sheets] ${promos.length}개 프로모션 로드 (${skippedRows}개 스킵)`);
    return promos;
  } catch (err: any) {
    if (err.message?.includes('시트 또는 탭을 찾을 수 없음')) {
      console.log(`[Google Sheets] "${SHEET_TAB_NAME}" 탭 없음 - 프로모션 미적용`);
    } else {
      console.warn(`[Google Sheets] 읽기 실패: ${err.message}`);
    }
    return [];
  }
}

/**
 * Normalize date format: "2026/5/1" or "2026-5-1" → "2026-05-01"
 */
function normalizeDate(dateStr: string): string {
  const parts = dateStr.replace(/\//g, '-').split('-');
  if (parts.length !== 3) return dateStr;

  const [year, month, day] = parts;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}
