// §4.4 P2-4 — 어댑터 계약. "언제 색이 바뀌고 언제 말하는가" 가 여기 전부 들어 있다.
// (무엇이 반칙인가는 model/rules.test.ts, 그림은 RuleOverlay.test.tsx.)
/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { RULE_ALERT_STROKE, RULE_CLEAR_MS, RULE_DASH, RULE_OK_STROKE, createRuleOverlay, type RuleOverlayContext } from './ruleOverlay.ts';
import { defendedMouths, defendedZones } from '../model/rules.ts';
import { COURT_DEFS } from '../model/court.ts';
import type { BallRing, TeamSide } from '../model/drill.ts';
import { goalMouths } from '../model/court.ts';
import { RING_5M_R_PX } from '../model/rules.ts';

const SVG_NS = 'http://www.w3.org/2000/svg';
const g = (): SVGGElement => document.createElementNS(SVG_NS, 'g');

// ⚠️ 2026-08-15 — 컨텍스트가 사각형이 아니라 **진영을 입힌 존**을 받는다. 홈이 왼쪽 골을
// 지키는 기본 진영이고, 아래 케이스들이 전부 home 3명을 존에 넣으므로 그때의 뜻과 같다.
const GZ = defendedZones(COURT_DEFS.full.ruleZones, 'home');
const BALL_ID = 'bl_1';

function chair(id: string, team: TeamSide, isGk = false) {
  return { id, team, isGk };
}

const ROSTER = [chair('ch_a', 'home'), chair('ch_b', 'home'), chair('ch_c', 'away'), chair('ch_d', 'away')];

function ctx(over: Partial<RuleOverlayContext> = {}): RuleOverlayContext {
  return {
    enabled: true,
    roster: ROSTER,
    goalAreas: GZ,
    // 세트피스 5 m 는 이 파일의 기존 단언들과 **다른 규칙**이라 기본은 꺼 둔다(플랫 코트와
    // 같은 상태). 켜는 것은 아래 전용 describe 뿐이다 — 안 그러면 3 m 를 재던 옛 단언들이
    // 원을 바꾼 적도 없는데 규칙이 갈려 흔들린다.
    goalMouths: [],
    fiveMeterDefense: null,
    teamLabels: { home: '레드', away: '블루' },
    locale: 'ko',
    ...over,
  };
}

/** 공 하나 + 홈 2명·원정 1명이 그 3 m 안에 = 2-on-1 성립. */
const VIOLATING = {
  [BALL_ID]: { x: 400, y: 260 },
  ch_a: { x: 410, y: 260 },
  ch_b: { x: 390, y: 260 },
  ch_c: { x: 420, y: 260 },
};
/** 같은 배치인데 홈 한 명이 링 밖(200px)으로 나갔다 = 깨끗하다. */
const CLEAN = {
  [BALL_ID]: { x: 400, y: 260 },
  ch_a: { x: 410, y: 260 },
  ch_b: { x: 600, y: 260 },
  ch_c: { x: 420, y: 260 },
};

function harness(over: Partial<RuleOverlayContext> = {}, ballRing: BallRing = 'none') {
  const say = vi.fn();
  let t = 0;
  const api = createRuleOverlay({ say, now: () => t });
  const ring = g();
  const zone0 = g();
  api.setContext(ctx(over));
  api.registerRing(BALL_ID, ring, ballRing);
  api.registerZone(0, zone0);
  return { api, ring, zone0, say, tick: (ms: number) => (t += ms), at: (ms: number) => (t = ms) };
}

