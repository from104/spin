// 카드 홈 격자의 **산술**만 본다 — 카드 내용·배지·앵커는 `RulesScreen.test.tsx` 담당.
//
// 기현님 지시(2026-08-31)는 "3×3, 카드 폭 2/3" 이었다. 그런데 열 수는 코드 어디에도 `3` 이라고
// 적혀 있지 않다 — `auto-fit` 이 **콘텐츠 폭**·최소폭·간격에서 계산한다. 하나만 움직여도 4열이나
// 2열이 되는데 타입도 렌더도 안 깨진다. 그 산술을 여기서 잰다.
//
// ⚠️ 이 파일의 첫 판은 틀렸었고, 그 틀린 방식이 이 파일이 지금 이렇게 생긴 이유다.
// 처음엔 `columnsAt(GRID_MAX_PX)` 로 **상수에서** 열 수를 계산했다. 그런데 `tokens.css` 의 전역
// `box-sizing: border-box` 때문에 max-width 안에는 좌우 패딩이 들어 있어서, 열이 실제로 받는
// 폭은 그보다 60px 좁았다 — 화면은 2열인데 테스트는 3을 계산하고 초록이었다.
// **코드와 테스트가 같은 전제(패딩을 빼지 않는다)를 공유하면 돌연변이 검사로도 안 잡힌다.**
// 그래서 지금은 상수가 아니라 **렌더된 style 에서 읽은 값**으로 콘텐츠 폭을 되계산한다.
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { RulesHome, CARD_MIN_PX, GRID_GAP_PX, GRID_CONTENT_PX } from './RulesHome.tsx';
import { ruleTopicsFor } from './ruleTopics.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';

/** `repeat(auto-fit, minmax(min, 1fr))` 이 폭 `content` 안에 세우는 열 수 — n 열은
 *  n·min + (n−1)·gap ≤ content 일 때 선다(CSS 사양). jsdom 은 레이아웃을 안 하므로
 *  브라우저가 할 계산을 재현한다. */
const columnsIn = (content: number) => Math.max(1, Math.floor((content + GRID_GAP_PX) / (CARD_MIN_PX + GRID_GAP_PX)));

/** 렌더된 격자에서 **열이 실제로 나눠 갖는 폭**을 읽어 낸다 — border-box 이므로 max-width 에서
 *  좌우 패딩을 빼야 한다. 상수를 그대로 믿지 않는 것이 이 헬퍼의 존재 이유다. */
function renderedContentWidth(): number {
  const { container } = render(
    <SettingsProvider>
      <RulesHome topics={ruleTopicsFor('ko')} onOpen={() => {}} />
    </SettingsProvider>,
  );
  const grid = container.querySelector('[data-tut="rules-home"]') as HTMLElement;
  const px = (v: string) => Number.parseFloat(v || '0');
  return px(grid.style.maxWidth) - px(grid.style.paddingLeft) - px(grid.style.paddingRight);
}

describe('RulesHome — 3×3 격자', () => {
  it('렌더된 폭에서 정확히 3열이다 — 9장이 3줄로 떨어진다', () => {
    const content = renderedContentWidth();
    expect(columnsIn(content)).toBe(3);
    expect(ruleTopicsFor('ko')).toHaveLength(9); // 3열 × 3줄이 성립하는 전제
  });

  it('style.maxWidth 가 패딩을 포함한다 — 콘텐츠 폭과 같으면 한 열이 잘린다', () => {
    // 2026-08-31 실제 결함: max-width 를 콘텐츠 폭(800)으로 두어 열이 740 만 받고 2열이 됐다.
    const content = renderedContentWidth();
    expect(content).toBe(GRID_CONTENT_PX);
    expect(columnsIn(GRID_CONTENT_PX - 60)).toBe(2); // 패딩을 빼먹었을 때의 결과를 못 박아 둔다
  });

  it('콘텐츠 폭을 조금만 올려도 4열이 된다 — 폭이 열 수를 정한다는 사실 자체를 못 박는다', () => {
    // 4열 문턱 = 4·240 + 3·14 = 1002. 옛 배치(상한 1180, 패딩 60 → 콘텐츠 1120)가 이 위였다.
    expect(columnsIn(1002)).toBe(4);
    expect(GRID_CONTENT_PX).toBeLessThan(1002);
  });

  it('창이 좁아지면 2열 → 1열로 접힌다 (열 수를 3으로 고정하지 않은 이유)', () => {
    expect(columnsIn(747)).toBe(2); // 3열 문턱 3·240+2·14 = 748 바로 아래
    expect(columnsIn(493)).toBe(1); // 2열 문턱 2·240+14 = 494 바로 아래
  });

  it('카드 한 장이 옛 4열 시절보다 좁다 — "폭을 2/3 으로"', () => {
    const cardIn = (content: number, cols: number) => (content - GRID_GAP_PX * (cols - 1)) / cols;
    const before = cardIn(1120, 4); // 옛 배치: 상한 1180 − 패딩 60 = 콘텐츠 1120, auto-fill 4열
    const after = cardIn(GRID_CONTENT_PX, 3);
    expect(after).toBeLessThan(before);
    // 열만 3으로 바꾸고 폭을 안 줄였다면 오히려 **넓어졌을** 자리다.
    expect(after).toBeLessThan(cardIn(1120, 3));
  });

  it('열 수를 하드코딩하지 않는다 — repeat(3, …) 이면 좁은 창에서 카드가 눌린다', () => {
    const { container } = render(
    <SettingsProvider>
      <RulesHome topics={ruleTopicsFor('ko')} onOpen={() => {}} />
    </SettingsProvider>,
  );
    const grid = container.querySelector('[data-tut="rules-home"]') as HTMLElement;
    expect(grid.style.display).toBe('grid');
    expect(grid.style.gridTemplateColumns).toContain('auto-fit');
    expect(grid.style.gridTemplateColumns).not.toContain('repeat(3');
  });
});
