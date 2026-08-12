// §3.11 — CourtDef.desc 되살리기.
//
// desc 는 렌더 참조 0건인 죽은 데이터 3줄이었다. BoardBar 가 되살리되 두 가지를 지켜야 한다:
//   ① **공존** — pristine 잠금 사유 문구와 같은 자리를 다투면 안 된다(딴 줄로 둘 다 보인다).
//   ② **예산 132 불변** — 문구 때문에 바(60)가 자라면 안 된다. 행 높이는 버튼(--hit)이
//      정하므로, 문구 두 줄의 합 ≤ --hit 이면 바 높이는 문구와 무관하다. 그 보증이
//      nowrap+ellipsis 다 — jsdom 은 실높이를 못 재니 **식(barHintStackPx)과 스타일 문자열**
//      두 층으로 나눠 붙잡는다(bottomBarMetrics.test 의 방법 그대로).
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { BoardBar } from './BoardBar.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { COURT_DEFS, COURT_MODES } from '../../model/court.ts';
import type { CourtMode } from '../../model/court.ts';
import { BAR_HINT_FONT_PX, BAR_HINT_GAP_PX, barHintStackPx, boardBarHeightPx } from './bottomBarMetrics.ts';

const wrapper = ({ children }: { children: ReactNode }) => <SettingsProvider>{children}</SettingsProvider>;

const renderBar = (courtMode: CourtMode, courtLocked: boolean) =>
  render(<BoardBar courtMode={courtMode} courtLocked={courtLocked} onReset={() => {}} onResetGoals={() => {}} />, { wrapper });

const LOCKED_HINT = '코트 형태를 바꾸려면 먼저 코트를 비우세요 — 풀 코트와 하프 코트는 규격이 달라 배치를 옮겨 담을 수 없습니다.';
const FREE_HINT = '지금은 코트 형태를 자유롭게 바꿀 수 있습니다.';

describe('BoardBar — CourtDef.desc 되살리기 (§3.11)', () => {
  it.each(COURT_MODES)('%s: 지금 코트의 desc 가 화면에 있다', (mode) => {
    renderBar(mode, false);
    expect(screen.getByText(COURT_DEFS[mode].desc)).toBeTruthy();
  });

  it('desc 는 모델의 그 문장이다 — 리터럴 대조(모델이 바뀌면 여기가 같이 울려야 한다)', () => {
    renderBar('full', false);
    // 소스 상수만 믿으면 desc 가 빈 문자열로 망가져도 통과한다(자기 사본 문제의 역방향).
    expect(screen.getByText(/4v4 전술 전개와 전환 훈련/)).toBeTruthy();
  });

  it('잠기면 desc 와 잠금 사유가 **둘 다** 있다 — 조건을 따로 찌른다: desc', () => {
    renderBar('half', true);
    expect(screen.getByText(COURT_DEFS.half.desc)).toBeTruthy();
  });

  it('잠기면 desc 와 잠금 사유가 **둘 다** 있다 — 조건을 따로 찌른다: 잠금 사유', () => {
    renderBar('half', true);
    expect(screen.getByText(LOCKED_HINT)).toBeTruthy();
  });

  it('안 잠기면 desc 와 자유 문구가 둘 다 있고, 잠금 사유는 없다', () => {
    renderBar('flat', false);
    expect(screen.getByText(COURT_DEFS.flat.desc)).toBeTruthy();
    expect(screen.getByText(FREE_HINT)).toBeTruthy();
    expect(screen.queryByText(LOCKED_HINT)).toBeNull();
  });

  it('두 문구는 딴 <p> 다 — 한 노드에 이어 붙이면 공존이 아니라 한 줄 병합이다', () => {
    renderBar('full', true);
    const desc = screen.getByText(COURT_DEFS.full.desc);
    const lock = screen.getByText(LOCKED_HINT);
    expect(desc).not.toBe(lock);
    expect(desc.tagName).toBe('P');
    expect(lock.tagName).toBe('P');
  });
});

describe('BoardBar — 문구가 바 높이를 못 건드린다 (예산 132 의 하단 바 행)', () => {
  it('픽셀 식: 문구 두 줄 합이 --hit(44) 이하다', () => {
    // ceil(11 × 1.45) × 2 + 2 = 34. 이게 44 를 넘는 날 바가 문구 때문에 자라기 시작한다.
    expect(barHintStackPx()).toBe(34);
    expect(barHintStackPx()).toBeLessThanOrEqual(44);
  });

  it('픽셀 식: 전술판 바는 여전히 60 이다 — desc 한 줄이 축척을 깎지 않았다', () => {
    expect(boardBarHeightPx(44)).toBe(60);
  });

  it('DOM: 두 줄 모두 nowrap+ellipsis 다 — 줄이 접히면 스택이 44 를 넘는다', () => {
    renderBar('full', true);
    for (const el of [screen.getByText(COURT_DEFS.full.desc), screen.getByText(LOCKED_HINT)]) {
      expect(el.style.whiteSpace, el.textContent!).toBe('nowrap');
      expect(el.style.overflow, el.textContent!).toBe('hidden');
      expect(el.style.textOverflow, el.textContent!).toBe('ellipsis');
      // 줄높이도 식과 같은 값이어야 barHintStackPx 의 산술이 화면과 맞는다.
      expect(el.style.lineHeight, el.textContent!).toBe('1.45');
      expect(el.style.fontSize, el.textContent!).toBe('0.6875rem'); // 리터럴로 다시 적는다
    }
    expect(0.6875 * 16).toBe(BAR_HINT_FONT_PX);
  });

  it('DOM: 문구 스택은 버튼과 **같은 행 안**이다 — 행 밖 블록이면 그만큼 바가 자란다', () => {
    renderBar('full', true);
    const stack = screen.getByText(COURT_DEFS.full.desc).parentElement!;
    expect(stack.style.gap).toBe(`${BAR_HINT_GAP_PX}px`);
    expect(stack.parentElement).toBe(screen.getByRole('button', { name: '코트 비우기' }).parentElement);
  });

  it('말줄임으로 잘려도 전문은 title 에 남는다', () => {
    renderBar('half', true);
    expect(screen.getByText(COURT_DEFS.half.desc).getAttribute('title')).toBe(COURT_DEFS.half.desc);
    expect(screen.getByText(LOCKED_HINT).getAttribute('title')).toBe(LOCKED_HINT);
  });
});
