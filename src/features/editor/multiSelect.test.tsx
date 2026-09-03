// §6.10b 다중 선택 — 손짓의 뜻과 메뉴의 말.
//
// jsdom 에는 레이아웃이 없어 코트 좌표가 전부 0 이다. 그래서 "사각형으로 훑었더니 넷이
// 잡혔다" 는 여기서 재지 않는다 — 잴 수 있고 **깨지면 아픈** 것 셋을 잰다:
//   ① 어떤 손짓이 '더하기' 인가(`isAdditive`) — 여기가 틀리면 터치·리눅스에서 가산이 죽는다
//   ② 치우기의 말(`removalLabel`) — 누르기 전에 "몇 개는 돌아오고 몇 개는 안 돌아온다"
//   ③ 메뉴가 **고른 것 전부**에 걸리는가 — 터치에서 다중 선택으로 뭔가 할 수 있는 유일한 문
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { LibraryProvider } from '../../store/library/LibraryProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { AppNavProvider } from '../../app/useAppHistory.ts';
import type { AppHistoryApi } from '../../app/useAppHistory.ts';
import { HeaderProvider } from '../../app/AppHeader.tsx';
import { LiveRegion } from '../../ui/LiveRegion.tsx';
import { makeDefaultPrefs, PREFS_KEY } from '../../storage/prefs.ts';
import { BoardScreen } from '../board/BoardScreen.tsx';
import { isAdditive } from './useEditorPointer.ts';
import { removalLabel } from './removal.ts';
import { ObjectMenu, type ObjectMenuTarget } from './ObjectMenu.tsx';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const meta = (over: Partial<{ shiftKey: boolean; metaKey: boolean; ctrlKey: boolean }> = {}) => ({
  shiftKey: false,
  metaKey: false,
  ctrlKey: false,
  ...over,
});

/** `isApplePlatform` 은 `navigator` 를 읽는다 — 판별 자체가 목적이 아니라 **Ctrl 의 뜻이
 *  플랫폼마다 다르다**는 사실이 목적이므로, 여기서는 navigator 를 갈아 끼워 양쪽을 다 본다. */
function asPlatform(p: string) {
  vi.stubGlobal('navigator', { platform: p });
}

describe('isAdditive — 어떤 손짓이 선택에 더하는가', () => {
  it('Shift 는 어디서나 더한다 — 세 앱이 모두 같은 관례라 배울 것이 없다', () => {
    asPlatform('MacIntel');
    expect(isAdditive(meta({ shiftKey: true }), false)).toBe(true);
    asPlatform('Linux x86_64');
    expect(isAdditive(meta({ shiftKey: true }), false)).toBe(true);
  });

  // ★ 2026-08-16 이전의 고장. 포인터가 `metaKey` 만 봐서 윈도우·리눅스의 Ctrl+클릭이
  //   그냥 '새 선택' 이었다(키맵은 같은 자리를 `ctrlKey || metaKey` 로 푸는데도).
  it('윈도우·리눅스에서 Ctrl 은 더한다', () => {
    asPlatform('Linux x86_64');
    expect(isAdditive(meta({ ctrlKey: true }), false)).toBe(true);
  });

  // 애플에서 Ctrl+클릭은 수식키가 아니라 **보조 클릭**이다. 같게 보면 메뉴를 여는 손짓이
  // 선택까지 토글한다.
  it('애플에서 Ctrl 은 안 더한다 — 거기서는 ⌘ 다', () => {
    asPlatform('MacIntel');
    expect(isAdditive(meta({ ctrlKey: true }), false)).toBe(false);
    expect(isAdditive(meta({ metaKey: true }), false)).toBe(true);
  });

  // ★ 터치의 전부. 손가락에는 수식키가 없어서, 이 모드가 없으면 이미 고른 것에 하나를
  //   더할 방법이 **아예 없다**.
  it('모아 고르기가 켜져 있으면 맨 탭도 더한다', () => {
    asPlatform('Linux x86_64');
    expect(isAdditive(meta(), false), '대조군 — 모드가 꺼져 있으면 갈아끼운다').toBe(false);
    expect(isAdditive(meta(), true)).toBe(true);
  });
});

describe('removalLabel — 누르기 전에 무엇을 알아야 하는가', () => {
  it('여럿이면 개수를 앞세운다', () => {
    expect(removalLabel(['ch_1'], 'ko')).toBe('빼기');
    expect(removalLabel(['nt_1'], 'ko')).toBe('삭제');
    expect(removalLabel(['ch_1', 'bl_1', 'cn_1'], 'ko')).toBe('3개 빼기');
    expect(removalLabel(['nt_1', 'ar_1'], 'ko')).toBe('2개 삭제');
  });

  // 고무줄로 칩과 메모를 함께 잡는 일이 실제로 생긴다 — 한쪽 말로 뭉뚱그리면 둘 중 하나가
  // 거짓말이 된다(트레이를 다시 볼 이유가 사라지거나, 사라진 줄 모르거나).
  it('섞였으면 **양쪽을 다 적는다**', () => {
    expect(removalLabel(['ch_1', 'ch_2', 'nt_1'], 'ko')).toBe('2개 빼기 · 1개 삭제');
  });
});

