// §5.2 하단 바 치수 — 예산 표의 '하단 바' 행을 만드는 식 그 자체.
//
// 두 층으로 갈라 둔다(2.4 가 트레이에서 쓴 방법과 같다): **픽셀 식**은 여기서 §5.2 표를
// 재현하고, **CSS 문자열**은 DOM 테스트가 리터럴로 다시 적어 대조한다. jsdom 은 calc(var())
// 를 계산하지 못하므로 한 층만 두면 둘 중 하나가 조용히 갈라진다.
import { describe, expect, it } from 'vitest';
import { BOTTOM_BAR_PAD_PX, boardBarHeightPx, bottomBarPadCss, dropIndexAt, movedOrder, transportBarHeightPx } from './bottomBarMetrics.ts';
import { createDrill } from '../../model/defaults.ts';
import { addStepAfter, moveStep } from '../../model/edits.ts';

describe('하단 바 높이 (§5.2)', () => {
  it('완료 판정: 트랜스포트 바는 64 이하다 — 재편 전 94 에서 30 을 돌려준다', () => {
    // 2.3 의 세로 예산 132 = 헤더 52 + 하단 바 64 + 래퍼 패딩 16. 이 행만 넘겨도 판이 줄어든다.
    expect(transportBarHeightPx(44)).toBe(64);
    expect(transportBarHeightPx(44)).toBeLessThanOrEqual(64);
  });

  it('전술판 바는 재생 버튼이 없어 60 이다 — 예산 행은 둘 중 큰 쪽(64)이다', () => {
    expect(boardBarHeightPx(44)).toBe(60);
    expect(boardBarHeightPx(44)).toBeLessThan(transportBarHeightPx(44));
    expect(Math.max(transportBarHeightPx(44), boardBarHeightPx(44))).toBe(64);
  });

  it('큰 터치 타깃(--hit 56)이면 함께 자란다 — 예산 행은 기본값(44) 기준이다', () => {
    // 설정으로 켠 12px 은 사용자가 고른 값이라 예산 위반이 아니다(트레이 93→117 과 같은 규칙).
    expect(transportBarHeightPx(56)).toBe(76);
    expect(transportBarHeightPx(56) - transportBarHeightPx(44)).toBe(12);
  });

  it('패딩 문자열이 픽셀 식과 같은 숫자를 쓴다', () => {
    expect(bottomBarPadCss()).toBe('7px 24px 8px');
    expect(BOTTOM_BAR_PAD_PX.top + BOTTOM_BAR_PAD_PX.bottom).toBe(15);
    // 높이 = border 1 + 패딩 15 + 내용(--hit + 4).
    expect(transportBarHeightPx(44)).toBe(1 + BOTTOM_BAR_PAD_PX.top + (44 + 4) + BOTTOM_BAR_PAD_PX.bottom);
  });
});

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
    d = addStepAfter(d, 0);
    d = addStepAfter(d, 1);
    d = addStepAfter(d, 2); // 4장
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