describe('ruleOverlay — 링의 상태', () => {
  it('깨끗하면 흰 파선이고 보인다', () => {
    const h = harness();
    h.api.write(CLEAN);
    expect(h.ring.getAttribute('opacity')).toBe('1');
    expect(h.ring.getAttribute('stroke')).toBe(RULE_OK_STROKE);
    expect(h.ring.getAttribute('stroke-dasharray')).toBe(RULE_DASH);
  });

  it('위반이면 실선 + 경고색으로 바뀐다 — 색 말고 **파선/실선**도 함께 바뀐다', () => {
    const h = harness();
    h.api.write(VIOLATING);
    expect(h.ring.getAttribute('stroke')).toBe(RULE_ALERT_STROKE);
    expect(h.ring.getAttribute('stroke-dasharray')).toBe('none');
    expect(h.ring.getAttribute('opacity')).toBe('1');
  });

  it('이 프레임에 좌표가 없는 공의 링은 숨는다', () => {
    const h = harness();
    h.api.write({ ch_a: { x: 0, y: 0 } });
    expect(h.ring.getAttribute('opacity')).toBe('0');
    // 대조군: 좌표가 돌아오면 다시 보인다.
    h.api.write(CLEAN);
    expect(h.ring.getAttribute('opacity')).toBe('1');
  });

  it('처음 등록된 링은 곧바로 보인다 — write 가 한 번도 안 와도(일시정지한 시연)', () => {
    const say = vi.fn();
    const api = createRuleOverlay({ say, now: () => 0 });
    const ring = g();
    api.setContext(ctx());
    api.registerRing(BALL_ID, ring);
    expect(ring.getAttribute('opacity')).toBe('1');
    expect(ring.getAttribute('stroke')).toBe(RULE_OK_STROKE);
  });

  it('상태가 그대로면 DOM 을 건드리지 않는다', () => {
    const h = harness();
    h.api.write(CLEAN);
    const spy = vi.spyOn(h.ring, 'setAttribute');
    h.api.write(CLEAN);
    h.api.write(CLEAN);
    expect(spy).toHaveBeenCalledTimes(0);
    // 대조군: 실제로 바뀌는 프레임에서는 쓴다(그래야 '0회'가 스파이 미장착이 아님이 증명된다).
    h.api.write(VIOLATING);
    expect(spy.mock.calls.length).toBeGreaterThan(0);
  });

  it('해지하면 그 노드는 더 이상 갱신되지 않는다', () => {
    const h = harness();
    h.api.write(CLEAN);
    h.api.registerRing(BALL_ID, null);
    h.api.write(VIOLATING);
    expect(h.ring.getAttribute('stroke')).toBe(RULE_OK_STROKE);
  });
});

describe('ruleOverlay — 골 지역 표시', () => {
  const inZone = (i: number) => ({ x: GZ[0]!.rect.x + 10 + i * 10, y: GZ[0]!.rect.y + 10 });
  const three = {
    ch_a: inZone(0),
    ch_b: inZone(1),
    ch_e: inZone(2),
  };

  it('깨끗하면 숨어 있다', () => {
    const h = harness();
    h.api.write(CLEAN);
    expect(h.zone0.getAttribute('opacity')).toBe('0');
  });

  it('같은 팀 3명이면 나타나고 경고색이 된다', () => {
    const h = harness({ roster: [...ROSTER, chair('ch_e', 'home')] });
    h.api.write(three);
    expect(h.zone0.getAttribute('opacity')).toBe('1');
    expect(h.zone0.getAttribute('stroke')).toBe(RULE_ALERT_STROKE);
    // 대조군: 한 명을 빼면 곧바로 숨는다.
    h.api.write({ ch_a: three.ch_a, ch_b: three.ch_b });
    expect(h.zone0.getAttribute('opacity')).toBe('0');
  });

  it('존이 없는 코트(flat)에서는 아무 일도 하지 않는다', () => {
    const h = harness({ goalAreas: defendedZones(COURT_DEFS.flat.ruleZones, 'home'), roster: [...ROSTER, chair('ch_e', 'home')] });
    h.api.write(three);
    expect(h.zone0.getAttribute('opacity')).toBe('0');
  });
});

