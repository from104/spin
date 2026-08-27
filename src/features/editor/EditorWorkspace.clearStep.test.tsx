// [비우기] — 2026-08-28 기현 지시로 **드릴 편집에도** 생겼다(그전에는 자유 전술판 전용).
//
// 그때까지 드릴에 없던 근거는 functionBarMetrics 에 이렇게 적혀 있었다: *"드릴에는 되돌리기가
// 있고 스텝이라는 시간축이 있어 '비운다' 가 무엇을 뜻하는지(이 스텝만? 이후 전부?) 가 한 가지로
// 정해지지 않는다."* 지시와 함께 **뜻을 하나로 정했다: 지금 스텝만.** 이 파일이 그 결정을
// 못박는다 — 다른 스텝이 살아남는가, 되돌리기가 **한 칸**인가, 공 명단이 정확히 거둬지는가.
//
// 전술판 쪽 동작(확인 다이얼로그·되돌리기·코트 전환 게이트)은 BoardScreen.test.tsx 소관이다.
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
import { ToastHost } from '../../ui/ToastHost.tsx';
import { useToast } from '../../store/toast/ToastProvider.tsx';
import { makeDefaultPrefs, PREFS_KEY } from '../../storage/prefs.ts';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
import type { DrillId } from '../../core/ids.ts';

let stageTarget: { kind: 'drill'; drillId: DrillId } = { kind: 'drill', drillId: 'dr_none' as DrillId };
vi.mock('../../app/AppShell.tsx', () => ({
  useStageTarget: () => stageTarget,
}));

const { EditorScreen } = await import('./EditorScreen.tsx');

function Toasts() {
  const { toasts, dismiss } = useToast();
  return <ToastHost toasts={toasts} onDismiss={dismiss} />;
}

function Wrapper({ children }: { children: ReactNode }) {
  const nav: AppHistoryApi = { screen: 'board', go: () => {}, back: () => {} };
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
          <Toasts />
          <LiveRegion />
        </ToastProvider>
      </LibraryProvider>
    </SettingsProvider>
  );
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), tutorialsSeen: { editor: true } }));
  stageTarget = { kind: 'drill', drillId: 'dr_none' as DrillId };
});

/** 스텝 2장짜리 드릴을 연다 — **다른 스텝이 살아남는가**가 이 파일의 핵심이라 1장으로는 못 본다. */
async function openDrill() {
  const { repo } = await resolveDrillRepo();
  const created = await repo.createDrill({ courtMode: 'full', formation: '1-2-1' });
  // 2번 스텝은 1번의 복제다(edits.ts duplicateStep) — 둘 다 개체가 놓여 있다.
  const two = { ...created, steps: [created.steps[0]!, { ...structuredClone(created.steps[0]!), id: 'st_two' as never }] };
  await repo.putDrill(two);
  stageTarget = { kind: 'drill', drillId: created.id };
  const user = userEvent.setup();
  render(<EditorScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  return { user, drillId: created.id, repo };
}

const objs = () => screen.getByRole('application', { name: '코트 편집 영역' }).querySelectorAll('.court-obj').length;
const stepCards = () => within(screen.getByRole('navigation', { name: '스텝 목록' })).getAllByRole('button', { name: /^스텝 \d+$/ });

/** [보드 설정] 모달을 열고 [코트 비우기] → 확인. 두 단계를 다 밟는 것이 계약이다. */
async function clearCurrentStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: '보드 설정' }));
  await user.click(await screen.findByRole('button', { name: '코트 비우기' }));
  await user.click(await screen.findByRole('button', { name: '비우기' }));
}

