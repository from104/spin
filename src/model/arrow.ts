// §3.5(화살표 부분) — 2차 베지에 화살표. D8/D9.
import { ARROW_COLORS } from '../core/colors.ts';
import type { Vec2 } from '../core/units.ts';
import { isId } from '../core/ids.ts';
import type { ArrowId } from '../core/ids.ts';
import type { Locale } from '../i18n/locale.ts';

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
export const ARROW_STYLE: ArrowStyle = { color: ARROW_COLORS[0], width: 3.4 };
export const arrowColor = (a: Pick<Arrow, 'color'>): string => a.color ?? ARROW_STYLE.color;

/** 굽힘점(ctrl)을 거듭 눌렀을 때 도는 색 — **하늘 → 노랑 → 빨강**(기현 지시 2026-08-17).
 *
 *  ── 왜 여기서 색을 고르는가 ─────────────────────────────────────────────────────────
 *  화살촉이 양 끝을 눌러 도는 것과 짝이다: 선을 그은 **뒤에** 그 선 위에서 뜻을 바꾼다.
 *  색을 미리 고르게 하면 도구가 셋으로 늘고, 그건 2026-08-16 에 종류(move/pass/shot)를
 *  없앤 판단을 되돌리는 것이다. 굽힘점은 지금까지 눌러도 아무 일이 없던 유일한 핸들이라
 *  비어 있는 자리이기도 했다.
 *
 *  ⚠️ 첫 값은 반드시 `ARROW_STYLE.color` 다. 한 바퀴 돌면 `color` 를 **지워서**(=undefined)
 *  기본색으로 되돌리기 때문이다 — 리터럴로 박아 두면 기본색을 바꾼 날 옛 드릴만 옛 하늘색으로
 *  남는다. 이 짝은 arrow.test.ts 가 못박는다.
 *
 *  ── 색값의 근거 (코트 #1f7a46 · 케이싱 #000000 기준) ─────────────────────────────────
 *   하늘 #38bdf8  코트 2.49:1 · 케이싱 9.80:1   기본색(ARROW_STYLE)
 *   노랑 #fde047  코트 4.05:1 · 케이싱 15.93:1  공(#fbbf24)보다 밝은 값을 골랐다 — 공과
 *                 구별되고, 아래 ⚠️ 때문에 빨강과의 **밝기** 차이도 벌어진다(2.85:1)
 *   빨강 #ef4444  코트 1.42:1 · 케이싱 5.58:1   기본 우리팀색(#d93a3a)보다 밝아 겹쳐 보이지 않는다
 *
 *  ⚠️ **노랑과 빨강은 적록색약에게 사실상 같은 색이다**(둘의 이색각 분리 0.4~1.0, 콘 색이 쓴
 *  임계 0.25 를 겨우 넘긴다 — 하늘 대 나머지는 49~117 이다). 색만으로 뜻을 가르는 판을 만들면
 *  그 코치는 두 색을 못 읽는다. 그래서 색은 **화살촉(none/thin/wide)을 대신하지 않고 더한다** —
 *  뜻을 나르는 채널은 여전히 화살촉이 주(主)이고 색은 보조다. 이 순서를 뒤집지 말 것.
 *
 *  값 자체는 `core/colors.ts` 의 `ARROW_COLORS` 에 있다 — 썸네일이 색이 아니라 **첨자**를
 *  저장하는데(`model/thumb.ts`) 그 첨자를 푸는 쪽이 core 만 볼 수 있어서다(그 파일의 ⚠️). */
export const ARROW_COLOR_CYCLE: readonly string[] = ARROW_COLORS;
/** 발화용 이름 — hex 를 그대로 읽으면 스크린리더가 낱글자를 센다(colors.ts 의 팀색 이름과 같은 이유). */
export const ARROW_COLOR_NAMES: Record<Locale, Record<string, string>> = {
  ko: { '#38bdf8': '하늘', '#fde047': '노랑', '#ef4444': '빨강' },
  en: { '#38bdf8': 'sky', '#fde047': 'yellow', '#ef4444': 'red' },
  ja: { '#38bdf8': 'スカイ', '#fde047': '黄', '#ef4444': '赤' },
};
const ARROW_COLOR_CUSTOM: Record<Locale, string> = { ko: '사용자 지정', en: 'custom', ja: 'カスタム' };
export const arrowColorName = (a: Pick<Arrow, 'color'>, locale: Locale): string =>
  ARROW_COLOR_NAMES[locale][arrowColor(a)] ?? ARROW_COLOR_CUSTOM[locale];

/** 다음 색으로 돌린 화살표. 순환 밖의 색(인스펙터가 언젠가 임의 색을 넣는다면)은 `indexOf`
 *  가 -1 이라 **첫 값**으로 간다 — `cycleHead` 와 같은 규약이다. */
