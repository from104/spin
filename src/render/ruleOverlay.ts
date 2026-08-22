// §4.4 P2-4 / §6.1 규칙 1 — 규칙 오버레이의 **어댑터**. 판정 결과를 DOM 속성과 라이브 리전으로
// 옮기는 일만 한다(판정 자체는 model/rules.ts, 그리는 것은 RuleOverlay.tsx).
//
// 왜 React state 가 아닌가: 링은 **공을 따라다니고** 색은 **매 프레임 바뀔 수 있다**. state 로
// 만들면 60fps 로 상위 트리가 리렌더된다(§6.1 규칙 1). 위치는 TransformWriter 팔로워가,
// 색·표시 여부는 이 writer 가 각각 DOM 에 직접 쓴다 — 둘 다 React 를 지나지 않는다.
//
// 두 writer 로 나눈 이유: TransformWriter 는 id 하나의 **자세**만 안다. 2-on-1 판정은 그
// 프레임의 **모든 선수**를 봐야 하므로 프레임 전체를 받는 소비자가 따로 있어야 한다.
// 그래서 편집기는 usePhysicsRenderLoop(= world.read() 한 번), 시연은 applyFrame(= sampleDrill
// 한 번)에서 같은 프레임을 이쪽으로도 흘려보낸다 — 두 번 읽지 않는다(자세와 판정이 한 프레임
// 어긋나면 "링은 붉은데 아무도 안 들어와 있다" 가 된다).
import {
  ballRingViolation,
  GOAL_AREA_MAX,
  isBallOutOfPlay,
  RING_SAME_TEAM_MAX,
  ruleForRing,
  teamsOfBits,
  zoneViolation,
  type DefendedMouth,
  type DefendedZone,
  type RuleActor,
} from '../model/rules.ts';
import type { CourtMode, Rect } from '../model/court.ts';
import type { BallRing, TeamSide } from '../model/drill.ts';
import { BALL_FILL } from '../core/colors.ts';
import { BALL } from '../core/constants.ts';
import { liveRegion } from '../ui/LiveRegion.tsx';
import { translate } from '../i18n/useT.ts';
import type { Locale } from '../i18n/locale.ts';

/** 깨끗할 때의 선 색. 코트(#1f7a46) 위 5.34:1 — 코트 라인과 같은 값이다. */
export const RULE_OK_STROKE = '#ffffff';
/** 위반 색. 붉은색 자체는 코트 위 1.75:1 로 **혼자서는 못 읽힌다** — 그래서 밑에 검정 케이싱을
 *  깔고(RuleOverlay.tsx) 그 위에 얹는다. 색은 세 번째 채널이고, 앞의 둘은 **파선→실선**과
 *  **라이브 리전 발화**다(§7.1 색 하나에 기대지 않는다). */
export const RULE_ALERT_STROKE = '#ff5a5a';

/** 아웃오브플레이 공의 채움색. `RULE_ALERT_STROKE` 와 **같은 값**을 쓴다 — "위반·이상 상태는
 *  이 붉은색" 이라는 이 앱의 색 어휘를 하나로 유지한다(2026-08-22 기현님 지시: "그냥 공이
 *  붉어지는 효과", 별도 테두리·배지 없음). 케이싱이 없어도 되는 이유: 공은 이미 `stroke="#fff"`
 *  흰 테두리를 두르고 있어(BallDot.tsx) 그 자체가 코트(#1f7a46) 위에서 케이싱 역할을 한다. */
export const BALL_OUT_FILL = RULE_ALERT_STROKE;

