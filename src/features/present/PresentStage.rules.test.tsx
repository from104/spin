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
import { RING_R_PX } from '../../model/rules.ts';
import { COURT_DEFS } from '../../model/court.ts';
import { RULE_ALERT_STROKE, RULE_OK_STROKE } from '../../render/ruleOverlay.ts';
import { CURRENT_DRILL_SCHEMA, type Drill, type TeamSide } from '../../model/drill.ts';
import type { BallId, ChairId, DrillId, StepId } from '../../core/ids.ts';

const BALL = { x: 400, y: 260 };

/** 스텝 1장짜리 드릴. 좌표를 직접 적어 판정 조건을 눈으로 확인할 수 있게 한다. */
function makeDrill(chairs: { id: string; team: TeamSide; isGk?: boolean; x: number; y: number }[]): Drill {
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
      balls: [{ id: 'bl_1' as BallId }],
      cones: [],
    },
    steps: [
      {
        id: 'st_1' as StepId,
        name: '스텝 1',
        note: '',
        chairs: Object.fromEntries(chairs.map((c) => [c.id, { x: c.x, y: c.y, angleDeg: 0 }])),
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
 *  ⚠️ `cx` 가 **없는** 것으로 고른다: 지금 코트에는 반지름이 똑같이 75 인 원이 하나 더 있다
 *  (규정에 없는 센터 서클 — 계획서 §9-⑧ 이 5.3 에서 지우기로 확정했다). 링은 그룹 원점에
 *  그려지므로 cx/cy 를 갖지 않고, 센터 서클은 코트 중앙 좌표를 갖는다. */
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

  it('규칙 존을 끄면 링도 판정도 발화도 없다 — 스위치가 하나다', () => {
    const { container } = mount(VIOLATING, false);
    expect(ring(container)).toBeNull();
    expect(announced()).toBe('');
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

  it('[결정 ⑧] 아직 남아 있는 센터 서클과 반지름이 같다 — 그래서 시각 언어를 다르게 쓴다', () => {
    // 5.3 이 규정에 없는 센터 서클(실선 r=75)을 지울 때까지 두 원이 겹쳐 보이는 구간이 있다.
    // 규칙은 파선, 코트는 실선 — 이 차이가 그 구간을 견딘다.
    const { container } = mount(CLEAN);
    const center = container.querySelector(`circle[r="${RING_R_PX}"][cx]`)!;
    expect(center.getAttribute('stroke-dasharray')).toBeNull(); // 코트 = 실선
    expect(ring(container)!.state.getAttribute('stroke-dasharray')).toBe('8 6'); // 규칙 = 파선
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
