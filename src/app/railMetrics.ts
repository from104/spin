// PLAN-UI-SCALE 결정 3(2026-09-19 재정의) — 좌측 레일이 **찌그러지지 않고** 서려면 세로로 몇 px 이
// 필요한가. 「자동」이 이 수를 읽어 «레일이 스크롤되지 않는 가장 큰 배율» 을 고른다.
//
// 왜 모듈로 빼는가: 이 값들은 AppRail.tsx 의 인라인 style 에 흩어져 있었고, 흩어진 채로는
// **"다 합쳐서 얼마인가"** 를 아무도 답할 수 없다 — `chromeBudget.ts` 가 같은 이유로 태어났다.
// 이제 답이 필요해졌다: 자동 배율이 그 합에 걸려 있다.
//
// ⚠️ **AppRail.tsx 가 이 상수들을 실제로 쓴다.** 저쪽에 리터럴을 다시 적으면 화면과 이 식이
//    조용히 갈라지고, 그때 틀리는 것은 «자동이 고른 배율» 이라 아무도 눈치채지 못한다.
//    `railMetrics.test.ts` 가 소스를 읽어 그 결합을 못박는다.
import { RAIL_ITEMS } from './screens.ts';

/** 레일 고정 폭. 크롬 예산의 `appRail` 행과 같은 수다(그쪽이 소비자, 여기가 정의). */
export const RAIL_W = 84;

/** 위/아래 안쪽 여백(`padding: 1rem 0 0.875rem`). */
export const RAIL_PAD_TOP = 16;
export const RAIL_PAD_BOTTOM = 14;
/** 세로 flex 의 `gap: 0.3125rem`. */
export const RAIL_GAP = 5;

/** 앱 마크(원형 SVG) — 42px + 아래 여백 0.375rem. */
export const RAIL_LOGO_H = 42;
export const RAIL_LOGO_MB = 6;
/** 'SPIN' 워드마크. 글꼴 0.6875rem 의 실측 줄높이 14 + 아래 여백 0.875rem.
 *  ⚠️ 글자라 정확한 폰트 메트릭에 달려 있다 — 14 는 에뮬레이터 실측(2026-09-19)이고, 이 한 줄만
 *  근사다. 자동 배율은 계단식이라 몇 px 의 오차가 답을 바꾸지 않는다(문턱 사이 간격이 100px 이상). */
export const RAIL_WORDMARK_H = 14;
export const RAIL_WORDMARK_MB = 14;

/** 이동 칸 하나(`width: 64; height: 58`). */
export const RAIL_ITEM_H = 58;

/** 하단 묶음의 아이콘 버튼(언어·도움말·테마, 그리고 웹에서만 서는 [데스크톱 앱 받기]). */
export const RAIL_ICON_BTN_H = 44;
/** 항상 서는 아이콘 버튼 수 — 언어·도움말·테마. */
export const RAIL_ICON_BTNS = 3;

/** 버전 버튼: 글꼴 0.625rem 의 실측 줄높이 13 + 위 여백 8. 워드마크와 같은 근사다. */
export const RAIL_VERSION_H = 13;
export const RAIL_VERSION_MT = 8;

/** 레일이 **찌그러지지 않고** 담기려면 필요한 세로 px.
 *
 *  `downloadBtn` 은 웹 배포본에서만 서므로(네이티브 셸에서는 자기 자신을 받으라는 말이 된다)
 *  기본은 없는 쪽이다 — 자동이 웹에서 한 칸 낙관적이 되지 않도록 호출부가 넘길 수 있게 뒀다.
 *
 *  ⚠️ 이 값이 뜻을 가지려면 레일의 자식들이 **`flexShrink: 0`** 이어야 한다. 2026-09-19 이전에는
 *  그것이 없어서, 레일은 넘치기 전에 **먼저 찌그러졌다** — 200% 에서 44px 표적이 20px 로 눌렸다
 *  (에뮬레이터 실측). 스크롤 대신 축소가 일어나면 «최대 크기이면서 스크롤 안 됨» 이라는 자동의
 *  기준 자체가 성립하지 않는다. */
export function railContentHeightPx(opts?: { downloadBtn?: boolean }): number {
  const iconBtns = RAIL_ICON_BTNS + (opts?.downloadBtn ? 1 : 0);
  const children = 2 + RAIL_ITEMS.length + iconBtns + 1; // 마크 · 워드마크 · 이동칸 · 아이콘 · 버전
  return (
    RAIL_PAD_TOP +
    RAIL_PAD_BOTTOM +
    RAIL_LOGO_H +
    RAIL_LOGO_MB +
    RAIL_WORDMARK_H +
    RAIL_WORDMARK_MB +
    RAIL_ITEMS.length * RAIL_ITEM_H +
    iconBtns * RAIL_ICON_BTN_H +
    RAIL_VERSION_H +
    RAIL_VERSION_MT +
    (children - 1) * RAIL_GAP
  );
}
