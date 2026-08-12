// 2.3 크롬 예산의 **배선** 확인 — 창이 좁아지면 판이 실제로 넓어지는가, 그리고 넓은 창에서는
// 정말 한 픽셀도 안 바뀌는가.
//
// 완료 판정 *"`narrow === false` 경로의 스냅샷이 현재와 바이트 동일"* 을 두 층으로 본다:
//   · **해시** — 2.3 이전 코드로 렌더한 `<main>` 전체(29KB)의 sha256. 바이트 동일의 본체다.
//     한 줄이라 diff 가 안 나오는 대신 "정확히 같은가" 에 애매한 답이 없다.
//   · **뼈대 스냅샷** — 상자들의 인라인 style 만 뽑은 목록. 해시가 깨졌을 때 *어디가* 달라졌는지
//     읽을 수 있게 하는 짝이다. 둘 중 하나만 두면 각각 "왜 깨졌는지 모른다" / "느슨하다" 가 된다.
// 두 값 모두 **작업 전 코드로 먼저 생성한 뒤** 구현을 얹었다 — 나중에 만든 스냅샷은 증거가
// 아니라 자기 자신의 사본일 뿐이다.
import { afterEach, describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
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
import { CHROME_ROWS, courtPadCss } from '../../app/chromeBudget.ts';
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

/** jsdom 에는 matchMedia 가 없다. 안 깔면 두 boolean 이 **둘 다 false** 로 굳어 좁은 경로가
 *  한 줄도 실행되지 않은 채 스위트가 초록불이 된다(BoardScreen.test.tsx 의 stubOrientation 과
 *  같은 이유). 질의마다 다른 답을 줘야 한다 — 하나로 뭉뚱그리면 세로 테스트가 덤으로 좁아진다. */
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
});

async function openBoard() {
  localStorage.setItem(PREFS_KEY, JSON.stringify({ ...makeDefaultPrefs(), defaultCourtMode: 'full' }));
  render(<BoardScreen />, { wrapper: Wrapper });
  await waitFor(() => expect(screen.getByRole('navigation', { name: '도구' })).toBeInTheDocument());
  const main = document.getElementById('main')!;
  // ⚠️ TransformWriter 는 React 밖에서 rAF 로 `transform` 을 직접 쓴다(§6.1 규칙 1). 첫 프레임
  //    전에 DOM 을 읽으면 골대·개체에 그 속성이 통째로 없어서 해시가 흔들린다 — 파일 하나만
  //    돌릴 때는 늘 맞다가 전체 스위트(부하)에서만 가끔 빠졌다. 판이 한 번 그려진 뒤에 읽는다.
  await waitFor(() => expect(main.querySelector('.goal-post')).toHaveAttribute('transform'));
  return main;
}

/** 상자들의 인라인 style 만 남긴다. 코트 <svg> 안쪽(라인·격자·개체)은 크롬 예산의 대상이
 *  아니고, 거기까지 넣으면 좌표 한 자리가 바뀌어도 이 테스트가 대신 빨간불이 되어 무엇이
 *  깨졌는지 알 수 없게 된다. */
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

