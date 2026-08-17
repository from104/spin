// §5.2/§5.3 크롬 예산 — **판이 아닌 것**이 먹는 픽셀을 한곳에 모은다.
//
// 왜 상수 모듈인가: 이 값들은 지금 여섯 파일의 인라인 style 에 흩어져 있고(§5.1 — 저장소 전체
// `@media` 는 `prefers-reduced-motion` 하나뿐이라 CSS 로는 얹을 수 없다), 흩어진 채로는
// **"다 합쳐서 얼마인가"** 를 아무도 답하지 못한다. 답을 못 하면 1024×600 에서 코트가 왜 저만한
// 크기인지도, 어느 한 줄을 줄였을 때 판이 얼마나 커지는지도 모른 채 손대게 된다.
//
// 여기 모으면 §5.3 실측표를 **계산으로 재현**할 수 있다(chromeBudget.test.ts 가 표의 모든 칸을
// 이 함수들로 다시 만들어 대조한다). 각 행을 실제로 줄이는 일은 `owner` 항목이 한다 — 값과
// 조치를 갈라 두는 것이 요점이다. 값이 여기 있으니 조치가 아직 안 온 행도 예산에서는 이미
// 보이고, 조치가 왔을 때 이 표를 함께 고치지 않으면 아래 계약 테스트가 빨간불이 된다.
import { PX_PER_M } from '../core/units.ts';
import { INTERACT } from '../core/constants.ts';
import { courtDefFor } from '../model/court.ts';
import type { CourtMode, CourtSize } from '../model/court.ts';
import { rotForFit } from '../render/useStageMetrics.ts';
import type { StageRot } from '../render/useStageMetrics.ts';
import { inspectorChromeWidthPx } from '../features/editor/inspectorLayout.ts';
import type { InspectorMode } from '../features/editor/inspectorLayout.ts';
import { functionBarColumnsAt, functionBarItemsFor, functionBarWidthPx } from '../features/editor/functionBarMetrics.ts';
import { trayBandHeightPx } from '../features/editor/trayMetrics.ts';

export type ChromeAxis = 'width' | 'height';

export interface ChromeRow {
  id: string;
  axis: ChromeAxis;
  label: string;
  /** 2026-08 재편 **이전** 실측값. §5.3 의 '현재' 열(1024×600 → 0.6073)이 이 값으로 나온다. */
  now: number;
  /** `narrow === false`(PC·큰 태블릿) 확정값. */
  wide: number;
  /** `narrow === true`(창 폭 < 1100) 확정값. */
  narrow: number;
  /** 이 행을 실제로 줄이는 로드맵 항목. **'미지정'은 빈칸이 아니라 발견된 구멍**이다 —
   *  2차 표에 그 조치를 할 행이 없다는 뜻이므로 지우지 말고 채워라. */
  owner: string;
}

/** 코트 래퍼(판을 감싼 상자)의 패딩. 예산 표의 '좌우 48 → 24' · '상하 40 → 16' 은 양쪽 합이라
 *  이 값의 두 배다. EditorWorkspace 가 `courtPadCss()` 문자열을 그대로 style 에 넣는다 —
 *  숫자를 저쪽에 다시 적으면 예산과 화면이 조용히 갈라진다. */
export const COURT_PAD_PX = {
  wide: { x: 24, y: 20 },
  narrow: { x: 12, y: 8 },
} as const;

export const courtPadCss = (narrow: boolean): string => {
  const p = narrow ? COURT_PAD_PX.narrow : COURT_PAD_PX.wide;
  return `${p.y}px ${p.x}px`;
};

