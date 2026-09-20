// 화면 로더의 시계 — 최소 표시 시간·사이클 길이·등장/퇴장 길이·마크 크기의 단일 출처
// (PLAN-0-6-3-LOADER-NOTICE 결정 4·8·19·21, §5 타임라인).
//
// 왜 한 파일인가: 같은 숫자가 CSS(사이클)와 TS(최소 표시 시간)로 갈리면 "로더가 반 바퀴에서
// 끊긴다" 같은 어긋남이 생기고, 고칠 때 두 곳을 찾아야 한다. 사이클 값은 여기서 나와
// `animation-duration` 인라인 스타일로 내려간다(키프레임 백분율이 정본, 길이만 변주 — 결정 21).
//
// ⚠️ 이 파일의 숫자를 다른 곳에서 다시 적지 마라. 테스트도 값을 대조하지 말고 **시계를 그만큼
// 돌리는 데만** 쓴다(§7).
//
// 결정 4 — 레일 전환 1000ms 는 **미정값**이다. lazy 가 없어 전환 로더가 덮는 실제 작업은 0 이고,
// 레일 왕복은 세션당 수십 번이라 순수 인위적 지연이다. 실기에서 1000/600/0 을 비교해 확정한다
// (§4-7). 지시대로 1000 으로 배송하되 "확정값" 으로 읽히지 않게 여기 박아 둔다.
//
// 결정 14 — React 안의 로더는 번들이 이미 파싱된 뒤 뜨므로 **부팅 1500ms 는 전부 인위적
// 시간이다.** 나중에 값을 낮출 근거가 이 한 줄이다.

/** 로더의 두 변주. 덮는 대상이 다르다: 부팅은 첫 마운트, 레일은 큰 메뉴 간 전환. */
export type AppLoaderKind = 'boot' | 'rail';

/** 최소 표시 시간(ms). 이 시간이 지나기 전에는 로더가 안 걷힌다 — 단 아무 입력이 들어오면
 *  즉시 걷힌다(결정 5). 레일 값은 미정(결정 4). */
export const APP_LOADER_MS: Record<AppLoaderKind, number> = { boot: 1500, rail: 1000 };

/** 회전 한 사이클(ms). 백분율 키프레임은 하나이고 이 값만 갈린다(결정 21).
 *  부팅 1200 에서 접촉이 790ms(65.83%), 전환 820 에서 같은 백분율이 540ms 에 온다. */
export const CYCLE_MS: Record<AppLoaderKind, number> = { boot: 1200, rail: 820 };

// ── ⚠️ 2026-09-04: `ENTER_MS`(등장 transition, boot 220 / rail 140)는 은퇴했다 ──────────
// 옛 근거(지우지 않는다): *"등장·퇴장이 keyframes 가 아니라 transition 인 이유는 결정 16 —
// 퇴장 중에 다음 전환이 들어오면 현재 opacity 값에서 되조준해야 하는데 keyframes 는 그 중단을
// 못 한다."* 그 전제가 **등장에서만** 죽었다: 이 판은 물러난 화면이 아니라 새 화면 위에 얹히는
// 덮개라, 등장 페이드 구간이 곧 덮으려던 내용이 비치는 구간이다(헤드리스 실측). 등장은 이제
// 길이 0 이고 상수가 필요 없다 — 값을 남겨 두면 아무도 안 읽는 숫자가 정본 표에 남는다.
// 되살릴 일이 생기면(예: 로더가 실제 대기를 덮게 되어 부드럽게 들어와도 되는 날) 이 두 값이
// 출발점이다. 퇴장은 그대로 `EXIT_MS` 가 진다.

/** 퇴장 transition(ms). 퇴장은 밀려나는 게 아니라 다가와서 녹는다(scale 1 → 1.06 + opacity 0)
 *  — 로더가 물러나는 것이 아니라 앱이 열리는 것으로 읽힌다(§5). */
export const EXIT_MS: Record<AppLoaderKind, number> = { boot: 200, rail: 160 };

