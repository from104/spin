// §3.6 presence · 재생. 재생 구현은 sampleDrill + rAF 단일 경로 — CSS transition 대안은
// 삭제한다(스크럽·시크 때문에 sampleDrill 은 어차피 필요하고, 두 경로를 두면 루프 경계에서
// 자동 재생은 미끄러지고 스크럽은 순간이동하는 불일치가 생긴다).
import type { Vec2 } from '../core/units.ts';
import { lerpAngle, shortestDelta, arcTangentK } from '../core/angle.ts';
import { easeStandard, easeIn, easeOut, easeLinear } from '../core/geom.ts';
import type { ChairId, BallId, ConeId } from '../core/ids.ts';
import type { Drill, DrillStep, ChairDef, NoteLabel, StoredBallRing, TeamSide } from './drill.ts';
import type { Arrow } from './arrow.ts';
import type { Stroke } from './stroke.ts';
import { poseFromStored, type ChairPose } from './chair.ts';
import { IGNORED_OPACITY } from '../core/constants.ts';

export { easeStandard };

export type Presence = 'both' | 'enter' | 'exit' | 'absent';

export function presenceOf<P>(a: P | undefined, b: P | undefined): Presence {
  if (a !== undefined && b !== undefined) return 'both';
  if (a !== undefined) return 'exit';
  if (b !== undefined) return 'enter';
  return 'absent';
}

export interface RenderChair {
  id: ChairId;
  def: ChairDef;
  x: number;
  y: number;
  theta: number;
  opacity: number;
}
export interface RenderBall {
  id: BallId;
  x: number;
  y: number;
  opacity: number;
  /** §7 5.2 공마다 따로 켠 거리 원. 없으면 'none'(콘의 `colorIndex` 와 같이 cast 의 def 에서
   *  프레임으로 옮겨 싣는 표시 상태다). **PNG 가 이것을 읽는다** — 프레임에 안 실으면
   *  내보낸 그림에만 원이 사라지거나(또는 모든 공에 3 m 가 다시 뜨거나) 한다. */
  ring?: StoredBallRing;
  /** 그 스텝에서 이 공을 **차는 팀**(세트피스 소유). 링과 같은 이유로 프레임에 싣는다 —
   *  PNG 가 이것을 읽어 화살표를 그리고 5 m 판정의 방향을 정한다. 없으면 진영에서 파생한다. */
  owner?: TeamSide;
}
export interface RenderCone {
  id: ConeId;
  colorIndex: 0 | 1;
  x: number;
  y: number;
  opacity: number;
}
export interface RenderFrame {
  stepIndex: number;
  t: number;
  chairs: RenderChair[];
  balls: RenderBall[];
  cones: RenderCone[];
  arrows: Array<Arrow & { opacity: number }>;
  notes: Array<NoteLabel & { opacity: number }>;
  /** 자유 그리기 획(2026-09-03). 화살표와 나란한 자리다 — 시연(`PresentObjects`)과 PNG
   *  (`buildStaticSvg`)은 스텝이 아니라 **이 프레임**을 소비하므로, 여기 없으면 그 두 경로는
   *  획을 그릴 방법 자체가 없다(인쇄는 `step` 을 직접 읽어 해당 없음). */
  strokes: Array<Stroke & { opacity: number }>;
}

const dirVec = (theta: number): Vec2 => ({ x: Math.cos(theta), y: Math.sin(theta) });

// 표준 3차 Hermite 기저.
const H00 = (t: number): number => (2 * t - 3) * t * t + 1;
const H10 = (t: number): number => ((t - 2) * t + 1) * t;
const H01 = (t: number): number => (-2 * t + 3) * t * t;
const H11 = (t: number): number => (t - 1) * t * t;

/** 휠체어 = Hermite + 최단호 각도(§3.6). d≈0(제자리 회전 전환)이면 m0=m1=0 이 자연히 나와
 *  위치가 고정되고 각도만 회전한다(자연 축퇴 — 별도 분기가 필요 없다). */