export const CHROME_ROWS: readonly ChromeRow[] = [
  {
    id: 'appRail',
    axis: 'width',
    label: '앱 레일',
    now: 84,
    wide: 84,
    // 좁으면 통째로 없앤다. **판 위에 오버레이로 얹지 않는다** — 그러면 좌측 오버레이가
    // `edgePanBandPx=56` 띠와 겹쳐 가장자리 자동 밀기가 레일에 먹힌다(§5.2 [치명] 2번을
    // 원인째 제거). 갈 곳은 헤더 좌측 3칸 세그먼트다.
    narrow: 0,
    // AppShell 이 `useIsNarrow()` 로 갈라 좁으면 <AppRail> 을 아예 렌더하지 않는다 — 이 0 은
    // 이제 예고가 아니라 실측이다(AppShell.wiring.test.tsx 가 DOM 의 레일 폭을 이 행과 대조한다).
    owner: '3.-2 (완료) — 레일을 헤더 좌측 3칸 세그먼트(AppNavSegment)로 접는다',
  },
  {
    id: 'inspector',
    axis: 'width',
    label: '인스펙터',
    // 312 + 좌측 경계선 1. 2.2 가 이미 이 값의 유일한 출처다 — 리터럴 313 을 여기 다시
    // 적으면 핀 폭을 바꿀 때 두 곳이 갈라진다.
    now: inspectorChromeWidthPx('pinned'),
    wide: inspectorChromeWidthPx('pinned'),
    narrow: inspectorChromeWidthPx('overlay'),
    owner: '2.2 (완료) — 실제 값은 chromeRowPx 가 지금 모드에서 다시 읽는다',
  },
  {
    id: 'toolRail',
    axis: 'width',
    // ── 2026-08-14 P3: 이 행의 **뜻이 바뀌었다. 값은 한 자리도 안 바뀌었다** (설계서 §4.1·§6) ──
    // 옛 뜻: "트레이 폭". 새 뜻: **"트레이 **최소** 폭"**.
    //
    // 재설계 전 트레이는 폭이 93 으로 못박혀 있었다. 지금은 93(2열) ~ 240(5열) 구간이고,
    // 코트 칸이 자기 종횡비만큼만 쓰고 남긴 폭이 그 사이를 채운다(ToolRail 의 RAIL_STYLE).
    // 그런데도 **아래 모든 수식이 그대로 참이다**:
    //   `courtBoxPx` 가 답하는 것은 "코트가 **최대로** 쓸 수 있는 상자" 이고, 코트가 최대인
    //   순간은 정확히 **트레이가 최소인 순간**이다. 트레이가 93 을 넘어 자라는 것은 코트가
    //   자기 종횡비 때문에 못 쓰고 **남긴** 폭을 가져갈 때뿐이라, 코트의 축척(pxPerUnit)은
    //   한 눈금도 안 움직인다 — §4.6 축척표의 '변화 0.00%' 열이 그 실측이다.
    // 그래서 chromeBudget.test.ts 는 이 단계에서 **한 글자도 안 고친다.** 고칠 것은 이 주석뿐이다.
    label: '트레이(도구·개체) 최소폭',
    now: 78,
    // **넓은 창에서도 93 이다.** 트레이가 커지는 이유는 좁은 화면이 아니라 44px 미달인 손잡이라
    // (§5.4 — 이 앱 주력 조작의 손잡이가 30×39 다), 기기와 무관하게 커져야 한다. §5.3 의
    // PC 행(1055×604 · 742×604)이 이 93 으로 계산된 값이다.
    wide: 93,
    narrow: 93,
    // 실제 폭은 trayMetrics.ts 의 trayRailWidthPx(--hit 파생): 기본 44 → 93, 큰 터치 타깃 56 → 117.
    // 이 행은 기본값(44)이다 — 예산은 상한이 아니라 "설정을 안 건드린 화면"의 값이고, 56 의
    // 추가 24px 는 폭 여유(§5.4)에서 나온다. chromeBudget.test.ts 가 함수와 이 행을 대조한다.
    //
    // ── 2026-08-14 P5: **세로 배치를 알게 됐다** (P1·P2·P3 가 보고한 구멍의 수리) ──────────
    // 옛 기록(지우지 않는다): *"axis 가 'width' 로 못박혀 있는데 세로 화면에서 트레이는 판 아래
    // 띠가 되어 폭이 아니라 높이를 먹는다. 그래서 `courtBoxPx({w:480,h:800}, narrow)` 는
    // 363×668 을 답하지만 설계서 §4.7 이 같은 기기에 적은 가용 상자는 456×592 다."*
    // 이 행 자체는 여전히 axis:'width' 이고 값도 93 그대로다 — 고친 것은 `chromeRowPx` 다:
    // **세로 배치(`state.portrait`)에서 이 행은 0 을 답하고, 대신 아래 `trayBand` 행이 산다.**
    // 두 행은 서로의 반대이고 **동시에 켜지지 않는다**(트레이는 한 번에 한 축만 먹는다).
    owner: '2.4 (완료) — `--hit` 실배선 + 트레이 93/117 · 2026-08-14 P3 에서 뜻이 "최소폭" 으로',
  },
  {
    id: 'trayBand',
    axis: 'height',
    label: '세로 트레이 띠(2행)',
    // 재편 **이전** 열은 0 이다. 옛 예산표에는 세로 축이 아예 없었고(§5.3 실측표는 전부 가로
    // 기기다), 여기에 76 을 적으면 '현재' 합계 196 이 거짓이 된다 — now 는 "그때 실제로 이
    // 표가 세던 값" 이지 "그때 화면에 있던 값" 이 아니다.
    now: 0,
    // 실제 값은 trayMetrics 의 trayBandHeightPx(--hit 파생): 44 → 132, 56 → 156. 이 행도
    // toolRail·transportBar 와 같은 이유로 **기기와 무관하다**(띠가 2행인 것은 창이 좁아서가
    // 아니라 칩 줄과 도구 줄이 둘 다 있어야 하기 때문이다).
    wide: trayBandHeightPx(INTERACT.hitTargetCssPx),
    narrow: trayBandHeightPx(INTERACT.hitTargetCssPx),
    owner: '2026-08-14 기현님 재설계 — 가로 1행 띠(66/72). 옛 세로 2행(132) 경위는 trayMetrics',
  },
  {
    id: 'functionBar',
    axis: 'width',
    label: '오른쪽 기능 바(자유 전술판)',
    // 재편 **이전** 열은 0 이다 — 이 기둥은 2026-08-14 에 처음 생겼다. now 는 "그때 이 표가
    // 세던 값" 이지 "그때 화면에 있던 값" 이 아니다(trayBand 행이 간 길과 같다).
    now: 0,
    // 1열 폭(--hit + 좌우 패딩 6). 기기와 무관하다 — 칸 수(11)가 창 크기의 함수가 아니기 때문.
    // ⚠️ 2열로 흐르면 이 행이 실제보다 작아진다. 그래서 1024×600·hit 44 에서 1열이 성립하도록
    //    functionBarMetrics 의 gap·패딩을 맞춰 놓았고 boardLayout.test 가 그것을 대조한다.
    wide: functionBarWidthPx(INTERACT.hitTargetCssPx),
    narrow: functionBarWidthPx(INTERACT.hitTargetCssPx),
    owner: '2026-08-14 기현님 재설계 — 헤더 코트 전환·하단 바·속성이 한 기둥으로',
  },
  {
    id: 'courtPadX',
    axis: 'width',
    label: '코트 래퍼 좌우 패딩',
    now: COURT_PAD_PX.wide.x * 2,
    wide: COURT_PAD_PX.wide.x * 2,
    narrow: COURT_PAD_PX.narrow.x * 2,
    owner: '2.3 — 이 커밋',
  },
  {
    id: 'appHeader',
    axis: 'height',
    label: '앱 헤더',
    now: 62,
    wide: 62,
    // **없애지 않는다**(§5.2 [치명] 3번): 되돌리기 44px 와 [보드] 의미론, 라이브 리전의 유일한
    // 출처가 전부 헤더다. 대신 코트 세그먼트·주 액션을 하단 바로 옮겨 한 줄을 강제한다.
    //
    // ⚠️ 2026-08-14 — 52 → **48**(기현 지시). 안에 서는 것이 `--hit`(44) 짜리 표적이라 상하
    // 여백 2씩이 남는 전부다. 그리고 자유 전술판+넓은 창에서는 이 행이 **0** 이다(아래
    // chromeRowPx) — 좁은 창에서만 남는다. 옛 근거 중 '되돌리기 44px' 는 그 버튼이 기능 바로
    // 가면서 이미 무효인데, 지우지 않는 이유는 **좁은 창 이동 세그먼트**가 그 자리를 물려받아
    // 같은 44px 을 요구하기 때문이다 — 근거만 바뀌고 숫자는 그대로다.
    narrow: 48,
    owner: '미지정 — 2차 표에 "헤더 한 줄 강제" 행이 없다(§5.2 만 서술)',
  },
  {
    // 2026-08-18 — **은퇴한 행**(기현님: *"결과적으로 하단에는 노트 빼고 다 삭제"*).
    // TransportBar 가 폐차되며 재생 토글·배속은 왼쪽 스텝 바 하단으로 이사했다(StepSidebar
    // 의 playback prop). 행을 지우지 않는 이유: `now`(재편 이전 실측 94)가 §5.3 '현재' 열의
    // 재현 재료다 — 지우면 역사 합계(196)가 거짓이 된다. 현재값은 두 열 다 0 이다.
    id: 'transportBar',
    axis: 'height',
    label: '하단 바(트랜스포트, 2026-08-18 폐지)',
    now: 94,
    wide: 0,
    narrow: 0,
    owner: '2026-08-18 하단 철거 — 재생 컨트롤은 왼쪽 스텝 바 하단(DESIGN §6.8b)',
  },
  {
    // 2026-08-17 재설계 ② 가 낳고 2026-08-18 검수가 표에 올린 행 — 어제는 표에 없어서
    // 판 회전(useStageRot)이 사이드바 폭을 모른 채 상자를 쟀다. `now: 0` 은 "재편 이전에는
    // 존재하지 않았다" 다(역사 합계에 안 낀다).
    id: 'stepSidebar',
    axis: 'width',
    label: '왼쪽 스텝 바(드릴 편집)',
    now: 0,
    // SIDEBAR_WIDTH_PX(StepSidebar.tsx) 와 같은 값이어야 한다 — 그쪽이 바뀌면 예산 대조
    // (chromeBudget.test.ts)가 빨개진다. 소스 import 대신 리터럴을 적는 이유는 트레이 표와
    // 같다(자기 사본 문제 — 소스를 읽어 비교하면 식이 틀려도 표가 따라 움직인다).
    // 220 → 154 (2026-08-18 기현님: 썸네일 2/3) — 코트가 66px 돌려받는다.
    wide: 154,
    // 접힘(narrow·세로)이면 여는 버튼만 코트 위에 뜨므로 흐름 폭은 0 이다.
    narrow: 0,
    owner: '2026-08-17 스텝 편집 재설계 ② — 왼쪽 세로 스텝 바(DESIGN §6.8b)',
  },
  {
    id: 'notePanel',
    axis: 'height',
    label: '노트 패널(접힘 줄)',
    // 접힘 기본값 기준: 토글 줄 --hit(44) + 위 경계선 1 = 45. 펼치면 더 먹지만 예산은
    // **첫 화면(접힘)** 을 재는 표다 — 인스펙터 오버레이가 0 이던 것과 같은 규칙.
    // now: 0 — 재편 이전에는 존재하지 않았다(stepSidebar 와 같은 규칙).
    now: 0,
    wide: 45,
    narrow: 45,
    owner: '2026-08-17 스텝 편집 재설계 ⑥ — 보드 아래 접이식 노트(DESIGN §6.8b)',
  },
  {
    id: 'courtPadY',
    axis: 'height',
    label: '코트 래퍼 상하 패딩',
    now: COURT_PAD_PX.wide.y * 2,
    wide: COURT_PAD_PX.wide.y * 2,
    narrow: COURT_PAD_PX.narrow.y * 2,
    owner: '2.3 — 이 커밋',
  },
];

