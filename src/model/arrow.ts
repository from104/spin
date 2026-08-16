// §3.5(화살표 부분) — 2차 베지에 화살표. D8/D9.
import type { Vec2 } from '../core/units.ts';
import { isId } from '../core/ids.ts';
import type { ArrowId } from '../core/ids.ts';

/** 양 끝의 화살촉 — **없음 → 좁은 → 넓은** 순으로 돈다(기현 지시 2026-08-16).
 *
 *  ── 왜 종류(kind)를 대신하는가 ──────────────────────────────────────────────────────
 *  2026-08-16 까지 화살표에는 `kind: 'move' | 'pass' | 'shot'` 이 있었고 색·굵기·점선이 거기서
 *  나왔다. 기현님 판단: *"작도에 패스, 이동이 무의미하다. 선으로 통일."* 도구 둘을 외워서
 *  미리 고르는 것보다, **그린 뒤에 끝을 눌러 바꾸는 것**이 판을 그리는 순서에 맞는다.
 *  그래서 뜻을 나르는 채널이 종류에서 **화살촉**으로 옮겨 갔다 — 양 끝이 각자 독립이라
 *  한쪽 화살표·양쪽 화살표·화살표 없는 선이 전부 한 도구에서 나온다. */
export type ArrowHead = 'none' | 'thin' | 'wide';
/** 순환 순서. 첫 값이 '없음' 인 것이 계약이다 — 끝을 세 번 누르면 처음으로 돌아온다. */
export const ARROW_HEAD_CYCLE: readonly ArrowHead[] = ['none', 'thin', 'wide'];
export const cycleHead = (h: ArrowHead): ArrowHead =>
  ARROW_HEAD_CYCLE[(ARROW_HEAD_CYCLE.indexOf(h) + 1) % ARROW_HEAD_CYCLE.length]!;

export interface Arrow {
  id: ArrowId;
  from: Vec2;
  ctrl: Vec2;
  to: Vec2; // 2차 베지에
  color?: string; // 기본색을 무시할 때만 (인스펙터 색 스와치)
  /** 시작점 화살촉. 없으면 **'none'** — 새로 그은 선은 한쪽만 화살표다. */
  headFrom?: ArrowHead;
  /** 끝점 화살촉. 없으면 **'thin'** — 2026-08-16 이전의 모든 화살표가 그 모양이었고,
   *  마이그레이션이 값을 안 찍어도 옛 드릴이 그대로 보이게 하는 것이 이 기본값이다. */
  headTo?: ArrowHead;
}

export const headFromOf = (a: Pick<Arrow, 'headFrom'>): ArrowHead => a.headFrom ?? 'none';
export const headToOf = (a: Pick<Arrow, 'headTo'>): ArrowHead => a.headTo ?? 'thin';

export interface ArrowStyle {
  color: string;
  width: number;
}
/** 선 하나의 스타일. 옛 세 종류(move 파랑 3.4 · pass 노랑 점선 3 · shot 노랑 5)를 대신한다 —
 *  색은 이동(#38bdf8)의 것을 물려받았다. 그것이 가장 많이 쓰이던 값이고, 노랑(#fbbf24)은
 *  콘·공 표시와 겹치는 자리가 있어서다. 개별 색은 인스펙터 스와치가 계속 덮어쓴다. */
export const ARROW_STYLE: ArrowStyle = { color: '#38bdf8', width: 3.4 };
export const arrowColor = (a: Pick<Arrow, 'color'>): string => a.color ?? ARROW_STYLE.color;

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** `M${from} Q${ctrl} ${to}`, 좌표 0.01 반올림. 세 점만 쓰므로 Arrow 전체가 아니어도 된다 —
 *  스텝 전환 트윈(§6.7/3.10)이 보간 중인 세 점만으로 같은 문자열을 조립한다(반올림까지 같아야
 *  트윈 종점의 d 와 React 가 렌더한 d 가 한 글자도 안 어긋난다). */