export function interpChair(a: ChairPose, b: ChairPose, e: number): ChairPose {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy);
  const phi = Math.abs(shortestDelta(a.theta, b.theta));
  const K = arcTangentK(phi);
  const u0 = dirVec(a.theta);
  const u1 = dirVec(b.theta);
  const sg = dx * u0.x + dy * u0.y < 0 ? -1 : 1; // rev = dot(P1-P0, u(θ0)) < 0
  const m0x = sg * K * d * u0.x;
  const m0y = sg * K * d * u0.y;
  const m1x = sg * K * d * u1.x;
  const m1y = sg * K * d * u1.y;
  const h00 = H00(e);
  const h10 = H10(e);
  const h01 = H01(e);
  const h11 = H11(e);
  return {
    x: h00 * a.x + h10 * m0x + h01 * b.x + h11 * m1x,
    y: h00 * a.y + h10 * m0y + h01 * b.y + h11 * m1y,
    theta: lerpAngle(a.theta, b.theta, e),
  };
}

function lerpVec(a: Vec2, b: Vec2, e: number): Vec2 {
  return { x: a.x + (b.x - a.x) * e, y: a.y + (b.y - a.y) * e };
}

/** 화살표·메모 공용 presence 보간. 출력 배열은 id 로 유일하다(step 안 id 유일 스코프 §3.5). */
function interpList<T extends { id: string }>(
  fromList: T[],
  toList: T[],
  e: number,
  both: (a: T, b: T, e: number) => T & { opacity: number },
): Array<T & { opacity: number }> {
  const fromMap = new Map(fromList.map((x) => [x.id, x] as const));
  const toMap = new Map(toList.map((x) => [x.id, x] as const));
  const ids = new Set<string>([...fromMap.keys(), ...toMap.keys()]);
  const out: Array<T & { opacity: number }> = [];
  for (const id of ids) {
    const a = fromMap.get(id);
    const b = toMap.get(id);
    const presence = presenceOf(a, b);
    if (presence === 'absent') continue;
    if (presence === 'both') out.push(both(a!, b!, e));
    else if (presence === 'exit') out.push({ ...a!, opacity: 1 - e });
    else out.push({ ...b!, opacity: e });
  }
  return out;
}

/** stepIndex/t 는 sampleDrill 이 덮어쓴다 — 이 함수는 스텝 쌍 사이의 프레임 내용만 만든다.
 *
 *  ⚠️ 첫 인자를 `Pick<Drill,'cast'>` 로 **좁혀 둔다**(2026-08-27). 실제로 읽는 것이 cast 뿐인데
 *  `Drill` 을 요구하면, 드릴 전체를 안 가진 호출부 — 인쇄(`PrintCourt` 는 Pick 만 받는다) — 가
 *  프레임을 못 만들어 **자기만의 정적 렌더를 새로 짜게 된다.** 그 중복이 곧 화면과 종이가
 *  갈라지는 자리다(renderPaths.ts 머리말의 네 번째 사고). */
