// §4.4 P2-4 — 그림과 배선. 핵심은 **링이 React 가 아니라 TransformWriter 로 움직인다**는 것
// (ZoneHandles 가 같은 자리에서 '핸들만 제자리에 남는' 버그를 냈다 — ZoneHandles.tsx:6-10).
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { RuleOverlay } from './RuleOverlay.tsx';
import { createTransformWriter } from './transformWriter.ts';
import { RULE_ALERT_STROKE, RULE_OK_STROKE, createRuleOverlay } from './ruleOverlay.ts';
import { COURT_DEFS } from '../model/court.ts';
import { mToPx } from '../core/units.ts';
import { RING_5M_R_PX, RING_R_PX } from '../model/rules.ts';
import type { BallRing, TeamSide } from '../model/drill.ts';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';

const TEAMS: Record<TeamSide, { label: string }> = { home: { label: '레드' }, away: { label: '블루' } };
const ROSTER = [
  { id: 'ch_a', team: 'home' as TeamSide, isGk: false },
  { id: 'ch_b', team: 'home' as TeamSide, isGk: false },
  { id: 'ch_c', team: 'away' as TeamSide, isGk: false },
];

/** ⚠️ 2026-08-13(§7 5.2) — 공의 원은 이제 **공마다 따로**이고 기본값이 '없음' 이다. 그래서
 *  옛 단언들이 보던 "공이 있으면 링이 있다" 를 그대로 두려면 픽스처가 원을 켜 줘야 한다.
 *  기본을 '3m' 으로 둔 것은 옛 계약(시각 언어·팔로워·판정 배선)을 계속 재기 위한 것이고,
 *  **초기값이 '없음'** 이라는 새 계약은 아래 'ballRings 를 안 넘기면' 테스트가 따로 잰다. */
function setup(opts: { visible?: boolean; balls?: string[]; rings?: Record<string, BallRing>; owners?: Record<string, TeamSide>; mode?: 'full' | 'half' | 'flat' } = {}) {
  const writer = createTransformWriter();
  const say = vi.fn();
  const rules = createRuleOverlay({ say, now: () => 0 });
  const ballIds = opts.balls ?? ['bl_1'];
  const rings = opts.rings ?? Object.fromEntries(ballIds.map((id) => [id, '3m' as BallRing]));
  const view = render(
    <svg>
      <RuleOverlay
        mode={opts.mode ?? 'full'}
        visible={opts.visible ?? true}
        writer={writer}
        rules={rules}
        ballIds={ballIds}
        ballRings={rings}
        ballOwners={opts.owners}
        roster={ROSTER}
        teams={TEAMS}
      />
    </svg>,
    { wrapper: SettingsProvider },
  );
  return { writer, rules, say, ...view };
}

/** 링의 바깥 그룹 = TransformWriter 팔로워. 안쪽 그룹 = 색·표시 상태. */
function ringGroups(container: HTMLElement, r: number = RING_R_PX): { follower: SVGGElement; state: SVGGElement }[] {
  return Array.from(container.querySelectorAll(`circle[r="${r}"]`))
    .map((c) => c.parentElement as unknown as SVGGElement)
    .filter((el, i, arr) => arr.indexOf(el) === i)
    .map((state) => ({ state, follower: state.parentElement as unknown as SVGGElement }));
}

describe('RuleOverlay — 그림', () => {
  it('공마다 3 m 링을 하나씩 그린다', () => {
    const { container } = setup({ balls: ['bl_1', 'bl_2'] });
    expect(ringGroups(container)).toHaveLength(2);
    // 반지름은 model/rules.ts 의 3 m 와 같은 값이다(리터럴 금지).
    expect(container.querySelectorAll(`circle[r="${RING_R_PX}"]`).length).toBe(4); // 링당 케이싱 + 표시선
  });

  it('공이 없으면 링도 없다', () => {
    const { container } = setup({ balls: [] });
    expect(ringGroups(container)).toHaveLength(0);
  });

  it('visible=false 면 아무것도 그리지 않는다 — 아무 공도 원을 안 켰을 때', () => {
    const { container } = setup({ visible: false, rings: {} });
    expect(container.querySelectorAll('circle')).toHaveLength(0);
    expect(container.querySelectorAll('rect')).toHaveLength(0);
  });
});