export function arrowPath(a: Pick<Arrow, 'from' | 'ctrl' | 'to'>): string {
  const f = `${round2(a.from.x)},${round2(a.from.y)}`;
  const c = `${round2(a.ctrl.x)},${round2(a.ctrl.y)}`;
  const t = `${round2(a.to.x)},${round2(a.to.y)}`;
  return `M${f} Q${c} ${t}`;
}

/** 곡선의 **한가운데 점**(2차 베지에 t=0.5). 세 점의 무게중심이 아니다 — 무게중심은 곡선
 *  위에 있지도 않아서, 눈에 보이는 화살표와 어긋난 자리를 가리킨다.
 *
 *  고무줄 선택이 "중심점이 사각형 안인가" 로 판정하므로(§6.10b) 화살표에도 **대표점 하나**가
 *  필요하다. 그 점이 곡선 위에 있어야 "보이는 것을 훑었더니 잡혔다" 가 참이 된다. */
export function arrowMid(a: Pick<Arrow, 'from' | 'ctrl' | 'to'>): Vec2 {
  return {
    x: (a.from.x + 2 * a.ctrl.x + a.to.x) / 4,
    y: (a.from.y + 2 * a.ctrl.y + a.to.y) / 4,
  };
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

/** 포인터로 잡을 수 있는 화살표의 세 점(ArrowHandles 가 그리는 것과 같은 집합). */
export type ArrowHandle = 'from' | 'ctrl' | 'to';
/** 키보드 조작 대상 — 'whole' 은 화살표 전체다. */
export type ArrowPart = 'whole' | ArrowHandle;

/** §7.5c 화살표 키보드 미세조정 — 델타만큼 민다.
 *
 *  `'whole'` 은 세 점을 함께 밀어 **모양(굽힘·길이·방향)을 그대로 유지한 채** 통째로 옮긴다.
 *  나머지는 그 점 **하나만** 옮긴다 — 핸들 드래그(useEditorPointer.ts 의 arrowHandleDrag)와
 *  같은 의미다. 끝점을 옮길 때 `ctrl` 이 따라오지 않으므로 곧던 화살표는 조금 휘는데, 그것도
 *  마우스로 끌었을 때와 똑같다. 두 입력 경로가 같은 결과를 내는 것이 §7.5 의 요구다. */
export function nudgeArrow(a: Arrow, part: ArrowPart, d: Vec2): Arrow {
  const mv = (p: Vec2): Vec2 => ({ x: p.x + d.x, y: p.y + d.y });
  if (part === 'whole') return { ...a, from: mv(a.from), ctrl: mv(a.ctrl), to: mv(a.to) };
  return { ...a, [part]: mv(a[part]) };
}

/** §6.7/3.10 스텝 전환 트윈의 화살표 프레임 키. 화살표는 transform 하나로 표현이 안 된다
 *  (세 점이 각자 움직인다) — 점 하나를 프레임 항목 하나(`${id}@from` 등)로 싣고, DOM 쪽
 *  (transformWriter.registerArrow)이 세 점을 모아 `d` 를 다시 조립한다. 구분자 `@` 는 id
 *  문자집합(접두 2자 + '_' + base36)에 없어 실제 개체 id 와 절대 충돌하지 않는다.
 *  생산자(store/editor/tween.poseFrame)와 소비자(render/transformWriter)가 다른 레이어라
 *  둘 다 이미 import 하는 이 모듈이 키 규약의 단일 출처다. */
export const ARROW_POINT_SEP = '@';
export function arrowPointKey(id: string, point: ArrowHandle): string {
  return `${id}${ARROW_POINT_SEP}${point}`;
}
export function parseArrowPointKey(key: string): { id: ArrowId; point: ArrowHandle } | null {
  const i = key.indexOf(ARROW_POINT_SEP);
  if (i < 0) return null;
  const id = key.slice(0, i);
  if (!isId(id, 'ar')) return null;
  const point = key.slice(i + 1);
  return point === 'from' || point === 'ctrl' || point === 'to' ? { id, point } : null;
}
