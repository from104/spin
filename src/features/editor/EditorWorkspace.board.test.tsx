// P3/P4 — **판 덩어리 `[data-board]`** 의 DOM·소스 계약 (설계서 §4.1·§4.4·§4.5).
//
// boardLayout.test.ts 가 숫자를 증명하고, 여기서는 **그 계산이 화면과 같은 규칙을 재고 있는지**를
// 못박는다. 순수 함수만 두면 자기 사본을 증명하는 것이고, DOM 만 보면 숫자가 없다.
//
// jsdom 은 레이아웃도 CSS 파일도 계산하지 않으므로 여기서 볼 수 있는 것은 **인라인 style 의 유무**
// 뿐이다. 그런데 "인접축 빈틈 0" 의 실체가 정확히 그 유무다 — 판 덩어리에 gap·padding 이 없고
// 코트 칸에 오른쪽 여백·테두리가 없으면, 두 칸은 flex 규칙상 맞닿을 수밖에 없다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
import { courtCellAspectRatioCss } from './boardLayout.ts';
import { TRAY_SECTIONS } from './trayMetrics.ts';
import type { CourtMode } from '../../model/court.ts';

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

/** jsdom 에는 matchMedia 가 없다 — 안 깔면 세로·좁음 두 boolean 이 **둘 다 false** 로 굳어
 *  세로 경로가 한 줄도 실행되지 않은 채 스위트가 초록불이 된다(narrow.test.tsx 의 같은 스텁). */
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

async function openBoard(courtMode: CourtMode = 'full') {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), defaultCourtMode: courtMode }));
  const user = userEvent.setup();
  render(<BoardScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  const main = document.getElementById('main')!;
  return { user, main, board: main.querySelector<HTMLElement>('[data-board]')! };
}

const courtCell = (board: HTMLElement): HTMLElement => board.children[0] as HTMLElement;

/** jsdom 기본 창(1024×768). 세로 테스트가 창을 갈아 끼우므로 매번 되돌린다 — 안 되돌리면
 *  뒤 테스트가 480×800 창에서 돌아 rot 이 조용히 90 이 된다(useStageRot 은 창 크기를 읽는다). */
const setViewport = (w: number, h: number): void => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: w });
  Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: h });
};

beforeEach(() => {
  localStorage.clear();
  setViewport(1024, 768);
});
afterEach(() => {
  localStorage.clear();
  setViewport(1024, 768);
  vi.restoreAllMocks();
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
});

