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
import { GOAL_AREA_MAX, RING_SAME_TEAM_MAX, ringViolation, teamsOfBits, zoneViolation, type RuleActor } from '../model/rules.ts';
import type { Rect } from '../model/court.ts';
import type { TeamSide } from '../model/drill.ts';
import { liveRegion } from '../ui/LiveRegion.tsx';

/** 깨끗할 때의 선 색. 코트(#1f7a46) 위 5.34:1 — 코트 라인과 같은 값이다. */
export const RULE_OK_STROKE = '#ffffff';
/** 위반 색. 붉은색 자체는 코트 위 1.75:1 로 **혼자서는 못 읽힌다** — 그래서 밑에 검정 케이싱을
 *  깔고(RuleOverlay.tsx) 그 위에 얹는다. 색은 세 번째 채널이고, 앞의 둘은 **파선→실선**과
 *  **라이브 리전 발화**다(§7.1 색 하나에 기대지 않는다). */
export const RULE_ALERT_STROKE = '#ff5a5a';
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
  goalAreas: readonly Rect[];
  teamLabels: Record<TeamSide, string>;
}

export interface RuleOverlayApi {
  setContext(ctx: RuleOverlayContext): void;
  /** 공 하나의 링 그룹. `stroke`·`stroke-dasharray`·`opacity` 를 이 writer 가 쓴다. */
  registerRing(ballId: string, el: SVGGElement | null): void;
  /** 골 지역 위반 표시 그룹(존 index 별). 깨끗하면 opacity 0 으로 숨는다. */
  registerZone(index: number, el: SVGGElement | null): void;
  /** 한 프레임. 키는 개체 id, 값은 그 프레임의 실제 좌표다. */
  write(poses: Readonly<Record<string, { x: number; y: number }>>): void;
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
  teamLabels: { home: '홈', away: '원정' },
};

const VISIBLE = 1;
const VIOLATED = 2;

export function createRuleOverlay(deps: Partial<RuleOverlayDeps> = {}): RuleOverlayApi {
  const say = deps.say ?? ((t: string) => liveRegion.say(t));
  const now = deps.now ?? (() => performance.now());

  let ctx = DEFAULT_CONTEXT;
  const rings = new Map<string, SVGGElement>();
  const zones = new Map<number, SVGGElement>();
  const ringState = new Map<string, number>();
  const zoneState = new Map<number, number>();

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
   *  시연이라면 다음 프레임이 영영 오지 않아 "1스텝의 반칙을 아무도 말해 주지 않는다". */
  let lastPoses: Readonly<Record<string, { x: number; y: number }>> | null = null;

  function fillActors(poses: Readonly<Record<string, { x: number; y: number }>>): void {
    live.length = 0;
    for (let i = 0; i < ctx.roster.length; i++) {
      const def = ctx.roster[i]!;
      const p = poses[def.id];
      if (!p) continue;
      let a = pool[i];
      if (!a) {
        a = { id: def.id, team: def.team, isGk: def.isGk, x: 0, y: 0 };
        pool[i] = a;
      }
      a.id = def.id;
      a.team = def.team;
      a.isGk = def.isGk;
      a.x = p.x;
      a.y = p.y;
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

  function names(bits: number): string {
    return teamsOfBits(bits)
      .map((s) => ctx.teamLabels[s])
      .join('·');
  }

  function message(ringBits: number, zoneBits: number): string {
    const parts: string[] = [];
    // 문구가 문턱 상수에서 파생된다 — 규칙 수치를 고치면 발화도 따라온다.
    if (ringBits) parts.push(`공 3 m 안에 ${names(ringBits)} ${RING_SAME_TEAM_MAX + 1}명 이상 — 2-on-1 주의`);
    if (zoneBits) parts.push(`골 지역에 ${names(zoneBits)} ${GOAL_AREA_MAX + 1}명 이상 — 3인 반칙`);
    return parts.join(' · ');
  }

  /** [D-6] 시연 화면은 개체를 `aria-hidden` 으로 감추므로 **시각 신호만으로는 규칙 위반이
   *  시각장애 코치에게 전달되지 않는다.** 그래서 위반이 시작되는 순간 딱 한 번 말한다.
   *  - 이어지는 같은 위반은 다시 말하지 않는다(60fps 연타 금지).
   *  - 조합이 바뀌면(링만 → 링+존) 곧바로 다시 말한다.
   *  - 해소는 말하지 않는다 — 코치가 알아야 하는 것은 "지금 반칙이다" 이고, 해소까지 읽으면
   *    드래그 한 번에 두 번 말하게 된다(2.11 [D-7] 이 잠근 이중 통보와 같은 문제다). */
  function announce(ringBits: number, zoneBits: number): void {
    const key = ringBits | (zoneBits << 2);
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
    say(message(ringBits, zoneBits));
  }

  function resetAnnounce(): void {
    spokenKey = 0;
    cleanSinceMs = null;
  }

  function judge(poses: Readonly<Record<string, { x: number; y: number }>>): void {
    fillActors(poses);
    let ringBits = 0;
    for (const [id, el] of rings) {
      const p = poses[id];
      const bits = p ? ringViolation(p, live, ctx.goalAreas) : 0;
      // 이 프레임에 좌표가 없는 공은 판에 없는 공이다(시연의 퇴장 페이드·다른 스텝) — 숨긴다.
      writeRing(id, el, (p ? VISIBLE : 0) | (bits ? VIOLATED : 0));
      ringBits |= bits;
    }
    let zoneBits = 0;
    for (const [index, el] of zones) {
      const zone = ctx.goalAreas[index];
      const bits = zone ? zoneViolation(zone, live) : 0;
      // 존 표시는 위반일 때만 나타난다 — 깨끗한 존은 RuleZones 의 흰 파선 그대로다.
      writeZone(index, el, bits ? VISIBLE | VIOLATED : 0);
      zoneBits |= bits;
    }
    announce(ringBits, zoneBits);
  }

  return {
    setContext(next) {
      ctx = next;
      if (!next.enabled) {
        resetAnnounce();
        return;
      }
      // 문맥이 늦게 왔거나(마운트) 스위치를 지금 켰다 — 마지막 프레임으로 곧바로 판정한다.
      if (lastPoses) judge(lastPoses);
    },
    registerRing(ballId, el) {
      if (!el) {
        rings.delete(ballId);
        ringState.delete(ballId);
        return;
      }
      rings.set(ballId, el);
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
      pool.length = 0;
      live.length = 0;
      lastPoses = null;
      ctx = DEFAULT_CONTEXT;
      resetAnnounce();
    },
  };
}