describe('개체 메뉴 — 고른 것 전부에 걸린다', () => {
  const base: ObjectMenuTarget = {
    ids: ['ch_1'],
    x: 10,
    y: 10,
    locked: false,
    ignored: false,
    canIgnore: true,
    editable: null,
    selectSame: null,
  };
  const noop = () => {};

  function open(over: Partial<ObjectMenuTarget>, spies: Partial<Record<'onRemove' | 'onToggleLock' | 'onSelect', (ids: string[], next?: boolean) => void>> = {}) {
    render(
      <ObjectMenu
        target={{ ...base, ...over }}
        onClose={noop}
        onFineTune={() => {}}
        onToggleLock={spies.onToggleLock ?? noop}
        onToggleIgnore={noop}
        onRemove={spies.onRemove ?? noop}
        onSelect={spies.onSelect ?? noop}
        onDuplicate={noop}
        onEdit={noop}
      />,
      { wrapper: SettingsProvider },
    );
  }

  it('누르면 **고른 것 전부**가 넘어간다 — 짚은 하나가 아니다', () => {
    const onRemove = vi.fn();
    const onToggleLock = vi.fn();
    open({ ids: ['ch_1', 'ch_2'] }, { onRemove, onToggleLock });
    fireEvent.click(screen.getByRole('menuitem', { name: '2개 빼기' }));
    expect(onRemove).toHaveBeenCalledWith(['ch_1', 'ch_2']);
    cleanup();
    open({ ids: ['ch_1', 'ch_2'] }, { onRemove, onToggleLock });
    fireEvent.click(screen.getByRole('menuitem', { name: '2개 잠금' }));
    expect(onToggleLock).toHaveBeenCalledWith(['ch_1', 'ch_2'], true);
  });

  // 섞였으면 '무시' 는 아예 안 낸다 — 항목이 있는데 절반에만 먹는 것보다 없는 편이 정직하다.
  it('휠체어가 아닌 것이 섞이면 무시 항목이 없다', () => {
    open({ ids: ['ch_1', 'bl_1'], canIgnore: false });
    expect(screen.queryByRole('menuitem', { name: /무시/ })).toBeNull();
  });

  // ★ 터치에서 다중 선택을 **만드는** 유일한 길.
  it('"같은 것 전부" 는 그 명단을 그대로 넘긴다', () => {
    const onSelect = vi.fn();
    open({ selectSame: { label: '같은 팀 전부 고르기', ids: ['ch_1', 'ch_2', 'ch_3'] } }, { onSelect });
    fireEvent.click(screen.getByRole('menuitem', { name: '같은 팀 전부 고르기' }));
    expect(onSelect).toHaveBeenCalledWith(['ch_1', 'ch_2', 'ch_3']);
  });
});

// ── 화면에서 실제로 켜지는가 ─────────────────────────────────────────────────────────
// 규칙이 리듀서에서 맞아도 버튼이 그 액션을 안 쏘면 기능은 없는 것이다(이 저장소가 실제로
// 겪은 실패 방식 — 계산만 되고 버려지던 배선).
function Wrapper({ children }: { children: ReactNode }) {
  const nav: AppHistoryApi = { screen: 'board', go: () => {}, back: () => {} };
  return (
    <SettingsProvider>
      <LibraryProvider>
        <ToastProvider>
          <HeaderProvider>
            <AppNavProvider value={nav}>{children}</AppNavProvider>
          </HeaderProvider>
          <LiveRegion />
        </ToastProvider>
      </LibraryProvider>
    </SettingsProvider>
  );
}

describe('모아 고르기 — 도구 칸에서', () => {
  beforeEach(() => localStorage.clear());

  async function openBoard() {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs() }));
    const user = userEvent.setup();
    render(<BoardScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
    return user;
  }

  // [선택]은 처음부터 켜진 도구다 — 그래서 **한 번 누르면** 이미 '같은 도구 재입력' 이다.
  it('[선택]을 누르면 고정되고, 한 번 더 누르면 풀린다', async () => {
    const user = await openBoard();
    await user.click(screen.getByRole('button', { name: '선택' }));
    // 이름이 '선택 고정' 으로 바뀐다 — 보이는 글자('선택')를 품고 있어야 WCAG 2.5.3 을 지킨다.
    const locked = await screen.findByRole('button', { name: '선택 고정' });
    await user.click(locked);
    await screen.findByRole('button', { name: '선택' });
  });

  it('툴팁이 이 조작을 먼저 말한다 — 도움말을 열지 않는 사람에게 유일한 예고다', async () => {
    await openBoard();
    expect(screen.getByRole('button', { name: '선택' }).title).toContain('한 번 더 누르면 여러 개를 모아 고릅니다');
  });
});
