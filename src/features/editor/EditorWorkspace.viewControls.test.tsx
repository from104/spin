// 설계서 §2-③ · §3-ㄱㄴ · §5-P2 — **뷰 컨트롤 재편의 배선** 확인.
//
// 코트 위에 떠 있던 7개 묶음(StageControls)이 세 집으로 흩어졌다. 컴포넌트 단위
// (ToolRail.hit.test.tsx 의 ZoomGroup·ViewControls describe)로는 "props 를 주면 이렇게 그린다"
// 까지만 보이고, **어느 집에 실제로 들어갔는지 · 무엇을 부르는지 · Esc 가 누구를 닫는지**는
// 화면 끝(BoardScreen → EditorWorkspace)을 지나야 관측된다.
//
// jsdom 에 없는 것: 레이아웃(폭·좌표 전부 0)·matchMedia. 그래서 여기서 묻는 것은 **소속과
// 배선**이고, 픽셀은 ToolRail.hit.test.tsx(식)와 P3(실브라우저)의 몫이다.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen, waitFor, within } from '@testing-library/react';
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

/** jsdom 에는 matchMedia 가 없다 — 안 깔면 두 boolean 이 **둘 다 false** 로 굳어 세로 경로가
 *  한 줄도 실행되지 않은 채 초록불이 된다. 이 저장소가 실제로 겪은 헛통과가 정확히 그것이다
 *  ("구현자 셋이 다 세로 배치만 찔렀다"). 그래서 방향을 명시해 두 축을 따로 찌른다. */
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

async function openBoard(prefs: Partial<ReturnType<typeof makeDefaultPrefs>> = {}) {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), defaultCourtMode: 'full', ...prefs }));
  const user = userEvent.setup();
  render(<BoardScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  return { user, main: document.getElementById('main')! };
}

const viewButton = () => screen.getByRole('button', { name: '보기' });
/** 첫 화면 표적을 세는 규칙은 boardTargetBudget 과 같다 — 여기서는 **증감**만 보므로 버튼으로 족하다. */
const buttonCount = () => document.querySelectorAll('button').length;

beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
});

describe('뷰 컨트롤이 실제로 이사했다 — 소속 (설계서 §3-ㄱㄴ)', () => {
  it('줌 3개는 기둥(트레이) **안**이다 — 코트 위에는 아무것도 안 남았다', async () => {
    const { main } = await openBoard();
    const tray = main.querySelector<HTMLElement>('nav[data-tray]')!;
    for (const name of ['확대', '축소', '줌 초기화']) {
      const btn = screen.getByRole('button', { name });
      expect(tray.contains(btn), `${name} 가 기둥 밖이다`).toBe(true);
    }
    // 코트 칸 안에는 흐름 밖 요소가 하나도 없다 — §4.5 숨은 이득의 예고편이다(본 게이트는
    // EditorWorkspace.board.test.tsx). 코트 <svg> 안쪽 장식은 aria-hidden 이라 여기 안 걸린다.
    // ⚠️ 2026-08-14 P3 로 **선택자만** 옮겼다: 여기 있던 "패딩을 먹는 상자" 는 이제 판 덩어리를
    //    가운데 세우는 **정렬 상자**이고 그 안에는 트레이도 들어 있다(=벤치 배지의 absolute 가
    //    잡힌다). 이 it 이 뜻하는 '코트 칸' 은 판 덩어리의 **첫 칸**이라 그것을 직접 집는다.
    //    단언의 뜻은 한 글자도 안 바뀌었다 — 오히려 정확해졌다.
    const courtCell = main.querySelector<HTMLElement>('[data-board] > div')!;
    expect(courtCell, '코트 칸 선택자가 낡았다').not.toBeNull();
    const floating = [...courtCell.querySelectorAll<HTMLElement>('*')].filter(
      (el) => el.style.position === 'absolute' || el.style.position === 'fixed',
    );
    expect(floating.map((el) => el.tagName)).toEqual([]);
  });

  it('[보기]·[속성]은 하단 바 **안**이고, 기둥에는 없다', async () => {
    const { main } = await openBoard();
    const tray = main.querySelector<HTMLElement>('nav[data-tray]')!;
    const bar = screen.getByRole('button', { name: '코트 비우기' }).closest('div')!.parentElement!;
    for (const name of ['보기', '속성']) {
      const btn = screen.getByRole('button', { name });
      expect(bar.contains(btn), `${name} 가 하단 바 밖이다`).toBe(true);
      expect(tray.contains(btn), `${name} 가 기둥에 있다 — 기둥은 판의 부품, 바는 앱 크롬이다`).toBe(false);
    }
  });

  it('격자·골 지역 가이드·도움말은 첫 화면에 **없다** — 닫힌 팝오버는 DOM 에 없다(예산 밖)', async () => {
    await openBoard();
    for (const name of ['격자 표시 전환', '골 지역 가이드 전환', '도움말']) {
      expect(screen.queryByRole('button', { name }), name).toBeNull();
    }
  });

  it('대조군: [보기]를 열면 표적이 실제로 는다 — 위 it 이 "선택자가 낡아 못 찾은 것"이 아니다', async () => {
    const { user } = await openBoard();
    const before = buttonCount();
    await user.click(viewButton());
    expect(await screen.findByRole('dialog', { name: '보기' })).toBeInTheDocument();
    // 토글 2 + 도움말 1 + 모달 [닫기] 1 = 4.
    expect(buttonCount()).toBe(before + 4);
    for (const name of ['격자 표시 전환', '골 지역 가이드 전환', '도움말']) {
      expect(screen.getByRole('button', { name }), name).toBeInTheDocument();
    }
  });
});

