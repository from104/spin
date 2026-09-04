// P3 — **판 덩어리 `[data-board]`** 의 DOM·소스 계약 (설계서 §4.1·§4.5).
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
import { saveBoard } from '../../storage/board.ts';
import { createDrill } from '../../model/defaults.ts';
import { BoardScreen } from '../board/BoardScreen.tsx';
import { courtCellAspectRatioCss } from './boardLayout.ts';
import { TRAY_SECTIONS } from './trayMetrics.ts';
import { courtDefFor, type CourtMode } from '../../model/court.ts';
import * as placement from './placement.ts';

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
  localStorage.setItem(PREFS_KEY, JSON.stringify(makeDefaultPrefs()));
  // prefs.defaultCourtMode 는 2026-08-21 폐기 — full 아닌 코트는 스냅샷(부팅 ②)으로 심는다.
  if (courtMode !== 'full') saveBoard(createDrill({ courtMode, empty: true }));
  const user = userEvent.setup();
  render(<BoardScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  const main = document.getElementById('main')!;
  return { user, main, board: main.querySelector<HTMLElement>('[data-board]')! };
}

const courtCell = (board: HTMLElement): HTMLElement => board.children[0] as HTMLElement;

/** 코트 칸이 선언한 종횡비(폭/높이). `'825 / 525'` → 1.571… */
const aspectOf = (cell: HTMLElement): number => {
  const [w, h] = cell.style.aspectRatio.split('/').map((s) => Number(s.trim()));
  return w! / h!;
};

/** jsdom 은 레이아웃을 계산하지 않는다(rect 가 전부 0) — 그래서 코트 칸의 상자를 **선언된
 *  style 에서** 만든다. 규칙은 둘뿐이고, 그 둘이 2026-08-27 수리가 뒤집은 축 그대로다:
 *
 *    · 주축(세로) — 띠 배치에서 카드는 flexDirection:'column' 이고 칸은 `flex:'0 1 auto'` 다.
 *      `height:'100%'` 든(수리 후) 종횡비가 만든 높이가 shrink 로 눌리든(수리 전) 결과는 같다:
 *      트레이를 뺀 **카드 높이**.
 *    · 교차축(가로) — `alignSelf:'center'` 로 기본 stretch 를 끄면 종횡비가 폭을 만들고
 *      (높이×종횡비) 칸이 가운데 선다. stretch 면 폭이 **카드 폭 전체**다.
 *
 *  무대 `<svg>` 는 이 칸을 두 축 100% 로 채운다(CourtStage 의 STAGE_STYLE) — 그래서 이 상자가
 *  곧 히트면이다. 이것은 브라우저 레이아웃의 **모형**이지 실측이 아니다(실기 확인은 따로). */