export function interpolateSteps(d: Pick<Drill, 'cast'>, from: DrillStep, to: DrillStep, e: number): RenderFrame {
  const chairs: RenderChair[] = [];
  // **무시된 휠체어는 흐리게** (2026-09-06). 링·소유와 같은 규약으로 `to`(지금 향하는 스텝)의
  // 값을 쓴다 — 보간할 중간값이 없는 이산 상태이고, `cut` 이 정한 "다음 스텝이 이긴다" 와
  // 방향이 같다. 이 한 줄이 없으면 물리에서 빠진 선수가 시연·PNG·인쇄에서만 멀쩡한 선수로
  // 나온다(판은 ObjectLayer 가 같은 상수로 흐리게 그린다).
  const ignored = new Set<string>(to.ignored ?? []);
  const dim = (id: string, o: number): number => (ignored.has(id) ? o * IGNORED_OPACITY : o);
  for (const def of d.cast.chairs) {
    const a = from.chairs[def.id];
    const b = to.chairs[def.id];
    const presence = presenceOf(a, b);
    if (presence === 'absent') continue;
    if (presence === 'both') {
      const p = interpChair(poseFromStored(a!), poseFromStored(b!), e);
      chairs.push({ id: def.id, def, x: p.x, y: p.y, theta: p.theta, opacity: dim(def.id, 1) });
    } else if (presence === 'exit') {
      const p = poseFromStored(a!);
      chairs.push({ id: def.id, def, x: p.x, y: p.y, theta: p.theta, opacity: dim(def.id, 1 - e) });
    } else {
      const p = poseFromStored(b!);
      chairs.push({ id: def.id, def, x: p.x, y: p.y, theta: p.theta, opacity: dim(def.id, e) });
    }
  }

  const balls: RenderBall[] = [];
  for (const def of d.cast.balls) {
    const a = from.balls[def.id];
    const b = to.balls[def.id];
    const presence = presenceOf(a, b);
    if (presence === 'absent') continue;
    // 5.2 — '없음' 은 **키를 만들지 않는다**(`ring: undefined` 를 쓰면 toStrictEqual 비교와
    // JSON 왕복에서 `{}` 와 다른 것이 된다 — edits.ts omitKey 머리말의 함정과 같은 값).
    // 링은 v9 부터 **스텝 소유**다. 보간하지 않고 `to`(지금 향하는 스텝)의 값을 쓴다 —
    // 색·좌표와 달리 중간값이 없는 이산 상태이고, `cut` 이 "다음 스텝이 이긴다" 로 정한
    // 방향과 같다(drill.ts 사슬 절). 그래서 원은 스텝 경계에서 즉시 갈린다.
    const r = to.ballRings?.[def.id];
    const ring = r !== undefined ? { ring: r } : {};
    const o = to.ballOwner?.[def.id];
    const owner = o !== undefined ? { owner: o } : {};
    if (presence === 'both') {
      const p = lerpVec(a!, b!, e);
      balls.push({ id: def.id, x: p.x, y: p.y, opacity: 1, ...ring, ...owner });
    } else if (presence === 'exit') {
      balls.push({ id: def.id, x: a!.x, y: a!.y, opacity: 1 - e, ...ring, ...owner });
    } else {
      balls.push({ id: def.id, x: b!.x, y: b!.y, opacity: e, ...ring, ...owner });
    }
  }

  const cones: RenderCone[] = [];
  for (const def of d.cast.cones) {
    const a = from.cones[def.id];
    const b = to.cones[def.id];
    const presence = presenceOf(a, b);
    if (presence === 'absent') continue;
    if (presence === 'both') {
      const p = lerpVec(a!, b!, e);
      cones.push({ id: def.id, colorIndex: def.colorIndex, x: p.x, y: p.y, opacity: 1 });
    } else if (presence === 'exit') {
      cones.push({ id: def.id, colorIndex: def.colorIndex, x: a!.x, y: a!.y, opacity: 1 - e });
    } else {
      cones.push({ id: def.id, colorIndex: def.colorIndex, x: b!.x, y: b!.y, opacity: e });
    }
  }

  // both → from/ctrl/to 각 성분을 선형 보간, kind·color·text 는 to 쪽 값, opacity 1.
  const arrows = interpList(from.arrows, to.arrows, e, (a, b, ee) => ({
    ...b,
    from: lerpVec(a.from, b.from, ee),
    ctrl: lerpVec(a.ctrl, b.ctrl, ee),
    to: lerpVec(a.to, b.to, ee),
    opacity: 1,
  }));
  const notes = interpList(from.notes, to.notes, e, (a, b, ee) => ({
    ...b,
    x: a.x + (b.x - a.x) * ee,
    y: a.y + (b.y - a.y) * ee,
    opacity: 1,
  }));

  // 획 — **점 수가 같을 때만** 점별 보간, 다르면 `to` 로 스냅(색·굵기·화살촉은 늘 `to` 쪽,
  // 화살표의 `...b` 와 같다).
  //
  // ⚠️ 스냅은 타협이 아니라 규약이다. 같은 id 의 획이라도 스텝마다 점 수가 다를 수 있는데
  // (다시 그렸다), 그 둘을 점별로 이으면 5번째 점이 12번째 점을 향해 기어가는 형체 불명의
  // 애니메이션이 나온다. 편집기 트윈(`store/editor/tween.ts`)이 같은 판정을 **키에 점 수를
  // 넣어** 구조적으로 얻는데, 여기서는 두 획을 한자리에서 보므로 조건으로 적는다 — 두 경로가
  // 같은 그림을 내야 하므로 규칙이 갈리면 안 된다(`model/stroke.ts` 의 `strokePointKey` 주석이
  // 이 규약의 단일 출처다).
  const strokes = interpList(from.strokes ?? [], to.strokes ?? [], e, (a, b, ee) => {
    if (a.points.length !== b.points.length) return { ...b, opacity: 1 };
    return { ...b, points: b.points.map((p, i) => lerpVec(a.points[i]!, p, ee)), opacity: 1 };
  });

  return { stepIndex: -1, t: e, chairs, balls, cones, arrows, notes, strokes };
}

