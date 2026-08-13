// 격자 좌표. §3.3 — 좌표 전량 계산 확정. 표와 정확히 일치해야 한다.
//
// §6.4(2026-08-13) — **격자는 코트 크기 3단을 따라간다.** 칸 수(6×5)는 크기와 무관하지만
// 칸의 픽셀 치수는 경기면에서 나오므로 30×18 은 125×90, 28×15 는 116.67×75, 25×14 는
// 104.17×70 이다. 그래서 이 파일의 유일한 좌표 출처는 `courtDefFor(mode, size)` 다.
import { courtDefFor, gridLabel, gridCellCenter, normalizeCourtSize, type CourtMode, type CourtSize } from './court.ts';

export interface GridGeom {
  vx: number[];
  hy: number[]; // 전체 선
  inner: { vx: number[]; hy: number[] }; // 코트 라인과 겹치지 않는 내부선만 그린다
  major?: { vx: number[]; hy: number[] }; // flat 전용 5 m 강조선
  cells: { text: string; x: number; y: number; col: number; row: number }[];
  axis?: { text: string; x: number; y: number }[]; // flat 전용 축 헤더
}

/** flat 전용 5 m(5칸) 강조선. 격자 범위를 넘어서는 값은 버린다(hy 는 425 에서 끊긴다). */
function majorLines(originPx: number, cellPx: number, count: number, step = 5): number[] {
  const out: number[] = [];
  for (let k = 0; k * step <= count; k++) out.push(originPx + k * step * cellPx);
  return out;
}

// flat 축 헤더 위치의 y=9 / x=8 은 §3.3 이 못박은 고정 픽셀값이다 (셀 중심 공식과 무관).
const FLAT_AXIS_COL_Y = 9;
const FLAT_AXIS_ROW_X = 8;

function computeGridGeom(mode: CourtMode, size: CourtSize): GridGeom {
  const { cols, rows, cellW, cellH, origin } = courtDefFor(mode, size).grid;

  const vx: number[] = [];
  for (let i = 0; i <= cols; i++) vx.push(origin.x + i * cellW);
  const hy: number[] = [];
  for (let j = 0; j <= rows; j++) hy.push(origin.y + j * cellH);

  const inner = { vx: vx.slice(1, -1), hy: hy.slice(1, -1) };

  const cells: GridGeom['cells'] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const { x, y } = gridCellCenter(mode, col, row, size);
      cells.push({ text: gridLabel(col, row), x, y, col, row });
    }
  }

  if (mode !== 'flat') return { vx, hy, inner, cells };

  const major = {
    vx: majorLines(origin.x, cellW, cols),
    hy: majorLines(origin.y, cellH, rows),
  };
  const axis: GridGeom['axis'] = [];
  for (let col = 0; col < cols; col++) {
    axis.push({ text: String.fromCharCode(97 + col), x: origin.x + cellW * (col + 0.5), y: FLAT_AXIS_COL_Y });
  }
  for (let row = 0; row < rows; row++) {
    axis.push({ text: String(row + 1), x: FLAT_AXIS_ROW_X, y: origin.y + cellH * (row + 0.5) });
  }

  return { vx, hy, inner, major, cells, axis };
}

// 모듈 레벨 캐시 — 매 렌더마다 재계산하지 않는다 (§6.4).
//
// ⚠️ **키는 `mode|size` 다. size 를 빼면 안 된다.** 2026-08-13 이전에는 `Map<CourtMode, GridGeom>`
//    이었고, 그래서 30×18 판을 한 번 그린 뒤 25×14 를 열면 **첫 코트의 격자가 그대로 재사용**됐다
//    (칸 폭 125 px 對 104.17 px — 20 px 어긋난 선이 그려지고, 그 격자에서 나온 스냅 앵커·키보드
//    배치 커서까지 전부 남의 코트 것이 된다). 캐시 미스가 아니라 **오답**이라 화면만 봐서는
//    영영 못 찾는다. gridCourtSize.test.ts 의 '크기 A 뒤 크기 B' 두 방향 테스트가 이 줄의 가드다
//    (그 파일이 vi.resetModules 로 **캐시가 빈 모듈**을 새로 들여오는 이유가 이것이다).
const cache = new Map<string, GridGeom>();

export function gridGeom(mode: CourtMode, size?: CourtSize): GridGeom {
  // 깨진 값이 캐시를 오염시키지 않도록 키를 만들기 전에 접는다 — courtDefFor 와 같은 규약이다.
  const s = normalizeCourtSize(size);
  const key = `${mode}|${s}`;
  let geom = cache.get(key);
  if (!geom) {
    geom = computeGridGeom(mode, s);
    cache.set(key, geom);
  }
  return geom;
}