/* ── 골 지역 **안쪽 채움** 두 단(2026-08-13 기현 지시 ②) ────────────────────────────────
 * *"골에리어 안쪽 흐린 효과 붉은 계열로 수정 (골에리어 반칙 표시는 진하게, 그냥은 연하게)"*
 *
 * 세 색은 **한 색상각(0°) 의 밝기 3단**이다: 연한 면(#ffb3b3) → 경고선(#ff5a5a) → 진한
 * 면(#d42020). 계열이 하나라 "같은 규칙의 두 세기" 로 읽힌다.
 *
 * ⚠️ 여기서 낮은 알파의 **선명한** 붉은색을 쓰면 안 된다. 코트(#1f7a46) 위에 얹은 합성색이
 *    코트와 거의 같아진다 — 실측 #ff5a5a α.12 → #3a7648, 코트 대비 **1.02:1**(= 안 보인다).
 *    밝은 쪽(#ffb3b3)이라야 붉은 기운을 주면서 휘도도 올라간다: α.22 → #50875e, 코트 1.26:1,
 *    붉기(R−(G+B)/2) −65 → −34.5. 옛 흰 .14(#3e8d60, 1.32:1, 붉기 −56.5)와 **밝기는 비슷하고
 *    색만 따뜻해진** 자리다.
 * 위반 면은 진한 쪽으로 간다: #d42020 α.50 을 평소 면 위에 → **#92543f**. 평소 면과
 *    휘도 대비 **1.39:1**, 붉기 −34.5 → **+73**(부호가 뒤집힌다). 색을 못 보는 눈에도 밝기
 *    채널이 남는다 — 옛 값(#ff5a5a α.2)은 같은 계산에서 **1.04:1** 로 밝기 채널이 없었다.
 * 검산은 render/ruleZoneFill.test.tsx (styles/contrastMath 의 compositeOver 로 잰다). */
/** 평소(위반 아님) 골 지역 안쪽. 면은 여전히 **장식**이다 — 기능은 흰 파선 테두리가 나른다. */
export const RULE_ZONE_FILL = '#ffb3b3';
export const RULE_ZONE_FILL_OPACITY = 0.22;
/** 3인 반칙일 때 그 위에 겹치는 진한 면. 테두리는 RULE_ALERT_STROKE 실선이 맡는다. */
export const RULE_ZONE_ALERT_FILL = '#d42020';
export const RULE_ZONE_ALERT_FILL_OPACITY = 0.5;

/** 규칙은 파선으로 말한다 — RuleZones 의 존 테두리와 같은 눈금이다. 코트 실선(하프라인·
 *  골 지역)과 구별되는 시각 언어다. 5.3 이 규정에 없는 센터 서클을 지운 뒤로는 겹쳐 보이는
 *  원 자체가 없지만, 이 구분은 원 때문이 아니라 **규칙과 코트를 가르기 위한 것**이라 남는다. */
export const RULE_DASH = '8 6';

/** 위반이 사라진 뒤 이만큼 깨끗해야 "해소" 로 친다. 문턱 위에서 떠는 개체가 발화를
 *  연타하는 것을 막는다(400ms 는 사람이 두 번의 알림으로 인식하는 최소 간격 언저리다). */
export const RULE_CLEAR_MS = 400;

export interface RuleRosterEntry {
  id: string;
  team: TeamSide;
  isGk: boolean;
}

