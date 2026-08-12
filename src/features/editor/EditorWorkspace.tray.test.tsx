// 3.7 트레이 서랍의 **배선** 확인 — ToolRail.test.tsx 는 껍데기의 계약(props 를 주면 이렇게
// 움직인다)을, 여기서는 그 껍데기가 **실제 prefs · 실제 단축키 · 실제 드릴**과 이어져 있는지를
// 본다. §3 불변식 2 의 *"영구히"* 와 불변식 3 의 *"남의 드릴을 열면"* 은 이 층에서만 끝까지
// 관측된다: 컴포넌트 단위로는 `onTrayChange` 가 불렸다는 것까지가 한계고, 그 값이 정말
// localStorage 에 남아 다음 마운트에서 돌아오는지는 EditorWorkspace → SettingsProvider →
// storage/prefs 를 다 통과해야 알 수 있다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { loadPrefs, makeDefaultPrefs, PREFS_KEY } from '../../storage/prefs.ts';
import { resolveDrillRepo } from '../../storage/drillRepo.ts';
import { newId } from '../../core/ids.ts';
import type { ArrowId, DrillId, NoteId } from '../../core/ids.ts';
import type { Drill } from '../../model/drill.ts';
import { BoardScreen } from '../board/BoardScreen.tsx';

// stepTween.test.tsx 와 같은 목 — EditorScreen 이 AppShell 에서 쓰는 것은 useStageTarget 하나다.
let stageTarget: { kind: 'drill'; drillId: DrillId } = { kind: 'drill', drillId: 'dr_none' as DrillId };
vi.mock('../../app/AppShell.tsx', () => ({ useStageTarget: () => stageTarget }));

const { EditorScreen } = await import('./EditorScreen.tsx');

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

type Prefs = ReturnType<typeof makeDefaultPrefs>;
function seedPrefs(patch: Partial<Prefs> = {}): void {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), defaultCourtMode: 'full', ...patch }));
}

async function openBoard(patch: Partial<Prefs> = {}) {
  seedPrefs(patch);
  const user = userEvent.setup();
  render(<BoardScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  return user;
}

/** 화살표 하나만 있는 드릴 / 코트 메모 하나만 있는 드릴. **한쪽만** 넣는 것이 핵심이다 —
 *  둘 다 넣으면 두 서랍이 다 열려 "무엇이 무엇을 열었나" 를 못 읽는다. */
async function seedDrill(kind: 'arrow' | 'note'): Promise<void> {
  const { repo } = await resolveDrillRepo();
  const created = await repo.createDrill({ courtMode: 'full', formation: '1-2-1' });
  const s0 = {
    ...created.steps[0]!,
    arrows:
      kind === 'arrow'
        ? [{ id: newId('ar') as ArrowId, kind: 'move' as const, from: { x: 100, y: 100 }, ctrl: { x: 150, y: 125 }, to: { x: 200, y: 100 } }]
        : [],
    notes: kind === 'note' ? [{ id: newId('nt') as NoteId, text: '여기서 막는다', x: 120, y: 220 }] : [],
  };
  const drill: Drill = { ...created, steps: [s0] };
  await repo.putDrill(drill);
  stageTarget = { kind: 'drill', drillId: created.id };
}

async function openDrill(kind: 'arrow' | 'note', patch: Partial<Prefs> = {}) {
  seedPrefs(patch);
  await seedDrill(kind);
  render(<EditorScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
}

const handle = (label: '작도' | '설명') => screen.getByRole('button', { name: new RegExp(`^${label}`) });
const expanded = (label: '작도' | '설명') => handle(label).getAttribute('aria-expanded');

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
});

describe('3.7 서랍 개폐가 prefs 를 실제로 오간다', () => {
  it('저장된 개폐로 판이 선다 — 작도만 열린 채, 설명은 닫힌 채(대조군)', async () => {
    await openBoard({ tray: { draw: true, note: false } });
    expect(expanded('작도')).toBe('true');
    expect(screen.getByRole('button', { name: /^이동/ })).toBeInTheDocument();
    expect(expanded('설명')).toBe('false');
  });

  it('손잡이로 연 서랍이 localStorage 에 남는다 — 다음 실행에서 그대로 선다', async () => {
    const user = await openBoard();
    expect(loadPrefs().tray).toEqual({ draw: false, note: false });
    await user.click(handle('설명'));
    await waitFor(() => expect(loadPrefs().tray).toEqual({ draw: false, note: true }));
    // 저장이 **이웃 필드를 안 밟는다** — patch 병합이 아니라 통째 덮어쓰기면 여기서 잡힌다.
    expect(loadPrefs().defaultCourtMode).toBe('full');
  });

  it('단축키 R 은 닫힌 서랍에서도 살아 있고, 그 순간 개방이 prefs 에 남는다(§3 불변식 2)', async () => {
    // "잠긴 기능 0개" 의 본체다. 단축키로 도구는 켜졌는데 서랍이 닫혀 있으면 활성 도구가
    // 화면에 없고, 개방이 세션 안에서만 살면 그 '영구히' 는 앱을 닫는 순간 사라진다.
    const user = await openBoard();
    expect(expanded('작도')).toBe('false');
    await user.keyboard('r');
    expect(expanded('작도')).toBe('true');
    expect(screen.getByRole('button', { name: /^이동/ })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(loadPrefs().tray).toEqual({ draw: true, note: false }));
    expect(expanded('설명'), '엉뚱한 서랍이 함께 열렸다').toBe('false');
  });

  it('단축키 T 는 설명 서랍을 연다 — 도구마다 자기 서랍이다(반대 방향)', async () => {
    const user = await openBoard();
    await user.keyboard('t');
    expect(expanded('설명')).toBe('true');
    await waitFor(() => expect(loadPrefs().tray).toEqual({ draw: false, note: true }));
    expect(expanded('작도')).toBe('false');
  });
});

describe('3.7 남의 드릴을 열면 필요한 서랍이 준비돼 있다 (§3 불변식 3)', () => {
  it('화살표를 쓰는 드릴을 열면 작도가 열린 채로 선다 — 설명은 닫힌 채(대조군)', async () => {
    // 고급자가 만든 것을 초보자가 받아 여는 순간이다: *"이 드릴에 있는 것을 나는 왜 못
    // 만드나"* 가 생기지 않게, 그 드릴이 쓰는 도구가 이미 꺼내져 있어야 한다.
    await openDrill('arrow');
    expect(expanded('작도')).toBe('true');
    expect(expanded('설명')).toBe('false');
  });

  it('코트 메모를 쓰는 드릴을 열면 설명이 열린 채로 선다(반대 방향)', async () => {
    await openDrill('note');
    expect(expanded('설명')).toBe('true');
    expect(expanded('작도')).toBe('false');
  });

  it('대조군: 빈 전술판은 두 서랍 다 닫힌 채로 선다 — 아무 때나 열리는 것이 아니다', async () => {
    // 이게 없으면 "드릴을 열면 열린다" 는 "언제나 열려 있다" 로도 통과한다.
    await openBoard();
    expect(expanded('작도')).toBe('false');
    expect(expanded('설명')).toBe('false');
  });
});
