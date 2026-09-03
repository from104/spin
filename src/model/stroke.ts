// §3.5(자유 그리기 부분) — 획(Stroke). 2026-09-03 기현 지시:
// *"드릴 편집 작도에 자유 그리기 추가. 백터로 그리고 3개의 앵커 회전, 양끝 화살표 그냥 클릭
//   3단계, 약간 외각에 회전(드래그는 회전, 그냥 클릭은 색 순환). 선 (반복 클릭 굵기 3단계,
//   드래그 이동)."*
//
// ── 한 줄 원칙 ────────────────────────────────────────────────────────────────────────────
// **획은 화살표의 N점 판이다.** 화살촉 3단계·색 팔레트·회전 앵커 간격은 `model/arrow.ts` 의
// 계약을 **그대로 빌려 쓴다**(재구현하지 않는다 — 같은 규약이 두 곳에 적히면 한쪽만 고쳐지는
// 날이 온다). 새로 생기는 것은 둘뿐이다: 점 목록(`points`)과 **굵기 3단계**(`width` 인덱스).
//
// ⚠️ 굵기를 `Arrow` 에 소급하지 않는다 — `ARROW_STYLE.width` 를 파생해 쓰는 자리가 여럿이라,
//    거기에 인덱스 축을 더하는 것은 이 파일이 아니라 그 다섯 곳의 일이다.
import type { Vec2 } from '../core/units.ts';
import { isId } from '../core/ids.ts';
import type { StrokeId } from '../core/ids.ts';
import {
  ARROW_ROTATE_GAP_PX,
  ARROW_STYLE,
  arrowColor,
  cycleHead,
  nextArrowColor,
  type ArrowHead,
} from './arrow.ts';

/** 굵기 3단(기현 지시 *"반복 클릭 굵기 3단계"*)의 인덱스. 값(px)이 아니라 **첨자**를 저장한다 —
 *  콘의 `colorIndex`·썸네일의 색 첨자와 같은 규약이고, 나중에 굵기 값을 손보면 옛 획도 함께
 *  따라온다(px 를 구워 넣으면 옛 획만 옛 굵기로 남는다). */
export type StrokeWidthIndex = 0 | 1 | 2;
/** 가는 / 보통 / 굵은. 가운데 값은 `ARROW_STYLE.width` 와 같다 — 화살표 옆에 그은 획이 같은
 *  선으로 보여야 하기 때문이고, 이 등식은 stroke.test.ts 가 못박는다(리터럴 대조가 아니라). */
export const STROKE_WIDTHS = [2.4, 3.4, 5.2] as const;
/** 기본 굵기의 첨자. `width` 키가 없다는 것이 곧 이 값이다. */
export const STROKE_WIDTH_DEFAULT: StrokeWidthIndex = 1;

/** 획 — 코트 위에 손으로 그은 벡터 선.
 *
 *  화살표(`Arrow`)와 나란한 부류다: 스텝이 통째로 소유하고(cast 가 아니다), 색·화살촉은
 *  **덮어쓸 때만** 키를 만든다. 다른 점은 점이 셋(from/ctrl/to)이 아니라 N개라는 것뿐이다. */
export interface Stroke {
  id: StrokeId;
  /** 월드 px. 캡처가 `simplifyPoints` 를 지난 뒤의 값이라 손가락 표본 그대로가 아니다 —
   *  파일 크기와 렌더 비용이 점 수에 정비례하고, RDP 는 눈에 안 보이는 점만 버린다. */
  points: readonly Vec2[];
  /** 기본색을 무시할 때만(회전 앵커 클릭 = 색 순환). 없으면 `ARROW_STYLE.color`. */
  color?: string;
  /** 굵기 첨자. 없으면 `STROKE_WIDTH_DEFAULT`(=1). */
  width?: StrokeWidthIndex;
  /** 시작점 화살촉. 없으면 **'none'**. */
  headFrom?: ArrowHead;
  /** 끝점 화살촉. 없으면 **'none'** — 화살표(`headTo` 기본 'thin')와 **다른** 기본값이다.
   *  "자유 그리기" 는 선이 기본이고 화살촉은 사용자가 켜는 것이라는 결정(PLAN 결정 5). */
  headTo?: ArrowHead;
}