// ⚠️ 위 describe 는 matchMedia 를 안 깔아 **가로(넓은 창)** 한 축만 찌른다. 세로 태블릿은
// 트레이가 판 아래 **가로 띠**가 되므로 줌 구역의 방향도 바뀐다 — 이 저장소가 겪은 헛통과가
// 정확히 "한 축만 찔렀다" 였다.
describe('세로 화면(태블릿을 무릎에 세운 자세)에서도 소속이 같다', () => {
  it('줌은 판 아래 띠 안, [보기]·[속성]은 여전히 하단 바 안이다', async () => {
    stubMedia({ portrait: true, narrow: false });
    const { main } = await openBoard();
    expect(main.style.flexDirection, '세로 판정이 안 걸렸다 — 이 it 은 가로를 두 번 잰 것이다').toBe('column');

    const tray = main.querySelector<HTMLElement>('nav[data-tray]')!;
    expect(tray.style.flexDirection, '세로면 트레이가 가로 띠여야 한다').toBe('row');
    const group = screen.getByRole('group', { name: '확대' });
    expect(tray.contains(group)).toBe(true);
    // 띠에서는 접지 않는다 — 접으면 띠 높이가 두 배가 되어 코트 축척이 흔들린다(§4.7 절벽).
    expect(group.style.flexWrap).toBe('nowrap');

    const bar = screen.getByRole('button', { name: '코트 비우기' }).closest('div')!.parentElement!;
    for (const name of ['보기', '속성']) {
      expect(bar.contains(screen.getByRole('button', { name })), name).toBe(true);
    }
  });
});

describe('팝오버 배선 — 토글이 실제로 판을 바꾼다', () => {
  it('격자 토글이 prefs 를 뒤집는다(양방향)', async () => {
    const { user } = await openBoard({ showGrid: true });
    await user.click(viewButton());
    const grid = screen.getByRole('button', { name: '격자 표시 전환' });
    expect(grid).toHaveAttribute('aria-pressed', 'true');

    await user.click(grid);

    expect(loadPrefs().showGrid).toBe(false);
    expect(screen.getByRole('button', { name: '격자 표시 전환' })).toHaveAttribute('aria-pressed', 'false');
    // 반대 방향까지 눌러야 "항상 false 를 쓰는" 구현이 안 통과한다.
    await user.click(screen.getByRole('button', { name: '격자 표시 전환' }));
    expect(loadPrefs().showGrid).toBe(true);
  });

  it('골 지역 가이드 토글도 자기 값만 뒤집는다 — 격자는 그대로다(대조군)', async () => {
    const { user } = await openBoard({ showGrid: true, showRuleZones: true });
    await user.click(viewButton());

    await user.click(screen.getByRole('button', { name: '골 지역 가이드 전환' }));

    expect(loadPrefs().showRuleZones).toBe(false);
    expect(loadPrefs().showGrid, '한 핸들러에 두 토글을 꽂았다').toBe(true);
  });

  it('줌 버튼이 무대를 실제로 움직인다 — 코트 viewBox 가 좁아진다', async () => {
    // 이 버튼들이 부르는 것은 예전 StageControls 와 **같은 무대 핸들**이다. 배선이 끊기면
    // 조용히 아무 일도 안 일어나므로, 화면에 남는 흔적(viewBox)으로 확인한다.
    const { user, main } = await openBoard();
    const svg = main.querySelector('svg')!;
    const before = svg.getAttribute('viewBox')!;

    await user.click(screen.getByRole('button', { name: '확대' }));

    const after = svg.getAttribute('viewBox')!;
    expect(after, '확대가 무대에 안 닿았다').not.toBe(before);
    const w = (v: string) => Number(v.split(' ')[2]);
    expect(w(after), '확대인데 보이는 폭이 안 줄었다').toBeLessThan(w(before));

    await user.click(screen.getByRole('button', { name: '줌 초기화' }));
    expect(svg.getAttribute('viewBox')).toBe(before);
  });
});