describe('narrow === false — PC 경로는 한 바이트도 안 바뀐다', () => {
  // ⚠ 이름을 정확히 읽어라: 비교 대상은 **현재 기준선** 이지 '재편 전' 이 아니다. 2.4·2.10·2.12 가
  //   각각 정당하게 갱신했고 2차 종료 시점에 재편 전과는 223줄이 다르다(인스펙터 aside 128줄이
  //   기본 화면에서 빠진 것이 최대 항목 — 결정 ③A). 'PC 화면은 재편 전과 같다' 로 읽으면 틀린다.
  it('넓은 창의 판 DOM 이 현재 기준선과 바이트 동일하다', async () => {
    stubMedia({ portrait: false, narrow: false });
    const main = await openBoard();
    // ⚠️ 이 해시는 **2.3 작업 전 코드**로 렌더한 결과였고, 그 뒤 네 번 갱신됐다:
    //    2.4(`--hit` 실배선 — 트레이 칩·폭, StageControls·BoardBar·속도 스위치),
    //    2.10(하단 바 세로 여백 12/15 → 7/8 — 사진 뭉치가 라벨줄을 흡수하며 두 바가 같은
    //    리듬을 쓰게 됐다. BoardBar 는 60, TransportBar 는 64 다),
    //    2.12(§4.4 P2-4 규칙 오버레이 층이 코트 `<svg>` 안에 들어왔다),
    //    3.11(BoardBar 잠금 사유 <p> 하나 → 문구 스택 <div> — CourtDef.desc 한 줄이 위에
    //    얹혔다. 두 줄 다 nowrap 이라 바 높이 60 은 불변이다. BoardBar.test.tsx 가 그 보증이다).
    //    네 번 다 **HTML 전수 diff** 로 움직인 줄이 그것뿐임을 확인한 뒤에 갱신했다 —
    //    2.10 의 diff 는 정확히 1줄(하단 바 padding)이었고(FALSIFICATION §17.2/§18),
    //    2.12 의 diff 는 **삽입 1건**(`<g aria-hidden pointer-events="none">` 규칙 층. 빈
    //    전술판이라 공이 없어 링은 0개이고 골 지역 표시 2개가 opacity 0 으로 숨어 있다),
    //    3.11 의 diff 는 **치환 1건**(그 <p> 자리 그대로 <div>+<p>×2. 상자 뼈대는 그 세 줄 밖에
    //    한 줄도 안 움직였다),
    //    3.-1 의 diff 는 **트레이 기능 구역 한 덩어리**(모드 5종 → 상시 2종[선택·지우개] +
    //    닫힌 서랍 손잡이[작도]. 접힌 이동·패스·메모 세 버튼이 DOM 에서 빠진 것이 전부이고,
    //    구역 밖 — 헤더·코트·개체 칩·상자·하단 바 — 은 한 줄도 안 움직였다. `<main>` 전문
    //    diff 로 확인했다: 바뀐 hunk 가 그 한 곳뿐이다),
    //    3.7 의 diff 는 같은 자리의 **hunk 2개**(서랍이 §3 대로 둘로 갈렸다: `작도` 손잡이의
    //    title 에서 메모가 빠지고, 바로 뒤에 `설명` 손잡이 하나가 삽입됐다. 손잡이는 기능
    //    구역 맨 끝이라 위쪽 좌표는 그대로다 — §3 불변식 1. ToolRail.test.tsx 의 좌표 모형이
    //    그 보증이고, 여기 뼈대 스냅샷의 diff 도 삽입 4줄뿐이다),
    //    3.9 의 diff 는 **삽입 1건**(StageControls 맨 끝의 도움말 `?` 버튼. 스테이지 컨트롤은
    //    코트 위에 뜬 묶음이라 레이아웃 폭·높이를 안 먹고, 맨 끝 삽입이라 기존 여섯 버튼의
    //    좌표도 그대로다 — §3 예산 내역 '스테이지 컨트롤 6(줌 3 + 토글 2 + 도움말 1)' 이 이걸로
    //    찼다),
    //    4.7 의 diff 는 **치환 1건**(하단 바의 [골대 원위치] 버튼 한 줄 → [내보내기]. 같은 자리·
    //    같은 style 문자열이고 `aria-haspopup="dialog"` 한 속성만 늘었다. 골대 원위치는 [코트
    //    비우기] 확인 모달 안으로 들어가 **DOM 에서는 사라졌다** — 첫 화면 표적 예산이 40/40 로
    //    여유 0 이었기 때문이다. 근거는 BoardBar.tsx 머리말 ⚠️. `<main>` 전문 diff 로 확인했다:
    //    바뀐 줄이 그 한 줄뿐이고 상자 뼈대 스냅샷은 한 줄도 안 움직였다),
    //    5.2+5.3 의 diff 는 **코트 라인 그룹 안에서만**, 삭제 2 · 삽입 5 다(FIPFA Laws 2025 대조):
    //    삭제 = 규정에 없는 센터 서클 `<circle r="75">` 과 그 안의 흰 센터 점 `<circle r="4.5">`
    //    (§9 결정 ⑧ — Laws 전문 50쪽에 "circle" 0회), 삽입 = 코너킥 인크로치먼트 마크 4개
    //    (`M37.5,212.5 L25,212.5` 꼴 — 골포스트 **안쪽 1 m**, 골라인에 수직, 필드 밖)와
    //    센터 마크 X 1개(`M410.625,260.625 …` — 15 cm). **판을 뺀 나머지(<main> 의 다른 모든 줄)는
    //    한 줄도 안 움직였다** — 갱신 전 코드로 같은 덤프를 떠서 전문 diff 로 확인했고, 위 hunk
    //    두 개가 전부였다.
    //    손으로 고쳐 맞추지 마라 — 깨졌다면 아래 뼈대 스냅샷의 diff 가 무엇이 달라졌는지 알려 준다.
    expect(createHash('sha256').update(main.outerHTML).digest('hex')).toBe(
      'b29ee225832cd7dd30fcd9d002240aa7d29864524395092979bf17ca74314cb4',
    );
  });

  it('넓은 창의 상자 뼈대', async () => {
    stubMedia({ portrait: false, narrow: false });
    const main = await openBoard();
    expect(layoutSkeleton(main)).toMatchSnapshot();
  });
});