export const strokeColor = (s: Pick<Stroke, 'color'>): string => arrowColor(s);
export const strokeHeadFrom = (s: Pick<Stroke, 'headFrom'>): ArrowHead => s.headFrom ?? 'none';
export const strokeHeadTo = (s: Pick<Stroke, 'headTo'>): ArrowHead => s.headTo ?? 'none';
export const strokeWidthIndexOf = (s: Pick<Stroke, 'width'>): StrokeWidthIndex => s.width ?? STROKE_WIDTH_DEFAULT;
export const strokeWidthOf = (s: Pick<Stroke, 'width'>): number => STROKE_WIDTHS[strokeWidthIndexOf(s)];

/** 굵기를 한 칸 돌린다 — 0 → 1 → 2 → 0.
 *
 *  ⚠️ 기본 첨자로 돌아오면 **키를 지운다**. `cycleArrowColor` 가 기본색에서 `color` 를 지우는
 *  것과 같은 계약이고, 이유도 같다: 키가 남아 있으면 나중에 기본 굵기를 옮겼을 때 그동안
 *  "기본으로 되돌려 둔" 획만 옛 굵기로 남는다. */
export function cycleStrokeWidth(s: Stroke): Stroke {
  const next = ((strokeWidthIndexOf(s) + 1) % STROKE_WIDTHS.length) as StrokeWidthIndex;
  if (next !== STROKE_WIDTH_DEFAULT) return { ...s, width: next };
  const { width: _drop, ...rest } = s;
  return rest;
}

/** 한쪽 끝 화살촉을 한 칸 돌린다(none → thin → wide → none). 순환 자체는 `cycleHead` 가
 *  쥔다 — 순서가 화살표와 갈리면 같은 앵커가 도구마다 다르게 도는 판이 된다. */
export function cycleStrokeHead(s: Stroke, which: 'from' | 'to'): Stroke {
  const key = which === 'from' ? 'headFrom' : 'headTo';
  const next = cycleHead(which === 'from' ? strokeHeadFrom(s) : strokeHeadTo(s));
  const out: Stroke = { ...s };
  // 기본값('none')으로 돌아오면 키를 지운다 — 굵기·색과 같은 규약이다.
  if (next === 'none') delete out[key];
  else out[key] = next;
  return out;
}

/** 색을 한 칸 돌린다(하늘 → 노랑 → 빨강 → 기본). 다음 색을 고르는 계산과 "한 바퀴 돌면 키
 *  삭제" 는 `nextArrowColor` 가 쥔다 — 화살표와 획이 같은 팔레트를 쓴다는 것이 결정 1 이다. */
export function cycleStrokeColor(s: Stroke): Stroke {
  const next = nextArrowColor(s.color);
  if (next !== null) return { ...s, color: next };
  const { color: _drop, ...rest } = s;
  return rest;
}

// ---- 캡처 단순화 -------------------------------------------------------------------------

/** 인접 표본이 이보다 가까우면 버린다. 손끝이 멈춰 있는 동안에도 포인터 이벤트는 계속 오는데,
 *  그 표본은 모양에 아무것도 더하지 않으면서 점 상한(`LIMITS.pointsPerStroke`)만 갉아먹는다. */
export const STROKE_MIN_STEP_PX = 2;
/** RDP 허용 오차(px). 이보다 가깝게 직선에 붙은 중간점은 버려도 눈에 안 띈다.
 *  값이 크면 곡선이 각지고, 작으면 파일이 커진다 — 실기 확인 대상(PLAN §4). */
export const STROKE_SIMPLIFY_EPSILON_PX = 1.5;

/** 점 p 에서 선분 ab 까지의 수직 거리. a≡b(퇴화)면 점 사이 거리다. */
function segDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 < 1e-12) return Math.hypot(p.x - a.x, p.y - a.y);
  // 선분 밖으로 나가도 **직선까지의** 거리를 쓴다(t 를 안 자른다) — RDP 의 정의가 그렇고,
  // 자르면 크게 꺾인 획의 바깥 점이 과대평가돼 단순화가 사실상 멈춘다.
  return Math.abs(dy * (p.x - a.x) - dx * (p.y - a.y)) / Math.sqrt(len2);
}

/** Ramer–Douglas–Peucker. **반복형(명시적 스택)이다** — 재귀로 쓰면 400점짜리 획이 최악의
 *  경우(계단 모양) 400단 깊이로 들어가고, 그 스택 넘침은 사용자가 그린 모양에 달려 있어
 *  테스트로 재현하기 어려운 고장이 된다. */
