// PLAN-STEP-EDITING.md §텍스트의 소속(기현님 확정 2026-08-17) — 드릴 설명은 편집 화면
// 헤더 인라인(제목 옆/밑 한 줄, 클릭 편집)이다. 컴포넌트 단위 동작(보임·클릭→입력·
// placeholder·Enter/Esc)은 AppHeader.test.tsx 가 이미 본다 — 여기서는 **배선**만 본다:
// drill.description 이 실제로 헤더에 오르고, 편집이 실제로 META_SET 을 거쳐 자동저장까지
// 가는지.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { AppNavProvider } from '../../app/useAppHistory.ts';
import type { AppHistoryApi } from '../../app/useAppHistory.ts';
import { AppHeader, HeaderProvider } from '../../app/AppHeader.tsx';
import { LiveRegion } from '../../ui/LiveRegion.tsx';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
import type { DrillId } from '../../core/ids.ts';

let stageTarget: { kind: 'drill'; drillId: DrillId } = { kind: 'drill', drillId: 'dr_none' as DrillId };
vi.mock('../../app/AppShell.tsx', () => ({
  useStageTarget: () => stageTarget,
}));

const { EditorScreen } = await import('./EditorScreen.tsx');

function Wrapper({ children }: { children: ReactNode }) {
  const nav: AppHistoryApi = { screen: 'board', go: () => {}, back: () => {} };
  return (
    <SettingsProvider>
      <ToastProvider>
        <HeaderProvider>
          <AppNavProvider value={nav}>
            <AppHeader />
            {children}
          </AppNavProvider>
        </HeaderProvider>
        <LiveRegion />
      </ToastProvider>
    </SettingsProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  stageTarget = { kind: 'drill', drillId: 'dr_none' as DrillId };
});

async function openDrill() {
  const { repo } = await resolveDrillRepo();
  const created = await repo.createDrill({ courtMode: 'full', formation: '1-2-1' });
  stageTarget = { kind: 'drill', drillId: created.id };
  const user = userEvent.setup();
  const view = render(<EditorScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  // useAppHeader 의 publish 는 별도 이펙트라 위 판(sidebar·tray) 커밋보다 한 틱 늦게 뜬다 —
  // 헤더 내용을 보기 전에 한 번 더 기다린다(안 그러면 아직 빈 header 를 잡고 '못 찾음'이 뜬다).
  await waitFor(() => expect(document.querySelector('header')?.textContent).not.toBe(''));
  return { user, drillId: created.id, view };
}

describe('헤더 설명 — 실제 화면 배선', () => {
  it('새 드릴은 설명이 없다 — 조용한 placeholder 가 헤더에 뜬다', async () => {
    await openDrill();
    expect(screen.getByRole('button', { name: '설명 추가' })).toBeInTheDocument();
  });

  it('클릭 → 입력 → 포커스 이동(blur) 으로 META_SET 이 나가 자동저장까지 간다', async () => {
    const { user, drillId, view } = await openDrill();
    await user.click(screen.getByRole('button', { name: '설명 추가' }));
    const input = screen.getByRole('textbox', { name: '드릴 설명' });
    await user.type(input, '측면에서 크로스');
    await user.tab(); // blur — 커밋 시점(InspectorPanel [설명] 필드와 같은 관용구).

    // 표시 모드로 돌아오고, 방금 적은 글이 버튼 글자가 됐다.
    expect(await screen.findByRole('button', { name: '측면에서 크로스' })).toBeInTheDocument();

    view.unmount(); // 화면 전환 = 언마운트. useAutosave 가 그 자리에서 동기 플러시한다.

    const { repo } = await resolveDrillRepo();
    await waitFor(async () => {
      const saved = await repo.getDrill(drillId);
      expect(saved?.description).toBe('측면에서 크로스');
    });
  });
});
