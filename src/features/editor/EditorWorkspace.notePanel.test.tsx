// PLAN-STEP-EDITING.md §텍스트의 소속(기현님 확정 2026-08-17) — 노트 패널이 실제 화면에서
// STEP_META 를 진짜로 dispatch 하는지, 되돌리기 병합(COALESCE_TYPES)이 살아 있는지, 자동
// 저장→시연 왕복이 여전히 되는지를 끝에서 끝으로 본다. 단위 조각(펼침·미리보기·key 교체·
// change 즉시 반영)은 NotePanel.test.tsx 가 이미 본다 — 여기서는 **배선**만 본다.
//
// 이 스위트는 InspectorPanel.stepMeta.test.tsx 의 note 관련 세 테스트를 이어받는다 —
// StepsSection 철거(계획서 §스텝 카드 "스텝 정보 최소화")로 note 편집 UI 가 인스펙터에서
// 이 패널로 완전히 옮겨왔기 때문이다(계약이 이사하면 테스트도 이사).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { LibraryProvider } from '../../store/library/LibraryProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { AppNavProvider } from '../../app/useAppHistory.ts';
import type { AppHistoryApi } from '../../app/useAppHistory.ts';
import { AppHeader, HeaderProvider } from '../../app/AppHeader.tsx';
import { LiveRegion } from '../../ui/LiveRegion.tsx';
import { makeDefaultPrefs, PREFS_KEY } from '../../storage/prefs.ts';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
import type { DrillId } from '../../core/ids.ts';
import { BoardScreen } from '../board/BoardScreen.tsx';

let stageTarget: { kind: 'drill'; drillId: DrillId } = { kind: 'drill', drillId: 'dr_none' as DrillId };
vi.mock('../../app/AppShell.tsx', () => ({
  useStageTarget: () => stageTarget,
}));

const { EditorScreen } = await import('./EditorScreen.tsx');
const { PresentRunner } = await import('../present/PresentRunner.tsx');

const navGo = vi.fn();
function Wrapper({ children }: { children: ReactNode }) {
  const nav: AppHistoryApi = { screen: 'board', go: navGo, back: () => {} };
  return (
    <SettingsProvider>
      <LibraryProvider>
        <ToastProvider>
          <HeaderProvider>
            <AppNavProvider value={nav}>
              <AppHeader />
              {children}
            </AppNavProvider>
          </HeaderProvider>
          <LiveRegion />
        </ToastProvider>
      </LibraryProvider>
    </SettingsProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  navGo.mockClear();
  stageTarget = { kind: 'drill', drillId: 'dr_none' as DrillId };
});