describe('팝오버 포커스 — 열면 첫 항목, 닫으면 [보기]로 (§7.6)', () => {
  it('열면 첫 항목(격자)에 포커스가 간다', async () => {
    const { user } = await openBoard();
    await user.click(viewButton());
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: '격자 표시 전환' })));
  });

  it('Esc 로 닫으면 [보기] 버튼으로 돌아온다 — body 로 떨어지지 않는다', async () => {
    const { user } = await openBoard();
    await user.click(viewButton());
    await screen.findByRole('dialog', { name: '보기' });

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '보기' })).toBeNull());
    expect(document.activeElement).toBe(viewButton());
    // isConnected 검사(Modal.tsx:70)가 살아 있다는 뜻이기도 하다 — 트리거가 떼어졌다면
    // 여기서 포커스가 <body> 로 떨어진다(§7.6 이 막는 그 사고).
    expect(document.activeElement).not.toBe(document.body);
  });

  it('바깥을 눌러도 닫힌다 — 메뉴의 통상 동작', async () => {
    const { user } = await openBoard();
    await user.click(viewButton());
    const dialog = await screen.findByRole('dialog', { name: '보기' });

    await user.click(dialog.parentElement!); // 배경(backdrop)

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '보기' })).toBeNull());
  });
});

// ── Esc 우선순위 4단 (완료 판정) ──────────────────────────────────────────────────
// 계약은 InspectorHost.tsx:17-24 에 있고 **등록 단계**가 보장한다:
//   (1) 모달(ui/Modal) — document **캡처** + stopPropagation
//   (2) 인스텍터        — 자기 **루트 요소**(포커스가 그 안에 있을 때만) + stopPropagation
//   (3) 전역 선택 해제  — document **버블**(useEditorKeyboard.ts:194)
// (3) 이 실제로 도달했는지를 보려면 리듀서 안을 들여다봐야 하는데, 화면 밖에서는 못 본다.
// 그래서 **같은 자리(document 버블)에 스파이를 하나 더 단다** — (3) 과 완전히 같은 단계라
// (1)·(2) 의 stopPropagation 이 (3) 을 막았다면 이 스파이도 못 받는다. 스파이가 진짜로
// 관측하고 있다는 것은 마지막 대조군(아무것도 안 열린 상태의 Esc)이 증명한다.
describe('Esc 우선순위 — 팝오버 > 인스펙터 > 전역 (등록 단계가 보장한다)', () => {
  it('4단 시나리오: 팝오버만 닫힘 → 인스펙터만 닫힘 → 전역 도달', async () => {
    const { user } = await openBoard();
    const globalEsc = vi.fn();
    const spy = (e: KeyboardEvent) => e.key === 'Escape' && globalEsc();
    document.addEventListener('keydown', spy);
    try {
      // ① 인스펙터를 연다. 잡아 두는 것은 **호스트 루트**다 — Esc 리스너가 달린 요소가
      //    그것이고(InspectorHost), 안쪽 <aside>(드릴 속성)를 잡으면 제목이 그 밖이라 못 찾는다.
      await user.click(screen.getByRole('button', { name: '속성' }));
      const hostId = screen.getByRole('button', { name: '속성' }).getAttribute('aria-controls')!;
      const inspector = document.getElementById(hostId)!;
      expect(screen.getByRole('complementary', { name: '드릴 속성' })).toBeInTheDocument();
      // ② 그 위에 팝오버를 연다
      await user.click(viewButton());
      await screen.findByRole('dialog', { name: '보기' });

      // ③ Esc — **팝오버만** 닫힌다
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('dialog', { name: '보기' })).toBeNull());
      expect(screen.getByRole('complementary', { name: '드릴 속성' }), '인스펙터까지 닫혔다').toBeInTheDocument();
      expect(globalEsc, '전역까지 내려갔다 — 판 위 선택이 함께 풀린다').not.toHaveBeenCalled();
      expect(document.activeElement).toBe(viewButton());

      // ④ 포커스를 인스펙터 안에 두고 Esc — **인스펙터만** 닫힌다
      within(inspector).getByRole('heading', { name: '속성' }).focus();
      await user.keyboard('{Escape}');
      await waitFor(() => expect(screen.queryByRole('complementary', { name: '드릴 속성' })).toBeNull());
      expect(globalEsc, '인스펙터가 먹고도 전역으로 흘렸다').not.toHaveBeenCalled();

      // ⑤ 아무것도 안 열린 상태의 Esc — 이제야 전역(선택 해제)에 닿는다.
      //    스파이가 실제로 관측하고 있다는 대조군이기도 하다.
      await user.keyboard('{Escape}');
      expect(globalEsc).toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', spy);
    }
  });

  it('도움말 위에서도 같다 — 팝오버에서 연 도움말이 Esc 를 먼저 먹는다', async () => {
    // 항목을 고르면 메뉴가 **닫히므로** 모달이 겹치지 않는다. 안 닫으면 두 모달이 같은
    // document 캡처에 달려 **먼저 등록된 바깥쪽**(보기)이 Esc 를 가져간다 — 안쪽이 안 닫힌다.
    const { user } = await openBoard();
    await user.click(viewButton());
    await user.click(screen.getByRole('button', { name: '도움말' }));
    await screen.findByRole('dialog', { name: '도움말' });
    expect(screen.queryByRole('dialog', { name: '보기' })).toBeNull();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('dialog', { name: '도움말' })).toBeNull());
    expect(document.activeElement).toBe(viewButton());
  });
});