describe('ruleOverlay — 라이브 리전 발화 [D-6]', () => {
  it('위반이 시작되면 딱 한 번 말한다 — 이어지는 60프레임은 조용하다', () => {
    const h = harness();
    h.api.write(VIOLATING);
    expect(h.say).toHaveBeenCalledTimes(1);
    for (let i = 0; i < 60; i++) {
      h.tick(16);
      h.api.write(VIOLATING);
    }
    expect(h.say).toHaveBeenCalledTimes(1);
  });

  it('문구에 팀 이름과 인원 문턱이 들어간다', () => {
    const h = harness();
    h.api.write(VIOLATING);
    const said = h.say.mock.calls[0]![0] as string;
    expect(said).toContain('레드');
    expect(said).toContain('2명 이상');
    expect(said).toContain('2-on-1');
    expect(said).not.toContain('블루'); // 걸린 팀만 말한다
  });

  it('골 지역 3인은 다른 문구로 말한다', () => {
    // ⚠️ 진영을 **원정**으로 뒤집어 넘긴다(2026-08-15). 골 지역 3인은 그 존을 지키는 팀만
    //    세므로, 홈이 지키는 존에 원정 3명을 넣으면 이제 아무 일도 안 일어난다(그것이 규칙이다).
    const h = harness({
      goalAreas: defendedZones(COURT_DEFS.full.ruleZones, 'away'),
      roster: [chair('ch_a', 'away'), chair('ch_b', 'away'), chair('ch_e', 'away')],
    });
    h.api.write({ ch_a: { x: GZ[0]!.rect.x + 10, y: GZ[0]!.rect.y + 10 }, ch_b: { x: GZ[0]!.rect.x + 20, y: GZ[0]!.rect.y + 10 }, ch_e: { x: GZ[0]!.rect.x + 30, y: GZ[0]!.rect.y + 10 } });
    const said = h.say.mock.calls[0]![0] as string;
    expect(said).toContain('골 지역');
    expect(said).toContain('3명 이상');
    expect(said).toContain('블루');
  });

  it('해소는 말하지 않는다 — 코치가 알아야 하는 것은 "지금 반칙" 뿐이다', () => {
    const h = harness();
    h.api.write(VIOLATING);
    expect(h.say).toHaveBeenCalledTimes(1);
    h.tick(1000);
    h.api.write(CLEAN);
    h.api.write(CLEAN);
    expect(h.say).toHaveBeenCalledTimes(1);
  });

  it('문턱 위에서 떠는 개체가 발화를 연타하지 않는다 — 짧게 풀렸다 다시 걸리면 조용하다', () => {
    const h = harness();
    h.api.write(VIOLATING);
    expect(h.say).toHaveBeenCalledTimes(1);
    h.tick(RULE_CLEAR_MS - 100);
    h.api.write(CLEAN);
    h.tick(16);
    h.api.write(VIOLATING);
    expect(h.say).toHaveBeenCalledTimes(1);
  });

  it('충분히 깨끗했다가 다시 걸리면 새 사건으로 말한다', () => {
    const h = harness();
    h.api.write(VIOLATING);
    h.api.write(CLEAN); // cleanSince 시작
    h.tick(RULE_CLEAR_MS + 1);
    h.api.write(CLEAN); // 여기서 해소 확정
    h.api.write(VIOLATING);
    expect(h.say).toHaveBeenCalledTimes(2);
  });

  it('위반 조합이 바뀌면 곧바로 다시 말한다 (링 → 링 + 골 지역)', () => {
    const h = harness({ roster: [...ROSTER, chair('ch_e', 'home'), chair('ch_f', 'home')] });
    h.api.write(VIOLATING);
    expect(h.say).toHaveBeenCalledTimes(1);
    h.api.write({
      ...VIOLATING,
      ch_e: { x: GZ[0]!.rect.x + 10, y: GZ[0]!.rect.y + 10 },
      ch_f: { x: GZ[0]!.rect.x + 20, y: GZ[0]!.rect.y + 10 },
      ch_b: { x: GZ[0]!.rect.x + 30, y: GZ[0]!.rect.y + 10 },
    });
    // ch_b 가 존으로 옮겨가 링은 풀렸지만 존이 걸렸다 — 조합이 달라졌으니 새 발화다.
    expect(h.say).toHaveBeenCalledTimes(2);
    expect(h.say.mock.calls[1]![0]).toContain('골 지역');
  });
});

