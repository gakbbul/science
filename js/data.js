/**
 * 화학식 학습 데이터 및 구글 스프레드시트 실시간 전용 모듈
 * 구글 시트: https://docs.google.com/spreadsheets/d/106KM_qCb7Yp0GsnD35vjGV-fRYGnhxZwOQRZC3Qh2JM/edit?usp=sharing
 * (내장 하드코딩 캐시 없음 - 오직 스프레드시트에서만 데이터를 로드합니다)
 */

const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/106KM_qCb7Yp0GsnD35vjGV-fRYGnhxZwOQRZC3Qh2JM/gviz/tq?tqx=out:csv';
const GOOGLE_SHEET_CSV_FALLBACK_URL = 'https://docs.google.com/spreadsheets/d/106KM_qCb7Yp0GsnD35vjGV-fRYGnhxZwOQRZC3Qh2JM/export?format=csv';

// 주요 원소 원자 번호 표준 사전 (구글 시트에 번호가 비어있는 원소 자동 보완)
const KNOWN_ATOMIC_NUMBERS = {
  // 기호 기준
  'H': 1, 'He': 2, 'Li': 3, 'Be': 4, 'B': 5, 'C': 6, 'N': 7, 'O': 8, 'F': 9, 'Ne': 10,
  'Na': 11, 'Mg': 12, 'Al': 13, 'Si': 14, 'P': 15, 'S': 16, 'Cl': 17, 'Ar': 18, 'K': 19, 'Ca': 20,
  'Sc': 21, 'Ti': 22, 'V': 23, 'Cr': 24, 'Mn': 25, 'Fe': 26, 'Co': 27, 'Ni': 28, 'Cu': 29, 'Zn': 30,
  'Ga': 31, 'Ge': 32, 'As': 33, 'Se': 34, 'Br': 35, 'Kr': 36, 'Rb': 37, 'Sr': 38, 'Y': 39, 'Zr': 40,
  'Nb': 41, 'Mo': 42, 'Tc': 43, 'Ru': 44, 'Rh': 45, 'Pd': 46, 'Ag': 47, 'Cd': 48, 'In': 49, 'Sn': 50,
  'Sb': 51, 'Te': 52, 'I': 53, 'Xe': 54, 'Cs': 55, 'Ba': 56, 'La': 57, 'Ce': 58, 'Pr': 59, 'Nd': 60,
  'W': 74, 'Pt': 78, 'Au': 79, 'Hg': 80, 'Tl': 81, 'Pb': 82, 'Bi': 83, 'Po': 84, 'At': 85, 'Rn': 86,
  'Fr': 87, 'Ra': 88, 'Ac': 89, 'Th': 90, 'Pa': 91, 'U': 92, 'Np': 93, 'Pu': 94,
  // 이름(한글) 기준
  '수소': 1, '헬륨': 2, '리튬': 3, '베릴륨': 4, '붕소': 5, '탄소': 6, '질소': 7, '산소': 8, '플루오린': 9, '네온': 10,
  '나트륨': 11, '마그네슘': 12, '알루미늄': 13, '규소': 14, '인': 15, '황': 16, '염소': 17, '아르곤': 18, '칼륨': 19, '칼슘': 20,
  '은': 47, '철': 26, '구리': 29, '금': 79, '백금': 78, '수은': 80, '아이오딘': 53, '망가니즈': 25,
  '브로민': 35, '아연': 30, '납': 82, '우라늄': 92, '스트론튬': 38, '바륨': 56, '세슘': 55, '루비듐': 37, '니켈': 28
};

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
      let atomicNumber = atomicRaw ? parseInt(atomicRaw, 10) || null : null;

      // 시트에 원소 번호가 누락된 경우 사전 매핑으로 보완
      if (!atomicNumber) {
        if (KNOWN_ATOMIC_NUMBERS[formula]) {
          atomicNumber = KNOWN_ATOMIC_NUMBERS[formula];
        } else if (KNOWN_ATOMIC_NUMBERS[name]) {
          atomicNumber = KNOWN_ATOMIC_NUMBERS[name];
        }
      }

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
window.KNOWN_ATOMIC_NUMBERS = KNOWN_ATOMIC_NUMBERS;
