// §4.4 P2-4 — **편집기 경로** 배선. 시연(sampleDrill 보간)과 달리 여기는 물리 프레임이
// 흘러오는 자리이고, 명단을 **이 스텝 기준**으로 자르는 것이 EditorStage 의 몫이다.
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import { EditorStage } from './EditorStage.tsx';
import { createTransformWriter } from '../../render/transformWriter.ts';
import { createRuleOverlay } from '../../render/ruleOverlay.ts';
import { RING_5M_R_PX, RING_R_PX } from '../../model/rules.ts';
import { RULE_ALERT_STROKE, RULE_OK_STROKE } from '../../render/ruleOverlay.ts';
import { DEFAULT_ZONES } from '../../core/constants.ts';
import { CURRENT_DRILL_SCHEMA, type BallRing, type Drill, type TeamSide } from '../../model/drill.ts';
import type { EditorWorldRef } from '../../store/editor/EditorProvider.tsx';
import type { BallId, ChairId, DrillId, StepId } from '../../core/ids.ts';

const BALL = { x: 400, y: 260 };
const CAST: { id: string; team: TeamSide }[] = [
  { id: 'ch_a', team: 'home' },
  { id: 'ch_b', team: 'home' },
  { id: 'ch_c', team: 'away' },
];

/** `onStep` 에 적힌 휠체어만 이 스텝의 판 위에 있다 — 나머지는 cast 에만 있는 선수다.
 *
 *  ⚠️ 2026-08-13(§7 5.2) — 공의 원은 이제 공마다 따로이고 **기본이 '없음'** 이다. 그래서
 *  옛 배선 단언(링이 붙는가·판정이 그림에 닿는가)을 계속 재려면 픽스처가 원을 켜 줘야 한다.
 *  기본값이 '없음' 이라는 사실 자체는 아래 '5.2' 블록이 따로 잰다. */
function makeDrill(onStep: string[], ring: BallRing = '3m'): Drill {
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
      // ⚠️ 'none' 은 **키 없음**이다(그래서 삼항이다) — `{ring: undefined}` 를 쓰면 JSON 왕복에서
      //    뜻이 달라진다(model/drill.ts BallRing 주석).
      balls: [ring === 'none' ? { id: 'bl_1' as BallId } : { id: 'bl_1' as BallId, ring }],
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
        shapes: [],
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
      rot={0}
      drill={drill}
      step={drill.steps[0]!}
      stepIndex={0}
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
      onDuplicateIds={vi.fn()}
      onEditNote={() => {}}
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

  it('규칙 존 스위치를 끄면 판정이 없다 — 다만 **켜 놓은 원**은 남는다(5.2)', () => {
    const { container, rules, say } = mount(makeDrill(['ch_a', 'ch_b', 'ch_c']), false);
    rules.write(POSES);
    expect(say).toHaveBeenCalledTimes(0);
    // 사용자가 그 공을 눌러 명시적으로 켠 원이라 스위치로 지우지 않는다. 판정이 서지 않으므로
    // 흰 파선 그대로다(경고 없이 거리만).
    expect(ring(container)!.state.getAttribute('stroke')).toBe(RULE_OK_STROKE);
    // 대조군 — 원을 안 켠 공이면 스위치를 껐을 때 정말로 아무것도 없다.
    const off = mount(makeDrill(['ch_a', 'ch_b', 'ch_c'], 'none'), false);
    expect(ring(off.container)).toBeNull();
  });
});

// ── 2026-08-13 — 판정이 **차체 사각형**으로 바뀌었다(model/chairOverlap.ts) ────────────────────
// 편집기가 흘리는 것은 `world.read()` = `PhysicsSnapshot`(x·y·theta) 다. 그 theta 가 판정까지
// 오지 않으면 편집 화면만 "언제나 +x 를 보는 차체" 로 조용히 틀린다.
describe('EditorStage — 차체 **방향**이 판정까지 온다', () => {
  /** 물리 스냅샷과 **같은 모양**의 프레임. 홈 한 대를 공에서 피벗 100 px(4 m) 에 둔다. */
  const snapshot = (theta: number) => ({
    bl_1: { x: BALL.x, y: BALL.y, theta: 0 },
    ch_a: { x: BALL.x + 100, y: BALL.y, theta },
    ch_b: { x: BALL.x + 10, y: BALL.y, theta: 0 },
    ch_c: { x: BALL.x + 20, y: BALL.y, theta: 0 },
  });

  it('공을 마주 보면(180°) 앞범퍼 1.2 m 가 3 m 안에 닿아 붉어진다', () => {
    const { container, rules, say } = mount(makeDrill(['ch_a', 'ch_b', 'ch_c']));
    rules.write(snapshot(Math.PI));
    expect(ring(container)!.state.getAttribute('stroke')).toBe(RULE_ALERT_STROKE);
    expect(say).toHaveBeenCalledTimes(1);
  });

  it('★ 같은 좌표에서 등을 돌리면(0°) 깨끗하다 — 방향이 안 오면 두 결과가 같아진다', () => {
    const { container, rules, say } = mount(makeDrill(['ch_a', 'ch_b', 'ch_c']));
    rules.write(snapshot(0));
    expect(ring(container)!.state.getAttribute('stroke')).toBe(RULE_OK_STROKE);
    expect(say).toHaveBeenCalledTimes(0);
  });
});

// ── §7 5.2 공마다 따로 켜는 거리 원 — **편집 화면** 배선(2026-08-13 기현님 실기 ③) ──────────
describe('EditorStage — 공의 원이 cast 에서 화면까지 온다', () => {
  it('원이 없는 공(기본)에는 링이 없다 — 그래도 2-on-1 판정과 발화는 그대로다', () => {
    const { container, rules, say } = mount(makeDrill(['ch_a', 'ch_b', 'ch_c'], 'none'));
    expect(ring(container)).toBeNull();
    rules.write(POSES);
    expect(say).toHaveBeenCalledTimes(1);
    expect(say.mock.calls[0]![0]).toContain('2-on-1');
  });

  it('5 m 를 켜면 반지름 5 m 원이 그려진다 — 판정 반경(3 m)과 다른 값이다', () => {
    const { container } = mount(makeDrill(['ch_a'], '5m'));
    expect(container.querySelector(`circle[r="${RING_5M_R_PX}"]:not([cx])`)).not.toBeNull();
    expect(container.querySelector(`circle[r="${RING_R_PX}"]:not([cx])`)).toBeNull();
  });

  it('**공 두 개가 서로 다른 원을 갖는다** — 전역 상태 하나로는 이 테스트가 통과하지 않는다', () => {
    const d = makeDrill(['ch_a'], '3m');
    const two: Drill = {
      ...d,
      cast: { ...d.cast, balls: [{ id: 'bl_1' as BallId, ring: '3m' }, { id: 'bl_2' as BallId, ring: '5m' }] },
      steps: [{ ...d.steps[0]!, balls: { bl_1: BALL, bl_2: { x: BALL.x + 200, y: BALL.y } } }],
    };
    const { container } = mount(two);
    expect(container.querySelectorAll(`circle[r="${RING_R_PX}"]:not([cx])`)).toHaveLength(2); // 케이싱 + 표시선
    expect(container.querySelectorAll(`circle[r="${RING_5M_R_PX}"]:not([cx])`)).toHaveLength(2);
  });
});