function courtCellRect(cell: HTMLElement, card: { left: number; top: number; width: number; height: number }): DOMRect {
  const stretched = cell.style.alignSelf !== 'center';
  const width = stretched ? card.width : Math.min(card.height * aspectOf(cell), card.width);
  const left = card.left + (card.width - width) / 2;
  return {
    x: left, y: card.top, left, top: card.top,
    right: left + width, bottom: card.top + card.height,
    width, height: card.height, toJSON: () => ({}),
  } as DOMRect;
}

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
    // ⚠️ 2026-08-14 — 축이 뒤집혔다. 트레이가 **코트 긴 변**에 붙으므로 가로 창에서는 코트가
    // 눕고 트레이가 아래 띠다.
    // ⚠️ 2026-08-27 (기현님 지시) — **띠에서도 높이가 기준이다.** 옛 계약은 여기서 폭을 다
    // 쓰고(`width:'100%'`) 종횡비가 높이를 만들게 했다.
    // ⚠️ 2026-09-05 — 그 계약을 재던 인라인 style 단언 넷(height·width·alignSelf·maxWidth)을
    // 여기서 **뺐다.** 값만 말할 뿐 무엇이 새는지는 말하지 않는 종류라(AGENTS.md 「테스트 작성
    // 규칙」이 인라인 스타일 값 단언을 금지한다), 같은 계약을 **행동**으로 지는 아래
    // 「무대 히트면」 절로 옮겼다. 남긴 단언들은 종횡비의 **출처**(def 하나)를 지킨다.
    expect(cell.style.aspectRatio).toBe(courtCellAspectRatioCss('full', undefined, 0));
    expect(cell.style.aspectRatio).toBe('825 / 525');
    // 함정 2 — minWidth:0 이 없으면 min-width:auto 가 shrink 를 막아 폭 제약에서 넘친다.
    expect(cell.style.minWidth).toBe('0px');
    expect(cell.style.minHeight).toBe('0px');
    expect(cell.style.flex).toBe('0 1 auto');
    // 함정 1 — 트레이 base 는 0 이어야 한다.
    const tray = board.children[1] as HTMLElement;
    // jsdom 의 cssstyle 은 축약형 `none` 을 longhand `0 0 auto` 로 펼쳐 둔다 — 같은 말이다.
    expect(tray.style.flex, '띠는 높이를 못박고 자기 줄을 그대로 쓴다').toBe('0 0 auto');
  });

  it('코트 종류가 바뀌면 종횡비도 바뀐다 — def 를 실제로 읽고 있다(대조군)', async () => {
    stubMedia({ portrait: false, narrow: false });
    const { board } = await openBoard('half');
    expect(courtCell(board).style.aspectRatio).toBe(courtCellAspectRatioCss('half', undefined, 0));
    expect(courtCell(board).style.aspectRatio).toBe('525 / 450');
  });

  it('실제 화면의 트레이 구역이 TRAY_SECTIONS 개다 — 고정 합 식이 gap 을 세는 근거', async () => {
    // 벤치 · 구분선 · 도구 · 코트 이름(세로 기둥에만). 이 개수가 바뀌면 고정 합 식의 gap 항이
    // 어긋나고, 그 식은 **여전히 옛 숫자를 답한다**(계기가 거짓말하는 형태).
    // 줌 3 · 이력 2 와 그 구분선은 2026-08-14 에 기능 바로 떠났다(7 → 4).
    stubMedia({ portrait: true, narrow: true });
    setViewport(480, 800);
    const { board } = await openBoard();
    // ⚠️ **흐름 안의** 자식만 센다. 트레이에는 흐름 밖 장식이 하나 산다(§6.10c 드롭 예고) —
    // 그것을 구역으로 세면 고정 합 식이 있지도 않은 gap 을 하나 더 세게 된다.
    const sections = [...(board.children[1] as HTMLElement).children].filter((el) => (el as HTMLElement).style.position !== 'absolute');
    expect(sections).toHaveLength(TRAY_SECTIONS);
  });
});