export function effectiveStepMs(s: DrillStep, baseMs: number): number {
  return s.durationMs ?? baseMs;
}

/** 스텝 하나의 **정적** 프레임 — 보간 없이 그 스텝 그대로다(`e=0`, 같은 스텝을 양끝에 준다).
 *  인쇄·PNG 처럼 "한 장면을 한 번 그리는" 경로가 판정 함수(ruleMarkup 등)에 넘길 자료다.
 *  이 어댑터가 없으면 그런 경로마다 프레임 조립을 손으로 다시 적게 된다. */
export function staticFrameOf(d: Pick<Drill, 'cast'>, step: DrillStep, stepIndex = 0): RenderFrame {
  return { ...interpolateSteps(d, step, step, 0), stepIndex, t: 0 };
}

export function drillTotalMs(d: Drill, baseMs: number): number {
  let total = 0;
  for (const s of d.steps) total += effectiveStepMs(s, baseMs);
  return total;
}

const isSeamlessStep = (s: DrillStep | undefined): boolean => s !== undefined && s.cut !== true && s.seamless === true;

/** 딜레이 없는 연결의 이징은 **스텝 단위가 아니라 연속 구간 단위**다(PLAN-STEP-LINK 결정 3):
 *  이어진 스텝 k…m 에서 k 는 가속, 가운데는 등속, m 은 감속, 혼자면 지금의 in-out.
 *
 *  ⚠️ 스텝마다 in-out 을 걸면 **키프레임마다 멈칫한다** — 구간 끝에서 0 으로 감속했다가 다음
 *  구간에서 다시 0 에서 가속하므로, 이으라고 만든 기능이 오히려 스텝 경계를 도드라지게 한다.
 *  애니메이션 도구가 하는 대로 구간 **양끝만** 가감속한다.
 *
 *  경계 판정은 재생의 `fromStep` 이 그러듯 루프면 배열 끝을 감는다 — 루프 재생에서 마지막↔첫
 *  스텝은 실제로 이어져 흐르는 자리라, 안 감으면 전부 이어 놓은 드릴이 매 바퀴 그 지점에서만
 *  감속·가속한다. (스텝이 하나뿐이면 감지 않는다 — 자기 자신을 이웃으로 볼 수는 없다.) */
export function seamlessEase(steps: readonly DrillStep[], i: number, loop: boolean): (t: number) => number {
  const n = steps.length;
  const prev = i > 0 ? steps[i - 1] : loop && n > 1 ? steps[n - 1] : undefined;
  const next = i < n - 1 ? steps[i + 1] : loop && n > 1 ? steps[0] : undefined;
  const first = !isSeamlessStep(prev);
  const last = !isSeamlessStep(next);
  if (first && last) return easeStandard;
  if (first) return easeIn;
  if (last) return easeOut;
  return easeLinear;
}

/** 타임라인(leading transition, §3.6): 각 스텝 i 는 자신의 durationMs 구간을 소유하고,
 *  그 구간의 첫 transitionMs 동안 이전 스텝(from)→자신(to) 으로 트윈한 뒤 나머지는 고정 표시한다.
 *  `seamless` 스텝만 예외로 트윈이 구간 전체를 차지한다(2026-09-08, 아래 주석). */