describe('ruleOverlay — 스위치', () => {
  it('꺼져 있으면 판정도 발화도 하지 않는다', () => {
    const h = harness({ enabled: false });
    const spy = vi.spyOn(h.ring, 'setAttribute');
    h.api.write(VIOLATING);
    expect(h.say).toHaveBeenCalledTimes(0);
    expect(spy).toHaveBeenCalledTimes(0);
    expect(h.ring.getAttribute('stroke')).toBe(RULE_OK_STROKE);
  });

  it('켜면 곧바로 판정과 발화가 산다 — 위 "0회" 의 대조군', () => {
    const h = harness({ enabled: false });
    h.api.write(VIOLATING);
    h.api.setContext(ctx({ enabled: true }));
    h.api.write(VIOLATING);
    expect(h.say).toHaveBeenCalledTimes(1);
    expect(h.ring.getAttribute('stroke')).toBe(RULE_ALERT_STROKE);
  });

  it('껐다 켜면 같은 위반을 다시 말한다 — 꺼진 동안의 기억을 들고 있지 않는다', () => {
    const h = harness();
    h.api.write(VIOLATING);
    expect(h.say).toHaveBeenCalledTimes(1);
    h.api.setContext(ctx({ enabled: false }));
    h.api.write(VIOLATING);
    h.api.setContext(ctx({ enabled: true }));
    h.api.write(VIOLATING);
    expect(h.say).toHaveBeenCalledTimes(2);
  });

  it('등록·문맥이 프레임보다 늦게 와도 그 프레임으로 곧바로 판정한다 (마운트 순서)', () => {
    // 시연은 **레이아웃 이펙트**에서 첫 프레임을 흘리고, 링 등록·setContext 는 그보다 뒤에
    // 오는 패시브 이펙트다. 이 보정이 없으면 일시정지로 열린 시연에서 1스텝의 반칙이
    // 영영 발표되지 않는다(다음 프레임이 오지 않으므로).
    const say = vi.fn();
    const api = createRuleOverlay({ say, now: () => 0 });
    const ring = g();
    api.write(VIOLATING);
    expect(say).toHaveBeenCalledTimes(0); // 아직 아무 문맥도 없다
    api.registerRing(BALL_ID, ring);
    api.setContext(ctx());
    expect(ring.getAttribute('stroke')).toBe(RULE_ALERT_STROKE);
    expect(say).toHaveBeenCalledTimes(1);
  });

  it('스위치를 끄면 얼어붙은 위반 표시가 풀린다 — 판정이 안 도는데 붉게 남아 있으면 거짓말이다', () => {
    // 5.2 이전에는 스위치를 끄면 RuleOverlay 가 통째로 언마운트돼 눈에 안 띄었다. 이제 개별
    // 공의 원은 스위치를 꺼도 화면에 남으므로, 마지막 판정 결과가 그대로 굳으면 **"지금도
    // 반칙" 이라고 말하는 원**이 판에 남는다.
    const h = harness();
    h.api.write(VIOLATING);
    expect(h.ring.getAttribute('stroke')).toBe(RULE_ALERT_STROKE);
    h.api.setContext(ctx({ enabled: false }));
    expect(h.ring.getAttribute('stroke')).toBe(RULE_OK_STROKE);
    expect(h.ring.getAttribute('stroke-dasharray')).toBe(RULE_DASH);
    expect(h.ring.getAttribute('opacity')).toBe('1'); // 원 자체는 남는다(숨기는 것이 아니다)
    expect(h.zone0.getAttribute('opacity')).toBe('0'); // 존 표시는 반대로 숨는다
  });

  it('clear() 는 등록·상태·문맥을 모두 버린다', () => {
    const h = harness();
    h.api.write(VIOLATING);
    h.api.clear();
    h.api.write(VIOLATING);
    expect(h.say).toHaveBeenCalledTimes(1); // clear 뒤에는 enabled=false 라 말하지 않는다
  });
});

describe('ruleOverlay — 소리는 쓰지 않는다 (2.11 큐 어댑터 판정)', () => {
  // 왜 안 쓰는가:
  //   ① 2.11 의 세 신호는 전부 **손이 판에 닿는 순간**이다(놓임·막힘·트레이 반환) — 한 동작에
  //      한 번 울린다. 규칙 위반은 동작이 아니라 **상태**라, 문턱 위에서 드래그하면 같은
  //      드래그 안에서 여러 번 켜졌다 꺼진다(그래서 발화 쪽에는 400ms 히스테리시스가 있다).
  //   ② 시연 재생은 스텝마다 위반을 여러 번 지나간다 — 코치가 말하는 동안 계속 울린다.
  //   ③ [D-6] 이 요구한 라이브 리전 발화와 **같은 사건**을 두 채널로 통보하게 된다. 2.11 이
  //      [D-7] 로 잠근 이중 통보가 바로 그것이다.
  // 실기(0.5)에서 "눈을 떼고도 알고 싶다" 가 확인되면 그때 얹을 자리는 여기 announce() 하나다.
  it('규칙 오버레이 두 파일 중 어느 것도 큐 어댑터를 부르지 않는다', () => {
    const sources = ['src/render/ruleOverlay.ts', 'src/render/RuleOverlay.tsx'].map((p) => readFileSync(p, 'utf-8'));
    // 대조군 — 같은 grep 이 실제 소비처는 찾아낸다(찾지 못하면 위 단언이 공허하다).
    const consumer = readFileSync('src/features/editor/useEditorPointer.ts', 'utf-8');
    expect(consumer).toContain("from '../../ui/cues.ts'");
    for (const src of sources) expect(src).not.toContain('cues');
  });
});