/** 못박은 합계. **행 합으로 계산하지 않는다** — 계산해 두면 어느 행이 슬그머니 커져도 총액이
 *  따라 움직여 예산이 예산 노릇을 못 한다. 테스트가 "행 합 === 이 상수" 를 매번 대조한다. */
/** ⚠️ 2026-08-15 (재설계 ②) — **117 → 173.** 오른쪽 기능 바(56)가 드릴 편집에도 서면서
 *  폭 크롬에 상시로 더해졌다. 작은 화면(1024×600·800×480)의 코트는 **한 눈금도 안 작아진다** —
 *  거기서는 세로가 제약이라 폭에 여유가 있었기 때문이다(§5.3 표의 그 두 행이 그대로인 이유). */
export const CHROME_WIDTH_NARROW_PX = 173;
/** ⚠️ 2026-08-18 (하단 철거) — **128 → 109.** 하단 바 64 가 사라지고 노트 패널 접힘 줄 45 가
 *  들어왔다(−64 + 45 = −19). 좁은 화면의 코트가 세로로 19px 더 커진다. */
export const CHROME_HEIGHT_NARROW_PX = 109;
/** 재편 이전 합계. §5.3 의 '현재' 열이 이 값에서 나온다(1024×600 → 0.6073). */
export const CHROME_WIDTH_NOW_PX = 523;
export const CHROME_HEIGHT_NOW_PX = 196;