// ── §7 5.2 공마다 따로 켜는 거리 원(2026-08-13 기현님 실기 ③) ────────────────────────────
describe('RuleOverlay — 공마다 따로 켜는 원', () => {
  it('ballRings 를 안 넘기면 원이 하나도 없다 — **초기 배치는 원 없음**이다', () => {
    const { container } = setup({ balls: ['bl_1', 'bl_2'], rings: {} });
    expect(container.querySelectorAll('circle')).toHaveLength(0);
    // 대조군: 존은 그대로 있다(원이 없는 것이지 오버레이가 없는 것이 아니다).
    expect(container.querySelectorAll('rect').length).toBe(COURT_DEFS.full.ruleZones.length * 2);
  });

  it('**공 두 개가 서로 다른 원을 갖는다** — 하나는 3 m, 하나는 5 m', () => {
    const { container } = setup({ balls: ['bl_1', 'bl_2'], rings: { bl_1: '3m', bl_2: '5m' } });
    expect(ringGroups(container, RING_R_PX)).toHaveLength(1);
    expect(ringGroups(container, RING_5M_R_PX)).toHaveLength(1);
    // 세 번째 공은 '없음' — 표에 없으면 그리지 않는다.
    const three = setup({ balls: ['bl_1', 'bl_2', 'bl_3'], rings: { bl_1: '3m', bl_2: '5m' } });
    expect(three.container.querySelectorAll('circle')).toHaveLength(4); // 2링 × (케이싱 + 표시선)
  });

  it('반지름은 25 px = 1 m 축척에서 파생된다 — 리터럴이 아니다', () => {
    expect(RING_R_PX).toBe(mToPx(3));
    expect(RING_5M_R_PX).toBe(mToPx(5));
    const { container } = setup({ rings: { bl_1: '5m' } });
    expect(container.querySelector(`circle[r="${mToPx(5)}"]`)).not.toBeNull();
    expect(container.querySelector(`circle[r="${mToPx(3)}"]`)).toBeNull();
  });

  it('규칙 존 스위치가 꺼져도 **명시적으로 켠 원**은 남는다 — 존과 다른 축이다', () => {
    const { container } = setup({ visible: false, rings: { bl_1: '5m' } });
    expect(ringGroups(container, RING_5M_R_PX)).toHaveLength(1);
    expect(container.querySelectorAll('rect')).toHaveLength(0); // 존 표시는 스위치에 매인다
  });
});

describe('RuleOverlay — 그림(이어서)', () => {
  it('골 지역 표시는 코트의 존 개수만큼 — flat 은 0개', () => {
    expect(setup({ mode: 'full' }).container.querySelectorAll('rect')).toHaveLength(COURT_DEFS.full.ruleZones.length * 2);
    expect(setup({ mode: 'half' }).container.querySelectorAll('rect')).toHaveLength(COURT_DEFS.half.ruleZones.length * 2);
    expect(setup({ mode: 'flat' }).container.querySelectorAll('rect')).toHaveLength(0);
  });

  it('접근성 트리에서 빠지고 포인터를 가로채지 않는다', () => {
    const { container } = setup();
    // 링은 공 주위 3 m 를 덮는다 — 포인터를 먹으면 링 안의 개체를 아무도 못 잡는다.
    const layer = container.querySelector('g[aria-hidden="true"]')!;
    expect(layer.getAttribute('pointer-events')).toBe('none');
  });

  it('케이싱은 어두운 실선, 표시선은 그룹에서 색·파선을 상속받는다', () => {
    const { container } = setup();
    const [ring] = ringGroups(container);
    const circles = Array.from(ring!.state.querySelectorAll('circle'));
    expect(circles[0]!.getAttribute('stroke')).toBe('#000000');
    expect(circles[0]!.getAttribute('stroke-dasharray')).toBe('none');
    // 표시선은 stroke 를 스스로 갖지 않는다 — writer 가 그룹 하나만 바꾸면 따라온다.
    expect(circles[1]!.getAttribute('stroke')).toBeNull();
    expect(circles[1]!.getAttribute('stroke-dasharray')).toBeNull();
  });
});