describe('★ 판 덩어리 — 코트 칸과 트레이가 맞닿는다 (§4.1)', () => {
  it('판 덩어리의 자식은 정확히 둘이고, 코트 칸 바로 뒤가 트레이다', async () => {
    stubMedia({ portrait: false, narrow: false });
    const { board } = await openBoard();
    expect(board, '[data-board] 를 못 찾았다').not.toBeNull();
    expect(board.children).toHaveLength(2);
    expect(courtCell(board).tagName).toBe('DIV');
    expect(board.children[1]!.getAttribute('data-tray')).toBe('');
    // 트레이가 판 덩어리 **안**이어야 두 칸이 같은 flex 라인에 선다.
    expect(board.contains(screen.getByRole('navigation', { name: '도구' }))).toBe(true);
  });

  it('두 칸 사이에 자리를 만드는 선언이 하나도 없다 — 이것이 "빈틈 0" 의 실체다', async () => {
    stubMedia({ portrait: false, narrow: false });
    const { board } = await openBoard();
    // 판 덩어리: gap·padding 이 없다. 하나라도 생기면 코트와 벤치 사이가 그만큼 벌어진다.
    expect(board.style.gap, '판 덩어리에 gap 이 생겼다 — 칩이 코트에서 떨어진다').toBe('');
    expect(board.style.padding).toBe('');
    expect(board.style.paddingRight).toBe('');
    // 코트 칸: 오른쪽에 여백·테두리가 없다.
    const cell = courtCell(board);
    for (const prop of ['margin', 'marginRight', 'padding', 'paddingRight', 'borderRight'] as const) {
      expect(cell.style[prop], `코트 칸에 ${prop} 이 생겼다`).toBe('');
    }
    // 트레이: 왼쪽에 여백이 없다(홈은 inset box-shadow 라 자리를 안 먹는다).
    const tray = board.children[1] as HTMLElement;
    expect(tray.style.marginLeft).toBe('');
    expect(tray.style.boxShadow).toContain('inset');
  });

  it('코트 칸은 종횡비로 크기를 정하고 트레이는 남는 폭을 먹는다', async () => {
    stubMedia({ portrait: false, narrow: false });
    const { board } = await openBoard();
    const cell = courtCell(board);
    // 가로 배치: 세로를 다 쓰고 폭은 종횡비가 정한다.
    expect(cell.style.height).toBe('100%');
    expect(cell.style.aspectRatio).toBe(courtCellAspectRatioCss('full', undefined, 0));
    expect(cell.style.aspectRatio).toBe('825 / 525');
    // 함정 2 — minWidth:0 이 없으면 min-width:auto 가 shrink 를 막아 폭 제약에서 넘친다.
    expect(cell.style.minWidth).toBe('0px');
    expect(cell.style.minHeight).toBe('0px');
    expect(cell.style.flex).toBe('0 1 auto');
    // 함정 1 — 트레이 base 는 0 이어야 한다.
    const tray = board.children[1] as HTMLElement;
    expect(tray.style.flex).toBe('1 1 0px');
    expect(tray.style.width, '폭을 못박으면 남는 폭이 트레이로 못 온다').toBe('');
  });

  it('코트 종류가 바뀌면 종횡비도 바뀐다 — def 를 실제로 읽고 있다(대조군)', async () => {
    stubMedia({ portrait: false, narrow: false });
    const { board } = await openBoard('half');
    expect(courtCell(board).style.aspectRatio).toBe(courtCellAspectRatioCss('half', undefined, 0));
    expect(courtCell(board).style.aspectRatio).toBe('525 / 450');
  });

  it('세로 화면에서는 축이 통째로 뒤집힌다 — 폭을 다 쓰고 띠가 아래에 붙는다', async () => {
    // 480×800 세로: rot 90 이라 종횡비도 뒤집힌다(825/525 → 525/825).
    stubMedia({ portrait: true, narrow: true });
    setViewport(480, 800);
    const { board } = await openBoard();
    expect(board.style.flexDirection).toBe('column');
    const cell = courtCell(board);
    expect(cell.style.width).toBe('100%');
    expect(cell.style.height).toBe('');
    expect(cell.style.aspectRatio).toBe(courtCellAspectRatioCss('full', undefined, 90));
    expect(cell.style.aspectRatio).toBe('525 / 825');
    // 띠는 여전히 판 덩어리 안 두 번째 칸이다 — 인접축만 세로로 바뀐다.
    expect(board.children[1]!.getAttribute('data-tray')).toBe('');
  });

  it('실제 화면의 트레이 구역이 6개다 — trayFixedHeightPx 가 gap 5칸을 세는 근거', async () => {
    // 줌 · 구분선 · 벤치 · 구분선 · 도구 · 코트 이름. 이 개수가 바뀌면 고정 합 식의 gap 항이
    // 어긋나고, 그 식은 **여전히 옛 숫자를 답한다**(계기가 거짓말하는 형태).
    stubMedia({ portrait: false, narrow: false });
    const { board } = await openBoard();
    expect((board.children[1] as HTMLElement).children).toHaveLength(TRAY_SECTIONS);
  });

  it('대조군: 가로 화면은 안 뒤집힌다 — 두 배치를 뭉뚱그리지 않는다', async () => {
    stubMedia({ portrait: false, narrow: false });
    const { board } = await openBoard();
    expect(board.style.flexDirection).toBe('row');
    expect(courtCell(board).style.width).toBe('');
  });
});

describe('함정 3 — 줌과 인스펙터가 트레이 폭·칩 자리를 흔들지 않는다 (§3 불변식 1)', () => {
  // `aspect-ratio` 를 `view`(줌이 갈아 끼우는 viewBox)나 측정된 rect 에서 뽑으면 여기가 깨진다.
  // ⚠️ 정직하게 적어 둔다: 지금의 `zoomAt` 은 `w = vbW/z, h = vbH/z` 라 view 의 **종횡비 자체는
  //    줌으로 안 변한다**(useStageMetrics.ts:123-131 실측). 그래서 이 it 이 잡는 것은 "줌이
  //    종횡비를 흔드는 구현" 이 아니라 **측정·상태에서 뽑는 구현**이다(jsdom rect 는 늘 0×0 이라
  //    rect 파생이면 여기서 곧바로 빈 값·NaN 이 된다). 값이 아니라 **의존**이 계약이라는 뜻은
  //    boardLayout.ts 의 그 함수 주석에 적어 뒀고, 소스 계약(아래 절)이 그 몫을 함께 진다.
  it('확대 3회 뒤에도 트레이 style·코트 칸 종횡비·칩 순서가 한 글자도 안 바뀐다', async () => {
    stubMedia({ portrait: false, narrow: false });
    const { user, main, board } = await openBoard();
    const tray = board.children[1] as HTMLElement;
    const svg = main.querySelector('svg')!;
    const snap = () => ({
      tray: tray.getAttribute('style'),
      ar: courtCell(board).style.aspectRatio,
      chips: [...tray.querySelectorAll<HTMLElement>('button[aria-label$="선수 배치"]')].map(
        (b) => `${b.getAttribute('aria-label')}|${b.getAttribute('style')}`,
      ),
    });
    const before = snap();
    expect(before.chips.length).toBeGreaterThan(0);
    const viewW = (): number => Number(svg.getAttribute('viewBox')!.split(' ')[2]);
    const w0 = viewW();

    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: '확대' }));
    // 대조군: 줌이 **실제로** 걸렸는지 먼저 본다. 안 걸렸으면 아래 '불변' 은 공짜다.
    expect(viewW(), '확대가 무대에 안 닿았다 — 아래 불변 단언이 헛것이 된다').toBeLessThan(w0);
    expect(snap()).toEqual(before);

    // 오버레이 인스펙터를 열고 닫아도 마찬가지다(열면 `<main>` 폭 판정이 다시 돈다).
    await user.click(screen.getByRole('button', { name: '속성' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '속성' })).toHaveAttribute('aria-expanded', 'true'));
    expect(snap()).toEqual(before);
    await user.click(screen.getByRole('button', { name: '속성' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '속성' })).toHaveAttribute('aria-expanded', 'false'));
    expect(snap()).toEqual(before);
  });
});

