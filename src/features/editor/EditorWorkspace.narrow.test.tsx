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
    //    2026-08-13 기현님 실기 피드백 ①②(센터 마크 · 골 지역 채움)의 diff 는 **코트 `<svg>`
    //    안에서만**, 치환 7건이다. 세 항목이 세 커밋에 나뉘어 들어와 셋 다 이 해시를 옮겨
    //    놓고도 아무도 갱신하지 않아 devel 이 하루 종일 빨간 채였다 — 6차 검증관이 아래
    //    절차를 실제로 밟아 한 번에 갱신했다(a0c3697 을 `git archive` 로 따로 풀어 같은 덤프를
    //    뜨고 `<main>` 전문 diff). 움직인 줄은 정확히 이 일곱이고 **판 밖은 한 줄도 안 움직였다**:
    //     · ① 센터 마크 1건 — `M410.625,260.625 …`(반폭 1.875, 규격 15 cm)
    //       → `M409,259 L416,266 M416,259 L409,266`(반폭 3.5 = 페널티 스팟 십자와 같은 크기,
    //       28 cm). 기현님 실기 지시로 규격을 벗어난 **표시 크기**다(court.ts 근거).
    //     · ② RuleZones 존 rect 2건 — `fill="#ffffff" opacity="0.14"`
    //       → `fill="#ffb3b3" fill-opacity="0.22"`. 요소 opacity → fill-opacity 이동이 핵심이다
    //       (옛 값은 흰 파선 테두리까지 0.14 로 깎고 있었다 — RuleZones.tsx 머리말 실측).
    //     · ② RuleZoneMark 케이싱 rect 2건 — `opacity="0.55"` → `"1"`(코트 위 2.48:1 → 3.93:1).
    //     · ② RuleZoneMark 표시 rect 2건 — `#ff5a5a`/`0.2` → `#d42020`/`0.5`.
    //    ③(공 거리 원)과 ④([골대 원위치] 이전)는 **이 스냅샷에 한 바이트도 기여하지 않았다** —
    //    빈 전술판에는 공이 없어 링이 0개이고, 인스펙터는 닫혀 있으면 DOM 에 없다. 그 사실
    //    자체가 ④ 의 표적 예산 주장(37/40 불변)의 독립 검산이다.
    //    2026-08-14 P2(뷰 컨트롤 재편)의 diff 는 **hunk 2개**다. §6 절차대로 갱신 전 커밋
    //    (af31d47)을 `git archive` 로 따로 풀어 같은 덤프를 뜨고 `<main>` 전문을 diff 했다 —
    //    바뀐 줄이 정확히 이 둘이고 코트 `<svg>`·헤더·칩·하단 바 앞쪽은 한 줄도 안 움직였다:
    //     · 코트 칸 안의 `position:absolute` 묶음 div 가 **통째로 사라지고**(그 안의 격자·골
    //       지역 가이드·속성·도움말 네 버튼도 함께), 줌 3개가 `nav[data-tray]` **맨 위**로
    //       옮겨 갔다 — `role="group" aria-label="확대"` + 구분선 1개가 새로 났다. 세 버튼의
    //       style 문자열은 한 글자도 안 바뀌었다(이사했지 작아지지 않았다).
    //     · 하단 바 문구 스택 **뒤에** [보기▾]·[속성] 두 버튼이 삽입됐다. 맨 끝 삽입이라
    //       [코트 비우기]·[내보내기]·속도 스위치의 자리는 그대로다(§3 불변식 1).
    //    설계서 §6 의 "깨질 테스트 판정" 표는 이 해시의 갱신을 P3·P4 두 번으로 적었지만
    //    **P2 도 판 DOM 을 바꾼다**(컨트롤의 소속이 바뀌므로) — 표가 한 번을 빠뜨린 것이다.
    //    2026-08-14 P3(유동 트레이 + 종횡비 코트 칸)의 diff 는 **hunk 5개**다. 같은 절차로
    //    갱신 전 커밋(940355a)을 `git archive` 로 풀어 같은 덤프를 뜨고 `<main>` 전문을 diff
    //    했다 — 코트 `<svg>` 안쪽·헤더·하단 바·칩 자체는 **한 줄도 안 움직였다**:
    //     · 트레이 축을 쥐던 바깥 div(`flex-direction: row`)가 **사라지고**, 그 자리에 정렬
    //       상자(패딩 20px 24px)가 올라왔다. 정렬 상자 안에 **판 덩어리 `[data-board]`** 와
    //       **코트 칸**(`aspect-ratio: 825 / 525`) 두 div 가 새로 났다. 코트 칸이 자기 종횡비
    //       만큼만 차지하고 남는 폭이 트레이로 흘러간다 — 그것이 옛 86px 죽은 띠의 정체다.
    //     · `nav[data-tray]` 의 `width: calc(var(--hit)*2+5px)` 못박음이 **빠지고**
    //       `flex: 1 1 0px` · `max-width: calc(var(--hit)*5+20px)` 가 들어왔다. `min-width` 는
    //       그대로다(값이 아니라 **뜻**이 "폭" → "최소폭" 으로 바뀐 것이다 — chromeBudget.ts 의
    //       toolRail 행 주석에 왜 모든 수식이 그대로 참인지 적어 뒀다).
    //     · 개체(벤치) 구역이 column → **row + wrap**(+ align-content/justify-content flex-start).
    //       칩 줄의 93px 못박음이 `width: 100%` 로 바뀌고 중앙정렬이 flex-start 가 됐다.
    //     · 기능 구역도 column → **row + wrap + width:100%**.
    //     · 판 덩어리를 닫는 `</div>` 한 줄 추가.
    //    2026-08-14 P4(한 물건 시각화)의 diff 는 **hunk 2개**다 — 설계서 §5-P4 가 예고한 그대로
    //    "그림자 div 삭제 1건 + 판 덩어리 style 1건" 이고 그 밖은 한 줄도 안 움직였다. 같은
    //    절차로 갱신 전 커밋(af02355)을 `git archive` 로 풀어 대조했다:
    //     · 판 덩어리 style 에 `border: 1px solid var(--border)` · `border-radius: 16px` ·
    //       `overflow: hidden` · `box-shadow: 0 18px 30px rgba(0,0,0,.45)` 넉 줄이 붙었다.
    //     · 코트만 감싸던 **그림자 전용 div**(`filter: drop-shadow(...)`)가 여는 태그·닫는
    //       태그 통째로 사라졌다. 그림자가 이제 코트+벤치를 함께 감싼다 = 한 물건이 된다.
    //       (`filter` 를 버린 두 번째 이유는 후손의 `position:fixed` 기준 상자 — 판 덩어리 안에
    //        트레이가 들어온 이상 그 함정이 트레이 쪽으로 옮겨 온다.)
    //    배경은 양쪽 다 `var(--panel-2)` **그대로**이고 트레이의 inset 홈도 한 글자도 안 바꿨다 —
    //    경계는 이제 색이 아니라 테두리+그림자가 만든다(설계서 §4.4).
    //    2026-08-14 (같은 날, 두 번째 지시 *"undo, redo 버튼을 줌 버튼과 묶어 배치"*)의 diff 는
    //    **hunk 1개 · 삽입 18줄**이다. 같은 절차로 갱신 전 커밋(457727f)을 `git worktree` 로
    //    따로 풀어 같은 덤프를 뜨고 `<main>` 전문을 diff 했다 — 바뀐 것이 그 한 덩어리뿐이다:
    //     · 줌 구역 **바로 뒤**에 `role="group" aria-label="편집 이력"` div 하나와 그 안의
    //       [되돌리기]·[다시하기] 두 버튼이 삽입됐다(둘 다 빈 판이라 `disabled`). 줌 세 버튼의
    //       style 문자열도, 그 뒤의 구분선·개체·기능 구역도 한 글자 안 움직였다 — 삽입 지점이
    //       줌과 구분선 **사이**라 아래 표적의 DOM 순서가 그대로다.
    //    헤더에서 같은 두 버튼이 **사라진 것**은 이 해시에 안 나타난다 — 이 덤프는 `<main>`
    //    이고 헤더는 그 밖이다. 그쪽 증인은 AppHeader.test 와, 이름으로 찍는 여러 테스트가
    //    여전히 **정확히 하나**를 찾는다는 사실이다(둘이면 "여러 개" 로 터진다).
    //    2026-08-14 (같은 날, **세 번째 지시** — 속성 패널 해체 + 오른쪽 기능 바)의 diff 는
    //    **hunk 13개 · 삭제 73줄 · 삽입 139줄**이다. 같은 절차로 갱신 전 커밋(0e8e60b)을
    //    `git worktree` 로 풀어 같은 덤프를 뜨고 `<main>` 전문을 diff 했다. 이번엔 크므로
    //    **무엇이 사라지고 무엇이 생겼는지**를 적는다:
    //     · 트레이에서 **빠진 것**: 줌 3(확대·축소·줌 초기화) · 편집 이력 2(되돌리기·다시하기)
    //       와 그 구분선 하나. 전부 새 `nav[data-function-bar]` 로 갔다.
    //     · `<main>` 에서 **빠진 것**: 하단 바 통째(코트 비우기·내보내기·속도 제한 switch·
    //       [보기]·[속성])와 인스펙터 손잡이. 자유 전술판에는 하단 바도 인스펙터도 없다.
    //     · **생긴 것**: `<main>` 의 마지막 자식으로 `nav[data-function-bar]` 11칸 + 구분선 3.
    //     · 칩이 **정사각**이 됐다(44×60 → 44×44) — 상자 height 와 SVG width/height 식이
    //       바뀌면서 선수 8칸이 전부 다시 찍혔다(삽입 줄의 절반이 이것이다).
    //     · 판 덩어리 축이 뒤집혔다(row → column) — 트레이가 코트 긴 변에 붙는다.
    //    **코트 `<svg>` 안쪽은 한 줄도 안 움직였다** — 라인·격자·개체·골대가 전부 그대로다.
    //    손으로 고쳐 맞추지 마라 — 깨졌다면 아래 뼈대 스냅샷의 diff 가 무엇이 달라졌는지 알려 준다.
    //    2026-08-14 (같은 날, 네 번째 지시 *"아래의 트레이가 가운데 정렬이 되어야 한다"*)의
    //    diff 는 **한 줄**이다: 띠 nav 의 `justify-content: flex-start` → `safe center`.
    //    서랍 플라이아웃은 이제 포털이라 `<main>` 밖이고, 닫혀 있으면 DOM 에도 없다.
    //    2026-08-14 (다섯 번째 지시 *"드릴로 저장 버튼 오른쪽 도구모음으로 옮기고 상단 헤더
    //    삭제"*)의 diff 는 **hunk 1개 · 삭제 0 · 삽입 11**이다: 기능 바 맨 끝에 구분선 하나와
    //    [드릴로 저장] 칸 하나가 붙은 것이 전부다. 맨 끝 삽입이라 위 열한 칸의 좌표가 한
    //    픽셀도 안 움직였다(§3 불변식 1).
    //    ⚠️ **헤더가 사라진 것은 이 해시에 안 나타난다** — 이 덤프는 `<main>` 이고 헤더는 그
    //    밖이다. 그쪽 증인은 AppShell.wiring.test 의 두 it 이다(넓으면 header 가 없고 좁으면 있다).
    //    2026-08-14 (작도 도형 3종)의 diff 는 **한 줄**이다: 작도 서랍 손잡이의 `title` 에
    //    원·삼각·사각이 붙은 것. 도형 층(`[data-shape-layer]`)은 도형이 0개면 `null` 을
    //    돌려주므로 빈 판의 DOM 에는 **한 글자도 안 나타난다** — 그것이 이 해시가 한 줄만
    //    움직인 이유다. 층의 자리는 shapeTool.test 가 실제 도형을 놓고 잰다.
    //    2026-08-15 (진영 — *"수비측이 우리편 골에리어에 3명이 못 들어가는 거지"*)의 diff 는
    //    **둘**이다: ① 기능 바에 [진영] 칸 하나(아래 뼈대 스냅샷이 그 한 칸을 보여 준다 —
    //    삽입 위치가 [비우기] **앞**이라 뒤 칸들의 좌표가 밀리는데, 그것이 §3 불변식 1 을
    //    거스르지 않는 이유는 이 라운드에서 기둥 자체가 처음 서는 화면이기 때문이다)
    //    ② 코트 안에 진영 표시 `<g data-side-marks>`(골라인 뒤 깃발 넷 — 풀 코트는 존이 둘).
    //    ②는 뼈대 스냅샷에 안 나온다(SVG 원소는 그 덤프가 안 뜬다) — 증인은 SideMarks.test 다.
    //    같은 날 기현님 지시 *"점을 골 라인에 평형되게 배치"* 로 그 점들의 좌표가 한 번 더
    //    움직였다(골라인에 수직 → **나란히**). 그림만 바뀌고 칸 수·상자는 그대로다.
    //    2026-08-16 (작도 도구 통합 — *"패스, 이동이 무의미하다. 선으로 통일"*)의 diff 는
    //    **트레이 작도 서랍 손잡이의 title 한 줄**이다: 이동·패스 두 이름이 '선' 하나가 됐다.
    //    빈 판이라 화살표 자체는 DOM 에 없고 마커도 색이 쓰일 때만 만들어진다.
    //    2026-08-16 (화살촉 케이싱 — 기현 신고 *"검은 부분 없애줘"*)의 diff 는 **빈 판에서
    //    마커 둘이 사라진 것**이다. 색상 마커는 원래도 쓰인 색만큼만 났지만 **케이싱 마커는
    //    색과 무관하게 늘 둘** 났다 — 그것이 없어졌다(대비는 이제 화살촉 자신의 stroke 가
    //    맡는다). 바로 윗줄 *"마커도 색이 쓰일 때만"* 이 이제야 빈틈없이 참이다.
    //    2026-08-16 (단축키 전면 개편 1단계)의 diff 는 **도구 버튼마다 글자 배지 span 하나**와
    //    그 버튼들의 `title` 이다. 배지는 단축키를 도움말 모달 밖으로 꺼낸 것이고(기현 지시),
    //    `aria-hidden` 이라 **접근성 이름은 한 글자도 안 바뀐다**. ⚠️ 배지가 붙는 버튼은
    //    아홉이고 **지우개에는 안 붙는다** — 지우개만 단축키가 없다(Delete 로 일원화). 뼈대
    //    스냅샷에서 두 번째 버튼에 span 이 하나 적은 것이 그 증거다.
    //    2026-08-16 (개편 2단계 — 지우개 도구 제거)의 diff 는 **트레이 기능 구역에서 버튼
    //    하나가 통째로 빠진 것**이다. 상시 노출이 [선택][지우개] 둘에서 [선택] 하나가 됐고,
    //    그래서 바로 윗줄의 "배지가 안 붙는 버튼" 도 이제 없다 — 남은 도구는 전부 키를 갖는다.
    //    2026-08-16 (기능 바 재편 — 기현 지시 넷)의 diff 는 **기둥 안에서만** 난다. 칸 수는
    //    13 그대로이고 자리만 하나가 갈린다:
    //     · [진영] 칸이 **빠지고** 같은 자리에 아무것도 안 들어온다 — [코트] 모달 안으로 갔다.
    //     · 기둥 끝쪽 [보기] 뒤에 [도움말] 칸이 **생긴다** — [보기] 팝오버에서 나왔다.
    //       즉 뒤쪽 칸([저장])은 그대로 있고 중간 한 칸이 앞으로 당겨진 모양이다.
    //     · [초기화] → [100%] — 화면 글자와 aria-label 둘 다(이름 규칙: 글자 ⊂ 이름).
    //     · [보기]가 `aria-haspopup="dialog"` 를 잃고 `aria-expanded="false"` 만 남긴다 —
    //       모달이 아니라 서랍이 됐다. 서랍 패널은 포털이라 닫히면 DOM 에 없다.
    //    2026-08-16 (다중 선택 재설계 — §6.10b)의 diff 는 **[선택] 버튼의 `title` 한 줄**이다:
    //     · *" — 한 번 더 누르면 여러 개를 모아 고릅니다."* 가 붙었다. 선택 도구도 고정되는
    //       도구가 되면서(모아 고르기) 다른 도구가 이미 하던 말을 똑같이 하게 된 것이다.
    //     · 개수 표시(`role="status"`)는 **빈 판에 안 뜬다** — 둘 이상 골랐을 때만 난다.
    //     · 존·화살표 손잡이가 '선택이 정확히 하나' 로 좁혀졌지만 빈 판에서는 전후가 같다.
    //    2026-08-16 (트레이 드롭 예고 — §6.10c)의 diff 는 **트레이 첫 자식으로 빈 div 하나**다:
    //     · `<div data-tray-hint aria-hidden style="position:absolute;inset:0">` — 드래그 중에만
    //       CSS 가 보여 주는 덮개라 기본 상태에서는 **글자도 색도 없다**(내용은 trayDrop.ts 가
    //       드래그 중에 직접 쓴다).
    //     · 흐름 밖이라 어떤 표적도 밀지 않는다 — 트레이 구역을 세는 두 테스트가 이 노드를
    //       빼고 세는 것이 그 사실의 못이다(§3 불변식 1 은 그대로다).
    //    2026-08-16 (진영 표시 모양 교체 — 기현 지시 *"진영 표시 원이 직관적으로 공과 혼돈할
    //    수있으니 삼각형 깃발 형대로. 안에 G,P 표기해서."*)의 diff 는 **`<g data-side-marks>`
    //    안쪽에만** 난다. 깃발 하나가 `<circle>` 하나에서 `<g data-side-flag>` 하나(삼각형
    //    polygon + 깃대 line + 글자 text)가 됐다 — 풀 코트는 깃발이 넷이므로 원 넷이 그 셋씩으로
    //    바뀐 것이 전부다. ⚠️ 기둥의 [진영] 아이콘도 같은 날 원에서 깃발로 바뀌었지만 **이
    //    해시에는 안 나타난다** — 그 버튼은 [코트] 모달 안이고 모달은 닫혀 있으면 DOM 에 없다.
    //    같은 날 두 번째 지시(*"깃발은 정삼각형에 꼭지점이 다 오른쪽을 향할것. 골라인과는
    //    0.5미터 떨어져 둘것"*)의 diff 는 **그 깃발들의 좌표뿐**이다: 깃대 `<line>` 이 빠지고
    //    (지시가 '정삼각형' 이다) polygon 세 점과 글자 앵커가 새 자리로 간다. 원소 수는
    //    깃발마다 셋 → 둘이 된다. 모양만 바뀌고 상자·칸 수는 그대로다.
    //    같은 날 세 번째 지시(*"글자를 지우고 삼각형을 줄이고 깃발 깃대를 표현하자"*)의 diff 도
    //    **`<g data-side-marks>` 안쪽뿐**이다: 깃발마다 `<text>` 가 빠지고 `<line>`(깃대)이
    //    들어오며 polygon 이 작아진 자리로 간다. 원소 수는 깃발마다 둘 그대로다.
    //    같은 날 네 번째 지시(*"깃대가 조금 길다. 절반으로 줄여라"*)의 diff 는 **깃대 `<line>`
    //    의 길이**다 — 페넌트 아래로 드러난 토막이 10 → 5 가 됐다. 깃대가 짧아지면 깃발
    //    상자의 중심도 옮겨지므로 polygon 좌표가 따라 움직인다(세로 골라인에서는 y 로만,
    //    가로 골라인에서는 골라인 쪽으로 당겨진다 — 가장 가까운 점은 여전히 0.5 m 여야
    //    하고 SideMarks.test 가 그것을 잰다).
    //    2026-08-18 (하단 철거 — 기현님 *"결과적으로 하단에는 노트 빼고 다 삭제"*)의 diff 는
    //    **useId 접미 숫자의 밀림뿐**이다(`_r_2_` → `_r_1_` 등): EditorWorkspace 에서 인스펙터
    //    (useId 하나)가 폐기되며 뒤따르는 자동 id 가 전부 한 칸 당겨졌다. `<main>` 전문 diff
    //    로 확인했다 — 바뀐 줄은 aria-describedby/id 쌍의 접미뿐, 원소·속성·좌표는 그대로다
    //    (전술판에는 하단 바도 인스펙터도 원래 없었으므로 구조 diff 가 0 인 것이 옳다).
    //    바로 위 뼈대 스냅샷 테스트가 통과하는 것이 "구조는 안 바뀌었다" 의 증거다.
    //    **코트 `<svg>` 바깥은 한 줄도 안 움직였다** — 판 덩어리·트레이·기둥이 전부 그대로다.
    expect(createHash('sha256').update(main.outerHTML).digest('hex')).toBe(
      '0050c6d0dd92ab31a77d5df80d3d8078a716937f84b96732f0922e5187f4d53d',
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
    // 2026-08-14 — 전술판의 main 은 언제나 row 다. 세로 판정은 판 덩어리의 축이 말한다.
    expect(document.querySelector<HTMLElement>('[data-board]')!.style.flexDirection, '세로 판정은 여전히 살아 있어야 한다').toBe('row');
    expect(courtWrapper(main).style.padding).toBe('20px 24px');
  });

  it('가로로 눕힌 좁은 기기 — 좁지만 세로가 아니다', async () => {
    stubMedia({ portrait: false, narrow: true });
    const main = await openBoard();
    expect(main.style.flexDirection).toBe('row');
    expect(courtWrapper(main).style.padding).toBe('8px 12px');
  });
});
