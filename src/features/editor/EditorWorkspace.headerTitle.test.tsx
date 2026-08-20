// 2026-08-18 (기현님: "속성 버튼 및 그 안의 내용 폐기 … 드릴 이름 정도만 왼쪽 상단에 배치하고
// 동적으로 수정 가능해야함") — 드릴 이름이 헤더 인라인 클릭-편집이 됐다(옛 인스펙터 [제목]
// 필드의 후계). DrillMetaSheet.test.tsx 의 description 절과 같은 이유·같은 골격으로
// **배선**만 본다: drill.title 이 헤더에 오르고, 편집이 META_SET 을 거쳐 자동저장까지 가는지.
// 빈 값 거부(이름 없는 드릴 방지)는 여기가 유일한 검증 자리다 — 설명 필드에는 없는 가드다.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { AppNavProvider } from '../../app/useAppHistory.ts';
import type { AppHistoryApi } from '../../app/useAppHistory.ts';
import { AppHeader, HeaderProvider } from '../../app/AppHeader.tsx';
import { LiveRegion } from '../../ui/LiveRegion.tsx';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
import { makeDefaultPrefs, savePrefs } from '../../storage/prefs.ts';
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
  // 튜토리얼 자동 시작이 Esc 를 스포트라이트 종료로 가로채면 아래 "Esc 는 커밋 없이 되돌린다"
  // 테스트가 깨진다 — "이미 봤다" 상태로 시작해 이 파일이 보는 배선(제목 편집)만 남긴다.
  savePrefs({ ...makeDefaultPrefs(), tutorialsSeen: { editor: true } });
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

// 2026-08-18 에는 이름의 정본 자리가 사이드바 맨 위였다(넓은 창엔 헤더가 없었다). 2026-08-20
// 재설계(§A, 기현님 지시 "편집·시연 화면이 비슷한 레이아웃이어야 ux가 좋아진다")로 드릴
// 편집이 넓은 창에서도 헤더를 도로 얻으면서 그 전제가 사라졌고, 사이드바의 이름 편집기는
// 중복이라 철거됐다(StepSidebar.tsx §G, EditorScreen.test.tsx 회귀 기록) — **헤더가 이제
// 창 폭과 무관한 유일한 자리다.** `inHeader()` 스코프는 그래도 남긴다 — 화면에 이름을 담은
// 다른 텍스트(예: 라이브 리전 발표문)와 안 섞이도록 좁혀 두는 관례일 뿐, 더 이상 "사이드바와
// 겹쳐서" 가 이유는 아니다.
const inHeader = () => within(document.querySelector('header') as HTMLElement);

describe('헤더 드릴 이름 — 실제 화면 배선(창 폭과 무관한 유일한 자리)', () => {
  it('제목이 클릭-편집 버튼으로 뜬다 — 이름이 aria 에 실린다', async () => {
    await openDrill();
    expect(inHeader().getByRole('button', { name: /^드릴 이름: .+\. 눌러서 수정$/ })).toBeInTheDocument();
  });

  it('클릭 → 입력 → blur 로 META_SET 이 나가 자동저장까지 간다', async () => {
    const { user, drillId, view } = await openDrill();
    await user.click(inHeader().getByRole('button', { name: /^드릴 이름/ }));
    const input = inHeader().getByRole('textbox', { name: '드릴 이름' });
    await user.clear(input);
    await user.type(input, '골문 앞 2대1');
    await user.tab(); // blur — 커밋 시점(설명 필드와 같은 관용구).

    expect(await inHeader().findByRole('button', { name: '드릴 이름: 골문 앞 2대1. 눌러서 수정' })).toBeInTheDocument();

    view.unmount(); // 화면 전환 = 언마운트. useAutosave 가 그 자리에서 동기 플러시한다.
    const { repo } = await resolveDrillRepo();
    await waitFor(async () => {
      const saved = await repo.getDrill(drillId);
      expect(saved?.title).toBe('골문 앞 2대1');
    });
  });

  it('비워서 blur 하면 커밋하지 않는다 — 원래 이름이 돌아온다', async () => {
    const { user } = await openDrill();
    const before = inHeader().getByRole('button', { name: /^드릴 이름/ }).textContent;
    await user.click(inHeader().getByRole('button', { name: /^드릴 이름/ }));
    const input = inHeader().getByRole('textbox', { name: '드릴 이름' });
    await user.clear(input);
    await user.tab();
    expect(inHeader().getByRole('button', { name: /^드릴 이름/ }).textContent).toBe(before);
  });

  it('Esc 는 커밋 없이 되돌린다', async () => {
    const { user } = await openDrill();
    const before = inHeader().getByRole('button', { name: /^드릴 이름/ }).textContent;
    await user.click(inHeader().getByRole('button', { name: /^드릴 이름/ }));
    const input = inHeader().getByRole('textbox', { name: '드릴 이름' });
    await user.clear(input);
    await user.type(input, '버릴 이름');
    await user.keyboard('{Escape}');
    expect(inHeader().getByRole('button', { name: /^드릴 이름/ }).textContent).toBe(before);
  });
});
