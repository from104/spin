// §4.3 P1-2 — 2단 히트(엄격 → 관대).
//
// 무엇을 재는가: 1차 패스는 **지금까지와 완전히 같고**, 1차가 아무것도 반환하지 않았을 때만
// 같은 우선순위 표를 화면 기준 히트 타깃(기본 44 CSS px = 반경 22/s 월드)으로 한 번 더 훑는다.
//
// ⚠️ 1차 패스의 계약은 `src/render/hitTest.contract.test.ts` 가 갖고 있고, 그 파일은
// **한 줄도 바뀌지 않는 것이 이 작업의 완료 판정**이라 여기서 건드리지 않는다(그래서 새
// 단언을 그 파일에 얹지 않고 이 파일을 따로 뒀다). 특히 그 파일 첫 it
// ('저배율에서 공이 가드 앞 8px 에 있어도 차체 내부 탭은 휠체어를 반환한다')이 §6.5 blocker 를
// 밟지 않는 근거인데, 여기 '(b)' 가 **왜** 안 밟는지까지 못박는다 — 2차 반경이 작아서가
// 아니라 1차가 이미 답했기 때문이다.
import { describe, expect, it } from 'vitest';
import { INTERACT } from '../core/constants.ts';
import type { BallId, ChairId, ConeId, NoteId } from '../core/ids.ts';
import type { ChairPose } from '../model/chair.ts';
import { forgivingRadius, hitTest } from './hitTest.ts';
import type { HitContext, SceneSnapshot, ToolId } from './hitTest.ts';

const chairId = (n: number) => `ch_p${n}` as ChairId;
const ballId = (n: number) => `bl_p${n}` as BallId;
const coneId = (n: number) => `cn_p${n}` as ConeId;
const noteId = (n: number) => `nt_p${n}` as NoteId;

/** 실측 배율 분포(7인치 0.663 / narrow 0.891 / PC 1.151)보다 더 축소한 값. 2차 패스가
 *  실제로 일하는 구간이 저배율이므로 그쪽에서 잰다. 반경은 44/2/0.4 = **55 월드 px**. */
const S = 0.4;
const FORGIVING_R = 55;

const baseCtx: HitContext = {
  zones: { sTowRearMax: 0.12, sSpinMin: 0.32, sTowFrontMin: 0.85, grabPadPx: 10 },
  pxPerUnit: S,
  pointerType: 'touch',
  selectedChairId: null,
  selectedArrowId: null,
  handlesVisible: false,
  tool: 'select',
};

const emptyScene = (): SceneSnapshot => ({ chairs: [], balls: [], cones: [], notes: [], arrows: [] });

const ALL_TOOLS: ToolId[] = ['select', 'line', 'line', 'ball', 'cone', 'player', 'note', 'erase'];