/** 코트를 감싼 상자(패딩을 먹는 그 상자) 하나. 여러 개가 잡히면 엉뚱한 노드를 보고 있는
 *  것이므로 개수까지 단언한다 — 선택자가 낡으면 조용히 다른 div 를 검사하게 된다. */
function courtWrapper(main: HTMLElement): HTMLElement {
  const hits = [...main.querySelectorAll('div')].filter(
    (d) => d.style.alignItems === 'center' && d.style.justifyContent === 'center' && d.style.padding !== '',
  );
  expect(hits, '코트 래퍼 선택자가 낡았다').toHaveLength(1);
  return hits[0]!;
}

describe('narrow === true — 크롬 예산의 코트 래퍼 행', () => {
  it('좁은 창에서 패딩이 20/24 → 8/12 로 줄어든다', async () => {
    stubMedia({ portrait: false, narrow: true });
    const main = await openBoard();
    expect(courtWrapper(main).style.padding).toBe(courtPadCss(true));
    expect(courtWrapper(main).style.padding).toBe('8px 12px');
  });

  it('넓은 창에서는 그대로다 — 대조군', async () => {
    stubMedia({ portrait: false, narrow: false });
    const main = await openBoard();
    expect(courtWrapper(main).style.padding).toBe('20px 24px');
  });

  it('줄어든 폭·높이가 예산표의 그 행과 정확히 같다', async () => {
    // DOM 의 픽셀과 예산표의 숫자가 각자 놀면 표가 화면을 설명하지 못한다.
    const row = CHROME_ROWS.find((r) => r.id === 'courtPadX')!;
    const rowY = CHROME_ROWS.find((r) => r.id === 'courtPadY')!;
    stubMedia({ portrait: false, narrow: true });
    const main = await openBoard();
    const s = courtWrapper(main).style;
    expect(Number.parseInt(s.paddingLeft, 10) + Number.parseInt(s.paddingRight, 10)).toBe(row.narrow);
    expect(Number.parseInt(s.paddingTop, 10) + Number.parseInt(s.paddingBottom, 10)).toBe(rowY.narrow);
    expect([row.narrow, rowY.narrow]).toEqual([24, 16]);
  });

  it('세로 판정과 좁음 판정은 서로 섞이지 않는다', async () => {
    // 세로로 세운 큰 태블릿(예: 27인치를 돌린 창)은 세로지만 좁지 않다. 하나로 묶으면 여기서
    // 크롬이 걷혀 버린다.
    stubMedia({ portrait: true, narrow: false });
    const main = await openBoard();
    expect(main.style.flexDirection, '세로 판정은 여전히 살아 있어야 한다').toBe('column');
    expect(courtWrapper(main).style.padding).toBe('20px 24px');
  });

  it('가로로 눕힌 좁은 기기 — 좁지만 세로가 아니다', async () => {
    stubMedia({ portrait: false, narrow: true });
    const main = await openBoard();
    expect(main.style.flexDirection).toBe('row');
    expect(courtWrapper(main).style.padding).toBe('8px 12px');
  });
});