/** 노치·홈 인디케이터가 먹는 여백(§5.2 [A-12] 정정).
 *
 *  `#root` 가 `env(safe-area-inset-*)` 를 패딩으로 먹으므로(appShell.css) 이 여백은 어느 상자도
 *  나눠 갖지 않고 **크롬 예산에 그대로 더해진다.** 원안 표에 이 항이 빠져 있어서, 노치 기기
 *  가로에서는 좌우 88px 이 예산 밖에서 사라지고 있었다. */
export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const SAFE_AREA_NONE: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 };
/** iPad standalone 하단 홈 인디케이터(약 20px). 세로·가로 모두 아래쪽에만 붙는다. */
export const SAFE_AREA_HOME_INDICATOR: SafeAreaInsets = { top: 0, right: 0, bottom: 20, left: 0 };
/** 노치 기기를 **가로로** 눕혔을 때. 좌우 각 44 + 하단 인디케이터 21. 폭 예산이 88 줄어든다. */
export const SAFE_AREA_NOTCH_LANDSCAPE: SafeAreaInsets = { top: 0, right: 44, bottom: 21, left: 44 };

export interface ChromeState {
  /** `useIsNarrow()` — 창 폭 < 1100. */
  narrow: boolean;
  /** 인스펙터가 지금 **가로 흐름에서** 폭을 먹는가(2.2 inspectorLayout). 오버레이·닫힘은 0 이다. */
  inspector: InspectorMode;
  /** 트레이가 판 **오른쪽 기둥**이 아니라 **아래 띠**인가.
   *
   *  ⚠️ 2026-08-14 기현님 재설계로 **이름이 `portrait` 에서 바뀌었다.** 뜻은 P5 때부터 줄곧
   *  "트레이가 띠인가" 였는데, 그때는 그것이 창 세로 여부와 같은 말이라 그 이름을 썼다.
   *  이제 트레이는 **코트 긴 변**에 붙으므로 둘이 정반대가 된다 — 창이 가로면 코트가 눕고
   *  (긴 변이 아래) 띠가 되며, 창이 세로면 코트가 서고(긴 변이 오른쪽) 기둥이 된다.
   *  `portrait` 라는 이름을 그대로 두면 이 행은 매번 반대값을 받는 셈이라 표가 거짓말을 한다.
   *
   *  ⚠️ **분기 boolean 을 늘리는 것이 아니다**(§5.1 은 `useIsPortrait`·`useIsNarrow` 둘로
   *  못박혀 있다) — 그 둘 중 하나에서 **유도된 값**이다. */
  trayBand?: boolean;
  /** 자유 전술판인가. 전술판은 하단 바가 없고(전부 기능 바로 갔다) 대신 오른쪽 기능 바가 있다 —
   *  두 행은 서로의 반대이고 **동시에 켜지지 않는다**(2026-08-14 재설계). 드릴 편집은 아직
   *  옛 배치라 false 다. */
  board?: boolean;
  /** 없으면 0. 실기(§5.3 확정 배율)는 안드로이드 태블릿 기준 상한이라 safe-area 가 0 이다. */
  safeArea?: SafeAreaInsets;
}

