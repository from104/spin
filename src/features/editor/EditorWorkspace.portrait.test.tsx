// 2026-08-14 P5 — **세로 화면의 통합 배선.** 순수 함수(trayBand.test.ts)와 ToolRail 단독
// 렌더(ToolRail.band.test.tsx)가 각각 참이어도, 그 둘을 잇는 사슬이 끊기면 화면은 조용히
// 옛 모양으로 남는다. 여기서는 **실제 판을 세로로 열어** 본다.
//
// ⚠️ 이 파일이 세우는 세 번째 겹은 `rot` 배선이다: EditorWorkspace 가 `portrait` 를 예산에
// 안 넘기거나 useStageRot 이 이펙트 사본에서 그것을 떨어뜨리면, 768×1024 세로에서 판이
// **거꾸로 눕는다**(rot 90). 소스 문자열이 아니라 viewBox 로 잡는 것이 요점이다.
//
// 넓은 창(가로)의 바이트 동일은 EditorWorkspace.narrow.test.tsx 가 sha256 으로 계속 지킨다 —
// 그 파일은 이번 단계에서 **한 글자도 안 고쳤고** 무변경으로 통과한다. 여기 스냅샷은 세로
// 경로의 **첫** 뼈대라 갱신이 아니라 신설이다.
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../../store/settings/SettingsProvider.tsx';
import { LibraryProvider } from '../../store/library/LibraryProvider.tsx';
import { ToastProvider } from '../../store/toast/ToastProvider.tsx';
import { AppNavProvider } from '../../app/useAppHistory.ts';
import type { AppHistoryApi } from '../../app/useAppHistory.ts';
import { AppHeader, HeaderProvider } from '../../app/AppHeader.tsx';
import { LiveRegion } from '../../ui/LiveRegion.tsx';
import { makeDefaultPrefs, PREFS_KEY } from '../../storage/prefs.ts';
import { COURT_DEFS } from '../../model/court.ts';
import { BoardScreen } from '../board/BoardScreen.tsx';

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

/** jsdom 에는 matchMedia 가 없다. 안 깔면 두 분기 boolean 이 둘 다 false 로 굳어 **세로 경로가
 *  한 줄도 실행되지 않은 채** 스위트가 초록이 된다(narrow.test.tsx 의 같은 이름 스텁과 같은 이유). */
function stubMedia({ portrait, narrow }: { portrait: boolean; narrow: boolean }) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (q: string) => ({
      matches: q.includes('portrait') ? portrait : q.includes('max-width') ? narrow : false,
      media: q,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    }),
  });
}

const ORIGINAL = { w: window.innerWidth, h: window.innerHeight };

function setViewport(w: number, h: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: h });
}

afterEach(() => {
  setViewport(ORIGINAL.w, ORIGINAL.h);
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
});

async function openBoard(): Promise<HTMLElement> {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), defaultCourtMode: 'full' }));
  render(<BoardScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  const main = document.getElementById('main')!;
  // TransformWriter 는 React 밖에서 rAF 로 transform 을 직접 쓴다(§6.1 규칙 1) — 판이 한 번
  // 그려진 뒤에 읽는다(narrow.test.tsx 가 같은 이유로 같은 대기를 건다).
  await waitFor(() => expect(main.querySelector('.goal-post')).toHaveAttribute('transform'));
  return main;
}

const tray = () => screen.getByRole('navigation', { name: '도구' });
/** 판 덩어리(P4) — 코트 칸과 트레이를 테두리 하나로 묶은 그 상자. */
const board = (main: HTMLElement) => main.querySelector<HTMLElement>('[data-board]')!;

/** 상자들의 인라인 style 만 남긴다(narrow.test.tsx 와 같은 규칙) — 코트 `<svg>` 안쪽은
 *  크롬 예산의 대상이 아니고, 넣으면 좌표 한 자리가 바뀔 때마다 이 파일이 대신 빨개진다. */
function layoutSkeleton(root: HTMLElement): string {
  const out: string[] = [];
  const walk = (el: Element, depth: number): void => {
    if (el.tagName.toLowerCase() === 'svg') return;
    const style = el.getAttribute('style');
    if (style) out.push(`${'· '.repeat(depth)}${el.tagName.toLowerCase()} ${style}`);
    for (const child of el.children) walk(child, depth + 1);
  };
  walk(root, 0);
  return out.join('\n');
}

