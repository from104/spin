// §5.4 [골대 원위치] — **두 손잡이가 같은 하나의 동작에 닿는가**, 그리고 그 자리가 **첫 화면
// 표적 예산을 한 칸도 쓰지 않는가**.
//
// InspectorPanel.resetGoals.test.tsx 는 패널 단독(스파이 prop)이라 *"버튼이 있고 prop 을
// 부른다"* 까지만 본다. 그 prop 이 **실제 물리 세계**까지 이어졌는지는 화면 끝에서만 보인다 —
// 이 저장소가 겪은 헛통과 중 *"저장은 되는데 화면엔 없다"* 의 반대 방향(화면엔 있는데 아무 데도
// 안 닿는다)이 정확히 이 자리에서 난다. 그래서 `physics/index.ts` 를 감싸 `resetGoals()` 가
// 몇 번 불렸는지 센다.
//
// 손잡이는 둘이다(BoardBar.tsx 머리말 2026-08-13 절):
//   ① 인스펙터 [드릴 정보] 맨 끝 [골대 원위치]  ← 2026-08-13 기현님 신고로 생긴 **주 자리**
//   ② [코트 비우기] 확인 모달 안 [골대만 원위치] ← 4.7 이 만든 자리(남긴다)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen, waitFor } from '@testing-library/react';
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
import { BoardScreen } from '../board/BoardScreen.tsx';
import { saveBoard } from '../../storage/board.ts';
import { createDrill } from '../../model/defaults.ts';

/** 진짜 월드를 만들고 `resetGoals` 만 세는 얇은 껍데기. 통째로 가짜를 세우면 "가짜가 불렸다"
 *  만 확인하게 되고, 골대가 실제로 코트 정의 자리로 가는지는 physics/index.test.ts 가 이미
 *  본다 — 여기서 볼 것은 **화면에서 물리까지의 통로**다. */
const { resetGoalsCalls } = vi.hoisted(() => ({ resetGoalsCalls: { n: 0 } }));
vi.mock('../../physics/index.ts', async (importOriginal) => {
  const mod = await importOriginal<typeof import('../../physics/index.ts')>();
  return {
    ...mod,
    createPhysicsWorld: (...args: Parameters<typeof mod.createPhysicsWorld>) => {
      const world = mod.createPhysicsWorld(...args);
      return {
        ...world,
        resetGoals: () => {
          resetGoalsCalls.n += 1;
          return world.resetGoals();
        },
      };
    },
  };
});

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
          <LiveRegion />
        </ToastProvider>
      </LibraryProvider>
    </SettingsProvider>
  );
}

/** `placed` 면 **개체가 놓인 판**으로 연다. [코트 비우기]는 판이 비어 있으면 꺼져 있으므로
 *  (2026-08-28 — 눌러도 안 변할 버튼을 살려 두지 않는다) 그 버튼을 실제로 누르는 케이스는
 *  반드시 채운 판에서 열어야 한다. */
async function openBoard(opts: { placed?: boolean } = {}) {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs() }));
  if (opts.placed) saveBoard(createDrill({ courtMode: 'full', formation: '1-2-1' }));
  const user = userEvent.setup();
  render(<BoardScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  // 2026-08-28 — [코트 비우기]는 [보드 설정] 모달 안이라 준비 신호로 못 쓴다. 기능 바에
  // 상시 서는 칸이면 되므로 그 모달을 여는 칸을 본다.
  await waitFor(() => expect(screen.getByRole('button', { name: '보드 설정' })).toBeInTheDocument());
  return { user };
}