// ── 2026-08-14 두 번째 지시: *"undo, redo 버튼을 줌 버튼과 묶어 배치"* ────────────────────
//
// 옮기는 작업의 위험은 **둘로 늘어나는 것**이다(헤더에도 남고 트레이에도 생긴다). 그러면
// 화면은 멀쩡해 보이는데 §3 표적 예산이 조용히 2 오르고, 이름으로 찍는 기존 테스트들이
// "여러 개" 로 터진다. 그래서 소속뿐 아니라 **개수**를 함께 못박는다.
describe('편집 이력 — 헤더에서 트레이 줌 아래로 옮겨 왔다', () => {
  it('되돌리기·다시하기가 nav[data-tray] 안이고, 헤더에는 하나도 없다', async () => {
    const { main } = await openBoard();
    const tray = main.querySelector<HTMLElement>('nav[data-tray]')!;
    const header = document.querySelector<HTMLElement>('header')!;

    for (const name of ['되돌리기', '다시하기']) {
      // getByRole 은 둘 이상이면 스스로 터진다 — 그것이 "안 늘었다" 의 단언이다.
      const btn = screen.getByRole('button', { name });
      expect(tray.contains(btn), `${name} 가 트레이 밖이다`).toBe(true);
      expect(header.contains(btn), `${name} 가 헤더에 남아 있다`).toBe(false);
    }
    expect(within(header).queryByRole('button', { name: '되돌리기' })).toBeNull();
    expect(within(header).queryByRole('button', { name: '다시하기' })).toBeNull();
  });

  it('줌 **바로 뒤**다 — 사이에 구분선이 없어야 한 묶음으로 읽힌다', async () => {
    const { main } = await openBoard();
    const tray = main.querySelector<HTMLElement>('nav[data-tray]')!;
    const kids = [...tray.children];
    const zoom = screen.getByRole('group', { name: '확대' });
    const hist = screen.getByRole('group', { name: '편집 이력' });
    expect(kids.indexOf(hist), '이력이 줌 바로 다음이 아니다').toBe(kids.indexOf(zoom) + 1);
    // 대조군: 그 다음은 구분선이다 — 벤치와는 갈린다.
    expect((kids[kids.indexOf(hist) + 1] as HTMLElement).style.height).toBe('1px');
  });

  it('되돌릴 것이 없어도 **사라지지 않고** disabled 다 — 사라지면 아래 좌표가 통째로 움직인다', async () => {
    // §3 불변식 1 의 그 계약이다. 발 마우스·입 젓가락 사용자는 절대 위치로 공간 기억을 만든다.
    await openBoard();
    expect(screen.getByRole('button', { name: '되돌리기' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '다시하기' })).toBeDisabled();
  });

  it('세로 화면에서도 소속이 같다 — 판 아래 띠 안, 안 접힌다', async () => {
    stubMedia({ portrait: true, narrow: false });
    const { main } = await openBoard();
    const tray = main.querySelector<HTMLElement>('nav[data-tray]')!;
    expect(tray.style.flexDirection, '세로 판정이 안 걸렸다').toBe('row');
    const hist = screen.getByRole('group', { name: '편집 이력' });
    expect(tray.contains(hist)).toBe(true);
    expect(hist.style.flexWrap).toBe('nowrap');
  });
});

