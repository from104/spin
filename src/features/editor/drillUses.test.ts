// §3 불변식 3 의 **핵심 성질**: 판단 기준이 현재 스텝이 아니라 드릴 전체다.
//
// 왜 따로 있나 — 2026-08-12 3차 검증관이 `drill.steps.some(...)` 를 `drill.steps[0]` 로 좁혀
// 보니 **1623 테스트가 전건 초록불**이었다. ToolRail 쪽 테스트는 `drillUses` 를 prop 으로
// 받으므로 이 성질을 볼 수 없고, 배선을 끊는 반증은 '전체 vs 첫 스텝' 을 구분하지 못한다.
// 여기 있는 것은 그 한 줄에 닿는 유일한 단언이다.
import { describe, expect, it } from 'vitest';
import { createDrill } from '../../model/defaults.ts';
import type { Drill, DrillStep } from '../../model/drill.ts';
import { drillUsesOf } from './drillUses.ts';

/** 화살표·메모를 지정한 스텝에만 심은 판. 나머지 스텝은 비어 있다. */
function drillWith(o: { arrowsAt?: number; notesAt?: number; steps?: number }): Drill {
  const base = createDrill({ courtMode: 'full', formation: '1-2-1' });
  const step0 = base.steps[0]!;
  const blank: DrillStep = { ...step0, arrows: [], notes: [] };
  const n = o.steps ?? 4;
  const steps: DrillStep[] = [];
  for (let i = 0; i < n; i++) {
    steps.push({
      ...blank,
      id: `${blank.id}_${i}` as DrillStep['id'],
      arrows: i === o.arrowsAt ? [...step0.arrows, ...(step0.arrows.length ? [] : [])] : [],
      notes: [],
    });
  }
  // 화살표·메모는 모양이 아니라 **개수**만 보므로, 최소 객체 하나면 성질이 성립한다.
  if (o.arrowsAt !== undefined) steps[o.arrowsAt] = { ...steps[o.arrowsAt]!, arrows: [{} as never] };
  if (o.notesAt !== undefined) steps[o.notesAt] = { ...steps[o.notesAt]!, notes: [{} as never] };
  return { ...base, steps };
}

describe('drillUsesOf — 현재 스텝이 아니라 드릴 전체를 본다 (§3 불변식 3)', () => {
  it('★ 3번 스텝에만 화살표가 있어도 작도를 쓰는 드릴이다', () => {
    // 이 단언이 이 파일의 존재 이유다. `steps[0]` 로 좁히면 여기만 빨간불이 된다.
    expect(drillUsesOf(drillWith({ arrowsAt: 3 })).draw).toBe(true);
  });

  it('★ 마지막 스텝에만 메모가 있어도 설명을 쓰는 드릴이다', () => {
    expect(drillUsesOf(drillWith({ notesAt: 3 })).note).toBe(true);
  });

  it('첫 스텝에 있을 때도 물론 참이다 — 위 두 it 이 "뒤쪽만 본다" 인 구현으로 헛통과하지 않게', () => {
    expect(drillUsesOf(drillWith({ arrowsAt: 0 })).draw).toBe(true);
    expect(drillUsesOf(drillWith({ notesAt: 0 })).note).toBe(true);
  });

  it('대조군: 아무 스텝에도 없으면 거짓이다 — "무엇을 넣어도 참" 인 구현을 막는다', () => {
    const uses = drillUsesOf(drillWith({}));
    expect(uses.draw).toBe(false);
    expect(uses.note).toBe(false);
  });

  it('두 서랍은 서로 독립이다 — 화살표만 있는 드릴이 설명 서랍을 열지 않는다', () => {
    expect(drillUsesOf(drillWith({ arrowsAt: 2 }))).toEqual({ draw: true, note: false });
    expect(drillUsesOf(drillWith({ notesAt: 2 }))).toEqual({ draw: false, note: true });
  });

  it('스텝이 하나뿐인 판에서도 동작한다 — some 이 빈 배열에 걸려 던지지 않는다', () => {
    expect(drillUsesOf(drillWith({ arrowsAt: 0, steps: 1 })).draw).toBe(true);
    expect(drillUsesOf({ steps: [] })).toEqual({ draw: false, note: false });
  });
});
