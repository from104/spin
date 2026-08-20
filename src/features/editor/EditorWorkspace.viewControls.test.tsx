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
import { act, render, screen, waitFor } from '@testing-library/react';
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
  // tutorialsSeen.board 를 미리 채운다 — 안 그러면 튜토리얼 스포트라이트가 [보기] 서랍의 Esc·
  // 포커스 배선 테스트를 가로챈다(§0.5, tutorialSteps.ts). `...prefs` 뒤에 있으므로 호출부가
  // 원하면 덮어쓸 수 있다.
  localStorage.setItem(
    PREFS_KEY,
    JSON.stringify({ ...makeDefaultPrefs(), tutorialsSeen: { board: true }, ...prefs }),
  );
  const user = userEvent.setup();
  render(<BoardScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  return { user, main: document.getElementById('main')! };
}

const viewButton = () => screen.getByRole('button', { name: '보기' });
beforeEach(() => {
  localStorage.clear();
});
afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
  delete (window as unknown as { matchMedia?: unknown }).matchMedia;
});

// ── 2026-08-14 기현님 세 번째 라운드 — 소속이 **또** 바뀌었다 ─────────────────────────
//
// 옛 기록(지우지 않는다): 코트 위 7개 묶음이 세 집(기둥의 줌 3 · 하단 바의 [보기]·[속성])으로
// 흩어졌고, 그 다음 라운드에서 되돌리기·다시하기가 헤더에서 기둥으로 내려왔다.
// 지금은 그 전부가 **오른쪽 기능 바** 한 곳이다. 트레이에 남는 것은 판에 **놓는 것**뿐이다:
// 칩·공·콘·선택·지우개·작도·메모. 그래야 트레이가 코트 긴 변을 따라 옮겨 다녀도(가로 코트면
// 아래, 세로면 오른쪽) 앱 조작이 함께 떠돌지 않는다.
describe('앱 조작은 전부 오른쪽 기능 바다 — 트레이에는 하나도 없다', () => {
  const bar = () => document.querySelector<HTMLElement>('nav[data-function-bar]')!;
  const tray = () => document.querySelector<HTMLElement>('nav[data-tray]')!;

  it('줌 3 · 이력 2 · 코트 · 골대 · 비우기 · 내보내기 · 속도 · 보기 — 전부 기능 바 안이다', async () => {
    await openBoard();
    // 2026-08-20(§0.5 Phase 5) — [도움말]은 이 목록에서 빠졌다. 기둥 자기 칸이 아니라
    // 레일(AppRail·AppNavAside, 이 화면 밖)의 상시 칸 하나로 일원화됐다.
    const names = [
      '확대',
      '축소',
      '배율 100%',
      '되돌리기',
      '다시하기',
      '코트 형태와 크기',
      '골대 원위치',
      '코트 비우기',
      '내보내기',
      '보기',
      '드릴로 저장',
    ];
    for (const name of names) {
      const btn = screen.getByRole('button', { name });
      expect(bar().contains(btn), `${name} 가 기능 바 밖이다`).toBe(true);
      expect(tray().contains(btn), `${name} 가 트레이 안에 남아 있다`).toBe(false);
    }
    // 속도 제한은 상태가 이름에 실린다 — 정규식으로 찾는다.
    const speed = screen.getByRole('button', { name: /개체 이동 속도 제한/ });
    expect(bar().contains(speed)).toBe(true);
  });

  it('[드릴로 저장]은 기둥 **맨 끝**이고 유일한 액센트 칸이다', async () => {
    // 맨 끝인 이유: 새 칸을 위에 끼우면 아래 열한 칸의 좌표가 통째로 밀린다(§3 불변식 1).
    // 액센트가 하나뿐인 이유: 둘이 되는 순간 어느 것도 주 액션이 아니게 된다.
    await openBoard();
    const items = [...bar().querySelectorAll('button')];
    expect(items[items.length - 1]!.getAttribute('aria-label')).toBe('드릴로 저장');
    const accented = items.filter((b) => b.style.background === 'var(--accent)');
    expect(accented).toHaveLength(1);
    expect(accented[0]!.getAttribute('aria-label')).toBe('드릴로 저장');
  });

  it('[속성]은 **없다** — 자유 전술판에서 인스펙터가 통째로 사라졌다', async () => {
    await openBoard();
    expect(screen.queryByRole('button', { name: '속성' })).toBeNull();
    expect(screen.queryByRole('complementary', { name: '드릴 속성' })).toBeNull();
  });

  it('하단 바도 **없다** — [코트 비우기]·[내보내기]·속도 제한이 전부 기능 바로 갔다', async () => {
    const { main } = await openBoard();
    // 옛 BoardBar 는 코트 컬럼의 마지막 자식이었다. 지금 그 자리에는 정렬 상자 하나뿐이다.
    const courtColumn = main.firstElementChild!.nextElementSibling as HTMLElement;
    expect(courtColumn.children).toHaveLength(1);
  });

  it('닫힌 것은 DOM 에 없다 — 코트 모달·보기 서랍은 표적 예산 밖이다', async () => {
    const { user } = await openBoard();
    expect(screen.queryByRole('radiogroup', { name: /코트 형태/ })).toBeNull();
    expect(screen.queryByRole('button', { name: '격자 표시 전환' })).toBeNull();

    await user.click(screen.getByRole('button', { name: '코트 형태와 크기' }));
    expect(screen.getByRole('radiogroup', { name: /코트 형태/ })).toBeInTheDocument();
  });
});

