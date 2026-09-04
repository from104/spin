// 「작은 기기」 판정 한 곳 — 폰·7인치 미만 태블릿에서 안내 한 장을 띄우기 위한 것이고,
// 기능을 막는 데는 쓰지 않는다(PLAN-0-6-3-LOADER-NOTICE §0: 막지 않고, 알리고, 끌 수 있다).
//
// 계획서 결정 22 가 못박은 판정식은 **짧은 변 < 600 AND 포인터가 coarse** 이고, 네 조각 전부
// 근거가 있다.
//
//  ① 창이 아니라 **기기 화면**(`window.screen`)이다. `useIsNarrow`(창 폭 1100)는 데스크톱 창을
//     좁게 끈 것과 폰을 못 가른다 — 그쪽은 "지금 크롬을 얼마나 걷을까" 를 답하는 물음이고,
//     여기는 "이 사람이 든 물건이 무엇인가" 를 답하는 물음이라 재료가 다르다.
//  ② 짧은 변만 본다. 기기를 돌렸다고 판정이 뒤집히면 같은 기기가 세로에서는 작고 가로에서는
//     크다고 말하게 된다.
//  ③ 문턱 600 은 안드로이드 sw600dp 와 같은 자리다. 7인치 태블릿이 600×960 이므로 "7인치 미만"
//     이 정확히 `< 600` 으로 떨어진다(600 은 경계이자 7인치이므로 작은 기기가 **아니다**).
//  ④ ⚠️ `coarse` AND 의 진짜 이유는 **확대 차단**이다. 브라우저를 200~300% 확대하면
//     `screen.width` 가 CSS px 로 줄어 1280 데스크톱이 427 로 보고된다. 그 저시력 사용자에게
//     "작은 기기입니다" 를 띄우면 접근성 기능이 접근성 사용자를 때리는 꼴이 된다.
//     `navigator.maxTouchPoints > 0` 은 터치 노트북을 못 걸러 여기 쓰지 않는다.
//
// 판정식(`isSmallDevice`)과 값 읽기(`readDeviceMetrics`)를 가르는 이유: 판정식이 순수 함수라야
// window 스텁 없이 표본으로 검증된다(`smallScreen.test.ts`). 전역 `matchMedia` 스텁은 이 저장소
// 20여 파일의 판정을 한꺼번에 흔들어 깔지 않는 것이 규율이다(계획서 §7).
//
// 판정은 호출부에서 **마운트 1회**만 한다(결정 23) — 기기 등급은 세션 중에 안 바뀌고, 판정을
// 하나 더 늘리면 "이 기기에서 왜 이렇게 보이나" 를 아무도 재현 못 한다(`useIsNarrow.ts` 머리말의
// 그 경고와 같은 이유). 그래서 여기에는 resize·matchMedia 구독이 없다.

/** 이 값 **미만**인 짧은 변이 작은 화면이다. 600 = 안드로이드 sw600dp = 7인치(600×960)의 짧은 변. */
export const SMALL_SCREEN_MIN_PX = 600;

/** 판정에 들어가는 재료 전부. 순수 함수의 입력이라 테스트가 표본을 직접 만든다. */
export interface DeviceMetrics {
  /** 기기 화면 폭(CSS px). `window.screen.width`. */
  width: number;
  /** 기기 화면 높이(CSS px). `window.screen.height`. */
  height: number;
  /** `matchMedia('(pointer: coarse)').matches` — 주 포인터가 손가락인가. */
  coarse: boolean;
}

/** 결정 22 의 판정식 그 자체. 짧은 변만 보므로 가로·세로에서 같은 답이 나온다. */
export function isSmallDevice(m: DeviceMetrics): boolean {
  return Math.min(m.width, m.height) < SMALL_SCREEN_MIN_PX && m.coarse;
}

/** 지금 이 브라우저의 재료를 읽는다. window 가 없으면(SSR·프리렌더) 작은 기기가 아니라고 본다
 *  — 안내는 사람이 든 기기에 대고 하는 말이라 서버에서 판정할 것이 없다. */
export function readDeviceMetrics(): DeviceMetrics {
  if (typeof window === 'undefined') return { width: Number.POSITIVE_INFINITY, height: Number.POSITIVE_INFINITY, coarse: false };
  const screen = window.screen;
  return {
    width: screen?.width ?? Number.POSITIVE_INFINITY,
    height: screen?.height ?? Number.POSITIVE_INFINITY,
    // matchMedia 가 없는 환경(구형 웹뷰·jsdom 기본)은 coarse 를 모른다 → false 로 떨어져 안내가
    // 안 뜬다. 모르는 채로 띄우는 쪽이 아니라 안 띄우는 쪽으로 기운다(막지 않는 안내이므로).
    coarse: typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches,
  };
}