const BAND_2ROW_CSS = 'calc((var(--hit) - 8px) * 1.5 + 6px + max(50px, var(--hit)) + 22px)';

describe('세로 480×800 — 트레이가 판 아래 2행 띠가 된다', () => {
  it('판 덩어리가 세로로 쌓이고 트레이가 그 아래 띠다', async () => {
    setViewport(480, 800);
    stubMedia({ portrait: true, narrow: true });
    const main = await openBoard();
    expect(main.style.flexDirection, '세로 배치가 안 잡혔다').toBe('column');
    expect(board(main).style.flexDirection).toBe('column');
    // 판 덩어리의 자식은 여전히 정확히 둘이다(코트 칸 · 트레이) — P3·P4 의 그 계약.
    expect(board(main).children).toHaveLength(2);
    expect(board(main).children[1]).toBe(tray());
  });

  it('★ 띠에 2행 높이·wrap·세로 스크롤이 모두 걸려 있다', async () => {
    setViewport(480, 800);
    stubMedia({ portrait: true, narrow: true });
    await openBoard();
    expect(tray().style.height).toBe(BAND_2ROW_CSS);
    expect(tray().style.flexWrap).toBe('wrap');
    expect(tray().style.alignContent).toBe('flex-start');
    expect(tray().style.overflowY).toBe('auto');
    expect(tray().style.flexDirection).toBe('row');
    expect(tray().style.justifyContent).toBe('flex-start');
  });

  it('대조군 — 가로 1024×600 에서는 셋 중 하나도 안 걸린다(기둥이다)', async () => {
    setViewport(1024, 600);
    stubMedia({ portrait: false, narrow: true });
    const main = await openBoard();
    expect(board(main).style.flexDirection).toBe('row');
    expect(tray().style.height).toBe('');
    expect(tray().style.flexWrap).toBe('');
    expect(tray().style.overflowY).toBe('');
    expect(tray().style.flexDirection).toBe('column');
  });

  it('세로에서 판이 선다 — 480×800 은 rot 90 이라 코트 칸 비율이 뒤집힌다', async () => {
    setViewport(480, 800);
    stubMedia({ portrait: true, narrow: true });
    const main = await openBoard();
    const cell = board(main).children[0] as HTMLElement;
    expect(cell.style.aspectRatio).toBe(`${COURT_DEFS.full.vbH} / ${COURT_DEFS.full.vbW}`);
    expect(main.querySelector('svg')!.getAttribute('viewBox')).toBe(`0 0 ${COURT_DEFS.full.vbH} ${COURT_DEFS.full.vbW}`);
    // 세로에서 코트 칸은 폭을 다 쓰고 높이를 비율로 받는다(가로 기둥과 축이 정확히 뒤집힌다).
    expect(cell.style.width).toBe('100%');
    expect(cell.style.height).toBe('');
  });

  it('★ 768×1024 아이패드 세로 — 판이 **안 돈다**. portrait 배선이 끊기면 여기가 빨개진다', async () => {
    // 이 창에서 옳은 답은 0 이고, `portrait` 를 예산에 안 넘기면 90 이 된다(근거·숫자는
    // app/useStageRot.portrait.test.ts). 배선은 두 군데가 다 있어야 한다 — EditorWorkspace 의
    // 호출 인자와 useStageRot 의 이펙트 사본. 어느 한쪽만 빠져도 여기서 잡힌다.
    setViewport(768, 1024);
    stubMedia({ portrait: true, narrow: true });
    const main = await openBoard();
    expect(main.querySelector('svg')!.getAttribute('viewBox')).toBe(`0 0 ${COURT_DEFS.full.vbW} ${COURT_DEFS.full.vbH}`);
    expect((board(main).children[0] as HTMLElement).style.aspectRatio).toBe(
      `${COURT_DEFS.full.vbW} / ${COURT_DEFS.full.vbH}`,
    );
    // 그래도 트레이는 띠다 — 회전과 배치는 **다른 판정**이다(useIsPortrait.ts 머리말).
    expect(tray().style.height).toBe(BAND_2ROW_CSS);
  });

  it('세로 경로의 상자 뼈대', async () => {
    setViewport(480, 800);
    stubMedia({ portrait: true, narrow: true });
    const main = await openBoard();
    expect(layoutSkeleton(main)).toMatchSnapshot();
  });
});