/** 한 행이 **지금** 먹는 값. 세 행만 narrow 가 아니라 다른 것이 정한다:
 *   · `inspector` — 자기 모드. 같은 PC 에서도 핀이면 313, 오버레이면 0 이다.
 *   · `toolRail`·`trayBand` — **배치 축**. 트레이는 한 번에 한 축만 먹으므로 둘은 서로의
 *     반대이고 절대 동시에 켜지지 않는다. 이 배타성이 깨지면 세로 기기에서 트레이가 폭과
 *     높이를 이중으로 빼앗아 코트 상자가 실제보다 작게 계산된다.
 *   · `stepSidebar`·`notePanel` — **화면**(드릴 편집 전용). 전술판은 0 이다. 옛 `functionBar
 *     ↔ transportBar` 배타는 2026-08-15(기능 바 상시) · 2026-08-18(하단 바 폐지)로 끝났다 —
 *     기능 바는 두 화면 다 서고, 하단 바 행은 은퇴(wide/narrow 0)했다. */
export function chromeRowPx(row: ChromeRow, state: ChromeState): number {
  if (row.id === 'inspector') return inspectorChromeWidthPx(state.inspector);
  const here = state.narrow ? row.narrow : row.wide;
  if (row.id === 'toolRail') return state.trayBand ? 0 : here;
  if (row.id === 'trayBand') return state.trayBand ? here : 0;
  // ⚠️ 2026-08-15 — **둘은 더 이상 서로의 반대가 아니다**(드릴 편집 재설계 ②). 기능 바는
  //    이제 두 화면 다 선다. 하단 바(트랜스포트)만 드릴 편집에 남는다 — 스텝은 시간축이고
  //    시간축은 가로가 자연스럽기 때문이다(전술판은 1장짜리라 그 바가 아예 없다).
  if (row.id === 'functionBar') return here;
  // 2026-08-18 — 하단 바 행의 후계 둘(은퇴한 transportBar 행 자체는 wide/narrow 0 이라 분기가
  // 필요 없다). 스텝 바는 드릴 편집 전용이고, **고정(비접힘)일 때만** 흐름 폭을 먹는다:
  // 접힘 조건이 화면의 `narrow || portrait` 인데 portrait = !trayBand(EditorWorkspace 의
  // trayAxis 유도 — 분기 boolean 을 늘리지 않는 §5.1 규칙 그대로)라 여기서는 trayBand 로
  // 읽는다. 노트 패널은 드릴 편집이면 항상 접힘 줄 하나를 깐다.
  if (row.id === 'stepSidebar') return state.board || state.narrow || !state.trayBand ? 0 : here;
  if (row.id === 'notePanel') return state.board ? 0 : here;
  // ★ 판 화면은 **넓은 창에서 헤더가 없다**(AppShell 의 showHeader).
  //   좁은 창에서는 남는다: 84px 레일이 빠진 자리를 헤더의 3칸 세그먼트가 대신하므로,
  //   지우면 화면을 옮길 방법이 없어진다. 이 한 줄이 그 규칙의 예산판이다.
  //
  //   ⚠️ 2026-08-15 (재설계 ②) — `state.board` 조건이 **빠졌다.** 2026-08-14 에는 전술판만
  //   헤더를 걷었고 드릴 편집은 제목·[저장]·[시연] 때문에 남겼는데, 그 셋이 각각 인스펙터·
  //   기능 바·트랜스포트로 가면서 남길 이유가 없어졌다. 그리고 이것은 미관이 아니라 코트
  //   크기의 문제였다 — 헤더 48 이 남으면 기둥이 2열로 흘러 폭에서 44 를 더 먹는다(AppShell).
  if (row.id === 'appHeader') return state.narrow ? here : 0;
  return here;
}