export interface RuleOverlayContext {
  /** 규칙 표시 스위치(prefs.showRuleZones). 꺼져 있으면 판정도 발화도 하지 않는다 —
   *  존을 감춘 사람에게 규칙 경고만 남기면 "무엇이 말하는지 알 수 없는 소리" 가 된다. */
  enabled: boolean;
  /** 이 프레임에 판 위에 있을 수 있는 선수 명단. 좌표는 write() 가 프레임에서 채운다. */
  roster: readonly RuleRosterEntry[];
  /** 골 지역 + **그 존을 지키는 팀**(2026-08-15 진영). 사각형만 넘기던 옛 계약으로는 골 지역
   *  3인을 수비 팀에만 걸 수가 없었다 — `defendedZones(def.ruleZones, drill.defense)` 로 만든다. */
  goalAreas: readonly DefendedZone[];
  /** 골라인 **바깥 반평면** + 그 골대를 지키는 팀(`model/court.ts` 의 `goalMouths`). 세트피스
   *  5 m 제한의 골키퍼 면제에만 쓴다 — 골 지역(`goalAreas`)과 **다른 자리·다른 문턱**이다
   *  (저기는 걸치면 면제, 여기는 완전히 나가야 면제). */
  goalMouths: readonly DefendedMouth[];
  /** 세트피스 5 m 제한을 받는 팀 = 수비 진영(`Drill.defense`). **플랫 코트는 null** —
   *  골대도 진영도 없어 "누가 수비인가" 라는 약속 자체가 성립하지 않는다(model/rules.ts). */
  fiveMeterDefense: TeamSide | null;
  teamLabels: Record<TeamSide, string>;
  locale: Locale;
  /** 아웃오브플레이(Law 9) 판정 대상 코트 — `isBallOutOfPlay` 가 mode 로 half 의 하프라인을
   *  가려낸다(model/rules.ts). RuleOverlay.tsx 가 이미 계산해 둔 `courtDefFor(mode,size).surface`
   *  를 그대로 넘긴다 — 여기서 다시 계산하지 않는다. */
  court: { mode: CourtMode; surface: Rect };
}

export interface RuleOverlayApi {
  setContext(ctx: RuleOverlayContext): void;
  /** 공 하나의 링 그룹. `stroke`·`stroke-dasharray`·`opacity` 를 이 writer 가 쓴다.
   *
   *  `ring` 은 그 공의 원(없음/3 m/5 m)이다 — **판정 규칙이 여기서 갈린다**(`ruleForRing`).
   *  원을 바꾸면 등록도 다시 해야 한다(RuleOverlay.tsx 의 이펙트 deps 에 `ring` 이 있는 이유).
   *  생략하면 'none' = 2-on-1 로 잰다: 원이 없는 공도 판정은 그대로 탄다는 옛 계약이다. */
  registerRing(ballId: string, el: SVGGElement | null, ring?: BallRing): void;
  /** 골 지역 위반 표시 그룹(존 index 별). 깨끗하면 opacity 0 으로 숨는다. */
  registerZone(index: number, el: SVGGElement | null): void;
  /** 한 프레임. 키는 개체 id, 값은 그 프레임의 실제 좌표다.
   *
   *  ⚠️ `theta` 가 **옵셔널인 이유는 공·콘 때문**이다(방향이 없다 — `RenderBall` 에 필드 자체가
   *  없다). **명단(`roster`)에 있는 휠체어는 반드시 실어야 한다**: 2026-08-13 부터 판정이 차체
   *  사각형으로 재므로(model/chairOverlap.ts) 빠지면 그 화면만 "언제나 +x 를 보는 차체" 로
   *  조용히 틀린다. 실제로 흘려보내는 두 경로 모두 이미 싣고 있다 — 편집기는
   *  `PhysicsSnapshot`(x·y·theta), 시연은 `RenderChair`(x·y·theta) 를 **그 객체 그대로** 넘긴다.
   *  그 배선을 재는 것은 EditorStage.rules.test.tsx / PresentStage.rules.test.tsx 의
   *  '차체 방향이 판정까지 온다' 다. */
  write(poses: Readonly<Record<string, { x: number; y: number; theta?: number }>>): void;
  /** 공 하나의 **채움색**(캐스트 자체, 오버레이 그룹이 아니다). `write()` 가 매 프레임 이
   *  공의 좌표로 `isBallOutOfPlay` 를 재고, 나갔으면 `BALL_OUT_FILL` 로, 아니면 원래 색
   *  (`BALL_FILL`)으로 되돌린다 — 링·존과 달리 판정 대상(공)의 DOM 을 직접 쓴다
   *  (BallDot.tsx 의 circle ref). */
  registerBall(ballId: string, el: SVGCircleElement | null): void;
  clear(): void;
}

export interface RuleOverlayDeps {
  say(text: string): void;
  now(): number;
}