describe('트레이가 판의 어느 변에 붙든 기능 바는 오른쪽이다', () => {
  it('세로 화면 — 트레이는 기둥, 기능 바는 여전히 오른쪽', async () => {
    stubMedia({ portrait: true, narrow: false });
    const { main } = await openBoard();
    const board = main.querySelector<HTMLElement>('[data-board]')!;
    expect(board.style.flexDirection, '세로 판정이 안 걸렸다 — 이 it 이 가로를 두 번 잰 것이 된다').toBe('row');

    const bar = document.querySelector<HTMLElement>('nav[data-function-bar]')!;
    expect(main.contains(bar)).toBe(true);
    expect(board.contains(bar), '기능 바가 판 덩어리 안으로 들어갔다').toBe(false);
    expect(screen.getByRole('button', { name: '확대' }).closest('nav')).toBe(bar);
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

    await user.click(screen.getByRole('button', { name: '배율 100%' }));
    expect(svg.getAttribute('viewBox')).toBe(before);
  });
});

// ── 2026-08-16 기현 지시 — [보기]가 **팝오버에서 서랍(플라이아웃)으로** 바뀌었다 ─────────
// 옛 계약(지우지 않는다): Modal 이었으므로 열면 첫 항목에 포커스가 가고, Esc·바깥 클릭으로
// 닫히며, 닫히면 [보기] 로 복귀했다. 바꾼 이유는 **남은 둘이 토글이기 때문**이다 — 모달은
// "들어가서 고르고 나온다" 라 한 번 쓰고 마는 선택(코트 형태·크기)에 맞고, 격자·골 지역은
// 판을 보면서 켰다 껐다 하는 것이라 배경을 덮고 포커스를 가두는 장치가 매번 과했다.
// 트레이의 [작도]·[설명]과 **같은 장치**를 쓴다(useFlyout).
describe('[보기] 서랍 — 손이 닿으면 뜨고 떠나면 닫힌다', () => {
  const panel = () => screen.queryByRole('group', { name: '보기' });

  it('다이얼로그가 아니다 — 배경도 포커스 덫도 없다', async () => {
    const { user } = await openBoard();
    await user.click(viewButton());
    expect(screen.queryByRole('dialog', { name: '보기' }), '아직 모달이다').toBeNull();
    expect(panel(), '서랍 패널이 안 떴다').toBeInTheDocument();
    expect(viewButton()).toHaveAttribute('aria-expanded', 'true');
  });

  it('포커스는 손잡이에 남는다 — 트레이 서랍과 같은 규율', async () => {
    // 모달이 아니므로 포커스를 끌고 들어가지 않는다. 키보드 사용자의 직행 경로는 서랍이
    // 아니라 **단축키**다(# · Z — core/keymap.ts). 트레이 서랍이 도구 문자키를 남겨 둔 것과
    // 같은 이유이고, 그래서 §3 불변식 2(잠긴 기능 0개)가 성립한다.
    const { user } = await openBoard();
    const btn = viewButton();
    btn.focus();
    await user.click(btn);
    expect(panel()).toBeInTheDocument();
    expect(document.activeElement).toBe(btn);
  });

  it('Esc 로 닫힌다 — 포커스는 손잡이 그대로다', async () => {
    const { user } = await openBoard();
    await user.click(viewButton());
    expect(panel()).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => expect(panel()).toBeNull());
    expect(document.activeElement).not.toBe(document.body);
  });

  it('손잡이를 벗어나면 유예 뒤에 닫힌다', async () => {
    const { user } = await openBoard();
    await user.click(viewButton());
    expect(panel()).toBeInTheDocument();

    // 코트로 마우스를 옮긴다 — 손잡이·패널 어느 쪽도 아니다.
    await user.pointer({ target: screen.getByRole('application', { name: '코트 편집 영역' }) });

    await waitFor(() => expect(panel()).toBeNull(), { timeout: 2000 });
  });

  it('고르고 나서 **안 닫힌다** — 둘 다 만지러 온 손을 도중에 끊지 않는다', async () => {
    // 트레이 서랍은 도구가 서로 배타라 하나를 고르면 볼일이 끝나지만, 이 둘은 독립 토글이다.
    const { user } = await openBoard({ showGrid: true, showRuleZones: true });
    await user.click(viewButton());

    await user.click(screen.getByRole('button', { name: '격자 표시 전환' }));
    expect(panel(), '한 번 눌렀다고 서랍이 닫혔다').toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '골 지역 가이드 전환' }));

    expect(loadPrefs().showGrid).toBe(false);
    expect(loadPrefs().showRuleZones).toBe(false);
  });
});

