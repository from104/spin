// 「이 앱이 어느 껍데기 안에서 도는가」 — 네이티브 셸 판정의 **정본 한 벌**.
// 정본 지위는 docs/PLAN-ANDROID.md §1 결정 4. (AGENTS §3 — 두 벌 두지 않는다.)
//
// ── 왜 중립 모듈이 필요한가 ─────────────────────────────────────────────────────────
// 2026-09-16 까지 판정은 `storage/files.ts` 에 살았고, 거기 있던 이유는 "저장 경로가 구글 로그인
// 모듈(`sync/authDesktop.ts`)에 매이면 안 된다" 였다. 그 이유는 **셸이 하나일 때만** 참이다 —
// 셸이 둘(Tauri·Capacitor)이 되는 순간 판정을 물어야 하는 곳이 저장·다운로드·업데이트·로그인·
// 공유·시연으로 흩어지고, 어느 한 기능 모듈에 얹어 두면 나머지 전부가 그 모듈을 import 하게
// 된다. 아무에게도 안 딸린 모듈을 하나 만들면 그 문제가 사라진다. **옛 이유를 지우지 않고
// 여기 적어 둔다** — 뒤집은 근거를 남기는 규율(AGENTS §2).
//
// ⚠️ 판정 함수를 다른 파일에 **다시 적지 않는다.** 2026-09-16 에 `isTauriWebview` 를 export 로
//    돌린 것도 같은 이유였다: *"판정은 여기 하나다"* — 한 벌 더 적으면 언젠가 한쪽만 고쳐지고,
//    그때 깨지는 것은 "데스크톱에서만 저장이 안 된다" 처럼 실기에서야 보이는 종류다.

/** 데스크톱 앱(Tauri 웹뷰) 안에서 도는가. 웹 배포본에서는 언제나 false.
 *
 *  `__TAURI_INTERNALS__` 는 Tauri 가 웹뷰를 띄우며 심는 전역이다. 플러그인 API 를 부르는 것과
 *  달리 이 검사는 동기이고 import 를 요구하지 않아, 웹 번들이 `@tauri-apps/*` 를 끌고 들어가지
 *  않는다. */
export function isTauriWebview(): boolean {
  return typeof globalThis !== 'undefined' && '__TAURI_INTERNALS__' in globalThis;
}

/** 안드로이드 앱(Capacitor 네이티브 웹뷰) 안에서 도는가.
 *
 *  ⚠️ **`@capacitor/core` 를 import 하지 않는다.** 그 패키지를 정적으로 부르면 순수 웹 번들에도
 *  Capacitor 런타임이 통째로 실린다 — 웹에서는 한 줄도 안 쓰이는 코드다. 대신 네이티브 브리지가
 *  웹뷰에 심어 두는 전역 `Capacitor` 를 직접 본다. `isNativePlatform` 이 있는지까지 확인하는
 *  이유는, 웹에서 Capacitor 를 로드한 경우에도(예: 나중에 누가 플러그인을 정적 import 하면)
 *  전역은 생기지만 그 값은 false 여야 하고, 아주 옛 판에서는 함수 자체가 없기 때문이다.
 *
 *  판정이 참인 자리는 안드로이드뿐이다 — iOS 는 짓지 않는다(ROADMAP §0.7). */
export function isCapacitorNative(): boolean {
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return cap?.isNativePlatform?.() === true;
}

/** 지금 도는 네이티브 셸. 웹 브라우저(배포본·개발 서버)에서는 `null`.
 *
 *  분기하는 쪽이 `if (isTauriWebview()) … else if (isCapacitorNative()) …` 를 손으로 엮지 않게
 *  한 값으로 접어 준다. 순서(Tauri 먼저)에는 뜻이 없다 — 두 전역이 같은 웹뷰에 함께 있을 수
 *  없다. 값이 늘면(iOS 등) 여기만 넓힌다. */
export type NativeShell = 'tauri' | 'android';

export function nativeShell(): NativeShell | null {
  if (isTauriWebview()) return 'tauri';
  if (isCapacitorNative()) return 'android';
  return null;
}

/** CSS px 한 개가 1인치에 몇 개 들어가는가 — 「UI 크기: 자동」의 유일한 입력
 *  (PLAN-UI-SCALE 결정 3). 순수 산술은 `core/uiScale.ts` 가 하고, **감지는 여기 하나다.**
 *
 *  웹은 실제 ppi 를 알려주지 않으므로 플랫폼 규약을 쓴다:
 *  · 안드로이드 — 1 CSS px = 1 dp, dp 의 정의가 **1/160 in**. 밀도가 얼마든 이 관계는 같다.
 *    그래서 «dpi 가 낮아져도» 자동의 답이 흔들리지 않는다(기현님 지시문의 그 걱정이 여기서 풀린다).
 *  · 그 밖(데스크톱·웹) — CSS 규격의 기준 해상도 **1/96 in**.
 *
 *  UA 를 보는 이유: 안드로이드 **브라우저**로 연 웹 배포본도 dp 를 쓰므로 160 이 맞다. 네이티브
 *  판정만으로는 그 경우를 96 으로 잘못 본다. UA 스니핑을 꺼리는 것이 관례지만, 여기서 묻는 것이
 *  «어느 OS 가 CSS px 의 물리 크기를 정하는가» 라는 **바로 그 질문**이라 대체 수단이 없다
 *  (`devicePixelRatio` 는 배율만 알려줄 뿐 물리 크기를 모른다).
 *
 *  ⚠️ 근사다. dp 는 실측 ppi 가 아니라 버킷이고, 데스크톱의 96 은 OS 배율에 따라 흔들린다.
 *  그래서 자동이 고른 값을 설정 화면에 **보여 준다** — 숨은 자동은 재현할 수 없는 자동이다. */
export function cssPxPerInch(): number {
  if (isCapacitorNative()) return 160;
  if (typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)) return 160;
  return 96;
}