describe('드릴 편집의 [비우기] — 뜻은 하나다: 지금 스텝만', () => {
  it('[보드 설정] 모달 안에 있다 — 기능 바에는 없다', async () => {
    await openDrill();
    expect(screen.queryByRole('button', { name: '코트 비우기' })).toBeNull();
    await userEvent.setup().click(screen.getByRole('button', { name: '보드 설정' }));
    expect(await screen.findByRole('button', { name: '코트 비우기' })).toBeInTheDocument();
  }, 20000);

  it('확인 문구가 범위를 말한다 — "이 스텝" 이고 "다른 스텝은 그대로"', async () => {
    const { user } = await openDrill();
    await user.click(screen.getByRole('button', { name: '보드 설정' }));
    await user.click(await screen.findByRole('button', { name: '코트 비우기' }));
    // 파괴적 조작의 확인에서 가장 중요한 한 줄이 범위다 — 전술판 문구("코트 위의")를 그대로
    // 쓰면 드릴에서는 어디까지 지우는지 알 수 없다.
    expect(await screen.findByText(/이 스텝의 선수·공·콘·화살표·메모가 모두 사라집니다/)).toBeInTheDocument();
    expect(screen.getByText(/다른 스텝은 그대로입니다/)).toBeInTheDocument();
  }, 20000);

  it('지금 스텝만 빈다 — 다른 스텝은 그대로다', async () => {
    const { user } = await openDrill();
    const before = objs();
    expect(before).toBeGreaterThan(0);

    await clearCurrentStep(user);
    await waitFor(() => expect(objs()).toBe(0));

    // 2번 스텝으로 넘어가면 개체가 그대로 있다.
    await user.click(stepCards()[1]!);
    await waitFor(() => expect(objs()).toBe(before));
  }, 20000);

  it('되돌리기 **한 번**이면 전부 돌아온다 — 개체 수만큼 누르지 않는다', async () => {
    const { user } = await openDrill();
    const before = objs();
    await clearCurrentStep(user);
    await waitFor(() => expect(objs()).toBe(0));

    await user.click(screen.getByRole('button', { name: '되돌리기' }));
    await waitFor(() => expect(objs()).toBe(before));
  }, 20000);

  it('이미 빈 스텝에서는 꺼져 있다 — 눌러도 안 변할 버튼을 살려 두지 않는다', async () => {
    const { user } = await openDrill();
    await clearCurrentStep(user);
    await waitFor(() => expect(objs()).toBe(0));

    await user.click(screen.getByRole('button', { name: '보드 설정' }));
    expect(await screen.findByRole('button', { name: '코트 비우기' })).toBeDisabled();
  }, 20000);

  it('드릴에서는 코트가 여전히 잠겨 있다 — 비워도 열리지 않는다', async () => {
    // 전술판과 갈리는 지점이다. 드릴의 코트는 저장된 배치가 걸려 있어 언제나 잠금이고
    // (EditorWorkspace 의 courtLocked), 비우기가 그 문을 여는 것은 전술판에서만이다.
    const { user } = await openDrill();
    await clearCurrentStep(user);
    await user.click(screen.getByRole('button', { name: '보드 설정' }));
    expect(await screen.findByRole('radiogroup', { name: '코트 형태(변경 불가)' })).toBeInTheDocument();
    // ★ 그리고 **그 사실을 말해야 한다.** [비우기]가 이 모달로 들어오면서 전술판 문구
    //   ("코트를 바꾸려면 먼저 판을 비우세요")가 드릴에서는 바로 밑의 버튼을 가리키는 거짓말이
    //   됐다 — 눌러도 안 열린다. 문장이 갈렸는지 여기서 못박는다.
    expect(screen.queryByText(/먼저 판을 비우세요/)).toBeNull();
    expect(screen.getByText(/드릴을 만든 뒤에는 바꿀 수 없습니다/)).toBeInTheDocument();
  }, 20000);

  it('공은 명단에서도 거둔다 — 안 보이는데 상한만 먹는 유령을 만들지 않는다', async () => {
    // defaults.ts `createDrill.empty` 가 적어 둔 그 유령(2026-08-10 공개판 결함)의 재발 방어.
    // 스텝 둘 다 비워야 어느 스텝에도 안 남는다 — 한 스텝만 비우면 명단에 그대로 있어야 한다.
    const { user, drillId, repo } = await openDrill();
    await clearCurrentStep(user);
    await waitFor(async () => expect((await repo.getDrill(drillId))!.steps[0]!.balls).toEqual({}));
    // 2번 스텝에 살아 있으므로 명단에는 남는다.
    expect((await repo.getDrill(drillId))!.cast.balls.length).toBeGreaterThan(0);

    await user.click(stepCards()[1]!);
    await clearCurrentStep(user);
    await waitFor(async () => expect((await repo.getDrill(drillId))!.cast.balls).toHaveLength(0));
  }, 20000);
});
