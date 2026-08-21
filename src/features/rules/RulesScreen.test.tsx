// 규칙 화면(2026-08-21 신설) 스모크 테스트 — 목록·상세·좁은 창 2뷰 전환.
// 보드 장면 자체는 `ruleScenes.test.ts`, 조항 도해는 `RuleFigure.test.tsx` 가 따로 본다 —
// 여기서는 "상세에 그것들이 실제로 붙어 나오는가" 만 확인한다.
import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RulesScreen } from './RulesScreen.tsx';
import { ruleContentFor } from './ruleContent.ts';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';

function renderRules() {
  return render(
    <SettingsProvider>
      <RulesScreen />
    </SettingsProvider>,
  );
}

/** jsdom 에는 matchMedia 가 없다 — 안 깔면 useIsNarrow 가 항상 넓은 쪽으로 굳는다
 *  (AppShell.wiring.test.tsx 의 같은 이름 헬퍼와 동일한 이유·구현). */
function stubMedia(narrow: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({
      matches: q.includes('max-width') ? narrow : false,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    }),
  });
}

describe('RulesScreen', () => {
  beforeEach(() => {
    window.localStorage.clear();
    stubMedia(false);
  });

  it('18개 조항이 전부 목록에 뜬다', () => {
    renderRules();
    const laws = ruleContentFor('ko');
    expect(laws).toHaveLength(18);
    for (const law of laws) {
      expect(screen.getByRole('button', { name: law.title })).toBeInTheDocument();
    }
  });

  it('기본값은 제1조가 선택되어 상세에 뜬다', () => {
    renderRules();
    expect(screen.getByRole('heading', { name: '제1조 — 필드' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '제1조 — 필드' })).toHaveAttribute('aria-current', 'true');
  });

  it('목록에서 다른 조항을 고르면 상세가 그 조항으로 바뀐다', async () => {
    renderRules();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '제10조 — 득점 방법' }));
    expect(screen.getByRole('heading', { name: '제10조 — 득점 방법' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '제10조 — 득점 방법' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: '제1조 — 필드' })).not.toHaveAttribute('aria-current');
  });

  it('도해가 있는 조항은 상세에 그림이 함께 붙는다', async () => {
    renderRules();
    const user = userEvent.setup();
    // 제1조(장면만) 에는 도해가 없고, 제2조(도해) 로 옮기면 그림이 나타난다 —
    // "조항마다 다른 것이 붙는다" 는 배선 자체를 잡는다.
    await user.click(screen.getByRole('button', { name: '제2조 — 공' }));
    const figures = screen.getAllByRole('img');
    expect(figures.length).toBeGreaterThan(0);
    expect(screen.getAllByText('33cm').length).toBeGreaterThan(0);
  });

  it('제4조(선수 장비)도 도해가 붙는다', async () => {
    renderRules();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: '제4조 — 선수 장비' }));
    expect(screen.getAllByRole('img').length).toBeGreaterThan(0);
    expect(screen.getByText('전진 10km/h')).toBeInTheDocument();
    expect(screen.getByText('후진 10km/h')).toBeInTheDocument();
  });

  it('좁은 창에서는 목록·상세가 한 번에 하나만 보이고, [목록으로]로 돌아간다', async () => {
    stubMedia(true);
    renderRules();
    const user = userEvent.setup();

    expect(screen.getByRole('navigation', { name: '규칙 조항 목록' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '제1조 — 필드' })).toBeNull();

    await user.click(screen.getByRole('button', { name: '제2조 — 공' }));
    expect(screen.queryByRole('navigation', { name: '규칙 조항 목록' })).toBeNull();
    expect(screen.getByRole('heading', { name: '제2조 — 공' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '← 목록으로' }));
    expect(screen.getByRole('navigation', { name: '규칙 조항 목록' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '제2조 — 공' })).toBeNull();
  });
});