// ── 세트피스 5 m 제한 (기현 지시 2026-08-17) ─────────────────────────────────────────────
// 판정 자체는 model/rules.test.ts 가 본다. 여기서 재는 것은 **어댑터**다: 공의 원이 규칙을
// 고르는가, 링 색이 따라오는가, 발화가 2-on-1 과 **다른 문구**인가.
describe('5 m 원인 공', () => {
  const MOUTHS = defendedMouths(goalMouths(COURT_DEFS.full), 'home');
  const FIVE: Partial<RuleOverlayContext> = { goalMouths: MOUTHS, fiveMeterDefense: 'home' };
  /** 공 바로 옆의 수비(home) 한 대. 2-on-1 이라면 **혼자라서 안 걸리는** 배치다. */
  const ONE_DEFENDER = { ch_a: { x: 400 + RING_5M_R_PX - 10, y: 260 } };
  const BALL_AT = { [BALL_ID]: { x: 400, y: 260 } };

  it('★ 수비 한 대가 5 m 안에 있으면 링이 붉은 실선이 된다', () => {
    const h = harness(FIVE, '5m');
    h.api.write({ ...BALL_AT, ...ONE_DEFENDER });
    expect(h.ring.getAttribute('stroke')).toBe(RULE_ALERT_STROKE);
    expect(h.ring.getAttribute('stroke-dasharray')).toBe('none');
  });

  it('★ 같은 배치라도 3 m 원이면 조용하다 — 규칙을 고르는 것은 **원**이다', () => {
    const h = harness(FIVE, '3m');
    h.api.write({ ...BALL_AT, ...ONE_DEFENDER });
    expect(h.ring.getAttribute('stroke')).toBe(RULE_OK_STROKE);
    expect(h.ring.getAttribute('stroke-dasharray')).toBe(RULE_DASH);
    expect(h.say).not.toHaveBeenCalled();
  });

  it('발화가 2-on-1 과 다르다 — 5 m·세트피스라고 말한다', () => {
    const h = harness(FIVE, '5m');
    h.api.write({ ...BALL_AT, ...ONE_DEFENDER });
    const said = h.say.mock.calls[0]![0] as string;
    expect(said).toContain('5 m');
    expect(said).toContain('세트피스');
    expect(said, '세트피스인데 2-on-1 이라고 말했다').not.toContain('2-on-1');
  });

  it('공격이 붙어 있는 것은 반칙이 아니다 (대조군)', () => {
    const h = harness(FIVE, '5m');
    h.api.write({ ...BALL_AT, ch_c: { x: 400, y: 260 } }); // ch_c 는 away = 공격
    expect(h.ring.getAttribute('stroke')).toBe(RULE_OK_STROKE);
  });

  it('진영이 없으면(플랫) 5 m 원이어도 판정하지 않는다', () => {
    const h = harness({ goalMouths: [], fiveMeterDefense: null }, '5m');
    h.api.write({ ...BALL_AT, ...ONE_DEFENDER });
    expect(h.ring.getAttribute('stroke')).toBe(RULE_OK_STROKE);
  });

  it('원을 다시 등록하면 규칙도 따라 바뀐다 — 3 m ↔ 5 m 전환이 사는 길이다', () => {
    const h = harness(FIVE, '3m');
    h.api.write({ ...BALL_AT, ...ONE_DEFENDER });
    expect(h.ring.getAttribute('stroke')).toBe(RULE_OK_STROKE);
    h.api.registerRing(BALL_ID, h.ring, '5m');
    h.api.write({ ...BALL_AT, ...ONE_DEFENDER });
    expect(h.ring.getAttribute('stroke')).toBe(RULE_ALERT_STROKE);
  });
});
