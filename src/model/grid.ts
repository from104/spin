// 격자 좌표. §3.3 — 좌표 전량 계산 확정. 표와 정확히 일치해야 한다.
import { COURT_DEFS, gridLabel, gridCellCenter, type CourtMode } from './court.ts';

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

function computeGridGeom(mode: CourtMode): GridGeom {
  const { cols, rows, cellW, cellH, origin } = COURT_DEFS[mode].grid;

  const vx: number[] = [];
  for (let i = 0; i <= cols; i++) vx.push(origin.x + i * cellW);
  const hy: number[] = [];
  for (let j = 0; j <= rows; j++) hy.push(origin.y + j * cellH);

  const inner = { vx: vx.slice(1, -1), hy: hy.slice(1, -1) };

  const cells: GridGeom['cells'] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const { x, y } = gridCellCenter(mode, col, row);
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
const cache = new Map<CourtMode, GridGeom>();

export function gridGeom(mode: CourtMode): GridGeom {
  let geom = cache.get(mode);
  if (!geom) {
    geom = computeGridGeom(mode);
    cache.set(mode, geom);
  }
  return geom;
}
