// §4.4 P2-4 — **시연 경로** 배선. 편집기는 물리(world.read), 시연은 sampleDrill 보간이라
// 두 경로에 각각 걸어야 한다(PresentStage.tsx:1) — 한쪽만 하면 시연에서 링이 안 따라온다.
//
// [D-6] 시연은 개체를 통째로 `aria-hidden` 으로 감추고 텍스트로만 서술한다. 그래서 규칙 위반이
// **시각 신호뿐이면 시각장애 코치에게 전달되지 않는다.** 여기서는 실제 `liveRegion` 을 마운트해
// 화면에 무엇이 발표됐는지를 본다(스파이가 아니라 최종 산출물).
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { PresentStage } from './PresentStage.tsx';
import { PlaybackProvider } from '../../store/playback/PlaybackProvider.tsx';
import { LiveRegion, liveRegion } from '../../ui/LiveRegion.tsx';
import { RING_5M_R_PX, RING_R_PX } from '../../model/rules.ts';
import { COURT_DEFS } from '../../model/court.ts';
import { RULE_ALERT_STROKE, RULE_OK_STROKE } from '../../render/ruleOverlay.ts';
import { CURRENT_DRILL_SCHEMA, type BallRing, type Drill, type TeamSide } from '../../model/drill.ts';
import type { BallId, ChairId, DrillId, StepId } from '../../core/ids.ts';

const BALL = { x: 400, y: 260 };

/** 스텝 1장짜리 드릴. 좌표를 직접 적어 판정 조건을 눈으로 확인할 수 있게 한다.
 *
 *  ⚠️ 2026-08-13(§7 5.2) — 공의 원은 공마다 따로이고 **기본이 '없음'** 이다. 옛 배선 단언
 *  (링이 공을 따라오는가·판정이 그림과 발화에 닿는가)을 계속 재려면 픽스처가 원을 켜야 한다.
 *  기본값이 '없음' 이라는 사실은 아래 '5.2' 블록이 따로 잰다. */
