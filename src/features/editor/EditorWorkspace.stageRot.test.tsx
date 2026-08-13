// §4.2 P1 배선 — `rot` 이 **창 크기에서 판까지** 실제로 흐르는가.
//
// 왜 이 파일이 따로 있나: useStageRot.test.ts 는 순수 함수와 훅만 본다. 그런데 이 재설계에서
// 진짜 위험한 것은 계산이 아니라 **사슬**이다(EditorWorkspace → EditorStage → CourtStage →
// computeMetrics). 어느 한 마디만 끊겨도 판은 조용히 '안 돌아간 판'으로 그려지고, 7인치 세로에서
// 축척이 23% 작아진 것을 아무도 빨간불로 만나지 못한다.
//
// ★ 이 검사는 **재설계 전에는 불가능했다.** 옛 코드는 `<svg>` 의 실측 rect 로 회전을 정했는데
//   jsdom 은 레이아웃을 계산하지 않아 rect 가 언제나 0×0 이라, 어떤 창 크기를 줘도 rot 은 0 이었다.
//   회전을 창 크기에서 정하게 되면서 **jsdom 에서도 실행되는 경로**가 됐다 — 되먹임을 끊은 대가로
//   따라온 이득이고, 그래서 이 파일은 P1 의 완료 증거이기도 하다.
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
import { stageRotFor } from '../../app/useStageRot.ts';
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

/** jsdom 에는 matchMedia 가 없다. 안 깔면 두 분기 boolean 이 둘 다 false 로 굳어 좁은 경로가
 *  한 줄도 실행되지 않는다(narrow.test.tsx 의 같은 이름 스텁과 같은 이유). `rot` 불변 상자
 *  질의도 여기로 들어오지만 훅은 그 `matches` 를 **답으로 읽지 않는다**. */
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

async function openBoard(): Promise<SVGSVGElement> {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), defaultCourtMode: 'full' }));
  render(<BoardScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  return document.getElementById('main')!.querySelector('svg')!;
}

const FULL = COURT_DEFS.full;

/** 회전 <g> 는 `<svg>` 의 **직계 자식** 하나뿐이다(CourtStage 가 월드 콘텐츠 전체를 이 하나로
 *  돌린다). 안쪽 개체·라인에도 transform 이 붙은 <g> 가 수두룩해서 선택자를 느슨하게 잡으면
 *  엉뚱한 노드를 보고 초록불이 난다. */
const rotGroup = (svg: SVGSVGElement): Element | null => svg.querySelector(':scope > g');

describe('창 크기가 판을 돌린다 — rot 이 위에서 내려온다', () => {
  it('7인치 세로 480×800 — viewBox 와 <g> 가 둘 다 돌아간 판이다', async () => {
    setViewport(480, 800);
    stubMedia({ portrait: true, narrow: true });
    // 하네스 검산: 이 창에서 답이 90 이어야 아래 단언에 뜻이 있다.
    expect(stageRotFor('full', undefined, { narrow: true, inspector: 'hidden' }, { w: 480, h: 800 })).toBe(90);

    const svg = await openBoard();
    // 90° 돌면 화면에 놓이는 상자의 가로·세로가 뒤바뀐다(§6.4).
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${FULL.vbH} ${FULL.vbW}`);
    // 그림도 함께 돌아야 한다. viewBox 만 바뀌고 <g> 가 안 돌면 판이 눕는 대신 찌그러진다.
    // ⚠️ `:scope > g` 여야 한다 — 안쪽 개체·라인에도 transform 이 붙은 <g> 가 수두룩하다.
    expect(rotGroup(svg)?.getAttribute('transform')).toBe(`translate(${FULL.vbH} 0) rotate(90)`);
  });

  it('대조군 — 같은 판을 가로 1024×768 에 두면 한 톨도 안 돈다', async () => {
    setViewport(1024, 768);
    stubMedia({ portrait: false, narrow: false });
    expect(stageRotFor('full', undefined, { narrow: false, inspector: 'hidden' }, { w: 1024, h: 768 })).toBe(0);

    const svg = await openBoard();
    expect(svg.getAttribute('viewBox')).toBe(`0 0 ${FULL.vbW} ${FULL.vbH}`);
    expect(rotGroup(svg), '회전 <g> 자체는 늘 있다 — 없으면 선택자가 낡은 것이다').not.toBeNull();
    expect(rotGroup(svg)!.getAttribute('transform'), '안 돌면 transform 속성 자체가 없다').toBeNull();
  });

  it('대조군 — 세로 판정과 회전은 다른 판정이다. 세워도 거의 정사각형(1500×1520)이면 안 돈다', async () => {
    // `useIsPortrait` 과 `rot` 은 **다른 판정**이고 그래야 맞다(useIsPortrait.ts 머리말):
    // 레이아웃은 창 모양이, 회전은 **코트 상자와 코트 종횡비의 조합**이 정한다. 하나로 묶으면
    // 여기서 돌아 버린다 — 코트 상자 1275×1354 는 세로로 길지만, 그 안에서 풀 코트(1.57:1)를
    // 돌려도 1.6412 / 1.5455 = 6% 밖에 안 커져 ROTATE_GAIN(8%)에 못 미친다.
    setViewport(1500, 1520);
    stubMedia({ portrait: true, narrow: false });
    expect(stageRotFor('full', undefined, { narrow: false, inspector: 'hidden' }, { w: 1500, h: 1520 })).toBe(0);
    const svg = await openBoard();
    expect(document.getElementById('main')!.style.flexDirection, '세로 배치는 살아 있다').toBe('column');
    expect(svg.getAttribute('viewBox'), '그래도 판은 안 돈다').toBe(`0 0 ${FULL.vbW} ${FULL.vbH}`);
  });
});
