// §10.8 화면 스모크 — CourtPicker → 드릴 생성 → 편집기 3영역 렌더까지 실제 경로로 확인한다.
//
// `../../app/AppShell.tsx` 를 vi.mock 으로 대체한다: EditorScreen 이 필요로 하는 건
// `useEditorTarget()` 하나뿐인데, 그 실제 파일은 형제 Wave4 모듈(screen-settings 의
// SettingsScreen.tsx)을 함께 import 한다 — 그 모듈이 아직 없는 동안(§9 "Wave4 는 병렬 진행,
// 형제 산출물이 없으면 import 가 막힌다")에는 실제 모듈을 그대로 불러오면 이 화면과 무관한
// 이유로 테스트가 깨진다. §8 통합 시점에는 이 모킹을 걷어내도 그대로 통과해야 한다.
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { AppNavProvider } from '../../app/useAppHistory.ts';
import type { AppHistoryApi } from '../../app/useAppHistory.ts';

vi.mock('../../app/AppShell.tsx', () => ({
  useEditorTarget: () => ({ kind: 'new' as const }),
}));

const { EditorScreen } = await import('./EditorScreen.tsx');

function Wrapper({ children }: { children: ReactNode }) {
  const nav: AppHistoryApi = { screen: 'editor', go: () => {}, back: () => {} };
  return (
    <SettingsProvider>
      <ToastProvider>
        <AppNavProvider value={nav}>{children}</AppNavProvider>
      </ToastProvider>
    </SettingsProvider>
  );
}

describe('EditorScreen', () => {
  it('새 드릴 대상이면 코트 선택부터 시작해, 고르면 편집기 3영역이 렌더된다', async () => {
    const user = userEvent.setup();
    render(<EditorScreen />, { wrapper: Wrapper });

    expect(screen.getByRole('heading', { name: '어떤 코트로 진행하십니까?' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /풀 코트/ }));

    await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
    expect(screen.getByRole('application', { name: '코트 편집 영역' })).toBeInTheDocument();
    expect(screen.getByRole('complementary', { name: '드릴 속성' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^선택/ })).toHaveAttribute('aria-pressed', 'true');
  });
});