describe('§4.5 edge-pan 게이트 — 판 위에 흐름 밖 요소가 없다', () => {
  // 코트 네 변의 56px 고무줄 띠(edgePanBandPx)와 자리를 다투는 것이 하나도 없어야 한다.
  // 누가 오버레이를 되돌리면 즉시 빨간불이 나는 것이 이 게이트의 목적이다.
  it('코트 칸 안에 position:absolute|fixed 가 0 이다', async () => {
    stubMedia({ portrait: false, narrow: false });
    const { board } = await openBoard();
    const floating = [...courtCell(board).querySelectorAll<HTMLElement>('*')].filter(
      (el) => el.style.position === 'absolute' || el.style.position === 'fixed',
    );
    expect(floating.map((el) => el.tagName)).toEqual([]);
  });

  it('판 덩어리 안의 흐름 밖 요소는 전부 aria-hidden 장식이고, 표적은 하나도 없다', async () => {
    // 트레이 안 배지(RemainingBadge)·활성 링(ActiveRing)은 버튼 **안쪽** 장식이라 남는다 —
    // 코트 <svg> 안쪽 장식과 같은 부류다. 남으면 안 되는 것은 **누를 수 있는 것**이다.
    stubMedia({ portrait: false, narrow: false });
    const { board } = await openBoard();
    const floating = [...board.querySelectorAll<HTMLElement>('*')].filter(
      (el) => el.style.position === 'absolute' || el.style.position === 'fixed',
    );
    expect(floating.length, '장식이 하나도 없다 — 선택자가 낡았을 수 있다').toBeGreaterThan(0);
    for (const el of floating) {
      expect(el.closest('[aria-hidden="true"]'), `${el.tagName} 이 장식이 아니다`).not.toBeNull();
      expect(el.closest('button, a[href], input, [role="button"]')?.contains(el) ?? false).toBe(true);
    }
  });
});

describe('소스 계약 — 종횡비의 출처가 def 하나다 (§4.1 함정 3 · §4.2 단방향)', () => {
  const read = (p: string): string => readFileSync(resolve(process.cwd(), p), 'utf-8');
  /** 주석은 세지 않는다 — 옛 결정 기록을 지우도록 압력을 주지 않기 위해서다(useStageRot.test 의 관례). */
  const codeOf = (src: string): string =>
    src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((l) => !l.trim().startsWith('//'))
      .join('\n');

  it('판을 조립하는 파일은 종횡비를 courtCellAspectRatioCss 에서만 받는다', () => {
    const code = codeOf(read('src/features/editor/EditorWorkspace.tsx'));
    expect(code).toContain('courtCellAspectRatioCss(drill.courtMode, drill.courtSize, stageRot)');
    // `aspectRatio:` 가 쓰이는 자리는 하나뿐이고, 그 값이 위 상수다.
    expect(code.match(/aspectRatio:/g)).toHaveLength(1);
    expect(code).toContain('aspectRatio: courtAspect');
  });

  it('판을 조립하는 파일은 아무것도 재지 않는다 — 되먹임 고리가 닫힐 자리가 없다', () => {
    const code = codeOf(read('src/features/editor/EditorWorkspace.tsx'));
    for (const forbidden of ['getBoundingClientRect', 'ResizeObserver', 'refreshMetrics()']) {
      expect(code, `${forbidden} 가 판 조립부에 들어왔다 — 측정 → 크기 결정 되먹임이다`).not.toContain(forbidden);
    }
  });

  it('종횡비 함수 자신도 rect·view 를 안 본다', () => {
    const code = codeOf(read('src/features/editor/boardLayout.ts'));
    for (const forbidden of ['getBoundingClientRect', 'StageView', 'metrics']) {
      expect(code, forbidden).not.toContain(forbidden);
    }
    expect(code).toContain('courtDefFor');
  });
});