beforeEach(() => {
  localStorage.clear();
  resetGoalsCalls.n = 0;
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('[보드 설정] 모달의 [골대 원위치] 가 실제 물리까지 닿는다', () => {
  // ⚠️ 자리가 두 번 바뀌었다. 지우지 않는 옛 기록:
  //   ① ~2026-08-14: **인스펙터** [드릴 정보] 맨 끝. 첫 화면 표적 예산(40/40, 여유 0)을 한 칸도
  //      안 쓰려고 닫힌 시트 안에 뒀다. 둘째 손잡이는 [코트 비우기] 확인 모달 안이었다.
  //   ② 2026-08-14~08-27: **오른쪽 기능 바에 상시**. 전술판에서 인스펙터가 통째로 없어졌고
  //      (기현님: *"속성 탭은 정말 무용지물"*) 예산도 35 → 33 으로 여유가 늘어서다.
  //   ③ 2026-08-27~: **[보드 설정] 모달 안**(기현 지시로 [골대]·[속도]·[보기]가 함께 들어갔다).
  //
  // ⚠️ 그리고 **누르면 모달이 닫힌다.** 이것만 토글이 아니라 명령이라 결과가 판에 있는데,
  //    배경을 덮은 채로 두면 무엇이 일어났는지 볼 수 없다. 그래서 아래 포커스 계약도 바뀌었다 —
  //    옛 계약은 "누른 뒤에도 포커스가 그 버튼" 이었지만 이제 그 버튼은 사라진다.
  const openModal = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: '보드 설정' }));
    return screen.getByRole('button', { name: '골대 원위치' });
  };

  it('기능 바에는 이제 없다 — [보드 설정] 안에 있다', async () => {
    const { user } = await openBoard();
    expect(screen.queryByRole('button', { name: '골대 원위치' }), '모달을 열기 전에는 없다').toBeNull();
    await openModal(user);
    expect(screen.getByRole('button', { name: '골대 원위치' })).toBeInTheDocument();
  });

  it('누르면 world.resetGoals() 가 **1회** 불린다', async () => {
    const { user } = await openBoard();
    const btn = await openModal(user);
    expect(resetGoalsCalls.n, '누르기 전').toBe(0); // 대조군: "0회라서 통과" 가 아니다
    await user.click(btn);
    expect(resetGoalsCalls.n).toBe(1);
  });

  it('★ 누르면 모달이 닫힌다 — 결과가 판에 있으므로 배경을 비켜 줘야 한다', async () => {
    const { user } = await openBoard();
    const btn = await openModal(user);
    await user.click(btn);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '보드 설정' })).toBeNull());
  });

  it('연달아 두 번 누르면 2회다 — 한 번 누른 뒤 죽는 버튼이 아니다', async () => {
    const { user } = await openBoard();
    await user.click(await openModal(user));
    expect(resetGoalsCalls.n).toBe(1);
    // 모달이 닫혔으므로 다시 연다 — 그 자체가 위 '닫힌다' 계약의 대조군이다.
    await user.click(await openModal(user));
    expect(resetGoalsCalls.n).toBe(2);
  });
});

describe('대조군 — 비우기와 섞이지 않는다', () => {
  it('[코트 비우기] 확인 모달의 [비우기] 는 골대 복귀를 부르지 않는다', async () => {
    const { user } = await openBoard({ placed: true });
    await user.click(screen.getByRole('button', { name: '보드 설정' }));
    await user.click(await screen.findByRole('button', { name: '코트 비우기' }));
    await user.click(await screen.findByRole('button', { name: '비우기' }));
    expect(resetGoalsCalls.n).toBe(0);
  });

  it('모달 안에는 [골대만 원위치] 가 **없다** — 손잡이는 이제 하나뿐이다', async () => {
    const { user } = await openBoard({ placed: true });
    await user.click(screen.getByRole('button', { name: '보드 설정' }));
    await user.click(await screen.findByRole('button', { name: '코트 비우기' }));
    expect(screen.queryByRole('button', { name: '골대만 원위치' })).toBeNull();
  });
});

// ── 소스 계약 ────────────────────────────────────────────────────────────────────────────
// 위 동작 단언들은 "둘 다 결국 resetGoals 를 부른다" 까지만 보증한다. 나중에 누군가 한쪽에
// 자기 사본을 만들어 붙여도 그 단언은 전부 초록이고, **그때부터 두 손잡이의 규칙이 갈린다**
// (예: 막혔을 때 토스트를 한쪽만 띄운다). 그래서 **같은 참조를 넘기는가** 를 텍스트로 못박는다.
describe('소유권 — 핸들러는 하나다', () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'EditorWorkspace.tsx'), 'utf-8');

  it('EditorWorkspace 는 `onResetGoals={resetGoals}` 를 정확히 한 곳(기능 바)에 넘긴다', () => {
    // 2026-08-18 인스펙터 폐기로 둘째 손잡이(인스펙터 [드릴 정보] 맨 끝)가 사라졌다 —
    // 이제 받는 곳은 FunctionBar 하나다. 사본이 늘면 여기서 걸린다(위 머리말과 같은 이유).
    const passes = src.match(/onResetGoals=\{resetGoals\}/g) ?? [];
    expect(passes, `찾은 것: ${passes.length}개`).toHaveLength(1);
  });

  it('world.resetGoals() 호출부는 파일 안에 하나뿐이다 — 사본이 생기면 여기서 걸린다', () => {
    expect(src.match(/resetGoals\(\)/g) ?? []).toHaveLength(1);
  });
});
