// 3.1 — 스텝 시간(초) override 입력 UI(StepDurationSection).
//
// ⚠️ 2026-08-17 재편(PLAN-STEP-EDITING.md §스텝 카드 "스텝 정보 최소화", 기현님 확정) —
// 이 파일은 원래 이름·메모·시간 세 필드를 한 스위트로 봤다. StepsSection(이름·메모 편집,
// 위/아래·복제·삭제)이 철거되며 계약이 이사했다:
//   · **이름** — UI 에서 완전히 폐기(계획서 §스텝 카드). 되살릴 계약이 없어 테스트도 없앤다.
//     `DrillStep.name` 필드 자체는 모델에 남지만(다음 과제 ⑦이 note 로 병합해 정리한다),
//     이 화면은 더 이상 그 값을 읽지도 쓰지도 않는다.
//   · **메모(note)** — NotePanel(보드 아래 접이식 패널)로 이사. 컴포넌트 단위 계약은
//     NotePanel.test.tsx 가, 실제 화면 배선(진짜 STEP_META dispatch·되돌리기 병합·자동저장→
//     시연)은 EditorWorkspace.notePanel.test.tsx 가 이어받는다.
//   · **시간(durationMs)** — 옮기지 말고 여기 그대로 두라는 지시(계획이 언급하지 않은 기존
//     기능을 조용히 죽이지 않는다)라, 이 파일은 그 하나만 남아서 계속 본다.
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
import type { DrillId } from '../../core/ids.ts';

let stageTarget: { kind: 'drill'; drillId: DrillId } = { kind: 'drill', drillId: 'dr_none' as DrillId };
vi.mock('../../app/AppShell.tsx', () => ({
  useStageTarget: () => stageTarget,
}));

const { EditorScreen } = await import('./EditorScreen.tsx');
const { PresentRunner } = await import('../present/PresentRunner.tsx');

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

/** 드릴 하나를 심고 그 편집 화면을 띄운 뒤 인스펙터를 연다(2.2 로 기본 접힘 오버레이다). */
async function openDrillWithInspector() {
  const { repo } = await resolveDrillRepo();
  const created = await repo.createDrill({ courtMode: 'full', formation: '1-2-1' });
  stageTarget = { kind: 'drill', drillId: created.id };
  const user = userEvent.setup();
  const view = render(<EditorScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  await user.click(screen.getByRole('button', { name: '속성' }));
  await screen.findByRole('complementary', { name: '드릴 속성' });
  return { user, drillId: created.id, view };
}

const secInput = () => screen.getByLabelText('스텝 시간(초)') as HTMLInputElement;
/** 왼쪽 사이드바 카드(2026-08-17). 스텝을 **고르는** 조작은 이걸로 한다. */
const sidebarCards = () => within(screen.getByRole('navigation', { name: '스텝 목록' })).getAllByRole('button', { name: /^스텝 \d+$/ });

describe('3.1 스텝 시간(초) — 사이드바 카드에서 고르고 인스펙터에서 적는다', () => {
  it('시간은 초로 적는다 — 상한을 넘겨 적으면 손을 뗄 때 실제 저장값으로 되비친다', async () => {
    const { user } = await openDrillWithInspector();
    await user.type(secInput(), '999');
    await user.tab(); // 포커스를 뗀다(= blur)

    // 비제어라 화면과 모델이 갈라질 수 있는 유일한 자리가 클램프다. 되비치지 않으면 화면은
    // "999초" 라고 말하는데 재생은 60초로 도는 상태가 된다.
    expect(secInput().value).toBe('60');

    // 대조군 — 범위 안의 값은 손대지 않는다(무조건 되쓰는 것이 아니다).
    await user.clear(secInput());
    await user.type(secInput(), '3');
    await user.tab();
    expect(secInput().value).toBe('3');
  });

  it('스텝을 넘기면 입력이 그 스텝 값으로 갈아 끼워진다 — 옛 값이 남지 않는다 (key={step.id})', async () => {
    const { user } = await openDrillWithInspector();
    await user.click(screen.getByRole('button', { name: '한 장 더 찍기' })); // 2장째를 찍고 그 장이 선택된다
    expect(sidebarCards()).toHaveLength(2);

    await user.type(secInput(), '5');
    await user.tab();
    expect(secInput().value).toBe('5');

    await user.click(sidebarCards()[0]!); // ← 1장째로 돌아간다
    expect(secInput().value).toBe(''); // 기본값(override 없음)

    await user.click(sidebarCards()[1]!); // 다시 2장째로 — 적어 둔 값이 그대로 있다
    expect(secInput().value).toBe('5');
  });
});

describe('3.1 여기서 적은 시간을 시연이 그대로 쓴다', () => {
  it('자동저장 → IDB 왕복 → PresentRunner 가 override 를 읽는다', async () => {
    const { user, drillId, view } = await openDrillWithInspector();
    await user.type(secInput(), '3');
    await user.tab();

    // 화면 전환 = 이 훅의 언마운트. useAutosave 가 그 자리에서 동기 플러시한다.
    view.unmount();

    const { repo } = await resolveDrillRepo();
    await waitFor(async () => {
      const saved = await repo.getDrill(drillId);
      expect(saved?.steps[0]?.durationMs).toBe(3000);
    });

    // PresentRunner 가 뜬다는 것만 확인한다 — 실제 재생 간격이 durationMs 를 타는지는
    // model/playback.test.ts(effectiveStepMs)가 이미 단위로 본다. 여기서 보는 것은 "이
    // 화면에서 적은 값이 저장소를 거쳐 그 화면까지 살아 있는가" 라는 배선뿐이다.
    render(<PresentRunner target={{ kind: 'drill', drillId }} nav={{ back: vi.fn() }} />, { wrapper: Wrapper });
    expect(await screen.findByRole('button', { name: '시연 종료' })).toBeInTheDocument();
  });
});
