// §3.5(화살표 부분) — 2차 베지에 화살표. D8/D9.
import type { Vec2 } from '../core/units.ts';
import type { ArrowId } from '../core/ids.ts';

export type ArrowKind = 'move' | 'pass' | 'shot';
export interface Arrow {
  id: ArrowId;
  kind: ArrowKind;
  from: Vec2;
  ctrl: Vec2;
  to: Vec2; // 2차 베지에
  color?: string; // kind 기본색을 무시할 때만 (인스펙터 색 스와치)
}
export interface ArrowStyle {
  color: string;
  width: number;
  dash: string;
}
export const ARROW_STYLES: Record<ArrowKind, ArrowStyle> = {
  move: { color: '#38bdf8', width: 3.4, dash: '' },
  pass: { color: '#fbbf24', width: 3, dash: '9 9' },
  shot: { color: '#fbbf24', width: 5, dash: '' },
};
export const arrowColor = (a: Arrow): string => a.color ?? ARROW_STYLES[a.kind].color;

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** `M${from} Q${ctrl} ${to}`, 좌표 0.01 반올림. */
export function arrowPath(a: Arrow): string {
  const f = `${round2(a.from.x)},${round2(a.from.y)}`;
  const c = `${round2(a.ctrl.x)},${round2(a.ctrl.y)}`;
  const t = `${round2(a.to.x)},${round2(a.to.y)}`;
  return `M${f} Q${c} ${t}`;
}

/** bow = 직선 대비 최대 처짐(px). 양수 = 진행방향 우측(화면상 시계방향).
 *  2차 베지에의 t=0.5 편차는 제어점 이동량의 1/2 이므로 2배로 보정한다. */
export function defaultCtrl(from: Vec2, to: Vec2, bow: number = 0): Vec2 {
  const mid: Vec2 = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9 || bow === 0) return mid;
  // 진행방향을 +90°(화면상 시계방향, y-down)로 회전한 단위벡터.
  const px = -dy / len;
  const py = dx / len;
  const offset = bow * 2;
  return { x: mid.x + px * offset, y: mid.y + py * offset };
}

export function moveEndpoint(a: Arrow, which: 'from' | 'to', p: Vec2): Arrow {
  return which === 'from' ? { ...a, from: p } : { ...a, to: p };
}
