// §4.4 P2-4 — **편집기 경로** 배선. 시연(sampleDrill 보간)과 달리 여기는 물리 프레임이
// 흘러오는 자리이고, 명단을 **이 스텝 기준**으로 자르는 것이 EditorStage 의 몫이다.
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { EditorStage } from './EditorStage.tsx';
import { createTransformWriter } from '../../render/transformWriter.ts';
import { createRuleOverlay } from '../../render/ruleOverlay.ts';
import { RING_R_PX } from '../../model/rules.ts';
import { RULE_ALERT_STROKE, RULE_OK_STROKE } from '../../render/ruleOverlay.ts';
import { DEFAULT_ZONES } from '../../core/constants.ts';
import { CURRENT_DRILL_SCHEMA, type Drill, type TeamSide } from '../../model/drill.ts';
import type { EditorWorldRef } from '../../store/editor/EditorProvider.tsx';
import type { BallId, ChairId, DrillId, StepId } from '../../core/ids.ts';

const BALL = { x: 400, y: 260 };
const CAST: { id: string; team: TeamSide }[] = [
  { id: 'ch_a', team: 'home' },
  { id: 'ch_b', team: 'home' },
  { id: 'ch_c', team: 'away' },
];

/** `onStep` 에 적힌 휠체어만 이 스텝의 판 위에 있다 — 나머지는 cast 에만 있는 선수다. */
function makeDrill(onStep: string[]): Drill {
  return {
    schemaVersion: CURRENT_DRILL_SCHEMA,
    id: 'dr_t' as DrillId,
    title: '규칙 배선 시험',
    category: '수비',
    level: '초급',
    durationMin: 5,
    tags: [],
    courtMode: 'full',
    formation: '1-2-1',
    teams: {
      home: { label: '레드', color: '#d93a3a', gkColor: '#f2c811' },
      away: { label: '블루', color: '#1f6bb8', gkColor: '#22a95b' },
    },
    cast: {
      chairs: CAST.map((c, i) => ({ id: c.id as ChairId, team: c.team, number: String(i + 1), isGk: false })),
      balls: [{ id: 'bl_1' as BallId }],
      cones: [],
    },
    steps: [
      {
        id: 'st_1' as StepId,
        name: '스텝 1',
        note: '',
        chairs: Object.fromEntries(onStep.map((id) => [id, { x: 0, y: 0, angleDeg: 0 }])),
        balls: { bl_1: BALL },
        cones: {},
        arrows: [],
        notes: [],
      },
    ],
    createdAt: 0,
    updatedAt: 0,
  };
}

/** 셋 다 공 3 m 안 — 홈 2 + 원정 1 이면 2-on-1 이 성립하는 좌표. */
const POSES = {
  bl_1: { x: BALL.x, y: BALL.y },
  ch_a: { x: BALL.x + 10, y: BALL.y },
  ch_b: { x: BALL.x - 10, y: BALL.y },
  ch_c: { x: BALL.x + 20, y: BALL.y },
};

function mount(drill: Drill, showRuleZones = true) {
  const writer = createTransformWriter();
  const say = vi.fn();
  const rules = createRuleOverlay({ say, now: () => 0 });
  const view = render(
    <EditorStage
      drill={drill}
      step={drill.steps[0]!}
      tool="select"
      coneSlot={0}
      selection={new Set()}
      dispatch={vi.fn()}
      worldRef={{ current: null } as EditorWorldRef}
      writer={writer}
      rules={rules}
      zones={DEFAULT_ZONES}
      ballMax={8}
      pendingPlayerId={null}
      onPlayerPlaced={vi.fn()}
      showToast={vi.fn()}
      showGrid={false}
      showGridLabels={false}
      showRuleZones={showRuleZones}
      largeTargets={false}
      onEraseIds={vi.fn()}
    />,
  );
  return { ...view, writer, rules, say };
}

/** 링은 그룹 원점에 그려져 cx 가 없다. 5.3 이전에는 코트에 같은 r=75 인 센터 서클(cx 있음)이
 *  있어서 이 조건이 둘을 갈랐다 — 그 원은 §9 결정 ⑧ 으로 지워졌지만 조건은 그대로 둔다
 *  (되살아나면 링 테스트가 그 원을 링으로 착각해 조용히 초록불이 된다). */
function ring(container: HTMLElement): { follower: Element; state: Element } | null {
  const circle = container.querySelector(`circle[r="${RING_R_PX}"]:not([cx])`);
  if (!circle) return null;
  const state = circle.parentElement!;
  return { state, follower: state.parentElement! };
}

describe('EditorStage — 규칙 오버레이 배선', () => {
  it('공에 링이 붙고 물리 프레임을 흘리면 판정이 그림에 닿는다', () => {
    const { container, rules, say } = mount(makeDrill(['ch_a', 'ch_b', 'ch_c']));
    expect(ring(container)).not.toBeNull();
    rules.write(POSES);
    expect(ring(container)!.state.getAttribute('stroke')).toBe(RULE_ALERT_STROKE);
    expect(say).toHaveBeenCalledTimes(1);
  });

  it('**이 스텝에 없는 선수는 판정에 안 든다** — cast 에만 있는 선수가 반칙을 만들지 않는다', () => {
    // ch_b 는 이 스텝에서 판 위에 없다. 좌표는 프레임에 있어도(물리 바디가 남아 있어도)
    // 세면 안 된다 — 화면에 보이지 않는 선수 때문에 링이 붉어지면 이유를 알 수 없다.
    const { container, rules, say } = mount(makeDrill(['ch_a', 'ch_c']));
    rules.write(POSES);
    expect(ring(container)!.state.getAttribute('stroke')).toBe(RULE_OK_STROKE);
    expect(say).toHaveBeenCalledTimes(0);
    // 대조군: 같은 프레임인데 ch_b 를 스텝에 넣으면 곧바로 걸린다.
    const on = mount(makeDrill(['ch_a', 'ch_b', 'ch_c']));
    on.rules.write(POSES);
    expect(ring(on.container)!.state.getAttribute('stroke')).toBe(RULE_ALERT_STROKE);
  });

  it('링은 개체 레이어보다 **아래**에 그려진다 — 위에 깔면 링 안의 칩을 못 잡는다', () => {
    const { container } = mount(makeDrill(['ch_a']));
    const svg = container.querySelector('svg')!;
    const nodes = Array.from(svg.querySelectorAll('*'));
    const ringCircle = svg.querySelector(`circle[r="${RING_R_PX}"]:not([cx])`)!;
    // 개체 레이어의 첫 개체(휠체어 그룹은 id="obj-…" 를 갖는다)보다 앞선다.
    const firstObj = svg.querySelector('[id^="obj-"]')!;
    expect(nodes.indexOf(ringCircle)).toBeLessThan(nodes.indexOf(firstObj));
  });

  it('규칙 존 스위치를 끄면 링도 판정도 없다', () => {
    const { container, rules, say } = mount(makeDrill(['ch_a', 'ch_b', 'ch_c']), false);
    expect(ring(container)).toBeNull();
    rules.write(POSES);
    expect(say).toHaveBeenCalledTimes(0);
  });
});
