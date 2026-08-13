// 7차 검증 — **끌고 있는 고스트가 판 덩어리에 잘리지 않는가** (설계서 §4.4).
//
// ── 왜 이 파일이 생겼나 ─────────────────────────────────────────────────────────────
// P4 가 판 덩어리에 `overflow:hidden` 을 걸었다. 같은 커밋의 주석(EditorWorkspace.tsx:500-502)이
// *"지금 판 안에 fixed 는 없지만(TrayGhost 는 `<main>` 직계다)"* 라고 적어 두었는데, 그것은
// **주석일 뿐 테스트가 아니었다.** 이 저장소가 겪은 헛통과 형태 그대로다 — *"그려져 있다 ≠
// 보인다"*: 규칙 존 흰 파선이 코트 실선에 완전히 가려져 화면에 한 픽셀도 기여하지 않는데
// 마크업 단언은 전부 통과하고 있었다.
//
// 걸린 것이 작지 않다. 트레이 고스트는 **이 앱 주력 조작의 유일한 피드백**이다(발 마우스로
// 칩을 코트에 끌어다 놓는 것). 잘리면 손이 어디에 있는지 화면이 말해 주지 않는다.
//
// ── 두 가지가 동시에 참이어야 한다 ─────────────────────────────────────────────────
//  ① 고스트가 `[data-board]` **안에 없다.** 안에 있으면 `overflow:hidden` 이 판 밖으로 나간
//     부분을 통째로 잘라, 코트 위로 끌고 가는 동안만 보이고 트레이 바깥·헤더 위에서는 사라진다.
//  ② 고스트의 **조상 중 누구도 `position:fixed` 의 기준 상자를 만들지 않는다.** `filter` ·
//     `transform` · `perspective` · `will-change` · `contain` · `backdrop-filter` 중 하나라도
//     조상에 붙으면 fixed 의 기준이 뷰포트가 아니라 그 조상이 되어, 고스트가 **엉뚱한 자리에
//     그려지고 그 조상의 overflow 에 잘린다.** P4 가 `filter: drop-shadow` 를 지운 진짜 이득이
//     이것인데(§4.4 근거 ②), 지운 사실 자체를 지키는 테스트가 없었다.
//
// ⚠️ ②는 ①이 참이어도 따로 깨질 수 있다 — 축이 둘이다. `<main>` 이나 코트 컬럼에 누가
//    `transform`/`filter` 를 얹으면 고스트는 여전히 판 밖이지만 자리가 틀어진다.
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

afterEach(() => {
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
  // ⚠️ 끌던 것을 반드시 놓고 끝낸다. `useTrayDrag` 는 `pointermove`/`pointerup`/`pointercancel`
  // 세 리스너를 **window** 에 걸고 `finish()` 안에서만 떼는데, **언마운트 정리 이펙트가 없다**
  // (useTrayDrag.ts:135-152 의 `cleanup()` 은 finish 경로에서만 불린다). 드래그를 연 채로 테스트가
  // 끝나면 그 리스너들이 죽은 컴포넌트를 붙든 채 스위트에 남아, 뒤 테스트가 포인터를 건드릴 때
  // 남의 세션이 깨어난다. pointercancel 은 좌표가 없어 개체를 놓지 않고 세션만 닫는다.
  fireEvent.pointerCancel(window, { pointerId: 7 });
});

async function openBoard() {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), defaultCourtMode: 'full' }));
  render(<BoardScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  return document.getElementById('main')!;
}

/** 칩을 실제로 잡아 끈다. `useTrayDrag` 는 임계 6px 을 넘어야 `dragging` 을 켜므로(고스트가
 *  그때 비로소 렌더된다) 눌렀다 **멀리** 옮긴다. jsdom 에는 setPointerCapture 가 없지만
 *  그 경로는 try/catch 로 감싸여 있고 window 리스너로 계속 따라간다(useTrayDrag.ts:107-110). */
async function dragChip(): Promise<HTMLElement> {
  const chip = screen.getAllByRole('button', { name: '2번 선수 배치' })[0]!;
  fireEvent.pointerDown(chip, { pointerId: 7, clientX: 900, clientY: 300 });
  fireEvent.pointerMove(window, { pointerId: 7, clientX: 400, clientY: 260 });
  const ghost = await waitFor(() => {
    const el = document.querySelector<HTMLElement>('div[aria-hidden][style*="fixed"]');
    expect(el, '고스트가 안 떴다 — 아래 단언이 전부 헛것이 된다(대조군)').not.toBeNull();
    return el!;
  });
  return ghost;
}

/** `position:fixed` 후손의 기준 상자를 만드는 성질들. 하나라도 조상에 붙으면 fixed 는
 *  뷰포트가 아니라 그 조상을 기준으로 놓인다(그리고 그 조상의 overflow 에 잘린다). */
const CONTAINING_BLOCK_PROPS = ['filter', 'transform', 'perspective', 'willChange', 'contain', 'backdropFilter'] as const;

describe('★ 끌고 있는 고스트는 판 덩어리 밖에 있다 (P4 overflow:hidden 의 대가)', () => {
  it('고스트는 [data-board] 안에 없다 — 안에 있으면 판 밖으로 나간 순간 잘린다', async () => {
    stubMedia({ portrait: false, narrow: false });
    const main = await openBoard();
    const board = main.querySelector<HTMLElement>('[data-board]')!;
    // 대조군: 판 덩어리가 정말 자르는 상자인가. 이게 아니면 아래 단언이 공짜다.
    expect(board.style.overflow, '판 덩어리가 안 자른다면 이 테스트의 전제가 사라진다').toBe('hidden');

    const ghost = await dragChip();
    expect(board.contains(ghost), '고스트가 판 덩어리 안이다 — overflow:hidden 에 잘린다').toBe(false);
    expect(main.contains(ghost), '고스트가 <main> 밖이면 앱 셸 규율 밖이다').toBe(true);
  });

  it('고스트의 조상 중 누구도 fixed 기준 상자를 만들지 않는다 — filter 를 되돌리면 여기가 빨개진다', async () => {
    stubMedia({ portrait: false, narrow: false });
    await openBoard();
    const ghost = await dragChip();

    const offenders: string[] = [];
    for (let el = ghost.parentElement; el; el = el.parentElement) {
      const s = el.style;
      for (const p of CONTAINING_BLOCK_PROPS) {
        if (s[p]) offenders.push(`${el.tagName.toLowerCase()}${el.id ? `#${el.id}` : ''} → ${p}: ${s[p]}`);
      }
    }
    expect(offenders, 'fixed 고스트의 기준이 뷰포트가 아니게 된다 — 자리가 틀어지고 잘린다').toEqual([]);
  });

  it('세로 배치에서도 같다 — 띠가 판 아래로 가도 고스트는 판 밖이다', async () => {
    // ⚠️ 축이 둘이다. 이 저장소는 "구현자 셋이 각자 11회 반증했는데 셋 다 세로 배치만 찔러
    //    가로에서 §3 불변식이 절반만 성립하는 버그가 통과" 한 전례가 있다. 여기서는 반대로
    //    가로만 찌르면 세로 경로(RAIL_STYLE_H)가 통째로 안 돈다.
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 480 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 800 });
    stubMedia({ portrait: true, narrow: true });
    const main = await openBoard();
    const board = main.querySelector<HTMLElement>('[data-board]')!;
    expect(board.style.flexDirection, '세로 경로가 안 돌았다 — 이 it 이 가로를 한 번 더 찌른 것이 된다').toBe('column');

    const ghost = await dragChip();
    expect(board.contains(ghost)).toBe(false);
    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1024 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 768 });
  });
});
