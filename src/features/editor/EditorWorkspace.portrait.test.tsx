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
  // tutorialsSeen.board 를 미리 채운다 — 안 그러면 튜토리얼 스포트라이트가 자동으로 떠 뼈대
  // 스냅샷이 매번 달라진다(§0.5, tutorialSteps.ts).
  localStorage.setItem(
    PREFS_KEY,
    JSON.stringify({ ...makeDefaultPrefs(), defaultCourtMode: 'full', tutorialsSeen: { board: true } }),
  );
  render(<BoardScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  const main = document.getElementById('main')!;
  // TransformWriter 는 React 밖에서 rAF 로 transform 을 직접 쓴다(§6.1 규칙 1) — 판이 한 번
  // 그려진 뒤에 읽는다(narrow.test.tsx 가 같은 이유로 같은 대기를 건다).
  await waitFor(() => expect(main.querySelector('.goal-post')).toHaveAttribute('transform'));
  return main;
}

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



describe('트레이는 코트 긴 변에 붙는다 — 가로 창이면 아래 띠, 세로 창이면 오른쪽 기둥', () => {
  // ⚠️ 2026-08-14 기현님 재설계로 이 파일의 전제가 **정반대로** 뒤집혔다. 옛 제목은
  // *"세로 480×800 — 트레이가 판 아래 2행 띠가 된다"* 였다. 코트 셋은 viewBox 가 전부 가로로
  // 길어서, 창이 가로면 판이 눕고(긴 변이 아래) 창이 세로면 판이 선다(긴 변이 오른쪽).
  it('가로 1024×600 — 판 덩어리가 세로로 쌓이고 트레이가 그 아래 띠다', async () => {
    stubMedia({ portrait: false, narrow: true });
    setViewport(1024, 600);
    const main = await openBoard();
    const box = board(main);
    expect(box.style.flexDirection, '가로 배치가 안 잡혔다').toBe('column');
    const tray = box.children[1] as HTMLElement;
    expect(tray.getAttribute('data-tray')).toBe('');
    expect(tray.style.flexDirection).toBe('row');
  });

  it('★ 띠에 1행 높이·nowrap·가로 스크롤이 모두 걸려 있다', async () => {
    stubMedia({ portrait: false, narrow: true });
    setViewport(1024, 600);
    const main = await openBoard();
    const box = board(main);
    const tray = box.children[1] as HTMLElement;
    // 높이가 고정이라야 줄이 몇 개로 흐르든 코트가 받는 상자가 안 변한다.
    expect(tray.style.height).toBe('calc(max(50px, var(--hit)) + 16px)');
    expect(tray.style.flexWrap).toBe('nowrap');
    expect(tray.style.overflowX, '1행이 넘칠 때 유일한 도달 경로다').toBe('auto');
  });

  it('대조군 — 세로 480×800 에서는 셋 중 하나도 안 걸린다(기둥이다)', async () => {
    stubMedia({ portrait: true, narrow: true });
    setViewport(480, 800);
    const main = await openBoard();
    const box = board(main);
    expect(box.style.flexDirection).toBe('row');
    const tray = box.children[1] as HTMLElement;
    expect(tray.style.height).toBe('');
    expect(tray.style.flexDirection).toBe('column');
  });

  it('세로에서 판이 선다 — 480×800 은 rot 90 이라 코트 칸 비율이 뒤집힌다', async () => {
    stubMedia({ portrait: true, narrow: true });
    setViewport(480, 800);
    const main = await openBoard();
    const box = board(main);
    const cell = box.children[0] as HTMLElement;
    expect(cell.style.height, '기둥 배치에서는 코트 칸이 세로를 다 쓴다').toBe('100%');
    expect(cell.style.aspectRatio).toBe('525 / 825');
    expect(document.querySelector('svg.stage-svg')!.getAttribute('viewBox')).toBe('0 0 525 825');
  });

  it('★ 768×1024 아이패드 세로 — 여기서도 선다. 배선이 끊기면 빨개진다', async () => {
    // 옛 기록: 띠가 세로 화면의 것이던 시절에는 이 기기에서 판이 **안 돌았다**(0). 배치 축이
    // 뒤집히면서 답도 뒤집혔다 — 폭 768 에서 트레이 기둥·기능 바를 빼면 세운 쪽이 이긴다.
    stubMedia({ portrait: true, narrow: true });
    setViewport(768, 1024);
    await openBoard();
    expect(document.querySelector('svg.stage-svg')!.getAttribute('viewBox')).toBe('0 0 525 825');
  });

  it('세로 경로의 상자 뼈대', async () => {
    setViewport(480, 800);
    stubMedia({ portrait: true, narrow: true });
    const main = await openBoard();
    expect(layoutSkeleton(main)).toMatchSnapshot();
  });
});
