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
import { COURT_DEFS } from '../model/court.ts';
import type { CourtMode } from '../model/court.ts';
import { rotForFit } from '../render/useStageMetrics.ts';
import type { StageRot } from '../render/useStageMetrics.ts';
import { inspectorChromeWidthPx } from '../features/editor/inspectorLayout.ts';
import type { InspectorMode } from '../features/editor/inspectorLayout.ts';

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
    owner: '미지정 — 2차 표에 "레일을 헤더로 접는다" 행이 없다(§5.2 만 서술)',
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
    label: '트레이(도구·개체)',
    now: 78,
    // **넓은 창에서도 93 이다.** 트레이가 커지는 이유는 좁은 화면이 아니라 44px 미달인 손잡이라
    // (§5.4 — 이 앱 주력 조작의 손잡이가 30×39 다), 기기와 무관하게 커져야 한다. §5.3 의
    // PC 행(1055×604 · 742×604)이 이 93 으로 계산된 값이다.
    wide: 93,
    narrow: 93,
    owner: '2.4 — `--hit` 실배선 + 트레이 93/117',
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
    narrow: 52,
    owner: '미지정 — 2차 표에 "헤더 한 줄 강제" 행이 없다(§5.2 만 서술)',
  },
  {
    id: 'transportBar',
    axis: 'height',
    label: '하단 바(트랜스포트)',
    // ≈94 는 실측이다(재생 48 + 라벨줄 + 패딩 12/15 + border 1). 전술판의 BoardBar 는 라벨줄이
    // 없어 더 짧으므로 예산은 **더 큰 쪽**으로 잡는다 — 예산은 상한이라야 쓸모가 있다.
    now: 94,
    wide: 94,
    // 라벨줄을 스텝 칩 안으로 흡수. 재생 48 + 패딩 7/8 + border 1 = 64.
    narrow: 64,
    owner: '2.10 — 스텝 사진 뭉치 스크러버(TransportBar 높이 ≤64)',
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
export const CHROME_WIDTH_NARROW_PX = 117;
export const CHROME_HEIGHT_NARROW_PX = 132;
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
  /** 없으면 0. 실기(§5.3 확정 배율)는 안드로이드 태블릿 기준 상한이라 safe-area 가 0 이다. */
  safeArea?: SafeAreaInsets;
}

/** 한 행이 **지금** 먹는 값. 인스펙터만 narrow 가 아니라 자기 모드가 정한다 — 같은 PC 에서도
 *  핀이면 313, 오버레이면 0 이라 boolean 두 개로는 답이 안 나오는 유일한 행이다. */
export function chromeRowPx(row: ChromeRow, state: ChromeState): number {
  if (row.id === 'inspector') return inspectorChromeWidthPx(state.inspector);
  return state.narrow ? row.narrow : row.wide;
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
    w: Math.max(0, viewport.w - chromeWidthPx(state)),
    h: Math.max(0, viewport.h - chromeHeightPx(state)),
  };
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
export function courtScale(mode: CourtMode, box: Size): CourtScale {
  const def = COURT_DEFS[mode];
  const rot = rotForFit({ width: box.w, height: box.h }, { x: 0, y: 0, w: def.vbW, h: def.vbH });
  // 'meet' 역산. computeMetrics 와 같은 식이되 그쪽은 DOMRect 를 받으므로(실측 전용) 여기서
  // 다시 쓴다 — 두 식이 같다는 것은 chromeBudget.test.ts 가 computeMetrics 와 대조해 지킨다.
  const boxW = rot === 90 ? def.vbH : def.vbW;
  const boxH = rot === 90 ? def.vbW : def.vbH;
  const pxPerUnit = Math.min(box.w / boxW, box.h / boxH);
  return { rot, pxPerUnit, pxPerMeter: pxPerUnit * PX_PER_M };
}