function rdp(pts: readonly Vec2[], epsilon: number): Vec2[] {
  const n = pts.length;
  if (n <= 2) return pts.slice();
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack: Array<[number, number]> = [[0, n - 1]];
  while (stack.length > 0) {
    const [lo, hi] = stack.pop()!;
    if (hi - lo < 2) continue;
    const a = pts[lo]!;
    const b = pts[hi]!;
    let far = -1;
    let best = epsilon;
    for (let i = lo + 1; i < hi; i += 1) {
      const d = segDistance(pts[i]!, a, b);
      if (d > best) {
        best = d;
        far = i;
      }
    }
    if (far < 0) continue; // 이 구간은 통째로 직선으로 봐도 된다
    keep[far] = 1;
    stack.push([lo, far], [far, hi]);
  }
  const out: Vec2[] = [];
  for (let i = 0; i < n; i += 1) if (keep[i] === 1) out.push(pts[i]!);
  return out;
}

/** 캡처한 표본을 저장할 모양으로 접는다: **① 붙어 있는 표본 제거 → ② RDP**.
 *
 *  순서가 뜻을 갖는다. ①을 먼저 하는 것은 값싼 필터가 앞이라서만이 아니라, 손이 멈춘 동안
 *  쌓인 같은 자리 표본이 ②의 "가장 먼 점" 판정에서 0 거리로 잡혀 구간을 무의미하게 쪼개기
 *  때문이다. 양 끝은 언제나 남는다 — 획의 시작·끝은 앵커가 붙는 자리다. */
export function simplifyPoints(points: readonly Vec2[], epsilon: number = STROKE_SIMPLIFY_EPSILON_PX): Vec2[] {
  if (points.length === 0) return [];
  const thinned: Vec2[] = [points[0]!];
  for (let i = 1; i < points.length; i += 1) {
    const p = points[i]!;
    const q = thinned[thinned.length - 1]!;
    if (Math.hypot(p.x - q.x, p.y - q.y) >= STROKE_MIN_STEP_PX) thinned.push(p);
  }
  // ⚠️ 끝점은 **붙어 있어도** 살린다. 위 걸러내기는 마지막으로 남긴 점과만 재므로, 손을 떼기
  // 직전 표본이 문턱 안이면 그대로 사라진다 — 그러면 획의 끝이 최대 2px 짧아지고, 거기 앉는
  // 회전 앵커(`strokeHandlePoints`)도 사용자가 손을 뗀 자리와 어긋난다. 천천히 그은 짧은 획
  // 에서는 이것이 획 길이의 전부일 수도 있다(그 경우 점이 하나만 남아 validate 가 획을 버린다).
  const last = points[points.length - 1]!;
  const tail = thinned[thinned.length - 1]!;
  if (last.x !== tail.x || last.y !== tail.y) thinned.push(last);
  return rdp(thinned, epsilon);
}

// ---- 기하 -------------------------------------------------------------------------------

const round2 = (n: number): number => Math.round(n * 100) / 100;
const xy = (p: Vec2): string => `${round2(p.x)},${round2(p.y)}`;

/** `M…C…` — Catmull-Rom 스플라인을 3차 베지에로 옮긴 것. 점 2개면 직선(`L`)이다.
 *
 *  ⚠️ 좌표 반올림이 `arrowPath` 와 같은 0.01 인 것은 우연이 아니다: 스텝 전환 트윈이 보간 중인
 *  점들로 같은 문자열을 조립하므로, 반올림까지 같아야 트윈 종점의 `d` 와 React 가 렌더한 `d` 가
 *  한 글자도 안 어긋난다(그 어긋남은 전환 끝에서 선이 한 번 튀는 것으로 보인다).
 *
 *  Catmull-Rom → 베지에 변환의 1/6 은 표준 계수다(장력 0.5의 uniform 스플라인). 양 끝에서는
 *  바깥 이웃이 없으므로 끝점을 복제한다 — 그러면 끝 접선이 첫 선분 방향과 같아져, 획이 시작
 *  하자마자 반대로 휘는 일이 없다. */