const sumAxis = (axis: ChromeAxis, state: ChromeState): number =>
  CHROME_ROWS.filter((r) => r.axis === axis).reduce((sum, r) => sum + chromeRowPx(r, state), 0);

export function chromeWidthPx(state: ChromeState): number {
  const sa = state.safeArea ?? SAFE_AREA_NONE;
  return sumAxis('width', state) + sa.left + sa.right;
}

export function chromeHeightPx(state: ChromeState): number {
  const sa = state.safeArea ?? SAFE_AREA_NONE;
  return sumAxis('height', state) + sa.top + sa.bottom;
}

export interface Size {
  w: number;
  h: number;
}

/** 창에서 크롬을 뺀 **코트 상자**. §5.3 표의 '상자' 열이 이 함수다. */
export function courtBoxPx(viewport: Size, state: ChromeState): Size {
  return {
    w: Math.max(0, viewport.w - chromeWidthPx(state) - functionBarExtraColsPx(viewport, state)),
    h: Math.max(0, viewport.h - chromeHeightPx(state)),
  };
}

/** 기능 바가 **둘째 열로 흐르면** 그만큼 폭을 더 먹는다. 행 표는 1열만 세므로 그 차이를
 *  여기서 더한다 — 열 수는 창 **높이**의 함수라 행 표(폭 축)로는 표현할 수 없기 때문이다.
 *
 *  ⚠️ 왜 근사하지 않는가: 2열이면 44px(hit 44)이고, 800×480 의 코트 상자 폭이 약 660 이다.
 *  6.7% 를 안 세면 `rotForFit` 의 1.08 문턱을 넘나드는 구간에서 **판이 눕느냐 서느냐가 갈린다.**
 *  예산이 화면과 다른 답을 내는 순간 그 화면은 재현이 안 된다(P1 이 끊은 그 부류의 사고다). */