describe('2차 패스가 열어 주는 것 (§4.3 P1-2)', () => {
  it('(a) 빈 곳에서 40px 떨어진 공을 탭하면 공이 잡힌다', () => {
    const id = ballId(1);
    const scene: SceneSnapshot = { ...emptyScene(), balls: [{ id, p: { x: 100, y: 100 } }] };
    const tap = { x: 140, y: 100 }; // 40 월드 px

    // 1차 패스로는 못 잡는다는 것부터 검산한다 — 이게 아니면 (a)는 아무것도 증명하지 않는다.
    // 공의 1차 반경 = min(4.125 + 6/0.4, 11.25) = 11.25.
    expect(hitTest(tap, scene, { ...baseCtx, tool: 'erase' })).toBeNull();

    expect(forgivingRadius(baseCtx)).toBeCloseTo(FORGIVING_R, 9);
    expect(hitTest(tap, scene, baseCtx)).toEqual({ kind: 'ball', id });
  });

  it('2차 반경 밖(55px 초과)은 여전히 빈 코트다 — 선택 해제가 살아 있다', () => {
    const scene: SceneSnapshot = { ...emptyScene(), balls: [{ id: ballId(1), p: { x: 100, y: 100 } }] };
    expect(hitTest({ x: 100 + FORGIVING_R + 0.5, y: 100 }, scene, baseCtx)).toBeNull();
    expect(hitTest({ x: 100 + FORGIVING_R - 0.5, y: 100 }, scene, baseCtx)).not.toBeNull();
  });

  it('차체 hull + grabPadPx 밖에서도 휠체어가 잡힌다(우선순위 5 의 패드가 커진다)', () => {
    const id = chairId(1);
    const pose: ChairPose = { x: 0, y: 0, theta: 0 };
    const scene: SceneSnapshot = { ...emptyScene(), chairs: [{ id, pose }] };
    // 차체 반폭 12.5 + grabPad 10 = 22.5 가 1차 한계. 그 밖 27.5 를 옆에서 탭한다.
    const tap = { x: 0, y: 27.5 };
    expect(hitTest(tap, scene, { ...baseCtx, tool: 'erase' })).toBeNull();
    expect(hitTest(tap, scene, baseCtx)).toMatchObject({ kind: 'chair', id });
  });

  it('2차 패스도 **같은 우선순위 표**를 쓴다 — 공/콘/메모가 휠체어보다 앞선다', () => {
    // 채택한 절충이다: 1차가 이미 "차체 안도 hull+패드 안도 아니다" 라고 답한 뒤에만 도는
    // 패스라, 그 지점에서 공을 먼저 주는 편이 "빗나갔다" 보다 낫다. 우선순위를 거리순으로
    // 뒤집으면 §5.12 표가 두 개가 된다.
    const chair = chairId(1);
    const ball = ballId(1);
    const scene: SceneSnapshot = {
      ...emptyScene(),
      chairs: [{ id: chair, pose: { x: 0, y: 0, theta: 0 } }],
      balls: [{ id: ball, p: { x: 0, y: 60 } }],
    };
    const tap = { x: 0, y: 30 }; // 차체 옆 30(=hull+pad 밖), 공에서 30
    expect(hitTest(tap, scene, { ...baseCtx, tool: 'erase' })).toBeNull();
    expect(hitTest(tap, scene, baseCtx)).toEqual({ kind: 'ball', id: ball });
  });
});

describe('2차 패스가 **돌지 않는** 것 (§4.3 P1-2 [A-2])', () => {
  it('(b) 차체 내부 탭 + 가드 앞 8px 공 → 여전히 휠체어. 2차가 작아서가 아니라 아예 안 돌아서다', () => {
    const chair = chairId(1);
    const ball = ballId(1);
    const pose: ChairPose = { x: 0, y: 0, theta: 0 };
    const scene: SceneSnapshot = {
      ...emptyScene(),
      chairs: [{ id: chair, pose }],
      balls: [{ id: ball, p: { x: 38, y: 0 } }], // 앞끝(30)에서 8px 더 나간 지점
    };
    const ctx: HitContext = { ...baseCtx, pxPerUnit: 0.25 };
    const tap = { x: 15, y: 0 }; // 차체 안쪽. 공과는 23px.

    expect(hitTest(tap, scene, ctx)).toMatchObject({ kind: 'chair', id: chair });

    // 여기가 핵심이다: 2차 반경은 88 이라 **공을 삼키고도 남는다**(23 ≪ 88). 그런데도 휠체어가
    // 나온 이유는 1차가 이미 답했기 때문이다 — 같은 탭에서 휠체어만 치우면 공이 잡힌다.
    expect(forgivingRadius(ctx)).toBeCloseTo(44 / 2 / 0.25, 9);
    expect(forgivingRadius(ctx)!).toBeGreaterThan(23);
    expect(hitTest(tap, { ...scene, chairs: [] }, ctx)).toEqual({ kind: 'ball', id: ball });
  });

  it('(c) select 가 아닌 도구는 2차 패스 자체가 없다 — 지우개가 22 CSS px 반경 파괴 도구가 되지 않는다', () => {
    for (const tool of ALL_TOOLS) {
      const r = forgivingRadius({ ...baseCtx, tool });
      if (tool === 'select') expect(r).toBeCloseTo(FORGIVING_R, 9);
      else expect(r).toBeNull(); // = 2차 패스 호출 0회
    }
  });

  it('(c) 지우개는 1차 패스만 본다 — 40px 떨어진 공은 지워지지 않고, 위에 놓인 공은 지워진다', () => {
    const id = ballId(1);
    const scene: SceneSnapshot = { ...emptyScene(), balls: [{ id, p: { x: 100, y: 100 } }] };
    const erase: HitContext = { ...baseCtx, tool: 'erase' };
    // 파괴적 동작에 수식키를 요구하는 규칙(WCAG 2.1.4)과 정면 충돌하므로 여기는 null 이어야 한다.
    expect(hitTest({ x: 140, y: 100 }, scene, erase)).toBeNull();
    // 그렇다고 지우개가 무뎌지면 안 된다 — 1차 반경(11.25) 안은 그대로 지워진다.
    expect(hitTest({ x: 108, y: 100 }, scene, erase)).toEqual({ kind: 'ball', id });
  });

  it('(d) 콘 도구는 2차 패스 안(44 CSS px)에 콘이 있어도 히트가 없다 — 나란히 놓을 수 있다', () => {
    const scene: SceneSnapshot = { ...emptyScene(), cones: [{ id: coneId(1), p: { x: 200, y: 200 } }] };
    const tap = { x: 220, y: 200 }; // 20 월드 px = 콘 1차 반경(8.75) 밖, 2차 반경(55) 안
    for (const tool of ['ball', 'cone', 'note', 'player'] as ToolId[]) {
      expect(hitTest(tap, scene, { ...baseCtx, tool })).toBeNull();
    }
    // select 였다면 잡혔을 자리라는 것까지 확인해야 (d)가 의미를 갖는다.
    expect(hitTest(tap, scene, baseCtx)).toEqual({ kind: 'cone', id: coneId(1) });
  });
});

