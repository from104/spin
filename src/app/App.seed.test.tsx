// §3 seed 드릴 배선(3.8) — `SeedDrills` 조각이 **실제 Provider 두 개 사이에서** 도는지.
// 컴포넌트 밖의 규칙(1회성·중복 방지)은 `storage/seed.test.ts` 가 이미 지키므로, 여기서 보는
// 것은 그 규칙이 화면까지 이어지는 마지막 다리다: 목록이 갱신되는가 · 도장이 localStorage 에
// 남는가 · StrictMode 이중 마운트에서 두 벌이 되지 않는가 · **판을 건드리지 않는가.**
import { StrictMode } from 'react';
import type { ReactNode } from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { SeedDrills } from './App.tsx';
import { SettingsProvider } from '../store/settings/SettingsProvider.tsx';
import { LibraryProvider, useLibraryState } from '../store/library/LibraryProvider.tsx';
import { idbDrillRepo, type DrillRepo } from '../storage/drillRepo.ts';
import { BOARD_KEY } from '../storage/board.ts';
import { PREFS_KEY, loadPrefs, makeDefaultPrefs, savePrefs } from '../storage/prefs.ts';

async function wipe(repo: DrillRepo): Promise<void> {
  for (const s of await repo.listDrillSummaries()) await repo.deleteDrill(s.id);
}

/** 목록 상태를 화면에 낸다 — "저장소에 있는가" 가 아니라 **"목록이 다시 읽혔는가"** 를 본다. */
function Probe() {
  const { drills, status } = useLibraryState();
  return (
    <div>
      <span data-testid="count">{drills.length}</span>
      <span data-testid="status">{status}</span>
      <span data-testid="levels">{drills.map((d) => d.level).join(',')}</span>
    </div>
  );
}

const tree = (children: ReactNode) => (
  <SettingsProvider>
    <LibraryProvider>
      <SeedDrills />
      {children}
    </LibraryProvider>
  </SettingsProvider>
);

beforeEach(async () => {
  await wipe(idbDrillRepo);
  localStorage.clear();
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('SeedDrills — 첫 실행', () => {
  it('세 개를 심고 목록이 그것을 읽는다', async () => {
    render(tree(<Probe />));
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('3'));
    expect(screen.getByTestId('levels')).toHaveTextContent('초급,중급,고급');
  });

  it('도장이 localStorage 에 남는다 — 다음 실행이 이걸 보고 안 심는다', async () => {
    render(tree(<Probe />));
    await waitFor(() => expect(loadPrefs().seeded).toBe(true));
    // 도장은 prefs 문서 안이고, 부트 스크립트가 전제하는 theme 최상위 문자열은 그대로다.
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY)!) as { seeded: boolean; theme: string };
    expect(raw.seeded).toBe(true);
    expect(typeof raw.theme).toBe('string');
  });

  it('**판을 건드리지 않는다** — 전술판은 빈 코트로 시작한다(2026-08-10 기현 지시)', async () => {
    localStorage.setItem(BOARD_KEY, 'SENTINEL');
    render(tree(<Probe />));
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('3'));
    expect(localStorage.getItem(BOARD_KEY)).toBe('SENTINEL');
  });
});

describe('SeedDrills — 두 번째 실행', () => {
  it('도장이 찍혀 있으면 아무것도 심지 않는다', async () => {
    savePrefs({ ...makeDefaultPrefs(), seeded: true });
    render(tree(<Probe />));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('count')).toHaveTextContent('0');
    expect(await idbDrillRepo.countDrills()).toBe(0);
  });

  it('사용자가 지운 뒤 다시 열어도 되살아나지 않는다', async () => {
    const first = render(tree(<Probe />));
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('3'));
    first.unmount();

    await wipe(idbDrillRepo); // 사용자가 셋 다 지웠다
    render(tree(<Probe />));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });
});

describe('SeedDrills — 두 번 도는 것을 막는다', () => {
  it('StrictMode 이중 마운트에서도 세 개다 (여섯 개가 아니다)', async () => {
    // 쓰기 횟수를 직접 센다 — 저장소 개수만 보면 "두 번 썼는데 같은 자리에 덮어썼다" 와
    // "한 번만 썼다" 가 구분되지 않는다(seed 드릴은 부를 때마다 새 id 라 실제로는 6개가 되지만,
    // 그 구분을 우연에 맡기지 않는다).
    const spy = vi.spyOn(idbDrillRepo, 'putDrill');
    render(<StrictMode>{tree(<Probe />)}</StrictMode>);
    await waitFor(() => expect(screen.getByTestId('count')).toHaveTextContent('3'));
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(spy).toHaveBeenCalledTimes(3);
    expect(await idbDrillRepo.countDrills()).toBe(3);
  });
});

describe('SeedDrills — 실패했을 때', () => {
  it('심기가 실패하면 도장을 찍지 않는다 — 다음 실행에서 다시 시도한다', async () => {
    const spy = vi.spyOn(idbDrillRepo, 'putDrill').mockRejectedValue(new Error('quota'));
    render(tree(<Probe />));
    await waitFor(() => expect(spy).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('ready'));
    expect(loadPrefs().seeded).toBe(false);
    expect(await idbDrillRepo.countDrills()).toBe(0);
  });

  it('대조군 — 같은 배선에서 실패가 없으면 도장이 찍힌다', async () => {
    render(tree(<Probe />));
    await waitFor(() => expect(loadPrefs().seeded).toBe(true));
  });
});
