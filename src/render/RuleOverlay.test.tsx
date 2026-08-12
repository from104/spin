// §4.4 P2-4 — 그림과 배선. 핵심은 **링이 React 가 아니라 TransformWriter 로 움직인다**는 것
// (ZoneHandles 가 같은 자리에서 '핸들만 제자리에 남는' 버그를 냈다 — ZoneHandles.tsx:6-10).
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { RuleOverlay } from './RuleOverlay.tsx';
import { createTransformWriter } from './transformWriter.ts';
import { RULE_ALERT_STROKE, RULE_OK_STROKE, createRuleOverlay } from './ruleOverlay.ts';
import { COURT_DEFS } from '../model/court.ts';
import { RING_R_PX } from '../model/rules.ts';
import type { TeamSide } from '../model/drill.ts';

const TEAMS: Record<TeamSide, { label: string }> = { home: { label: '레드' }, away: { label: '블루' } };
const ROSTER = [
  { id: 'ch_a', team: 'home' as TeamSide, isGk: false },
  { id: 'ch_b', team: 'home' as TeamSide, isGk: false },
  { id: 'ch_c', team: 'away' as TeamSide, isGk: false },
];

function setup(opts: { visible?: boolean; balls?: string[]; mode?: 'full' | 'half' | 'flat' } = {}) {
  const writer = createTransformWriter();
  const say = vi.fn();
  const rules = createRuleOverlay({ say, now: () => 0 });
  const view = render(
    <svg>
      <RuleOverlay
        mode={opts.mode ?? 'full'}
        visible={opts.visible ?? true}
        writer={writer}
        rules={rules}
        ballIds={opts.balls ?? ['bl_1']}
        roster={ROSTER}
        teams={TEAMS}
      />
    </svg>,
  );
  return { writer, rules, say, ...view };
}

/** 링의 바깥 그룹 = TransformWriter 팔로워. 안쪽 그룹 = 색·표시 상태. */
function ringGroups(container: HTMLElement): { follower: SVGGElement; state: SVGGElement }[] {
  return Array.from(container.querySelectorAll(`circle[r="${RING_R_PX}"]`))
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

  it('visible=false 면 아무것도 그리지 않는다', () => {
    const { container } = setup({ visible: false });
    expect(container.querySelectorAll('circle')).toHaveLength(0);
    expect(container.querySelectorAll('rect')).toHaveLength(0);
  });

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

  it('언마운트하면 존·링 등록이 풀려 죽은 노드를 갱신하지 않는다', () => {
    const { container, rules, unmount } = setup();
    const [ring] = ringGroups(container);
    unmount();
    rules.write(violating);
    expect(ring!.state.getAttribute('stroke')).toBe(RULE_OK_STROKE);
  });
});