describe('★ 무대 히트면 — 코트 밖으로 새지 않는다 (2026-09-05 감사 §③ [하 7])', () => {
  // **지우면 새는 것:** 코트 칸이 다시 폭 기준(`width:'100%'` · stretch)으로 돌아가면, 카드가
  // 코트보다 넓을 때 칸이 카드 폭을 통째로 먹는다. 그 안에서 `<svg>` 는 'meet' 으로
  // 레터박스되므로 **코트 그림 좌우의 빈 띠까지 히트면**이 되고, 거기를 누르면 client→world 가
  // viewBox 밖 좌표를 낸다. placement.ts 에는 코트 안으로 되당기는 clamp 가 없어서 공이 그대로
  // 코트 밖에 떨어진다 — 2026-09-05 감사가 CDP 실클릭으로 재현한 그 버그다.
  //
  // ⚠️ 63e46eb 커밋이 적은 옛 근거("넓은 창에서 코트 아래가 overflow 로 잘린다")는 같은 감사가
  //    크로미움 13개 뷰포트에서 **재현하지 못했다.** 코드가 실제로 막는 것은 이 히트면이다
  //    (EditorWorkspace.tsx 의 코트 칸 주석에 옛 서사도 함께 남겼다).
  //
  // 재는 방식: jsdom 에는 레이아웃이 없으므로 코트 칸의 상자를 선언된 style 에서 만들어
  // (courtCellRect) 무대 `<svg>` 의 rect 로 물린다 — 이웃 테스트(objectMenu.test)가 쓰는 관용구다.
  it('카드가 코트보다 훨씬 넓어도, 히트면 왼쪽 끝에서 놓은 공이 코트 안이다', async () => {
    stubMedia({ portrait: false, narrow: false });
    setViewport(2560, 1440); // 최대화한 데스크톱 — 카드가 코트보다 한참 넓어지는 국면
    const { user, board } = await openBoard();
    const cell = courtCell(board);
    // 판 덩어리 상자. 폭이 "높이×종횡비" 보다 훨씬 커야 좌우 빈 띠가 생긴다.
    const card = { left: 40, top: 24, width: 1800, height: 560 };
    expect(card.width, '카드가 코트보다 넓지 않다 — 이 테스트가 재는 국면이 아니다').toBeGreaterThan(card.height * aspectOf(cell) + 200);

    const rect = courtCellRect(cell, card);
    vi.spyOn(SVGSVGElement.prototype, 'getBoundingClientRect').mockReturnValue(rect);
    // 배치 규칙이 실제로 받은 **월드 좌표**를 본다(placement.ts 가 세 경로의 공통 관문이다).
    const place = vi.spyOn(placement, 'placeObject');

    const tray = board.children[1] as HTMLElement;
    await user.click(within(tray).getByRole('button', { name: /^공/ }));
    const stage = screen.getByRole('application', { name: '코트 편집 영역' });
    // 히트면의 **왼쪽 끝** — 수리 전에는 이 자리가 코트 그림 왼쪽의 빈 띠였다.
    await user.pointer([
      { target: stage, keys: '[MouseLeft]', coords: { clientX: rect.left + 1, clientY: rect.top + rect.height / 2 } },
    ]);

    expect(place, '공이 배치 경로를 안 탔다 — 도구 선택이나 포인터 배선이 바뀌었다').toHaveBeenCalled();
    const world = place.mock.calls[0]![1];
    const def = courtDefFor('full', undefined);
    // 코트 그림(viewBox) 안이면 된다. 라인 밖(터치라인 바깥 여백)은 정상 배치라 surface 로는 안 잰다.
    expect(world.x, `공이 코트 밖에 놓였다(x=${world.x}) — 히트면이 코트 밖으로 샜다`).toBeGreaterThanOrEqual(0);
    expect(world.x, `공이 코트 밖에 놓였다(x=${world.x})`).toBeLessThanOrEqual(def.vbW);
    expect(world.y, `공이 코트 밖에 놓였다(y=${world.y})`).toBeGreaterThanOrEqual(0);
    expect(world.y, `공이 코트 밖에 놓였다(y=${world.y})`).toBeLessThanOrEqual(def.vbH);
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

    // 팝오버를 열고 닫아도 마찬가지다(열면 `<main>` 폭 판정이 다시 돈다).
    // ⚠️ 옛 단언은 [속성]이었다 — 자유 전술판에서 인스펙터가 사라져 [코트]로 갈아탔다.
    await user.click(screen.getByRole('button', { name: '보드 설정' }));
    await waitFor(() => expect(screen.getByRole('dialog', { name: '보드 설정' })).toBeInTheDocument());
    expect(snap()).toEqual(before);
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog', { name: '보드 설정' })).toBeNull());
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
      // 2026-08-16 — "버튼 **안쪽**이어야 한다" 에서 "**표적을 안 품는다**" 로 넓혔다.
      // 트레이 드롭 예고(§6.10c `[data-tray-hint]`)는 트레이 전체를 덮는 장식이라 어느 버튼의
      // 자식도 아니지만, 이 게이트가 실제로 막는 것은 *누를 수 있는 것이 흐름 밖으로 뜨는 일*
      // 이다(위 주석 "남으면 안 되는 것은 누를 수 있는 것이다"). 그 술어를 그대로 적는다.
      expect(el.querySelector('button, a[href], input, [role="button"]'), `${el.tagName} 이 표적을 품는다`).toBeNull();
      expect(el.matches('button, a[href], input, [role="button"]'), `${el.tagName} 자신이 표적이다`).toBe(false);
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

  it('판을 조립하는 파일은 아무것도 재지 않는다 — 되먹임 고리가 닫힐 자리가 없다', () => {
    const code = codeOf(read('src/features/editor/EditorWorkspace.tsx'));
    for (const forbidden of ['getBoundingClientRect', 'ResizeObserver', 'refreshMetrics()']) {
      expect(code, `${forbidden} 가 판 조립부에 들어왔다 — 측정 → 크기 결정 되먹임이다`).not.toContain(forbidden);
    }
  });
});