// ── 휠 줌(같은 지시: *"코트에 마우스 두고 휠 버튼 움직이면 줌 기능"*) ────────────────────
//
// ⚠️ React 의 `onWheel` 은 루트에 **passive** 로 걸려 preventDefault 가 무시된다. 그래서
// CourtStage 가 svg 에 직접 `{passive:false}` 로 단다 — 그 배선이 끊기면 확대는 되면서
// 페이지도 함께 스크롤된다. jsdom 은 passive 를 강제하지 않으므로 여기서 관측되는 것은
// **defaultPrevented** 이고, 그것이 배선의 유일한 흔적이다.
describe('휠 줌 — 코트 위에서 굴리면 그 자리를 붙든 채 확대된다', () => {
  // ⚠️ `act` 로 감싸야 한다. 이 리스너는 React 밖(네이티브 addEventListener)에서 setView 를
  // 부르므로, 감싸지 않으면 상태 갱신이 이 턴에 반영되지 않아 **아무 일도 안 일어난 것처럼**
  // 보인다. 실제 브라우저에서는 React 가 알아서 흘리므로 이것은 jsdom 쪽 사정이다.
  const wheel = (svg: Element, init: WheelEventInit): WheelEvent => {
    const ev = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
    act(() => {
      svg.dispatchEvent(ev);
    });
    return ev;
  };
  const vbW = (svg: Element) => Number(svg.getAttribute('viewBox')!.split(' ')[2]);

  it('위로 굴리면 확대, 아래로 굴리면 되돌아온다', async () => {
    const { main } = await openBoard();
    const svg = main.querySelector('svg')!;
    const before = vbW(svg);

    wheel(svg, { deltaY: -100, clientX: 300, clientY: 200 });
    expect(vbW(svg), '휠 업이 확대가 아니다 — 부호가 뒤집혔다').toBeLessThan(before);

    wheel(svg, { deltaY: 100, clientX: 300, clientY: 200 });
    expect(vbW(svg)).toBeCloseTo(before, 6);
  });

  it('휠 한 칸이 [확대] 버튼 한 번과 **같은 걸음**이다', async () => {
    const { user, main } = await openBoard();
    const svg = main.querySelector('svg')!;
    const before = vbW(svg);
    await user.click(screen.getByRole('button', { name: '확대' }));
    const byButton = vbW(svg);

    await user.click(screen.getByRole('button', { name: '줌 초기화' }));
    wheel(svg, { deltaY: -100, clientX: 300, clientY: 200 });

    expect(vbW(svg), '걸음이 다르면 버튼과 휠이 서로 다른 배율표를 쓰는 것이다').toBeCloseTo(byButton, 6);
    expect(byButton).toBeLessThan(before);
  });

  it('기본 동작을 막는다 — 안 막으면 판이 커지면서 페이지도 함께 스크롤된다', async () => {
    const { main } = await openBoard();
    const svg = main.querySelector('svg')!;
    expect(wheel(svg, { deltaY: -100, clientX: 300, clientY: 200 }).defaultPrevented).toBe(true);
  });

  it('Ctrl/⌘ + 휠은 **넘긴다** — 브라우저 자체 확대는 저시력 사용자의 경로다', async () => {
    const { main } = await openBoard();
    const svg = main.querySelector('svg')!;
    const before = vbW(svg);

    const ev = wheel(svg, { deltaY: -100, clientX: 300, clientY: 200, ctrlKey: true });

    expect(ev.defaultPrevented, '브라우저 확대를 가로챘다').toBe(false);
    expect(vbW(svg), '판까지 함께 확대됐다').toBe(before);
  });
});