export function sampleDrill(
  d: Drill,
  timeMs: number,
  o: { baseMs: number; transitionMs: number; loop: boolean },
): RenderFrame {
  const n = d.steps.length;
  if (n === 0) return { stepIndex: 0, t: 0, chairs: [], balls: [], cones: [], arrows: [], notes: [], strokes: [] };

  const starts: number[] = new Array(n);
  let acc = 0;
  for (let k = 0; k < n; k++) {
    starts[k] = acc;
    acc += effectiveStepMs(d.steps[k]!, o.baseMs);
  }
  const total = acc;

  const raw = o.loop && total > 0 ? ((timeMs % total) + total) % total : Math.min(Math.max(timeMs, 0), total);

  let i = 0;
  while (i < n - 1 && raw >= starts[i + 1]!) i++;

  const localT = raw - starts[i]!;
  const fromStep = i > 0 ? d.steps[i - 1]! : o.loop ? d.steps[n - 1]! : d.steps[0]!;
  const toStep = d.steps[i]!;
  // 딜레이 없는 연결(2026-09-08, PLAN-STEP-LINK 결정 3): 이 스텝의 트윈이 **구간 전체**를
  // 차지한다 — 트윈이 구간 끝에 가서야 끝나므로 정지 구간이 0 이고, 다음 스텝의 트윈이 그
  // 자리에서 곧바로 이어받는다(그래서 여러 스텝을 이으면 한 동작으로 흐른다).
  // 타임라인 자체(`effectiveStepMs`·구간 시작·총 길이)는 **안 바뀐다** — 바뀌는 것은 이
  // 구간 안에서 트윈을 어디까지 늘리느냐뿐이다(결정 5).
  const isSeamless = toStep.cut !== true && toStep.seamless === true;
  const spanMs = isSeamless ? effectiveStepMs(toStep, o.baseMs) : o.transitionMs;
  const t = spanMs > 0 ? Math.min(Math.max(localT / spanMs, 0), 1) : 1;
  // 사슬 끊긴 경계(§3.5 DrillStep.cut, 2026-08-17 기현 지시): 이 구간으로 "향하는" 스텝
  // (toStep = d.steps[i], 교리대로 다음 스텝이 진다)에 `cut` 이 있으면 **보간하지 않는다**.
  //
  // 이 스텝 i 의 구간(starts[i]..starts[i]+durationMs)에 들어와 있다는 것은 이미 그 앞
  // 경계(starts[i], i-1→i 전환)를 넘었다는 뜻이다 — "다음 스텝이 진다" 교리에 따라 그 경계의
  // cut 여부는 바로 이 toStep(d.steps[i])의 cut 필드로 판정하므로, isCut 이면 이 구간 전체가
  // 이미 컷 경계를 지난 뒤다. 그러므로 t(=0..1, transitionMs 내 로컬 진행률)와 무관하게 항상
  // e=1(=toStep 그대로) 이어야 한다 — "그 경계만 즉시 컷"이지 "경계+transitionMs 뒤에 컷"이
  // 아니다. t<1 동안 e=0 을 유지하는 예전 구현은 컷을 transitionMs 만큼 지연시켜 그 시간
  // 동안 fromStep(이전 스텝) 이 화면에 남는 잘못된 보간을 만들었다(2026-08-17 결함 수정).
  //
  // 반대로 이 스텝 i 에서 다음 스텝(i+1, cut 이 있을 수도 없을 수도 있음)으로 "넘어가는" 순간은
  // raw 가 starts[i+1] 을 넘을 때 i 가 증가하면서 자동으로 처리된다 — 그 경계의 cut 여부는
  // 그때 toStep 이 되는 d.steps[i+1] 의 cut 필드로 판정되고, 위와 같은 논리로 그 구간에서도
  // 즉시 e=1 이 된다. 즉 "총 재생 시간·체류 시간 보존"은 durationMs 구간 자체가 그대로
  // 유지되는 데서 나오는 것이지, e 를 지연시키는 데서 나오는 게 아니다 — 이 스텝의 프레임은
  // 이 구간 전체(t=0..1) 동안 이미 자기 자신(toStep)으로 고정 표시된다.
  // presence(enter/exit) 페이드도 같은 e 를 쓰므로 컷 구간에서는 자동으로 함께 계단이 된다
  // (opacity 도 항상 1 = "개체는 팝 한다").
  const isCut = toStep.cut === true;
  const eased = isCut ? 1 : isSeamless ? seamlessEase(d.steps, i, o.loop)(t) : easeStandard(t);
  const frame = interpolateSteps(d, fromStep, toStep, eased);
  return { ...frame, stepIndex: i, t };
}