export function cycleArrowColor(a: Arrow): Arrow {
  const next = ARROW_COLOR_CYCLE[(ARROW_COLOR_CYCLE.indexOf(arrowColor(a)) + 1) % ARROW_COLOR_CYCLE.length]!;
  if (next !== ARROW_STYLE.color) return { ...a, color: next };
  // 기본색으로 돌아왔다 = 덮어쓰기 해제. 키를 남기지 않는 것이 `color?` 의 계약이다.
  const { color: _drop, ...rest } = a;
  return rest;
}

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
/** 포인터로 잡을 수 있는 손잡이 — 세 점 + **회전 앵커**(기현 지시 2026-08-18).
 *  `ArrowHandle` 을 넓히지 않고 따로 두는 이유: 그 타입은 트윈 프레임 키(`arrowPointKey`)와
 *  키보드 미세조정(`nudgeArrow`)의 어휘라, '회전' 이 끼면 "rotate 점의 좌표" 라는 있지도 않은
 *  개념이 두 계약에 새어 들어간다 — 회전은 점이 아니라 **세 점을 한꺼번에 돌리는 조작**이다. */
export type ArrowGrip = ArrowHandle | 'rotate';

/** 회전 앵커가 화살표 한가운데(`arrowMid`)에서 떨어져 앉는 거리(월드 px).
 *  도형의 `SHAPE_ROTATE_MIN_SEP_PX`(48)와 같은 값이다 — 손잡이끼리 겹치지 않는 최소 간격이
 *  거기서 이미 한 번 정해졌고, 짧은 화살표에서는 세 점이 전부 mid 근처에 모이므로 이 거리가
 *  곧 그 분리 보장이다. */
export const ARROW_ROTATE_GAP_PX = 48;

/** 회전 앵커의 자리 — `arrowMid` 에서 현(from→to)에 수직으로, **굽힘(ctrl)의 반대쪽**.
 *
 *  왜 반대쪽인가: ctrl 손잡이는 굽힘 쪽에 있다. 같은 쪽에 두면 깊게 굽힌 화살표에서 두
 *  손잡이가 포개져 어느 쪽을 잡을지 매번 복불복이 된다. 곧은 화살표(ctrl 이 현 위)는 어느
 *  쪽이든 비어 있으므로 진행방향 오른쪽으로 고정한다. 판정 문턱이 0 이 아니라 1px 인 이유:
 *  ctrl 이 현 바로 위에서 1px 미만으로 떨리는 동안 앵커가 좌우로 널뛰지 않게 하기 위해서다
 *  (앵커가 편을 바꾸는 순간 자체는 없앨 수 없다 — 문턱은 곧은 화살표를 한쪽에 붙들 뿐이다).
 *
 *  퇴화(길이 0 현)는 위(-y)로 눕힌다 — 어디든 한 곳이면 되고, 위는 도형 회전 손잡이의 기본
 *  방향과 같다. */
export function arrowRotateHandlePoint(a: Pick<Arrow, 'from' | 'ctrl' | 'to'>): Vec2 {
  const mid = arrowMid(a);
  const dx = a.to.x - a.from.x;
  const dy = a.to.y - a.from.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return { x: mid.x, y: mid.y - ARROW_ROTATE_GAP_PX };
  // 진행방향 +90°(화면 시계방향, y-down) 단위 법선 — defaultCtrl 의 것과 같은 식이다.
  let nx = -dy / len;
  let ny = dx / len;
  const chordMidX = (a.from.x + a.to.x) / 2;
  const chordMidY = (a.from.y + a.to.y) / 2;
  const side = nx * (a.ctrl.x - chordMidX) + ny * (a.ctrl.y - chordMidY);
  // 굽힘이 또렷할 때만(1px 초과) 그 반대쪽으로 뒤집는다. 그 이하는 "곧다" 로 보고 왼쪽 고정.
  if (side > 1) {
    nx = -nx;
    ny = -ny;
  }
  return { x: mid.x + nx * ARROW_ROTATE_GAP_PX, y: mid.y + ny * ARROW_ROTATE_GAP_PX };
}

/** 세 점을 `center` 둘레로 `rad`(라디안, 화면 시계방향) 돌린 화살표. **순수 함수다** —
 *  도형의 `dragShapeHandle` 과 같은 이유로, 포인터 코드가 자기 산수를 갖지 않아야 이 규칙을
 *  jsdom 없이 검증할 수 있다. 화살촉·색은 그대로다(모양만 도는 조작이다).
 *
 *  중심은 부르는 쪽이 쥔다 — 돌리는 동안 `arrowMid` 가 함께 돌므로, 매 프레임 다시 재면
 *  축이 흘러 다닌다. 드래그 시작 때의 mid 를 **래치**해서 넘기는 것이 계약이다(D18 과 같은
 *  규율: 잡는 순간의 기준을 물고 늘어져야 손끝과 결과가 안 어긋난다). */
export function rotateArrowAbout(a: Arrow, center: Vec2, rad: number): Arrow {
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rot = (p: Vec2): Vec2 => ({
    x: center.x + (p.x - center.x) * cos - (p.y - center.y) * sin,
    y: center.y + (p.x - center.x) * sin + (p.y - center.y) * cos,
  });
  return { ...a, from: rot(a.from), ctrl: rot(a.ctrl), to: rot(a.to) };
}

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