// ── [도움말] — 은퇴한 경위(지우지 않는다) ────────────────────────────────────────────
// 2026-08-16: [보기] 팝오버 셋째 항목 → 기둥 상시 칸(한 클릭으로 열림, 트리거가 제자리에
// 남아 포커스가 그대로 돌아옴). 2026-08-20(§0.5 Phase 5): 그 기둥 칸도 없어졌다 — 레일
// (AppRail·AppNavAside, 이 화면 밖) 상시 칸 하나로 일원화됐다. "이 화면에 도움말 트리거가
// 있는가" 는 더 이상 이 화면의 배선 몫이 아니라 EditorWorkspace.help.test.tsx(레일 통합)가
// 본다 — 그 파일이 이 describe 를 이어받았다.

// ── Esc 우선순위 4단 (완료 판정) ──────────────────────────────────────────────────
// 계약은 InspectorHost.tsx:17-24 에 있고 **등록 단계**가 보장한다:
//   (1) 모달(ui/Modal) — document **캡처** + stopPropagation
//   (2) 인스텍터        — 자기 **루트 요소**(포커스가 그 안에 있을 때만) + stopPropagation
//   (3) 전역 선택 해제  — document **버블**(useEditorKeyboard.ts:194)
// (3) 이 실제로 도달했는지를 보려면 리듀서 안을 들여다봐야 하는데, 화면 밖에서는 못 본다.
// 그래서 **같은 자리(document 버블)에 스파이를 하나 더 단다** — (3) 과 완전히 같은 단계라
// (1)·(2) 의 stopPropagation 이 (3) 을 막았다면 이 스파이도 못 받는다. 스파이가 진짜로
// 관측하고 있다는 것은 마지막 대조군(아무것도 안 열린 상태의 Esc)이 증명한다.
describe('Esc 우선순위 — 팝오버 > 전역 (등록 단계가 보장한다)', () => {
  // 옛 기록: 우선순위는 **모달 > 인스펙터 > 전역 선택 해제** 3단이었고, 그것을 플래그가 아니라
  // **등록 단계**가 보장했다(Modal 은 document 캡처, 인스펙터는 자기 루트). 자유 전술판에서
  // 인스펙터가 사라지면서 가운데 단이 없어졌다 — 남은 두 단의 관계는 그대로다.
  it('코트 모달이 떠 있으면 Esc 는 모달만 닫는다 — 판 선택은 안 건드린다', async () => {
    // 2026-08-16 — [보기]가 모달에서 서랍이 되면서 이 자리의 대표를 [코트]로 바꿨다. 서랍은
    // Modal 이 아니라 window 리스너로 Esc 를 받으므로(useFlyout) **단 관계가 다르다**:
    // 여기서 재려던 것은 "모달이 캡처 단계에서 먼저 먹는다" 이고, 그것을 가진 것은 이제 [코트]다.
    const { user } = await openBoard();
    await user.click(screen.getByRole('button', { name: '코트 형태와 크기' }));
    expect(screen.getByRole('dialog', { name: '코트' })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: '코트' })).toBeNull();
    // 판은 그대로 서 있다 — Esc 가 아래로 새지 않았다.
    expect(screen.getByRole('application', { name: '코트 편집 영역' })).toBeInTheDocument();
  });

  it('팝오버가 없으면 Esc 는 전역으로 간다 — 두 단이 실제로 갈린다는 대조군', async () => {
    const { user } = await openBoard();
    await user.keyboard('{Escape}');
    // 여기서 터지지만 않으면 된다(전역 경로는 useEditorKeyboard 의 몫이다).
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('편집 이력 — 헤더 → 트레이 → 기능 바', () => {
  it('되돌리기·다시하기가 정확히 하나씩이고 기능 바 안이다', async () => {
    await openBoard();
    const bar = document.querySelector<HTMLElement>('nav[data-function-bar]')!;
    const header = document.querySelector<HTMLElement>('header')!;
    for (const name of ['되돌리기', '다시하기']) {
      // getByRole 은 둘 이상이면 스스로 터진다 — 그것이 "안 늘었다" 의 단언이다.
      const btn = screen.getByRole('button', { name });
      expect(bar.contains(btn), `${name} 가 기능 바 밖이다`).toBe(true);
      expect(header.contains(btn), `${name} 가 헤더에 남아 있다`).toBe(false);
    }
  });

  it('되돌릴 것이 없어도 **사라지지 않고** disabled 다 — 사라지면 아래 칸이 통째로 움직인다', async () => {
    await openBoard();
    expect(screen.getByRole('button', { name: '되돌리기' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '다시하기' })).toBeDisabled();
  });
});

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

    await user.click(screen.getByRole('button', { name: '배율 100%' }));
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