const DEFAULT_CONTEXT: RuleOverlayContext = {
  enabled: false,
  roster: [],
  goalAreas: [],
  goalMouths: [],
  fiveMeterDefense: null,
  teamLabels: { home: '홈', away: '원정' },
  // 실사용 호출부(RuleOverlay.tsx)가 항상 setContext 로 진짜 locale 을 곧바로 심는다 —
  // 이 값은 그 전(마운트 첫 틱)에만 잠깐 쓰이는 자리표시일 뿐이라 defaultPhase() 와 같은
  // 이유로 'ko' 고정이다.
  locale: 'ko',
  // mode:'flat' → isBallOutOfPlay 가 항상 false. setContext 가 오기 전(마운트 첫 틱)에
  // 실수로 공을 붉게 칠하지 않는 안전한 기본값이다.
  court: { mode: 'flat', surface: { x: 0, y: 0, w: 0, h: 0 } },
};

const VISIBLE = 1;
const VIOLATED = 2;

export function createRuleOverlay(deps: Partial<RuleOverlayDeps> = {}): RuleOverlayApi {
  const say = deps.say ?? ((t: string) => liveRegion.say(t));
  const now = deps.now ?? (() => performance.now());

  let ctx = DEFAULT_CONTEXT;
  const rings = new Map<string, SVGGElement>();
  /** 공 id → 그 공의 원. 판정 규칙이 여기서 갈린다(`ruleForRing`). 노드와 같은 생명주기라
   *  `registerRing` 이 함께 넣고 함께 지운다 — 따로 두면 지운 공의 원이 남는다. */
  const ringKind = new Map<string, BallRing>();
  const zones = new Map<number, SVGGElement>();
  const ringState = new Map<string, number>();
  const zoneState = new Map<number, number>();
  /** 아웃오브플레이 표시 대상 공(circle 자체 — 오버레이 그룹이 아니다). */
  const ballFillEls = new Map<string, SVGCircleElement>();
  const ballOutState = new Map<string, boolean>();

  // 프레임마다 새 배열을 만들지 않는다(§6.2 요건 3 과 같은 규율) — 명단 크기만큼 풀을 두고
  // 좌표만 갈아 끼운다. 판 위에 없는(= 이 프레임 좌표가 없는) 선수는 live 에서 빠진다.
  const pool: RuleActor[] = [];
  const live: RuleActor[] = [];

  /** 마지막으로 발화한 위반 조합. 같은 조합이 이어지는 동안에는 다시 말하지 않는다. */
  let spokenKey = 0;
  let cleanSinceMs: number | null = null;
  /** 마지막으로 받은 프레임. 문맥이 늦게 도착해도 그 프레임으로 곧바로 다시 판정한다 —
   *  TransformWriter 가 register 때 마지막 프레임을 즉시 기록하는 것과 같은 규율이다.
   *  ★ 이게 없으면 **마운트 첫 프레임의 판정이 통째로 새어 나간다**: 시연은 화면을 그리는
   *  레이아웃 이펙트에서 첫 프레임을 흘리는데, 링·존 등록과 setContext 는 그보다 **뒤에**
   *  오는 패시브 이펙트라 그 시점의 판정에는 아무 노드도 문맥도 없다. 일시정지로 열린
   *  시연이라면 다음 프레임이 영영 오지 않아 "1스텝의 반칙을 아무도 말해 주지 않는다".
   *
   *  ⚠️ 타입에서 `theta` 를 **빼지 마라**. setContext 경로(= 마운트 첫 프레임 · 스위치를 켠
   *  순간)는 여기 담긴 프레임으로 판정한다 — 시연의 첫 판정이 실제로 이 길로 온다. 방향이
   *  타입에서 떨어지면 `fillActors` 가 `?? 0` 으로 접어 그 판정만 +x 로 굳는다. */
  let lastPoses: Readonly<Record<string, { x: number; y: number; theta?: number }>> | null = null;

  function fillActors(poses: Readonly<Record<string, { x: number; y: number; theta?: number }>>): void {
    live.length = 0;
    for (let i = 0; i < ctx.roster.length; i++) {
      const def = ctx.roster[i]!;
      const p = poses[def.id];
      if (!p) continue;
      let a = pool[i];
      if (!a) {
        a = { id: def.id, team: def.team, isGk: def.isGk, x: 0, y: 0, theta: 0 };
        pool[i] = a;
      }
      a.id = def.id;
      a.team = def.team;
      a.isGk = def.isGk;
      a.x = p.x;
      a.y = p.y;
      // 방향이 없는 프레임(옛 테스트 픽스처 등)은 0 = +x 로 읽는다. 실제 두 경로는 언제나
      // 싣는다(위 write() 주석) — 여기가 `?? 0` 이라는 사실이 판정을 조용히 틀리게 하는
      // 유일한 통로이므로, 두 화면 테스트가 회전한 차체로 그 통로를 직접 찌른다.
      a.theta = p.theta ?? 0;
      live.push(a);
    }
  }

  function applyState(el: SVGGElement, state: number): void {
    el.setAttribute('opacity', state & VISIBLE ? '1' : '0');
    el.setAttribute('stroke', state & VIOLATED ? RULE_ALERT_STROKE : RULE_OK_STROKE);
    el.setAttribute('stroke-dasharray', state & VIOLATED ? 'none' : RULE_DASH);
  }

  function writeRing(id: string, el: SVGGElement, state: number): void {
    if (ringState.get(id) === state) return; // 안 바뀌면 DOM 을 건드리지 않는다
    ringState.set(id, state);
    applyState(el, state);
  }

  function writeZone(index: number, el: SVGGElement, state: number): void {
    if (zoneState.get(index) === state) return;
    zoneState.set(index, state);
    applyState(el, state);
  }

  function writeBallFill(id: string, el: SVGCircleElement, out: boolean): void {
    if (ballOutState.get(id) === out) return; // 안 바뀌면 DOM 을 건드리지 않는다(다른 writer 와 같은 규율)
    ballOutState.set(id, out);
    el.setAttribute('fill', out ? BALL_OUT_FILL : BALL_FILL);
  }

  function names(bits: number): string {
    return teamsOfBits(bits)
      .map((s) => ctx.teamLabels[s])
      .join('·');
  }

  function message(ringBits: number, zoneBits: number, fiveBits: number, ballOut: boolean): string {
    const parts: string[] = [];
    // 문구가 문턱 상수에서 파생된다 — 규칙 수치를 고치면 발화도 따라온다.
    if (ringBits) parts.push(translate(ctx.locale, 'ruleOverlay.ringWarning', { names: names(ringBits), n: RING_SAME_TEAM_MAX + 1 }));
    // 5 m 는 인원수 문턱이 없다 — **한 대라도** 들어가면 걸린다(수비만). 그래서 문구도 다르다.
    if (fiveBits) parts.push(translate(ctx.locale, 'ruleOverlay.fiveMeterWarning', { names: names(fiveBits) }));
    if (zoneBits) parts.push(translate(ctx.locale, 'ruleOverlay.zoneWarning', { names: names(zoneBits), n: GOAL_AREA_MAX + 1 }));
    // 아웃오브플레이는 팀 위반이 아니다(공 자체의 상태) — 이름·문턱 보간이 없다.
    if (ballOut) parts.push(translate(ctx.locale, 'ruleOverlay.ballOutWarning'));
    return parts.join(' · ');
  }

  /** [D-6] 시연 화면은 개체를 `aria-hidden` 으로 감추므로 **시각 신호만으로는 규칙 위반이
   *  시각장애 코치에게 전달되지 않는다.** 그래서 위반이 시작되는 순간 딱 한 번 말한다.
   *  - 이어지는 같은 위반은 다시 말하지 않는다(60fps 연타 금지).
   *  - 조합이 바뀌면(링만 → 링+존) 곧바로 다시 말한다.
   *  - 해소는 말하지 않는다 — 코치가 알아야 하는 것은 "지금 반칙이다" 이고, 해소까지 읽으면
   *    드래그 한 번에 두 번 말하게 된다(2.11 [D-7] 이 잠근 이중 통보와 같은 문제다). */
  function announce(ringBits: number, zoneBits: number, fiveBits: number, ballOut: boolean): void {
    // ringBits/zoneBits/fiveBits 는 TEAM_BIT 조합(0~3, 2비트)이라 <<2 씩 벌린다. ballOut 은
    // 팀 비트가 아니라 단일 불리언이라 그 위(<<6)에 한 비트만 얹는다.
    const key = ringBits | (zoneBits << 2) | (fiveBits << 4) | (ballOut ? 1 << 6 : 0);
    if (key === 0) {
      if (spokenKey === 0) return;
      const t = now();
      if (cleanSinceMs === null) cleanSinceMs = t;
      else if (t - cleanSinceMs >= RULE_CLEAR_MS) {
        spokenKey = 0;
        cleanSinceMs = null;
      }
      return;
    }
    cleanSinceMs = null;
    if (key === spokenKey) return;
    spokenKey = key;
    say(message(ringBits, zoneBits, fiveBits, ballOut));
  }

  function resetAnnounce(): void {
    spokenKey = 0;
    cleanSinceMs = null;
  }

  function judge(poses: Readonly<Record<string, { x: number; y: number }>>): void {
    fillActors(poses);
    let ringBits = 0;
    let fiveBits = 0;
    for (const [id, el] of rings) {
      const p = poses[id];
      const ring = ringKind.get(id) ?? 'none';
      const bits = p ? ballRingViolation(ring, p, live, ctx.goalAreas, ctx.goalMouths, ctx.fiveMeterDefense) : 0;
      // 이 프레임에 좌표가 없는 공은 판에 없는 공이다(시연의 퇴장 페이드·다른 스텝) — 숨긴다.
      writeRing(id, el, (p ? VISIBLE : 0) | (bits ? VIOLATED : 0));
      // 링 그림은 어느 규칙이든 같지만 **발화 문구는 다르다** — 그래서 여기서 갈라 담는다.
      if (ruleForRing(ring) === 'fiveMeter') fiveBits |= bits;
      else ringBits |= bits;
    }
    let zoneBits = 0;
    for (const [index, el] of zones) {
      const zone = ctx.goalAreas[index];
      const bits = zone ? zoneViolation(zone, live) : 0;
      // 존 표시는 위반일 때만 나타난다 — 깨끗한 존은 RuleZones 의 흰 파선 그대로다.
      writeZone(index, el, bits ? VISIBLE | VIOLATED : 0);
      zoneBits |= bits;
    }
    // 아웃오브플레이(Law 9) — 선수 위반과 달리 판정 대상이 공 자체다. 등록된 공마다 이번
    // 프레임 좌표로 재고, 하나라도 나가 있으면 발화 조합에 얹는다(2-on-1·5m 처럼 팀별로
    // 갈릴 이유가 없다 — "공이 나갔다"는 사실 하나뿐).
    let ballOut = false;
    for (const [id, el] of ballFillEls) {
      const p = poses[id];
      const out = p ? isBallOutOfPlay(ctx.court.mode, ctx.court.surface, p, BALL.viewRadiusPx) : false;
      writeBallFill(id, el, out);
      ballOut = ballOut || out;
    }
    announce(ringBits, zoneBits, fiveBits, ballOut);
  }

  return {
    setContext(next) {
      ctx = next;
      if (!next.enabled) {
        resetAnnounce();
        // §7 5.2(2026-08-13) — 스위치를 끄면 판정이 멎는다. 그러면 **직전 위반 표시가 그대로
        // 얼어붙는다**: 붉은 실선 링이 아무도 갱신하지 않는 채 남는다. 예전에는 RuleOverlay 가
        // `visible=false` 에서 통째로 언마운트돼 눈에 안 띄었지만, 이제 개별 공의 원은 스위치를
        // 꺼도 화면에 남으므로(그 파일 주석) **판정이 서지 않는 원이 "지금도 반칙" 이라고
        // 거짓말한다.** 깨끗한 상태(보임 + 흰 파선)로 되돌려 놓는다 — 존 표시는 위반일 때만
        // 나타나는 것이라 반대로 숨긴다. 이 두 줄을 지우면 render/ruleOverlay.test.ts 의
        // '스위치를 끄면 얼어붙은 위반 표시가 풀린다' 가 빨개진다.
        for (const [id, el] of rings) writeRing(id, el, VISIBLE);
        for (const [index, el] of zones) writeZone(index, el, 0);
        for (const [id, el] of ballFillEls) writeBallFill(id, el, false);
        return;
      }
      // 문맥이 늦게 왔거나(마운트) 스위치를 지금 켰다 — 마지막 프레임으로 곧바로 판정한다.
      if (lastPoses) judge(lastPoses);
    },
    registerRing(ballId, el, ring = 'none') {
      if (!el) {
        rings.delete(ballId);
        ringState.delete(ballId);
        ringKind.delete(ballId);
        return;
      }
      rings.set(ballId, el);
      ringKind.set(ballId, ring);
      // 새 노드는 마지막 상태를 곧바로 받는다(다른 writer 들과 같은 규율) — 안 하면
      // 재마운트 직후 한 프레임 동안 기본 모양으로 깜빡인다.
      //
      // 처음 등록의 기본값이 **보임**인 이유: 링이 그려졌다는 것은 이미 "이 스텝에 있는 공"
      // 이라는 뜻이다(RuleOverlay 가 그 공만 그린다). 기본을 숨김으로 두면 **일시정지한 시연**
      // 처럼 다음 write 가 영영 안 오는 경로에서 링이 통째로 사라진다.
      const s = ringState.get(ballId) ?? VISIBLE;
      ringState.set(ballId, s);
      applyState(el, s);
    },
    registerZone(index, el) {
      if (!el) {
        zones.delete(index);
        zoneState.delete(index);
        return;
      }
      zones.set(index, el);
      // 존 표시는 반대로 기본이 **숨김**이다 — 위반 전에는 보일 것이 없다.
      const s = zoneState.get(index) ?? 0;
      zoneState.set(index, s);
      applyState(el, s);
    },
    registerBall(ballId, el) {
      if (!el) {
        ballFillEls.delete(ballId);
        ballOutState.delete(ballId);
        return;
      }
      ballFillEls.set(ballId, el);
      // 기본은 **안-아웃**이다(대부분의 스텝에서 공은 코트 안에 있다) — 재마운트 직후
      // 한 프레임 동안 실제와 다른 색으로 깜빡이지 않도록 마지막 상태를 곧바로 적용한다.
      const s = ballOutState.get(ballId) ?? false;
      ballOutState.set(ballId, s);
      el.setAttribute('fill', s ? BALL_OUT_FILL : BALL_FILL);
    },
    write(poses) {
      // 꺼져 있어도 프레임은 기억한다 — 스위치를 켜는 순간 다음 프레임을 기다리지 않고
      // 곧바로 판정이 서야 한다(일시정지한 시연에서는 다음 프레임이 오지 않는다).
      lastPoses = poses;
      if (!ctx.enabled) {
        resetAnnounce();
        return;
      }
      judge(poses);
    },
    clear() {
      rings.clear();
      zones.clear();
      ringState.clear();
      zoneState.clear();
      ballFillEls.clear();
      ballOutState.clear();
      pool.length = 0;
      live.length = 0;
      lastPoses = null;
      ctx = DEFAULT_CONTEXT;
      resetAnnounce();
    },
  };
}