describe('큰 터치 타깃 (§4.3 P1-2 [D-4])', () => {
  it('largeTargets 가 켜지면 2차 반경이 44 → 56 CSS px 로 간다', () => {
    const large: HitContext = { ...baseCtx, hitCssPx: INTERACT.hitTargetLargeCssPx };
    expect(forgivingRadius(large)).toBeCloseTo(56 / 2 / S, 9); // = 70 월드 px
    expect(forgivingRadius(large)!).toBeGreaterThan(forgivingRadius(baseCtx)!);
  });

  it('44 로는 빗나가는 거리가 56 에서는 잡힌다', () => {
    const id = ballId(1);
    const scene: SceneSnapshot = { ...emptyScene(), balls: [{ id, p: { x: 100, y: 100 } }] };
    const tap = { x: 160, y: 100 }; // 60 월드 px: 55 밖, 70 안
    expect(hitTest(tap, scene, baseCtx)).toBeNull();
    expect(hitTest(tap, scene, { ...baseCtx, hitCssPx: INTERACT.hitTargetLargeCssPx })).toEqual({ kind: 'ball', id });
  });

  it('큰 터치 타깃도 1차 패스는 건드리지 않는다 — 지우개는 켜도 그대로다', () => {
    const scene: SceneSnapshot = { ...emptyScene(), balls: [{ id: ballId(1), p: { x: 100, y: 100 } }] };
    const tap = { x: 160, y: 100 };
    expect(hitTest(tap, scene, { ...baseCtx, tool: 'erase', hitCssPx: INTERACT.hitTargetLargeCssPx })).toBeNull();
  });
});

describe('메모 상한 22 (§4.3 P1-2)', () => {
  it('저배율에서 메모의 1차 반경이 12.5 로 잘리지 않는다', () => {
    const id = noteId(1);
    const scene: SceneSnapshot = { ...emptyScene(), notes: [{ id, p: { x: 300, y: 300 } }] };
    // s=0.2 → 메모 1차 반경 = min(NOTE.hitRadiusPx + 6/0.2, 상한) = min(50, 22) = 22.
    // 옛 상한 12.5 였다면 잘렸다(자기 반지름은 §4.3 P1-5 로 0 → 20 이 됐지만 이 구간은 상한이 정한다).
    // 2차 패스가 답을 대신 내지 못하도록 **지우개**로 잰다(2차가 없는 도구다).
    const ctx: HitContext = { ...baseCtx, pxPerUnit: 0.2, tool: 'erase' };
    expect(hitTest({ x: 315, y: 300 }, scene, ctx)).toEqual({ kind: 'note', id }); // 15px — 옛 상한이면 빗나갔다
    expect(hitTest({ x: 323, y: 300 }, scene, ctx)).toBeNull(); // 23px — 새 상한 밖
  });
});