function makeDrill(chairs: { id: string; team: TeamSide; isGk?: boolean; x: number; y: number; deg?: number }[], ring: BallRing = '3m'): Drill {
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
      chairs: chairs.map((c, i) => ({ id: c.id as ChairId, team: c.team, number: String(i + 1), isGk: c.isGk ?? false })),
      // 'none' 은 **키 없음**이다(model/drill.ts BallRing 주석) — 그래서 삼항이다.
      balls: [ring === 'none' ? { id: 'bl_1' as BallId } : { id: 'bl_1' as BallId, ring }],
      cones: [],
    },
    steps: [
      {
        id: 'st_1' as StepId,
        name: '스텝 1',
        note: '',
        chairs: Object.fromEntries(chairs.map((c) => [c.id, { x: c.x, y: c.y, angleDeg: c.deg ?? 0 }])),
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

/** 홈 2명 + 원정 1명이 공 3 m 안 = 2-on-1. */
const VIOLATING = makeDrill([
  { id: 'ch_a', team: 'home', x: BALL.x + 10, y: BALL.y },
  { id: 'ch_b', team: 'home', x: BALL.x - 10, y: BALL.y },
  { id: 'ch_c', team: 'away', x: BALL.x + 20, y: BALL.y },
]);
/** 같은 배치인데 홈 하나가 링 밖(200px)에 있다. */
const CLEAN = makeDrill([
  { id: 'ch_a', team: 'home', x: BALL.x + 10, y: BALL.y },
  { id: 'ch_b', team: 'home', x: BALL.x + 200, y: BALL.y },
  { id: 'ch_c', team: 'away', x: BALL.x + 20, y: BALL.y },
]);

function mount(drill: Drill, showRuleZones = true) {
  const view = render(
    <PlaybackProvider>
      <LiveRegion />
      <PresentStage drill={drill} showRuleZones={showRuleZones} reduceMotion />
    </PlaybackProvider>,
  );
  return view;
}

/** 라이브 리전에 실제로 찍힌 문장(중복 낭독용 널폭 공백은 지운다). */
const announced = (): string => (liveRegion.el?.textContent ?? '').replace(/​/g, '');

/** 링 = 반지름 75 원을 담은 그룹. 바깥 그룹이 TransformWriter 팔로워다.
 *
 *  ⚠️ `cx` 가 **없는** 것으로 고른다. 원래 이유는 코트에 반지름이 똑같이 75 인 원이 하나 더
 *  있었기 때문이다(규정에 없는 센터 서클). 5.3 이 그 원을 지웠지만 선택자는 **그대로 둔다** —
 *  아래 '[결정 ⑧ 완료]' 가 "cx 있는 r=75 원은 없다" 를 재고 있어서, 선택자를 느슨하게 풀면
 *  센터 서클이 되살아났을 때 링 테스트가 그 원을 링으로 착각해 전부 초록불이 된다. */
function ring(container: HTMLElement): { follower: Element; state: Element } | null {
  const circle = container.querySelector(`circle[r="${RING_R_PX}"]:not([cx])`);
  if (!circle) return null;
  const state = circle.parentElement!;
  return { state, follower: state.parentElement! };
}

describe('PresentStage — 3 m 링이 시연 경로에도 붙는다', () => {
  it('링이 공 위치로 옮겨진다 — 재생 전(일시정지)에도', () => {
    const { container } = mount(CLEAN);
    const r = ring(container)!;
    expect(r).not.toBeNull();
    // 시연은 물리가 아니라 sampleDrill 보간이다. 그 프레임이 writer 를 지나 팔로워까지 왔는가.
    expect(r.follower.getAttribute('transform')).toBe(`translate(${BALL.x.toFixed(2)} ${BALL.y.toFixed(2)}) rotate(0.00)`);
  });

  it('깨끗한 배치에서는 흰 파선이고 아무 말도 하지 않는다', () => {
    const { container } = mount(CLEAN);
    expect(ring(container)!.state.getAttribute('stroke')).toBe(RULE_OK_STROKE);
    expect(announced()).toBe('');
  });

  it('2-on-1 이면 링이 경고 상태가 되고 **라이브 리전이 말한다** [D-6]', () => {
    const { container } = mount(VIOLATING);
    expect(ring(container)!.state.getAttribute('stroke')).toBe(RULE_ALERT_STROKE);
    expect(announced()).toContain('2-on-1');
    expect(announced()).toContain('레드'); // 팀 이름은 드릴의 라벨을 그대로 쓴다
  });

  it('규칙 존을 끄면 판정도 발화도 없다 — 다만 **켜 놓은 원**은 남는다(5.2)', () => {
    const { container } = mount(VIOLATING, false);
    expect(announced()).toBe('');
    // 판정이 서지 않으니 경고색이 아니다. 원 자체는 사용자가 켠 것이라 남는다.
    expect(ring(container)!.state.getAttribute('stroke')).toBe(RULE_OK_STROKE);
    // 대조군 — 원을 안 켠 공이면 스위치를 껐을 때 정말로 아무것도 없다.
    const off = mount(makeDrill([{ id: 'ch_a', team: 'home', x: 100, y: 100 }], 'none'), false);
    expect(ring(off.container)).toBeNull();
  });

  it('공이 없는 드릴에는 링이 없다', () => {
    const noBall = makeDrill([{ id: 'ch_a', team: 'home', x: 100, y: 100 }]);
    noBall.cast.balls = [];
    noBall.steps[0]!.balls = {};
    const { container } = mount(noBall);
    expect(ring(container)).toBeNull();
  });

  it('링은 접근성 트리에서 빠지고 포인터도 가로채지 않는다 — 말하는 것은 라이브 리전이다', () => {
    const { container } = mount(VIOLATING);
    const layer = ring(container)!.follower.parentElement!;
    expect(layer.getAttribute('aria-hidden')).toBe('true');
    expect(layer.getAttribute('pointer-events')).toBe('none');
  });

  it('[결정 ⑧ 완료] 코트에는 이제 반지름 75 원이 **없다** — 링만 남고 시각 언어는 그대로 파선이다', () => {
    // ⚠️ 이 단언은 승격된 것이다. 옛 판은 "아직 남아 있는 센터 서클과 반지름이 같으니 시각
    //    언어(실선/파선)를 다르게 쓴다" 를 쟀다. 5.3 이 규정에 없는 센터 서클을 지웠으므로
    //    이제 재야 하는 것은 **그 원이 없다는 것**이다 — 되돌아오면 공이 센터에 있을 때 실선
    //    원과 파선 링이 같은 자리에 겹친다.
    const { container } = mount(CLEAN);
    expect(container.querySelector(`circle[r="${RING_R_PX}"][cx]`)).toBeNull();
    // 대조군 — 부재 단언이 헛것이 아니다: cx 없는 링은 실제로 있고, 파선이다.
    expect(ring(container)).not.toBeNull();
    expect(ring(container)!.state.getAttribute('stroke-dasharray')).toBe('8 6'); // 규칙 = 파선
  });
});

// ── §7 5.2 공마다 따로 켜는 거리 원 — **시연 화면**(2026-08-13 기현님 실기 ③) ──────────────
// 5차의 "시연 화면만 강제색에서 팀 구분을 잃었다" 와 같은 형태의 축 누락을 막는 블록이다:
// 편집 화면만 배선하면 여기가 조용히 옛 모습(또는 원 0개)으로 남는다.
describe('PresentStage — 공의 원이 시연에도 온다', () => {
  it('원이 없는 공(기본)에는 링이 없다 — 그래도 2-on-1 은 그대로 발표된다 [D-6]', () => {
    const { container } = mount(makeDrill(
      [
        { id: 'ch_a', team: 'home', x: BALL.x + 10, y: BALL.y },
        { id: 'ch_b', team: 'home', x: BALL.x - 10, y: BALL.y },
        { id: 'ch_c', team: 'away', x: BALL.x + 20, y: BALL.y },
      ],
      'none',
    ));
    expect(ring(container)).toBeNull();
    expect(container.querySelector(`circle[r="${RING_5M_R_PX}"]`)).toBeNull();
    expect(announced()).toContain('2-on-1'); // 표시와 판정은 독립이다
  });

  it('5 m 를 켠 공은 시연에서도 5 m 로 그려지고 공을 따라간다', () => {
    const { container } = mount(makeDrill([{ id: 'ch_a', team: 'home', x: 100, y: 100 }], '5m'));
    const c = container.querySelector(`circle[r="${RING_5M_R_PX}"]:not([cx])`);
    expect(c).not.toBeNull();
    const follower = c!.parentElement!.parentElement!;
    expect(follower.getAttribute('transform')).toBe(`translate(${BALL.x.toFixed(2)} ${BALL.y.toFixed(2)}) rotate(0.00)`);
  });

  it('**공 두 개가 서로 다른 원을 갖는다**', () => {
    const base = makeDrill([{ id: 'ch_a', team: 'home', x: 100, y: 100 }], '3m');
    const two: Drill = {
      ...base,
      cast: { ...base.cast, balls: [{ id: 'bl_1' as BallId, ring: '3m' }, { id: 'bl_2' as BallId, ring: '5m' }] },
      steps: [{ ...base.steps[0]!, balls: { bl_1: BALL, bl_2: { x: BALL.x + 200, y: BALL.y } } }],
    };
    const { container } = mount(two);
    expect(container.querySelectorAll(`circle[r="${RING_R_PX}"]:not([cx])`)).toHaveLength(2);
    expect(container.querySelectorAll(`circle[r="${RING_5M_R_PX}"]:not([cx])`)).toHaveLength(2);
  });
});

// ── 2026-08-13 — 판정이 **차체 사각형**으로 바뀌었다(model/chairOverlap.ts) ────────────────────
// 시연은 `applyFrame` 이 `rulePoses[c.id] = c` 로 **RenderChair 객체를 그대로** 넘긴다. 거기서
// theta 를 떨어뜨리면(예: `{x: c.x, y: c.y}` 로 다시 싸면) 타입은 그대로 통과하고 시연만
// "언제나 +x 를 보는 차체" 로 판정한다 — 그 통로를 아래 두 단언이 직접 찌른다.
describe('PresentStage — 차체 **방향**이 판정까지 온다', () => {
  /** 좌표는 완전히 같고 **각도만** 다른 두 드릴. 홈 한 대를 공에서 피벗 100 px(4 m) 에 둔다. */
  const rotated = (deg: number): Drill =>
    makeDrill([
      { id: 'ch_a', team: 'home', x: BALL.x + 100, y: BALL.y, deg },
      { id: 'ch_b', team: 'home', x: BALL.x + 10, y: BALL.y },
      { id: 'ch_c', team: 'away', x: BALL.x + 20, y: BALL.y },
    ]);

  it('공을 마주 보면(180°) 앞범퍼 1.2 m 가 3 m 안에 닿아 붉어지고 발표된다', () => {
    const { container } = mount(rotated(180));
    expect(ring(container)!.state.getAttribute('stroke')).toBe(RULE_ALERT_STROKE);
    expect(announced()).toContain('2-on-1');
  });

  it('★ 같은 좌표에서 등을 돌리면(0°) 깨끗하다 — 방향이 안 오면 두 결과가 같아진다', () => {
    const { container } = mount(rotated(0));
    expect(ring(container)!.state.getAttribute('stroke')).toBe(RULE_OK_STROKE);
    expect(announced()).toBe('');
  });
});

describe('PresentStage — 골 지역 3인도 같은 배선을 탄다', () => {
  it('한 팀 3명이 골 지역에 있으면 표시가 켜지고 발표된다', () => {
    // 좌표는 COURT_DEFS 에서 파생한다(리터럴 금지 — 5.1 이 코트 규격을 3단으로 늘릴 때
    // 리터럴을 두면 이 테스트가 코트 변경의 대리 빨간불이 된다).
    const gz = COURT_DEFS.full.ruleZones[0]!;
    const { container } = mount(
      makeDrill([
        { id: 'ch_a', team: 'away', x: gz.x + 20, y: gz.y + 20 },
        { id: 'ch_b', team: 'away', x: gz.x + 50, y: gz.y + 60 },
        { id: 'ch_c', team: 'away', x: gz.x + 80, y: gz.y + 100 },
      ]),
    );
    expect(announced()).toContain('골 지역');
    expect(announced()).toContain('블루');
    // 존 표시 그룹(사각 2개짜리)이 나타나 있다.
    const marks = Array.from(container.querySelectorAll('g[opacity="1"]')).filter((el) => el.querySelector('rect'));
    expect(marks.length).toBeGreaterThan(0);
  });
});
