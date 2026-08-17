// 2026-08-18 (기현님: "속성 버튼 및 그 안의 내용 폐기 … 드릴 이름 정도만 왼쪽 상단에 배치하고
// 동적으로 수정 가능해야함") — 드릴 이름이 헤더 인라인 클릭-편집이 됐다(옛 인스펙터 [제목]
// 필드의 후계). EditorWorkspace.headerDescription.test.tsx 와 같은 이유·같은 골격으로
// **배선**만 본다: drill.title 이 헤더에 오르고, 편집이 META_SET 을 거쳐 자동저장까지 가는지.
// 빈 값 거부(이름 없는 드릴 방지)는 여기가 유일한 검증 자리다 — 설명 필드에는 없는 가드다.
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

describe('헤더 드릴 이름 — 실제 화면 배선', () => {
  it('제목이 클릭-편집 버튼으로 뜬다 — 이름이 aria 에 실린다', async () => {
    await openDrill();
    expect(screen.getByRole('button', { name: /^드릴 이름: .+\. 눌러서 수정$/ })).toBeInTheDocument();
  });

  it('클릭 → 입력 → blur 로 META_SET 이 나가 자동저장까지 간다', async () => {
    const { user, drillId, view } = await openDrill();
    await user.click(screen.getByRole('button', { name: /^드릴 이름/ }));
    const input = screen.getByRole('textbox', { name: '드릴 이름' });
    await user.clear(input);
    await user.type(input, '골문 앞 2대1');
    await user.tab(); // blur — 커밋 시점(설명 필드와 같은 관용구).

    expect(await screen.findByRole('button', { name: '드릴 이름: 골문 앞 2대1. 눌러서 수정' })).toBeInTheDocument();

    view.unmount(); // 화면 전환 = 언마운트. useAutosave 가 그 자리에서 동기 플러시한다.
    const { repo } = await resolveDrillRepo();
    await waitFor(async () => {
      const saved = await repo.getDrill(drillId);
      expect(saved?.title).toBe('골문 앞 2대1');
    });
  });

  it('비워서 blur 하면 커밋하지 않는다 — 원래 이름이 돌아온다', async () => {
    const { user } = await openDrill();
    const before = screen.getByRole('button', { name: /^드릴 이름/ }).textContent;
    await user.click(screen.getByRole('button', { name: /^드릴 이름/ }));
    const input = screen.getByRole('textbox', { name: '드릴 이름' });
    await user.clear(input);
    await user.tab();
    expect(screen.getByRole('button', { name: /^드릴 이름/ }).textContent).toBe(before);
  });

  it('Esc 는 커밋 없이 되돌린다', async () => {
    const { user } = await openDrill();
    const before = screen.getByRole('button', { name: /^드릴 이름/ }).textContent;
    await user.click(screen.getByRole('button', { name: /^드릴 이름/ }));
    const input = screen.getByRole('textbox', { name: '드릴 이름' });
    await user.clear(input);
    await user.type(input, '버릴 이름');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: /^드릴 이름/ }).textContent).toBe(before);
  });
});