describe('RuleOverlay — 링은 TransformWriter 로 따라간다 (React state 0)', () => {
  it('공이 움직이면 링 그룹이 같은 transform 을 받는다', () => {
    const { container, writer } = setup();
    const [ring] = ringGroups(container);
    writer.write('bl_1', 300, 200, 0);
    expect(ring!.follower.getAttribute('transform')).toBe('translate(300.00 200.00) rotate(0.00)');
    writer.write('bl_1', 310.5, 205.25, 0);
    expect(ring!.follower.getAttribute('transform')).toBe('translate(310.50 205.25) rotate(0.00)');
  });

  it('공을 잡아도 링은 커지지 않는다 — 3 m 는 잡아도 3 m 다', () => {
    const { container, writer } = setup();
    const [ring] = ringGroups(container);
    writer.write('bl_1', 300, 200, 0);
    writer.setHeld('bl_1', true);
    expect(ring!.follower.getAttribute('transform')).toBe('translate(300.00 200.00) rotate(0.00)');
    expect(ring!.follower.getAttribute('transform')).not.toContain('scale');
  });

  it('언마운트하면 팔로워 등록이 풀린다', () => {
    const { container, writer, unmount } = setup();
    const [ring] = ringGroups(container);
    writer.write('bl_1', 300, 200, 0);
    unmount();
    writer.write('bl_1', 500, 400, 0);
    expect(ring!.follower.getAttribute('transform')).toBe('translate(300.00 200.00) rotate(0.00)');
  });
});

describe('RuleOverlay — 판정이 그림에 닿는다', () => {
  const violating = {
    bl_1: { x: 400, y: 260 },
    ch_a: { x: 410, y: 260 },
    ch_b: { x: 390, y: 260 },
    ch_c: { x: 420, y: 260 },
  };

  it('위반 프레임을 흘리면 링 그룹이 경고 상태가 된다', () => {
    const { container, rules, say } = setup();
    const [ring] = ringGroups(container);
    expect(ring!.state.getAttribute('stroke')).toBe(RULE_OK_STROKE);
    rules.write(violating);
    expect(ring!.state.getAttribute('stroke')).toBe(RULE_ALERT_STROKE);
    expect(say).toHaveBeenCalledTimes(1);
  });

  it('visible=false 로 그리면 판정 자체가 멎는다 — 같은 프레임인데 발화가 없다', () => {
    const { rules, say } = setup({ visible: false });
    rules.write(violating);
    expect(say).toHaveBeenCalledTimes(0);
  });

  it('★ 원이 **없음**인 공에서도 2-on-1 판정과 발화가 그대로 산다 — 표시와 판정은 독립이다', () => {
    // 5.2 의 가장 조용한 실패 형태: 링을 안 그린다고 registerRing 까지 건너뛰면 그 공은
    // judge() 의 순회에서 통째로 빠진다 — 화면에 아무 표시가 없으니 아무도 눈치채지 못한다.
    const { container, rules, say } = setup({ rings: {} });
    expect(container.querySelectorAll('circle')).toHaveLength(0); // 그림은 정말 없다
    rules.write(violating);
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0]![0]).toContain('2-on-1');
  });

  // ⚠️ 2026-08-17 — 이 자리에는 *'5 m 를 켜 놔도 판정 반경은 3 m 다'* 가 있었다. 기현 지시로
  // **5 m 원에 자기 규칙이 생겨서**(세트피스 5 m 제한 — model/rules.ts) 계약이 바뀐 것이다.
  // 옛 단언이 지키던 것은 그대로 산다: **3 m·없음 원은 여전히 2-on-1 을 3 m 로만 잰다.**
  it('3 m 원은 여전히 3 m 로 잰다 — 3~5 m 사이의 선수는 2-on-1 을 만들지 않는다', () => {
    const { rules, say } = setup({ rings: { bl_1: '3m' } });
    // 홈 둘 중 하나를 3 m 밖 5 m 안(4 m = 100px)에 둔다 → 링 안 인원은 홈 1명뿐이라 깨끗하다.
    rules.write({ bl_1: { x: 400, y: 260 }, ch_a: { x: 410, y: 260 }, ch_b: { x: 500, y: 260 }, ch_c: { x: 420, y: 260 } });
    expect(say).toHaveBeenCalledTimes(0);
    // 대조군 — 3 m 안으로 들이면 곧바로 걸린다(위 '0회' 가 배선 누락이 아님을 증명한다).
    rules.write(violating);
    expect(say).toHaveBeenCalledTimes(1);
  });

  it('★ 5 m 원이면 수비 한 대만 들어와도 걸린다 — 같은 프레임이 3 m 원에서는 조용했다', () => {
    // 위 테스트와 **같은 배치**다. 다른 것은 공의 원뿐이다.
    const frame = { bl_1: { x: 400, y: 260 }, ch_a: { x: 410, y: 260 }, ch_b: { x: 500, y: 260 }, ch_c: { x: 420, y: 260 } };
    const { rules, say, container } = setup({ rings: { bl_1: '5m' } });
    rules.write(frame);
    expect(say).toHaveBeenCalledTimes(1);
    const said = say.mock.calls[0]![0] as string;
    expect(said).toContain('세트피스');
    expect(said, '세트피스인데 2-on-1 이라고 말했다').not.toContain('2-on-1');
    // 그림도 따라온다 — 링은 5 m 짜리 하나이고 그것이 붉어진다.
    const [ring] = ringGroups(container, RING_5M_R_PX);
    expect(ring!.state.getAttribute('stroke')).toBe(RULE_ALERT_STROKE);
  });

  it('플랫 코트에서는 5 m 원이어도 판정하지 않는다 — 골대도 진영도 없다', () => {
    const { rules, say } = setup({ rings: { bl_1: '5m' }, mode: 'flat' });
    rules.write({ bl_1: { x: 400, y: 260 }, ch_a: { x: 410, y: 260 } });
    expect(say).toHaveBeenCalledTimes(0);
  });

  it('언마운트하면 존·링 등록이 풀려 죽은 노드를 갱신하지 않는다', () => {
    const { container, rules, unmount } = setup();
    const [ring] = ringGroups(container);
    unmount();
    rules.write(violating);
    expect(ring!.state.getAttribute('stroke')).toBe(RULE_OK_STROKE);
  });
});

