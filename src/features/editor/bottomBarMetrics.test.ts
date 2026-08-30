// 드래그 재정렬 순수 함수 검증. 옛 '하단 바 치수(§5.2)' 절은 2026-08-18 하단 바 폐지와 함께
// 은퇴했다(bottomBarMetrics.ts 머리말) — 남은 것은 StepSidebar 재정렬의 판정·미리보기 식이다.
import { describe, expect, it } from 'vitest';
import {
  dropIndexAt,
  dropIndexInRest,
  movedOrder,
  movedOrderGroup,
} from './bottomBarMetrics.ts';
import { createDrill } from '../../model/defaults.ts';
import { duplicateStep, moveStep, moveSteps } from '../../model/edits.ts';

describe('끌어 놓을 자리 판정 (dropIndexAt)', () => {
  const centers = [35, 115, 195]; // 칩 폭 70 · 간격 10

  it('자기 자신은 세지 않는다 — 손을 대자마자 옆칸으로 튀지 않게', () => {
    expect(dropIndexAt(centers, 40, 0)).toBe(0); // 자기 중심(35)을 갓 지났어도 제자리
    expect(dropIndexAt(centers, 200, 2)).toBe(2);
  });

  it('다른 칩의 중심을 넘어야 그 자리가 된다', () => {
    expect(dropIndexAt(centers, 114, 0)).toBe(0);
    expect(dropIndexAt(centers, 116, 0)).toBe(1);
    expect(dropIndexAt(centers, 196, 0)).toBe(2);
  });

  it('왼쪽으로 끌 때도 같은 규칙이다', () => {
    expect(dropIndexAt(centers, 34, 2)).toBe(0);
    expect(dropIndexAt(centers, 36, 2)).toBe(1);
  });

  it('줄 밖으로 나가도 양끝에서 멈춘다', () => {
    expect(dropIndexAt(centers, -9999, 1)).toBe(0);
    expect(dropIndexAt(centers, 9999, 1)).toBe(2);
    expect(dropIndexAt([], 10, 0)).toBe(0);
  });
});

// ⑤ 다중 선택 일괄 이동 전용 — dropIndexAt 과 상한이 다르다는 것 자체가 이 함수가 있는
// 이유다(그 함수 머리말). M 개 중심에 대해 유효 자리는 0..M(포함) 이다.
describe('묶음 끌어 놓을 자리 판정 (dropIndexInRest) — dropIndexAt 과 상한이 다르다', () => {
  const centers = [35, 115, 195]; // 나머지(비선택) 3개의 중심

  it('맨 끝(= centers.length)까지 닿는다 — dropIndexAt 이었다면 length-1 에서 막혔을 자리', () => {
    expect(dropIndexInRest(centers, 9999)).toBe(3); // centers.length, dropIndexAt 이면 2 에서 막힌다
  });

  it('맨 앞(0)·중간은 dropIndexAt 과 같은 규칙 — 자기 자신을 뺄 필요가 없을 뿐이다', () => {
    expect(dropIndexInRest(centers, -9999)).toBe(0);
    expect(dropIndexInRest(centers, 114)).toBe(1); // 두 번째 중심(115)을 아직 못 넘음
    expect(dropIndexInRest(centers, 116)).toBe(2); // 넘었다
  });

  it('빈 나머지(전량 선택)도 안전하다 — 유일한 자리는 0', () => {
    expect(dropIndexInRest([], 9999)).toBe(0);
  });
});

describe('미리보기 순서 (movedOrder)', () => {
  it('원본을 건드리지 않고 옮긴 배열을 준다', () => {
    const src = ['a', 'b', 'c', 'd'];
    expect(movedOrder(src, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(movedOrder(src, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
    expect(src).toEqual(['a', 'b', 'c', 'd']);
  });

  it('범위 밖·제자리는 그대로다', () => {
    const src = ['a', 'b'];
    expect(movedOrder(src, 1, 1)).toEqual(src);
    expect(movedOrder(src, -1, 0)).toEqual(src);
    expect(movedOrder(src, 0, 5)).toEqual(src);
  });

  it('**커밋(edits.moveStep)과 같은 순서를 낸다** — 미리보기와 결과가 갈라지면 손을 뗄 때 판이 튄다', () => {
    let d = createDrill({ courtMode: 'full' });
    d = duplicateStep(d, 0);
    d = duplicateStep(d, 1);
    d = duplicateStep(d, 2); // 4장
    for (const [from, to] of [
      [0, 3],
      [3, 0],
      [1, 2],
      [2, 1],
    ] as const) {
      const preview = movedOrder(d.steps, from, to).map((s) => s.id);
      const committed = moveStep(d, from, to).steps.map((s) => s.id);
      expect(preview, `${from}→${to}`).toEqual(committed);
    }
  });
});

// ⑤ 다중 선택 일괄 이동(기현님 확정 2026-08-17) — movedOrder/moveStep 대조와 같은 이유로
// movedOrderGroup(미리보기)과 moveSteps(edits.ts, 커밋)를 직접 대조한다. 좌표계가
// movedOrder 와 다르다는 것 자체가 이 함수의 핵심이라 그 대조도 별도로 둔다.
describe('묶음 미리보기 순서 (movedOrderGroup)', () => {
  it('선택 묶음을 나머지 사이 자리(toIndex)에 상대 순서 보존한 채로 꽂는다', () => {
    const src = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id }));
    // b,d 선택 → 나머지는 a,c,e. toIndex 1(= a 다음, c 앞)에 꽂으면 a,[b,d],c,e.
    expect(movedOrderGroup(src, new Set(['b', 'd']), 1).map((s) => s.id)).toEqual(['a', 'b', 'd', 'c', 'e']);
    // toIndex 0(맨 앞)
    expect(movedOrderGroup(src, new Set(['b', 'd']), 0).map((s) => s.id)).toEqual(['b', 'd', 'a', 'c', 'e']);
    // toIndex 3(나머지 끝 = 맨 뒤)
    expect(movedOrderGroup(src, new Set(['b', 'd']), 3).map((s) => s.id)).toEqual(['a', 'c', 'e', 'b', 'd']);
  });

  it('빈 선택·범위 밖 toIndex 는 안전하게 clamp 되거나 원본과 같은 순서다', () => {
    const src = ['a', 'b'].map((id) => ({ id }));
    expect(movedOrderGroup(src, new Set(), 0).map((s) => s.id)).toEqual(['a', 'b']);
    expect(movedOrderGroup(src, new Set(['a']), 99).map((s) => s.id)).toEqual(['b', 'a']); // clamp → 나머지 끝
  });

  it('**커밋(edits.moveSteps)과 같은 순서를 낸다** — 미리보기와 결과가 갈라지면 손을 뗄 때 판이 튄다', () => {
    let d = createDrill({ courtMode: 'full' });
    d = duplicateStep(d, 0);
    d = duplicateStep(d, 1);
    d = duplicateStep(d, 2); // 4장: A B C D
    const ids = d.steps.map((s) => s.id);
    const groupIds = new Set([ids[0]!, ids[2]!]); // A, C 선택(흩어져 있다) — 뭉쳐야 한다
    for (const toIndex of [0, 1, 2]) {
      const preview = movedOrderGroup(d.steps, groupIds, toIndex).map((s) => s.id);
      const committed = moveSteps(d, [...groupIds], toIndex).steps.map((s) => s.id);
      expect(preview, `toIndex=${toIndex}`).toEqual(committed);
    }
  });
});