// ── 부트 진정(2026-09-15) — 회전은 **메인 스레드가 조용해진 뒤에** 시작한다 ────────────────
//
// 기현님 실기: *"첫 로딩 애니가 툭툭 끊긴다"*. 데스크톱과 같은 엔진(WebKitGTK 4.1)에 재 보니
// 첫 마운트 직후가 이렇다: React 가 트리를 그리는 데는 19ms 뿐이고, 그 뒤 커밋·이펙트·첫
// 레이아웃/페인트가 **400ms 넘게** 메인 스레드를 잡는다(부팅 화면이 board = EditorWorkspace 라
// 가장 무거운 마운트가 첫 화면이다). SVG 변환 애니메이션은 합성 스레드로 안 내려가므로 그
// 구간에서 마크는 **선다** — 무엇을 어떻게 그리든.
//
// 그래서 그 구간에는 **아예 안 돌린다.** 정지 자세(사이클 0% = logo.svg)로 서 있다가, 프레임이
// 실제로 제때 오기 시작하면 그때 0% 부터 돈다. 사람 눈에는 "늦게 시작한 매끄러운 회전" 이고,
// 예전에는 "일찍 시작한 끊기는 회전" 이었다.
//
// ⚠️ 프레임 간격 기준이 33ms 보다 **넉넉해야** 한다 — 이 웹뷰의 rAF 주기 자체가 30Hz 라
// (사각형 하나뿐인 빈 페이지도 중앙값 32ms) 16.7ms 를 기준으로 삼으면 영영 안 진정된다.
/** 이 시간(ms) 안에 온 프레임은 «제때 왔다» 로 친다. */
export const BOOT_SETTLE_FRAME_MS = 50;
/** 연속으로 몇 번 제때 와야 진정으로 보는가. 한 번이면 긴 작업 사이의 우연한 짧은 틈에 속는다. */
export const BOOT_SETTLE_FRAMES = 3;
/** 그래도 안 진정되면 여기서 포기하고 돌린다(ms, 마운트 기준). 부팅 로더가 1500ms 이므로
 *  최악에도 회전이 300ms 는 보인다. 느린 기기에서 영영 정지 마크만 보는 일을 막는 상한이다. */
export const BOOT_SETTLE_CAP_MS = 1200;

/** 마크 크기 = `clamp(min, vmin%, max)`(§5). CSS 문자열이 아니라 수로 두는 이유:
 *  `SpinLoaderMark` 의 계약이 `sizePx: number` 라(§2) 크기 계산이 한 곳에 있어야 한다. */
export const MARK_SIZE = {
  boot: { minPx: 96, vmin: 20, maxPx: 144 },
  rail: { minPx: 72, vmin: 16, maxPx: 112 },
} as const;

/** `clamp()` 와 같은 뜻: `max(min, min(vmin 값, max))`. `viewportMinPx` 는 vmin 의 원단위
 *  (창의 짧은 변). 순수 함수라 창을 스텁하지 않고도 값을 잴 수 있다. */
export function markSizePx(kind: AppLoaderKind, viewportMinPx: number): number {
  const s = MARK_SIZE[kind];
  return Math.round(Math.min(Math.max(s.minPx, (s.vmin / 100) * viewportMinPx), s.maxPx));
}

/** 최소 표시 시간의 실효값. **0 이면 로더는 한 프레임도 존재하지 않는다**(결정 8, §0 원칙).
 *
 *  0 이 되는 두 경우:
 *  1. 감축 모션 — 지시 그대로다. 덮을 실제 로딩이 0 이므로 결과적으로 로더 부재가 옳다.
 *     판정은 호출부가 `effectiveReduceMotion`(store/editor/tween.ts)으로 이미 접어서 넘긴다
 *     — 여기서 다시 조립하면 판정이 두 벌이 된다.
 *  2. ⚠️ 테스트 환경(`MODE === 'test'`) — 기존 렌더 테스트 6개(AppShell.wiring 40여 케이스 등)를
 *     한 줄도 고치지 않기 위한 스위치다(§7). 이 스위치는 테스트가 배송 경로와 **다른 경로**를
 *     돈다는 뜻이라 사각지대를 만든다. 그 사각지대는 `appLoader.test.tsx` 가 `MODE` 를
 *     'production' 으로 덮어써서 산다 — 그 파일을 지우면 이 분기가 곧 미검증 코드가 된다. */
/** 첫 방문에 자동으로 뜨는 안내(도움말 [시작하기])를 이 환경에서 띄우는가. 위 2 와 같은
 *  스위치다 — 테스트 환경에서는 AppShell 을 그리는 렌더 테스트 20여 개가 첫 방문 상태로 돌아
 *  모달이 그 위에 서면 초점·게이트 단언이 전부 흔들린다. 같은 사각지대·같은 처방:
 *  `appLoader.test.tsx` 가 MODE 를 덮어써 이 경로를 산다(2026-09-08). */
export function firstVisitPromptsEnabled(): boolean {
  return import.meta.env?.MODE !== 'test';
}

export function loaderMinMs(kind: AppLoaderKind, reduced: boolean): number {
  if (reduced) return 0;
  if (import.meta.env?.MODE === 'test') return 0;
  return APP_LOADER_MS[kind];
}