export function strokePath(s: Pick<Stroke, 'points'>): string {
  const p = s.points;
  if (p.length === 0) return '';
  const head = `M${xy(p[0]!)}`;
  if (p.length === 1) return head;
  if (p.length === 2) return `${head} L${xy(p[1]!)}`;
  let d = head;
  for (let i = 0; i < p.length - 1; i += 1) {
    const p0 = p[i - 1] ?? p[i]!;
    const p1 = p[i]!;
    const p2 = p[i + 1]!;
    const p3 = p[i + 2] ?? p2;
    const c1: Vec2 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2: Vec2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${xy(c1)} ${xy(c2)} ${xy(p2)}`;
  }
  return d;
}

/** 점들의 경계상자. 회전축(`strokeCenter`)과 고무줄 선택 판정이 여기서 나온다. */
export function strokeBounds(s: Pick<Stroke, 'points'>): { x: number; y: number; w: number; h: number } {
  const p = s.points;
  if (p.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = p[0]!.x;
  let maxX = p[0]!.x;
  let minY = p[0]!.y;
  let maxY = p[0]!.y;
  for (const q of p) {
    if (q.x < minX) minX = q.x;
    if (q.x > maxX) maxX = q.x;
    if (q.y < minY) minY = q.y;
    if (q.y > maxY) maxY = q.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

/** 회전축이자 대표점 — **경계상자의 중심**이다.
 *
 *  점들의 산술 평균이 아닌 이유: 표본 밀도는 손이 빠른 곳에서 성기고 느린 곳에서 촘촘하므로,
 *  평균을 쓰면 "천천히 그린 쪽" 으로 축이 끌려간다. 같은 모양을 다른 속도로 그리면 회전축이
 *  달라지는 셈이라, 사용자가 볼 때 이유 없는 차이가 된다. */
export function strokeCenter(s: Pick<Stroke, 'points'>): Vec2 {
  const b = strokeBounds(s);
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
}

/** 회전 앵커가 획 끝에서 떨어져 앉는 거리(월드 px). 화살표의 것을 **그대로** 쓴다 —
 *  손잡이끼리 겹치지 않는 최소 간격은 도형(`SHAPE_ROTATE_MIN_SEP_PX`)에서 한 번 정해졌고,
 *  같은 판 위의 두 도구가 다른 간격을 쓰면 손이 자리를 두 벌 외워야 한다. */
export const STROKE_ROTATE_GAP_PX = ARROW_ROTATE_GAP_PX;

/** 포인터로 잡을 수 있는 손잡이 셋(기현 지시 *"3개의 앵커"*).
 *  `ArrowGrip` 과 달리 'ctrl' 이 없다 — 획에는 굽힘점이 없다(모양을 점들이 전부 쥔다). */
export type StrokeGrip = 'from' | 'to' | 'rotate';

/** 세 앵커의 자리 — 첫 점 · 끝 점 · **끝 접선 방향으로 48px 바깥**.
 *
 *  화살표는 회전 앵커를 한가운데(mid)의 법선 위에 두는데, 획은 그럴 수 없다: 점이 N개라
 *  "한가운데" 가 곡선 위 어디인지 값이 하나로 안 나오고, 어디에 두든 획 자체와 겹칠 확률이
 *  높다. 끝에서 **선을 연장한 자리**는 정의상 획이 지나간 적 없는 곳이라 언제나 비어 있고,
 *  손이 방금 뗀 자리 바로 옆이라 찾기도 쉽다.
 *
 *  접선은 끝점과 **다른 자리의 마지막 점** 사이에서 잰다 — 끝에 같은 좌표가 겹쳐 들어와도
 *  방향이 0/0 이 되지 않게. 그마저 없으면(점 하나, 또는 전부 같은 자리) 위(-y)로 눕힌다:
 *  `arrowRotateHandlePoint` 의 퇴화 처리와 같은 방향이라 두 도구가 같은 모습을 보인다. */
export function strokeHandlePoints(s: Pick<Stroke, 'points'>): { from: Vec2; to: Vec2; rotate: Vec2 } {
  const p = s.points;
  const from = p[0] ?? { x: 0, y: 0 };
  const to = p[p.length - 1] ?? from;
  let dx = 0;
  let dy = 0;
  for (let i = p.length - 2; i >= 0; i -= 1) {
    const q = p[i]!;
    if (q.x !== to.x || q.y !== to.y) {
      dx = to.x - q.x;
      dy = to.y - q.y;
      break;
    }
  }
  const len = Math.hypot(dx, dy);
  if (len < 1e-9) return { from, to, rotate: { x: to.x, y: to.y - STROKE_ROTATE_GAP_PX } };
  return { from, to, rotate: { x: to.x + (dx / len) * STROKE_ROTATE_GAP_PX, y: to.y + (dy / len) * STROKE_ROTATE_GAP_PX } };
}

/** 점 전부를 `center` 둘레로 `rad`(라디안, 화면 시계방향) 돌린 획. **순수 함수다** —
 *  `rotateArrowAbout` 과 같은 이유로, 포인터 코드가 자기 산수를 갖지 않아야 이 규칙을 jsdom
 *  없이 검증할 수 있다. 색·굵기·화살촉은 그대로다(모양만 도는 조작이다).
 *
 *  중심은 부르는 쪽이 쥔다 — 돌리는 동안 `strokeCenter` 가 함께 돌므로, 매 프레임 다시 재면
 *  축이 흘러 다닌다. 드래그 시작 때의 중심을 **래치**해서 넘기는 것이 계약이다. */
export function rotateStrokeAbout(s: Stroke, center: Vec2, rad: number): Stroke {
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    ...s,
    points: s.points.map((p) => ({
      x: center.x + (p.x - center.x) * cos - (p.y - center.y) * sin,
      y: center.y + (p.x - center.x) * sin + (p.y - center.y) * cos,
    })),
  };
}

/** 획 전체를 델타만큼 민다. 모양(굽이·길이·방향)은 그대로다. */
export function translateStroke(s: Stroke, d: Vec2): Stroke {
  if (d.x === 0 && d.y === 0) return s;
  return { ...s, points: s.points.map((p) => ({ x: p.x + d.x, y: p.y + d.y })) };
}

/** §7.5c 키보드 미세조정. 획에는 **부분이 없다** — `nudgeArrow(a, 'whole', d)` 에 해당하는
 *  갈래 하나뿐이라 `part` 를 받지 않는다. 구현을 나누지 않고 이름만 주는 이유: 부르는 쪽의
 *  어휘가 다르다(그쪽은 키보드, `translateStroke` 는 드래그·무리 이동). */
export const nudgeStroke = translateStroke;

// ---- 스텝 전환 트윈 키 --------------------------------------------------------------------

/** §6.7/3.10 스텝 전환 트윈의 획 프레임 키 — `${id}@${점수}@${첨자}`.
 *
 *  ⚠️ **점 수가 키에 들어 있는 것이 이 규약의 전부다.** 같은 id 의 획이라도 스텝마다 점 수가
 *  다를 수 있는데(다시 그렸다), 점 수가 다른 두 획을 점별로 이으면 5번째 점이 12번째 점을
 *  향해 기어가는 형체 불명의 애니메이션이 나온다. 점 수를 키에 넣으면 두 스텝의 키 집합이
 *  아예 겹치지 않으므로, `frameAt` 의 "한쪽에만 있으면 있는 쪽 값" 갈래가 자동으로 **스냅**을
 *  만든다 — 보간 코드에 조건 하나도 더하지 않고. 점 수가 같으면 키가 겹쳐 점별 보간이 된다.
 *
 *  구분자 `@` 는 id 문자집합(접두 2자 + '_' + base36)에 없어 실제 개체 id 와 충돌하지 않는다
 *  (`ARROW_POINT_SEP` 와 같은 근거·같은 글자). 생산자(store/editor/tween.poseFrame)와
 *  소비자(render/transformWriter)가 다른 레이어라 둘 다 import 하는 이 모듈이 단일 출처다. */
export const STROKE_POINT_SEP = '@';
export function strokePointKey(id: string, count: number, index: number): string {
  return `${id}${STROKE_POINT_SEP}${count}${STROKE_POINT_SEP}${index}`;
}
export function parseStrokePointKey(key: string): { id: StrokeId; count: number; index: number } | null {
  const a = key.indexOf(STROKE_POINT_SEP);
  if (a < 0) return null;
  const b = key.indexOf(STROKE_POINT_SEP, a + 1);
  if (b < 0) return null;
  const id = key.slice(0, a);
  if (!isId(id, 'fh')) return null;
  const count = Number(key.slice(a + 1, b));
  const index = Number(key.slice(b + 1));
  if (!Number.isInteger(count) || !Number.isInteger(index)) return null;
  if (count < 0 || index < 0 || index >= count) return null;
  return { id, count, index };
}

/** 기본 스타일의 새 획이 무엇인가 — 캡처가 끝난 자리에서 부른다. 굵기·색·화살촉 키를 **안**
 *  만드는 것이 요점이다(그 셋의 기본값은 키 없음으로 표현한다는 계약). */
export function makeStroke(id: StrokeId, points: readonly Vec2[]): Stroke {
  return { id, points: points.map((p) => ({ x: p.x, y: p.y })) };
}

/** 기본 굵기가 화살표의 선 굵기와 같다는 것을 타입 밖에서도 읽히게 둔다 — 값이 갈리면
 *  화살표 옆의 획이 다른 선으로 보인다(stroke.test.ts 가 이 등식을 지킨다). */
export const STROKE_DEFAULT_WIDTH_PX: number = ARROW_STYLE.width;