async function openDrill() {
  const { repo } = await resolveDrillRepo();
  const created = await repo.createDrill({ courtMode: 'full', formation: '1-2-1' });
  stageTarget = { kind: 'drill', drillId: created.id };
  const user = userEvent.setup();
  const view = render(<EditorScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  return { user, drillId: created.id, view };
}

const sidebarCards = () => within(screen.getByRole('navigation', { name: '스텝 목록' })).getAllByRole('button', { name: /^스텝 \d+$/ });
const noteToggle = () => screen.getByRole('button', { name: /^노트/ });
const noteInput = () => screen.getByLabelText('스텝 노트') as HTMLTextAreaElement;

describe('노트 패널 — 실제 화면 배선', () => {
  it('접힌 채로 시작한다 — 기본값은 감춤이다', async () => {
    await openDrill();
    expect(noteToggle()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByLabelText('스텝 노트')).toBeNull();
  });

  it('입력하면 STEP_META 가 나가 자동저장 → IDB 왕복 → 시연 화면이 그 문장을 읽는다', async () => {
    const { user, drillId, view } = await openDrill();
    await user.click(noteToggle());
    await user.type(noteInput(), '오른쪽으로 벌린다');

    view.unmount(); // 화면 전환 = 언마운트. useAutosave 가 그 자리에서 동기 플러시한다.

    const { repo } = await resolveDrillRepo();
    await waitFor(async () => {
      const saved = await repo.getDrill(drillId);
      expect(saved?.steps[0]?.note).toBe('오른쪽으로 벌린다');
    });

    render(<PresentRunner target={{ kind: 'drill', drillId }} nav={{ back: vi.fn(), go: vi.fn() }} />, { wrapper: Wrapper });
    expect(await screen.findByText('오른쪽으로 벌린다')).toBeInTheDocument();
  });

  it('연속 타이핑은 되돌리기 한 칸으로 합쳐진다(COALESCE_TYPES) — 스텝 추가까지 함께 지워지면 안 된다', async () => {
    const { user } = await openDrill();
    await user.click(screen.getByRole('button', { name: '한 장 더 찍기' })); // 2장째, 그 장이 선택된다
    await user.click(noteToggle());
    await user.type(noteInput(), '전개');
    expect(noteInput()).toHaveValue('전개');

    await user.click(screen.getByRole('button', { name: '되돌리기' }));

    // 되돌리기 직후의 textarea 는 비제어라 DOM 값이 그대로 남을 수 있다(NotePanel.tsx 의
    // key={stepId} 비제어 관행 — 모델이 스스로 바뀌어도 stepId 가 그대로면 안 갈아 끼워진다).
    // 그래서 다른 스텝으로 갔다가 돌아와 **강제로 다시 마운트**시켜 실제 모델값을 읽는다.
    await user.click(sidebarCards()[0]!);
    await user.click(sidebarCards()[1]!);

    // 한 칸으로 통째로 돌아간다 — 글자마다 커밋이면 '전' 처럼 잘린 값이 남는다.
    expect(noteInput()).toHaveValue('');
    // 그리고 그 한 칸이 타이핑만 먹었다 — 스텝 추가까지 함께 지워지면 안 된다(AND 분리).
    expect(sidebarCards()).toHaveLength(2);
  });

  it('대조군: 스텝이 다르면 합쳐지지 않는다 — 한 칸은 방금 그 스텝만 지운다', async () => {
    const { user } = await openDrill();
    await user.click(screen.getByRole('button', { name: '한 장 더 찍기' }));
    await user.click(noteToggle());

    await user.click(sidebarCards()[0]!);
    await user.type(noteInput(), '가나');

    await user.click(sidebarCards()[1]!);
    await user.type(noteInput(), '다라');

    await user.click(screen.getByRole('button', { name: '되돌리기' }));

    // 병합 키가 `STEP_META:${스텝 id}` 라서 두 스텝의 타이핑은 서로 다른 칸이다 —
    // 방금(2번 스텝) 것만 지워지고 1번 스텝은 그대로다.
    await user.click(sidebarCards()[0]!);
    expect(noteInput()).toHaveValue('가나');
    await user.click(sidebarCards()[1]!);
    expect(noteInput()).toHaveValue('');
  });
});

// 2026-08-20 (기현님 지시, §A·B) — ⓘ와 [시연]이 하단 푸터에서 헤더로 옮겨 갔다. 옛 C11/C12
// 계약(⓪ⓘ가 드릴 정보를 열고, 시연으로 가는 문이 있다)은 그대로 잇되 자리만 바뀌었다.
describe('헤더 — ⓘ·[시연으로] (2026-08-20 §A·B, 옛 C11/C12 계약 계승)', () => {
  it('제목 옆 ⓘ가 드릴 정보 모달을 열고, 헤더 최우측 [시연으로]가 그 드릴 시연으로 간다', async () => {
    const { user, drillId } = await openDrill();

    // useAppHeader 의 publish 는 별도 이펙트라 위 판(sidebar·tray) 커밋보다 한 틱 늦게 뜬다
    // (EditorWorkspace.headerDescription.test.tsx 의 옛 openDrill 주석과 같은 함정) — 둘 다
    // 이제 헤더 항목이라 findByRole 로 기다린다.
    // ⓘ — 드릴 정보 모달(편집 가능한 시트). 이제 헤더(제목 바로 옆)다.
    await user.click(await screen.findByRole('button', { name: '드릴 정보' }));
    expect(await screen.findByRole('dialog', { name: /드릴 정보/ })).toBeInTheDocument();
    await user.keyboard('{Escape}');

    // [시연으로] — 헤더 최우측 primary(옛 presentButton 필드가 폐기되며 이 자리로 흡수됐다).
    // nav.go 로 그 드릴 시연에 간다.
    await user.click(await screen.findByRole('button', { name: '시연으로' }));
    expect(navGo).toHaveBeenCalledWith('present', { kind: 'drill', id: drillId });
  });
});

describe('노트 패널 — 자유 전술판에는 없다(대조군)', () => {
  it('스텝이 없는 화면이라 노트 토글도 없다', async () => {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs() }));
    render(<BoardScreen />, { wrapper: Wrapper });
    await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /^노트/ })).toBeNull();
  });
});
