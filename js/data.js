/**
 * 화학식 학습 데이터 및 구글 스프레드시트 실시간 전용 모듈
 * 구글 시트: https://docs.google.com/spreadsheets/d/106KM_qCb7Yp0GsnD35vjGV-fRYGnhxZwOQRZC3Qh2JM/edit?usp=sharing
 * (내장 하드코딩 캐시 없음 - 오직 스프레드시트에서만 데이터를 로드합니다)
 */

const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/106KM_qCb7Yp0GsnD35vjGV-fRYGnhxZwOQRZC3Qh2JM/gviz/tq?tqx=out:csv';
const GOOGLE_SHEET_CSV_FALLBACK_URL = 'https://docs.google.com/spreadsheets/d/106KM_qCb7Yp0GsnD35vjGV-fRYGnhxZwOQRZC3Qh2JM/export?format=csv';

// 오직 스프레드시트에서 불러온 데이터만 보관 (초기 빈 배열)
let CHEMISTRY_DATA = [];

/**
 * CSV 파서 (RFC 4180 호환: 따옴표, 줄바꿈, 쉼표 처리)
 */
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const results = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const row = [];
    let cur = '';
    let inQuotes = false;
    for (let c = 0; c < line.length; c++) {
      const ch = line[c];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        row.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    row.push(cur.trim());

    // 컬럼 순서: 구분(0), 세트이름(1), 이름(2), 기호/식(3), 원소 번호(4)
    if (row.length >= 4) {
      const category = row[0] || '화학식';
      const unit = row[1] || '기본 세트';
      const name = row[2] || '';
      const formula = row[3] || '';
      const atomicRaw = row[4] || '';
      const atomicNumber = atomicRaw ? parseInt(atomicRaw, 10) || null : null;

      if (name && formula) {
        results.push({
          id: `item-${i}`,
          category: category,
          unit: unit,
          name: name,
          formula: formula,
          atomicNumber: atomicNumber,
          description: atomicNumber ? `원자 번호 ${atomicNumber}번` : `${category} - ${unit}`
        });
      }
    }
  }
  return results;
}

/**
 * 구글 스프레드시트 전용 로더 (로컬 캐시 없음)
 */
class GoogleSheetSync {
  static async syncData() {
    try {
      let csvText = null;

      // 1. gviz CSV 엔드포인트 호출
      try {
        const res = await fetch(GOOGLE_SHEET_CSV_URL, { cache: 'no-cache' });
        if (res.ok) {
          csvText = await res.text();
        }
      } catch (e) {
        console.warn('gviz endpoint failed, trying export fallback...', e);
      }

      // 2. export?format=csv 엔드포인트 폴백
      if (!csvText) {
        const fallbackRes = await fetch(GOOGLE_SHEET_CSV_FALLBACK_URL, { cache: 'no-cache' });
        if (fallbackRes.ok) {
          csvText = await fallbackRes.text();
        }
      }

      if (csvText) {
        const parsed = parseCSV(csvText);
        if (parsed.length > 0) {
          CHEMISTRY_DATA = parsed;
          return { success: true, count: parsed.length };
        }
      }
      return { success: false, error: '스프레드시트 데이터를 파싱하지 못했습니다.' };
    } catch (err) {
      console.error('Google Sheet fetch error:', err);
      return { success: false, error: err.message };
    }
  }
}

/**
 * 과/세트 목록 추출 헬퍼 함수
 */
function getUnits() {
  const unitsMap = new Map();
  CHEMISTRY_DATA.forEach(item => {
    if (!unitsMap.has(item.unit)) {
      unitsMap.set(item.unit, {
        name: item.unit,
        category: item.category,
        count: 0,
        items: []
      });
    }
    const unitObj = unitsMap.get(item.unit);
    unitObj.count++;
    unitObj.items.push(item);
  });
  return Array.from(unitsMap.values());
}

window.GoogleSheetSync = GoogleSheetSync;
window.getUnits = getUnits;
