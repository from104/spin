// `?e2e=1` 이 없으면 아무것도 바뀌지 않는다 — docs/PLAN-TEST-SUITE.md §3 「플래그가 없으면 동작이 하나도
// 안 바뀐다 — 이것을 vitest 케이스 하나로 못박는다」.
//
// 지우면 새는 실기 버그: 시험 다리가 이용자의 화면에서 돈다 — 편집기 내부 상태가 `window.__spinE2E` 로
// 드러나고, 매 커밋 다리를 갈아 끼우는 렌더가 이용자 몫이 된다. 판정이 마운트 자리 한 곳뿐이라
// (E2EBridge.tsx 머리말) 그 한 줄이 사라지면 이 케이스만 빨개진다.
//
// 진짜 전술판(BoardScreen → EditorWorkspace)을 띄운다 — 다리 컴포넌트만 따로 그려 보면 "편집기가 그것을
// 마운트하는가" 를 못 본다. 설치 모듈은 가짜로 갈아 끼워, 동적 import 가 일어났는지를 센다.
import { describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { LibraryProvider } from '../../store/library/LibraryProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { AppNavProvider, type AppHistoryApi } from '../useAppHistory.ts';
import { HeaderProvider } from '../AppHeader.tsx';
import { BoardScreen } from '../../features/board/BoardScreen.tsx';

const install = vi.hoisted(() => vi.fn(() => () => {}));
vi.mock('./installE2EBridge.ts', () => ({ installE2EBridge: install }));

function Wrapper({ children }: { children: ReactNode }) {
  const nav: AppHistoryApi = { screen: 'board', go: () => {}, back: () => {} };
  return (
    <SettingsProvider>
      <LibraryProvider>
        <ToastProvider>
          <HeaderProvider>
            <AppNavProvider value={nav}>{children}</AppNavProvider>
          </HeaderProvider>
        </ToastProvider>
      </LibraryProvider>
    </SettingsProvider>
  );
}

describe('E2EBridge — 플래그 없음', () => {
  it('?e2e=1 이 없으면 편집기가 떠도 다리 모듈을 부르지도 window.__spinE2E 를 세우지도 않는다', async () => {
    expect(window.location.search).not.toContain('e2e');
    const { container } = render(<BoardScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(container.querySelector('[data-testid="court-stage"]')).not.toBeNull());
    // 동적 import 는 마운트 effect 뒤 마이크로태스크에서 풀린다 — 한 바퀴 더 돌려 늦게 오는 설치도 잡는다
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(install).not.toHaveBeenCalled();
    expect(window.__spinE2E).toBeUndefined();
  });
});
