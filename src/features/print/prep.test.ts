// §6.3 [A-1] 준비물의 **핵심 성질**: 선수는 전 스텝 pose 키의 합집합, 공·콘은 cast.
//
// 왜 순수 함수를 따로 재는가 — drillUses.ts 가 겪은 것과 같은 함정이다. `drill.steps.some(...)`
// 을 `drill.steps[0]` 로 좁혀도 마크업 테스트는 전건 초록불이 된다(첫 스텝에 8명이 다 서 있는
// 기본 판에서는 두 구현의 답이 같다). 아래 ★ 두 개가 그 한 줄에 닿는 유일한 단언이다.
import { describe, expect, it } from 'vitest';
import { createDrill } from '../../model/defaults.ts';
import type { Drill, DrillStep } from '../../model/drill.ts';
import type { ChairId } from '../../core/ids.ts';
import { maxPrep, prepFor, prepLine } from './prep.ts';

const POSE = { x: 100, y: 100, angleDeg: 0 };

/** 스텝마다 "cast.chairs 의 몇 번째가 코트에 서 있는가" 를 지정한 판. 공·콘은 안 놓는다 —
 *  놓지 않아도 cast 에 있으면 준비물에 들어야 한다는 것이 A-1 의 나머지 절반이다. */
function drillWithChairsAt(perStep: number[][]): Drill {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
  const step0 = base.steps[0]!;
  const steps: DrillStep[] = perStep.map((idxs, i) => ({
    ...step0,
    id: `${step0.id}_${i}` as DrillStep['id'],
    chairs: Object.fromEntries(idxs.map((k) => [base.cast.chairs[k]!.id, POSE])) as DrillStep['chairs'],
    balls: {},
    cones: {},
    arrows: [],
    notes: [],
  }));
  return { ...base, steps };
}

describe('prepFor — 선수는 전 스텝의 합집합이다 (A-1)', () => {
  it('★ 4번째 스텝에만 나오는 선수도 준비물에 든다', () => {
    // 이 단언이 이 파일의 존재 이유다. `steps[0]` 로 좁히면 여기만 빨간불이 된다 —
    // 그 구현은 코치를 훈련장에 사람 한 명 모자란 채로 보낸다.
    const prep = prepFor(drillWithChairsAt([[0], [0], [0], [0, 5]]));
    expect(prep.players).toBe(2);
  });

  it('★ 첫 스텝에만 나오는 선수도 든다 — "마지막 스텝만 본다" 인 구현으로 헛통과하지 않게', () => {
    expect(prepFor(drillWithChairsAt([[0, 5], [0], [0], [0]])).players).toBe(2);
  });

  it('중복은 한 번만 센다 — 8스텝 내내 서 있는 두 명은 2명이다', () => {
    expect(prepFor(drillWithChairsAt([[0, 1], [0, 1], [0, 1]])).players).toBe(2);
  });

  it('대조군: cast 에 있어도 **어느 스텝에도 없으면** 세지 않는다', () => {
    // 이게 A-1 이 정정한 실제 사고다: defaultCast() 는 courtMode 와 무관하게 늘 8대를 만들어,
    // `cast.chairs.length` 를 쓰면 하프 코트 6대 드릴에도 "선수 8명" 이 찍힌다.
    const drill = drillWithChairsAt([[0], [1]]);
    expect(drill.cast.chairs).toHaveLength(8);
    expect(prepFor(drill).players).toBe(2);
  });

  it('playerIds 는 cast 순서다 — 등장 순서가 아니다(명단과 종이가 어긋나면 안 된다)', () => {
    const drill = drillWithChairsAt([[5], [2], [0]]);
    const ids = drill.cast.chairs.filter((_, i) => [0, 2, 5].includes(i)).map((c) => c.id);
    expect(prepFor(drill).playerIds).toEqual(ids);
    expect(prepFor(drill).players).toBe(3);
  });

  it('cast 에 없는 pose 키(고아)는 세지 않는다 — 그릴 수 없는 선수를 세면 그림과 숫자가 갈린다', () => {
    const drill = drillWithChairsAt([[0]]);
    const ghost = { ...drill.steps[0]!, chairs: { ...drill.steps[0]!.chairs, ['ch_ghost' as ChairId]: POSE } };
    expect(prepFor({ ...drill, steps: [ghost] }).players).toBe(1);
  });

  it('스텝이 없어도 던지지 않는다', () => {
    const drill = drillWithChairsAt([[0]]);
    expect(prepFor({ steps: [], cast: drill.cast }).players).toBe(0);
  });
});

describe('prepFor — 공·콘은 cast 에서 온다 (A-1 나머지 절반)', () => {
  it('스텝에 한 번도 안 놓인 공·콘도 준비물이다 — 가방에는 들어 있어야 한다', () => {
    const drill = drillWithChairsAt([[0]]);
    const cast = {
      ...drill.cast,
      balls: [{ id: 'bl_a' as never }, { id: 'bl_b' as never }],
      cones: [
        { id: 'co_a' as never, colorIndex: 0 as const },
        { id: 'co_b' as never, colorIndex: 1 as const },
        { id: 'co_c' as never, colorIndex: 0 as const },
      ],
    };
    const prep = prepFor({ ...drill, cast });
    expect(prep.balls).toBe(2);
    expect(prep.cones).toBe(3);
  });

  it('대조군: cast 가 비면 0 이다 — "무엇을 넣어도 1개" 인 구현을 막는다', () => {
    const drill = drillWithChairsAt([[0]]);
    const prep = prepFor({ ...drill, cast: { ...drill.cast, balls: [], cones: [] } });
    expect(prep.balls).toBe(0);
    expect(prep.cones).toBe(0);
  });
});

describe('maxPrep — 세션 준비물은 합이 아니라 최대다', () => {
  it('드릴 셋의 최대를 항목별로 고른다', () => {
    const got = maxPrep([
      { players: 2, balls: 2, cones: 0 },
      { players: 4, balls: 1, cones: 6 },
      { players: 3, balls: 1, cones: 2 },
    ]);
    // 합(9/4/8)이 아니다 — 같은 공·콘을 드릴 사이에 다시 쓴다.
    expect(got).toEqual({ players: 4, balls: 2, cones: 6 });
  });

  it('대조군: 빈 목록은 0 이다', () => {
    expect(maxPrep([])).toEqual({ players: 0, balls: 0, cones: 0 });
  });
});

describe('prepLine — 0 인 항목은 아예 적지 않는다', () => {
  it('셋 다 있으면 셋 다 적는다', () => {
    expect(prepLine({ players: 6, balls: 1, cones: 4 })).toBe('선수 6명 · 공 1개 · 콘 4개');
  });

  it('콘이 없으면 "콘 0개" 를 적지 않는다', () => {
    expect(prepLine({ players: 6, balls: 1, cones: 0 })).toBe('선수 6명 · 공 1개');
  });

  it('대조군: 전부 0 이면 빈 문자열이다(호출부가 줄째로 뺀다)', () => {
    expect(prepLine({ players: 0, balls: 0, cones: 0 })).toBe('');
  });
});
