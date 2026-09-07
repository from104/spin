// [키 진단] — 이 창이 **관측 장치로 남아 있는가**만 잰다(2026-09-08, PLAN-HELP-OVERHAUL 결정 5).
//
// 지우면 새는 버그: ① 진단 창이 preventDefault 를 걸면 도움말을 열어 둔 동안 단축키가 통째로
// 죽는다 — "안 먹는다" 를 재려고 연 창이 안 먹게 만드는, 가장 나쁜 종류의 회귀다. ② 입력칸
// 포커스를 이유로 거르면 사용자가 겪는 바로 그 경우(조합 중)가 화면에 영영 안 뜬다.
// ③ 전역 층이 설정 게이트를 안 타면, 설정이 막아 둔 키를 "정의 있음" 으로 그려 원인을 찾으러
// 온 사람에게 정반대 답을 준다. 표시 문자열·레이아웃 자체는 재지 않는다.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { KeyDiagnostics } from './KeyDiagnostics.tsx';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { loadPrefs } from '../../storage/prefs.ts';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('KeyDiagnostics', () => {
  it('입력칸 포커스 중에도 기록하고, 사건을 가로채지 않으며, 닫으면 리스너를 뗀다', () => {
    const remove = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(
      <div>
        <input aria-label="이름" />
        <KeyDiagnostics />
      </div>,
      { wrapper: SettingsProvider },
    );
    const input = screen.getByRole('textbox', { name: '이름' });
    input.focus();

    // fireEvent 는 dispatchEvent 의 결과를 돌려준다 — preventDefault 가 걸리면 false 다.
    const notPrevented = fireEvent.keyDown(input, { code: 'KeyV', key: 'ㅍ' });

    // ① 막지 않는다 — 이 창은 진단이지 가로채기가 아니다.
    expect(notPrevented).toBe(true);
    // ② 입력칸에서 온 사건도 기록한다. 걸린 동작까지 되짚는다(V = 선택 도구).
    expect(screen.getByText('KeyV')).toBeInTheDocument();
    expect(screen.getByText(/tool:select/)).toBeInTheDocument();

    // ③ 도움말을 닫으면 document 리스너가 사라진다 — 안 떼면 죽은 창이 남은 세션 내내 모든
    // keydown 을 되짚는다(capture 단계라 아무도 못 막는다).
    unmount();
    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function), true);
  });

  it('[편집기 단축키] 가 [끔] 이면 전역 층을 죽은 것으로 보이고 게이트 값을 함께 적는다', () => {
    localStorage.setItem(
      'spin.prefs',
      JSON.stringify({ ...loadPrefs(), a11y: { ...loadPrefs().a11y, singleKeyShortcuts: 'off' } }),
    );
    render(<KeyDiagnostics />, { wrapper: SettingsProvider });

    fireEvent.keyDown(document.body, { code: 'KeyV', key: 'v' });

    // 설정이 막은 키를 "global: tool:select" 로 그리면 안 먹는 원인을 정반대로 알려 준다.
    expect(screen.queryByText(/tool:select/)).not.toBeInTheDocument();
    // 대신 왜 비었는지가 게이트 행에 있다 — 설정 화면과 같은 라벨을 쓴다.
    expect(screen.getByText('끔')).toBeInTheDocument();
  });
});