// 기현 지시 2026-08-27 — *"공을 가로지르는 2미터의 흐린 흰색 화살표로 (심판 시그널과 일맥상통)"*
describe('RuleOverlay — 세트피스 소유 화살표', () => {
  /** 소유 화살표만 고른다(링은 circle, 화살표는 path 다). */
  const arrows = (c: HTMLElement): SVGPathElement[] =>
    Array.from(c.querySelectorAll('path')).filter((el) => (el.getAttribute('d') ?? '').startsWith('M -25 0'));

  it('5 m + 소유가 있어야 그린다 — 3 m 에는 소유 개념이 없다', () => {
    expect(arrows(setup({ rings: { bl_1: '3m' }, owners: { bl_1: 'home' } }).container), '3 m').toHaveLength(0);
    expect(arrows(setup({ rings: { bl_1: '5m' } }).container), '소유 없음').toHaveLength(0);
    expect(arrows(setup({ rings: { bl_1: '5m' }, owners: { bl_1: 'home' } }).container), '5 m + 소유').toHaveLength(1);
  });

  it('★ 길이가 2 m 다 — 공을 가로질러 ±1 m', () => {
    const { container } = setup({ rings: { bl_1: '5m' }, owners: { bl_1: 'home' } });
    const d = arrows(container)[0]!.getAttribute('d')!;
    // 몸통이 -25 → +25 = 50 px = 2 m (25 px/m). 리터럴이 아니라 mToPx(2) 파생이다.
    expect(d).toContain(`M ${-mToPx(2) / 2} 0 L ${mToPx(2) / 2} 0`);
  });

  it('★ 소유 팀이 **공격하는 방향**을 가리킨다 — 두 팀이 정확히 반대다', () => {
    const home = setup({ rings: { bl_1: '5m' }, owners: { bl_1: 'home' } });
    const away = setup({ rings: { bl_1: '5m' }, owners: { bl_1: 'away' } });
    const degOf = (c: HTMLElement): number => {
      const t = arrows(c)[0]!.parentElement!.getAttribute('transform')!;
      return Number(/rotate\(([-\d.]+)\)/.exec(t)![1]);
    };
    // 풀 코트 기본 진영은 home(왼쪽 골) → home 은 +x(0°), away 는 그 반대(180°).
    expect(degOf(home.container)).toBe(0);
    expect(Math.abs(degOf(away.container) - degOf(home.container))).toBe(180);
  });

  it('★ 위반 색에 물들지 않는다 — 소유는 판정과 다른 축이다', () => {
    const { container } = setup({ rings: { bl_1: '5m' }, owners: { bl_1: 'home' } });
    const arrow = arrows(container)[0]!;
    // 링의 상태 그룹(stateRef) 안에 있으면 위반 시 붉어진다. 밖에 있어야 흰색으로 남는다.
    expect(arrow.getAttribute('stroke')).toBe(RULE_OK_STROKE);
    expect(arrow.closest('[stroke-dasharray]'), '링의 상태 그룹 안에 들어갔다').toBeNull();
  });

  it('플랫 코트는 골대가 없어 방향이 성립하지 않는다 — 그리지 않는다', () => {
    const { container } = setup({ mode: 'flat', rings: { bl_1: '5m' }, owners: { bl_1: 'home' } });
    expect(arrows(container)).toHaveLength(0);
  });
});