function functionBarExtraColsPx(viewport: Size, state: ChromeState): number {
  const sa = state.safeArea ?? SAFE_AREA_NONE;
  // 바는 `<main>` 의 직계라 헤더 아래 전부를 쓴다. 하단 바는 코트 컬럼 **안**이라 안 뺀다.
  const avail = viewport.h - chromeRowPx(CHROME_ROWS.find((r) => r.id === 'appHeader')!, state) - sa.top - sa.bottom;
  const hit = INTERACT.hitTargetCssPx;
  return (functionBarColumnsAt(hit, avail, functionBarItemsFor(state.board ?? false)) - 1) * hit;
}

export interface CourtScale {
  rot: StageRot;
  /** 화면 px / 월드 단위. `preserveAspectRatio="xMidYMid meet"` 의 축척 그 자체다. */
  pxPerUnit: number;
  /** 화면 px / 1 m. §5.3 표의 '1 m' 열. */
  pxPerMeter: number;
}

/** 그 상자에 코트가 얼마나 크게 들어가는가.
 *
 *  [A-13] **코트 종류를 받는다.** 원안 실측표는 `min(boxW/825, boxH/525)` 로 풀 코트만 계산했는데
 *  half/flat 은 525×450 이라 종횡비가 다르다 — 같은 상자에서 축척이 달라지고, 회전 판정
 *  (`rotForFit`)도 달라진다. 하프는 '마무리·세트피스 훈련'용으로 지정돼 있어 드문 경우가 아니다.
 *
 *  회전을 `rotForFit` 에서 **빌려 온다.** 여기에 "세로로 길면 돌린다" 를 다시 적으면 화면은
 *  ROTATE_GAIN 1.08 로 돌고 예산표는 안 도는 순간이 생겨, 표가 화면과 다른 숫자를 말하게 된다. */
export function courtScale(mode: CourtMode, box: Size, size?: CourtSize): CourtScale {
  const def = courtDefFor(mode, size);
  const rot = rotForFit({ width: box.w, height: box.h }, { x: 0, y: 0, w: def.vbW, h: def.vbH });
  // 'meet' 역산. computeMetrics 와 같은 식이되 그쪽은 DOMRect 를 받으므로(실측 전용) 여기서
  // 다시 쓴다 — 두 식이 같다는 것은 chromeBudget.test.ts 가 computeMetrics 와 대조해 지킨다.
  const boxW = rot === 90 ? def.vbH : def.vbW;
  const boxH = rot === 90 ? def.vbW : def.vbH;
  const pxPerUnit = Math.min(box.w / boxW, box.h / boxH);
  return { rot, pxPerUnit, pxPerMeter: pxPerUnit * PX_PER_M };
}
